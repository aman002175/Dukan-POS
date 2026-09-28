/**
 * _shared/otp.ts
 * ──────────────────────────────────────────────────────────────────
 * send-otp + verify-otp dono ke liye common helpers.
 *
 * 🔐 Design notes (pentest-driven):
 *
 *  1. PLAIN SHA-256 NAHI — code_hash = HMAC-SHA256(OTP_SECRET, code).
 *     6-digit code = 10^6 combinations. Plain SHA-256 of that ko koi bhi
 *     seconds me offline brute-force kar sakta hai aur OTP "cracked" ho jata
 *     hai bina server touch kiye. HMAC ke liye server-side secret chahiye jo
 *     attacker ke paas nahi hai, to offline attack impossible hai.
 *
 *  2. TIMING — code compare constant-time (length leak nahi hona chahiye).
 *
 *  3. RATE LIMIT do tarah se: per-email + per-IP. Email limit ek victim ko
 *     spam karne se rokta hai, IP limit ek attacker ko kai accounts banakar
 *     email quota drain karne se rokta hai.
 *
 *  4. FAIL CLOSED — agar OTP_SECRET set nahi hai to function 500 deta hai.
 *     Secret ke bina plain-hash pe girna security downgrade hota, isliye
 *     chalu nahi karte.
 *
 *  5. CODE KABHI LOG NAHI hota — sirf "sent" log hota hai.
 */

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

// ── Config ──
export const CODE_LENGTH = 6;
export const CODE_TTL_MIN = 10;
export const MAX_ATTEMPTS = 5;

/** Per-email: ek address pe kitni baar bhej sakte hain */
export const EMAIL_LIMIT = { per15Min: 3, perDay: 10 };
/** Per-IP: ek IP se kitni baar bhej sakte hain (multi-account abuse rokne ke liye) */
export const IP_SEND_LIMIT = { perHour: 5, perDay: 20 };
/** Verify attempts per IP (OTP brute force rokne ke liye) */
export const IP_VERIFY_LIMIT = { perHour: 20 };

export const PURPOSES = new Set(['signup']);

export function env(name: string): string {
  return Deno.env.get(name) ?? '';
}

/** Service-role client — RLS bypass karta hai (Edge Function ke liye zaruri) */
export function adminClient(): SupabaseClient {
  const url = env('SUPABASE_URL');
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing in function secrets');
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// ── Response helpers ──
export function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export function fail(status: number, message: string, extra: Record<string, unknown> = {}): Response {
  return json(status, { success: false, error: message, ...extra });
}

// ── Code generation + hashing ──

/** Cryptographically random 6-digit code (crypto.getRandomValues — Math.random NAHI) */
export function generateCode(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(buf[0] % 10 ** CODE_LENGTH).padStart(CODE_LENGTH, '0');
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

export async function hashCode(code: string, secret: string): Promise<string> {
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(code));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time compare — length/content koi signal na de */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ── Validation ──

/** Hamesha generic message — kabhi mat batao ki email registered hai ya nahi */
export const GENERIC_OTP_ERROR = 'Code galat ya expire ho gaya. Dobara mangwao.';

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const email = raw.trim().toLowerCase();
  if (email.length < 3 || email.length > 300) return null;
  // Aapka kaam: valid email shape check (Supabase signup par bhi validate hoga)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return null;
  return email;
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for') ?? '';
  return (fwd.split(',')[0] ?? '').trim() || req.headers.get('x-real-ip') || 'unknown';
}

// ── Rate limiting (table-backed — serverless instances ke beech shared) ──

export interface LimitVerdict {
  limited: boolean;
  retryAfterSec: number;
  reason: 'email' | 'ip';
}

async function countSince(
  db: SupabaseClient,
  column: 'email' | 'request_ip',
  value: string,
  sinceIso: string,
): Promise<number> {
  const { count, error } = await db
    .from('email_otps')
    .select('id', { count: 'exact', head: true })
    .eq(column, value)
    .gte('created_at', sinceIso);
  if (error) throw new Error(`rate limit count failed: ${error.message}`);
  return count ?? 0;
}

/**
 * Send-side limit. Per-email aur per-IP dono — jo pehle cross kare wahi verdict.
 * Window: 15 min (email), 1 hr (IP), plus day-level ceilings.
 */
export async function checkSendLimit(
  db: SupabaseClient,
  email: string,
  ip: string,
  now: Date,
): Promise<LimitVerdict> {
  const min15 = new Date(now.getTime() - 15 * 60_000).toISOString();
  const hour1 = new Date(now.getTime() - 60 * 60_000).toISOString();
  const day1 = new Date(now.getTime() - 24 * 60 * 60_000).toISOString();

  const email15 = await countSince(db, 'email', email, min15);
  if (email15 >= EMAIL_LIMIT.per15Min) {
    return { limited: true, retryAfterSec: 15 * 60, reason: 'email' };
  }
  const emailDay = await countSince(db, 'email', email, day1);
  if (emailDay >= EMAIL_LIMIT.perDay) {
    return { limited: true, retryAfterSec: 24 * 60 * 60, reason: 'email' };
  }
  const ipHour = await countSince(db, 'request_ip', ip, hour1);
  if (ipHour >= IP_SEND_LIMIT.perHour) {
    return { limited: true, retryAfterSec: 60 * 60, reason: 'ip' };
  }
  const ipDay = await countSince(db, 'request_ip', ip, day1);
  if (ipDay >= IP_SEND_LIMIT.perDay) {
    return { limited: true, retryAfterSec: 24 * 60 * 60, reason: 'ip' };
  }
  return { limited: false, retryAfterSec: 0, reason: 'ip' };
}

export async function checkVerifyLimit(db: SupabaseClient, ip: string, now: Date): Promise<boolean> {
  const hour1 = new Date(now.getTime() - 60 * 60_000).toISOString();
  const seen = await countSince(db, 'request_ip', ip, hour1);
  return seen >= IP_VERIFY_LIMIT.perHour;
}

/** Purane/invalid OTP rows ko hatao (table bhari na bane) */
export async function cleanupOtpRows(db: SupabaseClient, now: Date): Promise<void> {
  await db.from('email_otps').delete().lt('expires_at', new Date(now.getTime() - 24 * 60 * 60_000).toISOString());
}
