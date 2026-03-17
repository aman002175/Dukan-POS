// Dukaan POS - Type Definitions

// Business Profile
export interface BusinessProfile {
  shopName: string;
  ownerName: string;
  phone: string;
  address: string;
}

// Product/Inventory
export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  salePrice: number;
  costPrice: number;
  stock: number;
  minStock: number;
  unit: string;
  createdAt: number;
  updatedAt: number;
}

// Cart Item
export interface CartItem {
  product: Product;
  quantity: number;
}

// Draft Bill
export interface DraftBill {
  id: string;
  items: CartItem[];
  createdAt: number;
  customerName?: string;
}

// Sale/Bill
export type SaleType = 'cash' | 'udhaar';

export interface SaleItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  total: number;
}

export interface Sale {
  id: string;
  items: SaleItem[];
  total: number;
  type: SaleType;
  customerId?: string;
  customerName?: string;
  createdAt: number;
  date: string;
  time: string;
}

// Customer
export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  totalDue: number;
  createdAt: number;
}

// Transaction (for Khata)
export type TransactionType = 'sale' | 'payment';

export interface Transaction {
  id: string;
  customerId: string;
  type: TransactionType;
  amount: number;
  description: string;
  saleId?: string;
  createdAt: number;
  date: string;
  time: string;
}

// App State
export interface AppState {
  businessProfile: BusinessProfile;
  products: Product[];
  customers: Customer[];
  sales: Sale[];
  transactions: Transaction[];
  drafts: DraftBill[];
  syncCode: string | null;
  lastSync: number | null;
}

// Master Product Database (for suggestions)
export interface MasterProduct {
  name: string;
  category: string;
  suggestedPrice: number;
  unit: string;
}

// Calculator State
export interface CalculatorState {
  cartTotal: number;
  amountPaid: number;
  oneKgRate: number;
  amountPaidForWeight: number;
  gramsAsked: number;
}

// Navigation
export type TabType = 'pos' | 'inventory' | 'khata' | 'reports' | 'settings';

// Toast Notification
export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}
