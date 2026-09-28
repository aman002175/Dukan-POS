// LocalStorage Utility for Offline Persistence
//
// 🔐 NAMESPACE PATTERN: keys ab user se baandhi hain (`dukaan_pos_data_<userId>`).
// Ye file kahin bhi `localStorage.setItem` seedha call NAHI karti — sab
// NamespacedStorage wrapper ke through jaata hai, taaki koi bhi naya call-site
// galti se global key na likhe. Details: src/lib/namespacedStorage.ts
import type { AppState, BusinessProfile, Product, Customer, RegularCustomer, Sale, Transaction, DraftBill, CartItem } from '@/types';
import { NamespacedStorage } from '@/lib/namespacedStorage';

const STORAGE_KEY = 'dukaan_pos_data';
const CART_STORAGE_KEY = 'dukaan_pos_cart';

export function saveCart(cart: CartItem[]): void {
  NamespacedStorage.set(CART_STORAGE_KEY, cart);
}

export function loadCart(): CartItem[] {
  return NamespacedStorage.get<CartItem[]>(CART_STORAGE_KEY, []);
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
  NamespacedStorage.set(STORAGE_KEY, state);
}

// Load entire app state from LocalStorage (active user ke namespace se)
export function loadAppState(): AppState {
  try {
    const parsed = NamespacedStorage.get<Partial<AppState> | null>(STORAGE_KEY, null);
    if (parsed) {
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

// Reset all data (sirf active user ka — doosre users ka data chhua nahi jaata)
export function resetAllData(): void {
  NamespacedStorage.remove(STORAGE_KEY);
  NamespacedStorage.remove(CART_STORAGE_KEY);
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
