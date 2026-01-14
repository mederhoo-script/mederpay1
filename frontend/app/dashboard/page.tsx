'use client';

import { useEffect, useState } from 'react';
import apiClient from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

interface DashboardStats {
  total_phones: number;
  phones_in_stock: number;
  active_sales: number;
  total_outstanding_balance: number;
  overdue_payments_count: number;
  credit_limit: number;
  credit_used: number;
  credit_available: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data } = await apiClient.get('/agents/dashboard/');
        setStats(data);
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return <div>Loading dashboard...</div>;
  }

  if (!stats) {
    return <div>Failed to load dashboard stats</div>;
  }

  const statCards = [
    {
      title: 'Total Phones',
      value: stats.total_phones,
      subtitle: `${stats.phones_in_stock} in stock`,
      color: 'blue',
    },
    {
      title: 'Active Sales',
      value: stats.active_sales,
      color: 'green',
    },
    {
      title: 'Outstanding Balance',
      value: formatCurrency(stats.total_outstanding_balance),
      color: 'yellow',
    },
    {
      title: 'Overdue Payments',
      value: stats.overdue_payments_count,
      color: 'red',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card, index) => (
          <div
            key={index}
            className="rounded-lg bg-white p-6 shadow"
          >
            <h3 className="text-sm font-medium text-gray-600">{card.title}</h3>
            <p className="mt-2 text-3xl font-bold">{card.value}</p>
            {card.subtitle && (
              <p className="mt-1 text-sm text-gray-500">{card.subtitle}</p>
            )}
          </div>
        ))}
      </div>

      {/* Credit Status */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h3 className="text-lg font-semibold">Credit Status</h3>
        <div className="mt-4 space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-600">Credit Limit:</span>
            <span className="font-semibold">{formatCurrency(stats.credit_limit)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Credit Used:</span>
            <span className="font-semibold">{formatCurrency(stats.credit_used)}</span>
          </div>
          <div className="flex justify-between border-t pt-2">
            <span className="text-gray-600">Credit Available:</span>
            <span className="font-semibold text-green-600">
              {formatCurrency(stats.credit_available)}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h3 className="mb-4 text-lg font-semibold">Quick Actions</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <a
            href="/dashboard/phones"
            className="rounded bg-blue-600 px-4 py-3 text-center text-white hover:bg-blue-700"
          >
            Add New Phone
          </a>
          <a
            href="/dashboard/sales"
            className="rounded bg-green-600 px-4 py-3 text-center text-white hover:bg-green-700"
          >
            Create Sale
          </a>
          <a
            href="/dashboard/payments"
            className="rounded bg-purple-600 px-4 py-3 text-center text-white hover:bg-purple-700"
          >
            Record Payment
          </a>
        </div>
      </div>
    </div>
  );
}
