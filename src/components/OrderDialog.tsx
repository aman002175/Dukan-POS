/**
 * OrderDialog — Supplier order list (low-stock se auto).
 * Items + suggested qty (editable) + supplier phone → WhatsApp par bhejo.
 */
import { useState, useEffect } from 'react';
import { Minus, Plus, Truck, Send } from 'lucide-react';
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
import {
  buildSupplierOrderMessage,
  suggestOrderQty,
  sendWhatsAppText,
} from '@/utils/reminders';

interface OrderDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OrderDialog({ isOpen, onClose }: OrderDialogProps) {
  const { state, showToast } = useApp();
  const [qtys, setQtys] = useState<Record<string, string>>({});
  const [supplierPhone, setSupplierPhone] = useState('');

  const lowStock = state.products.filter(p => p.stock <= p.minStock);

  useEffect(() => {
    if (isOpen) {
      const init: Record<string, string> = {};
      lowStock.forEach(p => { init[p.id] = String(suggestOrderQty(p)); });
      setQtys(init);
      setSupplierPhone('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const setQty = (id: string, v: string) => setQtys(prev => ({ ...prev, [id]: v }));
  const qtyOf = (id: string, fallback: number) => {
    const v = parseFloat(qtys[id]);
    return Number.isFinite(v) && v > 0 ? v : fallback;
  };

  const orderItems = lowStock
    .map(p => ({
      name: p.name, stock: p.stock, unit: p.unit,
      suggestQty: qtyOf(p.id, suggestOrderQty(p)),
    }))
    .filter(i => i.suggestQty > 0);

  const handleSend = () => {
    if (orderItems.length === 0) {
      showToast('Order mein koi item nahi hai', 'error');
      return;
    }
    const msg = buildSupplierOrderMessage(orderItems, state.businessProfile.shopName);
    const method = sendWhatsAppText(msg, supplierPhone.trim() || undefined);
    if (method === 'whatsapp') {
      showToast('Supplier ko order bhej diya! 🚚', 'success');
      onClose();
    } else if (method === 'share' || method === 'clipboard') {
      showToast('Number nahi hai — order share/copy ke liye khola!', 'info');
    } else {
      showToast('Bhej nahi paya', 'error');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md rounded-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-blue-600" /> Supplier Order ({orderItems.length})
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2 mt-4">
          {orderItems.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">Sab stock full hai — order ki zaroorat nahi! ✅</p>
          )}
          {lowStock.map(p => {
            const q = qtyOf(p.id, suggestOrderQty(p));
            return (
              <div key={p.id} className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-2xl">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                  <p className="text-xs text-red-500">Bacha: {p.stock} {p.unit}</p>
                </div>
                <button
                  onClick={() => setQty(p.id, String(Math.max(0, q - 1)))}
                  className="w-8 h-8 rounded-xl bg-white border border-gray-200 flex items-center justify-center"
                  aria-label="Kam karo"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <Input
                  type="number" inputMode="decimal" min={0}
                  value={qtys[p.id] ?? ''}
                  onChange={e => setQty(p.id, e.target.value)}
                  className="w-16 rounded-xl h-9 text-center font-bold bg-white"
                />
                <button
                  onClick={() => setQty(p.id, String(q + 1))}
                  className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center"
                  aria-label="Badhao"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs text-gray-400 w-8">{p.unit}</span>
              </div>
            );
          })}

          <div>
            <Label className="text-xs">Supplier Phone (optional — khaali toh share/copy)</Label>
            <Input
              type="tel" inputMode="tel"
              value={supplierPhone} onChange={e => setSupplierPhone(e.target.value)}
              placeholder="98765..."
              className="rounded-xl h-11 mt-1"
            />
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1 rounded-2xl h-12">
              Cancel
            </Button>
            <Button
              onClick={handleSend} disabled={orderItems.length === 0}
              className="flex-1 rounded-2xl h-12 bg-gradient-to-r from-blue-600 to-indigo-600"
            >
              <Send className="w-4 h-4 mr-2" /> WhatsApp Karo
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
