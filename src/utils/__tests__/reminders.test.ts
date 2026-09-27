import { describe, it, expect } from 'vitest';
import {
  buildDueReminderMessage,
  buildAllDuesMessage,
  buildSupplierOrderMessage,
  waLink,
  suggestOrderQty,
  expiryStatus,
} from '@/utils/reminders';

describe('reminders — message builders', () => {
  it('builds takaza message with name, due, shop', () => {
    const msg = buildDueReminderMessage('Raju', 500, 'Sharma Store');
    expect(msg).toContain('Raju');
    expect(msg).toContain('₹500.00');
    expect(msg).toContain('Sharma Store');
  });

  it('builds combined dues list with total', () => {
    const msg = buildAllDuesMessage(
      [{ name: 'Raju', due: 500 }, { name: 'Mohan', due: 300 }],
      'Sharma Store'
    );
    expect(msg).toContain('Raju — ₹500.00');
    expect(msg).toContain('Kul Baki: *₹800.00*');
  });

  it('builds supplier order message', () => {
    const msg = buildSupplierOrderMessage(
      [{ name: 'Chini', stock: 2, unit: 'kg', suggestQty: 10 }],
      'Sharma Store'
    );
    expect(msg).toContain('Chini — 10 kg');
  });

  it('waLink normalizes +91/spaces/dashes, rejects short numbers', () => {
    expect(waLink('+91 98765-43210', 'hi')).toBe(
      `https://wa.me/919876543210?text=${encodeURIComponent('hi')}`
    );
    expect(waLink('9876543210', 'hi')).toContain('wa.me/919876543210');
    expect(waLink('123', 'hi')).toBeNull();
    expect(waLink('', 'hi')).toBeNull();
    expect(waLink(undefined, 'hi')).toBeNull();
  });

  it('suggestOrderQty covers shortage + buffer', () => {
    expect(suggestOrderQty({ stock: 2, minStock: 10 })).toBeGreaterThanOrEqual(8);
    expect(suggestOrderQty({ stock: 50, minStock: 10 })).toBeGreaterThanOrEqual(1);
  });

  it('expiryStatus classifies dates', () => {
    expect(expiryStatus(undefined)).toBe('none');
    expect(expiryStatus('2020-01-01')).toBe('expired');
    const soon = new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0];
    expect(expiryStatus(soon)).toBe('soon');
    const far = new Date(Date.now() + 100 * 86400000).toISOString().split('T')[0];
    expect(expiryStatus(far)).toBe('ok');
  });
});
