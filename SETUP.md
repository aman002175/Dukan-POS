# 🚀 Dukaan POS — Supabase Backend Setup Guide

Ye guide follow karke aap backend activate kar sakte ho. **Setup ke bina app perfect chalega** (guest mode, localStorage) — backend ke baad cloud sync + account features ON ho jayenge.

---

## Step 1: Supabase Project Banao

1. https://supabase.com pe jao → **New Project**
2. Naam do: `dukaan-pos` (ya jo chaaho)
3. **Database Password** set karo — **ise sambhal ke rakhna**, aage chahiye hoga
4. Region: `Mumbai (ap-south-1)` choose karo (India ke liye fastest)

---

## Step 2: Keys Copy Karo

Supabase Dashboard → **Project Settings → API**:

| Key | Kahan milega |
|---|---|
| `VITE_SUPABASE_URL` | "Project URL" (e.g. `https://abcd1234.supabase.co`) |
| `VITE_SUPABASE_ANON key` | "anon public" key |
| `DATABASE_URL` | Settings → Database → Connection string → URI |

---

## Step 3: `.env.local` Banao

Project root mein `.env.local` banao (Setup guide ke mutabik):

```bash
VITE_SUPABASE_URL=https://abcd1234.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJI...
DATABASE_URL=postgresql://postgres:YOUR-PASSWORD@db.abcd1234.supabase.co:5432/postgres
```

---

## Step 4: Tables Banao

**Option A (Recommended):** Supabase Dashboard → **SQL Editor** → `supabase/policies.sql` ka content paste karke **Run** karo.
Ye tables + RLS security policies + triggers sab install kar deta hai.

**Option B (Drizzle):**
```bash
bun run db:push
```
Ye `src/lib/db/schema.ts` se tables bana dega:
- `profiles` — user profiles (auth.users mirror)
- `dukaan_states` — har user ka pura app state ek jsonb document mein

Dono options same result dete hain — SQL editor wala RLS policies bhi lagata hai, isliye recommended hai. Drizzle push ke baad bhi SQL editor wala script run karo (policies + triggers ke liye).

---

## Step 5: Google OAuth Setup

### 5a. Google Cloud Console pe OAuth Client banao

1. https://console.cloud.google.com pe jao
2. **APIs & Services → OAuth consent screen** — External, app name + support email daalo
3. **APIs & Services → Credentials → Create Credentials → OAuth Client ID**
4. Application type: **Web application**
5. **Authorized JavaScript origins:**
   ```
   http://localhost:5173
   http://localhost:3000
   https://dukan-pos-chi.vercel.app
   ```
6. **Authorized redirect URIs** (dono add karo):
   ```
   https://abcd1234.supabase.co/auth/v1/callback
   https://your-app.vercel.app/auth/callback
   ```
7. **Client ID** aur **Client Secret** copy karo

### 5b. Supabase mein Google Provider ON karo

Supabase Dashboard → **Authentication → Providers → Google**:
- Enable karo
- Client ID + Client Secret paste karo (5a se)
- Save

> ⚠️ **Dhyan:** Supabase URL Configuration (5c) ka **Site URL** prod domain hona chahiye — localhost raha to login ke baad user localhost pe land karega, website pe nahi.

### 5c. Supabase URL Configuration

Supabase Dashboard → **Authentication → URL Configuration**:
- **Site URL:** `https://dukan-pos-chi.vercel.app` (exact — no trailing slash; ye galat localhost rahega to OAuth localhost pe land karega)
- **Redirect URLs** mein add karo:
  - `https://dukan-pos-chi.vercel.app/**`
  - `http://localhost:5173/**`
  - `http://localhost:3000/**`

### 5d. Flutter Android App ke liye alag OAuth Client (optional)

Web aur Flutter ke liye **ek hi Google Cloud project** use karo, par **do alag OAuth clients** banao:

| | Web application client | Android client |
|---|---|---|
| Kis liye | Website (React/Vercel + Supabase) | Flutter native Android app |
| Type | **Web application** | **Android** |
| Config | JS origins (`localhost:5173` + prod URL), redirect: `https://PROJECT.supabase.co/auth/v1/callback` | Package name (e.g. `com.dukaan.pos`) + SHA-1 fingerprints (debug + release dono) |
| Secret | ✅ Chahiye — sirf Supabase dashboard + `.env.local` mein | ❌ Nahi hota — Google SHA-1 + package name se verify karta hai |
| Supabase provider | Yehi ID/secret Supabase mein jaata hai | Supabase mein kuch nahi dalna |

SHA-1 nikaalne ke liye:

```bash
# Debug keystore
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -password android

# Release keystore
keytool -list -v -keystore your-release-key.jks -alias your-alias
```

Flutter login flow (`google_sign_in` + Supabase):

```dart
final googleSignIn = GoogleSignIn(serverClientId: '<WEB_CLIENT_ID>'); // Web wala client ID
final account = await googleSignIn.signIn();
await supabase.auth.signInWithIdToken(
  provider: OAuthProvider.google,
  token: account!.authentication.idToken!,
);
```

**Important:**
- `serverClientId` mein **Web client ID** dena — tab ID token ka audience Supabase ke configured client se match karega.
- Android client ka secret nahi hota — koi secret manage nahi karna Flutter ke liye.
- Client ID public hota hai; **Client Secret repo mein kabhi commit na karo** — sirf Supabase dashboard + `.env.local` mein rahega.
- Website deploy pe iska koi fark nahi padta — web client ka setup same rahega.

---

## Step 6: Vercel Environment Variables

Vercel Dashboard → aapka project → **Settings → Environment Variables**:

| Key | Value |
|---|---|
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_ANON_KEY` | anon key |

`DATABASE_URL` sirf local `db:push` ke liye hai — Vercel pe zaroori nahi.

---

## ✅ Verification Checklist

- [ ] `.env.local` mein 2 Supabase vars set hain
- [ ] `bun run db:push` successful — tables ban gaye
- [ ] `supabase/policies.sql` SQL Editor mein run ho gaya (RLS ON)
- [ ] Google OAuth client + Supabase provider configured
- [ ] App mein "Continue with Google" clickable hai
- [ ] Login pe redirect → dashboard — avatar header mein dikh raha

## 🎯 Guest vs Account Mode

| Feature | Guest Mode | Account Mode |
|---|---|---|
| Data storage | localStorage only | localStorage + cloud sync |
| Multi-device | ❌ | ✅ login pe data wapas |
| Login | Not needed | Google / (Email soon) |
| Security | PIN | RLS — sirf aapka data |
| Phone kho gaya | Data gone | ☁️ Cloud se recover |

## 📞 Troubleshooting

**"Continue with Google" disabled hai?**
→ Env vars missing — `.env.local` check karo + dev server restart

**Google login ke baad blank page?**
→ Redirect URL mismatch — Supabase → Authentication → URL Configuration check karo

**Tables nahi bane?**
→ `DATABASE_URL` password mein special chars hain to URL-encode karo (`@` → `%40`)
