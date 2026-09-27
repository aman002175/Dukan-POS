import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveAppState,
  loadAppState,
  defaultAppState,
  addProduct,
  updateProduct,
  deleteProduct,
  addCustomer,
  updateCustomer,
  deleteCustomer,
  addSale,
  addTransaction,
  addDraft,
  deleteDraft,
  updateSyncCode,
  exportData,
  importData,
  resetAllData,
  generateId,
  formatCurrency,
  formatDate,
  formatTime,
  upsertRegularCustomer,
  deleteRegularCustomer,
} from '@/utils/storage';
import type { Product, Customer, Sale, Transaction, DraftBill, RegularCustomer } from '@/types';

function cleanState() {
  saveAppState(defaultAppState);
}

beforeEach(() => {
  cleanState();
});

describe('saveAppState / loadAppState', () => {
  it('returns default state when localStorage is empty', () => {
    const state = loadAppState();
    expect(state).toEqual(defaultAppState);
  });

  it('round-trips save and load correctly', () => {
    const state = { ...defaultAppState, billCounter: 42 };
    saveAppState(state);
    const loaded = loadAppState();
    expect(loaded.billCounter).toBe(42);
  });

  it('merges with defaults on load (partial data)', () => {
    localStorage.setItem('dukaan_pos_data', JSON.stringify({ billCounter: 5 }));
    const loaded = loadAppState();
    expect(loaded.billCounter).toBe(5);
    expect(loaded.products).toEqual([]);
    expect(loaded.businessProfile.shopName).toBe('My Kirana Store');
  });
});

describe('Product helpers', () => {
  const product: Product = {
    id: 'p1',
    name: 'Maggi',
    sku: 'MAG001',
    category: 'Instant Food',
    salePrice: 14,
    costPrice: 10,
    stock: 50,
    minStock: 5,
    unit: 'piece',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  it('addProduct adds to state', () => {
    addProduct(product);
    const state = loadAppState();
    expect(state.products).toHaveLength(1);
    expect(state.products[0].name).toBe('Maggi');
  });

  it('updateProduct updates existing product', () => {
    addProduct(product);
    updateProduct({ ...product, salePrice: 15 });
    const state = loadAppState();
    expect(state.products[0].salePrice).toBe(15);
  });

  it('deleteProduct removes product', () => {
    addProduct(product);
    deleteProduct('p1');
    const state = loadAppState();
    expect(state.products).toHaveLength(0);
  });
});

describe('Customer helpers', () => {
  const customer: Customer = {
    id: 'c1',
    name: 'Ramesh',
    phone: '9876543210',
    address: 'Delhi',
    totalDue: 0,
    createdAt: Date.now(),
  };

  it('addCustomer adds to state', () => {
    addCustomer(customer);
    const state = loadAppState();
    expect(state.customers).toHaveLength(1);
    expect(state.customers[0].name).toBe('Ramesh');
  });

  it('updateCustomer updates existing customer', () => {
    addCustomer(customer);
    updateCustomer({ ...customer, phone: '1111111111' });
    const state = loadAppState();
    expect(state.customers[0].phone).toBe('1111111111');
  });

  it('deleteCustomer removes customer', () => {
    addCustomer(customer);
    deleteCustomer('c1');
    const state = loadAppState();
    expect(state.customers).toHaveLength(0);
  });
});

describe('Sale / Transaction / Draft helpers', () => {
  const sale: Sale = {
    id: 's1',
    date: '2026-01-01',
    time: '12:00 PM',
    items: [],
    total: 100,
    type: 'cash',
    createdAt: Date.now(),
  };

  const transaction: Transaction = {
    id: 't1',
    customerId: 'c1',
    date: '2026-01-01',
    time: '12:00 PM',
    amount: 500,
    type: 'sale',
    description: 'Udhaar',
    createdAt: Date.now(),
  };

  const draft: DraftBill = {
    id: 'd1',
    items: [],
    createdAt: Date.now(),
  };

  it('addSale adds sale', () => {
    addSale(sale);
    const state = loadAppState();
    expect(state.sales).toHaveLength(1);
    expect(state.sales[0].total).toBe(100);
  });

  it('addTransaction adds transaction', () => {
    addTransaction(transaction);
    const state = loadAppState();
    expect(state.transactions).toHaveLength(1);
    expect(state.transactions[0].type).toBe('sale');
  });

  it('addDraft and deleteDraft work', () => {
    addDraft(draft);
    expect(loadAppState().drafts).toHaveLength(1);
    deleteDraft('d1');
    expect(loadAppState().drafts).toHaveLength(0);
  });
});

describe('RegularCustomer helpers', () => {
  const rc: RegularCustomer = {
    id: 'rc1',
    name: 'Suresh',
    phone: '9999999999',
    address: 'Mumbai',
    loyaltyPoints: 100,
    createdAt: Date.now(),
  };

  it('upsertRegularCustomer adds new', () => {
    upsertRegularCustomer(rc);
    const state = loadAppState();
    expect(state.regularCustomers).toHaveLength(1);
  });

  it('upsertRegularCustomer updates existing', () => {
    upsertRegularCustomer(rc);
    upsertRegularCustomer({ ...rc, loyaltyPoints: 200 });
    const state = loadAppState();
    expect(state.regularCustomers[0].loyaltyPoints).toBe(200);
    expect(state.regularCustomers).toHaveLength(1);
  });

  it('deleteRegularCustomer removes', () => {
    upsertRegularCustomer(rc);
    deleteRegularCustomer('rc1');
    expect(loadAppState().regularCustomers).toHaveLength(0);
  });
});

describe('updateSyncCode', () => {
  it('sets syncCode and lastSync', () => {
    updateSyncCode('ABC123');
    const state = loadAppState();
    expect(state.syncCode).toBe('ABC123');
    expect(state.lastSync).toBeGreaterThan(0);
  });
});

describe('exportData / importData', () => {
  it('exportData returns valid JSON', () => {
    cleanState();
    addProduct({
      id: 'p1', name: 'Test', sku: 'T001', category: 'Test',
      salePrice: 10, costPrice: 8, stock: 5, minStock: 2, unit: 'piece',
      createdAt: Date.now(), updatedAt: Date.now(),
    });
    const json = exportData();
    const parsed = JSON.parse(json);
    expect(parsed.products).toHaveLength(1);
  });

  it('importData loads valid JSON', () => {
    const json = JSON.stringify({ billCounter: 99 });
    const result = importData(json);
    expect(result).toBe(true);
    expect(loadAppState().billCounter).toBe(99);
  });

  it('importData returns false for invalid JSON', () => {
    const result = importData('not json');
    expect(result).toBe(false);
  });
});

describe('resetAllData', () => {
  it('clears localStorage', () => {
    cleanState();
    addProduct({
      id: 'p1', name: 'X', sku: '', category: '',
      salePrice: 1, costPrice: 1, stock: 1, minStock: 1, unit: 'piece',
      createdAt: Date.now(), updatedAt: Date.now(),
    });
    expect(loadAppState().products).toHaveLength(1);
    resetAllData();
    const state = loadAppState();
    expect(state.products).toHaveLength(0);
  });
});

describe('Utility functions', () => {
  it('generateId returns unique strings', () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(id1).not.toBe(id2);
  });

  it('formatCurrency formats correctly', () => {
    expect(formatCurrency(100)).toBe('₹100.00');
    expect(formatCurrency(0)).toBe('₹0.00');
    expect(formatCurrency(99.9)).toBe('₹99.90');
  });

  it('formatDate returns a string', () => {
    const result = formatDate(Date.now());
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('formatTime returns a string', () => {
    const result = formatTime(Date.now());
    expect(typeof result).toBe('string');
  });
});
