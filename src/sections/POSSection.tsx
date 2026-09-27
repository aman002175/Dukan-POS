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
  ArrowLeftRight,
  Phone,
  Star,
  Mic,
  MicOff,
  Loader2,
  AlertCircle,
  ScanBarcode
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { VoiceSearchMic } from '@/components/VoiceSearchMic';
import { BarcodeScanner } from '@/components/BarcodeScanner';
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
import type { CartItem, Customer, Sale, RegularCustomer } from '@/types';
import { useVoiceToBill } from '@/utils/useVoiceToBill';

export function POSSection() {
  const {
    state, addSale, addDraft, deleteDraft, addCustomer,
    getRegularCustomerByPhone, updateBusinessProfile, showToast,
    cart, setCart, addToCart, updateQuantity, removeFromCart, clearCart
  } = useApp();


  // ── Broadcast cart to FloatingMic for AI context ──
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('cart-updated', { detail: { cart } }));
  }, [cart]);



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
  const [showBreakdownModal, setShowBreakdownModal] = useState(false);
  const [discountInput, setDiscountInput] = useState('');
  const [checkoutType, setCheckoutType] = useState<'cash' | 'udhaar' | 'split'>('cash');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [lastSaleCustomer, setLastSaleCustomer] = useState<Customer | null>(null); // for bill dialog
  const [showBillDialog, setShowBillDialog] = useState(false);
  const [amountPaidInput, setAmountPaidInput] = useState('');
  const [showScanner, setShowScanner] = useState(false);

  // ── Cash Customer (optional name+phone for cash bills) ──
  const [cashCustomerName, setCashCustomerName] = useState('');
  const [cashCustomerPhone, setCashCustomerPhone] = useState('');
  const [showCashAutocomplete, setShowCashAutocomplete] = useState(false);
  const [showPhoneAutocomplete, setShowPhoneAutocomplete] = useState(false);
  const [showUPIQR, setShowUPIQR] = useState(false);
  const [customUPIInput, setCustomUPIInput] = useState('');
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
  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + (item.product.salePrice * item.quantity), 0), [cart]);
  const cartItemCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
  const discountAmount = useMemo(() => Math.max(0, parseFloat(discountInput) || 0), [discountInput]);
  const finalCartTotal = useMemo(() => Math.max(0, cartTotal - discountAmount), [cartTotal, discountAmount]);


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
  // Save draft with customer name
  const saveDraft = () => {
    if (cart.length === 0) return;
    setShowHoldName(true);
  };

  const confirmHold = () => {
    addDraft({ items: cart, customerName: holdCustomerName });
    clearCart();
    setHoldCustomerName('');
    setShowHoldName(false);
    setShowBreakdownModal(false);
  };

  // Load draft
  const loadDraft = (draftItems: CartItem[]) => {
    setCart(draftItems);
    setShowDrafts(false);
  };

  // Handle checkout
  const handleCheckout = () => {
    if (cart.length === 0) return;
    let paid = parseFloat(amountPaidInput) || 0;
    let effectiveType = checkoutType;
    const change = paid > 0 ? paid - finalCartTotal : 0;

    // SPLIT validation: cash 0 se zyada aur total se kam hona chahiye
    if (checkoutType === 'split') {
      if (paid <= 0) {
        showToast('Split mein cash amount dalo (0 se zyada)!', 'error');
        return;
      }
      if (paid >= finalCartTotal) {
        // Poora cash hi de diya — split ki zaroorat nahi, seedha cash bill
        effectiveType = 'cash';
      }
    }

    const saleItems = cart.map(item => ({
      productId: item.product.id,
      name: item.product.name,
      price: item.product.salePrice,
      quantity: item.quantity,
      total: item.product.salePrice * item.quantity,
    }));

    // If adding a brand new customer inline for udhaar/split
    let finalCustomer = selectedCustomer;
    if (!finalCustomer && newCustomer.name && checkoutType !== 'cash') {
      addCustomer({ name: newCustomer.name, phone: newCustomer.phone, address: '' });
    }

    // For cash: use cashCustomerName/Phone if filled
    const finalName = effectiveType === 'cash'
      ? (cashCustomerName || undefined)
      : (finalCustomer?.name || undefined);
    const finalPhone = effectiveType === 'cash'
      ? (cashCustomerPhone || undefined)
      : (finalCustomer?.phone || undefined);

    const saleData = {
      items: saleItems,
      total: finalCartTotal,
      type: effectiveType,
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
    setShowBillDialog(true);

    clearCart();
    setShowBreakdownModal(false);
    setShowCheckout(false);
    setSelectedCustomer(null);
    setCheckoutType('cash');
    setAmountPaidInput('');
    setDiscountInput('');
    setNewCustomer({ name: '', phone: '' });
    setCashCustomerName('');
    setCashCustomerPhone('');
    setSelectedRegularForBill(null);
  };


  return (
    <div className="flex flex-col h-[calc(100vh-80px)] lg:h-[calc(100vh-52px)] relative">
      {/* Products Section */}
      <div className="flex-1 p-4 lg:p-6 overflow-auto pb-28 lg:pb-24">
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
          <div className="flex gap-2 flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products..."
              className="pl-12 pr-12 rounded-2xl h-12"
            />
            <VoiceSearchMic onResult={(t) => setSearchQuery(t)} />
          </div>
          <button
            onClick={() => setShowScanner(true)}
            title="Barcode scan karke add karo"
            aria-label="Barcode scan"
            className="w-12 h-12 rounded-2xl bg-gray-900 text-white flex items-center justify-center hover:bg-gray-800 flex-shrink-0"
          >
            <ScanBarcode className="w-5 h-5" />
          </button>
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

                  {/* ── Inline +/− quantity controls — cart kholne ki zaroorat nahi ── */}
                  {!outOfStock && (
                    <div
                      className="flex items-center mt-3 rounded-2xl border border-gray-200 bg-gray-50 overflow-hidden"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {inCart > 0 ? (
                        <>
                          <button
                            onClick={() => updateQuantity(product.id, -1)}
                            aria-label="Kam karo"
                            className="flex-1 h-9 flex items-center justify-center text-gray-600 hover:bg-gray-200 active:bg-gray-300 transition-colors"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="min-w-8 text-center text-sm font-bold text-gray-900">{inCart}</span>
                        </>
                      ) : (
                        <span className="flex-1 h-9 flex items-center justify-center text-[11px] text-gray-400 font-medium">
                          Tap ya + se add karo
                        </span>
                      )}
                      <button
                        onClick={() => addToCart(product)}
                        aria-label="Aur add karo"
                        disabled={inCart >= product.stock}
                        className="flex-1 h-9 flex items-center justify-center text-orange-600 hover:bg-orange-50 active:bg-orange-100 disabled:text-gray-300 disabled:hover:bg-transparent transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  )}

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

      {/* Fixed Horizontal Cart Button — Always visible on screen */}
      <div className="fixed bottom-16 left-3 right-3 lg:bottom-4 lg:left-[304px] lg:right-6 z-30 p-1.5 bg-white/95 backdrop-blur-md rounded-2xl border border-orange-200/80 shadow-2xl transition-all">
        <div className="flex items-center gap-1.5">
          {/* 🗑️ Delete/Clear-cart button — seedha bill cancel (cart kholne ki zaroorat nahi) */}
          {cart.length > 0 && (
            <button
              onClick={() => {
                clearCart();
                showToast('Bill cancel ho gaya — cart khaali', 'info');
              }}
              aria-label="Poora bill cancel karo"
              title="Bill Cancel Karo"
              className="w-12 h-12 flex-shrink-0 rounded-2xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center hover:bg-red-100 active:scale-95 transition-all"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={() => setShowBreakdownModal(true)}
            disabled={cart.length === 0}
            className={`flex-1 h-14 rounded-2xl font-bold flex items-center justify-between px-4 text-base transition-all shadow-md ${
              cart.length > 0
                ? 'bg-gradient-to-r from-orange-500 via-red-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white cursor-pointer active:scale-[0.99] shadow-orange-200'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
            }`}
          >
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${
              cart.length > 0 ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              {cartItemCount}
            </div>
            <span className="font-semibold text-sm sm:text-base">
              {cart.length > 0 ? `${cartItemCount} Item${cartItemCount > 1 ? 's' : ''} Added` : 'Cart Khaali Hai — Items Select Karo'}
            </span>
          </div>

          {cart.length > 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-lg font-extrabold">₹{cartTotal.toFixed(2)}</span>
              <span className="text-xs bg-white/20 px-3 py-1.5 rounded-full flex items-center gap-1 font-bold">
                Breakdown & Checkout <ArrowRight className="w-4 h-4" />
              </span>
            </div>
          ) : (
            <span className="text-xs text-gray-400 font-medium">Add items</span>
          )}
          </button>
        </div>
      </div>


      {/* ── Calculation Breakdown & Payment Modal ── */}
      <Dialog open={showBreakdownModal} onOpenChange={setShowBreakdownModal}>
        <DialogContent className="sm:max-w-lg rounded-3xl p-0 overflow-hidden max-h-[90vh] flex flex-col border-0 shadow-2xl">
          {/* Header with Cross 'X' Button */}
          <div className="p-4 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white flex items-center justify-between border-b border-gray-700">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">Calculation Breakdown & Payment</h3>
                <p className="text-xs text-gray-300">{cartItemCount} item(s) in cart • Kul ₹{finalCartTotal.toFixed(2)}</p>
              </div>
            </div>
            {/* CROSS BUTTON 'X' TO GO BACK TO ITEM LIST */}
            <button
              onClick={() => setShowBreakdownModal(false)}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95"
              title="Wapas Item List Par Jayein"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 flex-1 overflow-y-auto space-y-4">
            {/* Section 1: Added Items List */}
            <div className="bg-gray-50 rounded-2xl p-3 border border-gray-200">
              <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-200">
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Added Items ({cart.length})</span>
                <button
                  onClick={() => setShowBreakdownModal(false)}
                  className="text-xs text-orange-600 hover:text-orange-700 font-semibold flex items-center gap-1 bg-orange-50 px-2.5 py-1 rounded-lg border border-orange-200 hover:bg-orange-100 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Aur Item Add Karo
                </button>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div key={item.product.id} className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex-1 min-w-0 pr-2">
                      <p className="text-sm font-semibold text-gray-900 truncate">{item.product.name}</p>
                      <p className="text-xs text-gray-500">₹{item.product.salePrice} × {item.quantity}</p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => updateQuantity(item.product.id, -1)}
                        className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center hover:bg-gray-200 text-gray-700"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-6 text-center font-bold text-xs">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.product.id, 1)}
                        disabled={item.quantity >= item.product.stock}
                        className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center hover:bg-gray-200 text-gray-700 disabled:opacity-50"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>

                      <p className="font-bold text-gray-900 text-sm ml-2 min-w-[55px] text-right">
                        ₹{(item.product.salePrice * item.quantity).toFixed(2)}
                      </p>

                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded-md ml-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                {cart.length === 0 && (
                  <div className="text-center py-4 text-gray-400 text-xs">
                    Koi item nahi hai cart mein.
                  </div>
                )}
              </div>
            </div>

            {/* Section 2: Calculation Breakdown */}
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-4 border border-orange-200 space-y-2">
              <p className="text-xs font-bold text-orange-800 uppercase tracking-wider mb-1">Calculation Breakdown</p>
              
              <div className="flex justify-between text-sm text-gray-600">
                <span>Items Subtotal ({cartItemCount} qty)</span>
                <span className="font-semibold text-gray-900">₹{cartTotal.toFixed(2)}</span>
              </div>

              <div className="flex items-center justify-between text-sm text-gray-600 pt-1 border-t border-orange-100">
                <span>Extra Discount (Optional ₹)</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                  placeholder="0"
                  className="w-24 text-right px-2 py-1 bg-white border border-orange-200 rounded-lg text-sm font-bold text-orange-700 outline-none focus:border-orange-500"
                />
              </div>

              <div className="flex justify-between text-base font-extrabold text-gray-900 pt-2 border-t-2 border-orange-200">
                <span className="text-orange-900">Kul Bill (Net Total)</span>
                <span className="text-2xl text-orange-600">₹{finalCartTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Section 3: Cash / Udhaar Selection & Process */}
            <div className="space-y-3">
              <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">Payment Mode Select Karo</p>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => setCheckoutType('cash')}
                  className={`p-3.5 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-1 ${
                    checkoutType === 'cash' ? 'border-green-500 bg-green-50 text-green-700 font-bold' : 'border-gray-200 text-gray-600'
                  }`}
                >
                  <Banknote className={`w-6 h-6 ${checkoutType === 'cash' ? 'text-green-600' : 'text-gray-400'}`} />
                  <span className="text-sm">Cash (Nokad)</span>
                </button>

                <button
                  onClick={() => setCheckoutType('udhaar')}
                  className={`p-3.5 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-1 ${
                    checkoutType === 'udhaar' ? 'border-red-500 bg-red-50 text-red-700 font-bold' : 'border-gray-200 text-gray-600'
                  }`}
                >
                  <CreditCard className={`w-6 h-6 ${checkoutType === 'udhaar' ? 'text-red-600' : 'text-gray-400'}`} />
                  <span className="text-sm">Udhaar (Khata)</span>
                </button>

                <button
                  onClick={() => setCheckoutType('split')}
                  className={`p-3.5 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-1 ${
                    checkoutType === 'split' ? 'border-amber-500 bg-amber-50 text-amber-700 font-bold' : 'border-gray-200 text-gray-600'
                  }`}
                >
                  <ArrowLeftRight className={`w-6 h-6 ${checkoutType === 'split' ? 'text-amber-600' : 'text-gray-400'}`} />
                  <span className="text-sm">Split (Aadha)</span>
                </button>
              </div>

              {/* Cash Options */}
              {checkoutType === 'cash' && (
                <div className="space-y-3 pt-1">
                  <div className="bg-blue-50/70 rounded-2xl p-3 space-y-2 border border-blue-100">
                    <p className="text-xs font-semibold text-blue-800 flex items-center gap-1">
                      <User className="w-3.5 h-3.5" /> Grahak ka Naam & Phone (Optional)
                    </p>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        ref={cashNameRef}
                        type="text"
                        value={cashCustomerName}
                        onChange={e => { setCashCustomerName(e.target.value); setShowCashAutocomplete(true); setSelectedRegularForBill(null); }}
                        onFocus={() => setShowCashAutocomplete(true)}
                        placeholder="Naam type karo..."
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-blue-200 focus:border-blue-500 outline-none text-sm bg-white"
                        autoComplete="off"
                      />
                      {showCashAutocomplete && cashNameSuggestions.length > 0 && (
                        <div className="absolute z-50 top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg mt-1 overflow-hidden">
                          {cashNameSuggestions.map((s, i) => (
                            <button key={i} onMouseDown={() => selectCashCustomer(s.name, s.phone)}
                              className="w-full flex items-center justify-between px-3 py-2 hover:bg-blue-50 text-left border-b border-gray-50 last:border-0">
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-blue-400" />
                                <div>
                                  <p className="text-xs font-semibold text-gray-800">{s.name}</p>
                                  {s.phone && <p className="text-[10px] text-gray-400">{s.phone}</p>}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="tel"
                        inputMode="numeric"
                        value={cashCustomerPhone}
                        onChange={e => { setCashCustomerPhone(e.target.value); setShowPhoneAutocomplete(true); }}
                        onFocus={() => setShowPhoneAutocomplete(true)}
                        placeholder="Phone number (optional)"
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-blue-200 focus:border-blue-500 outline-none text-sm bg-white"
                        autoComplete="off"
                      />
                    </div>
                  </div>

                  {/* Dynamic UPI QR Code Section */}
                  <div className="bg-gradient-to-br from-purple-50 via-indigo-50 to-purple-100 rounded-2xl p-3 border border-purple-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-purple-600 text-white flex items-center justify-center font-bold text-xs">
                          UPI
                        </div>
                        <div>
                          <p className="text-xs font-bold text-purple-900">Dynamic UPI QR Code (GPay / PhonePe / Paytm)</p>
                          <p className="text-[10px] text-purple-600">Scan to pay exact ₹{finalCartTotal.toFixed(2)}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowUPIQR(prev => !prev)}
                        className="text-xs px-2.5 py-1 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold transition-colors"
                      >
                        {showUPIQR ? 'QR Chhupao' : 'QR Dikhayein 📱'}
                      </button>
                    </div>

                    {showUPIQR && (
                      <div className="pt-2 text-center flex flex-col items-center space-y-2 bg-white p-3 rounded-xl border border-purple-100 shadow-inner">
                        {state.businessProfile.upiId ? (
                          <>
                            <div className="bg-white p-2 rounded-2xl border-2 border-purple-300 shadow-md inline-block">
                              <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                                  `upi://pay?pa=${state.businessProfile.upiId.trim()}&pn=${encodeURIComponent(state.businessProfile.shopName || 'Dukaan POS')}&am=${finalCartTotal.toFixed(2)}&cu=INR&tn=Bill%20Payment`
                                )}`}
                                alt="UPI QR Code"
                                className="w-40 h-40 object-contain mx-auto"
                              />
                            </div>
                            <p className="text-xs font-black text-gray-900">Scan & Pay: ₹{finalCartTotal.toFixed(2)}</p>
                            <p className="text-[10px] text-gray-500">UPI ID: <span className="font-semibold text-purple-700">{state.businessProfile.upiId}</span></p>
                            <div className="flex items-center gap-1.5 justify-center pt-1 text-[10px] text-gray-400 font-medium">
                              <span className="px-2 py-0.5 bg-gray-100 rounded-md border">GPay</span>
                              <span className="px-2 py-0.5 bg-gray-100 rounded-md border">PhonePe</span>
                              <span className="px-2 py-0.5 bg-gray-100 rounded-md border">Paytm</span>
                              <span className="px-2 py-0.5 bg-gray-100 rounded-md border">BHIM</span>
                            </div>
                          </>
                        ) : (
                          <div className="w-full space-y-2 py-2">
                            <p className="text-xs text-amber-800 font-medium bg-amber-50 p-2 rounded-lg border border-amber-200">
                              ⚠️ Dukaan ka UPI ID set nahi hai! Niche UPI ID type karke Save karein:
                            </p>
                            <div className="flex gap-1.5">
                              <input
                                type="text"
                                value={customUPIInput}
                                onChange={e => setCustomUPIInput(e.target.value)}
                                placeholder="jaise: shopname@paytm"
                                className="flex-1 px-3 py-1.5 rounded-xl border border-purple-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-400"
                              />
                              <button
                                onClick={() => {
                                  if (!customUPIInput.trim()) return;
                                  updateBusinessProfile({ ...state.businessProfile, upiId: customUPIInput.trim() });
                                  setCustomUPIInput('');
                                  showToast('UPI ID save ho gaya!', 'success');
                                }}
                                className="px-3 py-1.5 bg-purple-600 text-white rounded-xl text-xs font-bold hover:bg-purple-700"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Udhaar Customer Search */}
              {checkoutType !== 'cash' && (
                <div className="space-y-2 pt-1">
                  <Label className="text-xs">{checkoutType === 'split' ? 'Split Khatadar Chunein (baaki udhaar)' : 'Udhaar Khatadar Chunein'}</Label>
                  {!selectedCustomer ? (
                    <>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input value={customerSearch} onChange={e => setCustomerSearch(e.target.value)}
                          placeholder="Naam ya phone..." className="pl-9 rounded-xl h-10 text-sm" />
                      </div>
                      <div className="max-h-36 overflow-y-auto space-y-1.5 pt-1">
                        {filteredCustomers.map(customer => (
                          <button key={customer.id} onClick={() => setSelectedCustomer(customer)}
                            className="w-full flex items-center justify-between p-2.5 bg-gray-50 rounded-xl hover:bg-orange-50 text-left border border-gray-100">
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
                          className="w-full p-2.5 text-orange-600 bg-orange-50 rounded-xl hover:bg-orange-100 text-sm font-medium flex items-center justify-center gap-1">
                          <Plus className="w-4 h-4" /> Naya Grahak Add Karo
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-orange-50 rounded-2xl border border-orange-200">
                        <div className="flex items-center gap-2">
                          <User className="w-5 h-5 text-orange-600" />
                          <div>
                            <span className="font-bold text-gray-900 text-sm">{selectedCustomer.name}</span>
                            <p className="text-xs font-semibold text-gray-500">
                              {selectedCustomer.totalDue < 0
                                ? `✅ Advance Balance: ₹${Math.abs(selectedCustomer.totalDue).toFixed(2)}`
                                : selectedCustomer.totalDue > 0
                                ? `⚠️ Purana Baki: ₹${selectedCustomer.totalDue.toFixed(2)}`
                                : 'Hisaab Clear (₹0)'}
                            </p>
                          </div>
                        </div>
                        <button onClick={() => setSelectedCustomer(null)} className="p-1 text-gray-400 hover:text-red-500">
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Abhi kitne diye (Partial Cash Payment input) */}
                      <div className="bg-gray-50 p-3 rounded-2xl border border-gray-200 space-y-2">
                        <Label className="text-xs font-bold text-gray-700">
                          💵 Abhi Kitne Paise Jama Kiye? (Optional)
                        </Label>
                        <Input
                          type="number"
                          inputMode="decimal"
                          value={amountPaidInput}
                          onChange={e => setAmountPaidInput(e.target.value)}
                          placeholder="0 (Poora Udhaar)"
                          className="rounded-xl h-11 text-center text-lg font-bold bg-white"
                        />
                        
                        {/* Summary breakdown */}
                        <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                          <div className="p-2 bg-blue-50 rounded-xl border border-blue-100 text-center">
                            <span className="text-blue-600 block text-[10px]">Abhi Diye (Cash)</span>
                            <span className="font-bold text-blue-900 text-sm">
                              ₹{(parseFloat(amountPaidInput) || 0).toFixed(2)}
                            </span>
                          </div>
                          <div className="p-2 bg-red-50 rounded-xl border border-red-100 text-center">
                            <span className="text-red-600 block text-[10px]">Khate Mein Baki (Udhaar)</span>
                            <span className="font-bold text-red-900 text-sm">
                              ₹{Math.max(0, finalCartTotal - (parseFloat(amountPaidInput) || 0)).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="p-4 bg-gray-50 border-t border-gray-200 flex gap-2">
            <Button
              variant="outline"
              onClick={saveDraft}
              className="rounded-2xl h-12 text-sm border-orange-300 text-orange-600 hover:bg-orange-50 font-semibold"
            >
              <Save className="w-4 h-4 mr-1.5" /> Hold Bill
            </Button>

            <Button
              onClick={handleCheckout}
              disabled={cart.length === 0 || (checkoutType !== 'cash' && !selectedCustomer)}
              className="flex-1 rounded-2xl h-12 bg-gradient-to-r from-orange-500 via-red-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold text-base shadow-lg"
            >
              <Check className="w-5 h-5 mr-1.5" /> Bill Pura Karo (₹{finalCartTotal.toFixed(2)})
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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

      {/* Barcode Scanner Dialog */}
      <BarcodeScanner isOpen={showScanner} onClose={() => setShowScanner(false)} />

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
            <div className="grid grid-cols-3 gap-3">
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
              <button onClick={() => setCheckoutType('split')}
                className={`p-4 rounded-2xl border-2 transition-all ${checkoutType === 'split' ? 'border-amber-500 bg-amber-50' : 'border-gray-200'}`}>
                <ArrowLeftRight className={`w-7 h-7 mx-auto mb-1.5 ${checkoutType === 'split' ? 'text-amber-600' : 'text-gray-400'}`} />
                <p className={`font-semibold text-sm ${checkoutType === 'split' ? 'text-amber-700' : 'text-gray-600'}`}>Split</p>
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

            {/* Customer Selection for Udhaar / Split */}
            {checkoutType !== 'cash' && (
              <div>
                <Label className="mb-2 block text-sm">{checkoutType === 'split' ? 'Grahak Chunein (baaki udhaar)' : 'Grahak Chunein'}</Label>
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
                  <div className="space-y-3">
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
                  {checkoutType === 'split' && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                      <Label className="text-xs font-bold text-amber-700">💵 Abhi Cash Kitna De Raha Hai?</Label>
                      <Input
                        type="number" inputMode="decimal"
                        value={amountPaidInput}
                        onChange={e => setAmountPaidInput(e.target.value)}
                        placeholder={`0 se ${cartTotal.toFixed(0)} tak`}
                        className="rounded-xl h-11 text-center text-lg font-bold bg-white"
                      />
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 bg-blue-50 rounded-xl border border-blue-100 text-center">
                          <span className="text-blue-600 block text-[10px]">Cash (abhi)</span>
                          <span className="font-bold text-blue-900 text-sm">₹{(parseFloat(amountPaidInput) || 0).toFixed(2)}</span>
                        </div>
                        <div className="p-2 bg-red-50 rounded-xl border border-red-100 text-center">
                          <span className="text-red-600 block text-[10px]">Udhaar (baaki)</span>
                          <span className="font-bold text-red-900 text-sm">₹{Math.max(0, cartTotal - (parseFloat(amountPaidInput) || 0)).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pb-2">
              <Button variant="outline" onClick={() => setShowCheckout(false)} className="flex-1 rounded-2xl h-12">Cancel</Button>
              <Button onClick={handleCheckout} disabled={checkoutType !== 'cash' && !selectedCustomer}
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
                {(lastSale.type === 'udhaar' || lastSale.type === 'split') && (
                  <div className="mt-2 space-y-1">
                    {(lastSale.amountPaid || 0) > 0 && (
                      <p className="text-sm text-green-600">✅ Mila: ₹{(lastSale.amountPaid || 0).toFixed(2)}</p>
                    )}
                    <p className="text-base font-bold text-red-600">
                      📋 {lastSale.type === 'split' ? 'Split — Udhaar Baaki' : 'Udhaar Baaki'}: ₹{(lastSale.total - (lastSale.amountPaid || 0)).toFixed(2)}
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
