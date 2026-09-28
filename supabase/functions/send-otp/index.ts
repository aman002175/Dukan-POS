/**
 * send-otp — Brevo se 6-digit OTP email bhejta hai.
 *
 * POST /functions/v1/send-otp
 * Body: { "email": "dukaandar@example.com", "purpose": "signup" }
 *
 * ── Security (pentest-driven) ──
 *  • Ye endpoint login ke bina call hota hai (signup me user ka session hota
 *    hi nahi) — isliye JWT verify ka koi matlab nahi. Real defence rate limit
 *    hai: per-email 3/15min, 10/day; per-IP 5/hr, 20/day. Iske bina koi bhi
 *    anon key se Brevo ka poora quota drain kar deta — wahi R3.5 ka DoS,
 *    bas provider badal kar. (Isliye deploy karte waqt --no-verify-jwt ki
 *    zarurat NAHI hai par harm bhi nahi; rate limit yahi kaam karta hai.)
 *  • Response hamesha generic — kabhi nahi batate ki email registered hai ya nahi
 *    (email enumeration band).
 *  • Naya code bhejne se is email+purpose ke saare purane codes invalidate.
 *  • Code plain-text me KABHI store nahi hota, sirf HMAC.
 *  • Email fail hone par bhi row delete — warna attacker failed sends se
 *    apna quota burn karke "sab block" kar sakta tha.
 *
 * Required secrets: BREVO_API_KEY, BREVO_SENDER_EMAIL, OTP_SECRET
 */

import {
  adminClient, checkSendLimit, cleanupOtpRows, clientIp, CODE_TTL_MIN, env, fail,
  generateCode, hashCode, json, normalizeEmail, PURPOSES,
} from '../_shared/otp.ts';

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';
const SENDER_NAME = 'Dukaan POS';

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
  const db = adminClient();

  try {
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
      // Row hata do — warna blocked hone wala quota phir bhi consume hoga
      const detail = await brevoRes.text().catch(() => '');
      console.error('❌ Brevo bhejna fail:', brevoRes.status, detail.slice(0, 300));
      await db.from('email_otps').delete().eq('email', email).eq('purpose', purpose).eq('used', false);
      return fail(502, 'Email nahi ja paya. Thodi der baad try karo.');
    }

    // Table bhari na bane
    void cleanupOtpRows(db, now);

    console.log(`✅ OTP bheja — purpose=${purpose} ip=${ip}`);
    return json(200, { success: true, message: 'OTP bhej diya gaya. Inbox (aur spam) check karo.' });
  } catch (err) {
    console.error('❌ send-otp crash:', (err as Error).message);
    return fail(500, 'Kuch gadbad ho gayi. Thodi der baad try karo.');
  }
});
