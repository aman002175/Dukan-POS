# Email OTP — Setup Guide (Brevo)

Dukaan POS signup ke liye **6-digit email OTP**. Email Supabase ki built-in
service ki jagah **Brevo** bhejta hai — isliye Supabase ke free email quota pe
depend nahi karna padta (ye R3.5 ka "signup DoS" fix hai).

Flow:
```
Signup form bharo → "OTP Bhejo" → email aaya → 6-digit code daalo
→ verify → account banta hai (normal Supabase signUp)
```

> ⚠️ Ye custom SMTP **nahi** hai. SMTP me domain verify + DNS records lagte
> hain, jo naye projects me hi bahut time lagta hai. Ye route domain ki
> zarurat hi nahi karta.

---

## 1) Table banao (ek baar)

Repo me `supabase/policies.sql` me section **9) EMAIL OTPS** add kar diya
hai. Ye har deploy pe khud chalta hai (RLS self-heal). Bas SQL Editor me
`supabase/policies.sql` ka wo hissa chala do — ya poora file chala do
(sab idempotent hai, `if not exists` use karta hai).

**Verify:**
```sql
SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'email_otps';
-- relrowsecurity = true  ← zaroori hai
```
Is table par **koi policy nahi** hai — RLS ON + no policy = **deny all**.
Edge Function `service_role` se chalti hai (RLS bypass), lekin anon key se
koi is table ko padh/ likh / delete nahi kar sakta.

---

## 2) Function secrets set karo

**Dashboard → Edge Functions → Settings → Secrets → New Secret** (ek-ek karke):

| Name | Value kahan se |
|---|---|
| `OTP_SECRET` | Koi bhi lamba random string. Generate: `openssl rand -hex 32` |
| `BREVO_API_KEY` | Brevo → Settings → SMTP & API → API Keys (`xkeysib-…`) |
| `BREVO_SENDER_EMAIL` | Wo email jo Brevo me **verified** hai |

> 🔐 `OTP_SECRET` hi asli security hai. Iske bina code ka hash offline
> brute-force ho sakta hai. Ye kabhi `.env` me mat daalo, `.env` frontend
> bundle me chala jaata hai — sirf Edge Function secrets me.

`SUPABASE_URL` aur `SUPABASE_SERVICE_ROLE_KEY` apne aap platform se mil jaate
hain — alag se set karne ki zarurat nahi.

---

## 3) Brevo setup

1. Brevo account banao → **Senders & Domains** me apna email verify karo
   (free tier me bhi ye zaroori hai, warna bheja nahi jayega)
2. Domain verify karna **zaroori nahi** — verified email se kaam chal jayega
3. Free tier: **300 emails/day**

---

## 4) Deploy

**Dashboard se (phone pe bhi ho jayega):**
Edge Functions → **New Function** → naam `send-otp` → `send-otp/index.ts` ka
code paste → Deploy. Phir wahi `verify-otp` ke liye.

**CLI se:**
```bash
npx supabase login
npx supabase link --project-ref <TERA_PROJECT_REF>
npx supabase functions deploy send-otp
npx supabase functions deploy verify-otp
```

> ⚠️ `--no-verify-jwt` **mat** lagao. Signup me user ka session hota hi nahi,
> isliye JWT layer ka koi role nahi — asli protection function ke andar
> rate limiting hai. Flag lagaane se koi faayda nahi, bas galat aadat
> banti hai.

> ⚠️ Project ref verify kar lena. Purani doc me galat ref likha tha
> (`ovruotullfmisuzhybke`). Apna sahi ref dashboard ke URL me dikhta hai.

---

## 5) Test

```bash
# bhejo
curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/send-otp" \
  -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"email":"tumhara@email.com","purpose":"signup"}'
# → {"success":true,"message":"OTP bhej diya gaya..."}

# verify
curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/verify-otp" \
  -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"email":"tumhara@email.com","code":"123456","purpose":"signup"}'
# galat code par bhi yahi message aayega (enumeration leak nahi)
```

---

## 6) Supabase email confirmation OFF karo

Authentication → Sign In/Providers → Email → **"Confirm email" OFF**

Ye zaroori hai — warna signup ke baad Supabase apna alag confirmation email
bhejega aur OTP ka matlab khatam. Email OTP pehle verify ho chuka hota hai,
isliye dobara verify karne ki zarurat nahi.

> Security note: confirmation OFF hone par bhi fake account banane ke liye
> **asli mailbox chahiye** (OTP isi liye hai) — wahi protection jo email
> confirmation deta tha, bacha rahega.

---

## Security summary

| Attack | Protection |
|---|---|
| OTP brute force | 5 galat tries → code permanently dead; per-IP 20 verify tries/hr |
| OTP offline crack | HMAC-SHA256 + server secret (plain SHA-256 10^6 combos me toot-ta hai) |
| Email quota DoS | per-email 3/15min + 10/day; per-IP 5/hr + 20/day |
| Email enumeration | Har response **same** message — registered hai ya nahi, pata nahi chalta |
| OTP replay | Verify hone par `used=true`; naya code purano ko invalid kar deta hai |
| Table tampering | RLS ON + **zero policies** = anon key se deny-all |
| Code exposure | Code plain-text me **kabhi store nahi**, **kabhi log nahi** |
| Secret leak | `OTP_SECRET` sirf Edge Function secrets me, bundle me nahi |

---

## Files

| File | Kaam |
|---|---|
| `supabase/functions/_shared/otp.ts` | Hash, rate limit, validation (dono functions ka common) |
| `supabase/functions/send-otp/index.ts` | Brevo se email |
| `supabase/functions/verify-otp/index.ts` | Code validation |
| `src/utils/otpService.ts` | Frontend client |
| `src/pages/LoginPage.tsx` | OTP step UI + signup wiring |
