'use client';

import { useEffect, useState } from 'react';
import apiClient from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

interface Phone {
  id: number;
  imei: string;
  brand: string;
  model: string;
}

interface Customer {
  id: number;
  full_name: string;
  phone_number: string;
}

interface Sale {
  id: number;
  phone: Phone;
  customer: Customer;
  selling_price: number;
  down_payment: number;
  balance: number;
  status: string;
  sale_date: string;
  installment_amount: number;
  installment_frequency: string;
}

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [phones, setPhones] = useState<Phone[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    phone_id: '',
    customer_id: '',
    selling_price: '',
    down_payment: '',
    installment_amount: '',
    installment_frequency: 'weekly',
    number_of_installments: '',
  });

  useEffect(() => {
    fetchSales();
    fetchPhones();
    fetchCustomers();
  }, []);

  const fetchSales = async () => {
    try {
      const { data } = await apiClient.get('/sales/');
      setSales(data.results || data);
    } catch (error) {
      console.error('Failed to fetch sales:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPhones = async () => {
    try {
      const { data } = await apiClient.get('/phones/?status=in_stock');
      setPhones(data.results || data);
    } catch (error) {
      console.error('Failed to fetch phones:', error);
    }
  };

  const fetchCustomers = async () => {
    try {
      const { data } = await apiClient.get('/customers/');
      setCustomers(data.results || data);
    } catch (error) {
      console.error('Failed to fetch customers:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/sales/', {
        phone_id: parseInt(formData.phone_id),
        customer_id: parseInt(formData.customer_id),
        selling_price: parseFloat(formData.selling_price),
        down_payment: parseFloat(formData.down_payment),
        installment_amount: parseFloat(formData.installment_amount),
        installment_frequency: formData.installment_frequency,
        number_of_installments: parseInt(formData.number_of_installments),
      });
      setShowForm(false);
      setFormData({
        phone_id: '',
        customer_id: '',
        selling_price: '',
        down_payment: '',
        installment_amount: '',
        installment_frequency: 'weekly',
        number_of_installments: '',
      });
      fetchSales();
      fetchPhones();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to create sale');
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: { [key: string]: string } = {
      active: 'bg-green-100 text-green-800',
      completed: 'bg-blue-100 text-blue-800',
      defaulted: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`rounded-full px-2 py-1 text-xs font-medium ${colors[status] || 'bg-gray-100'}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  if (loading) {
    return <div>Loading sales...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sales Management</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700"
        >
          {showForm ? 'Cancel' : 'Create Sale'}
        </button>
      </div>

      {/* Create Sale Form */}
      {showForm && (
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold">Create New Sale</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium">Phone</label>
                <select
                  required
                  value={formData.phone_id}
                  onChange={(e) => setFormData({ ...formData, phone_id: e.target.value })}
                  className="mt-1 w-full rounded border px-3 py-2"
                >
                  <option value="">Select a phone</option>
                  {phones.map((phone) => (
                    <option key={phone.id} value={phone.id}>
                      {phone.brand} {phone.model} - {phone.imei}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium">Customer</label>
                <select
                  required
                  value={formData.customer_id}
                  onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                  className="mt-1 w-full rounded border px-3 py-2"
                >
                  <option value="">Select a customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.full_name} - {customer.phone_number}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium">Selling Price</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.selling_price}
                  onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Down Payment</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.down_payment}
                  onChange={(e) => setFormData({ ...formData, down_payment: e.target.value })}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Installment Amount</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.installment_amount}
                  onChange={(e) => setFormData({ ...formData, installment_amount: e.target.value })}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Frequency</label>
                <select
                  value={formData.installment_frequency}
                  onChange={(e) => setFormData({ ...formData, installment_frequency: e.target.value })}
                  className="mt-1 w-full rounded border px-3 py-2"
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium">Number of Installments</label>
                <input
                  type="number"
                  required
                  value={formData.number_of_installments}
                  onChange={(e) => setFormData({ ...formData, number_of_installments: e.target.value })}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </div>
            </div>
            <button
              type="submit"
              className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700"
            >
              Create Sale
            </button>
          </form>
        </div>
      )}

      {/* Sales Table */}
      <div className="overflow-hidden rounded-lg bg-white shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Phone
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Customer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Selling Price
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Down Payment
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Balance
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Installments
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {sales.map((sale) => (
              <tr key={sale.id}>
                <td className="whitespace-nowrap px-6 py-4 text-sm">
                  {sale.phone.brand} {sale.phone.model}
                  <br />
                  <span className="text-gray-500">{sale.phone.imei}</span>
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm">
                  {sale.customer.full_name}
                  <br />
                  <span className="text-gray-500">{sale.customer.phone_number}</span>
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm">
                  {formatCurrency(sale.selling_price)}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm">
                  {formatCurrency(sale.down_payment)}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold">
                  {formatCurrency(sale.balance)}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm">
                  {formatCurrency(sale.installment_amount)} / {sale.installment_frequency}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm">
                  {getStatusBadge(sale.status)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sales.length === 0 && (
          <div className="py-12 text-center text-gray-500">
            No sales found. Create your first sale to get started.
          </div>
        )}
      </div>
    </div>
  );
}
