// Inventory Section - Stock Management
import { useState, useMemo, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Package, 
  AlertTriangle,
  Check,
  Truck,
  TrendingDown,
  ScanBarcode
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { VoiceSearchMic } from '@/components/VoiceSearchMic';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useApp } from '@/context/AppContext';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PurchaseDialog } from '@/components/PurchaseDialog';
import { OrderDialog } from '@/components/OrderDialog';
import { BarcodeScanner } from '@/components/BarcodeScanner';
import { lookupBarcode, normalizeBarcode } from '@/utils/productLookup';
import { getProductSuggestions, categories } from '@/utils/masterProducts';
import type { Product } from '@/types';

export function InventorySection() {
  const { state, addProduct, updateProduct, deleteProduct, getLowStockProducts, showToast } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [showLowStock, setShowLowStock] = useState(false);
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const [showOrderDialog, setShowOrderDialog] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category: 'Grocery',
    salePrice: '',
    costPrice: '',
    stock: '',
    minStock: '',
    unit: 'kg',
    barcode: '',
    expiryDate: '',
  });
  const [suggestions, setSuggestions] = useState<ReturnType<typeof getProductSuggestions>>([]);

  const lowStockProducts = getLowStockProducts();

  // ── Barcode lookup: naam/brand auto-fill (price manual — barcode mein price nahi hota) ──
  const doBarcodeLookup = async (rawCode: string) => {
    const code = normalizeBarcode(rawCode);
    if (code.length < 8) return;
    setLookingUp(true);
    try {
      const found = await lookupBarcode(code);
      if (found) {
        setFormData(prev => ({
          ...prev,
          barcode: code,
          // User ne naam pehle se likha ho toh overwrite MAT karo
          ...(prev.name.trim() ? {} : { name: found.name }),
        }));
        showToast(
          `"${found.name}" mil gaya!${found.brand ? ` (${found.brand})` : ''}${found.quantity ? ` — ${found.quantity}` : ''} Rate haath se dalo.`,
          'success'
        );
      } else {
        setFormData(prev => ({ ...prev, barcode: code }));
        showToast('Naam nahi mila — naam aur rate haath se likho.', 'info');
      }
    } finally {
      setLookingUp(false);
    }
  };

  // Cart-scan se "Naya Product Banao" → form barcode ke saath kholo + lookup
  useEffect(() => {
    const handler = (e: Event) => {
      const barcode = (e as CustomEvent).detail?.barcode as string | undefined;
      resetForm();
      setEditingProduct(null);
      setShowAddDialog(true);
      if (barcode) void doBarcodeLookup(barcode);
    };
    window.addEventListener('prefill-add-product', handler);
    return () => window.removeEventListener('prefill-add-product', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Expiry helpers ──
  const getExpiryStatus = (expiryDate?: string): 'expired' | 'soon' | 'ok' | 'none' => {
    if (!expiryDate) return 'none';
    const today = new Date().toISOString().split('T')[0];
    if (expiryDate < today) return 'expired';
    const soonLimit = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
    if (expiryDate <= soonLimit) return 'soon';
    return 'ok';
  };
  const expiredProducts = state.products.filter(p => getExpiryStatus(p.expiryDate) === 'expired');
  const soonExpiringProducts = state.products.filter(p => getExpiryStatus(p.expiryDate) === 'soon');

  const filteredProducts = useMemo(() => {
    let products = state.products;
    
    if (showLowStock) {
      products = lowStockProducts;
    }
    
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
  }, [state.products, searchQuery, selectedCategory, showLowStock, lowStockProducts]);

  const handleNameChange = (value: string) => {
    setFormData({ ...formData, name: value });
    setSuggestions(getProductSuggestions(value));
  };

  const handleSuggestionClick = (suggestion: ReturnType<typeof getProductSuggestions>[0]) => {
    setFormData({
      ...formData,
      name: suggestion.name,
      category: suggestion.category,
      salePrice: suggestion.suggestedPrice.toString(),
      unit: suggestion.unit,
    });
    setSuggestions([]);
  };

  const handleSubmit = () => {
    const productData = {
      name: formData.name,
      sku: formData.sku || `SKU-${Date.now()}`,
      category: formData.category,
      salePrice: parseFloat(formData.salePrice) || 0,
      costPrice: parseFloat(formData.costPrice) || 0,
      stock: parseInt(formData.stock) || 0,
      minStock: parseInt(formData.minStock) || 5,
      unit: formData.unit,
      barcode: formData.barcode.trim() || undefined,
      expiryDate: formData.expiryDate || undefined,
    };

    if (editingProduct) {
      updateProduct({ ...editingProduct, ...productData });
    } else {
      addProduct(productData);
    }

    resetForm();
    setShowAddDialog(false);
    setEditingProduct(null);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      sku: '',
      category: 'Grocery',
      salePrice: '',
      costPrice: '',
      stock: '',
      minStock: '',
      unit: 'kg',
      barcode: '',
      expiryDate: '',
    });
    setSuggestions([]);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      sku: product.sku,
      category: product.category,
      salePrice: product.salePrice.toString(),
      costPrice: product.costPrice.toString(),
      stock: product.stock.toString(),
      minStock: product.minStock.toString(),
      unit: product.unit,
      barcode: product.barcode || '',
      expiryDate: product.expiryDate || '',
    });
    setShowAddDialog(true);
  };

  const handleDelete = () => {
    if (productToDelete) {
      deleteProduct(productToDelete);
      setProductToDelete(null);
    }
  };

  return (
    <div className="p-4 lg:p-8 pb-24 lg:pb-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Stock Inventory</h2>
          <p className="text-gray-500">Manage your products and stock levels</p>
        </div>
        <div className="flex gap-2">
        <Button
          onClick={() => setShowPurchaseDialog(true)}
          className="rounded-2xl h-12 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
        >
          <Truck className="w-5 h-5 mr-2" />
          Kharid
        </Button>
        <Button
          onClick={() => {
            resetForm();
            setEditingProduct(null);
            setShowAddDialog(true);
          }}
          className="rounded-2xl h-12 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Product
        </Button>
        </div>
      </div>

      {/* Expiry Alert */}
      {(expiredProducts.length > 0 || soonExpiringProducts.length > 0) && (
        <Card className="rounded-3xl border-0 shadow-lg mb-6 bg-gradient-to-r from-amber-50 to-yellow-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-amber-900">Expiry Alert</h3>
                <p className="text-sm text-amber-700">
                  {expiredProducts.length > 0 && `${expiredProducts.length} expired (${expiredProducts.map(p => p.name).join(', ')})`}
                  {expiredProducts.length > 0 && soonExpiringProducts.length > 0 && ' • '}
                  {soonExpiringProducts.length > 0 && `${soonExpiringProducts.length} soon expiring (30 din): ${soonExpiringProducts.map(p => `${p.name} (${p.expiryDate})`).join(', ')}`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Low Stock Alert */}
      {lowStockProducts.length > 0 && (
        <Card className="rounded-3xl border-0 shadow-lg mb-6 bg-gradient-to-r from-red-50 to-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                  <TrendingDown className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-red-900">Low Stock Alert</h3>
                  <p className="text-sm text-red-700">{lowStockProducts.length} items below minimum stock</p>
                </div>
              </div>
              <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowLowStock(!showLowStock)}
                className="rounded-2xl border-red-200 text-red-600 hover:bg-red-100"
              >
                {showLowStock ? 'Show All' : 'View Low Stock'}
              </Button>
              <Button
                onClick={() => setShowOrderDialog(true)}
                className="rounded-2xl bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Truck className="w-4 h-4 mr-1.5" /> Order Karo
              </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or SKU..."
              className="pl-12 pr-12 rounded-2xl h-12"
            />
            <VoiceSearchMic onResult={(t) => setSearchQuery(t)} />
          </div>
        <div className="flex gap-2 overflow-x-auto pb-2 lg:pb-0">
          {categories.map((cat) => (
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredProducts.map((product) => {
          const isLowStock = product.stock <= product.minStock;
          const isOutOfStock = product.stock === 0;

          return (
            <Card
              key={product.id}
              className={`rounded-3xl border-0 shadow-lg overflow-hidden transition-all hover:shadow-xl ${
                isOutOfStock ? 'opacity-70' : ''
              }`}
            >
              <div className={`h-2 ${isLowStock ? 'bg-red-500' : 'bg-green-500'}`} />
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 line-clamp-1">{product.name}</h3>
                    <p className="text-sm text-gray-500">{product.sku}</p>
                  </div>
                  <span className="px-2 py-1 bg-gray-100 rounded-lg text-xs font-medium text-gray-600">
                    {product.category}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-gray-50 rounded-xl p-2">
                    <p className="text-xs text-gray-500">Sale Price</p>
                    <p className="font-semibold text-gray-900">₹{product.salePrice}</p>
                  </div>
                  <div className={`rounded-xl p-2 ${isLowStock ? 'bg-red-50' : 'bg-gray-50'}`}>
                    <p className={`text-xs ${isLowStock ? 'text-red-600' : 'text-gray-500'}`}>Stock</p>
                    <p className={`font-semibold ${isLowStock ? 'text-red-700' : 'text-gray-900'}`}>
                      {product.stock} {product.unit}
                    </p>
                  </div>
                </div>

                {isOutOfStock && (
                  <div className="flex items-center gap-2 text-red-600 text-sm mb-3">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="font-medium">Out of Stock</span>
                  </div>
                )}
                {(() => {
                  const exp = getExpiryStatus(product.expiryDate);
                  if (exp === 'none' || exp === 'ok') return null;
                  return (
                    <div className={`flex items-center gap-2 text-sm mb-3 ${exp === 'expired' ? 'text-red-600' : 'text-amber-600'}`}>
                      <AlertTriangle className="w-4 h-4" />
                      <span className="font-medium">
                        {exp === 'expired' ? `Expired (${product.expiryDate})` : `Expiring: ${product.expiryDate}`}
                      </span>
                    </div>
                  );
                })()}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(product)}
                    className="flex-1 rounded-xl h-10"
                  >
                    <Edit2 className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setProductToDelete(product.id)}
                    className="rounded-xl h-10 px-3 border-red-200 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredProducts.length === 0 && (
        <div className="text-center py-12">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No products found</h3>
          <p className="text-gray-500">Add your first product to get started</p>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-lg rounded-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Edit Product' : 'Add New Product'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {/* Name with Suggestions + barcode scan icon (scan karke naam auto-fill) */}
            <div className="relative">
              <div className="flex items-center justify-between">
                <Label>Name</Label>
                <button
                  type="button"
                  onClick={() => setShowBarcodeScanner(true)}
                  title="Camera se barcode scan karo — naam auto-bhar jayega"
                  aria-label="Scan barcode"
                  className="w-9 h-9 rounded-xl bg-gray-900 text-white flex items-center justify-center hover:bg-gray-800 active:scale-95 transition-all"
                >
                  <ScanBarcode className="w-5 h-5" />
                </button>
              </div>
              <Input
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Product name"
                className="rounded-2xl h-12 mt-1"
              />
              {suggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-2xl shadow-lg overflow-hidden">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center justify-between"
                    >
                      <span className="font-medium">{suggestion.name}</span>
                      <span className="text-sm text-gray-500">{suggestion.category}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>SKU (Optional)</Label>
                <Input
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  placeholder="Auto-generated"
                  className="rounded-2xl h-12"
                />
              </div>
              <div>
                <Label>Category</Label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none"
                >
                  {categories.filter(c => c !== 'All').map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Sale Price (₹)</Label>
                <Input
                  type="number"
                  value={formData.salePrice}
                  onChange={(e) => setFormData({ ...formData, salePrice: e.target.value })}
                  placeholder="0.00"
                  className="rounded-2xl h-12"
                />
              </div>
              <div>
                <Label>Cost Price (₹)</Label>
                <Input
                  type="number"
                  value={formData.costPrice}
                  onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                  placeholder="0.00"
                  className="rounded-2xl h-12"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Current Stock</Label>
                <Input
                  type="number"
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                  placeholder="0"
                  className="rounded-2xl h-12"
                />
              </div>
              <div>
                <Label>Min Stock Alert</Label>
                <Input
                  type="number"
                  value={formData.minStock}
                  onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}
                  placeholder="5"
                  className="rounded-2xl h-12"
                />
              </div>
            </div>

            <div>
              <Label>Unit</Label>
              <select
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none"
              >
                <option value="kg">Kilogram (kg)</option>
                <option value="g">Gram (g)</option>
                <option value="litre">Litre</option>
                <option value="ml">Millilitre (ml)</option>
                <option value="pc">Piece (pc)</option>
                <option value="pack">Pack</option>
                <option value="bottle">Bottle</option>
                <option value="can">Can</option>
                <option value="sachet">Sachet</option>
              </select>
            </div>

            <div>
              <Label>Barcode (optional — packet scan ke liye)</Label>
              <Input
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                onBlur={(e) => { if (e.target.value.trim()) void doBarcodeLookup(e.target.value); }}
                placeholder="8901234567890"
                inputMode="numeric"
                className="rounded-2xl h-12 font-mono"
              />
              {lookingUp && (
                <p className="text-xs text-blue-600 mt-1 animate-pulse">Naam dhundh rahe hain...</p>
              )}
              <p className="text-[11px] text-gray-400 mt-1">Upar scan icon se scan karo — naam auto-bharega • Rate haath se dalna hoga</p>
            </div>

            <div>
              <Label>Expiry Date (optional — doodh/dawai ke liye)</Label>
              <Input
                type="date"
                value={formData.expiryDate}
                onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                className="rounded-2xl h-12"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowAddDialog(false)}
                className="flex-1 rounded-2xl h-12"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!formData.name}
                className="flex-1 rounded-2xl h-12 bg-gradient-to-r from-orange-500 to-red-600"
              >
                <Check className="w-5 h-5 mr-2" />
                {editingProduct ? 'Update' : 'Add'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!productToDelete}
        onClose={() => setProductToDelete(null)}
        onConfirm={handleDelete}
        title="Delete Product?"
        description="This will permanently delete this product from your inventory. This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />

      {/* Kharid Dialog */}
      <PurchaseDialog isOpen={showPurchaseDialog} onClose={() => setShowPurchaseDialog(false)} />

      {/* Supplier Order Dialog */}
      <OrderDialog isOpen={showOrderDialog} onClose={() => setShowOrderDialog(false)} />

      {/* Barcode Scanner (capture mode — code form mein bharo) */}
      <BarcodeScanner
        isOpen={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        mode="capture"
        onCapture={(code) => { setShowBarcodeScanner(false); void doBarcodeLookup(code); }}
      />
    </div>
  );
}
