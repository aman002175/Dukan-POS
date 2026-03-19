// Hisaab Calculator - Equation Style
// "Koi cheez kitne ki thi, kitne mein aayi, kitne wapas milenge"
// Draggable floating button

import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Plus, Trash2, Equal, RotateCcw } from 'lucide-react';

interface HisaabItem {
  id: string;
  name: string;
  qty: string;
  rate: string;
}

export function HisaabCalculator() {
  const [isOpen, setIsOpen] = useState(false);

  // ── Items list ──
  const [items, setItems] = useState<HisaabItem[]>([
    { id: '1', name: '', qty: '1', rate: '' },
  ]);
  const [amountPaid, setAmountPaid] = useState('');

  // ── Draggable ──
  const dragging = useRef(false);
  const dragMoved = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const btnPos = useRef({ x: 0, y: 0 });
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [initialized, setInitialized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Init position (bottom-right, above SmartCalculator button)
  useEffect(() => {
    const x = window.innerWidth - 72;
    const y = window.innerHeight - 250;
    setPos({ x, y });
    btnPos.current = { x, y };
    setInitialized(true);
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    dragging.current = true;
    dragMoved.current = false;
    setIsDragging(false);
    startPos.current = { x: e.clientX, y: e.clientY };
    btnPos.current = pos;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [pos]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - startPos.current.x;
    const dy = e.clientY - startPos.current.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      dragMoved.current = true;
      setIsDragging(true);
    }
    const newX = Math.max(8, Math.min(window.innerWidth - 64, btnPos.current.x + dx));
    const newY = Math.max(8, Math.min(window.innerHeight - 64, btnPos.current.y + dy));
    setPos({ x: newX, y: newY });
  }, []);

  const onPointerUp = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    setIsDragging(false);
    if (!dragMoved.current) {
      setIsOpen(prev => !prev);
    }
  }, []);

  // ── Item Operations ──
  const addItem = () => {
    setItems(prev => [
      ...prev,
      { id: Date.now().toString(), name: '', qty: '1', rate: '' }
    ]);
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.length === 1 ? prev : prev.filter(i => i.id !== id));
  };

  const updateItem = (id: string, field: keyof HisaabItem, value: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const reset = () => {
    setItems([{ id: '1', name: '', qty: '1', rate: '' }]);
    setAmountPaid('');
  };

  // ── Calculations ──
  const itemTotals = items.map(item => {
    const qty = parseFloat(item.qty) || 0;
    const rate = parseFloat(item.rate) || 0;
    return qty * rate;
  });

  const grandTotal = itemTotals.reduce((a, b) => a + b, 0);
  const paid = parseFloat(amountPaid) || 0;
  const wapas = paid - grandTotal;

  // Quick pay suggestions
  const quickPay = (() => {
    if (grandTotal <= 0) return [];
    const sugg: number[] = [];
    const rounds = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000];
    for (const r of rounds) {
      const v = Math.ceil(grandTotal / r) * r;
      if (v >= grandTotal && !sugg.includes(v) && sugg.length < 5) sugg.push(v);
    }
    return sugg.slice(0, 4);
  })();

  if (!initialized) return null;

  return (
    <>
      {/* ── Floating Button ── */}
      <div
        style={{ left: pos.x, top: pos.y, position: 'fixed', zIndex: 998, touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className={`select-none transition-shadow ${isDragging ? 'cursor-grabbing scale-110' : 'cursor-grab'}`}
      >
        <div className={`w-14 h-14 rounded-full flex flex-col items-center justify-center shadow-xl transition-all
          ${isOpen
            ? 'bg-gradient-to-br from-emerald-500 to-teal-600 ring-4 ring-emerald-300'
            : 'bg-gradient-to-br from-emerald-500 to-teal-600 hover:scale-105 hover:shadow-emerald-300'
          }`}
        >
          {isOpen
            ? <X className="w-5 h-5 text-white" />
            : <>
                <Equal className="w-4 h-4 text-white" />
                <span className="text-[9px] text-white font-bold mt-0.5">Hisaab</span>
              </>
          }
        </div>
        {!isDragging && !isOpen && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full border-2 border-white" />
        )}
      </div>

      {/* ── Hisaab Panel ── */}
      {isOpen && (
        <div
          className="fixed z-[997] bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden"
          style={{
            width: 340,
            left: Math.max(8, Math.min(pos.x - 280, window.innerWidth - 350)),
            top: pos.y + 64 + 480 > window.innerHeight
              ? Math.max(8, pos.y - 490)
              : pos.y + 68,
          }}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Equal className="w-5 h-5 text-white" />
              <div>
                <p className="text-white font-bold text-sm">Hisaab Kitaab</p>
                <p className="text-emerald-100 text-[10px]">Item → Bhaav → Chhutte</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={reset}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                title="Reset"
              >
                <RotateCcw className="w-4 h-4 text-white" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>

          <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">

            {/* ── Items ── */}
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-1 px-1">
                <p className="col-span-5 text-[10px] text-gray-400 font-semibold uppercase">Cheez</p>
                <p className="col-span-2 text-[10px] text-gray-400 font-semibold uppercase text-center">Qty</p>
                <p className="col-span-3 text-[10px] text-gray-400 font-semibold uppercase text-center">Rate ₹</p>
                <p className="col-span-2 text-[10px] text-gray-400 font-semibold uppercase text-right">Total</p>
              </div>

              {items.map((item, idx) => (
                <div key={item.id} className="grid grid-cols-12 gap-1 items-center bg-gray-50 rounded-xl p-2">
                  {/* Name */}
                  <input
                    type="text"
                    value={item.name}
                    onChange={e => updateItem(item.id, 'name', e.target.value)}
                    placeholder={`Item ${idx + 1}`}
                    className="col-span-5 px-2 py-1.5 rounded-lg border border-gray-200 text-xs bg-white focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100 outline-none truncate"
                  />
                  {/* Qty */}
                  <input
                    type="number"
                    inputMode="decimal"
                    value={item.qty}
                    onChange={e => updateItem(item.id, 'qty', e.target.value)}
                    className="col-span-2 px-1.5 py-1.5 rounded-lg border border-gray-200 text-xs bg-white text-center focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100 outline-none"
                  />
                  {/* Rate */}
                  <input
                    type="number"
                    inputMode="decimal"
                    value={item.rate}
                    onChange={e => updateItem(item.id, 'rate', e.target.value)}
                    placeholder="0"
                    className="col-span-3 px-1.5 py-1.5 rounded-lg border border-gray-200 text-xs bg-white text-center focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100 outline-none"
                  />
                  {/* Row Total or Delete */}
                  {items.length > 1 ? (
                    <button
                      onClick={() => removeItem(item.id)}
                      className="col-span-2 flex justify-end pr-1"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-400 hover:text-red-600" />
                    </button>
                  ) : (
                    <p className="col-span-2 text-[11px] font-bold text-emerald-700 text-right pr-1">
                      {itemTotals[idx] > 0 ? `₹${itemTotals[idx].toFixed(0)}` : '—'}
                    </p>
                  )}
                </div>
              ))}

              {/* Row totals shown below when multiple items */}
              {items.length > 1 && (
                <div className="space-y-0.5 px-1">
                  {items.map((item, idx) => (
                    itemTotals[idx] > 0 && (
                      <div key={item.id} className="flex justify-between text-[11px] text-gray-600">
                        <span className="truncate max-w-[150px]">{item.name || `Item ${idx+1}`}</span>
                        <span className="font-semibold">
                          {item.qty}×₹{item.rate} = <span className="text-emerald-700">₹{itemTotals[idx].toFixed(2)}</span>
                        </span>
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>

            {/* Add Item Button */}
            <button
              onClick={addItem}
              className="w-full py-2 rounded-xl border-2 border-dashed border-emerald-300 text-emerald-600 text-xs font-semibold hover:bg-emerald-50 flex items-center justify-center gap-1 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Aur Item Jodo
            </button>

            {/* Grand Total */}
            {grandTotal > 0 && (
              <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-3 flex items-center justify-between">
                <p className="text-emerald-100 text-xs font-medium">Kul Jama</p>
                <p className="text-white text-2xl font-black">₹{grandTotal.toFixed(2)}</p>
              </div>
            )}

            {/* Amount Paid */}
            {grandTotal > 0 && (
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block">
                  Diya Gaya Paisa
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">₹</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={amountPaid}
                    onChange={e => setAmountPaid(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-base font-bold text-gray-900"
                  />
                </div>

                {/* Quick pay chips */}
                {quickPay.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {quickPay.map(amt => (
                      <button
                        key={amt}
                        onClick={() => setAmountPaid(amt.toString())}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                          parseFloat(amountPaid) === amt
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-emerald-400 hover:text-emerald-600'
                        }`}
                      >
                        ₹{amt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Result: Wapas Kitna? ── */}
            {grandTotal > 0 && amountPaid !== '' && (
              <div className={`rounded-2xl p-4 text-center border-2 ${
                wapas > 0 ? 'bg-green-50 border-green-300' :
                wapas < 0 ? 'bg-red-50 border-red-300' :
                'bg-blue-50 border-blue-300'
              }`}>
                {/* Full equation */}
                <div className="text-xs text-gray-500 mb-3 space-y-0.5">
                  {items.map((item, idx) => (
                    itemTotals[idx] > 0 && (
                      <div key={item.id} className="flex justify-between">
                        <span className="truncate max-w-[150px] text-left">{item.name || `Item ${idx+1}`}:</span>
                        <span className="font-medium">{item.qty} × ₹{item.rate} = ₹{itemTotals[idx].toFixed(2)}</span>
                      </div>
                    )
                  ))}
                  <div className="border-t border-gray-200 my-1 pt-1 flex justify-between font-semibold text-gray-700">
                    <span>Kul Total:</span>
                    <span>₹{grandTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Diya:</span>
                    <span>₹{paid.toFixed(2)}</span>
                  </div>
                </div>

                {wapas > 0 ? (
                  <>
                    <p className="text-[11px] font-bold text-green-600 uppercase tracking-wide mb-1">↩ Wapas Karo</p>
                    <p className="text-4xl font-black text-green-700">₹{wapas.toFixed(2)}</p>
                    <p className="text-xs text-green-500 mt-1">Customer ko yeh chhutte do</p>
                  </>
                ) : wapas < 0 ? (
                  <>
                    <p className="text-[11px] font-bold text-red-600 uppercase tracking-wide mb-1">⚠ Aur Chahiye</p>
                    <p className="text-4xl font-black text-red-700">₹{Math.abs(wapas).toFixed(2)}</p>
                    <p className="text-xs text-red-500 mt-1">Itna aur lena hai</p>
                  </>
                ) : (
                  <>
                    <p className="text-[11px] font-bold text-blue-600 uppercase tracking-wide mb-1">✓ Bilkul Sahi</p>
                    <p className="text-4xl font-black text-blue-700">₹0.00</p>
                    <p className="text-xs text-blue-500 mt-1">Exact amount diya!</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
