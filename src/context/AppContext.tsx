// App Context for Global State Management
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type {
  AppState,
  BusinessProfile,
  Product,
  Customer,
  RegularCustomer,
  Sale,
  Transaction,
  DraftBill,
  Toast
} from '@/types';
import {
  loadAppState,
  saveAppState,
  defaultAppState,
  generateId,
  getTodayDateString,
  formatTime
} from '@/utils/storage';
import { uploadToCloud, downloadFromCloud, isOnline } from '@/utils/firebase';

interface AppContextType {
  state: AppState;
  isLoading: boolean;
  isOnline: boolean;
  toasts: Toast[];

  // Business Profile
  updateBusinessProfile: (profile: BusinessProfile) => void;

  // Products
  addProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateProduct: (product: Product) => void;
  deleteProduct: (productId: string) => void;
  getLowStockProducts: () => Product[];

  // Customers
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt' | 'totalDue'>) => void;
  updateCustomer: (customer: Customer) => void;
  deleteCustomer: (customerId: string) => void;
  getCustomerById: (id: string) => Customer | undefined;

  // Regular Customers (saved from any bill)
  addRegularCustomer: (rc: Omit<RegularCustomer, 'id' | 'createdAt'>) => RegularCustomer;
  updateRegularCustomer: (rc: RegularCustomer) => void;
  deleteRegularCustomer: (id: string) => void;
  getRegularCustomerByPhone: (phone: string) => RegularCustomer | undefined;
  getSalesByRegularCustomer: (phone: string) => Sale[];
  addLoyaltyPoints: (rcId: string, points: number) => void;

  // Sales
  addSale: (sale: Omit<Sale, 'id' | 'createdAt' | 'date' | 'time' | 'billNumber'>) => void;
  getSalesByDate: (date: string) => Sale[];
  getSalesByDateRange: (startDate: string, endDate: string) => Sale[];
  getCustomerSales: (customerId: string) => Sale[];

  // Transactions
  addTransaction: (transaction: Omit<Transaction, 'id' | 'createdAt' | 'date' | 'time'>) => void;
  getCustomerTransactions: (customerId: string) => Transaction[];
  getCustomerBalance: (customerId: string) => number;

  // Drafts
  addDraft: (draft: Omit<DraftBill, 'id' | 'createdAt'>) => void;
  deleteDraft: (draftId: string) => void;

  // Sync
  uploadData: () => Promise<string>;
  downloadData: (code: string) => Promise<void>;

  // PIN / Security
  setAppPin: (pin: string) => void;
  changeAppPin: (oldPin: string, newPin: string) => boolean;
  verifyPin: (pin: string) => boolean;

  // Toasts
  showToast: (message: string, type?: Toast['type']) => void;
  removeToast: (id: string) => void;

  // Reset
  resetData: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(defaultAppState);
  const [isLoading, setIsLoading] = useState(true);
  const [online, setOnline] = useState(isOnline());
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const loadedState = loadAppState();
    setState({ ...defaultAppState, ...loadedState });
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isLoading) saveAppState(state);
  }, [state, isLoading]);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const showToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = generateId();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Business Profile
  const updateBusinessProfile = useCallback((profile: BusinessProfile) => {
    setState(prev => ({ ...prev, businessProfile: profile }));
    showToast('Profile update ho gaya', 'success');
  }, [showToast]);

  // Products
  const addProduct = useCallback((product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newProduct: Product = { ...product, id: generateId(), createdAt: Date.now(), updatedAt: Date.now() };
    setState(prev => ({ ...prev, products: [...prev.products, newProduct] }));
    showToast('Product add ho gaya', 'success');
  }, [showToast]);

  const updateProduct = useCallback((product: Product) => {
    setState(prev => ({
      ...prev,
      products: prev.products.map(p => p.id === product.id ? { ...product, updatedAt: Date.now() } : p)
    }));
    showToast('Product update ho gaya', 'success');
  }, [showToast]);

  const deleteProduct = useCallback((productId: string) => {
    setState(prev => ({ ...prev, products: prev.products.filter(p => p.id !== productId) }));
    showToast('Product delete ho gaya', 'info');
  }, [showToast]);

  const getLowStockProducts = useCallback(() => {
    return state.products.filter(p => p.stock <= p.minStock);
  }, [state.products]);

  // Customers
  const addCustomer = useCallback((customer: Omit<Customer, 'id' | 'createdAt' | 'totalDue'>) => {
    const newCustomer: Customer = { ...customer, id: generateId(), createdAt: Date.now(), totalDue: 0 };
    setState(prev => ({ ...prev, customers: [...prev.customers, newCustomer] }));
    showToast('Customer add ho gaya', 'success');
  }, [showToast]);

  const updateCustomer = useCallback((customer: Customer) => {
    setState(prev => ({ ...prev, customers: prev.customers.map(c => c.id === customer.id ? customer : c) }));
    showToast('Customer update ho gaya', 'success');
  }, [showToast]);

  const deleteCustomer = useCallback((customerId: string) => {
    setState(prev => ({ ...prev, customers: prev.customers.filter(c => c.id !== customerId) }));
    showToast('Customer delete ho gaya', 'info');
  }, [showToast]);

  const getCustomerById = useCallback((id: string) => {
    return state.customers.find(c => c.id === id);
  }, [state.customers]);

  // ── Regular Customers ──
  const addRegularCustomer = useCallback((rc: Omit<RegularCustomer, 'id' | 'createdAt'>): RegularCustomer => {
    const newRC: RegularCustomer = {
      ...rc,
      id: generateId(),
      createdAt: Date.now(),
      totalVisits: rc.totalVisits ?? 0,
      totalSpent: rc.totalSpent ?? 0,
      loyaltyPoints: rc.loyaltyPoints ?? 0,
    };
    setState(prev => ({ ...prev, regularCustomers: [...(prev.regularCustomers || []), newRC] }));
    return newRC;
  }, []);

  const updateRegularCustomer = useCallback((rc: RegularCustomer) => {
    setState(prev => ({
      ...prev,
      regularCustomers: (prev.regularCustomers || []).map(c => c.id === rc.id ? rc : c),
    }));
  }, []);

  const deleteRegularCustomer = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      regularCustomers: (prev.regularCustomers || []).filter(c => c.id !== id),
    }));
    showToast('Customer delete ho gaya', 'info');
  }, [showToast]);

  const getRegularCustomerByPhone = useCallback((phone: string): RegularCustomer | undefined => {
    if (!phone) return undefined;
    const clean = phone.replace(/\D/g, '');
    return (state.regularCustomers || []).find(c => c.phone.replace(/\D/g, '') === clean);
  }, [state.regularCustomers]);

  const getSalesByRegularCustomer = useCallback((phone: string): Sale[] => {
    if (!phone) return [];
    const clean = phone.replace(/\D/g, '');
    return state.sales
      .filter(s => s.customerPhone && s.customerPhone.replace(/\D/g, '') === clean)
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [state.sales]);

  const addLoyaltyPoints = useCallback((rcId: string, points: number) => {
    setState(prev => ({
      ...prev,
      regularCustomers: (prev.regularCustomers || []).map(c =>
        c.id === rcId ? { ...c, loyaltyPoints: (c.loyaltyPoints || 0) + points } : c
      ),
    }));
  }, []);

  // Sales
  const addSale = useCallback((sale: Omit<Sale, 'id' | 'createdAt' | 'date' | 'time' | 'billNumber'>) => {
    const now = Date.now();
    setState(prev => {
      const billNumber = `BILL-${String(prev.billCounter).padStart(4, '0')}`;
      // Loyalty: 1 point per ₹10
      const loyaltyEarned = Math.floor(sale.total / 10);
      const newSale: Sale = {
        ...sale,
        id: generateId(),
        billNumber,
        createdAt: now,
        date: getTodayDateString(),
        time: formatTime(now),
        loyaltyPointsEarned: loyaltyEarned,
      };

      // Update product stock
      const updatedProducts = prev.products.map(p => {
        const saleItem = sale.items.find(item => item.productId === p.id);
        if (saleItem) return { ...p, stock: Math.max(0, p.stock - saleItem.quantity) };
        return p;
      });

      // Update customer balance for udhaar
      // ✅ FIX Bug 2: Only add (total - amountPaid) to due, not the full total
      let updatedCustomers = prev.customers;
      if (sale.type === 'udhaar' && sale.customerId) {
        updatedCustomers = prev.customers.map(c => {
          if (c.id === sale.customerId) {
            const alreadyPaid = sale.amountPaid || 0;
            const remainingDue = sale.total - alreadyPaid; // can be 0 if fully paid at udhaar
            const newDue = c.totalDue + remainingDue;
            return { ...c, totalDue: newDue, totalSpent: (c.totalSpent || 0) + sale.total };
          }
          return c;
        });
      }

      // Auto-update regularCustomer stats (by phone)
      let updatedRegular = prev.regularCustomers || [];
      const salePhone = sale.customerPhone?.replace(/\D/g, '');
      if (salePhone) {
        const rcIdx = updatedRegular.findIndex(c => c.phone.replace(/\D/g, '') === salePhone);
        if (rcIdx !== -1) {
          updatedRegular = updatedRegular.map((c, i) => i === rcIdx ? {
            ...c,
            lastVisit: now,
            totalVisits: (c.totalVisits || 0) + 1,
            totalSpent: (c.totalSpent || 0) + sale.total,
            loyaltyPoints: (c.loyaltyPoints || 0) + loyaltyEarned,
          } : c);
        } else if (sale.customerName) {
          // Auto-save new regular customer when phone is provided
          const newRC = {
            id: generateId(),
            name: sale.customerName,
            phone: sale.customerPhone || '',
            createdAt: now,
            lastVisit: now,
            totalVisits: 1,
            totalSpent: sale.total,
            loyaltyPoints: loyaltyEarned,
          };
          updatedRegular = [...updatedRegular, newRC];
        }
      }

      return {
        ...prev,
        products: updatedProducts,
        customers: updatedCustomers,
        regularCustomers: updatedRegular,
        sales: [...prev.sales, newSale],
        billCounter: prev.billCounter + 1,
      };
    });
    showToast(sale.type === 'cash' ? 'Cash bill save ho gaya ✅' : 'Udhaar bill save ho gaya 📋', 'success');
  }, [showToast]);

  const getSalesByDate = useCallback((date: string) => {
    return state.sales.filter(s => s.date === date);
  }, [state.sales]);

  const getSalesByDateRange = useCallback((startDate: string, endDate: string) => {
    return state.sales.filter(s => s.date >= startDate && s.date <= endDate);
  }, [state.sales]);

  const getCustomerSales = useCallback((customerId: string) => {
    return state.sales
      .filter(s => s.customerId === customerId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [state.sales]);

  // Transactions — advance payment support
  const addTransaction = useCallback((transaction: Omit<Transaction, 'id' | 'createdAt' | 'date' | 'time'>) => {
    const now = Date.now();
    const newTransaction: Transaction = {
      ...transaction,
      id: generateId(),
      createdAt: now,
      date: getTodayDateString(),
      time: formatTime(now),
    };

    setState(prev => {
      const updatedCustomers = prev.customers.map(c => {
        if (c.id === transaction.customerId) {
          // payment reduces due; if payment > due → negative due = advance
          const newDue = transaction.type === 'sale'
            ? c.totalDue + transaction.amount
            : c.totalDue - transaction.amount; // can go negative (advance)
          return { ...c, totalDue: newDue };
        }
        return c;
      });
      return { ...prev, customers: updatedCustomers, transactions: [...prev.transactions, newTransaction] };
    });

    showToast(
      transaction.type === 'payment'
        ? 'Payment record ho gaya'
        : 'Sale record ho gaya',
      'success'
    );
  }, [showToast]);

  const getCustomerTransactions = useCallback((customerId: string) => {
    return state.transactions
      .filter(t => t.customerId === customerId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [state.transactions]);

  const getCustomerBalance = useCallback((customerId: string) => {
    const customer = state.customers.find(c => c.id === customerId);
    return customer?.totalDue || 0;
  }, [state.customers]);

  // Drafts
  const addDraft = useCallback((draft: Omit<DraftBill, 'id' | 'createdAt'>) => {
    const newDraft: DraftBill = { ...draft, id: generateId(), createdAt: Date.now() };
    setState(prev => ({ ...prev, drafts: [...prev.drafts, newDraft] }));
    showToast('Draft save ho gaya', 'success');
  }, [showToast]);

  const deleteDraft = useCallback((draftId: string) => {
    setState(prev => ({ ...prev, drafts: prev.drafts.filter(d => d.id !== draftId) }));
    showToast('Draft delete ho gaya', 'info');
  }, [showToast]);

  // Cloud Sync
  const uploadData = useCallback(async () => {
    try {
      const code = await uploadToCloud(state);
      setState(prev => ({ ...prev, syncCode: code, lastSync: Date.now() }));
      showToast('Data cloud pe upload ho gaya', 'success');
      return code;
    } catch {
      showToast('Upload failed', 'error');
      throw new Error('Upload failed');
    }
  }, [state, showToast]);

  const downloadData = useCallback(async (code: string) => {
    try {
      const data = await downloadFromCloud(code);
      if (data) {
        setState({ ...defaultAppState, ...data });
        showToast('Data download ho gaya', 'success');
      } else {
        showToast('Invalid sync code', 'error');
      }
    } catch {
      showToast('Download failed', 'error');
      throw new Error('Download failed');
    }
  }, [showToast]);

  // PIN / Security
  const setAppPin = useCallback((pin: string) => {
    setState(prev => ({ ...prev, appPin: pin }));
    showToast('PIN set ho gaya', 'success');
  }, [showToast]);

  const changeAppPin = useCallback((oldPin: string, newPin: string): boolean => {
    if (state.appPin && state.appPin !== oldPin) {
      showToast('Galat purana PIN', 'error');
      return false;
    }
    setState(prev => ({ ...prev, appPin: newPin }));
    showToast('PIN change ho gaya', 'success');
    return true;
  }, [state.appPin, showToast]);

  const verifyPin = useCallback((pin: string): boolean => {
    return state.appPin === pin;
  }, [state.appPin]);

  // Reset
  const resetData = useCallback(() => {
    setState({ ...defaultAppState, appPin: state.appPin }); // keep PIN even after reset
    showToast('Sab data delete ho gaya', 'info');
  }, [state.appPin, showToast]);

  const value: AppContextType = {
    state,
    isLoading,
    isOnline: online,
    toasts,
    updateBusinessProfile,
    addProduct,
    updateProduct,
    deleteProduct,
    getLowStockProducts,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    getCustomerById,
    addRegularCustomer,
    updateRegularCustomer,
    deleteRegularCustomer,
    getRegularCustomerByPhone,
    getSalesByRegularCustomer,
    addLoyaltyPoints,
    addSale,
    getSalesByDate,
    getSalesByDateRange,
    getCustomerSales,
    addTransaction,
    getCustomerTransactions,
    getCustomerBalance,
    addDraft,
    deleteDraft,
    uploadData,
    downloadData,
    setAppPin,
    changeAppPin,
    verifyPin,
    showToast,
    removeToast,
    resetData,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
