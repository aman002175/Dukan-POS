// Dukaan POS — Drizzle Schema (PostgreSQL / Supabase)
// Tables push karne ke liye: `bun run db:push` (SETUP.md dekho)
import { pgTable, uuid, text, jsonb, timestamp } from 'drizzle-orm/pg-core';
import type { AppState } from '../../types';

/**
 * Profiles — Supabase auth.users ka mirror (public schema)
 * id = auth.users.id (FK, trigger se auto-create hota hai)
 */
export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(), // auth.users.id
  email: text('email'),
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Dukaan States — har user ka pura app state ek jsonb document mein.
 * Frontend ka localStorage blob (dukaan_pos_data) yahan seedha sync hoga.
 * user_id UNIQUE — 1 user = 1 state document.
 */
export const dukaanStates = pgTable('dukaan_states', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().unique(),
  data: jsonb('data').$type<AppState>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Future tables (products/sales alag-alag normalize karne ho to) yahan add kar sakte ho.
// Abhi ek jsonb blob sync approach simplest aur fastest hai.
