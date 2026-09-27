// Reports Section - Sales Analytics (Enhanced)
import { useState, useMemo } from 'react';
import {
  TrendingUp,
  Calendar,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  ChevronRight,
  Package,
  IndianRupee,
  Users,
  ShoppingBag,
  Phone,
  Download,
  MessageCircle,
  X,
  Printer,
  Wallet,
  Star,
  Target,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useApp } from '@/context/AppContext';
import { useNavigate } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { printBill, generateWhatsAppBill, themes } from '@/utils/billPDF';
import { buildCustomerLedger, computeBillSnapshot } from '@/utils/ledger';
import { ReturnDialog } from '@/components/ReturnDialog';
import { askAI } from '@/utils/aiService';
import { useAuth } from '@/context/AuthContext';
import { speak, stopSpeaking, isSpeaking } from '@/utils/ttsService';
import type { BillTheme } from '@/utils/billPDF';
import type { Sale } from '@/types';

// ── Custom Tooltip for bar chart ──
const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; fill: string }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-xl p-3 text-sm">
      <p className="font-bold text-gray-800 mb-2">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.fill }} className="font-semibold">
          {p.name} : ₹{p.value.toFixed(2)}
        </p>
      ))}
    </div>
  );
};

export function ReportsSection() {
  const { state, showToast } = useApp();
  const { mode: authMode } = useAuth();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('week');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const [showPDFDialog, setShowPDFDialog] = useState(false);
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [summary, setSummary] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [pdfTheme, setPdfTheme] = useState<BillTheme>('modern');

  // ── Statistics ──
  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todaySales = state.sales.filter(s => s.date === today);

    // Split-aware parts: cash hissa vs udhaar hissa (split bill dono mein bat-ta hai)
    const cashPart = (s: { type: string; total: number; amountPaid?: number }) =>
      s.type === 'cash' ? s.total : (s.amountPaid || 0);
    const udhaarPart = (s: { type: string; total: number; amountPaid?: number }) =>
      s.type === 'cash' ? 0 : s.total - (s.amountPaid || 0);

    const totalSales = state.sales.reduce((sum, s) => sum + s.total, 0);
    const cashSales = state.sales.reduce((sum, s) => sum + cashPart(s), 0);
    const udhaarSales = state.sales.reduce((sum, s) => sum + udhaarPart(s), 0);
    const todayTotal = todaySales.reduce((sum, s) => sum + s.total, 0);
    const todayCash = todaySales.reduce((sum, s) => sum + cashPart(s), 0);
    const todayUdhaar = todaySales.reduce((sum, s) => sum + udhaarPart(s), 0);

    // Average order value
    const avgOrder = state.sales.length > 0 ? totalSales / state.sales.length : 0;

    // Unique customers from sales
    const uniqueCustomers = new Set(state.sales.map(s => s.customerId || s.customerName || s.customerPhone).filter(Boolean));

    // Top products by revenue
    const productMap: Record<string, { name: string; qty: number; revenue: number }> = {};
    state.sales.forEach(sale => {
      sale.items.forEach(item => {
        if (!productMap[item.name]) productMap[item.name] = { name: item.name, qty: 0, revenue: 0 };
        productMap[item.name].qty += item.quantity;
        productMap[item.name].revenue += item.total;
      });
    });
    const topProducts = Object.values(productMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // ── Profit / Loss (based on cost price) ──
    let totalRevenue = 0;
    let totalCost = 0;
    state.sales.forEach(sale => {
      sale.items.forEach(item => {
        const prod = state.products.find(p => p.id === item.productId);
        totalRevenue += item.total;
        totalCost += (prod?.costPrice ?? 0) * item.quantity;
      });
    });
    const grossProfit = totalRevenue - totalCost;
    const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    // Net cash collected — sales ka jo paisa sach mein aa gaya.
    // ✅ FIX: pehle 'cash sales + saare payments' the — advance deposits bhi
    // gin jaate the (jo sales ka paisa nahi hai) → number inflated dikhta tha
    // (jaise 7.7k ke saamne 8.4k). Ab: Total Sales − Abhi ka unpaid Baaki.
    // (Advance deposits jo customer ne jama kiye wo alag hain — wo sales nahi.)
    const currentOutstanding = state.customers.reduce((s, c) => s + Math.max(0, c.totalDue), 0);
    const netCashCollected = Math.max(0, totalSales - currentOutstanding);

    // Top customers by spend
    const customerSpendMap: Record<string, { name: string; total: number; count: number }> = {};
    state.sales.forEach(s => {
      const key = s.customerId || s.customerName;
      if (!key) return;
      const name = s.customerName || state.customers.find(c => c.id === s.customerId)?.name || key;
      if (!customerSpendMap[key]) customerSpendMap[key] = { name, total: 0, count: 0 };
      customerSpendMap[key].total += s.total;
      customerSpendMap[key].count += 1;
    });
    const topCustomers = Object.values(customerSpendMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    return {
      totalSales, cashSales, udhaarSales,
      todayTotal, todayCash, todayUdhaar,
      todayCount: todaySales.length,
      totalTransactions: state.sales.length,
      avgOrder,
      uniqueCustomers: uniqueCustomers.size,
      topProducts,
      grossProfit,
      profitMargin,
      netCashCollected,
      topCustomers,
    };
  }, [state.sales, state.products, state.customers, state.transactions]);

  // ── Chart Data ──
  const chartData = useMemo(() => {
    const data: { name: string; cash: number; udhaar: number }[] = [];
    // Split-aware: cash hissa cash mein, baaki udhaar mein
    const cashPart = (s: { type: string; total: number; amountPaid?: number }) =>
      s.type === 'cash' ? s.total : (s.amountPaid || 0);
    const udhaarPart = (s: { type: string; total: number; amountPaid?: number }) =>
      s.type === 'cash' ? 0 : s.total - (s.amountPaid || 0);

    if (viewMode === 'day') {
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const daySales = state.sales.filter(s => s.date === dateStr);
        data.push({
          name: date.toLocaleDateString('en-IN', { weekday: 'short' }),
          cash: daySales.reduce((sum, s) => sum + cashPart(s), 0),
          udhaar: daySales.reduce((sum, s) => sum + udhaarPart(s), 0),
        });
      }
    } else if (viewMode === 'week') {
      for (let i = 3; i >= 0; i--) {
        const endDate = new Date();
        endDate.setDate(endDate.getDate() - i * 7);
        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 6);
        const weekSales = state.sales.filter(s => {
          const d = new Date(s.date);
          return d >= startDate && d <= endDate;
        });
        data.push({
          name: `Week ${4 - i}`,
          cash: weekSales.reduce((sum, s) => sum + cashPart(s), 0),
          udhaar: weekSales.reduce((sum, s) => sum + udhaarPart(s), 0),
        });
      }
    } else {
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthSales = state.sales.filter(s => {
          const d = new Date(s.date);
          return d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear();
        });
        data.push({
          name: date.toLocaleDateString('en-IN', { month: 'short' }),
          cash: monthSales.reduce((sum, s) => sum + cashPart(s), 0),
          udhaar: monthSales.reduce((sum, s) => sum + udhaarPart(s), 0),
        });
      }
    }
    return data;
  }, [state.sales, viewMode]);

  const paymentData = [
    { name: 'Cash', value: stats.cashSales, color: '#22c55e' },
    { name: 'Udhaar', value: stats.udhaarSales, color: '#ef4444' },
  ].filter(d => d.value > 0);

  // ── Recent Sales ──
  const sortedSales = useMemo(() =>
    [...state.sales].sort((a, b) => b.createdAt - a.createdAt),
    [state.sales]
  );
  const recentSales = sortedSales.slice(0, 10);

  // ── Helpers ──
  const fmt = (n: number) => n >= 1000 ? `₹${(n / 1000).toFixed(1)}k` : `₹${n.toFixed(0)}`;

  const handlePrintBill = () => {
    if (!selectedSale) return;
    const customer = selectedSale.customerId
      ? state.customers.find(c => c.id === selectedSale.customerId) || null
      : null;
    // Historical snapshot — bill us date ka sahi balance dikhaye (time-travel fix)
    const ledger = customer
      ? buildCustomerLedger(
          state.sales.filter(s => s.customerId === customer.id),
          state.transactions.filter(t => t.customerId === customer.id)
        )
      : null;
    printBill({
      sale: selectedSale,
      customer,
      business: state.businessProfile,
      theme: pdfTheme,
      snapshot: ledger ? computeBillSnapshot(selectedSale, ledger) : undefined,
    });
    setShowPDFDialog(false);
  };

  const handleWhatsApp = () => {
    if (!selectedSale) return;
    const customer = selectedSale.customerId
      ? state.customers.find(c => c.id === selectedSale.customerId) || null
      : null;
    const msg = generateWhatsAppBill(selectedSale, state.businessProfile, customer);
    const phone = (selectedSale.customerPhone || customer?.phone || '').replace(/\D/g, '');
    if (phone) {
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    } else {
      navigator.clipboard?.writeText(msg);
    }
  };

  // ── B8: AI Roz Hisaab Summary ──
  const handleHisaabSummary = async () => {
    // 🔐 LOGIN GATE — AI insights sirf logged-in users ke liye
    if (authMode === 'guest') {
      showToast('🤖 AI hisaab ke liye pehle login karo', 'info');
      navigate('/login');
      return;
    }
    setSummary('');
    setSummaryLoading(true);
    setShowSummary(true);
    try {
      const res = await askAI(
        'Aaj ka poora hisaab sunao: kul bikri, cash/udhaar/split split, sabse zyada bikne wala item, kul baki udhaar, low stock aur expiry warning — SHORT Hinglish summary mein, 5-6 lines max',
        state, [], [], 'reports'
      );
      setSummary(res.answer);
    } catch {
      setSummary('Hisaab nahi sun paya. Phir try karo.');
    } finally {
      setSummaryLoading(false);
    }
  };

  const toggleSummarySpeak = () => {
    if (isSpeaking()) {
      stopSpeaking();
      setSpeaking(false);
    } else if (summary) {
      speak(summary);
      setSpeaking(true);
    }
  };

  // ── Sale Item Row ──
  const SaleRow = ({ sale, showDetail = true }: { sale: Sale; showDetail?: boolean }) => (
    <div
      onClick={() => showDetail && setSelectedSale(sale)}
      className={`flex items-center justify-between p-3.5 bg-gray-50 rounded-2xl transition-colors ${showDetail ? 'cursor-pointer hover:bg-orange-50 active:bg-orange-100' : ''}`}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${sale.type === 'cash' ? 'bg-green-100' : sale.type === 'split' ? 'bg-amber-100' : 'bg-red-100'}`}>
          <Receipt className={`w-5 h-5 ${sale.type === 'cash' ? 'text-green-600' : sale.type === 'split' ? 'text-amber-600' : 'text-red-600'}`} />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 text-sm">
            {sale.billNumber || `#${sale.id.slice(-6).toUpperCase()}`}
            <span className="text-gray-400 font-normal ml-1">· {sale.items.length} item{sale.items.length > 1 ? 's' : ''}</span>
          </p>
          <p className="text-xs text-gray-500 truncate">
            {sale.date} · {sale.time}
            {sale.customerName && <span className="text-orange-600 font-medium"> · {sale.customerName}</span>}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="text-right">
          <p className="font-bold text-gray-900 text-sm">₹{sale.total.toFixed(2)}</p>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${sale.type === 'cash' ? 'bg-green-100 text-green-700' : sale.type === 'split' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
            {sale.type === 'cash' ? 'Cash' : sale.type === 'split' ? '🔀 Split' : 'Udhaar'}
          </span>
        </div>
        {showDetail && <ChevronRight className="w-4 h-4 text-gray-300" />}
      </div>
    </div>
  );

  return (
    <div className="p-4 lg:p-8 pb-24 lg:pb-8 max-w-5xl mx-auto">
      {/* ── Header ── */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Sales Reports</h2>
        <p className="text-gray-500">View your business analytics</p>
      </div>

      {/* ── Today's Summary Banner ── */}
      {stats.todayCount > 0 && (
        <div className="bg-gradient-to-r from-orange-500 to-red-600 rounded-3xl p-5 mb-6 text-white">
          <p className="text-orange-100 text-xs font-semibold uppercase tracking-wide mb-2">🌅 Aaj Ki Bikri</p>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-4xl font-black">₹{stats.todayTotal.toFixed(2)}</p>
              <p className="text-orange-200 text-sm mt-1">{stats.todayCount} transactions</p>
            </div>
            <div className="text-right text-sm">
              <p className="text-green-200 font-semibold">💵 Cash: ₹{stats.todayCash.toFixed(2)}</p>
              <p className="text-red-200 font-semibold mt-0.5">📋 Udhaar: ₹{stats.todayUdhaar.toFixed(2)}</p>
            </div>
          </div>
          <button
            onClick={handleHisaabSummary}
            disabled={summaryLoading}
            className="mt-3 w-full py-2.5 rounded-2xl bg-white/20 hover:bg-white/30 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
          >
            <Sparkles className="w-4 h-4" />
            {summaryLoading ? 'Hisaab ban raha hai...' : '🔊 AI Se Hisaab Sunao'}
          </button>
        </div>
      )}

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Card className="rounded-3xl border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">Today's Sales</span>
              <div className="w-8 h-8 bg-green-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-green-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{fmt(stats.todayTotal)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{stats.todayCount} transactions</p>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">Total Sales</span>
              <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center">
                <IndianRupee className="w-4 h-4 text-blue-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{fmt(stats.totalSales)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{stats.totalTransactions} bills</p>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">Cash Sales</span>
              <div className="w-8 h-8 bg-green-100 rounded-xl flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4 text-green-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-green-600">{fmt(stats.cashSales)}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {stats.totalSales > 0 ? ((stats.cashSales / stats.totalSales) * 100).toFixed(1) : 0}% of total
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">Udhaar Sales</span>
              <div className="w-8 h-8 bg-red-100 rounded-xl flex items-center justify-center">
                <ArrowDownRight className="w-4 h-4 text-red-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-red-600">{fmt(stats.udhaarSales)}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {stats.totalSales > 0 ? ((stats.udhaarSales / stats.totalSales) * 100).toFixed(1) : 0}% of total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Profit / Loss + Cash Collected Row ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <Card className="rounded-3xl border-0 shadow-lg bg-gradient-to-br from-emerald-500 to-green-600">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-emerald-100 text-xs">Gross Profit</p>
              <Target className="w-4 h-4 text-emerald-200" />
            </div>
            <p className={`text-2xl font-black ${stats.grossProfit >= 0 ? 'text-white' : 'text-red-200'}`}>
              {stats.grossProfit >= 0 ? '+' : ''}{fmt(stats.grossProfit)}
            </p>
            <p className="text-emerald-200 text-xs mt-0.5">{stats.profitMargin.toFixed(1)}% margin</p>
          </CardContent>
        </Card>
        <Card className="rounded-3xl border-0 shadow-lg bg-gradient-to-br from-blue-500 to-indigo-600">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-blue-100 text-xs">Net Cash Collected</p>
              <Wallet className="w-4 h-4 text-blue-200" />
            </div>
            <p className="text-2xl font-black text-white">{fmt(stats.netCashCollected)}</p>
            <p className="text-blue-200 text-xs mt-0.5">Cash sales + Udhaar wasooli</p>
          </CardContent>
        </Card>
        <Card className="rounded-3xl border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">Kul Udhaar Baki</span>
              <div className="w-7 h-7 bg-red-100 rounded-xl flex items-center justify-center">
                <ArrowDownRight className="w-4 h-4 text-red-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-red-600">
              {fmt(state.customers.reduce((s,c) => s + Math.max(0, c.totalDue), 0))}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {state.customers.filter(c => c.totalDue > 0).length} customers due
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Extra Metrics ── */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card className="rounded-2xl border-0 shadow-md">
          <CardContent className="p-3 text-center">
            <ShoppingBag className="w-5 h-5 text-purple-500 mx-auto mb-1" />
            <p className="text-lg font-black text-gray-800">{fmt(stats.avgOrder)}</p>
            <p className="text-[10px] text-gray-400">Avg Order</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-0 shadow-md">
          <CardContent className="p-3 text-center">
            <Users className="w-5 h-5 text-blue-500 mx-auto mb-1" />
            <p className="text-lg font-black text-gray-800">{stats.uniqueCustomers}</p>
            <p className="text-[10px] text-gray-400">Customers</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-0 shadow-md">
          <CardContent className="p-3 text-center">
            <Receipt className="w-5 h-5 text-orange-500 mx-auto mb-1" />
            <p className="text-lg font-black text-gray-800">{stats.totalTransactions}</p>
            <p className="text-[10px] text-gray-400">Total Bills</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        {/* Sales Trend */}
        <Card className="rounded-3xl border-0 shadow-lg lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-orange-500" />
                Sales Trend
              </CardTitle>
              <div className="flex gap-1.5">
                {(['day', 'week', 'month'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`px-3 py-1 rounded-xl text-xs font-semibold capitalize transition-all ${
                      viewMode === mode
                        ? 'bg-orange-500 text-white shadow-md'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {mode === 'day' ? 'Day' : mode === 'week' ? 'Week' : 'Month'}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="cash" name="Cash" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  <Bar dataKey="udhaar" name="Udhaar" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Payment Distribution */}
        <Card className="rounded-3xl border-0 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="w-5 h-5 text-blue-500" />
              Payment Types
            </CardTitle>
          </CardHeader>
          <CardContent>
            {paymentData.length > 0 ? (
              <>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={72}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {paymentData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => `₹${value.toFixed(2)}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-4 mt-2">
                  {paymentData.map((item) => (
                    <div key={item.name} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-xs text-gray-600 font-medium">{item.name}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-44 flex flex-col items-center justify-center text-gray-300">
                <Receipt className="w-12 h-12 mb-2" />
                <p className="text-sm">No data yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Top Products + Top Customers Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
      {stats.topProducts.length > 0 && (
        <Card className="rounded-3xl border-0 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="w-5 h-5 text-purple-500" />
              Top Products
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.topProducts.map((prod, i) => {
                const pct = stats.totalSales > 0 ? (prod.revenue / stats.totalSales) * 100 : 0;
                return (
                  <div key={prod.name} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-black text-purple-600">#{i + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-semibold text-gray-800 truncate">{prod.name}</p>
                        <p className="text-sm font-bold text-gray-900 ml-2">₹{prod.revenue.toFixed(0)}</p>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div
                          className="bg-gradient-to-r from-purple-500 to-indigo-500 h-1.5 rounded-full transition-all"
                          style={{ width: `${Math.max(4, pct)}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">{prod.qty} units · {pct.toFixed(1)}% of total</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Customers */}
      {stats.topCustomers.length > 0 && (
        <Card className="rounded-3xl border-0 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-500" />
              Top Customers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.topCustomers.map((c, i) => {
                const pct = stats.totalSales > 0 ? (c.total / stats.totalSales) * 100 : 0;
                return (
                  <div key={c.name} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-xl bg-yellow-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-black text-yellow-700">#{i + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-semibold text-gray-800 truncate">{c.name}</p>
                        <p className="text-sm font-bold text-gray-900 ml-2">₹{c.total.toFixed(0)}</p>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div
                          className="bg-gradient-to-r from-yellow-400 to-orange-500 h-1.5 rounded-full transition-all"
                          style={{ width: `${Math.max(4, pct)}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">{c.count} bills · {pct.toFixed(1)}% of total</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
      </div>

      {/* ── Recent Transactions ── */}
      <Card className="rounded-3xl border-0 shadow-lg">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-500" />
              Recent Transactions
            </CardTitle>
            {state.sales.length > 10 && (
              <button
                onClick={() => setShowAllTransactions(true)}
                className="text-xs text-orange-600 font-semibold flex items-center gap-1 hover:text-orange-700"
              >
                Sab Dekho ({state.sales.length})
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {recentSales.map((sale) => <SaleRow key={sale.id} sale={sale} />)}
            {recentSales.length === 0 && (
              <div className="text-center py-12">
                <Receipt className="w-14 h-14 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 font-medium">Koi transaction nahi</p>
                <p className="text-gray-300 text-sm mt-1">Pehla bill banao!</p>
              </div>
            )}
          </div>
          {state.sales.length > 10 && (
            <button
              onClick={() => setShowAllTransactions(true)}
              className="w-full mt-4 py-3 rounded-2xl border-2 border-dashed border-orange-200 text-orange-600 text-sm font-semibold hover:bg-orange-50 transition-colors flex items-center justify-center gap-2"
            >
              <ChevronRight className="w-4 h-4" />
              Aur {state.sales.length - 10} transactions dekho
            </button>
          )}
        </CardContent>
      </Card>

      {/* ── Wapasi History ── */}
      {(state.returns || []).length > 0 && (
        <Card className="rounded-3xl border-0 shadow-lg mt-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-orange-500" />
              Wapasi History ({state.returns.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[...state.returns].reverse().slice(0, 5).map(r => (
                <div key={r.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-2xl border border-orange-100">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {r.items.map(i => `${i.name} ${i.quantity}`).join(', ')}
                    </p>
                    <p className="text-xs text-gray-400">
                      {r.date}{r.billNumber ? ` • ${r.billNumber}` : ''}{r.customerName ? ` • ${r.customerName}` : ''} • {r.refundType === 'cash' ? '💵 Cash' : '📋 Adjust'}
                    </p>
                  </div>
                  <span className="text-sm font-black text-orange-700">₹{r.total.toFixed(0)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── All Transactions Dialog ── */}
      <Dialog open={showAllTransactions} onOpenChange={setShowAllTransactions}>
        <DialogContent className="sm:max-w-lg rounded-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-500" />
                Sare Bills ({state.sales.length})
              </span>
              <button onClick={() => setShowAllTransactions(false)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 space-y-2 mt-2 pr-1">
            {sortedSales.map((sale) => (
              <div key={sale.id} onClick={() => { setSelectedSale(sale); setShowAllTransactions(false); }}>
                <SaleRow sale={sale} />
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Sale Detail Dialog ── */}
      <Dialog open={!!selectedSale} onOpenChange={(v) => { if (!v) setSelectedSale(null); }}>
        <DialogContent className="sm:max-w-md rounded-3xl max-h-[90vh] overflow-y-auto">
          {selectedSale && (() => {
            const customer = selectedSale.customerId
              ? state.customers.find(c => c.id === selectedSale.customerId) || null
              : null;
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selectedSale.type === 'cash' ? 'bg-green-100' : selectedSale.type === 'split' ? 'bg-amber-100' : 'bg-red-100'}`}>
                      <Receipt className={`w-5 h-5 ${selectedSale.type === 'cash' ? 'text-green-600' : selectedSale.type === 'split' ? 'text-amber-600' : 'text-red-600'}`} />
                    </div>
                    <div>
                      <p className="font-bold">{selectedSale.billNumber || `#${selectedSale.id.slice(-6).toUpperCase()}`}</p>
                      <p className="text-xs font-normal text-gray-500">{selectedSale.date} · {selectedSale.time}</p>
                    </div>
                  </DialogTitle>
                </DialogHeader>

                {/* Shop Info */}
                <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl p-4 text-center border border-orange-100">
                  <p className="font-bold text-gray-900 text-base">{state.businessProfile.shopName}</p>
                  {state.businessProfile.address && <p className="text-xs text-gray-500 mt-0.5">📍 {state.businessProfile.address}</p>}
                  {state.businessProfile.phone && <p className="text-xs text-gray-500">📞 {state.businessProfile.phone}</p>}
                </div>

                {/* Customer */}
                {(selectedSale.customerName || customer) && (
                  <div className="flex items-center gap-3 bg-blue-50 rounded-2xl p-3">
                    <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
                      <Users className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{customer?.name || selectedSale.customerName}</p>
                      {(customer?.phone || selectedSale.customerPhone) && (
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <Phone className="w-3 h-3" />{customer?.phone || selectedSale.customerPhone}
                        </p>
                      )}
                    </div>
                      <span className={`ml-auto text-xs px-2 py-1 rounded-full font-semibold ${selectedSale.type === 'cash' ? 'bg-green-100 text-green-700' : selectedSale.type === 'split' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                      {selectedSale.type === 'cash' ? '💵 Cash' : selectedSale.type === 'split' ? '🔀 Split' : '📋 Udhaar'}
                    </span>
                  </div>
                )}

                {/* Items */}
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Items</p>
                  {selectedSale.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-800">{item.name}</p>
                        <p className="text-xs text-gray-400">{item.quantity} × ₹{item.price.toFixed(2)}</p>
                      </div>
                      <p className="font-bold text-gray-900 text-sm">₹{item.total.toFixed(2)}</p>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="bg-gray-50 rounded-2xl p-4 space-y-2">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Subtotal ({selectedSale.items.length} items)</span>
                    <span>₹{selectedSale.total.toFixed(2)}</span>
                  </div>
                  {(selectedSale.amountPaid || 0) > 0 && (
                    <div className="flex justify-between text-sm text-green-700 font-semibold">
                      <span>💵 Received</span>
                      <span>₹{selectedSale.amountPaid!.toFixed(2)}</span>
                    </div>
                  )}
                  {(selectedSale.changeReturned || 0) > 0 && (
                    <div className="flex justify-between text-sm text-orange-600 font-semibold">
                      <span>↩ Change</span>
                      <span>₹{selectedSale.changeReturned!.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                    <span className="font-bold text-gray-900">TOTAL</span>
                    <span className="text-2xl font-black text-orange-600">₹{selectedSale.total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Balance */}
                {customer && customer.totalDue !== 0 && (
                  <div className={`rounded-xl p-3 text-sm font-semibold ${customer.totalDue > 0 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                    {customer.totalDue > 0
                      ? `⚠️ Baki: ₹${customer.totalDue.toFixed(2)}`
                      : `✅ Advance: ₹${Math.abs(customer.totalDue).toFixed(2)}`}
                  </div>
                )}

                {/* Loyalty */}
                {(selectedSale.loyaltyPointsEarned || 0) > 0 && (
                  <div className="bg-yellow-50 rounded-xl p-3 text-sm text-yellow-800 font-semibold">
                    ⭐ {selectedSale.loyaltyPointsEarned} loyalty points earned this bill!
                  </div>
                )}

                {/* Action Buttons */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <Button
                    variant="outline"
                    onClick={() => setShowPDFDialog(true)}
                    className="rounded-xl h-11 text-xs border-orange-200 text-orange-700 flex flex-col gap-0.5 h-auto py-2"
                  >
                    <Printer className="w-4 h-4 mx-auto" />
                    Print Bill
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleWhatsApp}
                    className="rounded-xl text-xs border-green-200 text-green-700 flex flex-col gap-0.5 h-auto py-2"
                  >
                    <MessageCircle className="w-4 h-4 mx-auto" />
                    WhatsApp
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowPDFDialog(true)}
                    className="rounded-xl text-xs border-purple-200 text-purple-700 flex flex-col gap-0.5 h-auto py-2"
                  >
                    <Download className="w-4 h-4 mx-auto" />
                    Save PDF
                  </Button>
                </div>

                <Button
                  variant="outline"
                  onClick={() => setShowReturnDialog(true)}
                  className="w-full rounded-xl h-11 border-orange-300 text-orange-700 hover:bg-orange-50 font-semibold"
                >
                  <RotateCcw className="w-4 h-4 mr-2" /> Wapasi / Return Karo
                </Button>

                <Button
                  variant="outline"
                  onClick={() => setSelectedSale(null)}
                  className="w-full rounded-xl h-11"
                >
                  <X className="w-4 h-4 mr-2" /> Close
                </Button>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ── Return Dialog ── */}
      <ReturnDialog
        isOpen={showReturnDialog}
        onClose={() => { setShowReturnDialog(false); setSelectedSale(null); }}
        sale={selectedSale}
      />

      {/* ── B8: AI Hisaab Summary Dialog ── */}
      <Dialog open={showSummary} onOpenChange={(v) => { if (!v) { stopSpeaking(); setSpeaking(false); setShowSummary(false); } }}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" /> Aaj Ka Hisaab
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4 min-h-[120px]">
              {summaryLoading ? (
                <div className="flex items-center justify-center py-8 gap-2 text-purple-600">
                  <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" />
                  <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                  <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                </div>
              ) : (
                <p className="text-sm text-gray-800 whitespace-pre-line leading-relaxed">{summary}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                onClick={toggleSummarySpeak} disabled={!summary || summaryLoading}
                className="flex-1 rounded-2xl h-12 bg-gradient-to-r from-purple-600 to-indigo-600"
              >
                {speaking ? <VolumeX className="w-5 h-5 mr-2" /> : <Volume2 className="w-5 h-5 mr-2" />}
                {speaking ? 'Roko' : 'Sunao 🔊'}
              </Button>
              <Button
                variant="outline" onClick={handleHisaabSummary} disabled={summaryLoading}
                className="rounded-2xl h-12 px-4"
              >
                🔄
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── PDF Theme Dialog ── */}
      <Dialog open={showPDFDialog} onOpenChange={setShowPDFDialog}>
        <DialogContent className="sm:max-w-sm rounded-3xl">
          <DialogHeader><DialogTitle>🖨️ Bill Print / PDF</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-gray-500">Theme choose karo:</p>
            <div className="grid grid-cols-2 gap-3">
              {(Object.entries(themes) as [BillTheme, typeof themes[BillTheme]][]).map(([key, t]) => (
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
              onClick={handlePrintBill}
              className="w-full rounded-xl h-11 bg-gradient-to-r from-orange-500 to-red-600"
            >
              <FileText className="w-4 h-4 mr-2" /> Print / Save as PDF
            </Button>
            <p className="text-xs text-gray-400 text-center">
              Browser print dialog mein "Save as PDF" select karo
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
