// Khata Book Section - Digital Ledger
import { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  User, 
  Phone, 
  MapPin, 
  IndianRupee,
  Check,
  MessageCircle,
  History,
  TrendingDown,
  TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useApp } from '@/context/AppContext';
import type { Customer } from '@/types';

export function KhataSection() {
  const { 
    state, 
    addCustomer, 
    addTransaction, 
    getCustomerTransactions
  } = useApp();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');

  // Form state for new customer
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
  });

  const filteredCustomers = useMemo(() => {
    let customers = state.customers;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      customers = customers.filter(c => 
        c.name.toLowerCase().includes(query) || 
        c.phone.includes(query)
      );
    }
    return customers.sort((a, b) => b.totalDue - a.totalDue);
  }, [state.customers, searchQuery]);

  const handleAddCustomer = () => {
    if (formData.name) {
      addCustomer(formData);
      setFormData({ name: '', phone: '', address: '' });
      setShowAddDialog(false);
    }
  };

  const handlePayment = () => {
    if (selectedCustomer && paymentAmount) {
      const amount = parseFloat(paymentAmount);
      if (amount > 0) {
        addTransaction({
          customerId: selectedCustomer.id,
          type: 'payment',
          amount,
          description: `Payment received from ${selectedCustomer.name}`,
        });
        setPaymentAmount('');
        setShowPaymentDialog(false);
      }
    }
  };

  const shareOnWhatsApp = (customer: Customer) => {
    const message = `*${state.businessProfile.shopName}*\n\nHello ${customer.name},\n\nYour outstanding balance is: *₹${customer.totalDue.toFixed(2)}*\n\nPlease clear your dues at your earliest convenience.\n\nThank you!`;
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${customer.phone}?text=${encodedMessage}`, '_blank');
  };

  return (
    <div className="p-4 lg:p-8 pb-24 lg:pb-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Khata Book</h2>
          <p className="text-gray-500">Manage customer accounts and dues</p>
        </div>
        <Button
          onClick={() => setShowAddDialog(true)}
          className="rounded-2xl h-12 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Customer
        </Button>
      </div>

      {/* Total Due Summary */}
      <Card className="rounded-3xl border-0 shadow-lg mb-6 bg-gradient-to-r from-orange-500 to-red-600">
        <CardContent className="p-6">
          <div className="flex items-center justify-between text-white">
            <div>
              <p className="text-orange-100 mb-1">Total Outstanding</p>
              <p className="text-4xl font-bold">
                ₹{state.customers.reduce((sum, c) => sum + c.totalDue, 0).toFixed(2)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-orange-100 mb-1">Total Customers</p>
              <p className="text-3xl font-bold">{state.customers.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search customers by name or phone..."
          className="pl-12 rounded-2xl h-12"
        />
      </div>

      {/* Customers List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredCustomers.map((customer) => (
          <Card
            key={customer.id}
            className="rounded-3xl border-0 shadow-lg overflow-hidden hover:shadow-xl transition-shadow cursor-pointer"
            onClick={() => setSelectedCustomer(customer)}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-100 to-red-100 rounded-2xl flex items-center justify-center">
                    <User className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{customer.name}</h3>
                    {customer.phone && (
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {customer.phone}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-xl font-bold ${customer.totalDue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    ₹{customer.totalDue.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-400">Total Due</p>
                </div>
              </div>

              {customer.address && (
                <p className="mt-3 text-sm text-gray-500 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {customer.address}
                </p>
              )}

              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedCustomer(customer);
                    setShowPaymentDialog(true);
                  }}
                  className="flex-1 rounded-xl h-10"
                >
                  <IndianRupee className="w-4 h-4 mr-1" />
                  Receive Payment
                </Button>
                {customer.phone && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      shareOnWhatsApp(customer);
                    }}
                    className="rounded-xl h-10 px-3 border-green-200 text-green-600 hover:bg-green-50"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredCustomers.length === 0 && (
        <div className="text-center py-12">
          <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No customers found</h3>
          <p className="text-gray-500">Add your first customer to get started</p>
        </div>
      )}

      {/* Add Customer Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Name *</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Customer name"
                  className="pl-10 rounded-2xl h-12"
                />
              </div>
            </div>
            <div>
              <Label>Phone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="Phone number"
                  className="pl-10 rounded-2xl h-12"
                />
              </div>
            </div>
            <div>
              <Label>Address</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Customer address"
                  className="pl-10 rounded-2xl h-12"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowAddDialog(false)}
                className="flex-1 rounded-2xl h-12"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddCustomer}
                disabled={!formData.name}
                className="flex-1 rounded-2xl h-12 bg-gradient-to-r from-orange-500 to-red-600"
              >
                <Check className="w-5 h-5 mr-2" />
                Add Customer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Customer Details Dialog */}
      <Dialog open={!!selectedCustomer && !showPaymentDialog} onOpenChange={() => setSelectedCustomer(null)}>
        <DialogContent className="sm:max-w-lg rounded-3xl max-h-[90vh] overflow-y-auto">
          {selectedCustomer && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-orange-100 to-red-100 rounded-xl flex items-center justify-center">
                    <User className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p>{selectedCustomer.name}</p>
                    <p className="text-sm font-normal text-gray-500">
                      Balance: ₹{selectedCustomer.totalDue.toFixed(2)}
                    </p>
                  </div>
                </DialogTitle>
              </DialogHeader>

              <div className="mt-4">
                <div className="flex gap-3 mb-6">
                  <Button
                    onClick={() => setShowPaymentDialog(true)}
                    className="flex-1 rounded-2xl h-12 bg-gradient-to-r from-green-500 to-green-600"
                  >
                    <TrendingDown className="w-5 h-5 mr-2" />
                    Receive Payment
                  </Button>
                  {selectedCustomer.phone && (
                    <Button
                      variant="outline"
                      onClick={() => shareOnWhatsApp(selectedCustomer)}
                      className="rounded-2xl h-12 px-4 border-green-200 text-green-600 hover:bg-green-50"
                    >
                      <MessageCircle className="w-5 h-5" />
                    </Button>
                  )}
                </div>

                <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <History className="w-5 h-5" />
                  Transaction History
                </h4>

                <div className="space-y-3">
                  {getCustomerTransactions(selectedCustomer.id).map((transaction) => (
                    <div
                      key={transaction.id}
                      className={`p-4 rounded-2xl ${
                        transaction.type === 'sale' ? 'bg-red-50' : 'bg-green-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {transaction.type === 'sale' ? (
                            <TrendingUp className="w-4 h-4 text-red-600" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-green-600" />
                          )}
                          <span className={`font-medium ${
                            transaction.type === 'sale' ? 'text-red-700' : 'text-green-700'
                          }`}>
                            {transaction.type === 'sale' ? 'Sale' : 'Payment'}
                          </span>
                        </div>
                        <span className={`font-bold ${
                          transaction.type === 'sale' ? 'text-red-700' : 'text-green-700'
                        }`}>
                          {transaction.type === 'sale' ? '+' : '-'}₹{transaction.amount.toFixed(2)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {transaction.date} at {transaction.time}
                      </p>
                      {transaction.description && (
                        <p className="text-sm text-gray-600 mt-1">{transaction.description}</p>
                      )}
                    </div>
                  ))}

                  {getCustomerTransactions(selectedCustomer.id).length === 0 && (
                    <p className="text-center text-gray-500 py-4">No transactions yet</p>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>Receive Payment</DialogTitle>
          </DialogHeader>
          {selectedCustomer && (
            <div className="space-y-4 mt-4">
              <div className="bg-gray-50 rounded-2xl p-4 text-center">
                <p className="text-sm text-gray-500">Current Balance</p>
                <p className="text-3xl font-bold text-gray-900">₹{selectedCustomer.totalDue.toFixed(2)}</p>
              </div>
              <div>
                <Label>Payment Amount (₹)</Label>
                <Input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="rounded-2xl h-12 text-2xl text-center"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                {[100, 500, 1000].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setPaymentAmount(amount.toString())}
                    className="flex-1 py-2 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors"
                  >
                    ₹{amount}
                  </button>
                ))}
              </div>
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowPaymentDialog(false)}
                  className="flex-1 rounded-2xl h-12"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handlePayment}
                  disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}
                  className="flex-1 rounded-2xl h-12 bg-gradient-to-r from-green-500 to-green-600"
                >
                  <Check className="w-5 h-5 mr-2" />
                  Confirm Payment
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
