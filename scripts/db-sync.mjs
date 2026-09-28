// Build-time DB schema sync — Vercel deploy ke waqt drizzle-kit push + RLS re-apply.
// - DATABASE_URL set nahi hai → skip (sirf frontend build, build fail nahi hoga)
// - DATABASE_URL set hai → naye tables/columns auto-create + sync ho jayenge
//
// 🔒 RLS RE-APPLY (security — VULN-01/02/05 fix):
// Drizzle RLS policies banana NAHI jaanta. Agar use schema drift dikhta hai toh
// woh table ko DROP + CREATE karta hai — aur RLS policies table ke saath attached
// hote hain, toh woh chupke se mit jaate hain (site "apne aap" public ho jaati hai).
// Isliye drizzle push ke BAAD supabase/policies.sql dobara chalate hain:
// RLS har deploy pe self-heal hota hai, chahe drizzle kuch bhi recreate kare.
// Script idempotent hai (if not exists / drop policy if exists), isliye safe re-run hai.
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

if (!process.env.DATABASE_URL) {
  console.log('⏭️  DATABASE_URL set nahi hai — schema sync skip, sirf frontend build hoga');
  process.exit(0);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const POLICIES_SQL = join(__dirname, '..', 'supabase', 'policies.sql');

console.log('🔄 Database schema sync ho raha hai (drizzle-kit push)...');
const res = spawnSync('bunx', ['drizzle-kit', 'push', '--force'], {
  stdio: 'inherit',
  env: process.env,
});

if (res.error) {
  console.warn('⚠️  Schema sync skip hua:', res.error.message);
} else if (res.status !== 0) {
  // Push fail hua → build FAIL nahi karenge (deploy jaari rahega),
  // par Vercel logs mein poora error clearly dikhega (stdio: inherit upar print kara hai).
  console.warn('⚠️⚠️  SCHEMA SYNC FAIL HUA (exit ' + res.status + ') — upar ka error padho!');
  console.warn('⚠️  Tables purane schema ke hain — cloud sync is deploy mein toot sakta hai.');
  console.warn('⚠️  Fix: DATABASE_URL check karo ya local se `bun run db:push` chalao.');
} else {
  console.log('✅ Database schema sync ho gaya');
}

// ── 🔒 RLS re-apply (drizzle table recreate kar sakta hai → policies wipe) ──
if (existsSync(POLICIES_SQL)) {
  try {
    const { default: postgres } = await import('postgres');
    const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: 'require' });
    await sql.unsafe(readFileSync(POLICIES_SQL, 'utf8'));
    await sql.end();
    console.log('🔒 RLS policies re-applied (rows are per-user locked)');
  } catch (err) {
    // Security guard fail hona = build fail NAHI karna (deploy jaari rahe),
    // par Vercel logs mein loud warning — RLS manually check karo.
    console.warn('⚠️⚠️  RLS RE-APPLY FAIL HUA:', err.message);
    console.warn('⚠️  Drizzle ne table recreate kiya ho toh RLS OFF ho sakta hai.');
    console.warn('⚠️  Fix: Supabase SQL Editor mein supabase/policies.sql paste karke Run karo.');
  }
} else {
  console.warn('⚠️  supabase/policies.sql nahi mila — RLS re-apply skip.');
}

process.exit(0);
