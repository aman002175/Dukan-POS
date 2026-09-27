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
  barcode?: string;          // ← packet barcode (scan-to-cart)
  expiryDate?: string;       // ← YYYY-MM-DD (doodh/dawai jaisi cheezon ke liye)
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
export type SaleType = 'cash' | 'udhaar' | 'split';

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

// Kharid (Purchase / Stock-Inward) — supplier se maal aaya
export interface PurchaseItem {
  productId: string;
  name: string;
  quantity: number;
  purchasePrice: number;   // per-unit kharid rate
  total: number;
}

export interface Purchase {
  id: string;
  items: PurchaseItem[];
  supplierName?: string;
  supplierPhone?: string;
  total: number;
  createdAt: number;
  date: string;            // YYYY-MM-DD
  time: string;
  note?: string;
}

// Wapasi (Return) — customer ne maal wapas kiya
export interface ReturnItem {
  productId: string;
  name: string;
  price: number;           // jis rate par becha tha
  quantity: number;
  total: number;
}

export interface ReturnEntry {
  id: string;
  saleId?: string;         // kis bill se wapas (agar pata ho)
  billNumber?: string;
  items: ReturnItem[];
  total: number;           // kul refund amount
  refundType: 'cash' | 'adjust';  // cash wapas diya ya udhaar mein adjust
  customerId?: string;
  customerName?: string;
  reason?: string;
  createdAt: number;
  date: string;            // YYYY-MM-DD
  time: string;
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
  appPin: string | null;
  billCounter: number;
  // Kharid (purchase / stock-inward) history
  purchases: Purchase[];
  // Wapasi (returns) history
  returns: ReturnEntry[];
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
