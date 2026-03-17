// App Context for Global State Management
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { 
  AppState, 
  BusinessProfile, 
  Product, 
  Customer, 
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
  
  // Sales
  addSale: (sale: Omit<Sale, 'id' | 'createdAt' | 'date' | 'time'>) => void;
  getSalesByDate: (date: string) => Sale[];
  getSalesByDateRange: (startDate: string, endDate: string) => Sale[];
  
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

  // Load data on mount
  useEffect(() => {
    const loadedState = loadAppState();
    setState(loadedState);
    setIsLoading(false);
  }, []);

  // Save data on state change
  useEffect(() => {
    if (!isLoading) {
      saveAppState(state);
    }
  }, [state, isLoading]);

  // Listen for network changes
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

  // Toast helper
  const showToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = generateId();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Business Profile
  const updateBusinessProfile = useCallback((profile: BusinessProfile) => {
    setState(prev => ({ ...prev, businessProfile: profile }));
    showToast('Business profile updated', 'success');
  }, [showToast]);

  // Products
  const addProduct = useCallback((product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newProduct: Product = {
      ...product,
      id: generateId(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setState(prev => ({ ...prev, products: [...prev.products, newProduct] }));
    showToast('Product added successfully', 'success');
  }, [showToast]);

  const updateProduct = useCallback((product: Product) => {
    setState(prev => ({
      ...prev,
      products: prev.products.map(p => p.id === product.id ? { ...product, updatedAt: Date.now() } : p)
    }));
    showToast('Product updated', 'success');
  }, [showToast]);

  const deleteProduct = useCallback((productId: string) => {
    setState(prev => ({
      ...prev,
      products: prev.products.filter(p => p.id !== productId)
    }));
    showToast('Product deleted', 'info');
  }, [showToast]);

  const getLowStockProducts = useCallback(() => {
    return state.products.filter(p => p.stock <= p.minStock);
  }, [state.products]);

  // Customers
  const addCustomer = useCallback((customer: Omit<Customer, 'id' | 'createdAt' | 'totalDue'>) => {
    const newCustomer: Customer = {
      ...customer,
      id: generateId(),
      createdAt: Date.now(),
      totalDue: 0,
    };
    setState(prev => ({ ...prev, customers: [...prev.customers, newCustomer] }));
    showToast('Customer added successfully', 'success');
  }, [showToast]);

  const updateCustomer = useCallback((customer: Customer) => {
    setState(prev => ({
      ...prev,
      customers: prev.customers.map(c => c.id === customer.id ? customer : c)
    }));
    showToast('Customer updated', 'success');
  }, [showToast]);

  const deleteCustomer = useCallback((customerId: string) => {
    setState(prev => ({
      ...prev,
      customers: prev.customers.filter(c => c.id !== customerId)
    }));
    showToast('Customer deleted', 'info');
  }, [showToast]);

  const getCustomerById = useCallback((id: string) => {
    return state.customers.find(c => c.id === id);
  }, [state.customers]);

  // Sales
  const addSale = useCallback((sale: Omit<Sale, 'id' | 'createdAt' | 'date' | 'time'>) => {
    const now = Date.now();
    const newSale: Sale = {
      ...sale,
      id: generateId(),
      createdAt: now,
      date: getTodayDateString(),
      time: formatTime(now),
    };
    
    setState(prev => {
      // Update product stock
      const updatedProducts = prev.products.map(p => {
        const saleItem = sale.items.find(item => item.productId === p.id);
        if (saleItem) {
          return { ...p, stock: Math.max(0, p.stock - saleItem.quantity) };
        }
        return p;
      });

      // Update customer balance if udhaar
      let updatedCustomers = prev.customers;
      if (sale.type === 'udhaar' && sale.customerId) {
        updatedCustomers = prev.customers.map(c => {
          if (c.id === sale.customerId) {
            return { ...c, totalDue: c.totalDue + sale.total };
          }
          return c;
        });
      }

      return {
        ...prev,
        products: updatedProducts,
        customers: updatedCustomers,
        sales: [...prev.sales, newSale]
      };
    });

    showToast(sale.type === 'cash' ? 'Cash bill saved' : 'Udhaar bill saved', 'success');
  }, [showToast]);

  const getSalesByDate = useCallback((date: string) => {
    return state.sales.filter(s => s.date === date);
  }, [state.sales]);

  const getSalesByDateRange = useCallback((startDate: string, endDate: string) => {
    return state.sales.filter(s => s.date >= startDate && s.date <= endDate);
  }, [state.sales]);

  // Transactions
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
      // Update customer balance
      const updatedCustomers = prev.customers.map(c => {
        if (c.id === transaction.customerId) {
          const newDue = transaction.type === 'sale' 
            ? c.totalDue + transaction.amount 
            : c.totalDue - transaction.amount;
          return { ...c, totalDue: Math.max(0, newDue) };
        }
        return c;
      });

      return {
        ...prev,
        customers: updatedCustomers,
        transactions: [...prev.transactions, newTransaction]
      };
    });

    showToast('Payment recorded', 'success');
  }, [showToast]);

  const getCustomerTransactions = useCallback((customerId: string) => {
    return state.transactions.filter(t => t.customerId === customerId).sort((a, b) => b.createdAt - a.createdAt);
  }, [state.transactions]);

  const getCustomerBalance = useCallback((customerId: string) => {
    const customer = state.customers.find(c => c.id === customerId);
    return customer?.totalDue || 0;
  }, [state.customers]);

  // Drafts
  const addDraft = useCallback((draft: Omit<DraftBill, 'id' | 'createdAt'>) => {
    const newDraft: DraftBill = {
      ...draft,
      id: generateId(),
      createdAt: Date.now(),
    };
    setState(prev => ({ ...prev, drafts: [...prev.drafts, newDraft] }));
    showToast('Draft saved', 'success');
  }, [showToast]);

  const deleteDraft = useCallback((draftId: string) => {
    setState(prev => ({
      ...prev,
      drafts: prev.drafts.filter(d => d.id !== draftId)
    }));
    showToast('Draft deleted', 'info');
  }, [showToast]);

  // Sync
  const uploadData = useCallback(async () => {
    try {
      const code = await uploadToCloud(state);
      setState(prev => ({ ...prev, syncCode: code, lastSync: Date.now() }));
      showToast('Data uploaded to cloud', 'success');
      return code;
    } catch (error) {
      showToast('Failed to upload data', 'error');
      throw error;
    }
  }, [state, showToast]);

  const downloadData = useCallback(async (code: string) => {
    try {
      const data = await downloadFromCloud(code);
      if (data) {
        setState(data);
        showToast('Data downloaded successfully', 'success');
      } else {
        showToast('Invalid sync code', 'error');
      }
    } catch (error) {
      showToast('Failed to download data', 'error');
      throw error;
    }
  }, [showToast]);

  // Reset
  const resetData = useCallback(() => {
    setState(defaultAppState);
    showToast('All data reset', 'info');
  }, [showToast]);

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
    addSale,
    getSalesByDate,
    getSalesByDateRange,
    addTransaction,
    getCustomerTransactions,
    getCustomerBalance,
    addDraft,
    deleteDraft,
    uploadData,
    downloadData,
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
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
