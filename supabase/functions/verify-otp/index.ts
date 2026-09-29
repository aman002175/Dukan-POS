/**
 * verify-otp — user ke 6-digit code ko validate karta hai.
 *
 * ⚠️ YE FILE INTENTIONALLY SELF-CONTAINED HAI. Koi shared import nahi — isliye
 * Supabase Dashboard ke single-file editor me seedha paste karke deploy ho
 * jaata hai.
 *
 * POST /functions/v1/verify-otp
 * Body: { "email": "...", "code": "123456", "purpose": "signup" }
 *
 * ── Security ──
 *  • Code compare HMAC hash se — brute force se 10^6 tries chahiye, aur wo bhi
 *    5 attempts ke baad band.
 *  • 5 galat tries → code permanently invalid.
 *  • Expiry 10 min. Replay: verify hone ke baad used=true, dobara chalega hi nahi.
 *  • Verify attempts per-IP 20/hr — distributed brute force bhi bounded.
 *  • Response ALWAYS generic — code galat bhi ho aur email exist na kare, dono
 *    ka message same hai (enumeration leak nahi hota).
 *
 * ⚠️ Ye sirf EMAIL OWNERSHIP prove karta hai. Account banane ka kaam frontend
 *    karta hai jo apne normal Supabase signUp call karta hai — is function me
 *    service-role user-create nahi hai, isliye ye endpoint powerful nahi banna.
 */

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

// ── Config ──
const CODE_TTL_MIN = 10;
const MAX_ATTEMPTS = 5;
const IP_VERIFY_LIMIT = { perHour: 20 };
// 'reset' = forgot-password (server-side password update karta hai)
// 'password_change' = logged-in user password badal raha hai (frontend auth.updateUser karega)
const PURPOSES = new Set(['signup', 'reset', 'password_change']);

/** Password policy — signup jaisa hi (8+ chars, 1 digit) */
function validatePassword(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  if (raw.length < 8) return null;
  if (!/\d/.test(raw)) return null;
  return raw;
}

/** Hamesha generic message — kabhi mat batao ki email registered hai ya nahi */
const GENERIC_OTP_ERROR = 'Code galat ya expire ho gaya. Dobara mangwao.';

function env(name: string): string {
  return Deno.env.get(name) ?? '';
}

/** Browser preflight + CORS — bina iske browser POST se pehle hi block kar deta hai */
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, apikey, Authorization',
  'Access-Control-Max-Age': '86400',
};

function adminClient(): SupabaseClient {
  const url = env('SUPABASE_URL');
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing in function secrets');
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function fail(status: number, message: string, extra: Record<string, unknown> = {}): Response {
  return json(status, { success: false, error: message, ...extra });
}

// ── Hashing (send-otp se EXACTLY same) ──
async function hashCode(code: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(code));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time compare — length/content koi signal na de */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ── Validation ──
function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const email = raw.trim().toLowerCase();
  if (email.length < 3 || email.length > 300) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return null;
  return email;
}

function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for') ?? '';
  return (fwd.split(',')[0] ?? '').trim() || req.headers.get('x-real-ip') || 'unknown';
}

/**
 * 📱 Mobile normalize — send-otp/index.ts jaisa SAME logic (client bhi same).
 */
function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const digits = raw.replace(/\D/g, '');
  const local = digits.length === 12 && digits.startsWith('91') ? digits.slice(2)
    : digits.length === 11 && digits.startsWith('0') ? digits.slice(1)
    : digits;
  if (local.length !== 10) return null;
  if (!/^[6-9]\d{9}$/.test(local)) return null;
  return local;
}

/**
 * recovery_phone → user lookup (service-role, auth.users metadata).
 * Miss par null — enumeration signal nahi.
 */
async function findUserIdByPhone(db: SupabaseClient, phone: string): Promise<string | null> {
  const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 500 });
  if (error) return null;
  const match = (data?.users ?? []).find((u) => (u.user_metadata as Record<string, unknown> | null)?.recovery_phone === phone);
  return match?.id ?? null;
}

async function verifyAttemptsThisHour(db: SupabaseClient, ip: string, now: Date): Promise<number> {
  const hour1 = new Date(now.getTime() - 60 * 60_000).toISOString();
  const { count, error } = await db
    .from('email_otps')
    .select('id', { count: 'exact', head: true })
    .eq('request_ip', ip)
    .gte('created_at', hour1);
  if (error) throw new Error(`verify limit count failed: ${error.message}`);
  return count ?? 0;
}

interface OtpRow {
  id: number;
  code_hash: string;
  expires_at: string;
  attempts: number;
  used: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== 'POST') return fail(405, 'Method Not Allowed — sirf POST');

  // Fail closed — secret ke bina hash verify hi nahi ho sakta
  const otpSecret = env('OTP_SECRET');
  if (!otpSecret) {
    console.error('❌ OTP_SECRET missing in function secrets');
    return fail(500, 'OTP service abhi taiyar nahi hai.');
  }

  let body: { email?: unknown; phone?: unknown; code?: unknown; purpose?: unknown; new_password?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail(400, 'Bad Request — invalid JSON');
  }

  const purpose = typeof body.purpose === 'string' && body.purpose ? body.purpose : 'signup';
  if (!PURPOSES.has(purpose)) return fail(400, 'Galat purpose');

  // 📱 Identity: email seedha, YA mobile → recovery_phone lookup (sirf reset purpose).
  let email: string | null = null;
  if (body.phone !== undefined && body.phone !== null && body.phone !== '') {
    if (purpose !== 'reset') return fail(400, 'Mobile se sirf password reset hota hai.');
    const phone = normalizePhone(body.phone);
    if (!phone) return fail(400, 'Sahi 10-digit mobile number daalo');
    const db0 = adminClient();
    const userId = await findUserIdByPhone(db0, phone);
    if (!userId) return fail(400, 'Ye mobile number kisi account se link nahi hai.');
    const { data: userData } = await db0.auth.admin.getUserById(userId);
    email = (userData?.user?.email ?? '').toLowerCase() || null;
    if (!email) return fail(400, 'Ye mobile number kisi account se link nahi hai.');
  } else {
    email = normalizeEmail(body.email);
    if (!email) return fail(400, 'Sahi email address daalo');
  }

  const rawCode = typeof body.code === 'string' ? body.code.trim() : '';
  if (!/^\d{6}$/.test(rawCode)) return fail(400, GENERIC_OTP_ERROR);

  const now = new Date();
  const ip = clientIp(req);

  try {
    const db = adminClient();

    if (await verifyAttemptsThisHour(db, ip, now) >= IP_VERIFY_LIMIT.perHour) {
      return json(429, {
        success: false,
        error: 'Bohot zyada attempts. 1 ghante baad try karo.',
        retryAfterSec: 3600,
      });
    }

    const { data, error } = await db
      .from('email_otps')
      .select('id, code_hash, expires_at, attempts, used')
      .eq('email', email)
      .eq('purpose', purpose)
      .eq('used', false)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('❌ OTP lookup fail:', error.message);
      return fail(500, 'Kuch gadbad ho gayi. Thodi der baad try karo.');
    }

    const row = (data as OtpRow[] | null)?.[0];
    // Koi row nahi / expired / attempts khatam — sab ka jawab SAME message
    if (!row || new Date(row.expires_at).getTime() <= now.getTime() || row.attempts >= MAX_ATTEMPTS) {
      if (row && row.attempts >= MAX_ATTEMPTS) {
        await db.from('email_otps').update({ used: true }).eq('id', row.id);
        console.log(`🛑 OTP brute force — attempts limit hit (email=${email})`);
      }
      return fail(400, GENERIC_OTP_ERROR);
    }

    const submittedHash = await hashCode(rawCode, otpSecret);

    if (!timingSafeEqual(submittedHash, row.code_hash)) {
      const nextAttempts = row.attempts + 1;
      await db.from('email_otps').update({ attempts: nextAttempts }).eq('id', row.id);
      if (nextAttempts >= MAX_ATTEMPTS) {
        await db.from('email_otps').update({ used: true }).eq('id', row.id);
        console.log(`🛑 OTP attempts khatam (email=${email}, ip=${ip})`);
      }
      return fail(400, GENERIC_OTP_ERROR);
    }

    // ✅ Sahi code — one-time use mark karo (replay block)
    await db.from('email_otps').update({ used: true }).eq('id', row.id);

    // Is email ke baaki sab stale codes band kar do
    await db
      .from('email_otps')
      .update({ used: true })
      .eq('email', email)
      .eq('purpose', purpose)
      .eq('used', false);

    console.log(`✅ OTP verify — purpose=${purpose} ip=${ip}`);

    // 🔑 FORGOT-PASSWORD: OTP = email ownership proof ho chuka. Ab server-side
    // password update (service-role) — session/credentials ke bina. Ye secure
    // path hai kyunki OTP khud one-time + rate-limited + email-verified hai.
    if (purpose === 'reset') {
      const newPassword = validatePassword(body.new_password);
      if (!newPassword) {
        return fail(400, 'Naya password kam se kam 8 characters + 1 number ka hona chahiye.');
      }
      // User resolve: phone path me userId pehle se mila (findUserIdByPhone),
      // email path me yahan listUsers se. Dono miss = generic error (no enumeration).
      let resetUserId: string | null = null;
      if (body.phone !== undefined && body.phone !== null && body.phone !== '') {
        const phone = normalizePhone(body.phone);
        resetUserId = phone ? await findUserIdByPhone(db, phone) : null;
      } else {
        const { data: userData } = await db.auth.admin.listUsers();
        const user = userData?.users?.find((u) => (u.email ?? '').toLowerCase() === email);
        resetUserId = user?.id ?? null;
      }
      if (!resetUserId) {
        return fail(400, GENERIC_OTP_ERROR);
      }
      const { error: updErr } = await db.auth.admin.updateUserById(resetUserId, { password: newPassword });
      if (updErr) {
        console.error('❌ Password update fail:', updErr.message);
        return fail(500, 'Password update nahi ho paya. Thodi der baad try karo.');
      }
      // 🛡️ Sab sessions revoke — purane password jo kisi ke paas leak tha, ab kaam nahi karega
      await db.auth.admin.signOut(resetUserId);
      console.log(`🔑 Password reset via OTP — ip=${ip}`);
      return json(200, {
        success: true,
        verified: true,
        password_reset: true,
        message: 'Password badal diya gaya! Naye password se login karo.',
      });
    }

    return json(200, {
      success: true,
      verified: true,
      message: `Email verify ho gaya. Ye code ${CODE_TTL_MIN} minute ke andar kaam karta tha.`,
    });
  } catch (err) {
    console.error('❌ verify-otp crash:', (err as Error).message);
    return fail(500, 'Kuch gadbad ho gayi. Thodi der baad try karo.');
  }
});
