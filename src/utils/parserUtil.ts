/**
 * parserUtil.ts
 * ──────────────────────────────────────────────────────────────────
 * Pure, offline text parser for Hinglish voice-to-bill commands.
 *
 * Responsibilities:
 *  1. Normalise raw STT transcript (case, unicode, filler words)
 *  2. Extract QUANTITY  — supports:
 *       • English digits:  "2", "2.5"
 *       • English words:   "one", "two", "half", "quarter"
 *       • Hindi numerals:  "ek", "do", "teen", "char", "paanch",
 *                          "chhe", "saat", "aath", "nau", "das"
 *       • Hindi fractions: "aadha"(0.5), "dedh"(1.5), "dhai"(2.5)
 *  3. Extract UNIT      — strips common Indian retail units
 *  4. Return SEARCH_TERM — cleaned product name for fuzzy matching
 *
 * Zero dependencies — pure TypeScript / Regex.
 * ──────────────────────────────────────────────────────────────────
 */

// ── Types ───────────────────────────────────────────────────────────

/** Result returned after parsing a voice transcript */
export interface ParsedCommand {
  /** Numeric quantity extracted, default 1 if none found */
  quantity: number;
  /** Detected unit string, e.g. "kg", "packet", or null */
  unit: string | null;
  /** Cleaned product search term (brand/name to match inventory) */
  searchTerm: string;
  /** The full normalised transcript before extraction */
  normalised: string;
  /** Whether a quantity was explicitly spoken (false = defaulted to 1) */
  quantityExplicit: boolean;
}

// ── Hinglish Number Maps ────────────────────────────────────────────

/**
 * Maps spoken Hindi/English words → numeric values.
 * Ordered longest-match first to avoid partial collisions
 * (e.g. "fifteen" before "five").
 *
 * Hindi words are as commonly recognised by hi-IN STT models.
 */
const NUMBER_WORD_MAP: Array<{ pattern: RegExp; value: number }> = [
  // ── Special Hindi fractions ────────────────────────────────────
  { pattern: /\baadha\b/i,         value: 0.5  },  // आधा  = half
  { pattern: /\baadhe\b/i,         value: 0.5  },  // आधे  = half (plural/oblique)
  { pattern: /\bdedh\b/i,          value: 1.5  },  // डेढ़  = 1.5
  { pattern: /\bdhai\b/i,          value: 2.5  },  // ढाई  = 2.5
  { pattern: /\bsaadhe\b/i,        value: 2.5  },  // साढ़े = 2.5 (also used)
  { pattern: /\bpaune\b/i,         value: 0.75 },  // पौने  = 0.75 (quarter less)
  { pattern: /\bsawa\b/i,          value: 1.25 },  // सवा   = 1.25 (quarter more)
  { pattern: /\bsaade?\b/i,        value: 3.5  },  // साढ़े  = 3.5 (saadhe teen)

  // ── Large English numbers ──────────────────────────────────────
  { pattern: /\btwenty[-\s]?five\b/i,  value: 25  },
  { pattern: /\btwenty[-\s]?four\b/i,  value: 24  },
  { pattern: /\btwenty[-\s]?three\b/i, value: 23  },
  { pattern: /\btwenty[-\s]?two\b/i,   value: 22  },
  { pattern: /\btwenty[-\s]?one\b/i,   value: 21  },
  { pattern: /\btwenty\b/i,            value: 20  },
  { pattern: /\bfifteen\b/i,           value: 15  },
  { pattern: /\bthirteen\b/i,          value: 13  },
  { pattern: /\btwelve\b/i,            value: 12  },
  { pattern: /\beleven\b/i,            value: 11  },
  { pattern: /\bten\b/i,               value: 10  },
  { pattern: /\bnine\b/i,              value: 9   },
  { pattern: /\beight\b/i,             value: 8   },
  { pattern: /\bseven\b/i,             value: 7   },
  { pattern: /\bsix\b/i,               value: 6   },
  { pattern: /\bfive\b/i,              value: 5   },
  { pattern: /\bfour\b/i,              value: 4   },
  { pattern: /\bthree\b/i,             value: 3   },
  { pattern: /\btwo\b/i,               value: 2   },
  { pattern: /\bone\b/i,               value: 1   },
  { pattern: /\bhalf\b/i,              value: 0.5 },
  { pattern: /\bquarter\b/i,           value: 0.25},

  // ── Hindi cardinal numbers (Roman transliteration) ────────────
  { pattern: /\bbees\b/i,   value: 20 },
  { pattern: /\bpandrah\b/i,value: 15 },
  { pattern: /\bbaarah\b/i, value: 12 },
  { pattern: /\bgyarah\b/i, value: 11 },
  { pattern: /\bdas\b/i,    value: 10 },
  { pattern: /\bnau\b/i,    value: 9  },
  { pattern: /\baath\b/i,   value: 8  },
  { pattern: /\bsaat\b/i,   value: 7  },
  { pattern: /\bchhe\b/i,   value: 6  },
  { pattern: /\bpaanch\b/i, value: 5  },
  { pattern: /\bpanch\b/i,  value: 5  },
  { pattern: /\bchar\b/i,   value: 4  },
  { pattern: /\bteen\b/i,   value: 3  },
  { pattern: /\btin\b/i,    value: 3  },
  { pattern: /\bdo\b/i,     value: 2  },
  { pattern: /\bduo\b/i,    value: 2  },
  { pattern: /\bek\b/i,     value: 1  },
];

// ── Unit Vocabulary ─────────────────────────────────────────────────

/**
 * Common Indian retail units to be stripped from the search term.
 * Each entry: { pattern (word-boundary regex), canonical: string }
 *
 * These are STRIPPED from the searchTerm so fuzzy search focuses
 * purely on the product name, not the unit.
 */
interface UnitDef { pattern: RegExp; canonical: string; }

const UNIT_DEFINITIONS: UnitDef[] = [
  // Weight
  { pattern: /\bkilos?\b|\bkilogram[s]?\b|\bkg\b/i,     canonical: 'kg'      },
  { pattern: /\bgrams?\b|\bgm[s]?\b|\bgms?\b/i,         canonical: 'gm'      },
  { pattern: /\bquintal[s]?\b/i,                        canonical: 'quintal' },
  // Liquid
  { pattern: /\blitre[s]?\b|\bliter[s]?\b|\bl\b/i,      canonical: 'litre'   },
  { pattern: /\bml\b|\bmillilitre[s]?\b/i,              canonical: 'ml'      },
  // Count
  { pattern: /\bpackets?\b|\bpkts?\b|\bpkt\b/i,         canonical: 'packet'  },
  { pattern: /\bpieces?\b|\bpcs?\b|\bpiec\b/i,          canonical: 'piece'   },
  { pattern: /\bpouches?\b/i,                           canonical: 'pouch'   },
  { pattern: /\bbottles?\b/i,                           canonical: 'bottle'  },
  { pattern: /\bbags?\b/i,                              canonical: 'bag'     },
  { pattern: /\bboxes?\b|\bbox\b/i,                     canonical: 'box'     },
  { pattern: /\bcartons?\b/i,                           canonical: 'carton'  },
  { pattern: /\bbarnis?\b/i,                            canonical: 'barni'   }, // Indian jar
  { pattern: /\bdozen[s]?\b/i,                          canonical: 'dozen'   },
  // Hindi units
  { pattern: /\bkilo\b/i,                               canonical: 'kg'      }, // "kilo" spoken in Hindi
  { pattern: /\bkiLo\b/i,                               canonical: 'kg'      },
  { pattern: /\bpao\b|\bpav\b|\bpaav\b/i,              canonical: 'pao'     }, // 250g
  { pattern: /\bseer\b/i,                               canonical: 'seer'    }, // ~1kg traditional
  { pattern: /\btola[s]?\b/i,                           canonical: 'tola'    }, // ~11.7g
];

// ── Filler Words to Strip ───────────────────────────────────────────

/**
 * Common filler / connector words spoken by Indian shopkeepers
 * that carry no product meaning and should be stripped before
 * passing the search term to fuzzy matching.
 */
const FILLER_PATTERNS: RegExp[] = [
  /\bdo\s+na\b/i,        // "do na" → remove "do na" (already captured "2")
  /\bde\s*na\b/i,        // "dena" — give me
  /\bdena\b/i,
  /\bde\s*do\b/i,        // "de do" — give
  /\blaana\b/i,          // "laana" — bring
  /\blaao\b/i,
  /\blao\b/i,
  /\bchahiye\b/i,        // "chahiye" — want
  /\bwala\b|\bwali\b|\bwaala\b/i,  // "-wala" suffix
  /\bka\b|\bki\b|\bke\b/i,         // Hindi genitive particles
  /\baur\b/i,            // "aur" — and (start of next item)
  /\bplease\b/i,
  /\bkaro\b/i,
  /\badd\b/i,            // "add kar do"
  /\bkar\b/i,
  /\byeh\b|\byeh\b|\bwoh\b|\bvoh\b/i, // demonstratives
  /\bmujhe\b/i,          // "mujhe" — me
  /\bhumein\b/i,
  /\btheek\b/i,
  /\bhai\b/i,
];

// ── Main Parser Function ────────────────────────────────────────────

/**
 * parseVoiceCommand
 *
 * Parses a raw Hinglish/Hindi/English voice transcript and extracts
 * quantity, unit, and the product search term.
 *
 * @param rawTranscript  - Original string from STT (can be mixed case)
 * @returns ParsedCommand object
 *
 * @example
 * parseVoiceCommand("do kilo aashirvaad aata dena")
 * // → { quantity: 2, unit: "kg", searchTerm: "aashirvaad aata", ... }
 *
 * parseVoiceCommand("5 packet maggi")
 * // → { quantity: 5, unit: "packet", searchTerm: "maggi", ... }
 *
 * parseVoiceCommand("aadha kilo dahi")
 * // → { quantity: 0.5, unit: "kg", searchTerm: "dahi", ... }
 */
export function parseVoiceCommand(rawTranscript: string): ParsedCommand {
  // ── Step 1: Normalise ──────────────────────────────────────────
  // Lowercase, trim, collapse multiple spaces
  let text = rawTranscript
    .toLowerCase()
    .normalize('NFC')            // normalise Unicode (Hindi diacritics)
    .replace(/[।॥]/g, ' ')      // strip Hindi punctuation
    .replace(/[.,!?;:'"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const normalised = text;

  // ── Step 2: Extract Quantity ───────────────────────────────────
  let quantity = 1;
  let quantityExplicit = false;

  // 2a. Try explicit numeric digit first (e.g. "2", "2.5", "½")
  //     Regex: optional decimal, must be at word boundary
  const numericMatch = text.match(/\b(\d+(?:[.,]\d+)?)\b/);
  if (numericMatch) {
    const raw = numericMatch[1].replace(',', '.');
    const parsed = parseFloat(raw);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 999) {
      quantity = parsed;
      quantityExplicit = true;
      // Remove the matched number from the working string
      text = text.replace(numericMatch[0], ' ').trim();
    }
  }

  // 2b. Try word numbers (only if no digit found, or to add fractional)
  if (!quantityExplicit) {
    for (const { pattern, value } of NUMBER_WORD_MAP) {
      if (pattern.test(text)) {
        quantity = value;
        quantityExplicit = true;
        text = text.replace(pattern, ' ');
        break; // first (longest) match wins
      }
    }
  }

  // ── Step 3: Extract Unit ───────────────────────────────────────
  let unit: string | null = null;

  for (const { pattern, canonical } of UNIT_DEFINITIONS) {
    if (pattern.test(text)) {
      unit = canonical;
      text = text.replace(pattern, ' ');
      break; // one unit per command
    }
  }

  // ── Step 4: Strip Filler Words ─────────────────────────────────
  for (const filler of FILLER_PATTERNS) {
    text = text.replace(filler, ' ');
  }

  // ── Step 5: Sanitise Search Term ──────────────────────────────
  // Collapse multiple spaces, trim leading/trailing
  text = text.replace(/\s+/g, ' ').trim();

  // Remove stray single characters that are not part of a brand
  // (e.g. leftover "a", "e" from partial stripping)
  text = text.replace(/(?<!\w)\b[a-z]\b(?!\w)/g, ' ').replace(/\s+/g, ' ').trim();

  return {
    quantity,
    unit,
    searchTerm: text,
    normalised,
    quantityExplicit,
  };
}

// ── Helper: Build display string for the parsed command ────────────

/**
 * Returns a human-readable summary of the parsed command.
 * Useful for showing live feedback in the UI.
 *
 * @example
 * formatParsedCommand({ quantity:2, unit:"kg", searchTerm:"aata" })
 * // → "2 kg – aata"
 */
export function formatParsedCommand(cmd: ParsedCommand): string {
  const parts: string[] = [];
  parts.push(`${cmd.quantity}`);
  if (cmd.unit) parts.push(cmd.unit);
  if (cmd.searchTerm) parts.push(`– ${cmd.searchTerm}`);
  return parts.join(' ');
}

// ── Unit Display Name ───────────────────────────────────────────────

/**
 * Returns a display-friendly unit string.
 * Falls back to the product's own unit field if no voice unit detected.
 */
export function resolveDisplayUnit(voiceUnit: string | null, productUnit: string): string {
  return voiceUnit ?? productUnit ?? '';
}
