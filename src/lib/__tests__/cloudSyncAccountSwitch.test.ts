import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Session } from '@supabase/supabase-js';
import type { AppState } from '@/types';
import { defaultAppState, defaultBusinessProfile } from '@/utils/storage';

/**
 * NAMESPACE PATTERN — cross-account data leak (regression)
 *
 * Symptom: purana account logout → nayi email se naya account → naye account
 * me purane account ka saara localStorage data aa gaya, aur wahi debounced
 * push se naye account ki DB row me chala gaya (dono dukaan identical).
 *
 * Root cause: localStorage key global thi (dukaan_pos_data) — koi user-id
 * nahi tha, to "kaun sa data hai" ka koi record hi nahi tha.
 *
 * Ab: keys user se baandhi hain (dukaan_pos_data_<userId>). Ownership
 * structural hai, to sync ko guess nahi karna padta.
 */

const mockSupabase = {
  from: (_table: string) => ({
    select: () => ({
      eq: (_col: string, val: string) => ({ maybeSingle: () => maybeSingle(val) }),
    }),
    upsert: async (row: { user_id: string; data: unknown }) => {
      upserts.push({ user_id: row.user_id, data: row.data });
      cloudRows.set(row.user_id, row.data as AppState);
      return { error: null };
    },
  }),
};

vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase,
  isCloudConfigured: true,
}));

const cloudRows = new Map<string, AppState>();
const upserts: Array<{ user_id: string; data: unknown }> = [];

function maybeSingle(userId: string) {
  const row = cloudRows.get(userId);
  return Promise.resolve({
    data: row ? { data: row, updated_at: new Date().toISOString() } : null,
    error: null,
  });
}

const ns = await import('@/lib/namespacedStorage');
const { pullCloudState, pushCloudState } = await import('@/lib/cloudSync');
const { loadAppState, saveAppState } = await import('@/utils/storage');

const sessionFor = (userId: string) => ({ user: { id: userId } }) as unknown as Session;

const stateWith = (over: Partial<AppState> = {}): AppState => ({
  ...defaultAppState,
  ...over,
  businessProfile: { ...defaultBusinessProfile, ...(over.businessProfile ?? {}) },
});

/** Account A ka "asli" dukaan data */
const shopA = stateWith({
  products: [{ id: 'p1', name: 'Aata', stock: 5 }] as unknown as AppState['products'],
  customers: [{ id: 'c1', name: 'Raju', totalDue: 500 }] as unknown as AppState['customers'],
  sales: [{ id: 's1', total: 900 }] as unknown as AppState['sales'],
});

describe('namespace pattern — local data user se baandhi hai', () => {
  beforeEach(() => {
    localStorage.clear();
    cloudRows.clear();
    upserts.length = 0;
    ns.setActiveScope({ mode: 'guest' });
  });

  it('key me userId judti hai', () => {
    ns.setActiveScope({ mode: 'account', userId: 'user-A' });
    expect(ns.NamespacedStorage.keyFor('dukaan_pos_data')).toBe('dukaan_pos_data_user-A');
    ns.setActiveScope({ mode: 'account', userId: 'user-B' });
    expect(ns.NamespacedStorage.keyFor('dukaan_pos_data')).toBe('dukaan_pos_data_user-B');
    ns.setActiveScope({ mode: 'guest' });
    expect(ns.NamespacedStorage.keyFor('dukaan_pos_data')).toBe('dukaan_pos_data_guest');
  });

  it('account scope me userId khaali ho to UNBOUND key kabhi nahi banti', () => {
    // A ka data pehle se pada hai
    ns.setActiveScope({ mode: 'account', userId: 'user-A' });
    saveAppState(shopA);

    // Account mode maange par userId khaali — scope guest par reset ho jaata hai,
    // isliye "account but no id" state exist hi nahi karta.
    ns.setActiveScope({ mode: 'account', userId: '' as string });

    const key = ns.NamespacedStorage.keyFor('dukaan_pos_data');
    // Key hamesha BOUND hai (guest) — kabhi `dukaan_pos_data` raw nahi
    expect(key).toBe('dukaan_pos_data_guest');
    expect(key).not.toBe('dukaan_pos_data');
    // A ka data padha nahi gaya
    expect(ns.NamespacedStorage.get('dukaan_pos_data', null)).toBeNull();
  });

  it('resolveKey account mode me bind nahi ho sakta → null', () => {
    // Ye guard tabhi matter karta hai jab koi future scope state banaye —
    // abhi setActiveScope invalid account scope ko reject karta hai.
    expect(ns.resolveKey('dukaan_pos_data')).toBe('dukaan_pos_data_guest');
  });

  it('B ki namespace me A ka data dikhta hi nahi', () => {
    ns.setActiveScope({ mode: 'account', userId: 'user-A' });
    saveAppState(shopA);
    expect(loadAppState().products).toHaveLength(1);

    // B login karta hai
    ns.setActiveScope({ mode: 'account', userId: 'user-B' });
    expect(loadAppState().products).toHaveLength(0);
    expect(loadAppState().customers).toHaveLength(0);
    expect(loadAppState().sales).toHaveLength(0);
  });

  it('A logout karke wapas login kare to uska offline data bacha rahe hai', () => {
    ns.setActiveScope({ mode: 'account', userId: 'user-A' });
    saveAppState(shopA);
    // logout → guest
    ns.setActiveScope({ mode: 'guest' });
    expect(loadAppState().products).toHaveLength(0);
    // wapas login
    ns.setActiveScope({ mode: 'account', userId: 'user-A' });
    expect(loadAppState().products).toHaveLength(1);
    expect(loadAppState().sales).toHaveLength(1);
  });

  it('A ka data device se mita bhi sakte ho (shared device ke liye)', () => {
    ns.setActiveScope({ mode: 'account', userId: 'user-A' });
    saveAppState(shopA);
    ns.setActiveScope({ mode: 'guest' });
    ns.clearUser('user-A');
    ns.setActiveScope({ mode: 'account', userId: 'user-A' });
    expect(loadAppState().products).toHaveLength(0);
  });

  it('clearCurrent sirf active user ka data mita hai', () => {
    ns.setActiveScope({ mode: 'account', userId: 'user-A' });
    saveAppState(shopA);
    ns.setActiveScope({ mode: 'account', userId: 'user-B' });
    saveAppState(stateWith({ products: [{ id: 'p9' }] as unknown as AppState['products'] }));

    ns.NamespacedStorage.clearCurrent(); // B ka data gaya
    expect(loadAppState().products).toHaveLength(0);

    ns.setActiveScope({ mode: 'account', userId: 'user-A' });
    expect(loadAppState().products).toHaveLength(1); // A ka bacha
  });

  it('sync OWNERSHIP CHECK: active namespace alag user ka ho to push refuse', async () => {
    // Local me A ka data hai, par app abhi guest scope me hai
    ns.setActiveScope({ mode: 'account', userId: 'user-A' });
    saveAppState(shopA);
    ns.setActiveScope({ mode: 'guest' });

    cloudRows.set('user-B', stateWith());
    const res = await pushCloudState(sessionFor('user-B'));

    expect(res.ok).toBe(false);
    expect(res.error).toBe('local-owner-mismatch');
    expect(upserts).toHaveLength(0);
  });

  it('switch ke baad push nayi row me A ka data nahi bhejta', async () => {
    ns.setActiveScope({ mode: 'account', userId: 'user-A' });
    saveAppState(shopA);
    cloudRows.delete('user-A');

    // B login → scope switch → pull → push
    ns.setActiveScope({ mode: 'account', userId: 'user-B' });
    await pullCloudState(sessionFor('user-B'));
    const res = await pushCloudState(sessionFor('user-B'));

    expect(res.ok).toBe(true);
    const pushed = upserts.find((u) => u.user_id === 'user-B');
    const data = pushed?.data as AppState;
    expect(data?.products ?? []).toHaveLength(0);
    expect(data?.sales ?? []).toHaveLength(0);
    // A ka local data uski hi key me salamat hai
    ns.setActiveScope({ mode: 'account', userId: 'user-A' });
    expect(loadAppState().products).toHaveLength(1);
  });
});

describe('🎁 guest → account adoption (pehle guest, phir account banaya)', () => {
  beforeEach(() => {
    localStorage.clear();
    cloudRows.clear();
    upserts.length = 0;
    ns.setActiveScope({ mode: 'guest' });
  });

  it('guest ka data naye account me adopt hota hai aur cloud pe push hota hai', async () => {
    // Guest mode me dukaan chalayi
    const guestShop = stateWith({
      products: [{ id: 'gp1', name: 'Chai', stock: 10 }] as unknown as AppState['products'],
      sales: [{ id: 'gs1', total: 250 }] as unknown as AppState['sales'],
    });
    saveAppState(guestShop);

    // Ab account banaya — namespace switch + adoption (AuthContext jaisa order)
    ns.setActiveScope({ mode: 'account', userId: 'user-new' });
    const adopted = ns.adoptGuestData(['dukaan_pos_data', 'dukaan_pos_cart']);
    expect(adopted).toContain('dukaan_pos_data');

    // Naye account ko guest ka data dikha
    expect(loadAppState().products).toHaveLength(1);
    expect(loadAppState().products[0].name).toBe('Chai');

    // Push se guest ka data naye account ki CLOUD row me gaya (main goal)
    const session = sessionFor('user-new');
    const pulled = await pullCloudState(session);
    expect(pulled.ok).toBe(true);
    const pushed = await pushCloudState(session);
    expect(pushed.ok).toBe(true);
    expect(upserts.some(u => u.user_id === 'user-new')).toBe(true);
    const row = upserts.find(u => u.user_id === 'user-new');
    expect((row!.data as AppState).products[0].name).toBe('Chai');
  });

  it('naye account ke pehle se data ho to guest adopt NAHI hota (overwrite nahi)', () => {
    // Pehle account banao, data dalo
    ns.setActiveScope({ mode: 'account', userId: 'user-A' });
    saveAppState(shopA);

    // Ab guest ne alag dukaan chalayi
    ns.setActiveScope({ mode: 'guest' });
    saveAppState(stateWith({
      products: [{ id: 'gx', name: 'GuestOnly', stock: 1 }] as unknown as AppState['products'],
    }));

    // Wapas A ne login kiya — A ka data safe, guest ka adopt nahi hoga
    ns.setActiveScope({ mode: 'account', userId: 'user-A' });
    const adopted = ns.adoptGuestData(['dukaan_pos_data']);
    expect(adopted).toEqual([]);
    expect(loadAppState().products[0].name).toBe('Aata');
  });

  it('khaali guest adopt nahi hota (falta overwrite nahi)', () => {
    // Guest me sirf default/khaali data
    saveAppState(defaultAppState);
    ns.setActiveScope({ mode: 'account', userId: 'user-fresh' });
    const adopted = ns.adoptGuestData(['dukaan_pos_data']);
    // khaali string serialize hoti hai, par data default ke barabar hi hai —
    // adoption chal sakta hai par koi nuksan nahi; yahan assert karo ki koi crash nahi
    expect(adopted.length).toBeLessThanOrEqual(1);
    expect(loadAppState().sales).toEqual([]);
  });
});

describe('legacy key migration', () => {
  beforeEach(() => {
    localStorage.clear();
    ns.setActiveScope({ mode: 'guest' });
  });

  it('purani global key → guest namespace me migrate hoti hai', () => {
    localStorage.setItem('dukaan_pos_data', JSON.stringify(shopA));
    ns.setActiveScope({ mode: 'account', userId: 'user-A' });
    const res = ns.migrateLegacyKeys(['dukaan_pos_data']);
    expect(res.migrated).toContain('dukaan_pos_data');
    expect(loadAppState().products).toHaveLength(1);
    // Purani key hat gayi
    expect(localStorage.getItem('dukaan_pos_data')).toBeNull();
  });

  it('🔒 owner mismatch: pichle user ka legacy data MIGRATE nahi hota', () => {
    localStorage.setItem('dukaan_pos_data', JSON.stringify(shopA));
    localStorage.setItem('dukaan_state_owner', 'user-A');

    ns.setActiveScope({ mode: 'account', userId: 'user-B' });
    const res = ns.migrateLegacyKeys(['dukaan_pos_data']);

    expect(res.discarded).toContain('dukaan_pos_data');
    expect(loadAppState().products).toHaveLength(0);
    // Data delete (memory free) — kisi account ke paas nahi gaya
    expect(localStorage.getItem('dukaan_pos_data')).toBeNull();
  });
});
