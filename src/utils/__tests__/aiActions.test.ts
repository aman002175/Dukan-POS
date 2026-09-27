import { describe, it, expect, beforeEach, vi } from 'vitest';
import { parseAIResponse } from '@/utils/aiService';
import { dispatchAIActionEvents } from '@/utils/aiActions';

describe('parseAIResponse — Mercury output hardening', () => {
  it('parses normal <action> JSON + clean answer', () => {
    const res = parseAIResponse(
      'Chini add ho gayi! <action>{"type":"add_product","productName":"Chini","salePrice":50,"stock":50,"unit":"kg"}</action>'
    );
    expect(res.action).toMatchObject({
      type: 'add_product', productName: 'Chini', stock: 50,
    });
    expect(res.answer).toBe('Chini add ho gayi!');
  });

  it('unwraps markdown code fences around action JSON', () => {
    const res = parseAIResponse(
      'Ho gaya!\n```json\n<action>{"type":"add_to_cart","items":[{"productName":"Maggi","productId":"p1","quantity":2}]}</action>\n```'
    );
    expect(res.action).toMatchObject({ type: 'add_to_cart' });
    expect(res.answer).not.toContain('```');
  });

  it('strips <think> blocks and still parses action', () => {
    const res = parseAIResponse(
      '<think>user wants chini added, need add_product action</think>Done hai! <action>{"type":"update_stock","productId":"p1","productName":"Chini","newStock":200}</action>'
    );
    expect(res.action).toMatchObject({ type: 'update_stock' });
    expect(res.answer).not.toContain('<think>');
  });

  it('returns none action for plain chat text', () => {
    const res = parseAIResponse('Aaj ki bikri ₹500 hui hai.');
    expect(res.action?.type).toBe('none');
    expect(res.answer).toBe('Aaj ki bikri ₹500 hui hai.');
  });

  it('returns none action for invalid JSON', () => {
    const res = parseAIResponse('Sorry <action>{not valid json</action>');
    expect(res.action?.type).toBe('none');
  });
});

describe('dispatchAIActionEvents — shared dispatcher', () => {
  let dispatched: Array<{ name: string; detail: unknown }>;

  beforeEach(() => {
    dispatched = [];
    vi.stubGlobal('window', undefined as never);
    (globalThis as unknown as { window: object }).window = {
      dispatchEvent: (e: Event) => {
        dispatched.push({ name: e.type, detail: (e as CustomEvent).detail });
        return true;
      },
    } as unknown as Window & typeof globalThis;
  });

  it('dispatches ai-add-product for add_product (the screenshot bug)', () => {
    const ok = dispatchAIActionEvents({
      type: 'add_product', productName: 'Chini', salePrice: 50, stock: 50, unit: 'kg',
    });
    expect(ok).toBe(true);
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].name).toBe('ai-add-product');
    expect((dispatched[0].detail as { productName: string }).productName).toBe('Chini');
  });

  it('dispatches one ai-add-to-cart per item WITH productName', () => {
    const ok = dispatchAIActionEvents({
      type: 'add_to_cart',
      items: [
        { productName: 'Maggi', productId: 'p1', quantity: 2 },
        { productName: 'Chini', productId: 'p2', quantity: 1 },
      ],
    });
    expect(ok).toBe(true);
    expect(dispatched).toHaveLength(2);
    expect(dispatched.every(d => d.name === 'ai-add-to-cart')).toBe(true);
    expect((dispatched[0].detail as { productName: string }).productName).toBe('Maggi');
    expect((dispatched[1].detail as { productName: string }).productName).toBe('Chini');
  });

  it('dispatches ai-record-bill for record_udhaar with customer', () => {
    const ok = dispatchAIActionEvents({
      type: 'record_udhaar', items: [], customerId: 'c1', customerName: 'Raju', total: 280,
    });
    expect(ok).toBe(true);
    expect(dispatched[0].name).toBe('ai-record-bill');
    expect((dispatched[0].detail as { type: string }).type).toBe('udhaar');
  });

  it('covers all mutation types', () => {
    const cases = [
      [{ type: 'record_cash', items: [], total: 100 }, 'ai-record-bill'],
      [{ type: 'record_payment', customerId: 'c1', customerName: 'R', amount: 50 }, 'ai-record-payment'],
      [{ type: 'record_purchase', items: [{ productName: 'Chini', productId: 'p1', quantity: 50, purchasePrice: 40 }] }, 'ai-record-purchase'],
      [{ type: 'edit_product', productId: 'p1', productName: 'M', changes: {} }, 'ai-edit-product'],
      [{ type: 'delete_product', productId: 'p1', productName: 'M' }, 'ai-delete-product'],
      [{ type: 'update_stock', productId: 'p1', productName: 'M', newStock: 5 }, 'ai-update-stock'],
      [{ type: 'add_customer', customerName: 'R' }, 'ai-add-customer'],
      [{ type: 'edit_customer', customerId: 'c1', customerName: 'R', changes: {} }, 'ai-edit-customer'],
      [{ type: 'delete_customer', customerId: 'c1', customerName: 'R' }, 'ai-delete-customer'],
      [{ type: 'bulk_import', items: [] }, 'ai-bulk-import'],
      [{ type: 'delete_sale', saleId: 's1', billNumber: 'BILL-1' }, 'ai-delete-sale'],
    ] as const;
    for (const [action, eventName] of cases) {
      dispatched = [];
      expect(dispatchAIActionEvents(action as never)).toBe(true);
      expect(dispatched[0]?.name).toBe(eventName);
    }
  });

  it('navigates tabs for read-only actions', () => {
    expect(dispatchAIActionEvents({ type: 'show_report', reportType: 'daily' })).toBe(true);
    expect(dispatched[0].name).toBe('ai-switch-tab');
  });

  it('returns false for none/clarify/info actions', () => {
    expect(dispatchAIActionEvents({ type: 'none' })).toBe(false);
    expect(dispatchAIActionEvents(undefined)).toBe(false);
    expect(dispatched).toHaveLength(0);
  });
});
