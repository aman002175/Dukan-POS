// Regular Customers Section - VIP Grahak Database
import { useState, useMemo } from 'react';
import {
  Users, Search, Plus, Phone, MapPin, Star, Edit2,
  Trash2, MessageCircle, ChevronRight, Gift, TrendingUp,
  Check, FileText, Download, User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { VoiceSearchMic } from '@/components/VoiceSearchMic';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useApp } from '@/context/AppContext';
import { downloadCustomerBillsHTML, printBill, generateWhatsAppBill, themes } from '@/utils/billPDF';
import { buildCustomerLedger, computeBillSnapshot } from '@/utils/ledger';
import type { RegularCustomer } from '@/types';
import type { BillTheme } from '@/utils/billPDF';

export function CustomersSection() {
  const {
    state, addRegularCustomer, updateRegularCustomer, deleteRegularCustomer,
    getSalesByRegularCustomer, showToast
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<RegularCustomer | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showPDFDialog, setShowPDFDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pdfTheme, setPdfTheme] = useState<BillTheme>('modern');

  const [formData, setFormData] = useState({
    name: '', phone: '', address: '', birthday: '', notes: '', isFavorite: false
  });

  // ── Filtered customers ──
  const filteredCustomers = useMemo(() => {
    let list = state.regularCustomers || [];
    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim();
      const qDigits = q.replace(/\D/g, ''); // "+91 98765-43210" bola toh sirf digits match karo
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) || c.phone.includes(q) ||
        (qDigits.length >= 3 && c.phone.replace(/\D/g, '').includes(qDigits))
      );
    }
    // Sort: favorites first, then by totalSpent
    return [...list].sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return (b.totalSpent || 0) - (a.totalSpent || 0);
    });
  }, [state.regularCustomers, searchQuery]);

  const totalCustomers = (state.regularCustomers || []).length;
  const totalRevenue = (state.regularCustomers || []).reduce((s, c) => s + (c.totalSpent || 0), 0);
  const topCustomer = (state.regularCustomers || []).reduce<RegularCustomer | null>((best, c) =>
    !best || (c.totalSpent || 0) > (best.totalSpent || 0) ? c : best, null);

  // ── Birthday reminders ──
  const todayMMDD = new Date().toISOString().slice(5, 10);
  const birthdayToday = (state.regularCustomers || []).filter(c => c.birthday?.slice(5) === todayMMDD);

  const resetForm = () => setFormData({ name: '', phone: '', address: '', birthday: '', notes: '', isFavorite: false });

  const handleAdd = () => {
    if (!formData.name) return;
    addRegularCustomer({ ...formData });
    showToast(`${formData.name} add ho gaya! 🎉`, 'success');
    resetForm();
    setShowAddDialog(false);
  };

  const handleEdit = () => {
    if (!selectedCustomer || !formData.name) return;
    updateRegularCustomer({ ...selectedCustomer, ...formData });
    showToast('Customer update ho gaya', 'success');
    setShowEditDialog(false);
  };

  const handleDelete = () => {
    if (!selectedCustomer) return;
    deleteRegularCustomer(selectedCustomer.id);
    setShowDeleteConfirm(false);
    setShowDetailDialog(false);
    setSelectedCustomer(null);
  };

  const openDetail = (c: RegularCustomer) => {
    setSelectedCustomer(c);
    setShowDetailDialog(true);
  };

  const openEdit = (c: RegularCustomer) => {
    setSelectedCustomer(c);
    setFormData({
      name: c.name, phone: c.phone, address: c.address || '',
      birthday: c.birthday || '', notes: c.notes || '', isFavorite: c.isFavorite || false
    });
    setShowEditDialog(true);
  };

  const handleWhatsAppGreeting = (c: RegularCustomer) => {
    const shopName = state.businessProfile.shopName;
    const isB = c.birthday?.slice(5) === todayMMDD;
    const msg = isB
      ? `🎂 *Happy Birthday ${c.name} ji!* 🎉\n\n*${shopName}* ki taraf se aapko bahut bahut badhaiyaan! 🙏\n\nAapki khushiyan aur sehat salaamat rahe.\n\n_Aaj hamare yahan aaiye, aapke liye special hai!_ 🏪`
      : `Namaste *${c.name}* ji! 🙏\n\n*${shopName}* ki taraf se aapka shukriya ki aap hamare regular grahak hain! 🏪\n\n⭐ *Aapke Loyalty Points: ${c.loyaltyPoints || 0}*\n\n_Aate rahen, aur bhi bahut kuch hai!_ 😊`;
    const phone = c.phone.replace(/\D/g, '');
    if (!phone) { showToast('Phone number nahi hai', 'error'); return; }
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleDownloadPDF = () => {
    if (!selectedCustomer) return;
    const sales = getSalesByRegularCustomer(selectedCustomer.phone);
    const txns: never[] = []; // regular customers don't have khata transactions
    // Build a dummy customer object for PDF
    const custObj = {
      id: selectedCustomer.id,
      name: selectedCustomer.name,
      phone: selectedCustomer.phone,
      address: selectedCustomer.address || '',
      totalDue: 0,
      createdAt: selectedCustomer.createdAt,
    };
    downloadCustomerBillsHTML(custObj, sales, txns, state.businessProfile, pdfTheme);
    showToast('PDF download ho raha hai!', 'success');
    setShowPDFDialog(false);
  };

  const loyaltyTier = (pts: number) => {
    if (pts >= 500) return { label: 'Gold', color: 'text-yellow-600', bg: 'bg-yellow-100', icon: '🥇' };
    if (pts >= 200) return { label: 'Silver', color: 'text-gray-600', bg: 'bg-gray-100', icon: '🥈' };
    if (pts >= 50) return { label: 'Bronze', color: 'text-orange-600', bg: 'bg-orange-100', icon: '🥉' };
    return { label: 'New', color: 'text-blue-600', bg: 'bg-blue-100', icon: '⭐' };
  };

  return (
    <div className="p-4 lg:p-8 pb-24 lg:pb-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Regular Grahak</h2>
          <p className="text-gray-500">Apne khaas customers ka hisaab</p>
        </div>
        <Button
          onClick={() => { resetForm(); setShowAddDialog(true); }}
          className="rounded-2xl h-12 bg-gradient-to-r from-blue-500 to-indigo-600"
        >
          <Plus className="w-5 h-5 mr-2" /> Naya Grahak Add
        </Button>
      </div>

      {/* Birthday Alerts */}
      {birthdayToday.length > 0 && (
        <div className="bg-gradient-to-r from-pink-500 to-rose-500 rounded-2xl p-4 mb-5 text-white">
          <p className="font-bold text-base mb-1">🎂 Aaj Birthday hai!</p>
          {birthdayToday.map(c => (
            <div key={c.id} className="flex items-center justify-between">
              <p className="text-sm opacity-90">{c.name} ka birthday hai aaj 🎉</p>
              <button
                onClick={() => handleWhatsAppGreeting(c)}
                className="text-xs bg-white text-pink-600 px-3 py-1 rounded-full font-semibold"
              >
                WhatsApp Bhejo
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card className="rounded-2xl border-0 shadow-md bg-gradient-to-br from-blue-500 to-indigo-600">
          <CardContent className="p-4">
            <p className="text-blue-100 text-xs mb-1">Kul Grahak</p>
            <p className="text-white text-2xl font-black">{totalCustomers}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-0 shadow-md bg-gradient-to-br from-green-500 to-emerald-600">
          <CardContent className="p-4">
            <p className="text-green-100 text-xs mb-1">Kul Bikri</p>
            <p className="text-white text-xl font-black">₹{totalRevenue >= 1000 ? `${(totalRevenue/1000).toFixed(1)}k` : totalRevenue.toFixed(0)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-0 shadow-md bg-gradient-to-br from-yellow-500 to-orange-500">
          <CardContent className="p-4">
            <p className="text-yellow-100 text-xs mb-1">Top Grahak</p>
            <p className="text-white text-sm font-black truncate">{topCustomer?.name || '—'}</p>
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

      {/* Customer List */}
      <div className="space-y-3">
        {filteredCustomers.map(customer => {
          const tier = loyaltyTier(customer.loyaltyPoints || 0);
          const bills = getSalesByRegularCustomer(customer.phone);
          return (
            <div
              key={customer.id}
              onClick={() => openDetail(customer)}
              className="bg-white rounded-2xl shadow-md p-4 cursor-pointer hover:shadow-lg transition-shadow border border-gray-100"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${tier.bg}`}>
                    <span className="text-xl">{tier.icon}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold text-gray-900 truncate">{customer.name}</p>
                      {customer.isFavorite && <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500 flex-shrink-0" />}
                    </div>
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <Phone className="w-3 h-3" />{customer.phone || 'No phone'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-700">₹{(customer.totalSpent || 0).toFixed(0)}</p>
                    <p className="text-[10px] text-gray-400">{bills.length} bills</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </div>
              </div>

              <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-gray-50">
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tier.bg} ${tier.color}`}>
                    {tier.label}
                  </span>
                  <span className="text-xs text-gray-400">⭐ {customer.loyaltyPoints || 0} pts</span>
                </div>
                <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
                  {customer.phone && (
                    <button
                      onClick={() => handleWhatsAppGreeting(customer)}
                      className="p-1.5 bg-green-100 text-green-600 rounded-lg hover:bg-green-200"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => openEdit(customer)}
                    className="p-1.5 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredCustomers.length === 0 && (
        <div className="text-center py-16">
          <Users className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-400 font-medium">
            {searchQuery ? 'Koi match nahi mila' : 'Abhi koi regular grahak nahi'}
          </p>
          <p className="text-gray-300 text-sm mt-1">
            Bills banate waqt naam+phone dalne se auto-save hota hai
          </p>
        </div>
      )}

      {/* ── Add Customer Dialog ── */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader><DialogTitle>Naya Grahak Jodo</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-3">
            {[
              { label: 'Naam *', key: 'name', icon: User, placeholder: 'Customer ka naam', type: 'text' },
              { label: 'Phone', key: 'phone', icon: Phone, placeholder: 'Mobile number', type: 'tel' },
              { label: 'Pata', key: 'address', icon: MapPin, placeholder: 'Address', type: 'text' },
              { label: 'Birthday (optional)', key: 'birthday', icon: Gift, placeholder: '', type: 'date' },
            ].map(({ label, key, icon: Icon, placeholder, type }) => (
              <div key={key}>
                <Label className="text-xs text-gray-500">{label}</Label>
                <div className="relative mt-1">
                  <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    type={type}
                    value={formData[key as keyof typeof formData] as string}
                    onChange={e => setFormData({ ...formData, [key]: e.target.value })}
                    placeholder={placeholder}
                    className="pl-10 rounded-xl h-11"
                  />
                </div>
              </div>
            ))}
            <div>
              <Label className="text-xs text-gray-500">Notes (dukandar ke liye)</Label>
              <Input
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                placeholder="koi khaas baat..."
                className="rounded-xl h-11 mt-1"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={formData.isFavorite}
                onChange={e => setFormData({ ...formData, isFavorite: e.target.checked })}
                className="w-4 h-4 accent-yellow-500" />
              <span className="text-sm text-gray-700">⭐ Favorite Customer</span>
            </label>
            <div className="flex gap-3 pt-1">
              <Button variant="outline" onClick={() => setShowAddDialog(false)} className="flex-1 rounded-xl h-11">Cancel</Button>
              <Button onClick={handleAdd} disabled={!formData.name}
                className="flex-1 rounded-xl h-11 bg-gradient-to-r from-blue-500 to-indigo-600">
                <Check className="w-4 h-4 mr-2" /> Add
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ── */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader><DialogTitle>✏️ Edit Grahak</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-3">
            {[
              { label: 'Naam *', key: 'name', icon: User, placeholder: 'Naam', type: 'text' },
              { label: 'Phone', key: 'phone', icon: Phone, placeholder: 'Phone', type: 'tel' },
              { label: 'Pata', key: 'address', icon: MapPin, placeholder: 'Address', type: 'text' },
              { label: 'Birthday', key: 'birthday', icon: Gift, placeholder: '', type: 'date' },
            ].map(({ label, key, icon: Icon, placeholder, type }) => (
              <div key={key}>
                <Label className="text-xs text-gray-500">{label}</Label>
                <div className="relative mt-1">
                  <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    type={type}
                    value={formData[key as keyof typeof formData] as string}
                    onChange={e => setFormData({ ...formData, [key]: e.target.value })}
                    placeholder={placeholder}
                    className="pl-10 rounded-xl h-11"
                  />
                </div>
              </div>
            ))}
            <div>
              <Label className="text-xs text-gray-500">Notes</Label>
              <Input value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Notes..." className="rounded-xl h-11 mt-1" />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={formData.isFavorite}
                onChange={e => setFormData({ ...formData, isFavorite: e.target.checked })}
                className="w-4 h-4 accent-yellow-500" />
              <span className="text-sm text-gray-700">⭐ Favorite</span>
            </label>
            <div className="flex gap-3 pt-1">
              <Button variant="outline" onClick={() => setShowEditDialog(false)} className="flex-1 rounded-xl h-11">Cancel</Button>
              <Button onClick={handleEdit} disabled={!formData.name}
                className="flex-1 rounded-xl h-11 bg-gradient-to-r from-blue-500 to-indigo-600">
                <Check className="w-4 h-4 mr-2" /> Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Detail Dialog ── */}
      <Dialog open={showDetailDialog} onOpenChange={v => { setShowDetailDialog(v); if (!v) setSelectedCustomer(null); }}>
        <DialogContent className="sm:max-w-lg rounded-3xl max-h-[92vh] overflow-y-auto">
          {selectedCustomer && (() => {
            const bills = getSalesByRegularCustomer(selectedCustomer.phone);
            const tier = loyaltyTier(selectedCustomer.loyaltyPoints || 0);
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3">
                    <div className={`w-10 h-10 ${tier.bg} rounded-xl flex items-center justify-center`}>
                      <span className="text-xl">{tier.icon}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="font-bold">{selectedCustomer.name}</p>
                        {selectedCustomer.isFavorite && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
                      </div>
                      <p className="text-xs font-normal text-gray-500">{selectedCustomer.phone}</p>
                    </div>
                  </DialogTitle>
                </DialogHeader>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-2 mt-1">
                  <div className="bg-blue-50 rounded-xl p-3 text-center">
                    <p className="text-xl font-black text-blue-700">{bills.length}</p>
                    <p className="text-xs text-blue-500">Bills</p>
                  </div>
                  <div className="bg-green-50 rounded-xl p-3 text-center">
                    <p className="text-xl font-black text-green-700">₹{(selectedCustomer.totalSpent || 0).toFixed(0)}</p>
                    <p className="text-xs text-green-500">Total Spent</p>
                  </div>
                  <div className={`${tier.bg} rounded-xl p-3 text-center`}>
                    <p className={`text-xl font-black ${tier.color}`}>⭐{selectedCustomer.loyaltyPoints || 0}</p>
                    <p className={`text-xs ${tier.color}`}>{tier.label}</p>
                  </div>
                </div>

                {/* Info */}
                {(selectedCustomer.address || selectedCustomer.birthday || selectedCustomer.notes) && (
                  <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 text-sm">
                    {selectedCustomer.address && <p className="flex items-center gap-2 text-gray-600"><MapPin className="w-4 h-4" />{selectedCustomer.address}</p>}
                    {selectedCustomer.birthday && <p className="flex items-center gap-2 text-gray-600"><Gift className="w-4 h-4" />Birthday: {new Date(selectedCustomer.birthday).toLocaleDateString('en-IN', { day: '2-digit', month: 'long' })}</p>}
                    {selectedCustomer.notes && <p className="flex items-center gap-2 text-gray-600"><Edit2 className="w-4 h-4" />{selectedCustomer.notes}</p>}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => { setShowDetailDialog(false); openEdit(selectedCustomer); }}
                    className="rounded-xl h-10 text-xs border-blue-200 text-blue-700">
                    <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
                  </Button>
                  {selectedCustomer.phone && (
                    <Button variant="outline" onClick={() => handleWhatsAppGreeting(selectedCustomer)}
                      className="rounded-xl h-10 text-xs border-green-200 text-green-600">
                      <MessageCircle className="w-3.5 h-3.5 mr-1" /> WhatsApp
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => setShowPDFDialog(true)}
                    className="rounded-xl h-10 text-xs border-purple-200 text-purple-700">
                    <Download className="w-3.5 h-3.5 mr-1" /> PDF
                  </Button>
                  <Button variant="outline" onClick={() => setShowDeleteConfirm(true)}
                    className="rounded-xl h-10 text-xs border-red-200 text-red-600">
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                  </Button>
                </div>

                {/* Bills List */}
                {bills.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm text-gray-700 mb-2 flex items-center gap-2">
                      <FileText className="w-4 h-4" /> Bills ({bills.length})
                    </h4>
                    <div className="space-y-2 max-h-56 overflow-y-auto">
                      {bills.map(sale => (
                        <div key={sale.id} className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
                          <div>
                            <p className="text-xs font-semibold text-gray-700">{sale.billNumber || `#${sale.id.slice(-6)}`}</p>
                            <p className="text-xs text-gray-400">{sale.date} {sale.time} • {sale.items.length} items</p>
                            <p className="text-xs text-blue-500 capitalize">{sale.type === 'cash' ? '💵 Cash' : sale.type === 'split' ? '🔀 Split' : '📋 Udhaar'}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-gray-800">₹{sale.total.toFixed(2)}</p>
                            <button
                              onClick={() => printBill({ sale, customer: { ...selectedCustomer, address: selectedCustomer.address || '', totalDue: 0 }, business: state.businessProfile, theme: pdfTheme, snapshot: computeBillSnapshot(sale, buildCustomerLedger(bills, [])) })}
                              className="p-1.5 bg-orange-100 text-orange-600 rounded-lg hover:bg-orange-200"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                            {selectedCustomer.phone && (
                              <button
                                onClick={() => {
                                  const msg = generateWhatsAppBill(sale, state.businessProfile);
                                  window.open(`https://wa.me/${selectedCustomer.phone.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`, '_blank');
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

                {bills.length === 0 && (
                  <div className="text-center py-6 text-gray-400 text-sm">
                    <TrendingUp className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                    Abhi koi bill nahi. Jab bill banta hai to yahan dikhai dega.
                  </div>
                )}
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ── PDF Theme Dialog ── */}
      <Dialog open={showPDFDialog} onOpenChange={setShowPDFDialog}>
        <DialogContent className="sm:max-w-sm rounded-3xl">
          <DialogHeader><DialogTitle>📄 PDF Theme</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              {(Object.entries(themes) as [BillTheme, typeof themes[BillTheme]][]).map(([key, t]) => (
                <button key={key} onClick={() => setPdfTheme(key)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${pdfTheme === key ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <p className="text-sm font-semibold">{t.label}</p>
                  <div className="mt-1.5 h-3 rounded-full" style={{ background: t.headerBg }} />
                </button>
              ))}
            </div>
            <Button onClick={handleDownloadPDF}
              className="w-full rounded-xl h-11 bg-gradient-to-r from-purple-500 to-indigo-600">
              <Download className="w-4 h-4 mr-2" /> Download PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm Dialog ── */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-sm rounded-3xl">
          <DialogHeader><DialogTitle>🗑️ Customer Delete?</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-gray-600">
              <strong>{selectedCustomer?.name}</strong> ko delete karna chahte hain? Unke bills records waise hi rahenge.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} className="flex-1 rounded-xl h-11">Cancel</Button>
              <Button onClick={handleDelete} className="flex-1 rounded-xl h-11 bg-red-600 hover:bg-red-700">
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
