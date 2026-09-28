/**
 * send-otp — Brevo se 6-digit OTP email bhejta hai.
 *
 * ⚠️ YE FILE INTENTIONALLY SELF-CONTAINED HAI. Koi shared import nahi — isliye
 * Supabase Dashboard ke single-file editor me seedha paste karke deploy ho
 * jaata hai (multi-file support nahi hai wahan). verify-otp me wahi helpers
 * inline hain — dono files ki hash logic EXACTLY same honi chahiye.
 *
 * POST /functions/v1/send-otp
 * Body: { "email": "dukaandar@example.com", "purpose": "signup" }
 *
 * ── Security (pentest-driven) ──
 *  • Ye endpoint login ke bina call hota hai (signup me user ka session hota
 *    hi nahi) — isliye JWT layer ka koi matlab nahi. Asli defence rate limit
 *    hai: per-email 3/15min + 10/day; per-IP 5/hr + 20/day. Iske bina koi bhi
 *    anon key se Brevo ka poora quota drain kar deta — wahi R3.5 ka DoS,
 *    bas provider badal kar.
 *  • Response hamesha generic — kabhi nahi batate ki email registered hai ya nahi
 *    (email enumeration band).
 *  • Naya code bhejne se is email ke purane saare codes invalidate.
 *  • Code plain-text me KABHI store nahi hota, sirf HMAC.
 *  • Email fail ho to row bhi delete — warna failed sends se quota burn hota.
 *
 * Required secrets: OTP_SECRET, BREVO_API_KEY, BREVO_SENDER_EMAIL
 */

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

// ── Config ──
const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';
const SENDER_NAME = 'Dukaan POS';
const CODE_TTL_MIN = 10;
const EMAIL_LIMIT = { per15Min: 3, perDay: 10 };
const IP_SEND_LIMIT = { perHour: 5, perDay: 20 };
const PURPOSES = new Set(['signup']);

function env(name: string): string {
  return Deno.env.get(name) ?? '';
}

/** Service-role client — RLS bypass karta hai (Edge Function ke liye zaruri) */
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
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function fail(status: number, message: string, extra: Record<string, unknown> = {}): Response {
  return json(status, { success: false, error: message, ...extra });
}

// ── Code generation + hashing ──

/** Cryptographically random 6-digit code (crypto.getRandomValues — Math.random NAHI) */
function generateCode(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(buf[0] % 10 ** 6).padStart(6, '0');
}

/**
 * 🔐 HMAC-SHA256(secret, code) — plain SHA-256 NAHI.
 * 6-digit code = 10^6 combinations; plain hash offline seconds me toot jata hai.
 * Server secret ke bina wo offline attack possible hi nahi hota.
 */
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

// ── Rate limiting (table-backed — serverless instances ke beech shared) ──
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

interface LimitVerdict {
  limited: boolean;
  retryAfterSec: number;
}

async function checkSendLimit(
  db: SupabaseClient,
  email: string,
  ip: string,
  now: Date,
): Promise<LimitVerdict> {
  const min15 = new Date(now.getTime() - 15 * 60_000).toISOString();
  const hour1 = new Date(now.getTime() - 60 * 60_000).toISOString();
  const day1 = new Date(now.getTime() - 24 * 60 * 60_000).toISOString();

  if (await countSince(db, 'email', email, min15) >= EMAIL_LIMIT.per15Min) {
    return { limited: true, retryAfterSec: 15 * 60 };
  }
  if (await countSince(db, 'email', email, day1) >= EMAIL_LIMIT.perDay) {
    return { limited: true, retryAfterSec: 24 * 60 * 60 };
  }
  if (await countSince(db, 'request_ip', ip, hour1) >= IP_SEND_LIMIT.perHour) {
    return { limited: true, retryAfterSec: 60 * 60 };
  }
  if (await countSince(db, 'request_ip', ip, day1) >= IP_SEND_LIMIT.perDay) {
    return { limited: true, retryAfterSec: 24 * 60 * 60 };
  }
  return { limited: false, retryAfterSec: 0 };
}

function otpEmailHtml(code: string): string {
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f6f6;font-family:system-ui,-apple-system,Segoe UI,sans-serif">
  <div style="max-width:420px;margin:0 auto;background:#fff;border-radius:16px;padding:28px">
    <h2 style="margin:0 0 6px;font-size:19px;color:#111">Dukaan POS — OTP</h2>
    <p style="margin:0 0 18px;font-size:14px;color:#666">Signup complete karne ke liye ye code daalo:</p>
    <div style="font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;background:#fff4ec;color:#e2611c;padding:18px;border-radius:12px;margin-bottom:18px">${code}</div>
    <p style="margin:0;font-size:12px;color:#999">Ye code 10 minute me expire ho jayega. Kisi ke saath share mat karna.</p>
  </div></body></html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return fail(405, 'Method Not Allowed — sirf POST');

  // Fail closed: secret ke bina plain-hash pe girna security downgrade hota
  const otpSecret = env('OTP_SECRET');
  const brevoKey = env('BREVO_API_KEY');
  const senderEmail = env('BREVO_SENDER_EMAIL');
  if (!otpSecret || !brevoKey || !senderEmail) {
    console.error('❌ Function secrets missing (BREVO_API_KEY / BREVO_SENDER_EMAIL / OTP_SECRET)');
    return fail(500, 'OTP service abhi taiyar nahi hai. Baad me try karo.');
  }

  let body: { email?: unknown; purpose?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail(400, 'Bad Request — invalid JSON');
  }

  const email = normalizeEmail(body.email);
  if (!email) return fail(400, 'Sahi email address daalo');
  const purpose = typeof body.purpose === 'string' && body.purpose ? body.purpose : 'signup';
  if (!PURPOSES.has(purpose)) return fail(400, 'Galat purpose');

  const now = new Date();
  const ip = clientIp(req);

  try {
    const db = adminClient();

    const limit = await checkSendLimit(db, email, ip, now);
    if (limit.limited) {
      const mins = Math.ceil(limit.retryAfterSec / 60);
      return json(429, {
        success: false,
        error: `Bohot zyada requests. ${mins} minute baad try karo.`,
        retryAfterSec: limit.retryAfterSec,
      });
    }

    const code = generateCode();
    const codeHash = await hashCode(code, otpSecret);
    const expiresAt = new Date(now.getTime() + CODE_TTL_MIN * 60_000);

    // Purane codes invalidate — ek time pe sirf latest OTP kaam kare
    await db
      .from('email_otps')
      .update({ used: true })
      .eq('email', email)
      .eq('purpose', purpose)
      .eq('used', false);

    const { error: insErr } = await db.from('email_otps').insert({
      email,
      code_hash: codeHash,
      purpose,
      request_ip: ip,
      expires_at: expiresAt.toISOString(),
    });
    if (insErr) {
      console.error('❌ OTP row insert fail:', insErr.message);
      return fail(500, 'OTP bhej nahi paya. Thodi der baad try karo.');
    }

    // ⚠️ CODE LOG MAT KARO
    const brevoRes = await fetch(BREVO_URL, {
      method: 'POST',
      headers: { 'api-key': brevoKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: SENDER_NAME, email: senderEmail },
        to: [{ email }],
        subject: `${code} — Dukaan POS verification code`,
        html: otpEmailHtml(code),
      }),
    });

    if (!brevoRes.ok) {
      const detail = await brevoRes.text().catch(() => '');
      console.error('❌ Brevo bhejna fail:', brevoRes.status, detail.slice(0, 300));
      await db.from('email_otps').delete().eq('email', email).eq('purpose', purpose).eq('used', false);
      return fail(502, 'Email nahi ja paya. Thodi der baad try karo.');
    }

    // Table bhari na bane (expired rows hata do)
    await db
      .from('email_otps')
      .delete()
      .lt('expires_at', new Date(now.getTime() - 24 * 60 * 60_000).toISOString());

    console.log(`✅ OTP bheja — purpose=${purpose} ip=${ip}`);
    return json(200, { success: true, message: 'OTP bhej diya gaya. Inbox (aur spam) check karo.' });
  } catch (err) {
    console.error('❌ send-otp crash:', (err as Error).message);
    return fail(500, 'Kuch gadbad ho gayi. Thodi der baad try karo.');
  }
});
