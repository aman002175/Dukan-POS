// Dukaan POS - Type Definitions


// Business Profile
export interface BusinessProfile {
  shopName: string;
  ownerName: string;
  phone: string;
  address: string;
  gstin?: string;
  upiId?: string;          // ← UPI ID for QR code in bill
  festivalMsg?: string;    // ← Custom message on bill footer
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
  customerId?: string;
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
  billNumber?: string;
  items: SaleItem[];
  total: number;
  type: SaleType;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;    // ← phone saved with bill
  amountPaid?: number;
  changeReturned?: number;
  createdAt: number;
  date: string;
  time: string;
  loyaltyPointsEarned?: number;  // ← loyalty points
  // Advance snapshot at the time the bill was created (for correct bill printing)
  advanceBeforeBill?: number;    // customer.totalDue BEFORE this sale (negative = advance)
}

// Customer (Khata / Udhaar customer)
export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  totalDue: number;          // negative = advance balance
  createdAt: number;
  // Loyalty
  loyaltyPoints?: number;
  totalSpent?: number;
}

// ── Regular Customer (saved from any bill — cash or udhaar) ──
export interface RegularCustomer {
  id: string;
  name: string;
  phone: string;
  address?: string;
  createdAt: number;
  lastVisit?: number;
  totalVisits?: number;
  totalSpent?: number;
  loyaltyPoints?: number;    // 1 point per ₹10 spent
  notes?: string;            // dukandar ke notes
  birthday?: string;         // YYYY-MM-DD for birthday wishes
  isFavorite?: boolean;
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
  regularCustomers: RegularCustomer[];  // ← new: regular customer DB
  sales: Sale[];
  transactions: Transaction[];
  drafts: DraftBill[];
  syncCode: string | null;
  lastSync: number | null;
  appPin: string | null;
  billCounter: number;
}

// Master Product Database (for suggestions)
export interface MasterProduct {
  name: string;
  category: string;
  suggestedPrice: number;
  unit: string;
}

// Navigation
export type TabType = 'pos' | 'inventory' | 'khata' | 'reports' | 'settings' | 'customers' | 'ai';

// Toast Notification
export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

// Calculator State
export interface CalculatorState {
  isOpen: boolean;
  cartTotal: number;
}
