'use client';

import { useEffect, useState } from 'react';
import apiClient from '@/lib/api';

interface Customer {
  id: number;
  full_name: string;
  phone_number: string;
  email?: string;
  address: string;
  nin?: string;
  bvn?: string;
  created_at: string;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    phone_number: '',
    email: '',
    address: '',
    nin: '',
    bvn: '',
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const { data } = await apiClient.get('/customers/');
      setCustomers(data.results || data);
    } catch (error) {
      console.error('Failed to fetch customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCustomer) {
        await apiClient.patch(`/customers/${editingCustomer.id}/`, formData);
      } else {
        await apiClient.post('/customers/', formData);
      }
      setShowForm(false);
      setEditingCustomer(null);
      setFormData({
        full_name: '',
        phone_number: '',
        email: '',
        address: '',
        nin: '',
        bvn: '',
      });
      fetchCustomers();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to save customer');
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      full_name: customer.full_name,
      phone_number: customer.phone_number,
      email: customer.email || '',
      address: customer.address,
      nin: customer.nin || '',
      bvn: customer.bvn || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this customer?')) return;
    try {
      await apiClient.delete(`/customers/${id}/`);
      fetchCustomers();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to delete customer');
    }
  };

  if (loading) {
    return <div>Loading customers...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Customer Management</h1>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingCustomer(null);
            setFormData({
              full_name: '',
              phone_number: '',
              email: '',
              address: '',
              nin: '',
              bvn: '',
            });
          }}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          {showForm ? 'Cancel' : 'Add Customer'}
        </button>
      </div>

      {/* Add/Edit Customer Form */}
      {showForm && (
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold">
            {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium">Full Name</label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Phone Number</label>
                <input
                  type="tel"
                  required
                  value={formData.phone_number}
                  onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Email (Optional)</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">NIN (Optional)</label>
                <input
                  type="text"
                  maxLength={11}
                  placeholder="12345678901"
                  value={formData.nin}
                  onChange={(e) => setFormData({ ...formData, nin: e.target.value.replace(/\D/g, '') })}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
                <p className="mt-1 text-xs text-gray-500">
                  National Identification Number (11 digits)
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium">BVN (Optional)</label>
                <input
                  type="text"
                  maxLength={11}
                  placeholder="12345678901"
                  value={formData.bvn}
                  onChange={(e) => setFormData({ ...formData, bvn: e.target.value.replace(/\D/g, '') })}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Bank Verification Number (11 digits)
                </p>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium">Address</label>
                <textarea
                  required
                  rows={3}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </div>
            </div>
            <button
              type="submit"
              className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              {editingCustomer ? 'Update Customer' : 'Add Customer'}
            </button>
          </form>
        </div>
      )}

      {/* Customers Table */}
      <div className="overflow-hidden rounded-lg bg-white shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Full Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Phone Number
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Address
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Registered Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {customers.map((customer) => (
              <tr key={customer.id}>
                <td className="whitespace-nowrap px-6 py-4 text-sm font-medium">
                  {customer.full_name}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm">
                  {customer.phone_number}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm">
                  {customer.email || '-'}
                </td>
                <td className="px-6 py-4 text-sm">
                  {customer.address}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm">
                  {new Date(customer.created_at).toLocaleDateString()}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm">
                  <button
                    onClick={() => handleEdit(customer)}
                    className="mr-2 text-blue-600 hover:text-blue-800"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(customer.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {customers.length === 0 && (
          <div className="py-12 text-center text-gray-500">
            No customers found. Add your first customer to get started.
          </div>
        )}
      </div>
    </div>
  );
}
