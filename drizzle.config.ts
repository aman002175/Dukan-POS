// Drizzle Kit config — Supabase Postgres
// Usage: DATABASE_URL="postgresql://..." bun run db:push
import { defineConfig } from 'drizzle-kit';

const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || '';

if (!dbUrl) {
  console.error(
    '\n❌ DATABASE_URL missing! Supabase → Project Settings → Database → Connection String (URI) copy karke .env.local mein daalo:\n' +
    '   DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres\n'
  );
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: dbUrl,
  },
  strict: true,
  verbose: true,
});
