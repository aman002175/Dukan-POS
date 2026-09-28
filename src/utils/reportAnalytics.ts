/**
 * reportAnalytics.ts — Dukaan POS ka ek hi "hisaab" source
 * ──────────────────────────────────────────────────────────────────
 * Reports screen aur AI assistant — dono yahi functions use karte hain.
 * Pehle dono alag-alag calculate karte the, isliye AI "sabse zyada bika"
 * jawab Reports card se ALAG bata deta tha. Ab ek hi jagah se numbers aate
 * hain, to dono hamesha match karenge.
 *
 * Ye file intentionally dependency-free hai (koi React/Supabase nahi) —
 * dono jagah import ho sakti hai aur unit-test ho sakti hai.
 * ──────────────────────────────────────────────────────────────────
 */
import type { Customer, Product, Purchase, Sale } from '@/types';

export interface TopProduct {
  name: string;
  qty: number;
  revenue: number;
}

export interface TopCustomer {
  name: string;
  total: number;
  count: number;
}

/** Sale ka cash hissa (split bill dono hisson mein bat-ta hai) */
export function cashPart(s: Pick<Sale, 'type' | 'total' | 'amountPaid'>): number {
  return s.type === 'cash' ? s.total : s.amountPaid || 0;
}

/** Sale ka baaki (udhaar) hissa */
export function udhaarPart(s: Pick<Sale, 'type' | 'total' | 'amountPaid'>): number {
  return s.type === 'cash' ? 0 : s.total - (s.amountPaid || 0);
}

/**
 * Top selling products — REVENUE se sort (qty nahi).
 * Yehi list Reports ke "Top Products" card mein dikhti hai.
 */
export function computeTopProducts(sales: Sale[], limit = 5): TopProduct[] {
  const productMap: Record<string, TopProduct> = {};
  sales.forEach((sale) => {
    sale.items.forEach((item) => {
      if (!productMap[item.name]) productMap[item.name] = { name: item.name, qty: 0, revenue: 0 };
      productMap[item.name].qty += item.quantity;
      productMap[item.name].revenue += item.total;
    });
  });
  return Object.values(productMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

/** Top customers by spend (bill value), Reports card wala calculation */
export function computeTopCustomers(sales: Sale[], customers: Customer[], limit = 5): TopCustomer[] {
  const spendMap: Record<string, TopCustomer> = {};
  sales.forEach((sale) => {
    const key = sale.customerId || sale.customerName;
    if (!key) return;
    const name = sale.customerName || customers.find((c) => c.id === sale.customerId)?.name || key;
    if (!spendMap[key]) spendMap[key] = { name, total: 0, count: 0 };
    spendMap[key].total += sale.total;
    spendMap[key].count += 1;
  });
  return Object.values(spendMap)
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

/** Baaki udhaar wale customers (khata) — sabse zyada baaki pehle */
export function computeTopDues(customers: Customer[], limit = 5): Array<{ name: string; totalDue: number }> {
  return customers
    .filter((c) => c.totalDue > 0)
    .sort((a, b) => b.totalDue - a.totalDue)
    .slice(0, limit)
    .map((c) => ({ name: c.name, totalDue: c.totalDue }));
}

export interface DukaanSummary {
  today: { bills: number; revenue: number; cash: number; udhaar: number };
  allTime: { bills: number; revenue: number; cash: number; udhaar: number };
  totalDue: number;
  dueCustomers: number;
  productCount: number;
  customerCount: number;
  lowStockCount: number;
  expiredCount: number;
  /** Reports card wali list — AI ka "sabse zyada bika" yahi se aana chahiye */
  topProducts: TopProduct[];
  topDues: Array<{ name: string; totalDue: number }>;
}

/**
 * Poore dukaan ka ready-made summary.
 * Isko AI prompt mein directly paste karte hain — model ko ginti nahi karni
 * parti, wo seedhe ye numbers use karta hai (aur Reports screen se match).
 */
export function computeSummary(
  sales: Sale[],
  customers: Customer[],
  products: Product[],
  today: string = new Date().toISOString().split('T')[0],
): DukaanSummary {
  const todaySales = sales.filter((s) => s.date === today);
  const sum = (list: Sale[], pick: (s: Sale) => number) => list.reduce((acc, s) => acc + pick(s), 0);

  const soonLimit = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
  const expiredCount = products.filter(
    (p) => p.expiryDate && p.expiryDate < today
  ).length;
  const expiringSoon = products.filter(
    (p) => p.expiryDate && p.expiryDate >= today && p.expiryDate <= soonLimit
  ).length;

  return {
    today: {
      bills: todaySales.length,
      revenue: sum(todaySales, (s) => s.total),
      cash: sum(todaySales, cashPart),
      udhaar: sum(todaySales, udhaarPart),
    },
    allTime: {
      bills: sales.length,
      revenue: sum(sales, (s) => s.total),
      cash: sum(sales, cashPart),
      udhaar: sum(sales, udhaarPart),
    },
    totalDue: customers.reduce((s, c) => s + Math.max(0, c.totalDue), 0),
    dueCustomers: customers.filter((c) => c.totalDue > 0).length,
    productCount: products.length,
    customerCount: customers.length,
    lowStockCount: products.filter((p) => p.stock <= p.minStock).length,
    expiredCount: expiredCount + expiringSoon,
    topProducts: computeTopProducts(sales, 5),
    topDues: computeTopDues(customers, 5),
  };
}

/** Purchase count — "kitni kharid hui" jaise sawaalon ke liye */
export function computePurchaseCount(purchases: Purchase[] | undefined, today: string): number {
  return (purchases ?? []).filter((p) => p.date === today).length;
}
