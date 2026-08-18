// POS Section - Point of Sale (Bikri)
import { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  ShoppingCart, 
  Save,
  FolderOpen,
  X,
  Check,
  User,
  Banknote,
  CreditCard,
  ArrowRight,
  Phone,
  Star,
  Mic,
  MicOff,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useApp } from '@/context/AppContext';
import { categories } from '@/utils/masterProducts';
import { Label } from '@/components/ui/label';
import { generateWhatsAppBill, printBill } from '@/utils/billPDF';
import type { CartItem, Product, Customer, Sale, RegularCustomer } from '@/types';
import { useVoiceToBill } from '@/utils/useVoiceToBill';

export function POSSection() {
  const {
    state, addSale, addDraft, deleteDraft, addCustomer,
    getRegularCustomerByPhone,
  } = useApp();
  
  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);

  // ── Voice-to-Bill ──
  const {
    isSupported: voiceSupported,
    isListening,
    status: voiceStatus,
    interimTranscript,
    finalTranscript,
    lastResult: voiceResult,
    toggleListening,
    clearResult: clearVoiceResult,
  } = useVoiceToBill({
    products: state.products,
    cart,
    setCart,
  });

  // Auto-clear voice result after 4 seconds
  useEffect(() => {
    if (!voiceResult) return;
    const t = setTimeout(() => clearVoiceResult(), 4000);
    return () => clearTimeout(t);
  }, [voiceResult, clearVoiceResult]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  // Dialog states
  const [showDrafts, setShowDrafts] = useState(false);
  const [showHoldName, setShowHoldName] = useState(false);
  const [holdCustomerName, setHoldCustomerName] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutType, setCheckoutType] = useState<'cash' | 'udhaar'>('cash');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [lastSaleCustomer, setLastSaleCustomer] = useState<Customer | null>(null); // for bill dialog
  const [showBillDialog, setShowBillDialog] = useState(false);
  const [amountPaidInput, setAmountPaidInput] = useState('');

  // ── Cash Customer (optional name+phone for cash bills) ──
  const [cashCustomerName, setCashCustomerName] = useState('');
  const [cashCustomerPhone, setCashCustomerPhone] = useState('');
  const [showCashAutocomplete, setShowCashAutocomplete] = useState(false);
  const [showPhoneAutocomplete, setShowPhoneAutocomplete] = useState(false);
  const cashNameRef = useRef<HTMLInputElement>(null);
  const [selectedRegularForBill, setSelectedRegularForBill] = useState<RegularCustomer | null>(null);

  // New customer form
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' });
  // Pending customer to auto-select after addCustomer() updates state
  const [pendingSelectName, setPendingSelectName] = useState<string | null>(null);

  // Filter products
  const filteredProducts = useMemo(() => {
    let products = state.products;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      products = products.filter(p => 
        p.name.toLowerCase().includes(query) || 
        p.sku.toLowerCase().includes(query)
      );
    }
    
    if (selectedCategory !== 'All') {
      products = products.filter(p => p.category === selectedCategory);
    }
    
    return products;
  }, [state.products, searchQuery, selectedCategory]);

  // Cart calculations
  const cartTotal = cart.reduce((sum, item) => sum + (item.product.salePrice * item.quantity), 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Filter customers for udhaar
  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return state.customers;
    const query = customerSearch.toLowerCase();
    return state.customers.filter(c => 
      c.name.toLowerCase().includes(query) || 
      c.phone.includes(query)
    );
  }, [state.customers, customerSearch]);

  // ── Cash customer autocomplete (name search) ──
  const cashNameSuggestions = useMemo(() => {
    if (!cashCustomerName || cashCustomerName.length < 1) return [];
    const q = cashCustomerName.toLowerCase();
    const allNames = [
      ...(state.regularCustomers || []).map(rc => ({ name: rc.name, phone: rc.phone, id: rc.id, loyalty: rc.loyaltyPoints || 0 })),
      ...state.customers.map(c => ({ name: c.name, phone: c.phone, id: `cust-${c.id}`, loyalty: 0 })),
    ];
    const seen = new Set<string>();
    return allNames.filter(c => {
      if (!c.name.toLowerCase().includes(q)) return false;
      if (seen.has(c.phone || c.name)) return false;
      seen.add(c.phone || c.name);
      return true;
    }).slice(0, 6);
  }, [cashCustomerName, state.regularCustomers, state.customers]);

  const cashPhoneSuggestions = useMemo(() => {
    if (!cashCustomerPhone || cashCustomerPhone.length < 3) return [];
    const q = cashCustomerPhone.replace(/\D/g, '');
    const allC = [
      ...(state.regularCustomers || []).map(rc => ({ name: rc.name, phone: rc.phone })),
      ...state.customers.map(c => ({ name: c.name, phone: c.phone })),
    ];
    const seen = new Set<string>();
    return allC.filter(c => {
      if (!c.phone.replace(/\D/g, '').includes(q)) return false;
      if (seen.has(c.phone)) return false;
      seen.add(c.phone);
      return true;
    }).slice(0, 5);
  }, [cashCustomerPhone, state.regularCustomers, state.customers]);

  // Close autocomplete on outside click
  useEffect(() => {
    const handler = () => { setShowCashAutocomplete(false); setShowPhoneAutocomplete(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Auto-select newly added customer once state refreshes
  useEffect(() => {
    if (pendingSelectName) {
      const found = state.customers.find(c => c.name === pendingSelectName);
      if (found) {
        setSelectedCustomer(found);
        setPendingSelectName(null);
      }
    }
  }, [state.customers, pendingSelectName]);

  const selectCashCustomer = (name: string, phone: string) => {
    setCashCustomerName(name);
    setCashCustomerPhone(phone);
    setShowCashAutocomplete(false);
    setShowPhoneAutocomplete(false);
    // Check if in regular customers
    const rc = getRegularCustomerByPhone(phone);
    setSelectedRegularForBill(rc || null);
  };
  const addToCart = (product: Product) => {
    if (product.stock <= 0) return;
    
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  // Update quantity
  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQuantity = item.quantity + delta;
        if (newQuantity <= 0) return item;
        if (newQuantity > item.product.stock) return item;
        return { ...item, quantity: newQuantity };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  // Remove from cart
  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  // Save draft with customer name
  const saveDraft = () => {
    if (cart.length === 0) return;
    setShowHoldName(true);
  };

  const confirmHold = () => {
    addDraft({ items: cart, customerName: holdCustomerName });
    setCart([]);
    setHoldCustomerName('');
    setShowHoldName(false);
  };

  // Load draft
  const loadDraft = (draftItems: CartItem[]) => {
    setCart(draftItems);
    setShowDrafts(false);
  };

  // Handle checkout
  const handleCheckout = () => {
    if (cart.length === 0) return;
    const paid = parseFloat(amountPaidInput) || 0;
    const change = paid > 0 ? paid - cartTotal : 0;

    const saleItems = cart.map(item => ({
      productId: item.product.id,
      name: item.product.name,
      price: item.product.salePrice,
      quantity: item.quantity,
      total: item.product.salePrice * item.quantity,
    }));

    // If adding a brand new customer inline for udhaar
    let finalCustomer = selectedCustomer;
    if (!finalCustomer && newCustomer.name && checkoutType === 'udhaar') {
      addCustomer({ name: newCustomer.name, phone: newCustomer.phone, address: '' });
    }

    // For cash: use cashCustomerName/Phone if filled
    const finalName = checkoutType === 'cash'
      ? (cashCustomerName || undefined)
      : (finalCustomer?.name || undefined);
    const finalPhone = checkoutType === 'cash'
      ? (cashCustomerPhone || undefined)
      : (finalCustomer?.phone || undefined);

    const saleData = {
      items: saleItems,
      total: cartTotal,
      type: checkoutType,
      customerId: finalCustomer?.id,
      customerName: finalName,
      customerPhone: finalPhone,
      amountPaid: paid > 0 ? paid : undefined,
      changeReturned: change > 0 ? change : undefined,
    };

    // Capture bill number BEFORE addSale increments the counter
    const billNumber = `BILL-${String(state.billCounter).padStart(4,'0')}`;
    const nowMs = Date.now();
    const fakeSale: Sale = {
      id: `sale-${nowMs}`,
      billNumber,
      ...saleData,
      createdAt: nowMs,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
    };

    addSale(saleData);
    setLastSale(fakeSale);
    setLastSaleCustomer(selectedCustomer); // keep for bill dialog
    // Keep refs for bill dialog (before clearing state)
    setShowBillDialog(true);

    setCart([]);
    setShowCheckout(false);
    setSelectedCustomer(null);
    setCheckoutType('cash');
    setAmountPaidInput('');
    setNewCustomer({ name: '', phone: '' });
    setCashCustomerName('');
    setCashCustomerPhone('');
    setSelectedRegularForBill(null);
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-80px)] lg:h-screen">
      {/* Products Section */}
      <div className="flex-1 p-4 lg:p-6 overflow-auto">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Bikri (POS)</h2>
            <p className="text-gray-500">Select items to add to cart</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={() => setShowDrafts(true)}
              className="rounded-2xl h-12"
            >
              <FolderOpen className="w-5 h-5 mr-2" />
              Drafts ({state.drafts.length})
            </Button>
            <Button
              variant="outline"
              onClick={saveDraft}
              disabled={cart.length === 0}
              className="rounded-2xl h-12"
            >
              <Save className="w-5 h-5 mr-2" />
              Hold Bill
            </Button>

            {/* ── Voice-to-Bill Button ── */}
            {voiceSupported && (
              <Button
                onClick={toggleListening}
                className={`rounded-2xl h-12 font-semibold transition-all duration-200 ${
                  isListening
                    ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse shadow-lg shadow-red-200'
                    : voiceStatus === 'processing'
                    ? 'bg-orange-400 hover:bg-orange-500 text-white'
                    : 'bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white shadow-lg shadow-purple-200'
                }`}
              >
                {isListening ? (
                  <><MicOff className="w-5 h-5 mr-2" /> Ruk Jao</>
                ) : voiceStatus === 'processing' ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Samajh Raha...</>
                ) : (
                  <><Mic className="w-5 h-5 mr-2" /> Bol ke Add Karo</>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* ── Voice Feedback Panel ── */}
        {voiceSupported && (isListening || voiceStatus === 'processing' || voiceResult || interimTranscript) && (
          <div className={`rounded-2xl p-4 mb-4 transition-all duration-300 ${
            isListening
              ? 'bg-violet-50 border-2 border-violet-300'
              : voiceResult?.toastType === 'success'
              ? 'bg-green-50 border-2 border-green-300'
              : voiceResult?.toastType === 'warning'
              ? 'bg-yellow-50 border-2 border-yellow-300'
              : voiceResult?.toastType === 'error'
              ? 'bg-red-50 border-2 border-red-300'
              : 'bg-gray-50 border border-gray-200'
          }`}>
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div className={`mt-0.5 flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
                isListening ? 'bg-violet-500' : voiceStatus === 'processing' ? 'bg-orange-400' : 
                voiceResult?.toastType === 'success' ? 'bg-green-500' : 
                voiceResult?.toastType === 'error' ? 'bg-red-500' : 'bg-gray-400'
              }`}>
                {isListening ? (
                  <Mic className="w-4 h-4 text-white animate-pulse" />
                ) : voiceStatus === 'processing' ? (
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                ) : voiceResult?.toastType === 'error' ? (
                  <AlertCircle className="w-4 h-4 text-white" />
                ) : (
                  <Check className="w-4 h-4 text-white" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {/* Listening state */}
                {isListening && !interimTranscript && (
                  <p className="text-violet-700 font-semibold text-sm">
                    🎙️ Bol dein... jaise "2 kilo aata" ya "5 packet maggi"
                  </p>
                )}
                {/* Live transcript */}
                {interimTranscript && (
                  <>
                    <p className="text-xs text-violet-500 font-medium mb-0.5">Sun raha hoon...</p>
                    <p className="text-violet-800 font-bold text-sm italic">"{interimTranscript}"</p>
                  </>
                )}
                {/* Processing */}
                {voiceStatus === 'processing' && finalTranscript && !voiceResult && (
                  <>
                    <p className="text-xs text-orange-500 font-medium mb-0.5">Samajh raha hoon...</p>
                    <p className="text-orange-800 font-bold text-sm">"{finalTranscript}"</p>
                  </>
                )}
                {/* Result toast */}
                {voiceResult && (
                  <>
                    <p className="text-xs text-gray-500 mb-0.5 font-medium">
                      Suna: <span className="italic">"{voiceResult.transcript}"</span>
                    </p>
                    <p className={`font-semibold text-sm ${
                      voiceResult.toastType === 'success' ? 'text-green-700' :
                      voiceResult.toastType === 'warning' ? 'text-yellow-700' :
                      'text-red-700'
                    }`}>
                      {voiceResult.toastMessage}
                    </p>
                    {voiceResult.confidence > 0 && voiceResult.product && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              voiceResult.confidence > 0.75 ? 'bg-green-500' :
                              voiceResult.confidence > 0.5 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.round(voiceResult.confidence * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 font-medium whitespace-nowrap">
                          {Math.round(voiceResult.confidence * 100)}% match
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Dismiss button */}
              {voiceResult && (
                <button
                  onClick={clearVoiceResult}
                  className="text-gray-400 hover:text-gray-600 flex-shrink-0 mt-0.5"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Search & Filters */}
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products..."
              className="pl-12 rounded-2xl h-12"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 lg:pb-0">
            {categories.slice(0, 6).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-2xl text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === cat
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredProducts.map((product) => {
            const cartItem = cart.find(item => item.product.id === product.id);
            const inCart = cartItem?.quantity || 0;
            const outOfStock = product.stock === 0;

            return (
              <Card
                key={product.id}
                onClick={() => !outOfStock && addToCart(product)}
                className={`rounded-3xl border-0 shadow-lg overflow-hidden transition-all ${
                  outOfStock 
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'cursor-pointer hover:shadow-xl hover:scale-[1.02]'
                }`}
              >
                <div className={`h-2 ${outOfStock ? 'bg-red-500' : 'bg-green-500'}`} />
                <CardContent className="p-4">
                  <h3 className="font-semibold text-gray-900 line-clamp-2 text-sm mb-1">
                    {product.name}
                  </h3>
                  <p className="text-xs text-gray-500 mb-2">{product.category}</p>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-orange-600">₹{product.salePrice}</p>
                      <p className="text-xs text-gray-400">{product.stock} {product.unit} left</p>
                    </div>
                    {inCart > 0 && (
                      <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-bold">{inCart}</span>
                      </div>
                    )}
                  </div>

                  {outOfStock && (
                    <p className="text-xs text-red-500 font-medium mt-2">Out of Stock</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No products found</h3>
            <p className="text-gray-500">Add products in the Inventory section</p>
          </div>
        )}
      </div>

      {/* Cart Section */}
      <div className="w-full lg:w-96 bg-white border-t lg:border-t-0 lg:border-l border-gray-200 flex flex-col max-h-[50vh] lg:max-h-none">
        {/* Cart Header */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-orange-500" />
              <h3 className="font-semibold text-gray-900">Cart</h3>
              {cartItemCount > 0 && (
                <span className="px-2 py-0.5 bg-orange-100 text-orange-600 rounded-full text-xs font-medium">
                  {cartItemCount}
                </span>
              )}
            </div>
            {cart.length > 0 && (
              <button
                onClick={() => setCart([])}
                className="text-sm text-red-500 hover:text-red-600"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-auto p-4 space-y-3">
          {cart.map((item) => (
            <div
              key={item.product.id}
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl"
            >
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-gray-900 text-sm truncate">{item.product.name}</h4>
                <p className="text-xs text-gray-500">
                  ₹{item.product.salePrice} x {item.quantity}
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateQuantity(item.product.id, -1)}
                  className="w-8 h-8 bg-white rounded-lg shadow flex items-center justify-center hover:bg-gray-100"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-8 text-center font-medium">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item.product.id, 1)}
                  disabled={item.quantity >= item.product.stock}
                  className="w-8 h-8 bg-white rounded-lg shadow flex items-center justify-center hover:bg-gray-100 disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              
              <div className="text-right min-w-[60px]">
                <p className="font-semibold text-gray-900">
                  ₹{(item.product.salePrice * item.quantity).toFixed(2)}
                </p>
              </div>
              
              <button
                onClick={() => removeFromCart(item.product.id)}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          {cart.length === 0 && (
            <div className="text-center py-8">
              <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">Your cart is empty</p>
              <p className="text-sm text-gray-400">Tap products to add them</p>
            </div>
          )}
        </div>

        {/* Cart Footer */}
        {cart.length > 0 && (
          <div className="p-4 border-t border-gray-100 bg-gray-50">
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-600">Total</span>
              <span className="text-2xl font-bold text-gray-900">₹{cartTotal.toFixed(2)}</span>
            </div>
            {/* ✅ FIX Bug 3: Hold Bill button clearly visible in cart footer on mobile */}
            <Button
              variant="outline"
              onClick={saveDraft}
              className="w-full rounded-2xl h-10 mb-2 text-sm border-orange-300 text-orange-600 hover:bg-orange-50 font-semibold"
            >
              <Save className="w-4 h-4 mr-2" />
              Hold Bill (Save for Later)
            </Button>
            <Button
              onClick={() => setShowCheckout(true)}
              className="w-full rounded-2xl h-14 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-lg font-semibold"
            >
              Checkout
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        )}
      </div>

      {/* Drafts Dialog */}
      <Dialog open={showDrafts} onOpenChange={setShowDrafts}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader><DialogTitle>Hold Bills ({state.drafts.length})</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-4 max-h-96 overflow-y-auto">
            {state.drafts.map((draft) => (
              <div key={draft.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                <div>
                  {draft.customerName && (
                    <p className="font-semibold text-orange-600 flex items-center gap-1">
                      <User className="w-3.5 h-3.5" /> {draft.customerName}
                    </p>
                  )}
                  <p className="text-sm font-medium text-gray-700">{draft.items.length} items</p>
                  <p className="text-sm text-gray-500">
                    ₹{draft.items.reduce((sum, item) => sum + (item.product.salePrice * item.quantity), 0).toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-400">{new Date(draft.createdAt).toLocaleString('en-IN')}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => loadDraft(draft.items)} className="rounded-xl">Load</Button>
                  <Button variant="outline" size="sm" onClick={() => deleteDraft(draft.id)}
                    className="rounded-xl border-red-200 text-red-600 hover:bg-red-50">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
            {state.drafts.length === 0 && <p className="text-center text-gray-500 py-8">Koi hold bill nahi</p>}
          </div>
        </DialogContent>
      </Dialog>

      {/* Hold Bill — Customer Name Dialog */}
      <Dialog open={showHoldName} onOpenChange={setShowHoldName}>
        <DialogContent className="sm:max-w-sm rounded-3xl">
          <DialogHeader><DialogTitle>Bill Hold Karo</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Grahak ka naam (optional)</Label>
              <Input
                value={holdCustomerName}
                onChange={e => setHoldCustomerName(e.target.value)}
                placeholder="e.g. Ram Lal"
                className="rounded-xl h-11 mt-1"
                autoFocus
              />
              <p className="text-xs text-gray-400 mt-1">Baad mein pehchanne ke liye naam daal sakte ho</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowHoldName(false)} className="flex-1 rounded-xl h-11">Cancel</Button>
              <Button onClick={confirmHold} className="flex-1 rounded-xl h-11 bg-orange-500 hover:bg-orange-600">
                <Save className="w-4 h-4 mr-2" /> Hold Karo
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Checkout Dialog */}
      <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>Checkout — ₹{cartTotal.toFixed(2)}</DialogTitle>
          </DialogHeader>
          <div className="mt-3 space-y-4 max-h-[75vh] overflow-y-auto">
            {/* Total */}
            <div className="bg-gradient-to-r from-orange-500 to-red-600 rounded-2xl p-5 text-white text-center">
              <p className="text-orange-100 text-sm mb-1">Kul Bill</p>
              <p className="text-4xl font-bold">₹{cartTotal.toFixed(2)}</p>
            </div>

            {/* Payment Type */}
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setCheckoutType('cash')}
                className={`p-4 rounded-2xl border-2 transition-all ${checkoutType === 'cash' ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                <Banknote className={`w-7 h-7 mx-auto mb-1.5 ${checkoutType === 'cash' ? 'text-green-600' : 'text-gray-400'}`} />
                <p className={`font-semibold text-sm ${checkoutType === 'cash' ? 'text-green-700' : 'text-gray-600'}`}>Cash</p>
              </button>
              <button onClick={() => setCheckoutType('udhaar')}
                className={`p-4 rounded-2xl border-2 transition-all ${checkoutType === 'udhaar' ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}>
                <CreditCard className={`w-7 h-7 mx-auto mb-1.5 ${checkoutType === 'udhaar' ? 'text-red-600' : 'text-gray-400'}`} />
                <p className={`font-semibold text-sm ${checkoutType === 'udhaar' ? 'text-red-700' : 'text-gray-600'}`}>Udhaar</p>
              </button>
            </div>

            {/* Amount Paid (cash only) */}
            {checkoutType === 'cash' && (
              <div className="space-y-3">
                {/* ── Optional Customer Name + Phone ── */}
                <div className="bg-blue-50 rounded-2xl p-3 space-y-2.5">
                  <p className="text-xs font-semibold text-blue-700 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" /> Grahak ka Naam (optional)
                  </p>
                  {/* Name with autocomplete */}
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      ref={cashNameRef}
                      type="text"
                      value={cashCustomerName}
                      onChange={e => { setCashCustomerName(e.target.value); setShowCashAutocomplete(true); setSelectedRegularForBill(null); }}
                      onFocus={() => setShowCashAutocomplete(true)}
                      placeholder="Naam type karo..."
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-blue-200 focus:border-blue-500 outline-none text-sm font-medium bg-white"
                      autoComplete="off"
                    />
                    {cashCustomerName && (
                      <button onClick={() => { setCashCustomerName(''); setCashCustomerPhone(''); setSelectedRegularForBill(null); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    {showCashAutocomplete && cashNameSuggestions.length > 0 && (
                      <div className="absolute z-50 top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg mt-1 overflow-hidden">
                        {cashNameSuggestions.map((s, i) => (
                          <button key={i} onMouseDown={() => selectCashCustomer(s.name, s.phone)}
                            className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-blue-50 text-left border-b border-gray-50 last:border-0">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-blue-400" />
                              <div>
                                <p className="text-sm font-semibold text-gray-800">{s.name}</p>
                                {s.phone && <p className="text-xs text-gray-400">{s.phone}</p>}
                              </div>
                            </div>
                            {s.loyalty > 0 && (
                              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-semibold">
                                ⭐ {s.loyalty} pts
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Phone with autocomplete */}
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={cashCustomerPhone}
                      onChange={e => { setCashCustomerPhone(e.target.value); setShowPhoneAutocomplete(true); }}
                      onFocus={() => setShowPhoneAutocomplete(true)}
                      placeholder="Phone number (optional)"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-blue-200 focus:border-blue-500 outline-none text-sm font-medium bg-white"
                      autoComplete="off"
                    />
                    {showPhoneAutocomplete && cashPhoneSuggestions.length > 0 && (
                      <div className="absolute z-50 top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg mt-1 overflow-hidden">
                        {cashPhoneSuggestions.map((s, i) => (
                          <button key={i} onMouseDown={() => selectCashCustomer(s.name, s.phone)}
                            className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-blue-50 text-left border-b border-gray-50 last:border-0">
                            <Phone className="w-4 h-4 text-blue-400" />
                            <div>
                              <p className="text-sm font-semibold text-gray-800">{s.name}</p>
                              <p className="text-xs text-gray-400">{s.phone}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Show loyalty if returning customer */}
                  {selectedRegularForBill && (
                    <div className="flex items-center gap-2 bg-yellow-50 rounded-xl p-2.5">
                      <Star className="w-4 h-4 text-yellow-500" />
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-yellow-800">Returning Customer 🎉</p>
                        <p className="text-xs text-yellow-600">
                          {selectedRegularForBill.totalVisits} visits • ⭐ {selectedRegularForBill.loyaltyPoints} loyalty points
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <Label className="text-sm">Diya Gaya Paisa (₹) — optional</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={amountPaidInput}
                    onChange={e => setAmountPaidInput(e.target.value)}
                    placeholder={`Min ₹${cartTotal.toFixed(2)}`}
                    className="rounded-xl h-11 mt-1 text-center text-lg font-bold"
                  />
                  {parseFloat(amountPaidInput) > 0 && parseFloat(amountPaidInput) >= cartTotal && (
                    <div className="bg-green-50 rounded-xl p-3 mt-2 text-center">
                      <p className="text-xs text-green-600">Wapas Karo</p>
                      <p className="text-2xl font-black text-green-700">₹{(parseFloat(amountPaidInput) - cartTotal).toFixed(2)}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Customer Selection for Udhaar */}
            {checkoutType === 'udhaar' && (
              <div>
                <Label className="mb-2 block text-sm">Grahak Chunein</Label>
                {!selectedCustomer ? (
                  <>
                    <div className="relative mb-2">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input value={customerSearch} onChange={e => setCustomerSearch(e.target.value)}
                        placeholder="Naam ya phone..." className="pl-10 rounded-xl h-10" />
                    </div>
                    <div className="max-h-36 overflow-y-auto space-y-1.5">
                      {filteredCustomers.map(customer => (
                        <button key={customer.id} onClick={() => setSelectedCustomer(customer)}
                          className="w-full flex items-center justify-between p-2.5 bg-gray-50 rounded-xl hover:bg-orange-50 text-left">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-400" />
                            <span className="font-medium text-sm">{customer.name}</span>
                          </div>
                          <span className={`text-xs font-semibold ${customer.totalDue < 0 ? 'text-green-600' : customer.totalDue > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                            {customer.totalDue < 0 ? `✅ ₹${Math.abs(customer.totalDue).toFixed(0)} adv` : `₹${customer.totalDue.toFixed(0)} due`}
                          </span>
                        </button>
                      ))}
                      <button onClick={() => setShowAddCustomer(true)}
                        className="w-full p-2.5 text-orange-600 bg-orange-50 rounded-xl hover:bg-orange-100 text-sm font-medium flex items-center gap-1">
                        <Plus className="w-4 h-4" /> Naya Grahak
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-green-600" />
                      <div>
                        <span className="font-semibold text-green-700">{selectedCustomer.name}</span>
                        {selectedCustomer.totalDue < 0 && (
                          <p className="text-xs text-green-600">Advance: ₹{Math.abs(selectedCustomer.totalDue).toFixed(2)} — kaat liya jayega</p>
                        )}
                      </div>
                    </div>
                    <button onClick={() => setSelectedCustomer(null)}><X className="w-4 h-4 text-green-600" /></button>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pb-2">
              <Button variant="outline" onClick={() => setShowCheckout(false)} className="flex-1 rounded-2xl h-12">Cancel</Button>
              <Button onClick={handleCheckout} disabled={checkoutType === 'udhaar' && !selectedCustomer}
                className="flex-1 rounded-2xl h-12 bg-gradient-to-r from-orange-500 to-red-600">
                <Check className="w-5 h-5 mr-2" /> Complete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Post-Sale Bill Dialog ── */}
      <Dialog open={showBillDialog} onOpenChange={setShowBillDialog}>
        <DialogContent className="sm:max-w-sm rounded-3xl">
          <DialogHeader><DialogTitle>✅ Bill Complete!</DialogTitle></DialogHeader>
          {lastSale && (
            <div className="space-y-3 mt-2">
              <div className="bg-green-50 rounded-2xl p-4 text-center">
                <p className="text-green-600 text-sm font-medium">{lastSale.billNumber}</p>
                <p className="text-3xl font-black text-green-700 mt-1">₹{lastSale.total.toFixed(2)}</p>
                {/* ✅ FIX Bug 3: Show received + remaining due clearly */}
                {(lastSale.amountPaid || 0) > 0 && lastSale.type === 'cash' && (
                  <div className="mt-2 space-y-1">
                    <p className="text-sm text-green-600">✅ Mila: ₹{(lastSale.amountPaid || 0).toFixed(2)}</p>
                    {(lastSale.changeReturned || 0) > 0 && (
                      <p className="text-base font-bold text-orange-600">
                        ↩ Wapas Karo: ₹{lastSale.changeReturned?.toFixed(2)}
                      </p>
                    )}
                  </div>
                )}
                {lastSale.type === 'udhaar' && (
                  <div className="mt-2 space-y-1">
                    {(lastSale.amountPaid || 0) > 0 && (
                      <p className="text-sm text-green-600">✅ Mila: ₹{(lastSale.amountPaid || 0).toFixed(2)}</p>
                    )}
                    <p className="text-base font-bold text-red-600">
                      📋 Udhaar Baaki: ₹{(lastSale.total - (lastSale.amountPaid || 0)).toFixed(2)}
                    </p>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={() => { printBill({ sale: lastSale, customer: lastSaleCustomer, business: state.businessProfile, theme: 'modern' }); }}
                  className="rounded-xl h-11 text-xs border-orange-200 text-orange-700"
                >
                  🖨️ Print Bill
                </Button>
                {(lastSale.customerPhone || lastSale.customerName) && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      const msg = generateWhatsAppBill(lastSale, state.businessProfile, lastSaleCustomer);
                      const phone = (lastSale.customerPhone || lastSaleCustomer?.phone || '').replace(/\D/g, '');
                      if (phone) {
                        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
                      } else {
                        // No phone — just copy to clipboard
                        navigator.clipboard?.writeText(msg);
                      }
                    }}
                    className="rounded-xl h-11 text-xs border-green-200 text-green-700"
                  >
                    📱 WhatsApp
                  </Button>
                )}
              </div>
              <Button onClick={() => setShowBillDialog(false)} className="w-full rounded-xl h-11 bg-gray-800">
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Customer Dialog */}
      <Dialog open={showAddCustomer} onOpenChange={setShowAddCustomer}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Name</Label>
              <Input
                value={newCustomer.name}
                onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                placeholder="Customer name"
                className="rounded-2xl h-12"
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                placeholder="Phone number"
                className="rounded-2xl h-12"
              />
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowAddCustomer(false)}
                className="flex-1 rounded-2xl h-12"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (newCustomer.name) {
                    // ✅ FIX Bug 1: Actually call addCustomer() to persist to Khata/storage
                    addCustomer({ name: newCustomer.name, phone: newCustomer.phone, address: '' });
                    // Schedule auto-select: useEffect will pick up once state.customers updates
                    setPendingSelectName(newCustomer.name);
                    setShowAddCustomer(false);
                    setNewCustomer({ name: '', phone: '' });
                  }
                }}
                disabled={!newCustomer.name}
                className="flex-1 rounded-2xl h-12 bg-gradient-to-r from-orange-500 to-red-600"
              >
                <Check className="w-5 h-5 mr-2" />
                Add
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
