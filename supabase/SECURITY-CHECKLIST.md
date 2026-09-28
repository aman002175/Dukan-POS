# Security — Dukaan POS

Pentest (28 Sep 2026) ke findings aur unke fixes ka quick reference.

## Status

| # | Finding | Severity | Fix | Status |
|---|---------|----------|-----|--------|
| 1 | RLS off → anonymous READ | CRITICAL | `supabase/policies.sql` + build-time self-heal | ✅ Code done — **SQL Editor mein run karo** |
| 2 | RLS off → anonymous UPDATE/DELETE | CRITICAL | same as above | ✅ Code done — **SQL Editor mein run karo** |
| 3 | `/api/ai` no auth/rate-limit → bill abuse | HIGH | `api/ai.ts` rate limit + model allowlist + param clamps + origin enforcement | ✅ Code done |
| 4 | Customer PII publicly readable | HIGH | #1 fix hote hi apne aap fix | ⏳ #1 ke baad |
| 5 | Security headers missing (0/5) | MEDIUM | `vercel.json` headers block | ✅ Code done |
| 6 | Open signup (email + Google) | MEDIUM | Supabase Auth setting (manual) | ⏳ Manual |
| 7 | Single-table design | LOW | Design choice — abhi mat badlo | 📋 Backlog |

---

## 🔴 ABHI KARO (live DB abhi bhi exposed hai)

### 1. Backup lo (pehle!)
Supabase → **Database → Backups**. RLS on karne ke baad anon reads band ho jayengi —
agar kuch gadbad ho toh backup ke bina recover nahi kar paoge.

### 2. `policies.sql` run karo
Supabase → **SQL Editor → New query** → `supabase/policies.sql` ka pura content paste → **Run**.

Ye karta hai:
- `profiles` + `dukaan_states` pe RLS enable
- 7 policies — har user **sirf apni row** dekh/sach/bana/sakta hai
- Google signup pe profile auto-create trigger
- `updated_at` auto-update trigger

### 3. Verify karo
```sql
select tablename, rowsecurity from pg_tables where schemaname = 'public';
```
`profiles` aur `dukaan_states` dono ka `rowsecurity` = **true** hona chahiye.

Phir browser mein bina login kholo → AI/data kuch nahi dikhna chahiye.

### 4. PIN hatao cloud se (plaintext tha)
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

## 🟡 Manual: AI spend protection (hard cap)

`api/ai.ts` ka rate limit **best-effort** hai (in-memory, per serverless instance) —
bohot hard protection nahi. Real hard cap ke liye:

**Inception Labs dashboard:**
1. **Spend limit / budget alert** set karo (monthly cap)
2. Key rotate karte rehne ka plan (leak ho jaye toh damage limited)

**Optional (jab traffic badhe):** distributed rate limiting ke liye Upstash Redis
(`@upstash/ratelimit`) — tab tak per-IP in-memory kaafi hai.

---

## 🟡 Manual: Open signup (finding #6)

RLS on hone ke baad naye users ko tumhara data dikhega hi nahi, so wo finding resolved ho jaati hai.
Phir bhi decide karo:

- **Sirf tumhare liye hai** → Supabase → **Authentication → Sign In / Providers** →
  "Allow new users to sign up" **OFF** kar do
- **Public dukaan app hai** → signup ON rakhne se pehle consider karo ki koi bhi
  account bana ke apna dukaan data use kar sakta hai (RLS isolation safe hai, bas storage/quota badhega)

---

## Notes

- **Supabase anon key public hai — by design.** Ye koi leak nahi hai. Protection RLS se hoti hai.
- **PWA + CSP:** `vercel.json` mein `script-src 'unsafe-inline'` hai kyunki Vite PWA
  registration inline script inject karta hai. Ise strict CSP ke liye nonce-based
  approach migrate karna padega (future work).
- Source maps expose nahi hote (`.js.map` → 404) — code public nahi hota.
