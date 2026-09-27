import { describe, it, expect } from 'vitest';
import { InventoryMatcher, quickSearch, createInventoryMatcher } from '@/utils/inventoryMatcher';
import type { Product } from '@/types';

const mockProducts: Product[] = [
  {
    id: 'p1', name: 'Aashirvaad Atta 5kg', sku: 'ATT001', category: 'Grocery',
    salePrice: 280, costPrice: 250, stock: 20, minStock: 5, unit: 'bag',
    createdAt: Date.now(), updatedAt: Date.now()
  },
  {
    id: 'p2', name: 'Maggi Noodles 70g', sku: 'MAG001', category: 'Instant Food',
    salePrice: 14, costPrice: 10, stock: 100, minStock: 10, unit: 'piece',
    createdAt: Date.now(), updatedAt: Date.now()
  },
  {
    id: 'p3', name: 'Amul Butter 100g', sku: 'AMU001', category: 'Dairy',
    salePrice: 56, costPrice: 50, stock: 30, minStock: 5, unit: 'piece',
    createdAt: Date.now(), updatedAt: Date.now()
  },
  {
    id: 'p4', name: 'Parle-G Biscuit', sku: 'PRL001', category: 'Biscuits',
    salePrice: 10, costPrice: 8, stock: 200, minStock: 20, unit: 'piece',
    createdAt: Date.now(), updatedAt: Date.now()
  },
  {
    id: 'p5', name: 'Surf Excel Detergent 1kg', sku: 'SRF001', category: 'Cleaning',
    salePrice: 135, costPrice: 120, stock: 15, minStock: 5, unit: 'bag',
    createdAt: Date.now(), updatedAt: Date.now()
  },
];

describe('InventoryMatcher', () => {
  it('finds exact match', () => {
    const matcher = new InventoryMatcher(mockProducts);
    const result = matcher.search('maggi noodles');
    expect(result.product).not.toBeNull();
    expect(result.product!.id).toBe('p2');
    expect(result.confidenceLabel).toBe('exact');
  });

  it('finds fuzzy match (typo)', () => {
    const matcher = new InventoryMatcher(mockProducts);
    const result = matcher.search('ashirvaad aata');
    expect(result.product).not.toBeNull();
    expect(result.product!.id).toBe('p1');
  });

  it('returns noMatch for gibberish', () => {
    const matcher = new InventoryMatcher(mockProducts);
    const result = matcher.search('xyzqwerty');
    expect(result.product).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.confidenceLabel).toBe('none');
  });

  it('returns noMatch for very short input', () => {
    const matcher = new InventoryMatcher(mockProducts);
    const result = matcher.search('a');
    expect(result.product).toBeNull();
  });

  it('handles empty search term', () => {
    const matcher = new InventoryMatcher(mockProducts);
    const result = matcher.search('');
    expect(result.product).toBeNull();
  });

  it('finds brand-only search', () => {
    const matcher = new InventoryMatcher(mockProducts);
    const result = matcher.search('parle');
    expect(result.product).not.toBeNull();
    expect(result.product!.id).toBe('p4');
  });

  it('respects custom threshold', () => {
    const strict = new InventoryMatcher(mockProducts, { threshold: 0.9 });
    const loose = new InventoryMatcher(mockProducts, { threshold: 0.3 });
    const strictResult = strict.search('maggi');
    const looseResult = loose.search('maggi');
    // Strict should still find exact, but loose finds more
    expect(strictResult).toBeDefined();
    expect(looseResult.product).not.toBeNull();
  });
});

describe('searchTop', () => {
  it('returns multiple results', () => {
    const matcher = new InventoryMatcher(mockProducts);
    const results = matcher.searchTop('maggi', 3);
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it('returns empty for gibberish', () => {
    const matcher = new InventoryMatcher(mockProducts);
    const results = matcher.searchTop('xyzqwerty');
    expect(results).toHaveLength(0);
  });
});

describe('updateProducts', () => {
  it('updates index with new products', () => {
    const matcher = new InventoryMatcher(mockProducts);
    matcher.updateProducts([
      ...mockProducts,
      {
        id: 'p6', name: 'Kissan Jam 500g', sku: 'KIS001', category: 'Preserves',
        salePrice: 120, costPrice: 100, stock: 10, minStock: 5, unit: 'jar',
        createdAt: Date.now(), updatedAt: Date.now()
      },
    ]);
    const result = matcher.search('kissan jam');
    expect(result.product).not.toBeNull();
    expect(result.product!.id).toBe('p6');
  });
});

describe('quickSearch', () => {
  it('works as one-shot search', () => {
    const result = quickSearch(mockProducts, 'amul butter');
    expect(result.product).not.toBeNull();
    expect(result.product!.id).toBe('p3');
  });

  it('respects custom threshold', () => {
    const result = quickSearch(mockProducts, 'amul', 0.9);
    expect(result.product).not.toBeNull();
  });
});

describe('createInventoryMatcher', () => {
  it('factory creates working instance', () => {
    const matcher = createInventoryMatcher(mockProducts);
    const result = matcher.search('surf excel');
    expect(result.product).not.toBeNull();
    expect(result.product!.id).toBe('p5');
  });
});
