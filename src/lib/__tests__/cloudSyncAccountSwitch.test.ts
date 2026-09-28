import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Session } from '@supabase/supabase-js';
import type { AppState } from '@/types';
import { defaultAppState, defaultBusinessProfile } from '@/utils/storage';

/**
 * ACCOUNT-SWITCH data leak (regression)
 *
 * Symptom: purana account logout → nayi email se naya account → naye account
 * me purane account ka saara localStorage data aa gaya, aur wahi debounced
 * push se naye account ki DB row me chala gaya (dono dukaan identical).
 *
 * Root cause: localStorage key global thi (dukaan_pos_data) — koi user-id
 * nahi. Aur pullCloudState naye account (jiska cloud row abhi bana hi nahi)
 * par "cloud khaali → push kar do" return kar deta tha, local data clean kiye
 * BINA. Richness-based cloud-backup protection ne bhi ise aur bada kiya.
 *
 * Fix: local state ka owner (user id) track hota hai. Owner alag hai to local
 * data bilkul discard — cloud se restore, ya clean slate.
 */

const OWNER_KEY = 'dukaan_state_owner';
const DATA_KEY = 'dukaan_pos_data';

// ── Supabase mock: har user ka cloud row lookup map se ──
const cloudRows = new Map<string, AppState>();
const upserts: Array<{ user_id: string; data: unknown }> = [];

function maybeSingle(userId: string) {
  const row = cloudRows.get(userId);
  return Promise.resolve({
    // PostgREST row shape: { data: <AppState>, updated_at }
    data: row ? { data: row, updated_at: new Date().toISOString() } : null,
    error: null,
  });
}

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

const { pullCloudState, pushCloudState, getStateOwner } = await import('@/lib/cloudSync');

const sessionFor = (userId: string) =>
  ({ user: { id: userId } }) as unknown as Session;

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

function writeLocal(state: AppState) {
  localStorage.setItem(DATA_KEY, JSON.stringify(state));
}
function readLocal(): AppState {
  return JSON.parse(localStorage.getItem(DATA_KEY) || '{}') as AppState;
}

describe('cloudSync — account switch isolation', () => {
  beforeEach(() => {
    localStorage.clear();
    cloudRows.clear();
    upserts.length = 0;
  });

  it('local data kisi aur account ka hai to naye account me leak NAHI hota', async () => {
    // Setup: browser me account A ka data + ownership
    writeLocal(shopA);
    localStorage.setItem(OWNER_KEY, 'user-A');
    // Naya account B ke paas cloud me kuch nahi hai
    cloudRows.delete('user-B');

    const res = await pullCloudState(sessionFor('user-B'));

    expect(res.ok).toBe(true);
    const local = readLocal();
    // ❌ A ka koi bhi data nahi chhona chahiye
    expect(local.products ?? []).toHaveLength(0);
    expect(local.customers ?? []).toHaveLength(0);
    expect(local.sales ?? []).toHaveLength(0);
    // Owner ab naye user ka hona chahiye
    expect(getStateOwner()).toBe('user-B');
  });

  it('account switch ke baad push purana data naye account ki row me NAHI bhejta', async () => {
    writeLocal(shopA);
    localStorage.setItem(OWNER_KEY, 'user-A');
    cloudRows.delete('user-B');

    await pullCloudState(sessionFor('user-B'));
    const res = await pushCloudState(sessionFor('user-B'));

    expect(res.ok).toBe(true);
    const pushed = upserts.find((u) => u.user_id === 'user-B');
    const data = pushed?.data as AppState;
    // Nayi row ban par usme A ka data nahi hona chahiye
    expect(data?.products ?? []).toHaveLength(0);
    expect(data?.sales ?? []).toHaveLength(0);
  });

  it('push-side guard: owner mismatch ho to push bilkul skip', async () => {
    // Pull ke bina (network fail / timing) push chala — owner abhi bhi A hai
    writeLocal(shopA);
    localStorage.setItem(OWNER_KEY, 'user-A');
    cloudRows.set('user-B', stateWith());

    const res = await pushCloudState(sessionFor('user-B'));

    expect(res.ok).toBe(false);
    expect(res.error).toBe('local-owner-mismatch');
    // B ki row bilkul touch nahi hui
    expect(upserts).toHaveLength(0);
  });

  it('switch ke baad naye account ka cloud backup restore hota hai', async () => {
    writeLocal(shopA);
    localStorage.setItem(OWNER_KEY, 'user-A');
    // B ke paas apna alag backup hai
    const shopB = stateWith({
      products: [{ id: 'p9', name: 'Doodh', stock: 3 }] as unknown as AppState['products'],
    });
    cloudRows.set('user-B', shopB);

    const res = await pullCloudState(sessionFor('user-B'));

    expect(res.pulled).toBe(true);
    const local = readLocal();
    expect(local.products).toHaveLength(1);
    expect(local.products[0].id).toBe('p9');
  });

  it('SAME user dobara login kare to local data bacha rahe hai', async () => {
    writeLocal(shopA);
    localStorage.setItem(OWNER_KEY, 'user-A');
    cloudRows.delete('user-A');

    await pullCloudState(sessionFor('user-A'));

    expect(readLocal().products).toHaveLength(1);
    expect(readLocal().sales).toHaveLength(1);
  });

  it('pehli baar guest se account — local data migrate hota hai (feature)', async () => {
    writeLocal(shopA);
    // Owner set nahi hai = guest mode ka data
    cloudRows.delete('user-A');

    const res = await pullCloudState(sessionFor('user-A'));

    expect(res.ok).toBe(true);
    expect(readLocal().products).toHaveLength(1);
    expect(getStateOwner()).toBe('user-A');
  });
});
