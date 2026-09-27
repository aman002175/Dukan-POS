import { describe, it, expect } from 'vitest';
import { buildCustomerLedger, computeBillSnapshot } from '../ledger';
import type { Sale, Transaction } from '@/types';

let idCounter = 0;
function mkSale(partial: Partial<Sale> & { total: number }): Sale {
  idCounter += 1;
  return {
    id: `sale-${idCounter}`,
    items: [{ productId: 'p1', name: 'Aata', price: partial.total, quantity: 1, total: partial.total }],
    type: 'udhaar',
    createdAt: 0,
    date: '2026-01-01',
    time: '10:00',
    ...partial,
  };
}

let txnCounter = 0;
function mkPayment(amount: number, createdAt = 0): Transaction {
  txnCounter += 1;
  return {
    id: `txn-${txnCounter}`,
    customerId: 'c1',
    type: 'payment',
    amount,
    description: 'Payment',
    createdAt,
    date: '2026-01-01',
    time: '10:00',
  };
}

describe('ledger — global net balance', () => {
  it('Aadity case: udhaar 1115, paid 1515 → advance ₹400 (not ₹0)', () => {
    const ledger = buildCustomerLedger(
      [mkSale({ total: 1115 })],
      [mkPayment(1515)]
    );
    expect(ledger.totalUdhaar).toBe(1115);
    expect(ledger.totalPaid).toBe(1515);
    expect(ledger.net).toBe(400); // advance
    expect(ledger.rows[ledger.rows.length - 1].balanceAfter).toBe(-400);
  });

  it('Pankaj case: udhaar 835, paid 1735 → advance ₹900 (no fake Balance ₹100)', () => {
    const ledger = buildCustomerLedger(
      [mkSale({ total: 835 })],
      [mkPayment(1735)]
    );
    expect(ledger.net).toBe(900);
    expect(ledger.rows[ledger.rows.length - 1].balanceAfter).toBe(-900);
  });

  it('due case: udhaar 1000, paid 300 → baaki ₹700', () => {
    const ledger = buildCustomerLedger(
      [mkSale({ total: 1000 })],
      [mkPayment(300)]
    );
    expect(ledger.net).toBe(-700);
    expect(ledger.rows[ledger.rows.length - 1].balanceAfter).toBe(700);
  });

  it('cash bills khate ko touch nahi karte', () => {
    const ledger = buildCustomerLedger(
      [mkSale({ total: 500, type: 'cash' })],
      []
    );
    expect(ledger.totalUdhaar).toBe(0);
    expect(ledger.net).toBe(0);
  });

  it('split bill: sirf baaki hissa khate mein aata hai', () => {
    const ledger = buildCustomerLedger(
      [mkSale({ total: 1000, type: 'split', amountPaid: 400 })],
      []
    );
    expect(ledger.totalUdhaar).toBe(600);
  });

  it('interleaved history ke saath running balance sahi chalta hai', () => {
    // bill 500 → pay 800 (adv 300) → bill 200 (advance se 200 kata → −100) → bill 300 (+200 due)
    const ledger = buildCustomerLedger(
      [
        mkSale({ total: 500, createdAt: 1 }),
        mkSale({ total: 200, createdAt: 3 }),
        mkSale({ total: 300, createdAt: 4 }),
      ],
      [mkPayment(800, 2)]
    );
    expect(ledger.rows.map(r => r.balanceAfter)).toEqual([500, -300, -100, 200]);
    expect(ledger.net).toBe(-200); // 800 paid − 1000 billed
  });
});

describe('ledger — per-bill historical snapshot (time-travel fix)', () => {
  it('purana bill us waqt ka balance dikhata hai, aaj ka nahi', () => {
    // Day 1: bill 1000. Day 2: pay 500. Day 3: bill 300.
    const ledger = buildCustomerLedger(
      [
        mkSale({ total: 1000, createdAt: 1 }),
        mkSale({ total: 300, createdAt: 3 }),
      ],
      [mkPayment(500, 2)]
    );

    // rows chronological hain — rows[0] = pehla (1000 wala) bill
    const snapOld = computeBillSnapshot(ledger.rows[0].sale!, ledger);
    // Pehle bill se pehle balance 0 tha — purana baki 0, na ki aaj ka
    expect(snapOld.balanceBefore).toBe(0);
    expect(snapOld.puranaBaki).toBe(0);
    expect(snapOld.udhaarRemaining).toBe(1000);

    const snapNew = computeBillSnapshot(ledger.rows[2].sale!, ledger); // rows[1] = payment row
    // Naye bill se pehle 500 udhaar tha (1000 − 500 payment)
    expect(snapNew.balanceBefore).toBe(500);
    expect(snapNew.puranaBaki).toBe(500);
    expect(snapNew.udhaarRemaining).toBe(300);
    expect(snapNew.totalDueAtBillTime).toBe(800);
  });

  it('advance bill ke waqt ka historical advance use hota hai, aaj ka nahi', () => {
    // Pay 460 advance FIRST, then bill 300 → snapshot: advance 460 available on that date
    const bill = mkSale({ total: 300, createdAt: 2 });
    const ledger = buildCustomerLedger([bill], [mkPayment(460, 1)]);
    const snap = computeBillSnapshot(bill, ledger);
    expect(snap.balanceBefore).toBe(-460);
    expect(snap.advanceAvailable).toBe(460);
    expect(snap.advanceUsed).toBe(300);
    expect(snap.netPayable).toBe(0);
    expect(snap.udhaarRemaining).toBe(0);
    expect(snap.totalDueAtBillTime).toBe(0);
  });

  it('unknown sale (legacy) par advanceBeforeBill fallback', () => {
    const legacy = mkSale({ total: 200, createdAt: 99, advanceBeforeBill: -150 });
    const ledger = buildCustomerLedger([], []);
    const snap = computeBillSnapshot(legacy, ledger);
    expect(snap.balanceBefore).toBe(-150);
    expect(snap.advanceAvailable).toBe(150);
  });

  it('Ram BILL-0016 case: aaj ka advance ₹460 purane bill mein inject nahi hoga', () => {
    // Bill-0016 pehle bana (advance ZERO tha us waqt), payment baad mein aaya
    const oldBill = mkSale({ total: 400, createdAt: 1, billNumber: 'BILL-0016' });
    const payment = mkPayment(460, 2);
    const ledger = buildCustomerLedger([oldBill], [payment]);

    const snap = computeBillSnapshot(oldBill, ledger);
    // Us bill ke waqt advance 0 hi tha — 460 aaj ka hai
    expect(snap.advanceAvailable).toBe(0);
    expect(snap.puranaBaki).toBe(0);
    expect(snap.udhaarRemaining).toBe(400);
  });
});
