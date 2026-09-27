/**
 * PurchaseDialog — Kharid / Stock-Inward entry.
 * Supplier se maal aaya: product rows (qty + kharid rate) + supplier + save.
 * Save → addPurchase() → stock += qty, costPrice weighted-average, purchase record.
 */
import { useState } from 'react';
import { Plus, Trash2, Truck, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useApp } from '@/context/AppContext';

interface PurchaseRow {
  key: string;
  productId: string;
  quantity: string;
  purchasePrice: string;
}

interface PurchaseDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

let rowCounter = 0;
function newRow(): PurchaseRow {
  rowCounter += 1;
  return { key: `row-${Date.now()}-${rowCounter}`, productId: '', quantity: '', purchasePrice: '' };
}

export function PurchaseDialog({ isOpen, onClose }: PurchaseDialogProps) {
  const { state, addPurchase } = useApp();
  const [rows, setRows] = useState<PurchaseRow[]>([newRow()]);
  const [supplierName, setSupplierName] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [note, setNote] = useState('');

  const updateRow = (key: string, field: keyof PurchaseRow, value: string) => {
    setRows(prev => prev.map(r => r.key === key ? { ...r, [field]: value } : r));
  };

  const removeRow = (key: string) => {
    setRows(prev => (prev.length > 1 ? prev.filter(r => r.key !== key) : prev));
  };

  const reset = () => {
    setRows([newRow()]);
    setSupplierName('');
    setSupplierPhone('');
    setNote('');
  };

  const rowTotal = (r: PurchaseRow) => (parseFloat(r.quantity) || 0) * (parseFloat(r.purchasePrice) || 0);
  const grandTotal = rows.reduce((s, r) => s + rowTotal(r), 0);
  const validCount = rows.filter(r => r.productId && (parseFloat(r.quantity) || 0) > 0).length;

  const handleSave = () => {
    addPurchase({
      items: rows
        .filter(r => r.productId && (parseFloat(r.quantity) || 0) > 0)
        .map(r => ({
          productId: r.productId,
          quantity: parseFloat(r.quantity) || 0,
          purchasePrice: parseFloat(r.purchasePrice) || 0,
        })),
      supplierName: supplierName.trim() || undefined,
      supplierPhone: supplierPhone.trim() || undefined,
      note: note.trim() || undefined,
    });
    reset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { reset(); onClose(); } }}>
      <DialogContent className="sm:max-w-lg rounded-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-green-600" /> Kharid — Stock Lao
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mt-4">
          {rows.map((row, idx) => {
            const product = state.products.find(p => p.id === row.productId);
            return (
              <div key={row.key} className="bg-gray-50 rounded-2xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-400">Item #{idx + 1}</span>
                  {rows.length > 1 && (
                    <button onClick={() => removeRow(row.key)} className="text-red-400 hover:text-red-600" aria-label="Row hatao">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div>
                  <Label>Product</Label>
                  <select
                    value={row.productId}
                    onChange={e => updateRow(row.key, 'productId', e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none bg-white"
                  >
                    <option value="">— Product chuno —</option>
                    {state.products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} (stock: {p.stock} {p.unit})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label>Qty{product ? ` (${product.unit})` : ''}</Label>
                    <Input
                      type="number" inputMode="decimal"
                      value={row.quantity}
                      onChange={e => updateRow(row.key, 'quantity', e.target.value)}
                      placeholder="0"
                      className="rounded-xl h-11"
                    />
                  </div>
                  <div>
                    <Label>Kharid Rate (₹)</Label>
                    <Input
                      type="number" inputMode="decimal"
                      value={row.purchasePrice}
                      onChange={e => updateRow(row.key, 'purchasePrice', e.target.value)}
                      placeholder={product ? String(product.costPrice || '') : '0'}
                      className="rounded-xl h-11"
                    />
                  </div>
                  <div>
                    <Label>Total</Label>
                    <div className="px-3 py-2.5 rounded-xl bg-white border border-gray-200 text-sm font-bold text-gray-900 h-11 flex items-center">
                      ₹{rowTotal(row).toFixed(0)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <Button
            variant="outline" onClick={() => setRows(prev => [...prev, newRow()])}
            className="w-full rounded-2xl h-11 border-dashed"
          >
            <Plus className="w-4 h-4 mr-2" /> Aur Item Add Karo
          </Button>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Supplier Naam</Label>
              <Input
                value={supplierName} onChange={e => setSupplierName(e.target.value)}
                placeholder="Sharma Traders" className="rounded-2xl h-11"
              />
            </div>
            <div>
              <Label>Supplier Phone</Label>
              <Input
                type="tel" inputMode="tel"
                value={supplierPhone} onChange={e => setSupplierPhone(e.target.value)}
                placeholder="98765..." className="rounded-2xl h-11"
              />
            </div>
          </div>

          <div>
            <Label>Note (optional)</Label>
            <Input
              value={note} onChange={e => setNote(e.target.value)}
              placeholder="Bina bill ke maal..." className="rounded-2xl h-11"
            />
          </div>

          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center justify-between">
            <span className="text-sm font-semibold text-green-700">Kul Kharid</span>
            <span className="text-2xl font-black text-green-700">₹{grandTotal.toFixed(0)}</span>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => { reset(); onClose(); }} className="flex-1 rounded-2xl h-12">
              Cancel
            </Button>
            <Button
              onClick={handleSave} disabled={validCount === 0}
              className="flex-1 rounded-2xl h-12 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
            >
              <Check className="w-5 h-5 mr-2" /> Save Kharid
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
