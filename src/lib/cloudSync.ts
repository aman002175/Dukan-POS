// Cloud Sync Helper — localStorage AppState ↔ Supabase dukaan_states (jsonb blob)
// Guest mode: sab kuch localStorage. Account mode: localStorage primary + cloud backup.
// Ek user = ek jsonb document (dukaan_states.user_id unique).
import type { Session } from '@supabase/supabase-js';
import type { AppState } from '@/types';
import { supabase, isCloudConfigured } from './supabase';
import { loadAppState, saveAppState, defaultAppState } from '@/utils/storage';

const LAST_SYNC_KEY = 'dukaan_last_sync_at';
// 🔐 Kis user ka local data hai ye track karo. localStorage key global hai
//    (dukaan_pos_data) — isliye account switch par pichle user ka data naye
//    account me chala jaata tha (aur wahi naye account ki DB row me push ho
//    jaata tha). Is key se pata chalega ki local data kiski hai.
const STATE_OWNER_KEY = 'dukaan_state_owner';

/**
 * 🛡️ Site-data/cookie clear hone pe localStorage bhi khaali ho jaata hai.
 * Ye check BAAR-BAAR use hota hai (pull + push dono) taaki dono jagah same
 * truth bole — pehle yahan sirf products/customers/sales check hote the,
 * jisse ek shop jisme sirf purchases/returns ho (ya sirf shop details set
 * hon) "khaali" samajh jaati thi — aur uska cloud backup overwrite ho sakta tha.
 *
 * @param s      state jo check karni hai
 * @param defaults default state (shop name / bill counter baseline ke liye)
 */
export function isStateEmpty(s: AppState, defaults: AppState = defaultAppState): boolean {
  const bp = s.businessProfile;
  const dBp = defaults.businessProfile;
  const hasRealProfile =
    (bp.shopName?.trim() && bp.shopName.trim() !== dBp.shopName.trim()) ||
    (bp.ownerName ?? '').trim() ||
    (bp.phone ?? '').trim() ||
    (bp.upiId ?? '').trim();
  return (
    (s.products?.length ?? 0) === 0 &&
    (s.customers?.length ?? 0) === 0 &&
    (s.sales?.length ?? 0) === 0 &&
    (s.purchases?.length ?? 0) === 0 &&
    (s.returns?.length ?? 0) === 0 &&
    s.billCounter === defaults.billCounter &&
    !hasRealProfile
  );
}

/**
 * Kitna "asli" data hai state mein — weights ke saath taaki sales (business
 * ki sabse important history) sabse zyada count ho. Iska use: jab local
 * kabhi sync nahi hua (localTs === 0) lekin cloud mein ZYADA data hai, to
 * cloud ko overwrite na karein — naye/partial local state se asli backup
 * protect hota hai.
 */
export function stateRichness(s: AppState): number {
  return (
    (s.sales?.length ?? 0) * 5 +
    (s.purchases?.length ?? 0) * 2 +
    (s.customers?.length ?? 0) * 2 +
    (s.products?.length ?? 0) +
    (s.returns?.length ?? 0)
  );
}

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

/** Local state kis user ka hai (null = kisi ka nahi / guest) */
export function getStateOwner(): string | null {
  try {
    return localStorage.getItem(STATE_OWNER_KEY);
  } catch {
    return null;
  }
}

function setStateOwner(userId: string): void {
  try {
    localStorage.setItem(STATE_OWNER_KEY, userId);
  } catch {
    // localStorage unavailable — ownership track nahi hogi (guest flow chalega)
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

  const cloud = data?.data as AppState | null;

  // 🛑 ACCOUNT SWITCH GUARD — ye check `!data` early-return se PEHLE hona zaroori hai.
  // Pehle naya account (jiska cloud row abhi bana hi nahi) seedha "cloud khaali,
  // push kar do" return kar deta tha — lekin localStorage me pichle account ka
  // data abhi bhi pada tha. Wahi data naye account ki DB row me push hokar
  // dono dukaan ko identical bana deta tha.
  const owner = getStateOwner();
  if (owner && owner !== userId) {
    // Local data KISI AUR user ka hai — use bilkul mat lo.
    setStateOwner(userId);
    if (cloud) {
      saveAppState({ ...defaultAppState, ...cloud });
      setLastSyncAt(Date.now());
      return { ok: true, pulled: true };
    }
    // Naya account + koi cloud backup nahi → clean slate
    saveAppState(defaultAppState);
    clearLastSync();
    return { ok: true, pulled: false };
  }

  // Local ab is user ka hai (ya pehli baar guest se aaya hai — woh migrate hota hai)
  setStateOwner(userId);

  if (!data) return { ok: true, pulled: false }; // cloud khaali — push hi karega
  if (!cloud) return { ok: true, pulled: false };

  const local = loadAppState();
  const localTs = getLastSyncAt();
  const localPin = local.appPin ?? null;

  // Pehli baar login (local kabhi sync nahi hua) → cloud authoritative.
  // Local pe EMPTY defaults hon to bhi cloud restore hi karo.
  const localLooksEmpty = isStateEmpty(local);
  const cloudLooksEmpty = isStateEmpty(cloud);

  let next: AppState;
  if (localLooksEmpty) {
    // Site-data clear ke baad: local khaali → cloud se restore karo.
    next = { ...defaultAppState, ...cloud };
  } else if (localTs > 0) {
    // Dono taraf data hai — latest wins (localStorage last-sync timestamp se)
    next = localTs >= Date.parse(data.updated_at as string)
      ? local
      : { ...defaultAppState, ...cloud };
  } else if (cloudLooksEmpty) {
    // Cloud khaali → local authoritative (normal pehla sync)
    next = local;
  } else if (stateRichness(cloud) > stateRichness(local)) {
    // 🛡️ CLOUD BACKUP PROTECTION
    // Local kabhi sync nahi hua (site-data clear / naya device) lekin cloud
    // mein ZYADA asli data hai. Pehle yahan hamesha local jeet jata tha →
    // ek chhota sa guest/browser state CLOUD KA POORA BACKUP OVERWRITE kar
    // deta tha (push guard tak pahunchne se PEHLE hi). Ab cloud jeeta hai.
    next = { ...defaultAppState, ...cloud };
  } else {
    // Local mein zyada/equal data hai → local authoritative (overwrite cloud)
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

  // 🛑 PUSH-SIDE GUARD — pull() ne account-switch pe local data saaf kar diya
  // hota hai, par agar pull chhoot jaye (network error / timing) to debounced
  // push kisi AUR user ka local data is user ki DB row me daal sakta tha.
  // Yahan dobara check: local data jis user ka hai, wahi push karega.
  const owner = getStateOwner();
  if (owner && owner !== session.user.id) {
    console.warn('⛔ Push skip — local data kisi aur account ka hai');
    return { ok: false, error: 'local-owner-mismatch' };
  }

  // 🛡️ COOKIE-CLEAR GUARD — browser cookies/site-data clear karne se localStorage
  // bhi jaata hai → local state EMPTY ho jati hai. Aise empty state ko cloud pe
  // push karna = cloud ka REAL backup bhi wipe ho jayega. Isliye jab local
  // khali ho aur cloud mein pehle se data ho, to push SKIP karo (pull hi karega).
  // (isStateEmpty shared hai — purchases/returns/shop-details bhi cover karta hai)
  const localLooksEmpty = isStateEmpty(state);
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
  setStateOwner(session.user.id);
  setLastSyncAt(Date.now());
  return { ok: true };
}

export const cloudSyncAvailable = isCloudConfigured;
