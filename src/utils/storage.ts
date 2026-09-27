// LocalStorage Utility for Offline Persistence
import type { AppState, BusinessProfile, Product, Customer, RegularCustomer, Sale, Transaction, DraftBill, CartItem } from '@/types';

const STORAGE_KEY = 'dukaan_pos_data';
const CART_STORAGE_KEY = 'dukaan_pos_cart';

export function saveCart(cart: CartItem[]): void {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch (error) {
    console.error('Error saving cart to LocalStorage:', error);
  }
}

export function loadCart(): CartItem[] {
  try {
    const data = localStorage.getItem(CART_STORAGE_KEY);
    if (data) return JSON.parse(data);
  } catch (error) {
    console.error('Error loading cart from LocalStorage:', error);
  }
  return [];
}


export const defaultBusinessProfile: BusinessProfile = {
  shopName: 'My Kirana Store',
  ownerName: '',
  phone: '',
  address: '',
  upiId: '',
  festivalMsg: '',
};

export const defaultAppState: AppState = {
  businessProfile: defaultBusinessProfile,
  products: [],
  customers: [],
  regularCustomers: [],
  sales: [],
  transactions: [],
  drafts: [],
  appPin: null,
  billCounter: 1,
  purchases: [],
  returns: [],
};

// Save entire app state to LocalStorage
export function saveAppState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Error saving to LocalStorage:', error);
  }
}

// Load entire app state from LocalStorage
export function loadAppState(): AppState {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      return {
        ...defaultAppState,
        ...parsed,
        businessProfile: {
          ...defaultBusinessProfile,
          ...(parsed.businessProfile || {}),
        },
        regularCustomers: parsed.regularCustomers || [],
      };
    }
  } catch (error) {
    console.error('Error loading from LocalStorage:', error);
  }
  return defaultAppState;
}

// Partial updates
export function updateBusinessProfile(profile: BusinessProfile): void {
  const state = loadAppState();
  state.businessProfile = profile;
  saveAppState(state);
}

export function addProduct(product: Product): void {
  const state = loadAppState();
  state.products.push(product);
  saveAppState(state);
}

export function updateProduct(updatedProduct: Product): void {
  const state = loadAppState();
  const index = state.products.findIndex(p => p.id === updatedProduct.id);
  if (index !== -1) {
    state.products[index] = updatedProduct;
    saveAppState(state);
  }
}

export function deleteProduct(productId: string): void {
  const state = loadAppState();
  state.products = state.products.filter(p => p.id !== productId);
  saveAppState(state);
}

export function addCustomer(customer: Customer): void {
  const state = loadAppState();
  state.customers.push(customer);
  saveAppState(state);
}

export function updateCustomer(updatedCustomer: Customer): void {
  const state = loadAppState();
  const index = state.customers.findIndex(c => c.id === updatedCustomer.id);
  if (index !== -1) {
    state.customers[index] = updatedCustomer;
    saveAppState(state);
  }
}

export function deleteCustomer(customerId: string): void {
  const state = loadAppState();
  state.customers = state.customers.filter(c => c.id !== customerId);
  saveAppState(state);
}

export function addSale(sale: Sale): void {
  const state = loadAppState();
  state.sales.push(sale);
  saveAppState(state);
}

export function deleteSale(saleId: string): void {
  const state = loadAppState();
  const sale = state.sales.find(s => s.id === saleId);
  if (!sale) return;

  // Restore stock
  state.products = state.products.map(p => {
    const item = sale.items.find(i => i.productId === p.id);
    if (item) return { ...p, stock: p.stock + item.quantity, updatedAt: Date.now() };
    return p;
  });

  // Revert customer due for udhaar AND split
  if ((sale.type === 'udhaar' || sale.type === 'split') && sale.customerId) {
    state.customers = state.customers.map(c => {
      if (c.id === sale.customerId) {
        const remainingDue = sale.total - (sale.amountPaid || 0);
        return { ...c, totalDue: Math.max(0, c.totalDue - remainingDue) };
      }
      return c;
    });
  }

  state.sales = state.sales.filter(s => s.id !== saleId);
  saveAppState(state);
}

export function addTransaction(transaction: Transaction): void {
  const state = loadAppState();
  state.transactions.push(transaction);
  saveAppState(state);
}

export function addDraft(draft: DraftBill): void {
  const state = loadAppState();
  state.drafts.push(draft);
  saveAppState(state);
}

export function deleteDraft(draftId: string): void {
  const state = loadAppState();
  state.drafts = state.drafts.filter(d => d.id !== draftId);
  saveAppState(state);
}

// Export data as JSON
export function exportData(): string {
  const state = loadAppState();
  return JSON.stringify(state, null, 2);
}

// Import data from JSON
export function importData(jsonString: string): boolean {
  try {
    const data = JSON.parse(jsonString);
    const newState: AppState = {
      ...defaultAppState,
      ...data,
      businessProfile: {
        ...defaultBusinessProfile,
        ...(data.businessProfile || {}),
      },
    };
    saveAppState(newState);
    return true;
  } catch (error) {
    console.error('Error importing data:', error);
    return false;
  }
}

// Reset all data
export function resetAllData(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// ── Regular Customer helpers ──
export function upsertRegularCustomer(rc: RegularCustomer): void {
  const state = loadAppState();
  const idx = state.regularCustomers.findIndex(c => c.id === rc.id);
  if (idx !== -1) {
    state.regularCustomers[idx] = rc;
  } else {
    state.regularCustomers.push(rc);
  }
  saveAppState(state);
}

export function deleteRegularCustomer(id: string): void {
  const state = loadAppState();
  state.regularCustomers = state.regularCustomers.filter(c => c.id !== id);
  saveAppState(state);
}

// Generate unique ID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Format currency
export function formatCurrency(amount: number): string {
  return `₹${amount.toFixed(2)}`;
}

// Format date
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// Format time
export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

// Get today's date string
export function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}
