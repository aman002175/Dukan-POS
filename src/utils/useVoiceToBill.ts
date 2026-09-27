/**
 * useVoiceToBill.ts
 * ──────────────────────────────────────────────────────────────────
 * Main React hook that orchestrates:
 *   voiceService  → parserUtil  → inventoryMatcher  → cart update
 *
 * Exposes a clean API to POSSection (or any other component):
 *
 *   const {
 *     isSupported,      // bool: browser supports Web Speech API
 *     status,           // VoiceStatus: 'idle'|'listening'|'processing'|'error'
 *     transcript,       // live transcript string for UI display
 *     lastResult,       // last VoiceCommandResult for toast/feedback
 *     startListening,   // fn: start mic → parse → add to cart
 *     stopListening,    // fn: manually stop mic
 *     clearResult,      // fn: reset lastResult after showing it
 *   } = useVoiceToBill({ cart, setCart, products });
 *
 * Design decisions:
 *  - InventoryMatcher instance is memo-ised; only rebuilt when
 *    `products` array reference changes.
 *  - VoiceService instance is created once per hook mount and
 *    destroyed on unmount — no re-init on each listen.
 *  - All parsing is synchronous (regex + Fuse.js) — no async needed.
 * ──────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createVoiceService, type VoiceStatus, type VoiceError } from './voiceService';
import { parseVoiceCommand, formatParsedCommand } from './parserUtil';
import { InventoryMatcher } from './inventoryMatcher';
import { askAI, isAIEnabled } from './aiService';
import { saveMessageToActiveConversation } from './chatStorage';
import { defaultAppState } from './storage';
import type { Product, CartItem } from '@/types';

// ── Types ────────────────────────────────────────────────────────────

/** The outcome of a single voice command attempt */
export type VoiceCommandOutcome =
  | 'added'           // Item found and added/updated in cart
  | 'updated'         // Item already in cart, quantity increased
  | 'not_found'       // No matching product above threshold
  | 'out_of_stock'    // Product found but stock = 0
  | 'low_stock'       // Added but quantity exceeds available stock (capped)
  | 'empty_query'     // Transcript parsed but no search term extracted
  | 'error';          // Voice / microphone error

/** Full result object returned for each command attempt */
export interface VoiceCommandResult {
  outcome: VoiceCommandOutcome;
  /** The raw transcript that was spoken */
  transcript: string;
  /** Parsed human-readable command for display, e.g. "2 kg – Aata" */
  parsedLabel: string;
  /** The product that was matched (null if not found) */
  product: Product | null;
  /** Quantity that was added to cart */
  quantity: number;
  /** Fuzzy match confidence [0–1] (0 if not found) */
  confidence: number;
  /** Error details (if outcome === 'error') */
  error?: VoiceError;
  /** Human-friendly message to display in a toast / snackbar */
  toastMessage: string;
  /** Toast style type */
  toastType: 'success' | 'error' | 'warning' | 'info';
}

/** Props passed in to configure the hook */
export interface UseVoiceToBillProps {
  /** Current inventory array */
  products: Product[];
  /** Current cart state */
  cart: CartItem[];
  /** Setter to update cart state (from POSSection useState) */
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  /**
   * Minimum fuzzy confidence threshold.
   * Default: 0.45 — tuned for Hinglish STT noise.
   */
  confidenceThreshold?: number;
  /**
   * Called after every successful cart update.
   * Can be used for analytics or additional side effects.
   */
  onCartUpdated?: (result: VoiceCommandResult) => void;
}

/** What the hook returns */
export interface UseVoiceToBillReturn {
  /** Is Web Speech API supported in this browser? */
  isSupported: boolean;
  /** Current recognition state */
  status: VoiceStatus;
  /** Live transcript while the user is speaking (interim) */
  interimTranscript: string;
  /** Confirmed final transcript of last utterance */
  finalTranscript: string;
  /** Result of the last voice command (null until first use) */
  lastResult: VoiceCommandResult | null;
  /** True when mic is actively capturing speech */
  isListening: boolean;
  /** Start mic + automatic parsing + cart update flow */
  startListening: () => void;
  /** Manually stop the microphone */
  stopListening: () => void;
  /** Clear lastResult (call after displaying feedback) */
  clearResult: () => void;
  /** Toggle: start if idle, stop if listening */
  toggleListening: () => void;
}

// ── Toast message builders ───────────────────────────────────────────

function buildToastMessage(
  outcome: VoiceCommandOutcome,
  product: Product | null,
  quantity: number,
  confidence: number,
  error?: VoiceError
): { message: string; type: VoiceCommandResult['toastType'] } {
  switch (outcome) {
    case 'added':
      return {
        message: `✅ ${quantity} × ${product!.name} cart mein add ho gaya!`,
        type: 'success',
      };
    case 'updated':
      return {
        message: `🔄 ${product!.name} ki quantity update ho gaya (${quantity} aur)`,
        type: 'success',
      };
    case 'out_of_stock':
      return {
        message: `❌ ${product!.name} — stock khatam hai!`,
        type: 'error',
      };
    case 'low_stock':
      return {
        message: `⚠️ ${product!.name} — sirf ${product!.stock} bacha hai, wahi add kar diya`,
        type: 'warning',
      };
    case 'not_found': {
      const hint = confidence > 0
        ? ` (${Math.round(confidence * 100)}% match — bahut kam)`
        : '';
      return {
        message: `🔍 Item nahi mila${hint}. Clearly bolein ya manually search karein.`,
        type: 'error',
      };
    }
    case 'empty_query':
      return {
        message: '🎤 Koi item nahi samjha. Phir bolein — jaise "2 kilo aata".',
        type: 'warning',
      };
    case 'error':
      return {
        message: error?.message ?? '❗ Voice error aaya. Phir koshish karein.',
        type: 'error',
      };
    default:
      return { message: 'Kuch galat ho gaya.', type: 'error' };
  }
}

// ── The Hook ─────────────────────────────────────────────────────────

export function useVoiceToBill({
  products,
  cart,
  setCart,
  confidenceThreshold = 0.45,
  onCartUpdated,
}: UseVoiceToBillProps): UseVoiceToBillReturn {

  // ── State ──────────────────────────────────────────────────────
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [lastResult, setLastResult] = useState<VoiceCommandResult | null>(null);

  // ── Refs ───────────────────────────────────────────────────────
  // Keep VoiceService alive across renders (not re-created on each render)
  const serviceRef = useRef<ReturnType<typeof createVoiceService> | null>(null);
  // Keep latest cart/products in a ref so the closure inside
  // onFinalResult always sees current values without re-subscribing
  const cartRef = useRef(cart);
  const productsRef = useRef(products);

  useEffect(() => { cartRef.current = cart; }, [cart]);
  useEffect(() => { productsRef.current = products; }, [products]);

  // ── Memo: InventoryMatcher ──────────────────────────────────────
  // Rebuilt only when products reference changes (e.g. new item added)
  const matcher = useMemo(
    () => new InventoryMatcher(products, { threshold: confidenceThreshold }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [products, confidenceThreshold]
  );

  // ── Core: process a final transcript ───────────────────────────

  const processTranscript = useCallback(async (transcript: string) => {
    setStatus('processing');
    setFinalTranscript(transcript);
    setInterimTranscript('');

    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const aiActive = isOnline && isAIEnabled();

    if (aiActive) {
      try {
        const currentState = {
          ...defaultAppState,
          products: productsRef.current,
        };

        const response = await askAI(transcript, currentState, [], cartRef.current, 'pos');
        saveMessageToActiveConversation(transcript, response.answer);

        if (response.action && response.action.type !== 'none') {
          if (response.action.type === 'add_to_cart') {
            const items = response.action.items || [];
            if (items.length > 0) {
              let matchedProductsCount = 0;
              let firstProduct: Product | null = null;
              let totalQtyAdded = 0;

              items.forEach(aiItem => {
                let prod = productsRef.current.find(p => p.id === aiItem.productId);
                if (!prod && aiItem.productName) {
                  const q = aiItem.productName.toLowerCase().trim();
                  prod = productsRef.current.find(p => p.name.toLowerCase().trim() === q);
                }
                if (prod && prod.stock > 0) {
                  matchedProductsCount++;
                  firstProduct = prod;
                  totalQtyAdded += aiItem.quantity || 1;
                  window.dispatchEvent(new CustomEvent('ai-add-to-cart', {
                    detail: { productId: prod.id, quantity: aiItem.quantity || 1 }
                  }));
                }
              });

              if (matchedProductsCount > 0 && firstProduct) {
                const result: VoiceCommandResult = {
                  outcome: 'added',
                  transcript,
                  parsedLabel: `${totalQtyAdded} × ${(firstProduct as Product).name}`,
                  product: firstProduct,
                  quantity: totalQtyAdded,
                  confidence: 0.99,
                  toastMessage: `🤖 Smart AI: ${items.map(i => `${i.quantity || 1} × ${i.productName}`).join(', ')} cart mein add ho gaya!`,
                  toastType: 'success',
                };
                setLastResult(result);
                setStatus('idle');
                onCartUpdated?.(result);
                return;
              }
            }
          } else if (response.action.type === 'record_cash' || response.action.type === 'record_udhaar') {
            window.dispatchEvent(new CustomEvent('ai-record-bill', { detail: response.action }));
            const result: VoiceCommandResult = {
              outcome: 'added',
              transcript,
              parsedLabel: response.answer,
              product: null,
              quantity: 1,
              confidence: 0.99,
              toastMessage: `🤖 Smart AI Bill: ${response.answer}`,
              toastType: 'success',
            };
            setLastResult(result);
            setStatus('idle');
            onCartUpdated?.(result);
            return;
          }
        }
      } catch (err) {
        console.warn('AI matching failed or offline, falling back to local matcher:', err);
      }
    }

    // ── OFFLINE MODE FALLBACK (Local Regex + Fuse.js Matcher) ──
    const parsed = parseVoiceCommand(transcript);
    const parsedLabel = formatParsedCommand(parsed);

    // Step B: Guard empty search term
    if (!parsed.searchTerm || parsed.searchTerm.length < 2) {
      const result: VoiceCommandResult = {
        outcome: 'empty_query',
        transcript,
        parsedLabel,
        product: null,
        quantity: parsed.quantity,
        confidence: 0,
        toastMessage: buildToastMessage('empty_query', null, parsed.quantity, 0).message,
        toastType: 'warning',
      };
      setLastResult(result);
      setStatus('idle');
      return;
    }

    // Step C: Fuzzy search inventory
    const searchResult = matcher.search(parsed.searchTerm);

    // Step D: Handle not found
    if (!searchResult.product) {
      const result: VoiceCommandResult = {
        outcome: 'not_found',
        transcript,
        parsedLabel,
        product: null,
        quantity: parsed.quantity,
        confidence: searchResult.confidence,
        toastMessage: buildToastMessage('not_found', null, parsed.quantity, searchResult.confidence).message,
        toastType: 'error',
      };
      setLastResult(result);
      setStatus('idle');
      return;
    }

    const product = searchResult.product;
    const requestedQty = parsed.quantity;

    // Step E: Check stock
    if (product.stock <= 0) {
      const result: VoiceCommandResult = {
        outcome: 'out_of_stock',
        transcript,
        parsedLabel,
        product,
        quantity: 0,
        confidence: searchResult.confidence,
        toastMessage: buildToastMessage('out_of_stock', product, 0, searchResult.confidence).message,
        toastType: 'error',
      };
      setLastResult(result);
      setStatus('idle');
      return;
    }

    // Step F: Update cart
    let outcome: VoiceCommandOutcome = 'added';
    let finalQty = requestedQty;

    setCart(prevCart => {
      const existing = prevCart.find(item => item.product.id === product.id);
      const currentCartQty = existing?.quantity ?? 0;
      const maxAddable = product.stock - currentCartQty;

      if (maxAddable <= 0) {
        // Stock exhausted by cart already
        outcome = 'out_of_stock';
        return prevCart;
      }

      // Cap quantity at available stock
      const cappedQty = Math.min(requestedQty, maxAddable);
      if (cappedQty < requestedQty) {
        outcome = 'low_stock';
        finalQty = cappedQty;
      }

      if (existing) {
        outcome = outcome === 'low_stock' ? 'low_stock' : 'updated';
        return prevCart.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + cappedQty }
            : item
        );
      } else {
        outcome = outcome === 'low_stock' ? 'low_stock' : 'added';
        return [...prevCart, { product, quantity: cappedQty }];
      }
    });

    // Step G: Build and broadcast result
    // (finalQty / outcome may be updated by setCart callback above,
    //  but since setCart is async, we compute conservatively here)
    const { message, type: toastType } = buildToastMessage(
      outcome, product, finalQty, searchResult.confidence
    );

    const result: VoiceCommandResult = {
      outcome,
      transcript,
      parsedLabel,
      product,
      quantity: finalQty,
      confidence: searchResult.confidence,
      toastMessage: message,
      toastType,
    };

    setLastResult(result);
    setStatus('idle');
    onCartUpdated?.(result);

  }, [matcher, setCart, onCartUpdated]);

  // ── VoiceService lifecycle ──────────────────────────────────────

  useEffect(() => {
    // Create VoiceService on mount
    const svc = createVoiceService({
      onListeningStart: () => {
        setStatus('listening');
        setInterimTranscript('');
        setFinalTranscript('');
      },
      onInterimResult: (t) => {
        setInterimTranscript(t);
      },
      onFinalResult: (t) => {
        processTranscript(t);
      },
      onError: (error) => {
        setStatus('error');
        const result: VoiceCommandResult = {
          outcome: 'error',
          transcript: '',
          parsedLabel: '',
          product: null,
          quantity: 0,
          confidence: 0,
          error,
          toastMessage: error.message,
          toastType: 'error',
        };
        setLastResult(result);
      },
      onEnd: () => {
        // Only reset to idle if not already in 'processing' state
        setStatus(prev => prev === 'processing' ? prev : 'idle');
        setInterimTranscript('');
      },
    });

    serviceRef.current = svc;

    // Destroy on unmount
    return () => {
      svc.destroy();
      serviceRef.current = null;
    };
  // processTranscript is stable (only changes when matcher changes)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processTranscript]);

  // ── Public API ──────────────────────────────────────────────────

  const startListening = useCallback(() => {
    setLastResult(null);
    serviceRef.current?.start();
  }, []);

  const stopListening = useCallback(() => {
    serviceRef.current?.stop();
    setStatus('idle');
  }, []);

  const toggleListening = useCallback(() => {
    if (status === 'listening') {
      stopListening();
    } else {
      startListening();
    }
  }, [status, startListening, stopListening]);

  const clearResult = useCallback(() => {
    setLastResult(null);
    setFinalTranscript('');
    setInterimTranscript('');
  }, []);

  return {
    isSupported: typeof window !== 'undefined'
      ? !!(
          (window as unknown as Record<string, unknown>).SpeechRecognition ||
          (window as unknown as Record<string, unknown>).webkitSpeechRecognition
        )
      : false,
    status,
    interimTranscript,
    finalTranscript,
    lastResult,
    isListening: status === 'listening',
    startListening,
    stopListening,
    toggleListening,
    clearResult,
  };
}
