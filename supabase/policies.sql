-- ============================================================
-- Dukaan POS — Supabase Complete Setup Script
-- Kahan run karna hai: Supabase Dashboard → SQL Editor → New query → paste → Run
-- Ye script:
--   1. profiles table banata hai (auth.users ka mirror)
--   2. dukaan_states table banata hai (per-user app data, jsonb)
--   3. RLS policies enable karta hai — har user sirf apna data dekh sake
--   4. Google signup pe profile auto-create trigger lagata hai
-- ============================================================

-- 1) PROFILES TABLE
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- 2) DUKAAN_STATES TABLE — har user ka pura app state ek jsonb document
create table if not exists public.dukaan_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- 3) INDEXES
create index if not exists idx_dukaan_states_user_id on public.dukaan_states(user_id);

-- 4) ENABLE RLS
alter table public.profiles enable row level security;
alter table public.dukaan_states enable row level security;

-- 5) PROFILES POLICIES
drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 6) DUKAAN_STATES POLICIES — per-user isolation (security requirement)
drop policy if exists "Users can read own state" on public.dukaan_states;
create policy "Users can read own state"
  on public.dukaan_states for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own state" on public.dukaan_states;
create policy "Users can insert own state"
  on public.dukaan_states for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own state" on public.dukaan_states;
create policy "Users can update own state"
  on public.dukaan_states for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own state" on public.dukaan_states;
create policy "Users can delete own state"
  on public.dukaan_states for delete
  using (auth.uid() = user_id);

-- 7) AUTO-CREATE PROFILE on signup (Google login pe bhi chalega)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 8) UPDATED_AT auto-update trigger
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists dukaan_states_updated_at on public.dukaan_states;
create trigger dukaan_states_updated_at
  before update on public.dukaan_states
  for each row execute procedure public.handle_updated_at();

-- ============================================================
-- ✅ Done! Ab tables + RLS + triggers ready hain.
-- ============================================================
