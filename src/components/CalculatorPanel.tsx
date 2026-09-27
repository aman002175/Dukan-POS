// Combined Calculator Panel — Smart Calculator + Hisaab Calculator in one modal
import { useState } from 'react';
import { X, Scale, Coins, Trash2, Plus, RotateCcw, ArrowDown } from 'lucide-react';

interface CalculatorPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CalculatorPanel({ isOpen, onClose }: CalculatorPanelProps) {
  const [activeCalc, setActiveCalc] = useState<'smart' | 'hisaab'>('smart');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl shadow-2xl max-h-[85vh] overflow-hidden flex flex-col"
           onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex gap-1 bg-gray-100 rounded-xl p-0.5">
            <button
              onClick={() => setActiveCalc('smart')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeCalc === 'smart' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500'
              }`}
            >
              <Scale className="w-3.5 h-3.5 inline mr-1" /> Chhutte / Weight
            </button>
            <button
              onClick={() => setActiveCalc('hisaab')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeCalc === 'hisaab' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
              }`}
            >
              <Coins className="w-3.5 h-3.5 inline mr-1" /> Hisaab
            </button>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {activeCalc === 'smart' ? <SmartCalcContent /> : <HisaabCalcContent />}
        </div>
      </div>
    </div>
  );
}

// ── Smart Calculator (Chhutte + Weight) ──
function SmartCalcContent() {
  const [tab, setTab] = useState<'change' | 'weight'>('change');
  const [billAmount, setBillAmount] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [oneKgRate, setOneKgRate] = useState('');
  const [amountPaidForWeight, setAmountPaidForWeight] = useState('');
  const [kgAsked, setKgAsked] = useState('');

  const bill = parseFloat(billAmount) || 0;
  const paid = parseFloat(amountPaid) || 0;
  const change = paid > bill ? paid - bill : 0;
  const due = bill > paid ? bill - paid : 0;

  const rate = parseFloat(oneKgRate) || 0;
  const wPaid = parseFloat(amountPaidForWeight) || 0;
  const kg = parseFloat(kgAsked) || 0;
  // Paisa → Kitna Wazan? (money → kg, scale-style 3 decimals)
  const calculatedKg = rate > 0 && wPaid > 0 ? (wPaid / rate).toFixed(3) : null;
  // Wazan → Kitne Rupee? (kg → price)
  const calculatedPrice = rate > 0 && kg > 0 ? (rate * kg).toFixed(2) : null;

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-gray-100 rounded-xl p-0.5">
        <button onClick={() => setTab('change')}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold ${tab === 'change' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500'}`}>
          <Coins className="w-3.5 h-3.5 inline mr-1" /> Chhutte
        </button>
        <button onClick={() => setTab('weight')}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold ${tab === 'weight' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>
          <Scale className="w-3.5 h-3.5 inline mr-1" /> Weight
        </button>
      </div>

      {tab === 'change' ? (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 font-medium mb-1 block">Bill Amount (₹)</label>
            <input type="number" value={billAmount} onChange={e => setBillAmount(e.target.value)}
              placeholder="0" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-lg font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-300" />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium mb-1 block">Amount Paid (₹)</label>
            <input type="number" value={amountPaid} onChange={e => setAmountPaid(e.target.value)}
              placeholder="0" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-lg font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-300" />
          </div>
          {change > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <p className="text-xs text-green-600 font-medium">Wapas dena hai</p>
              <p className="text-3xl font-black text-green-700">₹{change.toFixed(2)}</p>
            </div>
          )}
          {due > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
              <p className="text-xs text-red-600 font-medium">Baki hai</p>
              <p className="text-3xl font-black text-red-600">₹{due.toFixed(2)}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Rate input */}
          <div>
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">1 KG Ka Bhaav (₹)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">₹</span>
              <input type="number" inputMode="decimal" value={oneKgRate} onChange={e => setOneKgRate(e.target.value)}
                placeholder="e.g. 80" className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none text-base font-bold text-gray-900" />
            </div>
          </div>

          {/* Section A: Paisa → Kitna Wazan? */}
          <div className="bg-purple-50 rounded-2xl p-3 space-y-2">
            <p className="text-[11px] font-bold text-purple-700 uppercase tracking-wide">Paisa → Kitna Wazan?</p>
            <div>
              <label className="text-[10px] text-purple-500 mb-1 block">Diya Gaya Paisa (₹)</label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                <input type="number" inputMode="decimal" value={amountPaidForWeight}
                  onChange={e => setAmountPaidForWeight(e.target.value)}
                  placeholder="Amount"
                  className="w-full pl-7 pr-3 py-2 rounded-xl border border-purple-200 focus:border-purple-500 outline-none text-sm font-semibold bg-white" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ArrowDown className="w-4 h-4 text-purple-400 mx-auto" />
            </div>
            <div className={`w-full px-3 py-2.5 rounded-xl text-sm font-bold text-center ${
              calculatedKg ? 'bg-purple-600 text-white' : 'bg-white border border-purple-200 text-gray-400'
            }`}>
              {calculatedKg ? `${calculatedKg} kg milega` : '— kg'}
            </div>
            {calculatedKg && rate > 0 && (
              <p className="text-[10px] text-purple-500 text-center">
                ₹{wPaid} ÷ ₹{rate}/kg = {calculatedKg} kg
              </p>
            )}
          </div>

          {/* Section B: Wazan → Kitne Rupee? */}
          <div className="bg-indigo-50 rounded-2xl p-3 space-y-2">
            <p className="text-[11px] font-bold text-indigo-700 uppercase tracking-wide">Wazan → Kitne Rupee?</p>
            <div>
              <label className="text-[10px] text-indigo-500 mb-1 block">Kg mein wazan</label>
              <input type="number" inputMode="decimal" value={kgAsked}
                onChange={e => setKgAsked(e.target.value)}
                placeholder="Kg (e.g. 0.500, 2.500)"
                className="w-full px-3 py-2 rounded-xl border border-indigo-200 focus:border-indigo-500 outline-none text-sm font-semibold bg-white" />
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
                {kg} kg × ₹{rate}/kg = ₹{calculatedPrice}
              </p>
            )}
          </div>

          <button
            onClick={() => { setOneKgRate(''); setAmountPaidForWeight(''); setKgAsked(''); }}
            className="w-full py-2 rounded-xl border border-gray-200 text-gray-500 text-xs font-medium hover:bg-gray-50 transition-colors"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}

// ── Hisaab Calculator (Equation style) ──
interface HisaabItem { id: string; name: string; qty: string; rate: string; }

function HisaabCalcContent() {
  const [items, setItems] = useState<HisaabItem[]>([
    { id: '1', name: '', qty: '1', rate: '' },
  ]);
  const [amountPaid, setAmountPaid] = useState('');

  const total = items.reduce((sum, item) => {
    const q = parseFloat(item.qty) || 0;
    const r = parseFloat(item.rate) || 0;
    return sum + q * r;
  }, 0);

  const paid = parseFloat(amountPaid) || 0;
  const change = paid > total ? paid - total : 0;
  const due = total > paid ? total - paid : 0;

  const addItem = () => {
    setItems(prev => [...prev, { id: Date.now().toString(), name: '', qty: '1', rate: '' }]);
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.length > 1 ? prev.filter(i => i.id !== id) : prev);
  };

  const updateItem = (id: string, field: keyof HisaabItem, value: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const reset = () => {
    setItems([{ id: '1', name: '', qty: '1', rate: '' }]);
    setAmountPaid('');
  };

  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <div key={item.id} className="bg-gray-50 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400">#{idx + 1}</span>
            {items.length > 1 && (
              <button onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-600">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <input type="text" value={item.name} onChange={e => updateItem(item.id, 'name', e.target.value)}
            placeholder="Item name (optional)" className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-gray-400">Qty</label>
              <input type="number" value={item.qty} onChange={e => updateItem(item.id, 'qty', e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-gray-400">Rate (₹)</label>
              <input type="number" value={item.rate} onChange={e => updateItem(item.id, 'rate', e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-gray-400">Total</label>
              <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold text-gray-900">
                ₹{((parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0)).toFixed(0)}
              </div>
            </div>
          </div>
        </div>
      ))}

      <button onClick={addItem}
        className="w-full py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 text-sm font-semibold hover:border-blue-400 hover:text-blue-500 transition-colors">
        <Plus className="w-4 h-4 inline mr-1" /> Item Add Karo
      </button>

      <div className="bg-gray-900 rounded-xl p-4 space-y-2">
        <div className="flex justify-between text-white">
          <span className="text-sm">Total</span>
          <span className="text-lg font-black">₹{total.toFixed(0)}</span>
        </div>
        <div>
          <label className="text-[10px] text-gray-400">Kitna de raha hai?</label>
          <input type="number" value={amountPaid} onChange={e => setAmountPaid(e.target.value)}
            placeholder="0" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        {change > 0 && (
          <div className="flex justify-between text-green-400">
            <span className="text-xs">Wapas dena hai</span>
            <span className="text-sm font-bold">₹{change.toFixed(0)}</span>
          </div>
        )}
        {due > 0 && (
          <div className="flex justify-between text-red-400">
            <span className="text-xs">Baki hai</span>
            <span className="text-sm font-bold">₹{due.toFixed(0)}</span>
          </div>
        )}
      </div>

      <button onClick={reset}
        className="w-full py-2 rounded-xl bg-gray-100 text-gray-500 text-xs font-semibold hover:bg-gray-200 transition-colors">
        <RotateCcw className="w-3 h-3 inline mr-1" /> Reset
      </button>
    </div>
  );
}
