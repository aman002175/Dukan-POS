# Edge Functions Deployment — Chakki Mitra OTP System

## Ye kya hai?
Supabase Edge Function jo Brevo API se OTP email bhejti hai. SMTP ki zaroorat nahi.

## Pehle ye karo (Sirf ek baar):

### 1. Supabase Dashboard me Edge Function Secret set karo:
```
Dashboard → Edge Functions → Settings → Secrets → New Secret:
  Name:  BREVO_API_KEY
  Value: (tumhari Brevo API key - Brevo → Settings → SMTP & API → API Keys)
```

### 2. OTP verifications table banao (SQL Editor me):
```sql
CREATE TABLE IF NOT EXISTS email_otps (
  id SERIAL PRIMARY KEY,
  email VARCHAR(300) NOT NULL,
  code_hash VARCHAR(128) NOT NULL,
  purpose VARCHAR(20) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  attempts INTEGER DEFAULT 0,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_email_otps_email ON email_otps(email);
CREATE INDEX idx_email_otps_purpose ON email_otps(purpose);
CREATE INDEX idx_email_otps_expires ON email_otps(expires_at);
```

### 3. Supabase SMTP OFF karo:
```
Dashboard → Configuration → Auth → SMTP Settings → Enable custom SMTP → OFF
```

## Deploy kaise kare:

### Option A: Supabase Dashboard se (Phone se ho jayega):

1. Dashboard → Edge Functions → New Function
2. Function name: `send-otp`
3. `supabase/functions/send-otp/index.ts` ka poora code paste karo
4. Deploy

### Option B: CLI se (Computer pe):

```bash
# Supabase login
npx supabase login

# Project link karo
npx supabase link --project-ref ovruotullfmisuzhybke

# Function deploy karo
npx supabase functions deploy send-otp --no-verify-jwt
```

## Test karo:
```bash
curl -X POST "https://ovruotullfmisuzhybke.supabase.co/functions/v1/send-otp" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@gmail.com","purpose":"signup"}'
```

Expected response: `{"success":true,"message":"OTP sent successfully"}`
