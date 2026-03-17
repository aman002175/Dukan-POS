// Smart Floating Calculator Component
import { useState, useEffect } from 'react';
import { Calculator, X, ArrowRightLeft, Scale, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SmartCalculatorProps {
  cartTotal?: number;
}

export function SmartCalculator({ cartTotal = 0 }: SmartCalculatorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'change' | 'weight'>('change');
  
  // Change Calculator State
  const [amountPaid, setAmountPaid] = useState('');
  
  // Weight Calculator State
  const [oneKgRate, setOneKgRate] = useState('');
  const [amountPaidForWeight, setAmountPaidForWeight] = useState('');
  const [gramsAsked, setGramsAsked] = useState('');

  // Calculate change
  const change = amountPaid ? parseFloat(amountPaid) - cartTotal : 0;
  
  // Calculate grams from amount
  const calculatedGrams = (oneKgRate && amountPaidForWeight) 
    ? (parseFloat(amountPaidForWeight) / parseFloat(oneKgRate) * 1000).toFixed(2)
    : 0;
  
  // Calculate price from grams
  const calculatedPrice = (oneKgRate && gramsAsked)
    ? (parseFloat(oneKgRate) * parseFloat(gramsAsked) / 1000).toFixed(2)
    : 0;

  // Reset when opened with cart total
  useEffect(() => {
    if (isOpen && cartTotal > 0) {
      setActiveTab('change');
    }
  }, [isOpen, cartTotal]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-[320px] right-4 z-30 w-14 h-14 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full shadow-lg shadow-purple-200 flex items-center justify-center hover:scale-110 transition-transform"
      >
        <Calculator className="w-6 h-6 text-white" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-[320px] right-4 z-30 w-80 bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-500 to-indigo-600 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-white" />
          <span className="text-white font-semibold">Smart Calculator</span>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="p-1 hover:bg-white/20 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100">
        <button
          onClick={() => setActiveTab('change')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
            activeTab === 'change'
              ? 'text-purple-600 border-b-2 border-purple-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Coins className="w-4 h-4" />
          Chhutte
        </button>
        <button
          onClick={() => setActiveTab('weight')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
            activeTab === 'weight'
              ? 'text-purple-600 border-b-2 border-purple-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Scale className="w-4 h-4" />
          Weight
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        {activeTab === 'change' ? (
          <div className="space-y-4">
            {/* Cart Total Display */}
            {cartTotal > 0 && (
              <div className="bg-purple-50 rounded-2xl p-3">
                <span className="text-xs text-purple-600 font-medium">Cart Total</span>
                <p className="text-2xl font-bold text-purple-700">₹{cartTotal.toFixed(2)}</p>
              </div>
            )}

            {/* Amount Paid Input */}
            <div>
              <label className="text-xs text-gray-500 font-medium mb-1 block">Amount Paid (₹)</label>
              <input
                type="number"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                placeholder="Enter amount..."
                className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all"
              />
            </div>

            {/* Change Display */}
            {amountPaid && (
              <div className={`rounded-2xl p-4 ${change >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <span className={`text-xs font-medium ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {change >= 0 ? 'Change to Return' : 'Amount Short'}
                </span>
                <p className={`text-3xl font-bold ${change >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  ₹{Math.abs(change).toFixed(2)}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* 1KG Rate Input */}
            <div>
              <label className="text-xs text-gray-500 font-medium mb-1 block">1 KG Rate (₹)</label>
              <input
                type="number"
                value={oneKgRate}
                onChange={(e) => setOneKgRate(e.target.value)}
                placeholder="Enter rate per kg..."
                className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all"
              />
            </div>

            {/* Weight Converter */}
            <div className="bg-gray-50 rounded-2xl p-4 space-y-4">
              {/* Amount to Grams */}
              <div>
                <label className="text-xs text-gray-500 font-medium mb-1 block">Amount Paid → Grams</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={amountPaidForWeight}
                    onChange={(e) => setAmountPaidForWeight(e.target.value)}
                    placeholder="₹"
                    className="flex-1 px-3 py-2 rounded-xl border border-gray-200 focus:border-purple-500 outline-none text-sm"
                  />
                  <ArrowRightLeft className="w-4 h-4 text-gray-400" />
                  <div className="flex-1 bg-white px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-purple-600">
                    {calculatedGrams ? `${calculatedGrams}g` : '-'}
                  </div>
                </div>
              </div>

              {/* Grams to Price */}
              <div>
                <label className="text-xs text-gray-500 font-medium mb-1 block">Grams → Price</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={gramsAsked}
                    onChange={(e) => setGramsAsked(e.target.value)}
                    placeholder="g"
                    className="flex-1 px-3 py-2 rounded-xl border border-gray-200 focus:border-purple-500 outline-none text-sm"
                  />
                  <ArrowRightLeft className="w-4 h-4 text-gray-400" />
                  <div className="flex-1 bg-white px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-purple-600">
                    {calculatedPrice ? `₹${calculatedPrice}` : '-'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Clear Button */}
        <Button
          variant="outline"
          onClick={() => {
            setAmountPaid('');
            setOneKgRate('');
            setAmountPaidForWeight('');
            setGramsAsked('');
          }}
          className="w-full mt-4 rounded-2xl h-10 text-sm"
        >
          Clear All
        </Button>
      </div>
    </div>
  );
}
