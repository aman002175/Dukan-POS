import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizeBarcode, lookupBarcode } from '@/utils/productLookup';

describe('productLookup', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('normalizeBarcode keeps digits only', () => {
    expect(normalizeBarcode('890 1058-0176 87')).toBe('8901058017687');
    expect(normalizeBarcode('  123abc  ')).toBe('123');
  });

  it('returns null for invalid barcode length', async () => {
    await expect(lookupBarcode('123')).resolves.toBeNull();
    await expect(lookupBarcode('123456789012345678')).resolves.toBeNull();
  });

  it('parses OpenFoodFacts product response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 1,
        product: {
          product_name: 'maggi',
          brands: 'Maggi, Nestle',
          quantity: '75',
          image_url: 'https://example.com/img.jpg',
        },
      }),
    } as unknown as Response);

    const res = await lookupBarcode('8901058017687');
    expect(res).toMatchObject({
      name: 'Maggi',
      brand: 'Maggi',
      quantity: '75',
      barcode: '8901058017687',
    });
  });

  it('returns null when product not found (status 0)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 0 }),
    } as unknown as Response);
    await expect(lookupBarcode('8901058017687')).resolves.toBeNull();
  });

  it('returns null on network failure (offline-safe)', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline'));
    await expect(lookupBarcode('8901058017687')).resolves.toBeNull();
  });
});
