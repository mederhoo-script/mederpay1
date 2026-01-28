'use client';

import { useEffect, useState } from 'react';
import { paymentSchema, type PaymentInput } from '@/lib/validations';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  DollarSign,
  Plus,
  Calendar,
  AlertTriangle,
  Search,
  Loader2,
  X,
  AlertCircle,
} from 'lucide-react';

interface Payment {
  id: string;
  amount: number;
  payment_method: 'CASH' | 'TRANSFER' | 'MONNIFY';
  payment_date: string;
  monnify_reference: string | null;
  sale: {
    id: string;
    phone: {
      imei: string;
    };
    customer: {
      full_name: string;
    };
  };
}

interface Sale {
  id: string;
  status: string;
  phone: {
    imei: string;
  };
  customer: {
    full_name: string;
  };
}

interface OverduePayment {
  customer_name: string;
  phone_imei: string;
  due_date: string;
  amount_due: number;
  days_overdue: number;
}

type PaymentFormData = {
  sale_id: string;
  amount: string;
  payment_method: 'CASH' | 'TRANSFER' | 'MONNIFY';
  monnify_reference: string;
};

const initialFormData: PaymentFormData = {
  sale_id: '',
  amount: '',
  payment_method: 'CASH',
  monnify_reference: '',
};

export default function PaymentsPage() {
  const [activeTab, setActiveTab] = useState<'history' | 'overdue'>('history');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [overduePayments, setOverduePayments] = useState<OverduePayment[]>([]);
  const [activeSales, setActiveSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<PaymentFormData>(initialFormData);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      if (activeTab === 'history') {
        await Promise.all([fetchPayments(), fetchActiveSales()]);
      } else {
        await fetchOverduePayments();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const fetchPayments = async () => {
    const response = await fetch('/api/payments');
    if (!response.ok) {
      throw new Error('Failed to fetch payments');
    }
    const data = await response.json();
    setPayments(data);
  };

  const fetchActiveSales = async () => {
    const response = await fetch('/api/sales?status=active');
    if (!response.ok) {
      throw new Error('Failed to fetch active sales');
    }
    const data = await response.json();
    setActiveSales(data);
  };

  const fetchOverduePayments = async () => {
    const response = await fetch('/api/payments/overdue');
    if (!response.ok) {
      throw new Error('Failed to fetch overdue payments');
    }
    const data = await response.json();
    setOverduePayments(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    setSubmitting(true);

    try {
      const payload: PaymentInput = {
        sale_id: formData.sale_id,
        amount: parseFloat(formData.amount),
        payment_method: formData.payment_method,
        monnify_reference: formData.monnify_reference || undefined,
      };

      const validation = paymentSchema.safeParse(payload);
      if (!validation.success) {
        const errors: Record<string, string> = {};
        validation.error.errors.forEach((err) => {
          if (err.path[0]) {
            errors[err.path[0].toString()] = err.message;
          }
        });
        setFormErrors(errors);
        return;
      }

      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to record payment');
      }

      showToast('Payment recorded successfully', 'success');
      setFormData(initialFormData);
      setShowForm(false);
      fetchPayments();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to record payment', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const filteredPayments = payments.filter((payment) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      payment.sale.phone.imei.toLowerCase().includes(searchLower) ||
      payment.sale.customer.full_name.toLowerCase().includes(searchLower) ||
      payment.payment_method.toLowerCase().includes(searchLower)
    );
  });

  const filteredOverdue = overduePayments.filter((payment) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      payment.customer_name.toLowerCase().includes(searchLower) ||
      payment.phone_imei.toLowerCase().includes(searchLower)
    );
  });

  const getPaymentMethodBadge = (method: string) => {
    const colors = {
      CASH: 'bg-green-100 text-green-800',
      TRANSFER: 'bg-blue-100 text-blue-800',
      MONNIFY: 'bg-purple-100 text-purple-800',
    };
    return colors[method as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <DollarSign className="h-8 w-8 text-blue-600" />
            Payments
          </h1>
          <p className="text-gray-600 mt-1">Track payment history and overdue payments</p>
        </div>
        {activeTab === 'history' && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            {showForm ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
            {showForm ? 'Cancel' : 'Record Payment'}
          </button>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ${
            toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          } text-white`}
        >
          {toast.message}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('history')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'history'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Payment History
          </button>
          <button
            onClick={() => setActiveTab('overdue')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'overdue'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Overdue Payments
          </button>
        </nav>
      </div>

      {/* Record Payment Form */}
      {showForm && activeTab === 'history' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Record Payment</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Sale Dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sale <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.sale_id}
                  onChange={(e) => setFormData({ ...formData, sale_id: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    formErrors.sale_id ? 'border-red-500' : 'border-gray-300'
                  }`}
                  required
                >
                  <option value="">Select a sale</option>
                  {activeSales.map((sale) => (
                    <option key={sale.id} value={sale.id}>
                      {sale.phone.imei} - {sale.customer.full_name}
                    </option>
                  ))}
                </select>
                {formErrors.sale_id && (
                  <p className="text-red-500 text-sm mt-1">{formErrors.sale_id}</p>
                )}
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount (NGN) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    formErrors.amount ? 'border-red-500' : 'border-gray-300'
                  }`}
                  required
                />
                {formErrors.amount && (
                  <p className="text-red-500 text-sm mt-1">{formErrors.amount}</p>
                )}
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Method <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.payment_method}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      payment_method: e.target.value as 'CASH' | 'TRANSFER' | 'MONNIFY',
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="CASH">Cash</option>
                  <option value="TRANSFER">Transfer</option>
                  <option value="MONNIFY">Monnify</option>
                </select>
              </div>

              {/* Monnify Reference */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monnify Reference
                </label>
                <input
                  type="text"
                  value={formData.monnify_reference}
                  onChange={(e) =>
                    setFormData({ ...formData, monnify_reference: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setFormData(initialFormData);
                  setFormErrors({});
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Recording...
                  </>
                ) : (
                  <>
                    <Plus className="h-5 w-5" />
                    Record Payment
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder={
              activeTab === 'history'
                ? 'Search by customer, IMEI, or payment method...'
                : 'Search by customer or IMEI...'
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900">Error</h3>
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      ) : (
        <>
          {activeTab === 'history' ? (
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Sale (Phone IMEI)
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Method
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Reference
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredPayments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                          {searchTerm
                            ? 'No payments found matching your search.'
                            : 'No payments recorded yet.'}
                        </td>
                      </tr>
                    ) : (
                      filteredPayments.map((payment) => (
                        <tr key={payment.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-gray-400" />
                              {formatDate(payment.payment_date)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {payment.sale.phone.imei}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {payment.sale.customer.full_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {formatCurrency(payment.amount)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-2 py-1 text-xs font-semibold rounded-full ${getPaymentMethodBadge(
                                payment.payment_method
                              )}`}
                            >
                              {payment.payment_method}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {payment.monnify_reference || '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Phone IMEI
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Due Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount Due
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Days Overdue
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredOverdue.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                          {searchTerm
                            ? 'No overdue payments found matching your search.'
                            : 'No overdue payments. Great job!'}
                        </td>
                      </tr>
                    ) : (
                      filteredOverdue.map((payment, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {payment.customer_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {payment.phone_imei}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-gray-400" />
                              {formatDate(payment.due_date)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {formatCurrency(payment.amount_due)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 w-fit">
                              <AlertTriangle className="h-3 w-3" />
                              {payment.days_overdue} days
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
