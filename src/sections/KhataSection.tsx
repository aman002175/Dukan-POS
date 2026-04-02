// Khata Book Section - With Advance Payment + PDF Download + Customer Bills
import { useState, useMemo } from 'react';
import {
  Plus, Search, User, Phone, MapPin, IndianRupee,
  Check, MessageCircle, History, TrendingDown, TrendingUp,
  Download, FileText, ChevronRight, Wallet, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useApp } from '@/context/AppContext';
import {
  printBill, downloadCustomerBillsHTML, generateWhatsAppBill, themes
} from '@/utils/billPDF';
import type { BillTheme } from '@/utils/billPDF';
import type { Customer } from '@/types';

type BillThemeLocal = BillTheme;

export function KhataSection() {
  const {
    state, addCustomer, addTransaction,
    getCustomerTransactions, getCustomerSales, showToast
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showPDFDialog, setShowPDFDialog] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [pdfTheme, setPdfTheme] = useState<BillThemeLocal>('modern');

  const [formData, setFormData] = useState({ name: '', phone: '', address: '' });

  const filteredCustomers = useMemo(() => {
    let customers = state.customers;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      customers = customers.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q));
    }
    return customers.sort((a, b) => b.totalDue - a.totalDue);
  }, [state.customers, searchQuery]);

  const totalOutstanding = state.customers.reduce((s, c) => s + Math.max(0, c.totalDue), 0);
  const totalAdvance = state.customers.reduce((s, c) => s + Math.max(0, -c.totalDue), 0);

  const handleAddCustomer = () => {
    if (formData.name) {
      addCustomer(formData);
      setFormData({ name: '', phone: '', address: '' });
      setShowAddDialog(false);
    }
  };

  const handlePayment = () => {
    if (!selectedCustomer || !paymentAmount) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) return;

    const isAdvance = amount > selectedCustomer.totalDue;
    addTransaction({
      customerId: selectedCustomer.id,
      type: 'payment',
      amount,
      description: `Payment received${isAdvance ? ' (Advance)' : ''}`,
    });

    // Refresh selectedCustomer from state after update
    setPaymentAmount('');
    setShowPaymentDialog(false);

    if (isAdvance) {
      const advance = amount - Math.max(0, selectedCustomer.totalDue);
      showToast(`✅ ₹${advance.toFixed(2)} advance balance ho gaya`, 'success');
    }
  };

  const handleDownloadCustomerPDF = () => {
    if (!selectedCustomer) return;
    const sales = getCustomerSales(selectedCustomer.id);
    const txns = getCustomerTransactions(selectedCustomer.id);
    downloadCustomerBillsHTML(selectedCustomer, sales, txns, state.businessProfile, pdfTheme);
    showToast('Customer ka Khata download ho gaya!', 'success');
    setShowPDFDialog(false);
  };

  const handleWhatsApp = (customer: Customer) => {
    // Send outstanding balance message
    const shopName = state.businessProfile.shopName;
    const msg = customer.totalDue > 0
      ? `Namaste *${customer.name}* ji! 🙏\n\n*${shopName}* se baat kar rahe hain.\n\nAapka *₹${customer.totalDue.toFixed(2)}* baki hai. Jald se jald chukta karein.\n\nShukriya! 🏪`
      : `Namaste *${customer.name}* ji! 🙏\n\n*${shopName}* ki taraf se.\n\nAapka ₹${Math.abs(customer.totalDue).toFixed(2)} *advance balance* hai. Agle bill mein kaat liya jayega.\n\nShukriya! 🏪`;
    const url = `https://wa.me/${customer.phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const openDetail = (c: Customer) => {
    setSelectedCustomer(c);
    setShowDetailDialog(true);
  };

  return (
    <div className="p-4 lg:p-8 pb-24 lg:pb-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Khata Book</h2>
          <p className="text-gray-500">Grahak ka hisaab — Udhaar & Advance</p>
        </div>
        <Button
          onClick={() => setShowAddDialog(true)}
          className="rounded-2xl h-12 bg-gradient-to-r from-orange-500 to-red-600"
        >
          <Plus className="w-5 h-5 mr-2" /> Naya Grahak
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card className="rounded-3xl border-0 shadow-lg bg-gradient-to-br from-red-500 to-orange-600">
          <CardContent className="p-5">
            <p className="text-red-100 text-xs mb-1">Kul Udhaar</p>
            <p className="text-white text-2xl font-black">₹{totalOutstanding.toFixed(2)}</p>
            <p className="text-red-200 text-xs mt-1">{state.customers.filter(c => c.totalDue > 0).length} customers</p>
          </CardContent>
        </Card>
        <Card className="rounded-3xl border-0 shadow-lg bg-gradient-to-br from-green-500 to-emerald-600">
          <CardContent className="p-5">
            <p className="text-green-100 text-xs mb-1">Advance Balance</p>
            <p className="text-white text-2xl font-black">₹{totalAdvance.toFixed(2)}</p>
            <p className="text-green-200 text-xs mt-1">{state.customers.filter(c => c.totalDue < 0).length} customers</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <Input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Naam ya phone se dhundho..."
          className="pl-12 rounded-2xl h-12"
        />
      </div>

      {/* Customer List */}
      <div className="space-y-3">
        {filteredCustomers.map(customer => {
          const isAdvance = customer.totalDue < 0;
          const isZero = customer.totalDue === 0;
          return (
            <div
              key={customer.id}
              onClick={() => openDetail(customer)}
              className="bg-white rounded-2xl shadow-md p-4 cursor-pointer hover:shadow-lg transition-shadow border border-gray-100"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0
                    ${isAdvance ? 'bg-green-100' : isZero ? 'bg-gray-100' : 'bg-red-100'}`}>
                    <User className={`w-5 h-5 ${isAdvance ? 'text-green-600' : isZero ? 'text-gray-500' : 'text-red-600'}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{customer.name}</p>
                    {customer.phone && (
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <Phone className="w-3 h-3" />{customer.phone}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="text-right">
                    <p className={`text-lg font-black ${isAdvance ? 'text-green-600' : isZero ? 'text-gray-400' : 'text-red-600'}`}>
                      {isAdvance ? '✅' : isZero ? '—' : '⚠️'} ₹{Math.abs(customer.totalDue).toFixed(2)}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {isAdvance ? 'Advance' : isZero ? 'Clear' : 'Baki'}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </div>
              </div>

              <div className="flex gap-2 mt-3" onClick={e => e.stopPropagation()}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setSelectedCustomer(customer); setShowPaymentDialog(true); }}
                  className="flex-1 h-9 rounded-xl text-xs"
                >
                  <IndianRupee className="w-3.5 h-3.5 mr-1" /> Payment Lo
                </Button>
                {customer.phone && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleWhatsApp(customer)}
                    className="h-9 px-3 rounded-xl border-green-200 text-green-600 hover:bg-green-50"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredCustomers.length === 0 && (
        <div className="text-center py-16">
          <User className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-400 font-medium">Koi grahak nahi mila</p>
        </div>
      )}

      {/* ── Add Customer Dialog ── */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader><DialogTitle>Naya Grahak Jodo</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            {[
              { label: 'Naam *', key: 'name', icon: User, placeholder: 'Grahak ka naam' },
              { label: 'Phone', key: 'phone', icon: Phone, placeholder: 'Mobile number' },
              { label: 'Pata', key: 'address', icon: MapPin, placeholder: 'Address (optional)' },
            ].map(({ label, key, icon: Icon, placeholder }) => (
              <div key={key}>
                <Label>{label}</Label>
                <div className="relative mt-1">
                  <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    value={formData[key as keyof typeof formData]}
                    onChange={e => setFormData({ ...formData, [key]: e.target.value })}
                    placeholder={placeholder}
                    className="pl-10 rounded-xl h-11"
                  />
                </div>
              </div>
            ))}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowAddDialog(false)} className="flex-1 rounded-xl h-11">Cancel</Button>
              <Button onClick={handleAddCustomer} disabled={!formData.name}
                className="flex-1 rounded-xl h-11 bg-gradient-to-r from-orange-500 to-red-600">
                <Check className="w-4 h-4 mr-2" /> Add
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Customer Detail Dialog ── */}
      <Dialog open={showDetailDialog} onOpenChange={v => { setShowDetailDialog(v); if (!v) setSelectedCustomer(null); }}>
        <DialogContent className="sm:max-w-lg rounded-3xl max-h-[92vh] overflow-y-auto">
          {selectedCustomer && (() => {
            const txns = getCustomerTransactions(selectedCustomer.id);
            const custSales = getCustomerSales(selectedCustomer.id);
            const isAdvance = selectedCustomer.totalDue < 0;
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                      <User className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="font-bold">{selectedCustomer.name}</p>
                      <p className={`text-sm font-normal ${isAdvance ? 'text-green-600' : 'text-red-500'}`}>
                        {isAdvance
                          ? `✅ Advance: ₹${Math.abs(selectedCustomer.totalDue).toFixed(2)}`
                          : `⚠️ Baki: ₹${selectedCustomer.totalDue.toFixed(2)}`}
                      </p>
                    </div>
                  </DialogTitle>
                </DialogHeader>

                {/* Advance notice */}
                {isAdvance && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700 flex gap-2">
                    <Wallet className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>
                      <b>Advance Balance: ₹{Math.abs(selectedCustomer.totalDue).toFixed(2)}</b>
                      {' '}— Yeh paisa agle bill mein automatically cut ho jayega.
                    </span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="grid grid-cols-3 gap-2 mt-1">
                  <Button
                    onClick={() => setShowPaymentDialog(true)}
                    className="rounded-xl h-10 bg-green-600 hover:bg-green-700 text-xs"
                  >
                    <IndianRupee className="w-3.5 h-3.5 mr-1" /> Payment
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowPDFDialog(true)}
                    className="rounded-xl h-10 text-xs border-purple-200 text-purple-700 hover:bg-purple-50"
                  >
                    <Download className="w-3.5 h-3.5 mr-1" /> PDF
                  </Button>
                  {selectedCustomer.phone && (
                    <Button
                      variant="outline"
                      onClick={() => handleWhatsApp(selectedCustomer)}
                      className="rounded-xl h-10 text-xs border-green-200 text-green-600 hover:bg-green-50"
                    >
                      <MessageCircle className="w-3.5 h-3.5 mr-1" /> WhatsApp
                    </Button>
                  )}
                </div>

                {/* Bills */}
                {custSales.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-800 text-sm mb-2 flex items-center gap-2">
                      <FileText className="w-4 h-4" /> Bills ({custSales.length})
                    </h4>
                    <div className="space-y-2">
                      {custSales.map(sale => (
                        <div key={sale.id} className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
                          <div>
                            <p className="text-xs font-semibold text-gray-700">{sale.billNumber || `#${sale.id.slice(-6)}`}</p>
                            <p className="text-xs text-gray-400">{sale.date} {sale.time}</p>
                            <p className="text-xs text-gray-500">{sale.items.length} items</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-gray-900">₹{sale.total.toFixed(2)}</p>
                            <button
                              onClick={() => {
                                printBill({ sale, customer: selectedCustomer, business: state.businessProfile, theme: pdfTheme });
                              }}
                              className="p-1.5 bg-orange-100 text-orange-600 rounded-lg hover:bg-orange-200"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                            {selectedCustomer.phone && (
                              <button
                                onClick={() => {
                                  const msg = generateWhatsAppBill(sale, state.businessProfile, selectedCustomer);
                                  window.open(`https://wa.me/${selectedCustomer.phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
                                }}
                                className="p-1.5 bg-green-100 text-green-600 rounded-lg hover:bg-green-200"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Transaction History */}
                <div>
                  <h4 className="font-semibold text-gray-800 text-sm mb-2 flex items-center gap-2">
                    <History className="w-4 h-4" /> Transactions ({txns.length})
                  </h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {txns.map(tx => (
                      <div
                        key={tx.id}
                        className={`p-3 rounded-xl flex items-center justify-between ${tx.type === 'sale' ? 'bg-red-50' : 'bg-green-50'}`}
                      >
                        <div className="flex items-center gap-2">
                          {tx.type === 'sale'
                            ? <TrendingUp className="w-4 h-4 text-red-500" />
                            : <TrendingDown className="w-4 h-4 text-green-600" />}
                          <div>
                            <p className={`text-xs font-semibold ${tx.type === 'sale' ? 'text-red-700' : 'text-green-700'}`}>
                              {tx.type === 'sale' ? 'Udhaar' : 'Payment'}
                            </p>
                            <p className="text-[10px] text-gray-400">{tx.date} {tx.time}</p>
                          </div>
                        </div>
                        <span className={`font-bold text-sm ${tx.type === 'sale' ? 'text-red-700' : 'text-green-700'}`}>
                          {tx.type === 'sale' ? '+' : '-'}₹{tx.amount.toFixed(2)}
                        </span>
                      </div>
                    ))}
                    {txns.length === 0 && <p className="text-center text-gray-400 text-sm py-4">Koi transaction nahi</p>}
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ── Payment Dialog ── */}
      <Dialog open={showPaymentDialog} onOpenChange={v => { setShowPaymentDialog(v); if (!v) setPaymentAmount(''); }}>
        <DialogContent className="sm:max-w-sm rounded-3xl">
          <DialogHeader><DialogTitle>Payment Lo</DialogTitle></DialogHeader>
          {selectedCustomer && (
            <div className="space-y-4 mt-2">
              {/* Balance info */}
              <div className={`rounded-2xl p-4 text-center ${selectedCustomer.totalDue > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                <p className="text-xs text-gray-500 mb-1">
                  {selectedCustomer.totalDue > 0 ? 'Abhi Baki Hai' : selectedCustomer.totalDue < 0 ? 'Advance Balance' : 'Sab Clear Hai'}
                </p>
                <p className={`text-3xl font-black ${selectedCustomer.totalDue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  ₹{Math.abs(selectedCustomer.totalDue).toFixed(2)}
                </p>
              </div>

              {/* Advance notice */}
              {parseFloat(paymentAmount) > Math.max(0, selectedCustomer.totalDue) && parseFloat(paymentAmount) > 0 && (
                <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700 flex gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>
                    Yeh payment baki se zyada hai! <b>₹{(parseFloat(paymentAmount) - Math.max(0, selectedCustomer.totalDue)).toFixed(2)}</b> advance balance ho jayega.
                  </span>
                </div>
              )}

              <div>
                <Label className="text-sm">Amount (₹)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                  className="rounded-xl h-12 text-xl text-center mt-1 font-bold"
                  autoFocus
                />
              </div>

              {/* Quick amounts */}
              <div className="flex gap-2 flex-wrap">
                {[100, 200, 500, 1000, Math.ceil(selectedCustomer.totalDue)].filter(v => v > 0).slice(0, 4).map(amt => (
                  <button key={amt} onClick={() => setPaymentAmount(amt.toString())}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${parseFloat(paymentAmount) === amt ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                    ₹{amt}
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowPaymentDialog(false)} className="flex-1 rounded-xl h-11">Cancel</Button>
                <Button onClick={handlePayment} disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}
                  className="flex-1 rounded-xl h-11 bg-green-600 hover:bg-green-700">
                  <Check className="w-4 h-4 mr-2" /> Confirm
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── PDF Theme & Download Dialog ── */}
      <Dialog open={showPDFDialog} onOpenChange={setShowPDFDialog}>
        <DialogContent className="sm:max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle>📄 PDF Download — {selectedCustomer?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-gray-500">Theme choose karo:</p>
            <div className="grid grid-cols-2 gap-3">
              {(Object.entries(themes) as [BillThemeLocal, typeof themes[BillThemeLocal]][]).map(([key, t]) => (
                <button
                  key={key}
                  onClick={() => setPdfTheme(key)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${pdfTheme === key ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <p className="text-sm font-semibold">{t.label}</p>
                  <div className="mt-1.5 h-3 rounded-full" style={{ background: t.headerBg }} />
                </button>
              ))}
            </div>
            <Button
              onClick={handleDownloadCustomerPDF}
              className="w-full rounded-xl h-11 bg-gradient-to-r from-purple-500 to-indigo-600"
            >
              <Download className="w-4 h-4 mr-2" /> Download Khata PDF
            </Button>
            <p className="text-xs text-gray-400 text-center">
              File open karke browser se Print → Save as PDF karo
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
