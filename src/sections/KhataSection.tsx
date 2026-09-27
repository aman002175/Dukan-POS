// Khata Book Section - Enhanced with advance history, running balance, better UX
import { useState, useMemo } from 'react';
import {
  Plus, Search, User, Phone, MapPin, IndianRupee,
  Check, MessageCircle, History,
  Download, FileText, ChevronRight, Wallet, AlertCircle,
  Receipt, Clock, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { VoiceSearchMic } from '@/components/VoiceSearchMic';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useApp } from '@/context/AppContext';
import {
  printBill, downloadCustomerBillsHTML, generateWhatsAppBill, themes
} from '@/utils/billPDF';
import { buildDueReminderMessage, buildAllDuesMessage, sendWhatsAppText } from '@/utils/reminders';
import type { BillTheme } from '@/utils/billPDF';
import type { Customer, Sale, Transaction } from '@/types';

type BillThemeLocal = BillTheme;

// Running balance entry — merges sales + payments in chronological order
interface LedgerEntry {
  id: string;
  type: 'sale' | 'payment';
  date: string;
  time: string;
  createdAt: number;
  amount: number;
  description: string;
  billNumber?: string;
  sale?: Sale;
  runningBalance: number; // totalDue after this entry
}

function buildLedger(sales: Sale[], transactions: Transaction[]): LedgerEntry[] {
  const entries: Omit<LedgerEntry, 'runningBalance'>[] = [
    ...sales.map(s => ({
      id: s.id,
      type: 'sale' as const,
      date: s.date,
      time: s.time,
      createdAt: s.createdAt,
      // For advance: actual charge = total - advanceUsed
      // For split/partial: cash hissa already paid — khate mein SIRF baaki hissa
      amount: (() => {
        const base = (s.advanceBeforeBill !== undefined && s.advanceBeforeBill < 0)
          ? Math.max(0, s.total - Math.min(Math.abs(s.advanceBeforeBill), s.total))
          : s.total;
        if (s.type !== 'cash') return Math.max(0, base - (s.amountPaid || 0));
        return base;
      })(),
      description: `${s.items.length} item${s.items.length > 1 ? 's' : ''} — ${s.items.slice(0,2).map(i => i.name).join(', ')}${s.items.length > 2 ? '...' : ''}`,
      billNumber: s.billNumber,
      sale: s,
    })),
    ...transactions.map(t => ({
      id: t.id,
      type: t.type as 'sale' | 'payment',
      date: t.date,
      time: t.time,
      createdAt: t.createdAt,
      amount: t.amount,
      description: t.description,
    })),
  ];

  entries.sort((a, b) => a.createdAt - b.createdAt);

  // Compute running balance (starts at 0, + sale, - payment)
  let running = 0;
  return entries.map(e => {
    if (e.type === 'sale') {
      running += e.amount;
    } else {
      running -= e.amount;
    }
    return { ...e, runningBalance: running };
  }).reverse(); // most recent first for display
}

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
  const [detailTab, setDetailTab] = useState<'ledger' | 'bills'>('ledger');

  const [formData, setFormData] = useState({ name: '', phone: '', address: '' });

  const filteredCustomers = useMemo(() => {
    let customers = state.customers;
    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim();
      const qDigits = q.replace(/\D/g, ''); // "+91 98765-43210" bola toh sirf digits match karo
      customers = customers.filter(c =>
        c.name.toLowerCase().includes(q) || c.phone.includes(q) ||
        (qDigits.length >= 3 && c.phone.replace(/\D/g, '').includes(qDigits))
      );
    }
    return customers.sort((a, b) => {
      // Sort: due customers first (desc), then advance, then clear
      if (a.totalDue > 0 && b.totalDue <= 0) return -1;
      if (b.totalDue > 0 && a.totalDue <= 0) return 1;
      return Math.abs(b.totalDue) - Math.abs(a.totalDue);
    });
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

    setPaymentAmount('');
    setShowPaymentDialog(false);

    if (isAdvance) {
      const advance = amount - Math.max(0, selectedCustomer.totalDue);
      showToast(`✅ ₹${advance.toFixed(2)} advance balance ho gaya`, 'success');
    } else {
      showToast(`✅ ₹${amount.toFixed(2)} payment recorded`, 'success');
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
    const shopName = state.businessProfile.shopName;
    const msg = customer.totalDue > 0
      ? buildDueReminderMessage(customer.name, customer.totalDue, shopName)
      : `Namaste *${customer.name}* ji! 🙏\n\n*${shopName}* ki taraf se.\n\nAapka ₹${Math.abs(customer.totalDue).toFixed(2)} *advance balance* hai. Agle bill mein kaat liya jayega.\n\nShukriya! 🏪`;
    const method = sendWhatsAppText(msg, customer.phone);
    if (method === 'clipboard' || method === 'share') showToast('Number nahi hai — message share/copy ke liye khola!', 'info');
  };

  // ── Bulk Takaza: search-filtered due customers ──
  const takazaCustomers = filteredCustomers.filter(c => c.totalDue > 0);

  const handleCopyAllDues = () => {
    const text = buildAllDuesMessage(
      takazaCustomers.map(c => ({ name: c.name, due: c.totalDue })),
      state.businessProfile.shopName
    );
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(
        () => showToast(`${takazaCustomers.length} takaza copy ho gaye!`, 'success'),
        () => showToast('Copy nahi hua', 'error')
      );
    } else {
      showToast('Clipboard supported nahi hai', 'error');
    }
  };

  const openDetail = (c: Customer) => {
    setSelectedCustomer(c);
    setDetailTab('ledger');
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
            <p className="text-white text-2xl font-black">₹{totalOutstanding.toFixed(0)}</p>
            <p className="text-red-200 text-xs mt-1">{state.customers.filter(c => c.totalDue > 0).length} customers</p>
          </CardContent>
        </Card>
        <Card className="rounded-3xl border-0 shadow-lg bg-gradient-to-br from-green-500 to-emerald-600">
          <CardContent className="p-5">
            <p className="text-green-100 text-xs mb-1">Advance Balance</p>
            <p className="text-white text-2xl font-black">₹{totalAdvance.toFixed(0)}</p>
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
            className="pl-12 pr-12 rounded-2xl h-12"
          />
          <VoiceSearchMic onResult={(t) => setSearchQuery(t)} />
        </div>

      {/* Takaza — Bulk Udhaar Reminders */}
      {takazaCustomers.length > 0 && (
        <Card className="rounded-3xl border-0 shadow-lg mb-5 bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 bg-green-500 rounded-xl flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">Takaza Bhejo ({takazaCustomers.length})</h3>
                  <p className="text-xs text-gray-500">WhatsApp par yaad dilao • Kul ₹{takazaCustomers.reduce((s, c) => s + c.totalDue, 0).toFixed(0)} baki</p>
                </div>
              </div>
              <button
                onClick={handleCopyAllDues}
                className="text-xs font-bold px-3 py-2 rounded-xl bg-white border border-green-200 text-green-700 hover:bg-green-100"
              >
                📋 Sab Copy
              </button>
            </div>
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {takazaCustomers.map(c => (
                <div key={c.id} className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-green-100">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
                    <p className="text-xs text-red-600 font-bold">₹{c.totalDue.toFixed(0)} baki</p>
                  </div>
                  <button
                    onClick={() => handleWhatsApp(c)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-500 text-white text-xs font-bold hover:bg-green-600 flex-shrink-0 ml-2"
                  >
                    <MessageCircle className="w-3.5 h-3.5" /> Takaza
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Customer List */}
      <div className="space-y-3">
        {filteredCustomers.map(customer => {
          const isAdvance = customer.totalDue < 0;
          const isZero = customer.totalDue === 0;
          const custSales = state.sales.filter(s => s.customerId === customer.id);
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
                    <div className="flex items-center gap-2 flex-wrap">
                      {customer.phone && (
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <Phone className="w-3 h-3" />{customer.phone}
                        </p>
                      )}
                      {custSales.length > 0 && (
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                          <Receipt className="w-3 h-3" />{custSales.length} bills
                        </p>
                      )}
                    </div>
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
            const ledger = buildLedger(custSales, txns);
            const totalBilled = custSales.reduce((s, sl) => s + sl.total, 0);
            const totalPaid = txns.filter(t => t.type === 'payment').reduce((s, t) => s + t.amount, 0);

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

                {/* Summary Strip */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-red-50 rounded-xl p-3 text-center">
                    <p className="text-lg font-black text-red-700">₹{totalBilled.toFixed(0)}</p>
                    <p className="text-[10px] text-red-400">Total Udhaar</p>
                  </div>
                  <div className="bg-green-50 rounded-xl p-3 text-center">
                    <p className="text-lg font-black text-green-700">₹{totalPaid.toFixed(0)}</p>
                    <p className="text-[10px] text-green-400">Total Paid</p>
                  </div>
                  <div className={`rounded-xl p-3 text-center ${isAdvance ? 'bg-emerald-50' : 'bg-orange-50'}`}>
                    <p className={`text-lg font-black ${isAdvance ? 'text-emerald-700' : 'text-orange-700'}`}>
                      ₹{Math.abs(selectedCustomer.totalDue).toFixed(0)}
                    </p>
                    <p className={`text-[10px] ${isAdvance ? 'text-emerald-400' : 'text-orange-400'}`}>
                      {isAdvance ? 'Advance' : 'Net Baki'}
                    </p>
                  </div>
                </div>

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
                <div className="grid grid-cols-3 gap-2">
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

                {/* Tab switcher */}
                <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
                  <button
                    onClick={() => setDetailTab('ledger')}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${detailTab === 'ledger' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500'}`}
                  >
                    <History className="w-3.5 h-3.5 inline mr-1" /> Ledger (Running Balance)
                  </button>
                  <button
                    onClick={() => setDetailTab('bills')}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${detailTab === 'bills' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500'}`}
                  >
                    <FileText className="w-3.5 h-3.5 inline mr-1" /> Bills ({custSales.length})
                  </button>
                </div>

                {/* LEDGER TAB */}
                {detailTab === 'ledger' && (
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {ledger.length === 0 && (
                      <p className="text-center text-gray-400 text-sm py-6">Koi entry nahi</p>
                    )}
                    {ledger.map((entry) => (
                      <div
                        key={entry.id}
                        className={`rounded-xl p-3 flex items-center gap-3 ${entry.type === 'sale' ? 'bg-red-50 border border-red-100' : 'bg-green-50 border border-green-100'}`}
                      >
                        {/* Icon */}
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${entry.type === 'sale' ? 'bg-red-100' : 'bg-green-100'}`}>
                          {entry.type === 'sale'
                            ? <ArrowUpRight className="w-4 h-4 text-red-600" />
                            : <ArrowDownRight className="w-4 h-4 text-green-600" />}
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs font-bold ${entry.type === 'sale' ? 'text-red-700' : 'text-green-700'}`}>
                              {entry.type === 'sale' ? '📈 Udhaar' : '💵 Payment'}
                            </span>
                            {entry.billNumber && (
                              <span className="text-[10px] text-gray-400 font-medium">{entry.billNumber}</span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-500 truncate mt-0.5">{entry.description}</p>
                          <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                            <Clock className="w-2.5 h-2.5" />{entry.date} {entry.time}
                          </p>
                        </div>
                        {/* Amounts */}
                        <div className="text-right flex-shrink-0">
                          <p className={`font-black text-sm ${entry.type === 'sale' ? 'text-red-700' : 'text-green-700'}`}>
                            {entry.type === 'sale' ? '+' : '-'}₹{entry.amount.toFixed(0)}
                          </p>
                          <p className={`text-[10px] font-semibold mt-0.5 ${entry.runningBalance < 0 ? 'text-green-600' : entry.runningBalance > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                            {entry.runningBalance < 0
                              ? `Adv ₹${Math.abs(entry.runningBalance).toFixed(0)}`
                              : entry.runningBalance > 0
                              ? `Due ₹${entry.runningBalance.toFixed(0)}`
                              : 'Clear ✓'}
                          </p>
                        </div>
                        {/* Print bill if it's a sale */}
                        {entry.type === 'sale' && entry.sale && (
                          <button
                            onClick={() => printBill({ sale: entry.sale!, customer: selectedCustomer, business: state.businessProfile, theme: pdfTheme })}
                            className="ml-1 p-1.5 bg-orange-100 text-orange-600 rounded-lg hover:bg-orange-200 flex-shrink-0"
                            title="Print bill"
                          >
                            <FileText className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* BILLS TAB */}
                {detailTab === 'bills' && (
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {custSales.length === 0 && (
                      <p className="text-center text-gray-400 text-sm py-6">Koi bill nahi</p>
                    )}
                    {custSales.map(sale => {
                      const advBefore = sale.advanceBeforeBill !== undefined && sale.advanceBeforeBill < 0
                        ? Math.abs(sale.advanceBeforeBill) : 0;
                      const advUsed = Math.min(advBefore, sale.total);
                      const netCharge = sale.total - advUsed;
                      return (
                        <div key={sale.id} className="bg-gray-50 rounded-xl p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-xs font-bold text-gray-700">{sale.billNumber || `#${sale.id.slice(-6)}`}</p>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${sale.type === 'udhaar' ? 'bg-red-100 text-red-700' : sale.type === 'split' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                                  {sale.type === 'udhaar' ? 'Udhaar' : sale.type === 'split' ? '🔀 Split' : 'Cash'}
                                </span>
                              </div>
                              <p className="text-[10px] text-gray-400 mt-0.5">{sale.date} {sale.time}</p>
                              {/* Advance breakdown */}
                              {advUsed > 0 && (
                                <div className="mt-1 flex flex-wrap gap-2 text-[10px]">
                                  <span className="text-gray-500">Bill: ₹{sale.total.toFixed(0)}</span>
                                  <span className="text-green-600">- Advance: ₹{advUsed.toFixed(0)}</span>
                                  <span className="font-semibold text-gray-800">= ₹{netCharge.toFixed(0)}</span>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                              <div className="text-right">
                                <p className="font-bold text-gray-900 text-sm">₹{sale.total.toFixed(0)}</p>
                                {advUsed > 0 && <p className="text-[10px] text-green-600">Net: ₹{netCharge.toFixed(0)}</p>}
                              </div>
                              <button
                                onClick={() => printBill({ sale, customer: selectedCustomer, business: state.businessProfile, theme: pdfTheme })}
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
                        </div>
                      );
                    })}
                  </div>
                )}
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
