// App Context for Global State Management
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type {
  AppState,
  BusinessProfile,
  Product,
  Customer,
  RegularCustomer,
  Sale,
  Transaction,
  DraftBill,
  CartItem,
  Toast,
  PurchaseItem,
  Purchase
} from '@/types';
import {
  loadAppState,
  saveAppState,
  defaultAppState,
  generateId,
  getTodayDateString,
  formatTime,
  loadCart,
  saveCart
} from '@/utils/storage';

// Online status — browser native (navigator.onLine), no cloud needed
function checkOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

interface AppContextType {
  state: AppState;
  isLoading: boolean;
  isOnline: boolean;
  toasts: Toast[];

  // Cart (Persisted across tab switches / pages)
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  addToCart: (product: Product, quantity?: number) => void;
  updateQuantity: (productId: string, delta: number) => void;
  setCartItemQuantity: (productId: string, exactQty: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;

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
  deleteSale: (saleId: string) => void;
  getSalesByDate: (date: string) => Sale[];
  getSalesByDateRange: (startDate: string, endDate: string) => Sale[];
  getCustomerSales: (customerId: string) => Sale[];

  // Kharid (Purchase / Stock-Inward)
  addPurchase: (input: {
    items: Array<{ productId: string; quantity: number; purchasePrice: number }>;
    supplierName?: string;
    supplierPhone?: string;
    note?: string;
  }) => void;

  // Transactions
  addTransaction: (transaction: Omit<Transaction, 'id' | 'createdAt' | 'date' | 'time'>) => void;
  getCustomerTransactions: (customerId: string) => Transaction[];
  getCustomerBalance: (customerId: string) => number;

  // Drafts
  addDraft: (draft: Omit<DraftBill, 'id' | 'createdAt'>) => void;
  deleteDraft: (draftId: string) => void;

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
  const [online, setOnline] = useState(checkOnline());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [cart, setCart] = useState<CartItem[]>(() => loadCart());

  useEffect(() => {
    saveCart(cart);
  }, [cart]);

  const addToCart = useCallback((product: Product, quantity: number = 1) => {
    if (product.stock <= 0) return;
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        const raw = existing.quantity + quantity;
        const newQty = Math.min(Math.round(raw * 1000) / 1000, product.stock);
        return prev.map(item => item.product.id === product.id ? { ...item, quantity: newQty } : item);
      }
      const newQty = Math.min(Math.round(quantity * 1000) / 1000, product.stock);
      return [...prev, { product, quantity: newQty }];
    });
  }, []);

  const updateQuantity = useCallback((productId: string, delta: number) => {
    setCart(prev => prev
      .map(item => {
        if (item.product.id === productId) {
          const raw = item.quantity + delta;
          const newQty = Math.round(raw * 1000) / 1000;
          if (newQty > item.product.stock) return item;
          return { ...item, quantity: newQty };
        }
        return item;
      })
      .filter(item => item.quantity > 0)
    );
  }, []);

  const setCartItemQuantity = useCallback((productId: string, exactQty: number) => {
    setCart(prev => prev
      .map(item => {
        if (item.product.id === productId) {
          const clamped = Math.min(Math.max(0, exactQty), item.product.stock);
          const newQty = Math.round(clamped * 1000) / 1000;
          return { ...item, quantity: newQty };
        }
        return item;
      })
      .filter(item => item.quantity > 0)
    );
  }, []);


  const removeFromCart = useCallback((productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

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

      // Capture advance balance BEFORE this sale (for correct bill snapshot)
      const advanceBeforeBill = sale.customerId
        ? (prev.customers.find(c => c.id === sale.customerId)?.totalDue ?? undefined)
        : undefined;

      const newSale: Sale = {
        ...sale,
        id: generateId(),
        billNumber,
        createdAt: now,
        date: getTodayDateString(),
        time: formatTime(now),
        loyaltyPointsEarned: loyaltyEarned,
        advanceBeforeBill,
      };

      // Update product stock
      const updatedProducts = prev.products.map(p => {
        const saleItem = sale.items.find(item => item.productId === p.id);
        if (saleItem) return { ...p, stock: Math.max(0, p.stock - saleItem.quantity) };
        return p;
      });

      // Update customer balance for udhaar AND split (baaki hissa khate mein)
      // ✅ FIX Bug 2: Only add (total - amountPaid) to due, not the full total
      let updatedCustomers = prev.customers;
      if ((sale.type === 'udhaar' || sale.type === 'split') && sale.customerId) {
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

  const deleteSale = useCallback((saleId: string) => {
    setState(prev => {
      const sale = prev.sales.find(s => s.id === saleId);
      if (!sale) return prev;

      // Restore stock
      const updatedProducts = prev.products.map(p => {
        const item = sale.items.find(i => i.productId === p.id);
        if (item) return { ...p, stock: p.stock + item.quantity, updatedAt: Date.now() };
        return p;
      });

      // Revert customer due for udhaar AND split
      let updatedCustomers = prev.customers;
      if ((sale.type === 'udhaar' || sale.type === 'split') && sale.customerId) {
        updatedCustomers = prev.customers.map(c => {
          if (c.id === sale.customerId) {
            const remainingDue = sale.total - (sale.amountPaid || 0);
            return { ...c, totalDue: Math.max(0, c.totalDue - remainingDue) };
          }
          return c;
        });
      }

      return {
        ...prev,
        products: updatedProducts,
        customers: updatedCustomers,
        sales: prev.sales.filter(s => s.id !== saleId),
      };
    });
    showToast('Bill delete ho gaya!', 'info');
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

  // ── Kharid (Purchase / Stock-Inward) ──
  // Supplier se maal aaya → stock badhao + costPrice (weighted average) + purchase record
  const addPurchase = useCallback((input: {
    items: Array<{ productId: string; quantity: number; purchasePrice: number }>;
    supplierName?: string;
    supplierPhone?: string;
    note?: string;
  }) => {
    const validItems = input.items.filter(i => i.quantity > 0 && i.purchasePrice >= 0);
    if (validItems.length === 0) {
      showToast('Kharid mein koi valid item nahi hai', 'error');
      return;
    }
    const now = Date.now();
    setState(prev => {
      const purchaseItems: PurchaseItem[] = [];
      const updatedProducts = prev.products.map(p => {
        const pi = validItems.find(v => v.productId === p.id);
        if (!pi) return p;
        const newStock = p.stock + pi.quantity;
        // Weighted average cost (purana stock + naya maal)
        const newCost = newStock > 0
          ? ((p.stock * p.costPrice) + (pi.quantity * pi.purchasePrice)) / newStock
          : pi.purchasePrice;
        purchaseItems.push({
          productId: p.id,
          name: p.name,
          quantity: pi.quantity,
          purchasePrice: pi.purchasePrice,
          total: pi.quantity * pi.purchasePrice,
        });
        return { ...p, stock: newStock, costPrice: Math.round(newCost * 100) / 100, updatedAt: now };
      });
      const total = purchaseItems.reduce((s, i) => s + i.total, 0);
      const purchase: Purchase = {
        id: generateId(),
        items: purchaseItems,
        supplierName: input.supplierName?.trim() || undefined,
        supplierPhone: input.supplierPhone?.trim() || undefined,
        total,
        createdAt: now,
        date: getTodayDateString(),
        time: formatTime(now),
        note: input.note?.trim() || undefined,
      };
      return { ...prev, products: updatedProducts, purchases: [...prev.purchases, purchase] };
    });
    showToast(`Kharid save ho gayi! Stock badh gaya.`, 'success');
  }, [showToast]);

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
    setCart([]);
    showToast('Sab data delete ho gaya', 'info');
  }, [state.appPin, showToast]);


  // ── AI Inventory Event Listeners ──
  useEffect(() => {
    const handleAddProduct = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const incomingName = (detail.productName || '').toString().trim();
      if (!incomingName) {
        showToast('Product ka naam nahi mila', 'error');
        return;
      }
      const incomingStock = Math.max(0, Number(detail.stock) || 0);
      const incomingPrice = Number(detail.salePrice) || 0;

      // DUPLICATE GUARD: same naam pehle se hai? → naya duplicate MAT banao, stock merge karo
      const existing = state.products.find(
        p => p.name.toLowerCase().trim() === incomingName.toLowerCase()
      );
      if (existing) {
        setState(prev => ({
          ...prev,
          products: prev.products.map(p => p.id === existing.id ? {
            ...p,
            stock: p.stock + incomingStock,
            salePrice: incomingPrice > 0 ? incomingPrice : p.salePrice,
            updatedAt: Date.now(),
          } : p)
        }));
        showToast(`"${existing.name}" pehle se tha — stock merge ho gaya!`, 'success');
        return;
      }

      const newProduct: Product = {
        id: generateId(),
        name: incomingName,
        sku: detail.sku || `SKU-${Date.now()}`,
        salePrice: incomingPrice,
        costPrice: detail.purchasePrice || detail.costPrice || 0,
        stock: incomingStock,
        unit: detail.unit || 'piece',
        category: detail.category || '',
        minStock: detail.minStock || 5,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setState(prev => ({ ...prev, products: [...prev.products, newProduct] }));
      showToast(`"${incomingName}" add ho gaya!`, 'success');
    };

    const handleEditProduct = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const productId = detail.productId;
      const changes = { ...detail.changes };
      if ('purchasePrice' in changes) {
        changes.costPrice = changes.purchasePrice;
        delete changes.purchasePrice;
      }
      setState(prev => ({
        ...prev,
        products: prev.products.map(p => p.id === productId ? { ...p, ...changes, updatedAt: Date.now() } : p)
      }));
      showToast(`${detail.productName || 'Product'} update ho gaya!`, 'success');
    };

    const handleDeleteProduct = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setState(prev => ({ ...prev, products: prev.products.filter(p => p.id !== detail.productId) }));
      showToast(`${detail.productName || 'Product'} delete ho gaya!`, 'info');
    };

    const handleUpdateStock = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setState(prev => ({
        ...prev,
        products: prev.products.map(p => p.id === detail.productId ? { ...p, stock: detail.newStock, updatedAt: Date.now() } : p)
      }));
      showToast(`${detail.productName || 'Product'} stock update ho gaya!`, 'success');
    };

    window.addEventListener('ai-add-product', handleAddProduct);
    window.addEventListener('ai-edit-product', handleEditProduct);
    window.addEventListener('ai-delete-product', handleDeleteProduct);
    window.addEventListener('ai-update-stock', handleUpdateStock);
    return () => {
      window.removeEventListener('ai-add-product', handleAddProduct);
      window.removeEventListener('ai-edit-product', handleEditProduct);
      window.removeEventListener('ai-delete-product', handleDeleteProduct);
      window.removeEventListener('ai-update-stock', handleUpdateStock);
    };
  }, [showToast, state.products]);

  // ── AI Customer Event Listeners ──
  useEffect(() => {
    const handleAddCustomer = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const incomingName = (detail.customerName || '').toString().trim();
      const incomingPhone = (detail.phone || '').toString().replace(/\D/g, '');
      if (!incomingName) {
        showToast('Customer ka naam nahi mila', 'error');
        return;
      }
      // DUPLICATE GUARD: same naam ya same phone pehle se hai?
      const existing = state.customers.find(c => {
        if (c.name.toLowerCase().trim() === incomingName.toLowerCase()) return true;
        if (incomingPhone && c.phone.replace(/\D/g, '') === incomingPhone) return true;
        return false;
      });
      if (existing) {
        showToast(`"${existing.name}" pehle se khata mein hai!`, 'info');
        return;
      }
      const newCustomer: Customer = {
        id: generateId(),
        name: incomingName,
        phone: detail.phone || '',
        address: detail.address || '',
        totalDue: 0,
        createdAt: Date.now(),
      };
      setState(prev => ({ ...prev, customers: [...prev.customers, newCustomer] }));
      showToast(`"${incomingName}" add ho gaya!`, 'success');
    };

    const handleEditCustomer = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const customerId = detail.customerId;
      const changes = detail.changes || {};
      setState(prev => ({
        ...prev,
        customers: prev.customers.map(c => c.id === customerId ? { ...c, ...changes } : c)
      }));
      showToast(`${detail.customerName || 'Customer'} update ho gaya!`, 'success');
    };

    const handleDeleteCustomer = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setState(prev => ({ ...prev, customers: prev.customers.filter(c => c.id !== detail.customerId) }));
      showToast(`${detail.customerName || 'Customer'} delete ho gaya!`, 'info');
    };

    window.addEventListener('ai-add-customer', handleAddCustomer);
    window.addEventListener('ai-edit-customer', handleEditCustomer);
    window.addEventListener('ai-delete-customer', handleDeleteCustomer);
    return () => {
      window.removeEventListener('ai-add-customer', handleAddCustomer);
      window.removeEventListener('ai-edit-customer', handleEditCustomer);
      window.removeEventListener('ai-delete-customer', handleDeleteCustomer);
    };
  }, [showToast, state.customers]);

  // ── AI Bulk Import Listener ──
  useEffect(() => {
    const handleBulkImport = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const items = detail?.items as Array<{ name: string; salePrice: number; purchasePrice?: number; stock: number; unit: string; category?: string; minStock?: number }> | undefined;
      if (!items || items.length === 0) return;

      const now = Date.now();
      // DUPLICATE GUARD: jo naam pehle se hai uska stock merge karo, naya duplicate mat banao
      const existingNames = new Set(
        state.products.map(p => p.name.toLowerCase().trim())
      );
      const freshItems = items.filter(
        i => (i.name || '').trim() && !existingNames.has(i.name.toLowerCase().trim())
      );
      const mergedCount = items.length - freshItems.length;

      const newProducts: Product[] = freshItems.map((item, idx) => ({
        id: generateId() + idx,
        name: item.name,
        sku: (item as any).sku || `SKU-${Date.now()}-${idx}`,
        salePrice: item.salePrice || 0,
        costPrice: item.purchasePrice || (item as any).costPrice || 0,
        stock: item.stock || 0,
        unit: item.unit || 'piece',
        category: item.category || '',
        minStock: item.minStock || 5,
        createdAt: now,
        updatedAt: now,
      }));

      setState(prev => {
        // Merge stock for already-existing names (fresh prev — no stale closure)
        const mergedProducts = prev.products.map(p => {
          const match = items.find(
            i => (i.name || '').toLowerCase().trim() === p.name.toLowerCase().trim()
          );
          if (match) {
            return {
              ...p,
              stock: p.stock + (match.stock || 0),
              salePrice: (match.salePrice || 0) > 0 ? match.salePrice : p.salePrice,
              updatedAt: now,
            };
          }
          return p;
        });
        return { ...prev, products: [...mergedProducts, ...newProducts] };
      });
      showToast(
        `${newProducts.length} items import ho gaye!${mergedCount > 0 ? ` (${mergedCount} pehle se the — stock merge)` : ''}`,
        'success'
      );
    };

    window.addEventListener('ai-bulk-import', handleBulkImport);
    return () => { window.removeEventListener('ai-bulk-import', handleBulkImport); };
  }, [showToast, state.products]);

  // ── AI Delete Sale Listener ──
  useEffect(() => {
    const handleDeleteSale = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const saleId = detail?.saleId;
      const billNumber = detail?.billNumber || 'Bill';
      if (saleId) {
        deleteSale(saleId);
        showToast(`${billNumber} delete kar diya gaya!`, 'info');
      }
    };
    window.addEventListener('ai-delete-sale', handleDeleteSale);
    return () => { window.removeEventListener('ai-delete-sale', handleDeleteSale); };
  }, [deleteSale, showToast]);

  // ── AI Record Purchase Listener (voice: "50 kg chini 40 mein kharidi") ──
  useEffect(() => {
    const handleRecordPurchase = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      const rawItems = (detail.items || []) as Array<{
        productId?: string; productName?: string; quantity?: number; purchasePrice?: number;
      }>;
      const skipped: string[] = [];
      const resolved: Array<{ productId: string; quantity: number; purchasePrice: number }> = [];

      for (const ri of rawItems) {
        let product: Product | undefined;
        if (ri.productId) product = state.products.find(p => p.id === ri.productId);
        if (!product && ri.productName) {
          const q = ri.productName.toLowerCase().trim();
          product = state.products.find(p => p.name.toLowerCase().trim() === q);
          if (!product) {
            const opts = state.products.filter(p => p.name.toLowerCase().includes(q));
            if (opts.length === 1) product = opts[0];
          }
        }
        if (!product) { skipped.push(ri.productName || 'Unknown'); continue; }
        resolved.push({
          productId: product.id,
          quantity: Number(ri.quantity) || 0,
          purchasePrice: Number(ri.purchasePrice) || 0,
        });
      }
      if (resolved.length === 0) {
        showToast(`Kharid save nahi hui — ${skipped.join(', ')} stock mein nahi mila. Pehle product add karo.`, 'error');
        return;
      }
      addPurchase({
        items: resolved,
        supplierName: detail.supplierName,
        supplierPhone: detail.supplierPhone,
        note: detail.note,
      });
      if (skipped.length > 0) showToast(`${skipped.join(', ')} skip hua (stock mein nahi mila)`, 'info');
    };
    window.addEventListener('ai-record-purchase', handleRecordPurchase);
    return () => { window.removeEventListener('ai-record-purchase', handleRecordPurchase); };
  }, [state.products, addPurchase, showToast]);

  // Ref to prevent duplicate bill creation within 1 sec
  const lastRecordBillTimeRef = useRef<number>(0);

  // ── AI Record Bill & Add-to-Cart Listeners (Global & Safe) ──
  useEffect(() => {
    const handleRecordBill = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const type = (detail?.type || 'cash') as 'cash' | 'udhaar' | 'split';
      const customerId = detail?.customerId as string | undefined;
      const customerName = detail?.customerName as string | undefined;
      const actionItems = (detail?.items || []) as Array<{ productId?: string; productName?: string; quantity?: number }>;

      const now = Date.now();
      if (now - lastRecordBillTimeRef.current < 1000) {
        return; // Prevent duplicate bill execution within 1 sec
      }
      lastRecordBillTimeRef.current = now;

      let finalCartItems: CartItem[] = [];

      const findProduct = (item: { productId?: string; productName?: string }) => {
        if (item.productId) {
          const found = state.products.find(p => p.id === item.productId);
          if (found) return found;
        }
        if (item.productName) {
          const q = item.productName.toLowerCase().trim();
          const found = state.products.find(p => p.name.toLowerCase().trim() === q);
          if (found) return found;
        }
        return null;
      };

      if (cart.length > 0) {
        // User ALREADY has items in cart! Keep current cart.
        finalCartItems = [...cart];

        // Add ONLY new products from actionItems that are NOT already in cart (by ID or name)
        if (actionItems.length > 0) {
          actionItems.forEach(aiItem => {
            const matched = findProduct(aiItem);
            if (matched && matched.stock > 0) {
              const exists = finalCartItems.some(c =>
                c.product.id === matched.id ||
                c.product.name.toLowerCase().trim() === matched.name.toLowerCase().trim()
              );
              if (!exists) {
                finalCartItems.push({
                  product: matched,
                  quantity: Math.min(aiItem.quantity || 1, matched.stock),
                });
              }
            }
          });
        }
      } else {
        // Cart is empty, populate from actionItems
        actionItems.forEach(aiItem => {
          const matched = findProduct(aiItem);
          if (matched && matched.stock > 0) {
            const exists = finalCartItems.some(c => c.product.id === matched.id);
            if (!exists) {
              finalCartItems.push({
                product: matched,
                quantity: Math.min(aiItem.quantity || 1, matched.stock),
              });
            }
          }
        });
      }

      if (finalCartItems.length === 0) {
        showToast('Cart khaali hai! Pehle items add karo.', 'error');
        return;
      }

      const saleItems = finalCartItems.map(item => ({
        productId: item.product.id,
        name: item.product.name,
        price: item.product.salePrice,
        quantity: item.quantity,
        total: item.product.salePrice * item.quantity,
      }));
      const total = saleItems.reduce((sum, i) => sum + i.total, 0);

      // SPLIT auto-detect: udhaar bill mein partial cash aaya aur poora nahi → 'split' type
      const cashPaid = Math.max(0, Number(detail?.amountPaid) || 0);
      let billType = type;
      if (type === 'udhaar' && cashPaid > 0 && cashPaid < total) billType = 'split';
      if (cashPaid >= total) billType = 'cash'; // poora cash de diya → seedha cash bill

      let finalCustomer: Customer | null = null;
      if (billType !== 'cash') {
        // 1) Exact ID
        if (customerId) {
          finalCustomer = state.customers.find(c => c.id === customerId) || null;
        }
        // 2) Naam se (case-insensitive)
        if (!finalCustomer && customerName) {
          const qName = customerName.toLowerCase().trim();
          finalCustomer = state.customers.find(c => c.name.toLowerCase().trim() === qName) || null;
        }
        // 3) PHONE NUMBER se — user "98765 wale ka bill" bole toh (last-10-digit match, +91 safe)
        if (!finalCustomer && customerName) {
          const qDigits = customerName.replace(/\D/g, '').slice(-10);
          if (qDigits.length >= 10) {
            finalCustomer = state.customers.find(
              c => c.phone.replace(/\D/g, '').slice(-10) === qDigits
            ) || null;
          }
        }
        // ORPHAN UDHAAAR BLOCK: bina customer ke udhaar bill KABHI mat banao
        if (!finalCustomer) {
          showToast(
            `"${customerName || 'Customer'}" khata mein nahi mila! Pehle customer add karo, phir udhaar bill banao.`,
            'error'
          );
          return;
        }
      }

      // Execute single addSale directly
      addSale({
        items: saleItems,
        total,
        type: billType,
        customerId: finalCustomer?.id,
        customerName: finalCustomer?.name || customerName,
        customerPhone: finalCustomer?.phone,
        amountPaid: cashPaid > 0 ? cashPaid : undefined,
      });

      showToast(
        billType === 'split'
          ? `Split bill ban gaya! Cash ₹${cashPaid.toFixed(0)} + Udhaar ₹${(total - cashPaid).toFixed(0)}`
          : billType === 'udhaar'
            ? `Udhaar bill ban gaya! ${finalCustomer?.name || ''}`
            : `Cash bill ban gaya! ₹${total.toFixed(0)}`,
        'success'
      );

      // Clear cart after sale
      setCart([]);
    };

    const handleAddToCart = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      const { productId, productName, quantity } = detail;
      let product: Product | undefined;
      if (productId) product = state.products.find(p => p.id === productId);
      if (!product && productName) {
        const q = productName.toLowerCase().trim();
        product = state.products.find(p => p.name.toLowerCase().trim() === q);
      }
      if (!product) {
        showToast(`"${productName || 'Item'}" stock mein nahi mila`, 'error');
        return;
      }
      if (product.stock <= 0) {
        showToast(`"${product.name}" ka stock khatam hai`, 'error');
        return;
      }
      addToCart(product, quantity || 1);
      showToast(`"${product.name}" cart mein add ho gaya`, 'success');
    };

    window.addEventListener('ai-record-bill', handleRecordBill);
    window.addEventListener('ai-checkout', handleRecordBill);
    window.addEventListener('ai-add-to-cart', handleAddToCart);
    return () => {
      window.removeEventListener('ai-record-bill', handleRecordBill);
      window.removeEventListener('ai-checkout', handleRecordBill);
      window.removeEventListener('ai-add-to-cart', handleAddToCart);
    };
  }, [cart, state.products, state.customers, addSale, addToCart, setCart, showToast]);

  // Ref to prevent duplicate voice payment entries
  const lastRecordPaymentTimeRef = useRef<number>(0);
  const lastPaymentKeyRef = useRef<string>('');

  // ── AI Record Voice Payment Listener (Safe, Validated & Debounced) ──
  useEffect(() => {
    const handleRecordPayment = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const customerId = detail?.customerId as string | undefined;
      const customerName = detail?.customerName as string | undefined;
      const amount = parseFloat(detail?.amount) || 0;

      if (amount <= 0) {
        showToast('Payment amount sahi nahi hai (0 se bada hona chahiye)', 'error');
        return;
      }

      const now = Date.now();
      const eventKey = `${customerId || customerName}_${amount}`;

      // Duplicate proofing: ignore identical payment request within 3 seconds
      if (
        now - lastRecordPaymentTimeRef.current < 3000 &&
        lastPaymentKeyRef.current === eventKey
      ) {
        console.warn('Duplicate voice payment request ignored');
        return;
      }

      lastRecordPaymentTimeRef.current = now;
      lastPaymentKeyRef.current = eventKey;

      let targetCustomer: Customer | undefined;
      if (customerId) {
        targetCustomer = state.customers.find(c => c.id === customerId);
      }
      if (!targetCustomer && customerName) {
        const q = customerName.toLowerCase().trim();
        targetCustomer = state.customers.find(c => c.name.toLowerCase().trim() === q);
      }
      // PHONE NUMBER se bhi dhundo ("98765 wale ne paise diye")
      if (!targetCustomer && customerName) {
        const qDigits = customerName.replace(/\D/g, '').slice(-10);
        if (qDigits.length >= 10) {
          targetCustomer = state.customers.find(
            c => c.phone.replace(/\D/g, '').slice(-10) === qDigits
          );
        }
      }

      if (!targetCustomer) {
        showToast(`Customer "${customerName || ''}" Khata Book mein nahi mila`, 'error');
        return;
      }

      // Add payment transaction
      addTransaction({
        customerId: targetCustomer.id,
        type: 'payment',
        amount,
        description: `Voice AI Payment — ${targetCustomer.name}`,
      });

      const dueBefore = targetCustomer.totalDue;
      const dueAfter = dueBefore - amount;

      let msg = '';
      if (dueAfter === 0) {
        msg = `✅ ${targetCustomer.name} ne ₹${amount} pay kiya. Baki hisaab CLEAR ho gaya!`;
      } else if (dueAfter < 0) {
        msg = `✅ ${targetCustomer.name} ne ₹${amount} pay kiya. ₹${Math.abs(dueAfter).toFixed(0)} Advance Balance save ho gaya!`;
      } else {
        msg = `✅ ${targetCustomer.name} ne ₹${amount} pay kiya. Ab ₹${dueAfter.toFixed(0)} baki hai.`;
      }

      showToast(msg, 'success');
    };

    window.addEventListener('ai-record-payment', handleRecordPayment);
    return () => window.removeEventListener('ai-record-payment', handleRecordPayment);
  }, [state.customers, addTransaction, showToast]);

  const value: AppContextType = {
    state,
    isLoading,
    isOnline: online,
    toasts,
    cart,
    setCart,
    addToCart,
    updateQuantity,
    setCartItemQuantity,
    removeFromCart,
    clearCart,
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
    deleteSale,
    getSalesByDate,
    getSalesByDateRange,
    getCustomerSales,
    addPurchase,
    addTransaction,
    getCustomerTransactions,
    getCustomerBalance,
    addDraft,
    deleteDraft,
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
