/**
 * inventoryMatcher.ts
 * ──────────────────────────────────────────────────────────────────
 * Fuzzy inventory search using Fuse.js.
 *
 * Responsibilities:
 *  1. Accept a search term (output of parserUtil) + product array
 *  2. Run Fuse.js fuzzy search across product name + SKU + category
 *  3. Apply a confidence threshold to filter irrelevant results
 *  4. Return a ranked MatchResult (or null if nothing qualifies)
 *
 * Completely offline — Fuse.js is a bundled JS library (no network).
 * ──────────────────────────────────────────────────────────────────
 */

import Fuse, { type FuseResult } from 'fuse.js';
import type { Product } from '@/types';

// ── Types ───────────────────────────────────────────────────────────

/** A successful match result with score metadata */
export interface MatchResult {
  /** The matched product from inventory */
  product: Product;
  /**
   * Confidence score in the range [0, 1].
   * 1.0 = perfect match, 0.0 = no similarity at all.
   * (Inverted from Fuse.js raw score, which is 0 = perfect.)
   */
  confidence: number;
  /** Human-readable confidence level for UI display */
  confidenceLabel: 'exact' | 'high' | 'medium' | 'low';
  /** The Fuse.js internal score (0 = perfect, 1 = no match) — for debug */
  rawScore: number;
}

/** Returned when no product meets the confidence threshold */
export interface NoMatchResult {
  product: null;
  confidence: 0;
  confidenceLabel: 'none';
  rawScore: number;
}

export type SearchResult = MatchResult | NoMatchResult;

/** Options for customising search behaviour */
export interface MatcherOptions {
  /**
   * Minimum confidence [0–1] required to accept a match.
   * Below this → NoMatchResult.
   *
   * Tuning guide:
   *  0.4 = loose  (catches more, more false positives)
   *  0.5 = default (good balance for Indian brand names)
   *  0.65 = strict (very accurate, may miss phonetic variants)
   *
   * Default: 0.45 — slightly loose to handle STT transcription
   * quirks (e.g. "ashirvaad" vs "aashirvaad").
   */
  threshold?: number;
  /**
   * Maximum number of top results to consider before picking
   * the best by score. Default: 5.
   */
  maxResults?: number;
}

// ── Confidence Thresholds ───────────────────────────────────────────

const DEFAULT_THRESHOLD = 0.45;

/**
 * Maps raw Fuse score → our [0,1] confidence scale.
 * Fuse scores: 0 = perfect match, 1 = no match at all.
 * We invert: confidence = 1 - fuseScore.
 */
function toConfidence(fuseScore: number): number {
  return Math.max(0, Math.min(1, 1 - fuseScore));
}

function toConfidenceLabel(confidence: number): MatchResult['confidenceLabel'] {
  if (confidence >= 0.95) return 'exact';
  if (confidence >= 0.70) return 'high';
  if (confidence >= 0.45) return 'medium';
  return 'low';
}

// ── Pre-processing: Normalise for fuzzy matching ────────────────────

/**
 * Normalise a product name for better fuzzy matching.
 * Strips weight/pack suffixes like "5kg", "500g", "200ml" from names
 * so "Aashirvaad Aata 5kg" matches query "aashirvaad aata".
 */
function normaliseProductName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\d+\s*(?:kg|gm|g|ml|l|litre|ltr|pkt|piece|pc|pack)\b/gi, '')
    .replace(/[()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Build an augmented product object with normalised fields
 * for better Fuse.js indexing.
 */
interface AugmentedProduct extends Product {
  /** normalised name for Fuse indexing */
  _normName: string;
  /** name + category string for broader matching */
  _combined: string;
}

function augment(p: Product): AugmentedProduct {
  return {
    ...p,
    _normName: normaliseProductName(p.name),
    _combined: `${normaliseProductName(p.name)} ${p.category.toLowerCase()} ${p.sku.toLowerCase()}`,
  };
}

// ── Fuse.js Configuration ───────────────────────────────────────────

/**
 * Build a Fuse instance tuned for Indian FMCG product names.
 *
 * Key settings explained:
 *  - `threshold: 0.5`    — Fuse internal cutoff (we apply our own too)
 *  - `minMatchCharLength: 2` — avoid single-char false positives
 *  - `ignoreLocation: true`  — match anywhere in string, not just start
 *  - `useExtendedSearch: false` — keep it simple, no ^ $ prefixes
 *  - `distance: 200`     — allow matches anywhere in a long product name
 *  - Keys weighted:
 *      _normName  = 2.0  (most important — stripped product name)
 *      name       = 1.5  (original name as fallback)
 *      _combined  = 1.0  (SKU + category breadth)
 */
function buildFuse(products: AugmentedProduct[]): Fuse<AugmentedProduct> {
  return new Fuse(products, {
    keys: [
      { name: '_normName', weight: 2.0 },
      { name: 'name',      weight: 1.5 },
      { name: '_combined', weight: 1.0 },
    ],
    threshold: 0.55,       // Fuse internal cutoff (generous, we filter ourself)
    includeScore: true,    // essential — we read the score
    minMatchCharLength: 2,
    ignoreLocation: true,  // match anywhere in the name
    distance: 200,
    shouldSort: true,      // sort by best score first
    findAllMatches: false,
    useExtendedSearch: false,
  });
}

// ── InventoryMatcher class ──────────────────────────────────────────

/**
 * InventoryMatcher
 *
 * Creates and caches a Fuse.js index from an inventory array.
 * The index is rebuilt only when the products array reference changes.
 *
 * Usage (in a hook or service):
 * ```ts
 * const matcher = new InventoryMatcher(products);
 * const result = matcher.search("aashirvaad aata");
 * if (result.product) {
 *   console.log(result.product.name, result.confidence);
 * }
 * ```
 */
export class InventoryMatcher {
  private fuse: Fuse<AugmentedProduct>;
  private augmented: AugmentedProduct[];
  private options: Required<MatcherOptions>;

  constructor(products: Product[], options: MatcherOptions = {}) {
    this.options = {
      threshold: options.threshold ?? DEFAULT_THRESHOLD,
      maxResults: options.maxResults ?? 5,
    };
    this.augmented = products.map(augment);
    this.fuse = buildFuse(this.augmented);
  }

  /**
   * Update the index when inventory changes (e.g. new product added).
   * Call this when `products` prop changes in your hook.
   */
  updateProducts(products: Product[]): void {
    this.augmented = products.map(augment);
    this.fuse = buildFuse(this.augmented);
  }

  /**
   * Search inventory for the best-matching product.
   *
   * @param searchTerm - Cleaned product name from parserUtil
   * @returns MatchResult if confidence ≥ threshold, else NoMatchResult
   *
   * @example
   * matcher.search("maggi noodles")
   * // → { product: {...}, confidence: 0.87, confidenceLabel: "high" }
   *
   * matcher.search("xyzqwerty")
   * // → { product: null, confidence: 0, confidenceLabel: "none" }
   */
  search(searchTerm: string): SearchResult {
    // Guard: empty search term
    const term = searchTerm.trim();
    if (term.length < 2) {
      return { product: null, confidence: 0, confidenceLabel: 'none', rawScore: 1 };
    }

    // Run Fuse search
    const results: FuseResult<AugmentedProduct>[] = this.fuse.search(
      term,
      { limit: this.options.maxResults }
    );

    if (results.length === 0) {
      return { product: null, confidence: 0, confidenceLabel: 'none', rawScore: 1 };
    }

    // Best result (Fuse already sorted by score)
    const best = results[0];
    const fuseScore = best.score ?? 1;
    const confidence = toConfidence(fuseScore);

    // Apply our confidence threshold
    if (confidence < this.options.threshold) {
      return { product: null, confidence: 0, confidenceLabel: 'none', rawScore: fuseScore };
    }

    // Return the original (non-augmented) product
    const product = best.item as unknown as Product;

    return {
      product,
      confidence,
      confidenceLabel: toConfidenceLabel(confidence),
      rawScore: fuseScore,
    };
  }

  /**
   * Search and return multiple ranked candidates.
   * Useful for showing a "Did you mean?" list in the UI.
   *
   * @param searchTerm  - Cleaned product name
   * @param topN        - How many results to return (default 3)
   */
  searchTop(searchTerm: string, topN = 3): MatchResult[] {
    const term = searchTerm.trim();
    if (term.length < 2) return [];

    const results = this.fuse.search(term, { limit: topN + 2 });

    return results
      .filter(r => toConfidence(r.score ?? 1) >= this.options.threshold)
      .slice(0, topN)
      .map(r => ({
        product: r.item as unknown as Product,
        confidence: toConfidence(r.score ?? 1),
        confidenceLabel: toConfidenceLabel(toConfidence(r.score ?? 1)),
        rawScore: r.score ?? 1,
      }));
  }
}

// ── Factory function ─────────────────────────────────────────────────

/**
 * Create a ready-to-use InventoryMatcher instance.
 * ```ts
 * const matcher = createInventoryMatcher(products, { threshold: 0.5 });
 * ```
 */
export function createInventoryMatcher(
  products: Product[],
  options?: MatcherOptions
): InventoryMatcher {
  return new InventoryMatcher(products, options);
}

// ── Standalone helper (no class needed) ────────────────────────────

/**
 * One-shot fuzzy search without instantiating a class.
 * Good for occasional searches where no index caching is needed.
 *
 * @param products    - Inventory array
 * @param searchTerm  - Cleaned product name
 * @param threshold   - Confidence cutoff (default 0.45)
 */
export function quickSearch(
  products: Product[],
  searchTerm: string,
  threshold = DEFAULT_THRESHOLD
): SearchResult {
  const matcher = new InventoryMatcher(products, { threshold });
  return matcher.search(searchTerm);
}
