// Reports Section - Sales Analytics
import { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  Calendar, 
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  Share2,
  FileText
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
import type { Sale } from '@/types';

export function ReportsSection() {
  const { state } = useApp();
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('day');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  // Calculate statistics
  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todaySales = state.sales.filter(s => s.date === today);
    
    const totalSales = state.sales.reduce((sum, s) => sum + s.total, 0);
    const cashSales = state.sales.filter(s => s.type === 'cash').reduce((sum, s) => sum + s.total, 0);
    const udhaarSales = state.sales.filter(s => s.type === 'udhaar').reduce((sum, s) => sum + s.total, 0);
    
    const todayTotal = todaySales.reduce((sum, s) => sum + s.total, 0);
    const todayCount = todaySales.length;

    return {
      totalSales,
      cashSales,
      udhaarSales,
      todayTotal,
      todayCount,
      totalTransactions: state.sales.length,
    };
  }, [state.sales]);

  // Chart data
  const chartData = useMemo(() => {
    const data: { name: string; sales: number; udhaar: number }[] = [];
    
    if (viewMode === 'day') {
      // Last 7 days
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const daySales = state.sales.filter(s => s.date === dateStr);
        data.push({
          name: date.toLocaleDateString('en-IN', { weekday: 'short' }),
          sales: daySales.filter(s => s.type === 'cash').reduce((sum, s) => sum + s.total, 0),
          udhaar: daySales.filter(s => s.type === 'udhaar').reduce((sum, s) => sum + s.total, 0),
        });
      }
    } else if (viewMode === 'week') {
      // Last 4 weeks
      for (let i = 3; i >= 0; i--) {
        const endDate = new Date();
        endDate.setDate(endDate.getDate() - i * 7);
        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 6);
        
        const weekSales = state.sales.filter(s => {
          const saleDate = new Date(s.date);
          return saleDate >= startDate && saleDate <= endDate;
        });
        
        data.push({
          name: `Week ${4 - i}`,
          sales: weekSales.filter(s => s.type === 'cash').reduce((sum, s) => sum + s.total, 0),
          udhaar: weekSales.filter(s => s.type === 'udhaar').reduce((sum, s) => sum + s.total, 0),
        });
      }
    } else {
      // Last 6 months
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthStr = date.toLocaleDateString('en-IN', { month: 'short' });
        const monthSales = state.sales.filter(s => {
          const saleDate = new Date(s.date);
          return saleDate.getMonth() === date.getMonth() && 
                 saleDate.getFullYear() === date.getFullYear();
        });
        data.push({
          name: monthStr,
          sales: monthSales.filter(s => s.type === 'cash').reduce((sum, s) => sum + s.total, 0),
          udhaar: monthSales.filter(s => s.type === 'udhaar').reduce((sum, s) => sum + s.total, 0),
        });
      }
    }
    
    return data;
  }, [state.sales, viewMode]);

  // Payment type distribution
  const paymentData = [
    { name: 'Cash', value: stats.cashSales, color: '#22c55e' },
    { name: 'Udhaar', value: stats.udhaarSales, color: '#ef4444' },
  ];

  // Recent transactions
  const recentSales = useMemo(() => {
    return [...state.sales]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 20);
  }, [state.sales]);

  const downloadReceipt = (sale: Sale) => {
    const receipt = generateReceiptText(sale, state.businessProfile);
    const blob = new Blob([receipt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${sale.id.slice(0, 8)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const shareOnWhatsApp = (sale: Sale) => {
    const receipt = generateReceiptText(sale, state.businessProfile);
    const encodedReceipt = encodeURIComponent(receipt);
    window.open(`https://wa.me/?text=${encodedReceipt}`, '_blank');
  };

  return (
    <div className="p-4 lg:p-8 pb-24 lg:pb-8">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Sales Reports</h2>
        <p className="text-gray-500">View your business analytics</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="rounded-3xl border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">Today's Sales</span>
              <div className="w-8 h-8 bg-green-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-green-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">₹{stats.todayTotal.toFixed(2)}</p>
            <p className="text-xs text-gray-400">{stats.todayCount} transactions</p>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">Total Sales</span>
              <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center">
                <Receipt className="w-4 h-4 text-blue-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">₹{stats.totalSales.toFixed(2)}</p>
            <p className="text-xs text-gray-400">{stats.totalTransactions} transactions</p>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">Cash Sales</span>
              <div className="w-8 h-8 bg-green-100 rounded-xl flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4 text-green-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-green-600">₹{stats.cashSales.toFixed(2)}</p>
            <p className="text-xs text-gray-400">
              {stats.totalSales > 0 ? ((stats.cashSales / stats.totalSales) * 100).toFixed(1) : 0}% of total
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">Udhaar Sales</span>
              <div className="w-8 h-8 bg-red-100 rounded-xl flex items-center justify-center">
                <ArrowDownRight className="w-4 h-4 text-red-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-red-600">₹{stats.udhaarSales.toFixed(2)}</p>
            <p className="text-xs text-gray-400">
              {stats.totalSales > 0 ? ((stats.udhaarSales / stats.totalSales) * 100).toFixed(1) : 0}% of total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Sales Chart */}
        <Card className="rounded-3xl border-0 shadow-lg lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-orange-500" />
                Sales Trend
              </CardTitle>
              <div className="flex gap-2">
                {(['day', 'week', 'month'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`px-3 py-1 rounded-xl text-sm font-medium capitalize transition-colors ${
                      viewMode === mode
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    formatter={(value: number) => `₹${value.toFixed(2)}`}
                    contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="sales" name="Cash" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="udhaar" name="Udhaar" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Payment Distribution */}
        <Card className="rounded-3xl border-0 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Receipt className="w-5 h-5 text-blue-500" />
              Payment Types
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
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
            <div className="flex justify-center gap-4 mt-4">
              {paymentData.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm text-gray-600">{item.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card className="rounded-3xl border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-500" />
            Recent Transactions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {recentSales.map((sale) => (
              <div
                key={sale.id}
                onClick={() => setSelectedSale(sale)}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl cursor-pointer hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    sale.type === 'cash' ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    <Receipt className={`w-5 h-5 ${
                      sale.type === 'cash' ? 'text-green-600' : 'text-red-600'
                    }`} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {sale.items.length} items • ₹{sale.total.toFixed(2)}
                    </p>
                    <p className="text-sm text-gray-500">
                      {sale.date} at {sale.time}
                      {sale.customerName && ` • ${sale.customerName}`}
                    </p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  sale.type === 'cash'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {sale.type === 'cash' ? 'Cash' : 'Udhaar'}
                </span>
              </div>
            ))}

            {recentSales.length === 0 && (
              <p className="text-center text-gray-500 py-8">No transactions yet</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sale Details Dialog */}
      <Dialog open={!!selectedSale} onOpenChange={() => setSelectedSale(null)}>
        <DialogContent className="sm:max-w-md rounded-3xl max-h-[90vh] overflow-y-auto">
          {selectedSale && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>Receipt</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    selectedSale.type === 'cash'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {selectedSale.type === 'cash' ? 'Cash' : 'Udhaar'}
                  </span>
                </DialogTitle>
              </DialogHeader>

              <div className="mt-4">
                {/* Shop Details */}
                <div className="text-center mb-6 pb-4 border-b border-gray-100">
                  <h3 className="font-bold text-lg">{state.businessProfile.shopName}</h3>
                  <p className="text-sm text-gray-500">{state.businessProfile.address}</p>
                  <p className="text-sm text-gray-500">{state.businessProfile.phone}</p>
                </div>

                {/* Receipt Info */}
                <div className="flex justify-between text-sm text-gray-500 mb-4">
                  <span>Date: {selectedSale.date}</span>
                  <span>Time: {selectedSale.time}</span>
                </div>

                {selectedSale.customerName && (
                  <p className="text-sm mb-4">
                    <span className="text-gray-500">Customer:</span>{' '}
                    <span className="font-medium">{selectedSale.customerName}</span>
                  </p>
                )}

                {/* Items */}
                <div className="space-y-2 mb-4">
                  {selectedSale.items.map((item, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span>{item.name} x {item.quantity}</span>
                      <span className="font-medium">₹{item.total.toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                {/* Total */}
                <div className="border-t border-gray-100 pt-4 mb-6">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold">Total</span>
                    <span className="text-2xl font-bold text-orange-600">
                      ₹{selectedSale.total.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => downloadReceipt(selectedSale)}
                    className="flex-1 rounded-2xl h-12"
                  >
                    <FileText className="w-5 h-5 mr-2" />
                    Download
                  </Button>
                  <Button
                    onClick={() => shareOnWhatsApp(selectedSale)}
                    className="flex-1 rounded-2xl h-12 bg-green-600 hover:bg-green-700"
                  >
                    <Share2 className="w-5 h-5 mr-2" />
                    Share
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper function to generate receipt text
function generateReceiptText(sale: Sale, businessProfile: { shopName: string; address: string; phone: string }): string {
  let text = `*${businessProfile.shopName}*\n`;
  text += `${businessProfile.address}\n`;
  text += `Phone: ${businessProfile.phone}\n`;
  text += `-------------------\n`;
  text += `Date: ${sale.date}\n`;
  text += `Time: ${sale.time}\n`;
  if (sale.customerName) {
    text += `Customer: ${sale.customerName}\n`;
  }
  text += `Type: ${sale.type === 'cash' ? 'Cash' : 'Udhaar'}\n`;
  text += `-------------------\n`;
  text += `*Items:*\n`;
  sale.items.forEach((item) => {
    text += `${item.name} x ${item.quantity} = ₹${item.total.toFixed(2)}\n`;
  });
  text += `-------------------\n`;
  text += `*Total: ₹${sale.total.toFixed(2)}*\n`;
  text += `-------------------\n`;
  text += `Thank you for shopping!`;
  return text;
}
