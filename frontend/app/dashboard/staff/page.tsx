'use client';

import { useEffect, useState } from 'react';
import apiClient from '@/lib/api';

interface Staff {
  id: number;
  full_name: string;
  role: string;
  status: string;
  commission_rate: number;
  created_at: string;
}

export default function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    role: '',
    commission_rate: '',
    status: 'active',
  });

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    try {
      const { data } = await apiClient.get('/staff/');
      setStaff(data.results || data);
    } catch (error) {
      console.error('Failed to fetch staff:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingStaff) {
        await apiClient.patch(`/staff/${editingStaff.id}/`, {
          full_name: formData.full_name,
          role: formData.role,
          commission_rate: parseFloat(formData.commission_rate),
          status: formData.status,
        });
      } else {
        await apiClient.post('/staff/', {
          full_name: formData.full_name,
          role: formData.role,
          commission_rate: parseFloat(formData.commission_rate),
          status: formData.status,
        });
      }
      setShowForm(false);
      setEditingStaff(null);
      setFormData({
        full_name: '',
        role: '',
        commission_rate: '',
        status: 'active',
      });
      fetchStaff();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to save staff member');
    }
  };

  const handleEdit = (member: Staff) => {
    setEditingStaff(member);
    setFormData({
      full_name: member.full_name,
      role: member.role,
      commission_rate: member.commission_rate.toString(),
      status: member.status,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to remove this staff member?')) return;
    try {
      await apiClient.delete(`/staff/${id}/`);
      fetchStaff();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to delete staff member');
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: { [key: string]: string } = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      suspended: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`rounded-full px-2 py-1 text-xs font-medium ${colors[status] || 'bg-gray-100'}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  if (loading) {
    return <div>Loading staff...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Staff Management</h1>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingStaff(null);
            setFormData({
              full_name: '',
              role: '',
              commission_rate: '',
              status: 'active',
            });
          }}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          {showForm ? 'Cancel' : 'Add Staff Member'}
        </button>
      </div>

      {/* Add/Edit Staff Form */}
      {showForm && (
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold">
            {editingStaff ? 'Edit Staff Member' : 'Add New Staff Member'}
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
                <label className="block text-sm font-medium">Role</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Sales Agent, Sub-Agent, Manager"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Commission Rate (%)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  required
                  value={formData.commission_rate}
                  onChange={(e) => setFormData({ ...formData, commission_rate: e.target.value })}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="mt-1 w-full rounded border px-3 py-2"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </div>
            <button
              type="submit"
              className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              {editingStaff ? 'Update Staff Member' : 'Add Staff Member'}
            </button>
          </form>
        </div>
      )}

      {/* Staff Table */}
      <div className="overflow-hidden rounded-lg bg-white shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Full Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Commission Rate
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Joined Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {staff.map((member) => (
              <tr key={member.id}>
                <td className="whitespace-nowrap px-6 py-4 text-sm font-medium">
                  {member.full_name}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm">
                  {member.role}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm">
                  {member.commission_rate}%
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm">
                  {getStatusBadge(member.status)}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm">
                  {new Date(member.created_at).toLocaleDateString()}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm">
                  <button
                    onClick={() => handleEdit(member)}
                    className="mr-2 text-blue-600 hover:text-blue-800"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(member.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {staff.length === 0 && (
          <div className="py-12 text-center text-gray-500">
            No staff members found. Add your first staff member to get started.
          </div>
        )}
      </div>
    </div>
  );
}
