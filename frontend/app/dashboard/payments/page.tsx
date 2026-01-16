'use client';

import { useEffect, useState } from 'react';
import apiClient from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

interface Sale {
  id: number;
  phone: {
    imei: string;
    brand: string;
    model: string;
  };
  customer: {
    full_name: string;
  };
  balance: number;
}

interface Payment {
  id: number;
  sale: Sale;
  amount: number;
  payment_method: string;
  balance_before: number;
  balance_after: number;
  status: string;
  payment_date: string;
  monnify_reference?: string;
}

interface OverduePayment {
  id: number;
  sale_id: number;
  phone_imei: string;
  customer_name: string;
  installment_number: number;
  amount_due: number;
  due_date: string;
  days_overdue: number;
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [overduePayments, setOverduePayments] = useState<OverduePayment[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'history' | 'overdue'>('history');
  const [formData, setFormData] = useState({
    sale_id: '',
    amount: '',
    payment_method: 'cash',
    monnify_reference: '',
  });

  useEffect(() => {
    fetchPayments();
    fetchOverduePayments();
    fetchActiveSales();
  }, []);

  const fetchPayments = async () => {
    try {
      const { data } = await apiClient.get('/payments/');
      setPayments(data.results || data);
    } catch (error) {
      console.error('Failed to fetch payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOverduePayments = async () => {
    try {
      const { data } = await apiClient.get('/payments/overdue/');
      setOverduePayments(data.results || data);
    } catch (error) {
      console.error('Failed to fetch overdue payments:', error);
    }
  };

  const fetchActiveSales = async () => {
    try {
      const { data } = await apiClient.get('/sales/?status=active');
      setSales(data.results || data);
    } catch (error) {
      console.error('Failed to fetch sales:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/payments/', {
        sale_id: parseInt(formData.sale_id),
        amount: parseFloat(formData.amount),
        payment_method: formData.payment_method,
        monnify_reference: formData.monnify_reference || null,
      });
      setShowForm(false);
      setFormData({
        sale_id: '',
        amount: '',
        payment_method: 'cash',
        monnify_reference: '',
      });
      fetchPayments();
      fetchActiveSales();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to record payment');
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: { [key: string]: string } = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-green-100 text-green-800',
      disputed: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`rounded-full px-2 py-1 text-xs font-medium ${colors[status] || 'bg-gray-100'}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  const getMethodBadge = (method: string) => {
    const colors: { [key: string]: string } = {
      cash: 'bg-blue-100 text-blue-800',
      transfer: 'bg-purple-100 text-purple-800',
      monnify: 'bg-green-100 text-green-800',
    };
    return (
      <span className={`rounded-full px-2 py-1 text-xs font-medium ${colors[method] || 'bg-gray-100'}`}>
        {method.toUpperCase()}
      </span>
    );
  };

  if (loading) {
    return <div>Loading payments...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Payment Management</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded bg-purple-600 px-4 py-2 text-white hover:bg-purple-700"
        >
          {showForm ? 'Cancel' : 'Record Payment'}
        </button>
      </div>

      {/* Record Payment Form */}
      {showForm && (
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold">Record New Payment</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium">Sale</label>
                <select
                  required
                  value={formData.sale_id}
                  onChange={(e) => setFormData({ ...formData, sale_id: e.target.value })}
                  className="mt-1 w-full rounded border px-3 py-2"
                >
                  <option value="">Select a sale</option>
                  {sales.map((sale) => (
                    <option key={sale.id} value={sale.id}>
                      {sale.customer.full_name} - {sale.phone.brand} {sale.phone.model} (Balance: {formatCurrency(sale.balance)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium">Payment Method</label>
                <select
                  value={formData.payment_method}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                  className="mt-1 w-full rounded border px-3 py-2"
                >
                  <option value="cash">Cash</option>
                  <option value="transfer">Bank Transfer</option>
                  <option value="monnify">Monnify</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </div>
              {formData.payment_method === 'monnify' && (
                <div>
                  <label className="block text-sm font-medium">Monnify Reference</label>
                  <input
                    type="text"
                    value={formData.monnify_reference}
                    onChange={(e) => setFormData({ ...formData, monnify_reference: e.target.value })}
                    className="mt-1 w-full rounded border px-3 py-2"
                  />
                </div>
              )}
            </div>
            <button
              type="submit"
              className="rounded bg-purple-600 px-4 py-2 text-white hover:bg-purple-700"
            >
              Record Payment
            </button>
          </form>
        </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-4 border-b">
        <button
          onClick={() => setActiveTab('history')}
          className={`pb-2 ${activeTab === 'history' ? 'border-b-2 border-purple-600 font-semibold' : 'text-gray-500'}`}
        >
          Payment History
        </button>
        <button
          onClick={() => setActiveTab('overdue')}
          className={`pb-2 ${activeTab === 'overdue' ? 'border-b-2 border-red-600 font-semibold' : 'text-gray-500'}`}
        >
          Overdue Payments {overduePayments.length > 0 && `(${overduePayments.length})`}
        </button>
      </div>

      {/* Payment History Table */}
      {activeTab === 'history' && (
        <div className="overflow-hidden rounded-lg bg-white shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Phone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Method
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Balance After
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    {new Date(payment.payment_date).toLocaleDateString()}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    {payment.sale.customer.full_name}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    {payment.sale.phone.brand} {payment.sale.phone.model}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold">
                    {formatCurrency(payment.amount)}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    {getMethodBadge(payment.payment_method)}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    {formatCurrency(payment.balance_after)}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    {getStatusBadge(payment.status)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {payments.length === 0 && (
            <div className="py-12 text-center text-gray-500">
              No payments found. Record your first payment to get started.
            </div>
          )}
        </div>
      )}

      {/* Overdue Payments Table */}
      {activeTab === 'overdue' && (
        <div className="overflow-hidden rounded-lg bg-white shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Phone IMEI
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Installment #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Amount Due
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Due Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Days Overdue
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {overduePayments.map((payment) => (
                <tr key={payment.id} className="bg-red-50">
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium">
                    {payment.customer_name}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    {payment.phone_imei}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    #{payment.installment_number}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-red-600">
                    {formatCurrency(payment.amount_due)}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    {new Date(payment.due_date).toLocaleDateString()}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-bold text-red-600">
                    {payment.days_overdue} days
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {overduePayments.length === 0 && (
            <div className="py-12 text-center text-green-600">
              No overdue payments! All installments are current.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
