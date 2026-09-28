import { describe, it, expect } from 'vitest';
import { isStateEmpty, stateRichness } from '@/lib/cloudSync';
import type { AppState } from '@/types';
import { defaultAppState, defaultBusinessProfile } from '@/utils/storage';

/**
 * cloudSync data-loss protection.
 *
 * Context: browser "Clear site data" se localStorage + session dono mita hai.
 * Ghabra ye thi ki local khaali hote hi cloud ka ASLI backup bhi wipe ho jaye.
 * Push side pe cookie-clear guard hai, lekin pull side ka "local authoritative"
 * branch guard se PEHLE cloud overwrite kar sakta tha.
 */

const state = (over: Partial<AppState> = {}): AppState => ({
  ...defaultAppState,
  ...over,
  businessProfile: { ...defaultBusinessProfile, ...(over.businessProfile ?? {}) },
});

const product = (id: string) =>
  ({
    id,
    name: 'Aata',
    sku: '',
    category: '',
    salePrice: 40,
    purchasePrice: 35,
    costPrice: 35,
    stock: 10,
    unit: 'kg',
    minStock: 2,
    createdAt: 0,
    updatedAt: 0,
  }) as unknown as AppState['products'][number];

const customer = (id: string) =>
  ({
    id,
    name: 'Raju',
    phone: '9876543210',
    address: '',
    totalDue: 500,
    createdAt: 0,
  }) as unknown as AppState['customers'][number];

describe('isStateEmpty', () => {
  it('default state is empty', () => {
    expect(isStateEmpty(defaultAppState)).toBe(true);
  });

  it('state with products is NOT empty', () => {
    expect(isStateEmpty(state({ products: [product('p1')] }))).toBe(false);
  });

  it('state with only customers is NOT empty', () => {
    expect(isStateEmpty(state({ customers: [customer('c1')] }))).toBe(false);
  });

  it('state with only sales is NOT empty', () => {
    expect(isStateEmpty(state({ sales: [{ id: 's1' } as never] }))).toBe(false);
  });

  // ── Ye cases pehle MISS the — sirf products/customers/sales check hote the ──
  it('state with only purchases is NOT empty (regression)', () => {
    expect(isStateEmpty(state({ purchases: [{ id: 'p1' } as never] }))).toBe(false);
  });

  it('state with only returns is NOT empty (regression)', () => {
    expect(isStateEmpty(state({ returns: [{ id: 'r1' } as never] }))).toBe(false);
  });

  it('state with only a custom shop name is NOT empty (regression)', () => {
    expect(isStateEmpty(state({ businessProfile: { ...defaultBusinessProfile, shopName: 'Raju Kirana' } }))).toBe(false);
  });

  it('state with only a UPI id is NOT empty (regression)', () => {
    expect(isStateEmpty(state({ businessProfile: { ...defaultBusinessProfile, upiId: 'upi@ok' } }))).toBe(false);
  });

  it('bumped billCounter with no other data is NOT empty', () => {
    expect(isStateEmpty(state({ billCounter: 42 }))).toBe(false);
  });

  it('default shop name alone still counts as empty', () => {
    expect(isStateEmpty(state({ businessProfile: { ...defaultBusinessProfile, shopName: defaultBusinessProfile.shopName } }))).toBe(true);
  });

  it('tolerates missing optional collections (malformed/old data)', () => {
    const partial = { ...defaultAppState, products: undefined, customers: undefined } as unknown as AppState;
    expect(isStateEmpty(partial)).toBe(true);
  });
});

describe('stateRichness', () => {
  it('empty state scores 0', () => {
    expect(stateRichness(defaultAppState)).toBe(0);
  });

  it('sales weigh more than products (business history > catalog)', () => {
    const withSales = stateRichness(state({ sales: [{ id: 's1' } as never] }));
    const withProducts = stateRichness(state({ products: [product('p1')] }));
    expect(withSales).toBeGreaterThan(withProducts);
  });

  it('a rich cloud backup outscores a barely-used local state', () => {
    const cloud = state({ products: [product('p1'), product('p2')], sales: [{ id: 's1' }, { id: 's2' }] as never });
    const local = state({ products: [product('p1')] });
    expect(stateRichness(cloud)).toBeGreaterThan(stateRichness(local));
  });

  it('equal data scores equal (local wins ties -> legit first push)', () => {
    const a = state({ products: [product('p1')] });
    const b = state({ products: [product('p1')] });
    expect(stateRichness(a)).toBe(stateRichness(b));
  });

  it('tolerates missing optional collections', () => {
    const partial = { ...defaultAppState, sales: undefined, purchases: undefined } as unknown as AppState;
    expect(Number.isFinite(stateRichness(partial))).toBe(true);
  });
});
