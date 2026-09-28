/**
 * otpService.ts
 * ──────────────────────────────────────────────────────────────────
 * Signup email-verification ke liye Brevo-backed OTP Edge Functions ka client.
 *
 * Flow: sendOtp(email) → user code daalta hai → verifyOtp(email, code) → phir app
 * normal Supabase signUp karta hai. (Account creation yaad rakhna: ye service
 * sirf email ownership prove karti hai, account nahi banati.)
 *
 * 🔐 Security note: yahan anon key use hoti hai — wo public-by-design hai aur
 * asli protection Edge Function ke andar hai (HMAC hash, 5-attempt limit, 10 min
 * expiry, per-email + per-IP rate limit). Client se kuch bhi bypass nahi hota.
 */

export type OtpPurpose = 'signup';

export interface OtpResult {
  ok: boolean;
  message: string;
  /** Rate-limit hit par kitni der baad retry karein */
  retryAfterSec?: number;
}

/** Edge Functions ke liye sirf URL + anon key chahiye (supabase client nahi) */
function config(): { url: string; anonKey: string } | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  return url && anonKey ? { url, anonKey } : null;
}

function endpointsAvailable(): boolean {
  return config() !== null;
}

async function callFunction(
  name: 'send-otp' | 'verify-otp',
  payload: Record<string, unknown>,
): Promise<OtpResult> {
  const cfg = config();
  if (!cfg) {
    return { ok: false, message: 'OTP service abhi setup nahi hai. Normal signup try karo.' };
  }

  try {
    const res = await fetch(`${cfg.url.replace(/\/$/, '')}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: cfg.anonKey,
        Authorization: `Bearer ${cfg.anonKey}`,
      },
      body: JSON.stringify(payload),
    });

    const data = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      message?: string;
      error?: string;
      retryAfterSec?: number;
    };

    if (res.ok && data.success) {
      return { ok: true, message: data.message || 'OTP bhej diya gaya.' };
    }

    // 429 rate limit — user ko clearly batao kitni der baad
    if (res.status === 429) {
      const mins = data.retryAfterSec ? Math.max(1, Math.ceil(data.retryAfterSec / 60)) : 15;
      return {
        ok: false,
        message: `Bohot zyada requests. ${mins} minute baad try karo.`,
        retryAfterSec: data.retryAfterSec,
      };
    }
    if (res.status === 500 || res.status === 502) {
      return { ok: false, message: 'Email service abhi taiyar nahi hai. Thodi der baad try karo.' };
    }

    return { ok: false, message: data.error || data.message || 'OTP nahi ja paya. Dobara try karo.' };
  } catch {
    return { ok: false, message: 'Network error — internet check karke dobara try karo.' };
  }
}

/** Email pe OTP bhejo. Rate limit server-side enforce hota hai. */
export function sendOtp(email: string, purpose: OtpPurpose = 'signup'): Promise<OtpResult> {
  return callFunction('send-otp', { email, purpose });
}

/** Code verify karo. Galat code aur unknown email — dono ka message same aata hai. */
export function verifyOtp(email: string, code: string, purpose: OtpPurpose = 'signup'): Promise<OtpResult> {
  return callFunction('verify-otp', { email, code, purpose });
}

/** OTP flow available hai? (setup nahi hua to app normal signup pe hi rahe) */
export function isOtpEnabled(): boolean {
  return endpointsAvailable();
}
