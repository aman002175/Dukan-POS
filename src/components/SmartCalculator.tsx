// Smart Floating Calculator - Chhutte Paise + Weight Calculator
// Draggable floating button with full calculator panel
import { useState, useRef, useCallback, useEffect } from 'react';
import { Calculator, X, Scale, Coins, ArrowDown } from 'lucide-react';

interface SmartCalculatorProps {
  cartTotal?: number;
}

export function SmartCalculator({ cartTotal = 0 }: SmartCalculatorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'change' | 'weight'>('change');

  // ── Chhutte Paise State ──
  const [billAmount, setBillAmount] = useState('');
  const [amountPaid, setAmountPaid] = useState('');

  // ── Weight Calculator State ──
  const [oneKgRate, setOneKgRate] = useState('');
  const [amountPaidForWeight, setAmountPaidForWeight] = useState('');
  const [gramsAsked, setGramsAsked] = useState('');

  // ── Draggable State ──
  const btnRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const btnPos = useRef({ x: 0, y: 0 });
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [initialized, setInitialized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragMoved = useRef(false);

  // Initialize position bottom-right
  useEffect(() => {
    const x = window.innerWidth - 80;
    const y = window.innerHeight - 200;
    setPos({ x, y });
    btnPos.current = { x, y };
    setInitialized(true);
  }, []);

  // ── Drag Handlers ──
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

  const onPointerUp = useCallback((_e: React.PointerEvent) => {
    if (!dragging.current) return;
    dragging.current = false;
    setIsDragging(false);
    if (!dragMoved.current) {
      setIsOpen(prev => !prev);
    }
  }, []);

  // ── Sync cart total to billAmount ──
  useEffect(() => {
    if (isOpen && cartTotal > 0 && !billAmount) {
      setBillAmount(cartTotal.toFixed(2));
      setActiveTab('change');
    }
  }, [isOpen, cartTotal]);

  // ── Calculations ──
  const bill = parseFloat(billAmount) || 0;
  const paid = parseFloat(amountPaid) || 0;
  const change = paid - bill;
  const changeValid = amountPaid !== '' && billAmount !== '';

  const quickAmounts = (() => {
    if (bill <= 0) return [];
    const suggestions: number[] = [];
    const rounds = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000];
    for (const r of rounds) {
      const val = Math.ceil(bill / r) * r;
      if (val >= bill && !suggestions.includes(val) && suggestions.length < 5) {
        suggestions.push(val);
      }
    }
    return suggestions.slice(0, 5);
  })();

  // Weight calcs
  const rate = parseFloat(oneKgRate) || 0;
  const wPaid = parseFloat(amountPaidForWeight) || 0;
  const gAsked = parseFloat(gramsAsked) || 0;
  const calculatedGrams = rate > 0 && wPaid > 0 ? ((wPaid / rate) * 1000).toFixed(1) : null;
  const calculatedPrice = rate > 0 && gAsked > 0 ? ((rate * gAsked) / 1000).toFixed(2) : null;

  if (!initialized) return null;

  return (
    <>
      {/* ── Floating Draggable Button ── */}
      <div
        ref={btnRef}
        style={{ left: pos.x, top: pos.y, position: 'fixed', zIndex: 999, touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className={`select-none ${isDragging ? 'cursor-grabbing scale-110' : 'cursor-grab'}`}
      >
        <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all
          ${isOpen
            ? 'bg-gradient-to-br from-purple-600 to-indigo-700 ring-4 ring-purple-300'
            : 'bg-gradient-to-br from-purple-500 to-indigo-600'
          }`}
        >
          {isOpen
            ? <X className="w-6 h-6 text-white" />
            : <Calculator className="w-6 h-6 text-white" />
          }
        </div>
        {!isDragging && !isOpen && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-400 rounded-full border-2 border-white" />
        )}
      </div>

      {/* ── Calculator Panel ── */}
      {isOpen && (
        <div
          ref={panelRef}
          className="fixed z-[998] bg-white rounded-3xl shadow-2xl border border-gray-100 flex flex-col"
          style={{
            width: 310,
            maxHeight: '80vh',
            left: Math.max(8, Math.min(pos.x - 250, window.innerWidth - 320)),
            top: pos.y + 68 + 380 > window.innerHeight
              ? Math.max(8, pos.y - 390)
              : pos.y + 68,
          }}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-500 to-indigo-600 px-4 py-3 flex items-center justify-between rounded-t-3xl flex-shrink-0">
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-white" />
              <span className="text-white font-bold text-sm">Smart Calculator</span>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
              <X className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-100 bg-gray-50 flex-shrink-0">
            <button
              onClick={() => setActiveTab('change')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-all ${
                activeTab === 'change'
                  ? 'text-purple-600 border-b-2 border-purple-600 bg-white'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Coins className="w-3.5 h-3.5" />
              Chhutte Paise
            </button>
            <button
              onClick={() => setActiveTab('weight')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-all ${
                activeTab === 'weight'
                  ? 'text-purple-600 border-b-2 border-purple-600 bg-white'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Scale className="w-3.5 h-3.5" />
              Wazan
            </button>
          </div>

          {/* ══ CHHUTTE PAISE TAB ══ */}
          {activeTab === 'change' && (
            <div className="p-4 space-y-3 overflow-y-auto flex-1">

              {/* Bill Amount */}
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                  Bill Amount (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">₹</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={billAmount}
                    onChange={e => setBillAmount(e.target.value)}
                    placeholder={cartTotal > 0 ? cartTotal.toFixed(2) : '0.00'}
                    className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none text-base font-bold text-gray-900"
                  />
                </div>
                {cartTotal > 0 && !billAmount && (
                  <button
                    onClick={() => setBillAmount(cartTotal.toFixed(2))}
                    className="mt-1.5 text-xs text-purple-600 hover:underline"
                  >
                    Cart se lo: ₹{cartTotal.toFixed(2)}
                  </button>
                )}
              </div>

              {/* Amount Paid */}
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                  Diya Gaya Paisa (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">₹</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={amountPaid}
                    onChange={e => setAmountPaid(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none text-base font-bold text-gray-900"
                  />
                </div>
              </div>

              {/* Quick Amount Buttons */}
              {quickAmounts.length > 0 && (
                <div>
                  <p className="text-[11px] text-gray-400 mb-1.5">Jaldi Bharein:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {quickAmounts.map(amt => (
                      <button
                        key={amt}
                        onClick={() => setAmountPaid(amt.toString())}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                          parseFloat(amountPaid) === amt
                            ? 'bg-purple-600 text-white border-purple-600'
                            : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-purple-400 hover:text-purple-600'
                        }`}
                      >
                        ₹{amt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Result Card */}
              {changeValid && (
                <div className={`rounded-2xl p-4 text-center ${
                  change > 0 ? 'bg-green-50 border border-green-200' :
                  change < 0 ? 'bg-red-50 border border-red-200' :
                  'bg-blue-50 border border-blue-200'
                }`}>
                  <p className="text-xs text-gray-500 mb-2 font-medium">
                    ₹{paid.toFixed(2)} − ₹{bill.toFixed(2)} =
                  </p>
                  {change > 0 ? (
                    <>
                      <p className="text-xs font-semibold text-green-600 mb-0.5">↩ Wapas Karo</p>
                      <p className="text-4xl font-black text-green-700">₹{change.toFixed(2)}</p>
                      <p className="text-xs text-green-500 mt-1">Customer ko chhutte do</p>
                    </>
                  ) : change < 0 ? (
                    <>
                      <p className="text-xs font-semibold text-red-600 mb-0.5">⚠ Aur Chahiye</p>
                      <p className="text-4xl font-black text-red-700">₹{Math.abs(change).toFixed(2)}</p>
                      <p className="text-xs text-red-500 mt-1">Customer se aur lo</p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs font-semibold text-blue-600 mb-0.5">✓ Exact Amount</p>
                      <p className="text-4xl font-black text-blue-700">₹0.00</p>
                      <p className="text-xs text-blue-500 mt-1">Bilkul sahi diya!</p>
                    </>
                  )}
                </div>
              )}

              <button
                onClick={() => { setBillAmount(''); setAmountPaid(''); }}
                className="w-full py-2 rounded-xl border border-gray-200 text-gray-500 text-xs font-medium hover:bg-gray-50 transition-colors"
              >
                Clear
              </button>
            </div>
          )}

          {/* ══ WEIGHT / BHAAV TAB ══ */}
          {activeTab === 'weight' && (
            <div className="p-4 space-y-3 overflow-y-auto flex-1">

              {/* Rate input */}
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                  1 KG Ka Bhaav (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">₹</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={oneKgRate}
                    onChange={e => setOneKgRate(e.target.value)}
                    placeholder="e.g. 80"
                    className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none text-base font-bold text-gray-900"
                  />
                </div>
              </div>

              {/* Section A: Amount → Grams */}
              <div className="bg-purple-50 rounded-2xl p-3 space-y-2">
                <p className="text-[11px] font-bold text-purple-700 uppercase tracking-wide">Paisa → Kitna Wazan?</p>
                <div>
                  <label className="text-[10px] text-purple-500 mb-1 block">Diya Gaya Paisa (₹)</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={amountPaidForWeight}
                      onChange={e => setAmountPaidForWeight(e.target.value)}
                      placeholder="Amount"
                      className="w-full pl-7 pr-3 py-2 rounded-xl border border-purple-200 focus:border-purple-500 outline-none text-sm font-semibold bg-white"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ArrowDown className="w-4 h-4 text-purple-400 mx-auto" />
                </div>
                <div className={`w-full px-3 py-2.5 rounded-xl text-sm font-bold text-center ${
                  calculatedGrams ? 'bg-purple-600 text-white' : 'bg-white border border-purple-200 text-gray-400'
                }`}>
                  {calculatedGrams ? `${calculatedGrams} gram milega` : '— gram'}
                </div>
                {calculatedGrams && rate > 0 && (
                  <p className="text-[10px] text-purple-500 text-center">
                    ₹{wPaid} ÷ ₹{rate}/kg × 1000 = {calculatedGrams}g
                  </p>
                )}
              </div>

              {/* Section B: Grams → Price */}
              <div className="bg-indigo-50 rounded-2xl p-3 space-y-2">
                <p className="text-[11px] font-bold text-indigo-700 uppercase tracking-wide">Wazan → Kitne Rupee?</p>
                <div>
                  <label className="text-[10px] text-indigo-500 mb-1 block">Gram mein wazan</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={gramsAsked}
                    onChange={e => setGramsAsked(e.target.value)}
                    placeholder="Grams (e.g. 250)"
                    className="w-full px-3 py-2 rounded-xl border border-indigo-200 focus:border-indigo-500 outline-none text-sm font-semibold bg-white"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <ArrowDown className="w-4 h-4 text-indigo-400 mx-auto" />
                </div>
                <div className={`w-full px-3 py-2.5 rounded-xl text-sm font-bold text-center ${
                  calculatedPrice ? 'bg-indigo-600 text-white' : 'bg-white border border-indigo-200 text-gray-400'
                }`}>
                  {calculatedPrice ? `₹${calculatedPrice} dena hoga` : '— rupee'}
                </div>
                {calculatedPrice && rate > 0 && (
                  <p className="text-[10px] text-indigo-500 text-center">
                    {gAsked}g × ₹{rate}/kg ÷ 1000 = ₹{calculatedPrice}
                  </p>
                )}
              </div>

              <button
                onClick={() => { setOneKgRate(''); setAmountPaidForWeight(''); setGramsAsked(''); }}
                className="w-full py-2 rounded-xl border border-gray-200 text-gray-500 text-xs font-medium hover:bg-gray-50 transition-colors"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
