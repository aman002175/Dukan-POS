// Build-time DB schema sync — Vercel deploy ke waqt drizzle-kit push chalata hai.
// - DATABASE_URL set nahi hai → skip (sirf frontend build, build fail nahi hoga)
// - DATABASE_URL set hai → naye tables/columns auto-create + sync ho jayenge
// Note: RLS policies/triggers SQL script (supabase/policies.sql) se aate hain — drizzle inko nahi banata.
import { spawnSync } from 'node:child_process';

if (!process.env.DATABASE_URL) {
  console.log('⏭️  DATABASE_URL set nahi hai — schema sync skip, sirf frontend build hoga');
  process.exit(0);
}

console.log('🔄 Database schema sync ho raha hai (drizzle-kit push)...');
const res = spawnSync('bunx', ['drizzle-kit', 'push', '--force'], {
  stdio: 'inherit',
  env: process.env,
});

if (res.error) {
  console.warn('⚠️  Schema sync skip hua:', res.error.message);
  process.exit(0); // bunx na mile to build fail na karo
}

// Push fail hua (galat password/URL) → build fail karo taaki Vercel logs mein dikhe
process.exit(res.status ?? 0);
