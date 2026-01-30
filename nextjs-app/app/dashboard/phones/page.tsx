'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils';
import { phoneSchema, type PhoneInput } from '@/lib/validations';
import {
  Smartphone,
  Plus,
  Edit,
  Trash2,
  Search,
  X,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface Phone {
  id: string;
  imei: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  purchase_price: number | null;
  selling_price: number | null;
  status: 'in_stock' | 'sold' | 'locked' | 'stolen' | 'returned';
  is_locked: boolean;
  created_at: string;
}

type PhoneFormData = {
  imei: string;
  brand: string;
  model: string;
  serial_number: string;
  purchase_price: string;
  selling_price: string;
};

const initialFormData: PhoneFormData = {
  imei: '',
  brand: '',
  model: '',
  serial_number: '',
  purchase_price: '',
  selling_price: '',
};

export default function PhonesPage() {
  const [phones, setPhones] = useState<Phone[]>([]);
  const [filteredPhones, setFilteredPhones] = useState<Phone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingPhone, setEditingPhone] = useState<Phone | null>(null);
  const [formData, setFormData] = useState<PhoneFormData>(initialFormData);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const supabase = createClient();

  useEffect(() => {
    fetchPhones();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredPhones(phones);
    } else {
      const term = searchTerm.toLowerCase();
      setFilteredPhones(
        phones.filter(
          (phone) =>
            phone.imei.toLowerCase().includes(term) ||
            phone.brand?.toLowerCase().includes(term) ||
            phone.model?.toLowerCase().includes(term)
        )
      );
    }
  }, [searchTerm, phones]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const fetchPhones = async () => {
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

      const response = await fetch('/api/phones', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch phones');
      }

      const data = await response.json();
      setPhones(data);
      setFilteredPhones(data);
    } catch (err) {
      console.error('Failed to fetch phones:', err);
      setError(err instanceof Error ? err.message : 'Failed to load phones');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const input: PhoneInput = {
      imei: formData.imei,
      brand: formData.brand || undefined,
      model: formData.model || undefined,
      serial_number: formData.serial_number || undefined,
      purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : undefined,
      selling_price: formData.selling_price ? parseFloat(formData.selling_price) : undefined,
    };

    const result = phoneSchema.safeParse(input);

    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          errors[err.path[0].toString()] = err.message;
        }
      });
      setFormErrors(errors);
      return false;
    }

    setFormErrors({});
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setSubmitting(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        showToast('Not authenticated', 'error');
        return;
      }

      const payload: PhoneInput = {
        imei: formData.imei,
        brand: formData.brand || undefined,
        model: formData.model || undefined,
        serial_number: formData.serial_number || undefined,
        purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : undefined,
        selling_price: formData.selling_price ? parseFloat(formData.selling_price) : undefined,
      };

      const url = editingPhone ? `/api/phones/${editingPhone.id}` : '/api/phones';
      const method = editingPhone ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save phone');
      }

      showToast(
        editingPhone ? 'Phone updated successfully' : 'Phone added successfully',
        'success'
      );
      setShowForm(false);
      setEditingPhone(null);
      setFormData(initialFormData);
      fetchPhones();
    } catch (err) {
      console.error('Failed to save phone:', err);
      showToast(err instanceof Error ? err.message : 'Failed to save phone', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (phone: Phone) => {
    setEditingPhone(phone);
    setFormData({
      imei: phone.imei,
      brand: phone.brand || '',
      model: phone.model || '',
      serial_number: phone.serial_number || '',
      purchase_price: phone.purchase_price?.toString() || '',
      selling_price: phone.selling_price?.toString() || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        showToast('Not authenticated', 'error');
        return;
      }

      const response = await fetch(`/api/phones/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete phone');
      }

      showToast('Phone deleted successfully', 'success');
      setDeleteConfirm(null);
      fetchPhones();
    } catch (err) {
      console.error('Failed to delete phone:', err);
      showToast(err instanceof Error ? err.message : 'Failed to delete phone', 'error');
    }
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingPhone(null);
    setFormData(initialFormData);
    setFormErrors({});
  };

  const getStatusBadge = (status: Phone['status']) => {
    const styles = {
      in_stock: 'bg-green-100 text-green-800',
      sold: 'bg-blue-100 text-blue-800',
      locked: 'bg-red-100 text-red-800',
      stolen: 'bg-red-100 text-red-800',
      returned: 'bg-gray-100 text-gray-800',
    };

    const labels = {
      in_stock: 'In Stock',
      sold: 'Sold',
      locked: 'Locked',
      stolen: 'Stolen',
      returned: 'Returned',
    };

    return (
      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const getLockStatusBadge = (isLocked: boolean) => {
    if (isLocked) {
      return (
        <span className="inline-flex rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-800">
          Locked
        </span>
      );
    }
    return (
      <span className="inline-flex rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
        Unlocked
      </span>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 animate-pulse rounded bg-gray-200"></div>
          <div className="h-10 w-32 animate-pulse rounded bg-gray-200"></div>
        </div>
        <div className="h-12 w-full animate-pulse rounded bg-gray-200"></div>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-200"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
          <h3 className="mt-4 text-lg font-semibold text-gray-900">Error Loading Phones</h3>
          <p className="mt-2 text-sm text-gray-600">{error}</p>
          <button
            onClick={fetchPhones}
            className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed right-4 top-4 z-50 animate-slide-in">
          <div
            className={`flex items-center space-x-3 rounded-lg px-6 py-4 shadow-lg ${
              toast.type === 'success'
                ? 'bg-green-600 text-white'
                : 'bg-red-600 text-white'
            }`}
          >
            <span className="font-medium">{toast.message}</span>
            <button onClick={() => setToast(null)} className="hover:opacity-80">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Smartphone className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Phones Management</h1>
        </div>
        <button
          onClick={() => {
            setEditingPhone(null);
            setFormData(initialFormData);
            setShowForm(true);
          }}
          className="flex items-center space-x-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          <Plus className="h-5 w-5" />
          <span>Add Phone</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by IMEI, brand, or model..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full rounded-lg border border-gray-300 py-3 pl-10 pr-4 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="rounded-lg border-2 border-blue-500 bg-white p-6 shadow-lg">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">
            {editingPhone ? 'Edit Phone' : 'Add New Phone'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  IMEI <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="imei"
                  value={formData.imei}
                  onChange={handleInputChange}
                  maxLength={15}
                  readOnly={!!editingPhone}
                  className={`mt-1 w-full rounded-lg border px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 ${
                    formErrors.imei ? 'border-red-500' : 'border-gray-300'
                  } ${editingPhone ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  placeholder="Enter 15-digit IMEI"
                />
                {formErrors.imei && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.imei}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Brand</label>
                <input
                  type="text"
                  name="brand"
                  value={formData.brand}
                  onChange={handleInputChange}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  placeholder="e.g., Apple, Samsung"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Model</label>
                <input
                  type="text"
                  name="model"
                  value={formData.model}
                  onChange={handleInputChange}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  placeholder="e.g., iPhone 13, Galaxy S21"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Serial Number</label>
                <input
                  type="text"
                  name="serial_number"
                  value={formData.serial_number}
                  onChange={handleInputChange}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  placeholder="Enter serial number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Purchase Price (NGN)
                </label>
                <input
                  type="number"
                  name="purchase_price"
                  value={formData.purchase_price}
                  onChange={handleInputChange}
                  min="0"
                  step="0.01"
                  className={`mt-1 w-full rounded-lg border px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 ${
                    formErrors.purchase_price ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="0.00"
                />
                {formErrors.purchase_price && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.purchase_price}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Selling Price (NGN)
                </label>
                <input
                  type="number"
                  name="selling_price"
                  value={formData.selling_price}
                  onChange={handleInputChange}
                  min="0"
                  step="0.01"
                  className={`mt-1 w-full rounded-lg border px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 ${
                    formErrors.selling_price ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="0.00"
                />
                {formErrors.selling_price && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.selling_price}</p>
                )}
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center space-x-2 rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:bg-gray-400"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>{editingPhone ? 'Update' : 'Add'} Phone</span>
              </button>
              <button
                type="button"
                onClick={handleCancelForm}
                className="rounded-lg border border-gray-300 px-6 py-2 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Desktop Table */}
      <div className="hidden overflow-hidden rounded-lg bg-white shadow md:block">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                IMEI
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Brand & Model
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Serial Number
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Purchase Price
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Selling Price
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Lock Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {filteredPhones.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center">
                  <Smartphone className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-2 text-sm text-gray-500">
                    {searchTerm ? 'No phones found matching your search' : 'No phones added yet'}
                  </p>
                </td>
              </tr>
            ) : (
              filteredPhones.map((phone) => (
                <tr key={phone.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                    {phone.imei}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {phone.brand && phone.model
                      ? `${phone.brand} ${phone.model}`
                      : phone.brand || phone.model || '-'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {phone.serial_number || '-'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {phone.purchase_price ? formatCurrency(phone.purchase_price) : '-'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {phone.selling_price ? formatCurrency(phone.selling_price) : '-'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    {getStatusBadge(phone.status)}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    {getLockStatusBadge(phone.is_locked)}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    {deleteConfirm === phone.id ? (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleDelete(phone.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex space-x-3">
                        <button
                          onClick={() => handleEdit(phone)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Edit"
                        >
                          <Edit className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(phone.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="space-y-4 md:hidden">
        {filteredPhones.length === 0 ? (
          <div className="rounded-lg bg-white p-12 text-center shadow">
            <Smartphone className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-500">
              {searchTerm ? 'No phones found matching your search' : 'No phones added yet'}
            </p>
          </div>
        ) : (
          filteredPhones.map((phone) => (
            <div key={phone.id} className="rounded-lg bg-white p-4 shadow">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{phone.imei}</p>
                  <p className="text-sm text-gray-600">
                    {phone.brand && phone.model
                      ? `${phone.brand} ${phone.model}`
                      : phone.brand || phone.model || 'No brand/model'}
                  </p>
                </div>
                <div className="flex space-x-2">
                  {getStatusBadge(phone.status)}
                  {getLockStatusBadge(phone.is_locked)}
                </div>
              </div>

              <div className="space-y-2 border-t border-gray-100 pt-3 text-sm">
                {phone.serial_number && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Serial:</span>
                    <span className="font-medium text-gray-900">{phone.serial_number}</span>
                  </div>
                )}
                {phone.purchase_price && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Purchase Price:</span>
                    <span className="font-medium text-gray-900">
                      {formatCurrency(phone.purchase_price)}
                    </span>
                  </div>
                )}
                {phone.selling_price && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Selling Price:</span>
                    <span className="font-medium text-gray-900">
                      {formatCurrency(phone.selling_price)}
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-4 flex space-x-2 border-t border-gray-100 pt-3">
                {deleteConfirm === phone.id ? (
                  <>
                    <button
                      onClick={() => handleDelete(phone.id)}
                      className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                    >
                      Confirm Delete
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleEdit(phone)}
                      className="flex flex-1 items-center justify-center space-x-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      <Edit className="h-4 w-4" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(phone.id)}
                      className="flex flex-1 items-center justify-center space-x-2 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Delete</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
