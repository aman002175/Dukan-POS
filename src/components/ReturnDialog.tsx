/**
 * ReturnDialog — Wapasi / Return entry.
 * Bill se ya seedha: items (qty) + refund type (cash/adjust) + reason → addReturn().
 * Stock wapas badhta hai, khata auto-adjust hota hai.
 */
import { useState, useEffect } from 'react';
import { Minus, Trash2, RotateCcw, Check } from 'lucide-react';
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
import type { Sale } from '@/types';

interface ReturnDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Bill se wapasi ho rahi hai toh sale prefill karo (optional) */
  sale?: Sale | null;
}

export function ReturnDialog({ isOpen, onClose, sale }: ReturnDialogProps) {
  const { addReturn } = useApp();
  const [qtys, setQtys] = useState<Record<string, string>>({});
  const [refundType, setRefundType] = useState<'cash' | 'adjust'>('cash');
  const [reason, setReason] = useState('');

  // Dialog khulne par reset
  useEffect(() => {
    if (isOpen) {
      setQtys({});
      setRefundType(sale && sale.type !== 'cash' ? 'adjust' : 'cash');
      setReason('');
    }
  }, [isOpen, sale]);

  const items = sale?.items || [];
  const setQty = (productId: string, v: string) =>
    setQtys(prev => ({ ...prev, [productId]: v }));

  const returnQty = (productId: string, maxQty: number) =>
    Math.min(Math.max(0, parseFloat(qtys[productId]) || 0), maxQty);

  const totalRefund = items.reduce((s, it) => s + returnQty(it.productId, it.quantity) * it.price, 0);
  const totalQty = items.reduce((s, it) => s + returnQty(it.productId, it.quantity), 0);

  const handleSave = () => {
    if (!sale || totalQty <= 0) return;
    addReturn({
      items: items
        .filter(it => returnQty(it.productId, it.quantity) > 0)
        .map(it => ({
          productId: it.productId,
          quantity: returnQty(it.productId, it.quantity),
          price: it.price,
        })),
      saleId: sale.id,
      billNumber: sale.billNumber,
      refundType,
      customerId: sale.customerId,
      customerName: sale.customerName,
      reason: reason.trim() || undefined,
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md rounded-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-orange-600" />
            Wapasi {sale?.billNumber ? `— ${sale.billNumber}` : ''}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mt-4">
          {items.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">Koi item nahi hai.</p>
          )}
          {items.map(it => {
            const q = returnQty(it.productId, it.quantity);
            return (
              <div key={it.productId} className="bg-gray-50 rounded-2xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{it.name}</p>
                    <p className="text-xs text-gray-400">Becha tha: {it.quantity} × ₹{it.price.toFixed(2)}</p>
                  </div>
                  <span className="text-sm font-bold text-orange-600">₹{(q * it.price).toFixed(0)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setQty(it.productId, String(Math.max(0, q - 1)))}
                    className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-100"
                    aria-label="Kam karo"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <Input
                    type="number" inputMode="decimal" min={0} max={it.quantity}
                    value={qtys[it.productId] ?? ''}
                    onChange={e => setQty(it.productId, e.target.value)}
                    placeholder="0"
                    className="rounded-xl h-9 text-center font-bold bg-white"
                  />
                  <button
                    onClick={() => setQty(it.productId, String(Math.min(it.quantity, q + 1)))}
                    className="h-9 px-3 rounded-xl bg-orange-100 text-orange-700 text-xs font-bold hover:bg-orange-200"
                  >
                    +1
                  </button>
                  <button
                    onClick={() => setQty(it.productId, String(it.quantity))}
                    className="h-9 px-3 rounded-xl bg-gray-200 text-gray-700 text-xs font-bold hover:bg-gray-300"
                  >
                    Sab
                  </button>
                </div>
              </div>
            );
          })}

          {/* Refund type */}
          <div>
            <Label className="text-xs font-bold text-gray-700 mb-1.5 block">Paise Kaise Wapas?</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setRefundType('cash')}
                className={`p-3 rounded-2xl border-2 text-sm font-semibold transition-all ${refundType === 'cash' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500'}`}
              >
                💵 Cash Diya
              </button>
              <button
                onClick={() => setRefundType('adjust')}
                className={`p-3 rounded-2xl border-2 text-sm font-semibold transition-all ${refundType === 'adjust' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500'}`}
              >
                📋 Khate Mein Adjust
              </button>
            </div>
          </div>

          <div>
            <Label className="text-xs">Wajah (optional)</Label>
            <Input
              value={reason} onChange={e => setReason(e.target.value)}
              placeholder="Kharab nikla, galat item..."
              className="rounded-xl h-11 mt-1"
            />
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-center justify-between">
            <span className="text-sm font-semibold text-orange-700">Kul Wapasi</span>
            <span className="text-2xl font-black text-orange-700">₹{totalRefund.toFixed(0)}</span>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1 rounded-2xl h-12">
              Cancel
            </Button>
            <Button
              onClick={handleSave} disabled={totalQty <= 0}
              className="flex-1 rounded-2xl h-12 bg-gradient-to-r from-orange-500 to-red-600"
            >
              <Check className="w-5 h-5 mr-2" /> Wapasi Save
            </Button>
          </div>

          {sale?.customerName && (
            <p className="text-xs text-gray-400 text-center flex items-center justify-center gap-1">
              <Trash2 className="w-3 h-3" /> Stock wapas badhega{refundType === 'adjust' ? ` + ${sale.customerName} ke khate mein adjust hoga` : ' + cash refund record hoga'}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
