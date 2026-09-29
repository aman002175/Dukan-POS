/**
 * passwordStrength.ts
 * ──────────────────────────────────────────────────────────────────
 * 🔐 Client-side password strength scoring + input hardening.
 *
 * Ye UI feedback ke liye hai (strength meter). Real enforcement server-side
 * hoti hai: signup pe Supabase Auth (min 8 + digit), verify-otp reset flow me
 * validatePassword(). Client pe same rules mirror karte hain taaki user ko
 * pehle hi pata chale.
 *
 * Security notes:
 * - Score sirf character-class/entropy patterns dekhta hai — password kabhi
 *   store, log ya network pe nahi jata (pure function, no side effects).
 * - Common-password list chhoti hai (top offenders) — full HaveIBeenPwned
 *   check Supabase server-side karta hai (leaked-password protection ON).
 * - Email/OTP security: OTP row (email, purpose) par bind hoti hai — email
 *   ek hi baar daalte hain aur har jagah sanitizeEmail() se normalize karte
 *   hain, taaki "A@x.com" vs " a@X.com  " alag-alag OTP request na trigger
 *   kare aur server pe bhi wahi normalized form verify ho.
 */

// Top common passwords — inka use turant score gira deta hai
// (server HaveIBeenPwned se bhi check karta hai; ye sirf instant UX feedback)
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password12', 'password123', 'password1234',
  '123456', '1234567', '12345678', '123456789', '1234567890',
  'qwerty', 'qwerty123', 'qwertyuiop', 'asdfgh', 'zxcvbnm',
  'abc123', 'abc12345', 'iloveyou', 'admin123', 'welcome1',
  'letmein1', 'monkey123', 'dragon123', 'sunshine1', 'princess1',
  'dukaan', 'dukaan123', 'kirana123', 'shop1234',
]);

export interface PasswordStrength {
  /** 0–4 (0 = bahut kamzor, 4 = bahut strong) */
  score: number;
  /** 0–100 — UI bar ke liye */
  percent: number;
  label: string;
  /** Tailwind classes — bar color + text color */
  barColor: string;
  textColor: string;
  /** Kya improve karna hai (Hinglish, user-facing) */
  feedback: string[];
  /** Server policy match: 8+ chars + 1 digit */
  meetsPolicy: boolean;
}

/** Consecutive codepoint sequences (abc, 123, 456) check */
function hasSequence(pw: string, minRun = 3): boolean {
  const lower = pw.toLowerCase();
  let run = 1;
  for (let i = 1; i < lower.length; i++) {
    const prev = lower.charCodeAt(i - 1);
    const curr = lower.charCodeAt(i);
    if (curr === prev + 1) {
      run++;
      if (run >= minRun) return true;
    } else {
      run = 1;
    }
  }
  return false;
}

/** Same char repeat (aaa, 111) check */
function hasRepeatedRun(pw: string, minRun = 3): boolean {
  let run = 1;
  for (let i = 1; i < pw.length; i++) {
    if (pw[i] === pw[i - 1]) {
      run++;
      if (run >= minRun) return true;
    } else {
      run = 1;
    }
  }
  return false;
}

/**
 * Password strength score karo (0–4 scale + 0–100 percent).
 * Pure function — koi side effect nahi, password kahin log/store nahi hota.
 */
export function scorePassword(pw: string): PasswordStrength {
  const feedback: string[] = [];
  if (!pw) {
    return {
      score: 0, percent: 0, label: 'Password daalo',
      barColor: 'bg-gray-200', textColor: 'text-gray-400',
      feedback: [], meetsPolicy: false,
    };
  }

  const length = pw.length;
  const hasLower = /[a-z]/.test(pw);
  const hasUpper = /[A-Z]/.test(pw);
  const hasDigit = /\d/.test(pw);
  const hasSymbol = /[^A-Za-z0-9]/.test(pw);
  const uniqueChars = new Set(pw).size;
  const classes = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;

  let score = 0;

  // Length contribution (12+ tak badhta hai)
  if (length >= 8) score++;
  if (length >= 12) score++;

  // Variety contribution
  if (classes >= 2) score++;
  if (classes >= 3) score++;
  if (classes === 4) score = Math.min(5, score + 1);

  // ── Penalties ──
  const lowerPw = pw.toLowerCase();
  if (COMMON_PASSWORDS.has(lowerPw)) {
    score = 0;
    feedback.push('Ye bahut common password hai — bilkul use mat karo');
  }
  if (hasRepeatedRun(pw)) {
    score = Math.max(0, score - 1);
    feedback.push('Same character baar-baar (aaa/111) avoid karo');
  }
  if (hasSequence(pw)) {
    score = Math.max(0, score - 1);
    feedback.push('Sequence (abc/123) avoid karo');
  }
  if (uniqueChars <= Math.max(3, Math.floor(length / 2))) {
    score = Math.max(0, score - 1);
    feedback.push('Zyada alag-alag characters use karo');
  }

  // Final clamp 0–4
  score = Math.max(0, Math.min(4, score));

  // Server policy mirror: 8+ chars + 1 digit
  const meetsPolicy = length >= 8 && hasDigit;
  if (length < 8) feedback.unshift('Kam se kam 8 characters chahiye');
  if (!hasDigit && length > 0) feedback.unshift('Kam se kam 1 number daalo');

  const percent = Math.round((score / 4) * 100);

  if (score === 0) {
    return { score, percent, label: 'Bahut Kamzor', barColor: 'bg-red-600', textColor: 'text-red-600', feedback, meetsPolicy };
  }
  if (score === 1) {
    return { score, percent, label: 'Kamzor', barColor: 'bg-red-500', textColor: 'text-red-500', feedback, meetsPolicy };
  }
  if (score === 2) {
    return { score, percent, label: 'Theek-Thaak', barColor: 'bg-amber-500', textColor: 'text-amber-600', feedback, meetsPolicy };
  }
  if (score === 3) {
    return { score, percent, label: 'Strong', barColor: 'bg-lime-500', textColor: 'text-lime-600', feedback, meetsPolicy };
  }
  return { score, percent, label: 'Bahut Strong 🛡️', barColor: 'bg-green-600', textColor: 'text-green-700', feedback, meetsPolicy };
}

/**
 * 📧 Email sanitize + normalize.
 * Har auth flow me EK hi function use hota hai — server (Edge Functions) bhi
 * wahi normalization karta hai (trim + lowercase), isliye client/server match:
 * - whitespace/control chars hatao
 * - lowercase (Supabase emails case-insensitive hote hain)
 * - HTML-special chars ya control chars hue to reject (tampering attempt)
 * - max length 254 (RFC 5321)
 *
 * Returns null agar email structurally invalid/unsafe hai.
 */
export function sanitizeEmail(raw: string): string | null {
  if (typeof raw !== 'string') return null;
  // Control chars (0x00-0x1F, 0x7F) — header injection / smuggling attempts
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F\u007F]/.test(raw)) return null;
  const email = raw.trim().toLowerCase();
  if (email.length < 3 || email.length > 254) return null;
  // Structural check — server jaisa hi
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return null;
  return email;
}

/**
 * 🧼 Text input hardening — OTP fields, names, etc.
 * Sirf digits rakho (OTP), ya safe text (names): control chars + HTML specials
 * strip/reject. Client-side filter UX hai; server validation asli guard hai.
 */
export function onlyDigits(raw: string, maxLen = 6): string {
  return raw.replace(/\D/g, '').slice(0, maxLen);
}

/** Control chars ya HTML-special chars present hain? (reject-worthy input) */
export function hasUnsafeChars(raw: string): boolean {
  if (typeof raw !== 'string') return true;
  // eslint-disable-next-line no-control-regex
  return /[\u0000-\u001F\u007F<>]/.test(raw);
}

/**
 * 📱 Mobile number normalize (India-first): digits nikalo, +91/0 prefix hatao,
 * 10-digit validate karo. Returns null agar valid Indian mobile nahi hai.
 * Server (Edge Functions) bhi wahi normalization karta hai — dono match.
 */
export function normalizePhone(raw: string): string | null {
  if (typeof raw !== 'string') return null;
  const digits = raw.replace(/\D/g, '');
  // +91/0 prefix strip → sirf 10-digit national number rakho
  const local = digits.length === 12 && digits.startsWith('91') ? digits.slice(2)
    : digits.length === 11 && digits.startsWith('0') ? digits.slice(1)
    : digits;
  if (local.length !== 10) return null;
  // Indian mobile: 6-9 se start hota hai (landline/invalid prefixes reject)
  if (!/^[6-9]\d{9}$/.test(local)) return null;
  return local;
}

/**
 * 📧 Email mask — privacy-safe display: pehle 2-3 chars + *** + domain.
 * 'dukandar@gmail.com' → 'duk***@gmail.com'
 * Chhote local parts (≤3) me pehla char + ***. Domain poora dikhta hai.
 */
export function maskEmail(email: string): string {
  if (typeof email !== 'string' || !email.includes('@')) return '•••@•••';
  const [local, domain] = email.split('@');
  const visible = local.length <= 3 ? local.slice(0, 1) : local.slice(0, 3);
  const stars = '*'.repeat(Math.max(3, Math.min(6, local.length - visible.length)));
  return `${visible}${stars}@${domain}`;
}
