'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { saleSchema, type SaleInput } from '@/lib/validations';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  ShoppingCart,
  Plus,
  Eye,
  Search,
  Calendar,
  X,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface Phone {
  id: string;
  imei: string;
  brand: string | null;
  model: string | null;
  status: string;
}

interface Customer {
  id: string;
  full_name: string;
  phone_number: string;
}

interface Installment {
  id: string;
  installment_number: number;
  amount: number;
  due_date: string;
  payment_status: 'pending' | 'paid' | 'overdue';
  paid_date: string | null;
  paid_amount: number | null;
}

interface Sale {
  id: string;
  sale_date: string;
  selling_price: number;
  down_payment: number;
  balance_remaining: number;
  installment_amount: number | null;
  installment_frequency: 'daily' | 'weekly' | 'monthly' | null;
  number_of_installments: number | null;
  status: 'active' | 'completed' | 'defaulted' | 'cancelled';
  phone: Phone;
  customer: Customer;
  installments?: Installment[];
}

type SaleFormData = {
  phone_id: string;
  customer_id: string;
  selling_price: string;
  down_payment: string;
  installment_amount: string;
  installment_frequency: 'daily' | 'weekly' | 'monthly';
  number_of_installments: string;
};

const initialFormData: SaleFormData = {
  phone_id: '',
  customer_id: '',
  selling_price: '',
  down_payment: '0',
  installment_amount: '',
  installment_frequency: 'weekly',
  number_of_installments: '',
};

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [filteredSales, setFilteredSales] = useState<Sale[]>([]);
  const [phones, setPhones] = useState<Phone[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<SaleFormData>(initialFormData);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [viewingSale, setViewingSale] = useState<Sale | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    let filtered = sales;

    if (statusFilter !== 'all') {
      filtered = filtered.filter((sale) => sale.status === statusFilter);
    }

    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (sale) =>
          sale.customer.full_name.toLowerCase().includes(term) ||
          sale.phone.imei.toLowerCase().includes(term)
      );
    }

    setFilteredSales(filtered);
  }, [searchTerm, statusFilter, sales]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError('Not authenticated');
        return;
      }

      const [salesRes, phonesRes, customersRes] = await Promise.all([
        fetch('/api/sales', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }),
        fetch('/api/phones', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }),
        fetch('/api/customers', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }),
      ]);

      if (!salesRes.ok) throw new Error('Failed to fetch sales');
      if (!phonesRes.ok) throw new Error('Failed to fetch phones');
      if (!customersRes.ok) throw new Error('Failed to fetch customers');

      const salesData = await salesRes.json();
      const phonesData = await phonesRes.json();
      const customersData = await customersRes.json();

      setSales(salesData);
      setPhones(phonesData.filter((p: Phone) => p.status === 'in_stock'));
      setCustomers(customersData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    setSubmitting(true);

    try {
      const saleData: SaleInput = {
        phone_id: formData.phone_id,
        customer_id: formData.customer_id,
        selling_price: parseFloat(formData.selling_price),
        down_payment: formData.down_payment ? parseFloat(formData.down_payment) : 0,
        installment_amount: formData.installment_amount ? parseFloat(formData.installment_amount) : undefined,
        installment_frequency: formData.installment_amount ? formData.installment_frequency : undefined,
        number_of_installments: formData.number_of_installments ? parseInt(formData.number_of_installments) : undefined,
      };

      const validatedData = saleSchema.parse(saleData);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(validatedData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create sale');
      }

      setToast({ message: 'Sale created successfully!', type: 'success' });
      setShowForm(false);
      setFormData(initialFormData);
      fetchData();
    } catch (err) {
      if (err instanceof Error && 'errors' in err) {
        const zodError = err as any;
        const errors: Record<string, string> = {};
        zodError.errors?.forEach((error: any) => {
          errors[error.path[0]] = error.message;
        });
        setFormErrors(errors);
      } else {
        setToast({
          message: err instanceof Error ? err.message : 'Failed to create sale',
          type: 'error',
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      case 'defaulted':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getNextDueDate = (installments?: Installment[]) => {
    if (!installments || installments.length === 0) return null;
    const pending = installments.find((i) => i.payment_status === 'pending' || i.payment_status === 'overdue');
    return pending?.due_date || null;
  };

  const handleViewDetails = async (sale: Sale) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/sales/${sale.id}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch sale details');
      }

      const saleDetails = await response.json();
      setViewingSale(saleDetails);
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Failed to load sale details',
        type: 'error',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3 max-w-md">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-800">Error</h3>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-3 rounded-lg">
            <ShoppingCart className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sales</h1>
            <p className="text-gray-600">Manage phone sales and installments</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Cancel' : 'New Sale'}
        </button>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div
          className={`mb-4 p-4 rounded-lg flex items-start gap-3 ${
            toast.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}
        >
          <AlertCircle
            className={`w-5 h-5 mt-0.5 ${toast.type === 'success' ? 'text-green-600' : 'text-red-600'}`}
          />
          <div className="flex-1">
            <p className={toast.type === 'success' ? 'text-green-700' : 'text-red-700'}>{toast.message}</p>
          </div>
          <button onClick={() => setToast(null)} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Add Sale Form */}
      {showForm && (
        <div className="mb-6 bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Create New Sale</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Phone Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.phone_id}
                  onChange={(e) => setFormData({ ...formData, phone_id: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    formErrors.phone_id ? 'border-red-500' : 'border-gray-300'
                  }`}
                  required
                >
                  <option value="">Select Phone</option>
                  {phones.map((phone) => (
                    <option key={phone.id} value={phone.id}>
                      {phone.imei} - {phone.brand} {phone.model}
                    </option>
                  ))}
                </select>
                {formErrors.phone_id && <p className="text-red-500 text-sm mt-1">{formErrors.phone_id}</p>}
              </div>

              {/* Customer Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.customer_id}
                  onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    formErrors.customer_id ? 'border-red-500' : 'border-gray-300'
                  }`}
                  required
                >
                  <option value="">Select Customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.full_name} - {customer.phone_number}
                    </option>
                  ))}
                </select>
                {formErrors.customer_id && <p className="text-red-500 text-sm mt-1">{formErrors.customer_id}</p>}
              </div>

              {/* Selling Price */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Selling Price (NGN) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.selling_price}
                  onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    formErrors.selling_price ? 'border-red-500' : 'border-gray-300'
                  }`}
                  required
                />
                {formErrors.selling_price && <p className="text-red-500 text-sm mt-1">{formErrors.selling_price}</p>}
              </div>

              {/* Down Payment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Down Payment (NGN)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.down_payment}
                  onChange={(e) => setFormData({ ...formData, down_payment: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    formErrors.down_payment ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {formErrors.down_payment && <p className="text-red-500 text-sm mt-1">{formErrors.down_payment}</p>}
              </div>

              {/* Installment Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Installment Amount (NGN)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.installment_amount}
                  onChange={(e) => setFormData({ ...formData, installment_amount: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    formErrors.installment_amount ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {formErrors.installment_amount && (
                  <p className="text-red-500 text-sm mt-1">{formErrors.installment_amount}</p>
                )}
              </div>

              {/* Installment Frequency */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Installment Frequency</label>
                <select
                  value={formData.installment_frequency}
                  onChange={(e) =>
                    setFormData({ ...formData, installment_frequency: e.target.value as 'daily' | 'weekly' | 'monthly' })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              {/* Number of Installments */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Number of Installments</label>
                <input
                  type="number"
                  value={formData.number_of_installments}
                  onChange={(e) => setFormData({ ...formData, number_of_installments: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    formErrors.number_of_installments ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {formErrors.number_of_installments && (
                  <p className="text-red-500 text-sm mt-1">{formErrors.number_of_installments}</p>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Create Sale
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setFormData(initialFormData);
                  setFormErrors({});
                }}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters and Search */}
      <div className="mb-6 bg-white rounded-lg shadow-md p-4 border border-gray-200">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by customer name or IMEI..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="defaulted">Defaulted</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Sales Table */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Sale Date</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Phone</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Customer Name</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Selling Price</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Down Payment</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Balance Remaining</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Installments</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    No sales found
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{formatDate(sale.sale_date)}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="text-gray-900 font-medium">{sale.phone.imei}</div>
                      <div className="text-gray-500 text-xs">
                        {sale.phone.brand} {sale.phone.model}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{sale.customer.full_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                      {formatCurrency(sale.selling_price)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      {formatCurrency(sale.down_payment)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                      {formatCurrency(sale.balance_remaining)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {sale.installment_amount && sale.installment_frequency ? (
                        <div>
                          <div className="font-medium">{formatCurrency(sale.installment_amount)}</div>
                          <div className="text-xs text-gray-500">{sale.installment_frequency}</div>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(sale.status)}`}>
                        {sale.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleViewDetails(sale)}
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Sale Details Modal */}
      {viewingSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Sale Details</h2>
              <button
                onClick={() => setViewingSale(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Sale Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Phone Information</h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">IMEI:</span>
                      <span className="text-sm font-medium text-gray-900">{viewingSale.phone.imei}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Brand/Model:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {viewingSale.phone.brand} {viewingSale.phone.model}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Customer Information</h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Name:</span>
                      <span className="text-sm font-medium text-gray-900">{viewingSale.customer.full_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Phone:</span>
                      <span className="text-sm font-medium text-gray-900">{viewingSale.customer.phone_number}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Sale Details</h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Sale Date:</span>
                      <span className="text-sm font-medium text-gray-900">{formatDate(viewingSale.sale_date)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Selling Price:</span>
                      <span className="text-sm font-medium text-gray-900">{formatCurrency(viewingSale.selling_price)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Down Payment:</span>
                      <span className="text-sm font-medium text-gray-900">{formatCurrency(viewingSale.down_payment)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Status:</span>
                      <span className={`text-sm font-medium px-2 py-0.5 rounded ${getStatusColor(viewingSale.status)}`}>
                        {viewingSale.status}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Payment Summary</h3>
                  <div className="bg-blue-50 rounded-lg p-4 space-y-2 border border-blue-200">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Balance Remaining:</span>
                      <span className="text-lg font-bold text-blue-600">{formatCurrency(viewingSale.balance_remaining)}</span>
                    </div>
                    {viewingSale.installment_amount && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Installment Amount:</span>
                          <span className="text-sm font-medium text-gray-900">{formatCurrency(viewingSale.installment_amount)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Frequency:</span>
                          <span className="text-sm font-medium text-gray-900">{viewingSale.installment_frequency}</span>
                        </div>
                      </>
                    )}
                    {getNextDueDate(viewingSale.installments) && (
                      <div className="flex justify-between items-center pt-2 border-t border-blue-200">
                        <span className="text-sm text-gray-600 flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          Next Due Date:
                        </span>
                        <span className="text-sm font-medium text-gray-900">
                          {formatDate(getNextDueDate(viewingSale.installments)!)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Installment Schedule */}
              {viewingSale.installments && viewingSale.installments.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Installment Schedule</h3>
                  <div className="bg-gray-50 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">#</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Due Date</th>
                          <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600">Amount</th>
                          <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600">Status</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Paid Date</th>
                          <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600">Paid Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {viewingSale.installments.map((installment) => (
                          <tr key={installment.id} className="hover:bg-white">
                            <td className="px-4 py-2 text-sm text-gray-900">{installment.installment_number}</td>
                            <td className="px-4 py-2 text-sm text-gray-900">{formatDate(installment.due_date)}</td>
                            <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(installment.amount)}</td>
                            <td className="px-4 py-2 text-center">
                              <span
                                className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                                  installment.payment_status === 'paid'
                                    ? 'bg-green-100 text-green-800'
                                    : installment.payment_status === 'overdue'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}
                              >
                                {installment.payment_status}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {installment.paid_date ? formatDate(installment.paid_date) : '-'}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900 text-right">
                              {installment.paid_amount ? formatCurrency(installment.paid_amount) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => setViewingSale(null)}
                className="w-full bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
