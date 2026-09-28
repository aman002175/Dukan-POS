import { describe, it, expect } from 'vitest';
import {
  computeTopProducts,
  computeTopCustomers,
  computeTopDues,
  computeSummary,
  cashPart,
  udhaarPart,
} from '@/utils/reportAnalytics';
import { defaultAppState } from '@/utils/storage';
import type { Customer, Product, Sale } from '@/types';

/**
 * Ye numbers DO jagah jaate hain — Reports screen ke cards aur AI ke system
 * prompt. Pehle dono alag-alag calculate karte the, isliye AI "sabse zyada bika"
 * ka jawab Reports card se alag bata deta tha. Ye tests usi drift ko rokta hai.
 */

const TODAY = '2026-09-28';

const sale = (over: Partial<Sale> = {}): Sale => ({
  id: over.id ?? 's1',
  billNumber: over.billNumber ?? 'BILL-0001',
  items: over.items ?? [{ productId: 'p1', name: 'Maggi', price: 12, quantity: 1, total: 12 }],
  total: over.total ?? 12,
  type: over.type ?? 'cash',
  customerId: over.customerId,
  customerName: over.customerName,
  amountPaid: over.amountPaid,
  createdAt: over.createdAt ?? Date.now(),
  date: over.date ?? TODAY,
  time: '10:00 AM',
});

const cust = (over: Partial<Customer> = {}): Customer => ({
  id: over.id ?? 'c1',
  name: over.name ?? 'Raju',
  phone: '9876543210',
  address: '',
  totalDue: over.totalDue ?? 0,
  createdAt: 0,
});

const prod = (over: Partial<Product> = {}): Product =>
  ({ id: 'p1', name: 'Maggi', stock: 10, minStock: 2, ...over }) as unknown as Product;

describe('computeTopProducts — REVENUE se sort (qty se nahi)', () => {
  it('ranks by revenue, not quantity', () => {
    const sales = [
      sale({ items: [{ productId: 'a', name: 'Aata', price: 1, quantity: 1, total: 1 }], total: 1 }), // 1 unit, ₹1
      sale({ items: [{ productId: 'm', name: 'Maggi', price: 10, quantity: 20, total: 200 }], total: 200 }), // 20 units, ₹200
    ];
    const top = computeTopProducts(sales, 5);
    expect(top[0].name).toBe('Maggi'); // zyada revenue
    expect(top[0].qty).toBe(20);
    expect(top[0].revenue).toBe(200);
  });

  it('aggregates the same product across multiple bills', () => {
    const sales = [
      sale({ id: 's1', items: [{ productId: 'm', name: 'Maggi', price: 12, quantity: 2, total: 24 }] }),
      sale({ id: 's2', items: [{ productId: 'm', name: 'Maggi', price: 12, quantity: 3, total: 36 }] }),
    ];
    const top = computeTopProducts(sales, 5);
    expect(top).toHaveLength(1);
    expect(top[0].qty).toBe(5);
    expect(top[0].revenue).toBe(60);
  });

  it('respects the limit', () => {
    const sales = Array.from({ length: 9 }, (_, i) =>
      sale({ id: `s${i}`, items: [{ productId: `p${i}`, name: `Item${i}`, price: 10, quantity: 1, total: 10 - i }] })
    );
    expect(computeTopProducts(sales, 5)).toHaveLength(5);
  });

  it('returns empty for no sales', () => {
    expect(computeTopProducts([], 5)).toEqual([]);
  });
});

describe('cashPart / udhaarPart — split bill dono hisse', () => {
  it('cash bill: full amount cash, 0 udhaar', () => {
    expect(cashPart({ type: 'cash', total: 500 })).toBe(500);
    expect(udhaarPart({ type: 'cash', total: 500 })).toBe(0);
  });

  it('udhaar bill: 0 cash, full udhaar', () => {
    expect(cashPart({ type: 'udhaar', total: 500 })).toBe(0);
    expect(udhaarPart({ type: 'udhaar', total: 500 })).toBe(500);
  });

  it('split bill: amountPaid cash, baaki udhaar', () => {
    expect(cashPart({ type: 'udhaar', total: 800, amountPaid: 500 })).toBe(500);
    expect(udhaarPart({ type: 'udhaar', total: 800, amountPaid: 500 })).toBe(300);
  });
});

describe('computeTopCustomers / computeTopDues', () => {
  it('top customers by total bill value', () => {
    const sales = [
      sale({ id: 's1', customerId: 'c1', customerName: 'Raju', total: 100 }),
      sale({ id: 's2', customerId: 'c1', customerName: 'Raju', total: 100 }),
      sale({ id: 's3', customerId: 'c2', customerName: 'Mohan', total: 5000 }),
    ];
    const top = computeTopCustomers(sales, [cust({ id: 'c1' }), cust({ id: 'c2' })], 5);
    expect(top[0].name).toBe('Mohan');
    expect(top[1].name).toBe('Raju');
    expect(top[1].count).toBe(2);
  });

  it('walk-in (no customer) bills skip hoti hain', () => {
    expect(computeTopCustomers([sale()], [], 5)).toEqual([]);
  });

  it('top dues: sirf baaki wale, biggest pehle', () => {
    const dues = computeTopDues(
      [
        cust({ id: 'c1', name: 'Raju', totalDue: 100 }),
        cust({ id: 'c2', name: 'Mohan', totalDue: 2000 }),
        cust({ id: 'c3', name: 'Zero', totalDue: 0 }),
        cust({ id: 'c4', name: 'Advance', totalDue: -500 }), // negative = advance
      ],
      5
    );
    expect(dues.map((d) => d.name)).toEqual(['Mohan', 'Raju']); // Zero/Advance exclude
  });
});

describe('computeSummary — AI prompt + Reports dono ka hi source', () => {
  it('today vs all-time split sahi hai', () => {
    const sales = [
      sale({ id: 's1', date: TODAY, total: 300, type: 'cash' }),
      sale({ id: 's2', date: '2026-01-01', total: 700, type: 'cash' }),
    ];
    const s = computeSummary(sales, [], [], TODAY);
    expect(s.today.bills).toBe(1);
    expect(s.today.revenue).toBe(300);
    expect(s.allTime.bills).toBe(2);
    expect(s.allTime.revenue).toBe(1000);
  });

  it('totalDue sirf positive balances gin-ta hai (advance minus hota hai)', () => {
    const s = computeSummary([], [cust({ id: 'c1', totalDue: 500 }), cust({ id: 'c2', totalDue: -200 })], [], TODAY);
    expect(s.totalDue).toBe(500);
    expect(s.dueCustomers).toBe(1);
  });

  it('summary.topProducts wahi hai jo computeTopProducts deta hai (drift-proof)', () => {
    const sales = [
      sale({ id: 's1', items: [{ productId: 'a', name: 'Aata', price: 1, quantity: 1, total: 1 }] }),
      sale({ id: 's2', items: [{ productId: 'm', name: 'Maggi', price: 10, quantity: 5, total: 50 }] }),
    ];
    const s = computeSummary(sales, [], [], TODAY);
    expect(s.topProducts).toEqual(computeTopProducts(sales, 5));
  });

  it('low stock + expiry count', () => {
    const s = computeSummary(
      [],
      [],
      [
        prod({ id: 'p1', name: 'Low', stock: 1, minStock: 5 }),
        prod({ id: 'p2', name: 'Fine', stock: 50, minStock: 5 }),
      ],
      TODAY
    );
    expect(s.lowStockCount).toBe(1);
  });

  it('empty dukaan pe crash nahi hota', () => {
    const s = computeSummary([], [], [], TODAY);
    expect(s.allTime.revenue).toBe(0);
    expect(s.topProducts).toEqual([]);
  });

  it('defaultAppState ke saath bhi safe hai', () => {
    expect(() => computeSummary(defaultAppState.sales, defaultAppState.customers, defaultAppState.products, TODAY)).not.toThrow();
  });
});
