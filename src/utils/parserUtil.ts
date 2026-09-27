/**
 * parserUtil.ts
 * ──────────────────────────────────────────────────────────────────
 * Pure, offline text parser for Hinglish / Hindi / English voice-to-bill.
 *
 * KEY UPGRADE: Full Devanagari → Roman transliteration layer.
 * STT engines (hi-IN) return Unicode Hindi text like "चार चॉकलेट" or
 * "किटकैट" — this module converts ALL such input to Roman equivalent
 * BEFORE any parsing, so the rest of the pipeline works uniformly.
 *
 * Pipeline:
 *   rawTranscript (any script)
 *     → devanagariToRoman()   ← NEW: Unicode → ASCII
 *     → normalise()
 *     → extractQuantity()     ← Hindi numerals in Roman: char=4, ek=1 …
 *     → extractUnit()
 *     → stripFillers()
 *     → searchTerm           ← clean ASCII product name for Fuse.js
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

// ══════════════════════════════════════════════════════════════════
// SECTION 1 — DEVANAGARI → ROMAN TRANSLITERATION
// ══════════════════════════════════════════════════════════════════

/**
 * Devanagari digit → ASCII digit map.
 * Hindi STT can return "२" (Devanagari 2) instead of "2".
 */
const DEVA_DIGITS: Record<string, string> = {
  '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
  '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
};

/**
 * Devanagari word → Roman transliteration table.
 *
 * Strategy: map the most common kirana vocabulary words by their
 * exact Unicode string. We use longest-first ordering so multi-char
 * matchers win over partial ones.
 *
 * Coverage priorities (from real hi-IN STT output):
 *  1. Number words (cardinal + fractional)
 *  2. Unit words (kilo, packet, litre…)
 *  3. Ultra-common kirana brands (kitkat, maggi, parle…)
 *  4. Common filler words
 *  5. Common grocery categories / items
 */
const DEVA_WORD_MAP: Array<[RegExp, string]> = [
  // ── Number words (fractions first — longest match priority) ──────
  [/आधा|आधे/g,       'aadha'],
  [/डेढ़|डेढ/g,       'dedh'],
  [/ढाई/g,            'dhai'],
  [/साढ़े|साढे/g,      'saadhe'],
  [/पौने/g,           'paune'],
  [/सवा/g,            'sawa'],

  // ── Cardinal numbers ─────────────────────────────────────────────
  [/बीस/g,            'bees'],
  [/उन्नीस/g,         'unnis'],
  [/अट्ठारह/g,        'atharah'],
  [/सत्रह/g,          'satrah'],
  [/सोलह/g,           'solah'],
  [/पंद्रह/g,         'pandrah'],
  [/चौदह/g,           'chaudah'],
  [/तेरह/g,           'terah'],
  [/बारह/g,           'baarah'],
  [/ग्यारह/g,         'gyarah'],
  [/दस/g,             'das'],
  [/नौ/g,             'nau'],
  [/आठ/g,             'aath'],
  [/सात/g,            'saat'],
  [/छह|छे/g,          'chhe'],
  [/पाँच|पांच/g,      'paanch'],
  [/चार/g,            'char'],
  [/तीन/g,            'teen'],
  [/दो/g,             'do'],
  [/एक/g,             'ek'],

  // ── Units ────────────────────────────────────────────────────────
  [/किलोग्राम/g,       'kilogram'],
  [/किलो/g,           'kilo'],
  [/ग्राम/g,           'gram'],
  [/लीटर|लिटर/g,      'litre'],
  [/मिलीलीटर|मिली/g,  'ml'],
  [/पैकेट/g,          'packet'],
  [/पाउच/g,           'pouch'],
  [/बोतल/g,           'bottle'],
  [/थैला|थैली/g,      'bag'],
  [/डिब्बा|डिब्बे/g,   'box'],
  [/पाव|पाओ/g,        'pao'],
  [/दर्जन/g,          'dozen'],
  [/पीस|पीस/g,        'piece'],

  // ── Ultra-common kirana brands (STT writes these in Devanagari) ──
  [/किटकैट|किट\s*कैट/g,          'kitkat'],
  [/चॉकलेट|चाकलेट|चॉकलट/g,     'chocolate'],
  [/मैगी|मेगी/g,                  'maggi'],
  [/आशीर्वाद|आशीरवाद|आशिर्वाद/g, 'aashirvaad'],
  [/आटा|अट्टा/g,                  'aata'],
  [/पारले|पार्ले/g,                'parle'],
  [/बिस्कुट|बिस्किट/g,            'biscuit'],
  [/नमकीन/g,                      'namkeen'],
  [/दाल/g,                        'dal'],
  [/चावल/g,                       'chawal'],
  [/चीनी/g,                       'chini'],
  [/नमक/g,                        'namak'],
  [/तेल/g,                        'tel'],
  [/घी/g,                         'ghee'],
  [/दूध/g,                        'doodh'],
  [/दही/g,                        'dahi'],
  [/मक्खन/g,                      'makhan'],
  [/पनीर/g,                       'paneer'],
  [/सरसों/g,                      'sarson'],
  [/हल्दी/g,                      'haldi'],
  [/मिर्च/g,                      'mirch'],
  [/धनिया/g,                      'dhaniya'],
  [/जीरा/g,                       'jeera'],
  [/इलायची/g,                     'elaichi'],
  [/साबुन/g,                      'sabun'],
  [/शैम्पू/g,                     'shampoo'],
  [/पाउडर/g,                      'powder'],
  [/क्रीम/g,                      'cream'],
  [/टूथपेस्ट/g,                   'toothpaste'],
  [/कोल्ड\s*ड्रिंक/g,             'cold drink'],
  [/कोक|कोका\s*कोला/g,            'coke'],
  [/पेप्सी/g,                     'pepsi'],
  [/चाय/g,                        'chai'],
  [/कॉफ़ी|कॉफी/g,                 'coffee'],
  [/बिस्लेरी/g,                   'bisleri'],
  [/जूस/g,                        'juice'],
  [/सोडा/g,                       'soda'],
  [/आलू/g,                        'aloo'],
  [/प्याज/g,                      'pyaaz'],
  [/टमाटर/g,                      'tamatar'],
  [/अदरक/g,                       'adrak'],
  [/लहसुन/g,                      'lahsun'],
  [/मूंगफली/g,                    'mungfali'],
  [/काजू/g,                       'kaju'],
  [/किशमिश/g,                     'kismish'],
  [/बादाम/g,                      'badam'],
  [/पिस्ता/g,                     'pista'],
  [/सर्फ|सर्फ़/g,                  'surf'],
  [/रिन/g,                        'rin'],
  [/लक्स/g,                       'lux'],
  [/लाइफ़बॉय|लाइफबॉय/g,          'lifebuoy'],
  [/डेटॉल/g,                      'dettol'],
  [/कोलगेट/g,                     'colgate'],
  [/पतंजलि/g,                     'patanjali'],
  [/हल्दीराम/g,                   'haldiram'],
  [/अमूल/g,                       'amul'],
  [/मदर\s*डेयरी/g,                'mother dairy'],
  [/नेस्ले|नेस्कैफे/g,            'nestle'],

  // ── Filler words (common spoken connectors) ─────────────────────
  [/देना|दे\s*दो|दे\s*ना/g,      'dena'],
  [/लाना|लाओ|लाएं/g,              'laao'],
  [/चाहिए/g,                      'chahiye'],
  [/वाला|वाली|वाले/g,             'wala'],
  [/करो|करना|करें/g,              'karo'],
  [/ठीक\s*है|ठीक/g,               'theek'],
  [/और/g,                         'aur'],
  [/मुझे|मुझको/g,                  'mujhe'],
  [/हमें/g,                       'humein'],
  [/का|की|के/g,                   ''],   // genitive particles → strip
  [/यह|यहाँ|वह|वहाँ/g,           ''],   // demonstratives → strip
  [/है|हैं/g,                     ''],   // copula → strip
  [/प्लीज|कृपया/g,               'please'],
];

/**
 * Character-level Devanagari → Roman map for any remaining
 * Devanagari characters NOT covered by the word map above.
 *
 * This is a phonetic approximation good enough for fuzzy search.
 * Based on ISO 15919 / popular Romanisation conventions.
 */
const DEVA_CHAR_MAP: Record<string, string> = {
  // Independent vowels
  'अ': 'a',  'आ': 'aa', 'इ': 'i',  'ई': 'ee', 'उ': 'u',  'ऊ': 'oo',
  'ए': 'e',  'ऐ': 'ai', 'ओ': 'o',  'औ': 'au', 'ऋ': 'ri', 'अं': 'an',
  // Dependent vowels (matras)
  'ा': 'a',  'ि': 'i',  'ी': 'ee', 'ु': 'u',  'ू': 'oo', 'े': 'e',
  'ै': 'ai', 'ो': 'o',  'ौ': 'au', 'ृ': 'ri',
  // Consonants
  'क': 'k',  'ख': 'kh', 'ग': 'g',  'घ': 'gh', 'ङ': 'n',
  'च': 'ch', 'छ': 'chh','ज': 'j',  'झ': 'jh', 'ञ': 'n',
  'ट': 't',  'ठ': 'th', 'ड': 'd',  'ढ': 'dh', 'ण': 'n',
  'त': 't',  'थ': 'th', 'द': 'd',  'ध': 'dh', 'न': 'n',
  'प': 'p',  'फ': 'ph', 'ब': 'b',  'भ': 'bh', 'म': 'm',
  'य': 'y',  'र': 'r',  'ल': 'l',  'व': 'v',  'ळ': 'l',
  'श': 'sh', 'ष': 'sh', 'स': 's',  'ह': 'h',
  // Conjunct / special consonants
  'क्ष': 'ksh','त्र': 'tr','ज्ञ': 'gn',
  // Chandrabindu / anusvara / visarga
  'ं': 'n',  'ँ': 'n',  'ः': 'h',
  // Halant (virama) — suppress inherent vowel
  '्': '',
  // Nukta forms
  'ड़': 'r',  'ढ़': 'rh', 'ज़': 'z',  'फ़': 'f',  'क़': 'q',
  // Punctuation / marks
  '।': ' ',  '॥': ' ',  '़': '',
};

/**
 * devanagariToRoman
 *
 * Converts a string containing Devanagari Unicode text to its
 * Roman (ASCII) phonetic equivalent. Mixed Hindi-English strings
 * (Hinglish) are handled correctly — the English portion passes
 * through unchanged.
 *
 * Strategy:
 *  1. Replace Devanagari digits (०–९) → ASCII digits
 *  2. Apply word-level map (multi-char patterns → common Roman form)
 *  3. Apply char-level map for any remaining Devanagari code points
 *  4. Collapse whitespace
 *
 * @example
 * devanagariToRoman("चार चॉकलेट")   → "char chocolate"
 * devanagariToRoman("किटकैट")        → "kitkat"
 * devanagariToRoman("2 kilo aata")   → "2 kilo aata"  (unchanged)
 * devanagariToRoman("आधा किलो दही")  → "aadha kilo dahi"
 */
export function devanagariToRoman(input: string): string {
  let text = input;

  // Step 1 — Devanagari digits
  text = text.replace(/[०-९]/g, d => DEVA_DIGITS[d] ?? d);

  // Step 2 — Word-level map (longest phrases first)
  for (const [pattern, replacement] of DEVA_WORD_MAP) {
    text = text.replace(pattern, replacement);
  }

  // Step 3 — Char-level map for any remaining Devanagari code points
  // Regex: match any Unicode char in the Devanagari block U+0900–U+097F
  // plus common extended forms U+0900-U+097F
  text = text.replace(/[\u0900-\u097F]/g, ch => DEVA_CHAR_MAP[ch] ?? '');

  // Step 4 — Clean up consecutive spaces produced by stripped chars
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

// ══════════════════════════════════════════════════════════════════
// SECTION 2 — NUMBER WORD MAP (Roman Hinglish + English)
// ══════════════════════════════════════════════════════════════════

/**
 * Maps spoken Hindi/English words → numeric values.
 * Ordered longest-match first to avoid partial collisions.
 * All entries here are in Roman/ASCII — Devanagari was already
 * transliterated before this step.
 */
const NUMBER_WORD_MAP: Array<{ pattern: RegExp; value: number }> = [
  // ── Special Hindi fractions ────────────────────────────────────
  { pattern: /\baadha\b/i,         value: 0.5  },  // आधा  = half
  { pattern: /\baadhe\b/i,         value: 0.5  },  // आधे  = half (oblique)
  { pattern: /\bdedh\b/i,          value: 1.5  },  // डेढ़  = 1.5
  { pattern: /\bdhai\b/i,          value: 2.5  },  // ढाई  = 2.5
  { pattern: /\bpaune\b/i,         value: 0.75 },  // पौने  = 0.75
  { pattern: /\bsawa\b/i,          value: 1.25 },  // सवा   = 1.25
  // NOTE: "saadhe/saade" (साढ़े) is a MODIFIER handled separately — it adds +0.5 to the next number

  // ── Large English numbers ──────────────────────────────────────
  { pattern: /\btwenty[-\s]?five\b/i,  value: 25  },
  { pattern: /\btwenty[-\s]?four\b/i,  value: 24  },
  { pattern: /\btwenty[-\s]?three\b/i, value: 23  },
  { pattern: /\btwenty[-\s]?two\b/i,   value: 22  },
  { pattern: /\btwenty[-\s]?one\b/i,   value: 21  },
  { pattern: /\btwenty\b/i,            value: 20  },
  { pattern: /\bfifteen\b/i,           value: 15  },
  { pattern: /\bfourteen\b/i,          value: 14  },
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
  // (all produced by devanagariToRoman or spoken directly as Hinglish)
  { pattern: /\bbees\b/i,    value: 20 },
  { pattern: /\bunnis\b/i,   value: 19 },
  { pattern: /\batharah\b/i, value: 18 },
  { pattern: /\bsatrah\b/i,  value: 17 },
  { pattern: /\bsolah\b/i,   value: 16 },
  { pattern: /\bpandrah\b/i, value: 15 },
  { pattern: /\bchaudah\b/i, value: 14 },
  { pattern: /\bterah\b/i,   value: 13 },
  { pattern: /\bbaarah\b/i,  value: 12 },
  { pattern: /\bgyarah\b/i,  value: 11 },
  { pattern: /\bdas\b/i,     value: 10 },
  { pattern: /\bnau\b/i,     value: 9  },
  { pattern: /\baath\b/i,    value: 8  },
  { pattern: /\bsaat\b/i,    value: 7  },
  { pattern: /\bchhe\b/i,    value: 6  },
  { pattern: /\bpaanch\b/i,  value: 5  },
  { pattern: /\bpanch\b/i,   value: 5  },
  { pattern: /\bchar\b/i,    value: 4  },
  { pattern: /\bchaar\b/i,   value: 4  }, // alternate spelling
  { pattern: /\bteen\b/i,    value: 3  },
  { pattern: /\btin\b/i,     value: 3  },
  { pattern: /\bdo\b/i,      value: 2  },
  { pattern: /\bek\b/i,      value: 1  },
];

// ══════════════════════════════════════════════════════════════════
// SECTION 3 — UNIT VOCABULARY
// ══════════════════════════════════════════════════════════════════

interface UnitDef { pattern: RegExp; canonical: string; }

const UNIT_DEFINITIONS: UnitDef[] = [
  // Weight
  { pattern: /\bkilos?\b|\bkilogram[s]?\b|\bkg\b/i,     canonical: 'kg'      },
  { pattern: /\bgrams?\b|\bgm[s]?\b|\bgms?\b/i,         canonical: 'gm'      },
  { pattern: /\bquintal[s]?\b/i,                        canonical: 'quintal' },
  // Liquid
  { pattern: /\blitre[s]?\b|\bliter[s]?\b/i,            canonical: 'litre'   },
  { pattern: /\bml\b|\bmillilitre[s]?\b/i,              canonical: 'ml'      },
  // Count
  { pattern: /\bpackets?\b|\bpkts?\b|\bpkt\b/i,         canonical: 'packet'  },
  { pattern: /\bpieces?\b|\bpcs?\b|\bpiec\b/i,          canonical: 'piece'   },
  { pattern: /\bpouches?\b/i,                           canonical: 'pouch'   },
  { pattern: /\bbottles?\b/i,                           canonical: 'bottle'  },
  { pattern: /\bbags?\b/i,                              canonical: 'bag'     },
  { pattern: /\bboxes?\b|\bbox\b/i,                     canonical: 'box'     },
  { pattern: /\bcartons?\b/i,                           canonical: 'carton'  },
  { pattern: /\bbarnis?\b/i,                            canonical: 'barni'   },
  { pattern: /\bdozen[s]?\b/i,                          canonical: 'dozen'   },
  // Hindi units (Roman form after transliteration)
  { pattern: /\bkilo\b/i,                               canonical: 'kg'      },
  { pattern: /\bpao\b|\bpav\b|\bpaav\b/i,              canonical: 'pao'     },
  { pattern: /\bseer\b/i,                               canonical: 'seer'    },
  { pattern: /\btola[s]?\b/i,                           canonical: 'tola'    },
];

// ══════════════════════════════════════════════════════════════════
// SECTION 4 — FILLER WORDS
// ══════════════════════════════════════════════════════════════════

const FILLER_PATTERNS: RegExp[] = [
  /\bdo\s+na\b/i,
  /\bde\s*na\b/i,
  /\bdena\b/i,
  /\bde\s*do\b/i,
  /\blaana\b/i,
  /\blaao\b/i,
  /\blao\b/i,
  /\bchahiye\b/i,
  /\bwala\b|\bwali\b|\bwaala\b|\bwaale\b/i,
  /\bka\b|\bki\b|\bke\b/i,
  /\baur\b/i,
  /\bplease\b/i,
  /\bkaro\b/i,
  /\badd\b/i,
  /\bkar\b/i,
  /\byeh\b|\bwoh\b|\bvoh\b/i,
  /\bmujhe\b/i,
  /\bhumein\b/i,
  /\btheek\b/i,
  /\bhai\b/i,
  /\blaao\b/i,
  /\blaana\b/i,
];

// ══════════════════════════════════════════════════════════════════
// SECTION 5 — MAIN PARSER
// ══════════════════════════════════════════════════════════════════

/**
 * parseVoiceCommand
 *
 * Parses a raw Hinglish / Hindi Unicode / English voice transcript
 * and extracts quantity, unit, and product search term.
 *
 * Handles ALL three transcript styles from hi-IN STT:
 *   • Pure Devanagari:  "चार चॉकलेट किटकैट"
 *   • Hinglish:         "char chocolate kitkat"
 *   • Mixed:            "2 किलो aashirvaad aata"
 *   • Pure English:     "5 packet maggi noodles"
 *
 * @example
 * parseVoiceCommand("चार चॉकलेट")
 * // → { quantity: 4, unit: null, searchTerm: "chocolate", ... }
 *
 * parseVoiceCommand("किटकैट दो")
 * // → { quantity: 2, unit: null, searchTerm: "kitkat", ... }
 *
 * parseVoiceCommand("do kilo aashirvaad aata dena")
 * // → { quantity: 2, unit: "kg", searchTerm: "aashirvaad aata", ... }
 *
 * parseVoiceCommand("aadha kilo dahi")
 * // → { quantity: 0.5, unit: "kg", searchTerm: "dahi", ... }
 */
export function parseVoiceCommand(rawTranscript: string): ParsedCommand {

  // ── Step 0: Transliterate Devanagari → Roman ───────────────────
  // This is the critical new step — converts Unicode Hindi to ASCII
  // so all subsequent regex patterns work uniformly.
  let text = devanagariToRoman(rawTranscript);

  // ── Step 1: Normalise ──────────────────────────────────────────
  text = text
    .toLowerCase()
    .normalize('NFC')
    .replace(/[.,!?;:'"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const normalised = text;

  // ── Step 2: Extract Quantity ───────────────────────────────────
  let quantity = 1;
  let quantityExplicit = false;

  // 2a. Explicit digit (e.g. "2", "2.5")
  const numericMatch = text.match(/\b(\d+(?:[.,]\d+)?)\b/);
  if (numericMatch) {
    const raw = numericMatch[1].replace(',', '.');
    const parsed = parseFloat(raw);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 999) {
      quantity = parsed;
      quantityExplicit = true;
      text = text.replace(numericMatch[0], ' ').trim();
    }
  }

  // 2a-extra. "saadhe/saade" modifier = +0.5 (e.g. "saade 5" = 5.5, "saadhe paanch" = 5.5)
  const saadheMatch = text.match(/\b(saadhe?|साढ़े?)\b/i);
  if (saadheMatch) {
    quantity += 0.5;
    quantityExplicit = true;
    text = text.replace(saadheMatch[0], ' ').trim();
  }

  // 2b. Word numbers (Hindi-Roman or English)
  if (!quantityExplicit) {
    for (const { pattern, value } of NUMBER_WORD_MAP) {
      if (pattern.test(text)) {
        quantity = value;
        quantityExplicit = true;
        text = text.replace(pattern, ' ');
        break;
      }
    }
  }

  // ── Step 3: Extract Unit ───────────────────────────────────────
  let unit: string | null = null;

  for (const { pattern, canonical } of UNIT_DEFINITIONS) {
    if (pattern.test(text)) {
      unit = canonical;
      text = text.replace(pattern, ' ');
      break;
    }
  }

  // ── Step 4: Strip Filler Words ─────────────────────────────────
  for (const filler of FILLER_PATTERNS) {
    text = text.replace(filler, ' ');
  }

  // ── Step 5: Sanitise Search Term ──────────────────────────────
  text = text.replace(/\s+/g, ' ').trim();

  // Remove stray single ASCII letters (leftover from stripping)
  text = text.replace(/(?<![a-z])\b[a-z]\b(?![a-z])/g, ' ').replace(/\s+/g, ' ').trim();

  return {
    quantity,
    unit,
    searchTerm: text,
    normalised,
    quantityExplicit,
  };
}

// ══════════════════════════════════════════════════════════════════
// SECTION 6 — HELPERS
// ══════════════════════════════════════════════════════════════════

/**
 * Returns a human-readable summary of the parsed command.
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

/**
 * Returns a display-friendly unit string.
 * Falls back to the product's own unit field if no voice unit detected.
 */
export function resolveDisplayUnit(voiceUnit: string | null, productUnit: string): string {
  return voiceUnit ?? productUnit ?? '';
}
