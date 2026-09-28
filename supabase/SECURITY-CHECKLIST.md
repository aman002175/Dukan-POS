# Security — Dukaan POS

Pentest (28 Sep 2026) ke findings aur unke fixes ka quick reference.

## Status

| # | Finding | Severity | Fix | Status |
|---|---------|----------|-----|--------|
| 1 | RLS off → anonymous READ | CRITICAL | `supabase/policies.sql` + build-time self-heal | ✅ **LIVE (Round 2 verified — 42501)** |
| 2 | RLS off → anonymous UPDATE/DELETE | CRITICAL | same as above | ✅ **LIVE (Round 2 verified)** |
| 3 | `/api/ai` no auth/rate-limit → bill abuse | HIGH | Redis distributed limiter + server-enforced max_tokens + model allowlist + origin | ✅ Code done — **Upstash env set karo** |
| 4 | Customer PII publicly readable | HIGH | #1 fix hote hi apne aap fix | ✅ **LIVE (Round 2 verified)** |
| 5 | Security headers missing (0/5) | MEDIUM | `vercel.json` headers block | ✅ **LIVE (5/5 verified)** |
| 6 | Open signup (email + Google) | MEDIUM | Supabase Auth setting (manual) | 🟡 Low risk (RLS ke baad) — optional |
| 7 | Single-table design | LOW | Design choice — abhi mat badlo | 📋 Backlog |

> **Round 2 re-test (28 Sep):** RLS proven (42501 on INSERT, count: 0 on anon read),
> headers 5/5. Sirf `/api/ai` ka Origin-check spoofable tha — woh distributed
> rate limiting + server-enforced caps se band hai.

---

## 🔴 ABHI KARO

### 1. Backup lo
Supabase → **Database → Backups** → schedule on karo. Single-table design hai
(1 row = poori dukaan), isliye backup critical hai.

### 2. `policies.sql` — abhi ho chuka hai ✅
Round 2 re-test mein confirm: anon read → `count: 0`, anon insert → `42501 RLS violation`.
Agar kabhi doubt ho, verify:
```sql
select tablename, rowsecurity from pg_tables where schemaname = 'public';
```

### 3. PIN hatao cloud se (plaintext tha)
```sql
update public.dukaan_states set data = data #- '{appPin}';
```
(PIN ab local-only hai — `src/lib/cloudSync.ts` push se strip karta hai. Ye sirf purane rows cleanup hai.)

---

## 🟡 RLS "apne aap" off kyun hota tha? (fix shamil hai)

`scripts/db-sync.mjs` har Vercel build pe `drizzle-kit push --force` chalta hai.
Jab drizzle ko schema drift dikhta hai, woh table ko **DROP + CREATE** karta hai —
aur RLS policies table ke saath attached hoti hain, toh woh **chupke se mit jaati hain**.
Drizzle RLS banata hi nahi, toh wapas "ban" bhi nahi hoti.

**Fix:** ab `db-sync.mjs` drizzle push ke **baad** `supabase/policies.sql` dobara
re-apply karta hai → RLS har deploy pe self-heal hoti hai. Vercel deploy logs mein
`🔒 RLS policies re-applied` dikhna chahiye.

---

## 🟡 AI spend protection (remaining HIGH: #3)

Round 2 ne sahi pakda — **Origin header ek declaration hai, verification nahi.**
curl se `-H "Origin: https://..."` jhooth bol ke 200 mil gaya.

Ab `api/ai.ts` pe 4 layers hain:
1. **Distributed rate limit** — Upstash Redis (saare serverless instances share karte hain, 60/hr + 500/day per IP)
2. **Server-enforced `max_tokens` = 4000** (client ki value bilkul ignore)
3. **Model allowlist** — sirf `mercury-2.5`
4. **Origin enforcement** — browser-level abuse rokta hai (CSRF / other-site abuse)

### Upstash env vars set karo (Vercel)
`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` add karo.
Bina inke function **in-memory fallback** pe chalta hai (per-instance, best-effort sirf).

Verify: deploy ke baad 60+ rapid requests bhejo → 429 aana chahiye.

### Inception Labs dashboard (hard cap)
Rate limiting kitni bhi ho, ek **spend limit** rakhna zaroori hai — yehi asli
protection hai jab koi bug ya naya attack vector nikle.

1. **Spend limit / budget alert** set karo (monthly cap)
2. Purani leaked key `sk_1a7e…4d0` **revoke** karo (agar nahi kiya)

---

## 🟡 Manual: Open signup (finding #6) — Round 2 ke baad LOW risk

RLS on hone ke baad naye users ko tumhara data dikhega hi nahi, so wo finding resolved ho jaati hai.
Phir bhi decide karo:

- **Sirf tumhare liye hai** → Supabase → **Authentication → Sign In / Providers** →
  "Allow new users to sign up" **OFF** kar do
- **Public dukaan app hai** → signup ON rakhne se pehle consider karo ki koi bhi
  account bana ke apna dukaan data use kar sakta hai (RLS isolation safe hai, bas storage/quota badhega)

---

## Notes

- **Supabase anon key public hai — by design.** Ye koi leak nahi hai. Protection RLS se hoti hai.
  Round 2 ne confirm kiya: anon key se koi data nahi milta. **Key rotation ki zaroorat NAHI.**
- **Service role key kabhi leak nahi hui** — wo nahi hui toh DB drop tak ka damage nahi ho sakta.
- **PWA + CSP:** `vercel.json` mein `script-src 'unsafe-inline'` hai kyunki Vite PWA
  registration inline script inject karta hai. Ise strict CSP ke liye nonce-based
  approach migrate karna padega (future work). `style-src 'unsafe-inline'` common hai — wo chalta hai.
- **Dead code:** bundle mein direct Inception path (`VITE_INCEPTION_API_KEY`) abhi bhi hai
  lekin khaali hai (koi secret nahi). Future mein hata sakte hain.
- Source maps expose nahi hote (`.js.map` → 404) — code public nahi hota.
