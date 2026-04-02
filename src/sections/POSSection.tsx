// POS Section - Point of Sale (Bikri)
import { useState, useMemo } from 'react';
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
  ArrowRight
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
import type { CartItem, Product, Customer, Sale } from '@/types';

export function POSSection() {
  const { state, addSale, addDraft, deleteDraft, addCustomer } = useApp();
  
  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
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
  const [showBillDialog, setShowBillDialog] = useState(false);
  const [amountPaidInput, setAmountPaidInput] = useState('');
  
  // New customer form
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' });

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

  // Add to cart
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

    // If adding a brand new customer inline
    let finalCustomer = selectedCustomer;
    if (!finalCustomer && newCustomer.name && checkoutType === 'udhaar') {
      addCustomer({ name: newCustomer.name, phone: newCustomer.phone, address: '' });
    }

    const saleData = {
      items: saleItems,
      total: cartTotal,
      type: checkoutType,
      customerId: finalCustomer?.id,
      customerName: finalCustomer?.name,
      amountPaid: paid > 0 ? paid : undefined,
      changeReturned: change > 0 ? change : undefined,
    };

    addSale(saleData);

    // Build a fake Sale obj for bill display (will be replaced by real one from state)
    const fakeSale: Sale = {
      id: 'pending',
      billNumber: `BILL-${String(state.billCounter + 1).padStart(4,'0')}`,
      ...saleData,
      createdAt: Date.now(),
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
    };
    setLastSale(fakeSale);
    setShowBillDialog(true);

    setCart([]);
    setShowCheckout(false);
    setSelectedCustomer(null);
    setCheckoutType('cash');
    setAmountPaidInput('');
    setNewCustomer({ name: '', phone: '' });
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
          <div className="flex gap-2">
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
          </div>
        </div>

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
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-600">Total</span>
              <span className="text-2xl font-bold text-gray-900">₹{cartTotal.toFixed(2)}</span>
            </div>
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
                {(lastSale.changeReturned || 0) > 0 && (
                  <p className="text-base font-bold text-orange-600 mt-2">
                    ↩ Wapas Karo: ₹{lastSale.changeReturned?.toFixed(2)}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={() => { printBill({ sale: lastSale, customer: selectedCustomer, business: state.businessProfile, theme: 'modern' }); }}
                  className="rounded-xl h-11 text-xs border-orange-200 text-orange-700"
                >
                  🖨️ Print Bill
                </Button>
                {(selectedCustomer?.phone || lastSale.customerName) && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      const msg = generateWhatsAppBill(lastSale, state.businessProfile, selectedCustomer);
                      const phone = selectedCustomer?.phone || '';
                      window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
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
                    // Add customer and select them
                    const customer = {
                      id: Date.now().toString(),
                      name: newCustomer.name,
                      phone: newCustomer.phone,
                      address: '',
                      totalDue: 0,
                      createdAt: Date.now(),
                    };
                    setSelectedCustomer(customer);
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
