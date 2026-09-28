/**
 * verify-otp — user ke 6-digit code ko validate karta hai.
 *
 * POST /functions/v1/verify-otp
 * Body: { "email": "...", "code": "123456", "purpose": "signup" }
 *
 * ── Security ──
 *  • Code compare HMAC hash se, constant-time — brute force se 10^6 tries
 *    chahiye, aur wo bhi 5 attempts ke baad band.
 *  • 5 galat tries → code permanently invalid (attempts >= MAX pe used=true).
 *  • Expiry 10 min. Replay: code verify hone ke baad used=true, dobara chalega hi nahi.
 *  • Verify attempts per-IP 20/hr — distributed brute force bhi bounded.
 *  • Response ALWAYS generic — code galat bhi ho aur email exist na kare, dono
 *    ka message same hai (enumeration leak nahi hota).
 *
 * ⚠️ Ye sirf EMAIL OWNERSHIP prove karta hai. Account banane ka kaam frontend
 *    karta hai jo apne normal Supabase signUp call karta hai — is function me
 *    service-role user-create nahi hai, isliye ye endpoint powerful nahi banna.
 */

import {
  adminClient, checkVerifyLimit, clientIp, CODE_TTL_MIN, env, fail,
  GENERIC_OTP_ERROR, hashCode, json, MAX_ATTEMPTS, normalizeEmail, PURPOSES, timingSafeEqual,
} from '../_shared/otp.ts';

interface OtpRow {
  id: number;
  code_hash: string;
  expires_at: string;
  attempts: number;
  used: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return fail(405, 'Method Not Allowed — sirf POST');

  // Fail closed — secret ke bina hash verify hi nahi ho sakta
  const otpSecret = env('OTP_SECRET');
  if (!otpSecret) {
    console.error('❌ OTP_SECRET missing in function secrets');
    return fail(500, 'OTP service abhi taiyar nahi hai.');
  }

  let body: { email?: unknown; code?: unknown; purpose?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail(400, 'Bad Request — invalid JSON');
  }

  const email = normalizeEmail(body.email);
  if (!email) return fail(400, 'Sahi email address daalo');
  const purpose = typeof body.purpose === 'string' && body.purpose ? body.purpose : 'signup';
  if (!PURPOSES.has(purpose)) return fail(400, 'Galat purpose');

  const rawCode = typeof body.code === 'string' ? body.code.trim() : '';
  if (!/^\d{6}$/.test(rawCode)) return fail(400, GENERIC_OTP_ERROR);

  const now = new Date();
  const ip = clientIp(req);
  const db = adminClient();

  try {
    if (await checkVerifyLimit(db, ip, now)) {
      return json(429, {
        success: false,
        error: 'Bohot zyada attempts. 1 ghante baad try karo.',
        retryAfterSec: 3600,
      });
    }

    // Latest active code for this email+purpose
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
      // Galat code — attempts badhao, user ko mat batao kitne bache
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

    // Is email+purpose ke baaki sab stale codes band kar do
    await db
      .from('email_otps')
      .update({ used: true })
      .eq('email', email)
      .eq('purpose', purpose)
      .eq('used', false);

    console.log(`✅ OTP verify — purpose=${purpose} ip=${ip}`);
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
