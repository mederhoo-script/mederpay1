'use client';

import { useEffect, useState } from 'react';
import apiClient from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

interface Phone {
  id: number;
  imei: string;
  brand: string;
  model: string;
  purchase_price: number;
  selling_price: number;
  status: string;
  is_locked: boolean;
}

export default function PhonesPage() {
  const [phones, setPhones] = useState<Phone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    imei: '',
    brand: '',
    model: '',
    serial_number: '',
    purchase_price: '',
    selling_price: '',
  });

  useEffect(() => {
    fetchPhones();
  }, []);

  const fetchPhones = async () => {
    try {
      const { data } = await apiClient.get('/phones/');
      setPhones(data.results || data);
    } catch (error) {
      console.error('Failed to fetch phones:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/phones/', {
        ...formData,
        purchase_price: parseFloat(formData.purchase_price),
        selling_price: parseFloat(formData.selling_price),
      });
      setShowForm(false);
      setFormData({
        imei: '',
        brand: '',
        model: '',
        serial_number: '',
        purchase_price: '',
        selling_price: '',
      });
      fetchPhones();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to add phone');
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: { [key: string]: string } = {
      in_stock: 'bg-green-100 text-green-800',
      sold: 'bg-blue-100 text-blue-800',
      locked: 'bg-red-100 text-red-800',
      unlocked: 'bg-yellow-100 text-yellow-800',
    };
    return (
      <span className={`rounded-full px-2 py-1 text-xs font-medium ${colors[status] || 'bg-gray-100'}`}>
        {status.replace('_', ' ').toUpperCase()}
      </span>
    );
  };

  if (loading) {
    return <div>Loading phones...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Phone Inventory</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          {showForm ? 'Cancel' : 'Add Phone'}
        </button>
      </div>

      {/* Add Phone Form */}
      {showForm && (
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold">Add New Phone</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium">IMEI</label>
                <input
                  type="text"
                  required
                  value={formData.imei}
                  onChange={(e) => setFormData({ ...formData, imei: e.target.value })}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Brand</label>
                <input
                  type="text"
                  required
                  value={formData.brand}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Model</label>
                <input
                  type="text"
                  required
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Serial Number</label>
                <input
                  type="text"
                  value={formData.serial_number}
                  onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Purchase Price</label>
                <input
                  type="number"
                  required
                  value={formData.purchase_price}
                  onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Selling Price</label>
                <input
                  type="number"
                  required
                  value={formData.selling_price}
                  onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </div>
            </div>
            <button
              type="submit"
              className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Add Phone
            </button>
          </form>
        </div>
      )}

      {/* Phones Table */}
      <div className="overflow-hidden rounded-lg bg-white shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                IMEI
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Brand / Model
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Purchase Price
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Selling Price
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Locked
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {phones.map((phone) => (
              <tr key={phone.id}>
                <td className="whitespace-nowrap px-6 py-4 text-sm">{phone.imei}</td>
                <td className="whitespace-nowrap px-6 py-4 text-sm">
                  {phone.brand} {phone.model}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm">
                  {formatCurrency(phone.purchase_price)}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm">
                  {formatCurrency(phone.selling_price)}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm">
                  {getStatusBadge(phone.status)}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm">
                  {phone.is_locked ? '🔒 Yes' : '🔓 No'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
