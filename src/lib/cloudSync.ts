// Cloud Sync Helper — localStorage AppState ↔ Supabase dukaan_states (jsonb blob)
// Guest mode: sab kuch localStorage. Account mode: localStorage primary + cloud backup.
// Ek user = ek jsonb document (dukaan_states.user_id unique).
import type { Session } from '@supabase/supabase-js';
import type { AppState } from '@/types';
import { supabase, isCloudConfigured } from './supabase';
import { loadAppState, saveAppState, defaultAppState } from '@/utils/storage';

const LAST_SYNC_KEY = 'dukaan_last_sync_at';

/** Pichhli successful sync ka timestamp (localStorage) */
export function getLastSyncAt(): number {
  try {
    const raw = localStorage.getItem(LAST_SYNC_KEY);
    return raw ? Number(raw) || 0 : 0;
  } catch {
    return 0;
  }
}

function setLastSyncAt(ts: number): void {
  try {
    localStorage.setItem(LAST_SYNC_KEY, String(ts));
  } catch {
    // localStorage unavailable — sync status memory mein hi rahega
  }
}

/** Sync cancel/discard ke baad status reset */
export function clearLastSync(): void {
  try {
    localStorage.removeItem(LAST_SYNC_KEY);
  } catch {
    // ignore
  }
}

interface SyncResult {
  ok: boolean;
  /** Pull ke baad localStorage update hua to true (caller ko state reload karna ho) */
  pulled?: boolean;
  error?: string;
}

/** Cloud se user ka AppState document laao (ya null agar nahi hai) */
export async function pullCloudState(session: Session): Promise<SyncResult> {
  if (!supabase) return { ok: false, error: 'not-configured' };
  const userId = session.user.id;
  const { data, error } = await supabase
    .from('dukaan_states')
    .select('data, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: true, pulled: false }; // cloud khaali — push hi karega

  const cloud = data.data as AppState | null;
  if (!cloud) return { ok: true, pulled: false };

  const local = loadAppState();
  const localTs = getLastSyncAt();
  const localPin = local.appPin ?? null;

  // Pehli baar login (local kabhi sync nahi hua) → cloud authoritative.
  // Local pe EMPTY defaults hon to bhi cloud restore hi karo.
  const localLooksEmpty =
    local.products.length === 0 &&
    local.customers.length === 0 &&
    local.sales.length === 0 &&
    local.billCounter === defaultAppState.billCounter;

  let next: AppState;
  if (localLooksEmpty) {
    next = { ...defaultAppState, ...cloud };
  } else if (localTs > 0) {
    // Dono taraf data hai — latest wins (localStorage last-sync timestamp se)
    next = localTs >= Date.parse(data.updated_at as string)
      ? local
      : { ...defaultAppState, ...cloud };
  } else {
    // Local mein real data hai par pehli baar sync — local authoritative (overwrite cloud)
    next = local;
  }

  // 🔒 PIN LOCAL-ONLY: appPin kabhi cloud pe store nahi hota (plaintext security risk).
  // Pull ke waqt local PIN preserve karo — cloud data mein appPin null/undefined hi hoga.
  next.appPin = localPin;

  saveAppState(next);
  setLastSyncAt(Date.now());
  return { ok: true, pulled: true };
}

/** localStorage ka current state cloud pe push karo (upsert) */
export async function pushCloudState(session: Session): Promise<SyncResult> {
  if (!supabase) return { ok: false, error: 'not-configured' };
  const state = loadAppState();

  // 🛡️ COOKIE-CLEAR GUARD — browser cookies/site-data clear karne se localStorage
  // bhi jaata hai → local state EMPTY ho jati hai. Aise empty state ko cloud pe
  // push karna = cloud ka REAL backup bhi wipe ho jayega. Isliye jab local
  // khali ho aur cloud mein pehle se data ho, to push SKIP karo (pull hi karega).
  const localLooksEmpty =
    state.products.length === 0 &&
    state.customers.length === 0 &&
    state.sales.length === 0 &&
    state.billCounter === defaultAppState.billCounter;
  if (localLooksEmpty) {
    const { data: existing } = await supabase
      .from('dukaan_states')
      .select('id')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (existing) {
      return { ok: false, error: 'local-empty-guard' };
    }
    // Cloud bhi khali hai — pehla push, normal flow
  }

  // 🔒 PIN LOCAL-ONLY: appPin (plaintext) cloud pe kabhi push nahi karte.
  // Phone khoya / localStorage padh liya to bhi PIN sirf device pe rahega.
  const { appPin: _localPin, ...cloudState } = state;

  // ⚠️ onConflict: 'user_id' ZAROORI hai — user_id pe unique constraint hai,
  // bina iske PostgREST primary key (id) pe conflict dekhta hai aur naya row
  // insert karne ki koshish karta hai → duplicate key error.
  const { error } = await supabase.from('dukaan_states').upsert(
    {
      user_id: session.user.id,
      data: cloudState,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (error) return { ok: false, error: error.message };
  setLastSyncAt(Date.now());
  return { ok: true };
}

export const cloudSyncAvailable = isCloudConfigured;
