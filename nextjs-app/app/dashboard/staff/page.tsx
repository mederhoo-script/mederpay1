'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { staffSchema, type StaffInput } from '@/lib/validations';
import {
  UserPlus,
  Plus,
  Edit,
  Trash2,
  Search,
  X,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface Staff {
  id: string;
  full_name: string;
  role: string | null;
  commission_rate: number | null;
  is_active: boolean;
  created_at: string;
}

type StaffFormData = {
  full_name: string;
  role: string;
  commission_rate: string;
};

const initialFormData: StaffFormData = {
  full_name: '',
  role: '',
  commission_rate: '',
};

export default function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [filteredStaff, setFilteredStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [formData, setFormData] = useState<StaffFormData>(initialFormData);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const supabase = createClient();

  useEffect(() => {
    fetchStaff();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredStaff(staff);
    } else {
      const term = searchTerm.toLowerCase();
      setFilteredStaff(
        staff.filter(
          (s) =>
            s.full_name.toLowerCase().includes(term) ||
            s.role?.toLowerCase().includes(term)
        )
      );
    }
  }, [searchTerm, staff]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const fetchStaff = async () => {
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

      const response = await fetch('/api/staff', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch staff');
      }

      const data = await response.json();
      setStaff(data);
      setFilteredStaff(data);
    } catch (err) {
      console.error('Failed to fetch staff:', err);
      setError(err instanceof Error ? err.message : 'Failed to load staff');
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
    const input: StaffInput = {
      full_name: formData.full_name,
      role: formData.role || undefined,
      commission_rate: formData.commission_rate ? parseFloat(formData.commission_rate) : undefined,
    };

    const result = staffSchema.safeParse(input);

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

      const payload: StaffInput = {
        full_name: formData.full_name,
        role: formData.role || undefined,
        commission_rate: formData.commission_rate ? parseFloat(formData.commission_rate) : undefined,
      };

      const url = editingStaff ? `/api/staff/${editingStaff.id}` : '/api/staff';
      const method = editingStaff ? 'PATCH' : 'POST';

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
        throw new Error(errorData.error || 'Failed to save staff');
      }

      showToast(
        editingStaff ? 'Staff updated successfully' : 'Staff added successfully',
        'success'
      );
      setShowForm(false);
      setEditingStaff(null);
      setFormData(initialFormData);
      fetchStaff();
    } catch (err) {
      console.error('Failed to save staff:', err);
      showToast(err instanceof Error ? err.message : 'Failed to save staff', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (staffMember: Staff) => {
    setEditingStaff(staffMember);
    setFormData({
      full_name: staffMember.full_name,
      role: staffMember.role || '',
      commission_rate: staffMember.commission_rate?.toString() || '',
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

      const response = await fetch(`/api/staff/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete staff');
      }

      showToast('Staff deleted successfully', 'success');
      setDeleteConfirm(null);
      fetchStaff();
    } catch (err) {
      console.error('Failed to delete staff:', err);
      showToast(err instanceof Error ? err.message : 'Failed to delete staff', 'error');
    }
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingStaff(null);
    setFormData(initialFormData);
    setFormErrors({});
  };

  const getStatusBadge = (isActive: boolean) => {
    if (isActive) {
      return (
        <span className="inline-flex rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
          Active
        </span>
      );
    }
    return (
      <span className="inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-800">
        Inactive
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
          <h3 className="mt-4 text-lg font-semibold text-gray-900">Error Loading Staff</h3>
          <p className="mt-2 text-sm text-gray-600">{error}</p>
          <button
            onClick={fetchStaff}
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
          <UserPlus className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Staff Management</h1>
        </div>
        <button
          onClick={() => {
            setEditingStaff(null);
            setFormData(initialFormData);
            setShowForm(true);
          }}
          className="flex items-center space-x-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          <Plus className="h-5 w-5" />
          <span>Add Staff</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name or role..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full rounded-lg border border-gray-300 py-3 pl-10 pr-4 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="rounded-lg border-2 border-blue-500 bg-white p-6 shadow-lg">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">
            {editingStaff ? 'Edit Staff' : 'Add New Staff'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleInputChange}
                  className={`mt-1 w-full rounded-lg border px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 ${
                    formErrors.full_name ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter full name"
                />
                {formErrors.full_name && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.full_name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Role</label>
                <input
                  type="text"
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  className={`mt-1 w-full rounded-lg border px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 ${
                    formErrors.role ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="e.g., Sales Representative"
                />
                {formErrors.role && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.role}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Commission Rate (%)
                </label>
                <input
                  type="number"
                  name="commission_rate"
                  value={formData.commission_rate}
                  onChange={handleInputChange}
                  min="0"
                  max="100"
                  step="0.01"
                  className={`mt-1 w-full rounded-lg border px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 ${
                    formErrors.commission_rate ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="0-100"
                />
                {formErrors.commission_rate && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.commission_rate}</p>
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
                <span>{editingStaff ? 'Update' : 'Add'} Staff</span>
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
      <div className="hidden overflow-hidden rounded-lg bg-white shadow lg:block">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Full Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Commission Rate (%)
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {filteredStaff.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center">
                  <UserPlus className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-2 text-sm text-gray-500">
                    {searchTerm ? 'No staff found matching your search' : 'No staff added yet'}
                  </p>
                </td>
              </tr>
            ) : (
              filteredStaff.map((staffMember) => (
                <tr key={staffMember.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                    {staffMember.full_name}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {staffMember.role || '-'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {staffMember.commission_rate !== null && staffMember.commission_rate !== undefined
                      ? `${staffMember.commission_rate}%`
                      : '-'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    {getStatusBadge(staffMember.is_active)}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    {deleteConfirm === staffMember.id ? (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleDelete(staffMember.id)}
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
                          onClick={() => handleEdit(staffMember)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Edit"
                        >
                          <Edit className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(staffMember.id)}
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
      <div className="space-y-4 lg:hidden">
        {filteredStaff.length === 0 ? (
          <div className="rounded-lg bg-white p-12 text-center shadow">
            <UserPlus className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-500">
              {searchTerm ? 'No staff found matching your search' : 'No staff added yet'}
            </p>
          </div>
        ) : (
          filteredStaff.map((staffMember) => (
            <div key={staffMember.id} className="rounded-lg bg-white p-4 shadow">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{staffMember.full_name}</p>
                  {staffMember.role && (
                    <p className="text-sm text-gray-600">{staffMember.role}</p>
                  )}
                </div>
                {getStatusBadge(staffMember.is_active)}
              </div>

              <div className="space-y-2 border-t border-gray-100 pt-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Commission Rate:</span>
                  <span className="font-medium text-gray-900">
                    {staffMember.commission_rate !== null && staffMember.commission_rate !== undefined
                      ? `${staffMember.commission_rate}%`
                      : '-'}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex space-x-2 border-t border-gray-100 pt-3">
                {deleteConfirm === staffMember.id ? (
                  <>
                    <button
                      onClick={() => handleDelete(staffMember.id)}
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
                      onClick={() => handleEdit(staffMember)}
                      className="flex flex-1 items-center justify-center space-x-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      <Edit className="h-4 w-4" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(staffMember.id)}
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
