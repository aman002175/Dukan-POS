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
import type { CartItem, Product, Customer } from '@/types';

export function POSSection() {
  const { state, addSale, addDraft, deleteDraft } = useApp();
  
  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  // Dialog states
  const [showDrafts, setShowDrafts] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutType, setCheckoutType] = useState<'cash' | 'udhaar'>('cash');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  
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

  // Save draft
  const saveDraft = () => {
    if (cart.length === 0) return;
    addDraft({ items: cart });
    setCart([]);
    setShowDrafts(false);
  };

  // Load draft
  const loadDraft = (draftItems: CartItem[]) => {
    setCart(draftItems);
    setShowDrafts(false);
  };

  // Handle checkout
  const handleCheckout = () => {
    if (cart.length === 0) return;

    const saleItems = cart.map(item => ({
      productId: item.product.id,
      name: item.product.name,
      price: item.product.salePrice,
      quantity: item.quantity,
      total: item.product.salePrice * item.quantity,
    }));

    addSale({
      items: saleItems,
      total: cartTotal,
      type: checkoutType,
      customerId: selectedCustomer?.id,
      customerName: selectedCustomer?.name,
    });

    setCart([]);
    setShowCheckout(false);
    setSelectedCustomer(null);
    setCheckoutType('cash');
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
          <DialogHeader>
            <DialogTitle>Draft Bills</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-4 max-h-96 overflow-y-auto">
            {state.drafts.map((draft) => (
              <div
                key={draft.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl"
              >
                <div>
                  <p className="font-medium">{draft.items.length} items</p>
                  <p className="text-sm text-gray-500">
                    Total: ₹{draft.items.reduce((sum, item) => sum + (item.product.salePrice * item.quantity), 0).toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(draft.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => loadDraft(draft.items)}
                    className="rounded-xl"
                  >
                    Load
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteDraft(draft.id)}
                    className="rounded-xl border-red-200 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
            {state.drafts.length === 0 && (
              <p className="text-center text-gray-500 py-8">No draft bills</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Checkout Dialog */}
      <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>Checkout</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {/* Total */}
            <div className="bg-gradient-to-r from-orange-500 to-red-600 rounded-2xl p-6 text-white text-center mb-6">
              <p className="text-orange-100 mb-1">Total Amount</p>
              <p className="text-4xl font-bold">₹{cartTotal.toFixed(2)}</p>
            </div>

            {/* Payment Type */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <button
                onClick={() => setCheckoutType('cash')}
                className={`p-4 rounded-2xl border-2 transition-all ${
                  checkoutType === 'cash'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Banknote className={`w-8 h-8 mx-auto mb-2 ${
                  checkoutType === 'cash' ? 'text-green-600' : 'text-gray-400'
                }`} />
                <p className={`font-medium ${
                  checkoutType === 'cash' ? 'text-green-700' : 'text-gray-600'
                }`}>Cash</p>
              </button>
              <button
                onClick={() => setCheckoutType('udhaar')}
                className={`p-4 rounded-2xl border-2 transition-all ${
                  checkoutType === 'udhaar'
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <CreditCard className={`w-8 h-8 mx-auto mb-2 ${
                  checkoutType === 'udhaar' ? 'text-red-600' : 'text-gray-400'
                }`} />
                <p className={`font-medium ${
                  checkoutType === 'udhaar' ? 'text-red-700' : 'text-gray-600'
                }`}>Udhaar</p>
              </button>
            </div>

            {/* Customer Selection for Udhaar */}
            {checkoutType === 'udhaar' && (
              <div className="mb-6">
                <Label className="mb-2 block">Select Customer</Label>
                {!selectedCustomer ? (
                  <>
                    <div className="relative mb-3">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        placeholder="Search customers..."
                        className="pl-10 rounded-2xl"
                      />
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-2">
                      {filteredCustomers.map((customer) => (
                        <button
                          key={customer.id}
                          onClick={() => setSelectedCustomer(customer)}
                          className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100"
                        >
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-400" />
                            <span className="font-medium">{customer.name}</span>
                          </div>
                          <span className="text-sm text-gray-500">
                            Due: ₹{customer.totalDue.toFixed(2)}
                          </span>
                        </button>
                      ))}
                      {filteredCustomers.length === 0 && (
                        <button
                          onClick={() => setShowAddCustomer(true)}
                          className="w-full p-3 text-orange-600 bg-orange-50 rounded-xl hover:bg-orange-100"
                        >
                          <Plus className="w-4 h-4 inline mr-1" />
                          Add New Customer
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-green-600" />
                      <span className="font-medium text-green-700">{selectedCustomer.name}</span>
                    </div>
                    <button
                      onClick={() => setSelectedCustomer(null)}
                      className="text-green-600 hover:text-green-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowCheckout(false)}
                className="flex-1 rounded-2xl h-12"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCheckout}
                disabled={checkoutType === 'udhaar' && !selectedCustomer}
                className="flex-1 rounded-2xl h-12 bg-gradient-to-r from-orange-500 to-red-600"
              >
                <Check className="w-5 h-5 mr-2" />
                Complete
              </Button>
            </div>
          </div>
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
