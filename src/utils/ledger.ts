/**
 * ledger.ts — Khata (udhaar/advance) ka single source of truth.
 *
 * Problems ye solve karta hai:
 *  1. Global summary (Advance vs Udhaar) — net = totalPaid − totalUdhaar.
 *     Customer ne udhaar se zyada pay kiya to POSITIVE net = Advance.
 *  2. Historical "Purana Baki" — har bill ke waqt ka EXACT balance snapshot
 *     (running balance immediately BEFORE that bill).
 *  3. Time-travel bug khatam — aaj ka advance purane bills mein inject nahi hota,
 *     kyunki balance us bill se PEHLE ke entries se calculate hota hai.
 *
 * Model (sign convention):
 *   running balance > 0 → customer par udhaar baaki hai
 *   running balance < 0 → customer ne advance diya hua hai (|balance| = advance)
 *   running balance = 0 → hisaab clear
 */
import type { Sale } from '@/types';

export interface LedgerRow {
  id: string;
  kind: 'bill' | 'payment';
  createdAt: number;
  date: string;
  time: string;
  /** Bill ne khate mein kitna JODA (udhaar/split ka baaki hissa; cash bill = 0) */
  charge: number;
  /** Payment ne kitna GHATAAYA */
  paid: number;
  label: string;
  billNumber?: string;
  sale?: Sale;
  /** Is entry se PEHLE ka balance (historical snapshot) */
  balanceBefore: number;
  /** Is entry ke BAAD ka balance */
  balanceAfter: number;
}

export interface CustomerLedger {
  /** Oldest → newest (chronological) */
  rows: LedgerRow[];
  /** Kul udhaar liya gaya (sirf khate wala hissa — cash/split-ka-cash exclude) */
  totalUdhaar: number;
  /** Kul payment aayi */
  totalPaid: number;
  /** totalPaid − totalUdhaar. Positive = Advance, Negative = Udhaar Baaki */
  net: number;
}

/** Bill ka khata charge: total − (advance-used) − (bill ke waqt diya gaya cash) */
function billCharge(s: Sale): number {
  if (s.type === 'cash') return 0; // cash bill khate ko touch nahi karta
  return Math.max(0, s.total - (s.amountPaid || 0));
}

/** Ledger ke liye transaction ki minimal shape (Transaction se compatible) */
export interface LedgerTxnInput {
  id: string;
  type: string; // 'payment' hi gina jayega, baaki ignore
  amount: number;
  description?: string;
  createdAt: number;
  date: string;
  time: string;
}

/** Poori customer history → chronological ledger with running balances */
export function buildCustomerLedger(
  sales: Sale[],
  transactions: LedgerTxnInput[]
): CustomerLedger {
  type Raw = Omit<LedgerRow, 'balanceBefore' | 'balanceAfter'>;

  const raw: Raw[] = [
    ...sales
      .filter(s => s.type !== 'cash')
      .map<Raw>(s => ({
        id: s.id,
        kind: 'bill',
        createdAt: s.createdAt,
        date: s.date,
        time: s.time,
        charge: billCharge(s),
        paid: 0,
        label: s.items.length > 0
          ? `${s.items.length} item${s.items.length > 1 ? 's' : ''} — ${s.items.slice(0, 2).map(i => i.name).join(', ')}${s.items.length > 2 ? '…' : ''}`
          : 'Bill',
        billNumber: s.billNumber,
        sale: s,
      })),
    ...transactions
      .filter(t => t.type === 'payment')
      .map<Raw>(t => ({
        id: t.id,
        kind: 'payment',
        createdAt: t.createdAt,
        date: t.date,
        time: t.time,
        charge: 0,
        paid: t.amount,
        label: t.description || 'Payment',
      })),
  ];

  // Strictly oldest → newest (timestamp tie → bills pehle, fir payment)
  raw.sort((a, b) => a.createdAt - b.createdAt || (a.kind === 'bill' ? -1 : 1));

  let running = 0;
  let totalUdhaar = 0;
  let totalPaid = 0;
  const rows: LedgerRow[] = raw.map(e => {
    const balanceBefore = running;
    running += e.charge - e.paid;
    totalUdhaar += e.charge;
    totalPaid += e.paid;
    return { ...e, balanceBefore, balanceAfter: running };
  });

  return { rows, totalUdhaar, totalPaid, net: totalPaid - totalUdhaar };
}

/** Ek bill ka print/ receipt ke liye historical snapshot */
export interface BillSnapshot {
  /** Is bill se pehle ka balance (>0 = purana udhaar, <0 = advance tha) */
  balanceBefore: number;
  /** Purana Baki (sirf positive side) */
  puranaBaki: number;
  /** Is bill se pehle kitna advance jama tha */
  advanceAvailable: number;
  /** Is bill mein se kitna advance kata */
  advanceUsed: number;
  /** Advance kato ke baad bill ki net value */
  netPayable: number;
  /** Is bill ka abhi bhi unpaid udhaar hissa */
  udhaarRemaining: number;
  /** Bill ke turant baad ka total due (purana + is bill ka baki) */
  totalDueAtBillTime: number;
}

/**
 * Kisi ek bill ka snapshot ledger se nikaalo.
 * Agar bill ledger mein nahi mila (deleted/legacy) to sale ke apne
 * advanceBeforeBill snapshot se fallback — warna "no history" (0) par settle.
 */
export function computeBillSnapshot(sale: Sale, ledger: CustomerLedger): BillSnapshot {
  const row = ledger.rows.find(r => r.kind === 'bill' && r.sale?.id === sale.id);
  const balanceBefore = row
    ? row.balanceBefore
    : (sale.advanceBeforeBill !== undefined ? sale.advanceBeforeBill : 0);

  const puranaBaki = Math.max(0, balanceBefore);
  const advanceAvailable = balanceBefore < 0 ? Math.abs(balanceBefore) : 0;
  const advanceUsed = Math.min(advanceAvailable, sale.total);
  const netPayable = Math.max(0, sale.total - advanceUsed);
  const udhaarRemaining = sale.type === 'cash'
    ? 0
    : Math.max(0, netPayable - (sale.amountPaid || 0));
  const totalDueAtBillTime = puranaBaki + udhaarRemaining;

  return { balanceBefore, puranaBaki, advanceAvailable, advanceUsed, netPayable, udhaarRemaining, totalDueAtBillTime };
}

/** Convenience: customer ke saare sales + transactions se snapshot */
export function snapshotForSale(
  sale: Sale,
  customerSales: Sale[],
  customerTxns: Parameters<typeof buildCustomerLedger>[1]
): BillSnapshot {
  return computeBillSnapshot(sale, buildCustomerLedger(customerSales, customerTxns));
}
