'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils';
import {
  Smartphone,
  ShoppingCart,
  DollarSign,
  AlertCircle,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

interface DashboardStats {
  total_phones: number;
  phones_in_stock?: number;
  active_sales: number;
  outstanding_balance: number;
  overdue_payments: number;
  credit_limit: number;
  credit_used: number;
  credit_available: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          setError('Not authenticated');
          return;
        }

        const response = await fetch('/api/agents/dashboard', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch dashboard stats');
        }

        const data = await response.json();
        setStats(data);
      } catch (err) {
        console.error('Failed to fetch stats:', err);
        setError(err instanceof Error ? err.message : 'Failed to load dashboard stats');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [supabase.auth]);

  if (loading) {
    return (
      <div className="space-y-8">
        {/* Stats Grid Skeleton */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse rounded-lg bg-white p-6 shadow">
              <div className="h-4 w-24 rounded bg-gray-200"></div>
              <div className="mt-4 h-8 w-32 rounded bg-gray-200"></div>
            </div>
          ))}
        </div>

        {/* Credit Card Skeleton */}
        <div className="animate-pulse rounded-lg bg-white p-6 shadow">
          <div className="h-6 w-32 rounded bg-gray-200"></div>
          <div className="mt-4 space-y-3">
            <div className="h-4 w-full rounded bg-gray-200"></div>
            <div className="h-4 w-full rounded bg-gray-200"></div>
            <div className="h-4 w-full rounded bg-gray-200"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
          <h3 className="mt-4 text-lg font-semibold text-gray-900">Error Loading Dashboard</h3>
          <p className="mt-2 text-sm text-gray-600">{error || 'Failed to load dashboard stats'}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Phones',
      value: stats.total_phones,
      subtitle: stats.phones_in_stock ? `${stats.phones_in_stock} in stock` : undefined,
      icon: Smartphone,
      gradient: 'from-blue-500 to-blue-600',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
    },
    {
      title: 'Active Sales',
      value: stats.active_sales,
      icon: ShoppingCart,
      gradient: 'from-green-500 to-green-600',
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
    },
    {
      title: 'Outstanding Balance',
      value: formatCurrency(stats.outstanding_balance),
      icon: DollarSign,
      gradient: 'from-yellow-500 to-yellow-600',
      iconBg: 'bg-yellow-100',
      iconColor: 'text-yellow-600',
    },
    {
      title: 'Overdue Payments',
      value: stats.overdue_payments,
      icon: AlertCircle,
      gradient: 'from-red-500 to-red-600',
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
    },
  ];

  const creditUsagePercent = stats.credit_limit > 0
    ? (stats.credit_used / stats.credit_limit) * 100
    : 0;

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div
              key={index}
              className="group relative overflow-hidden rounded-lg bg-white p-6 shadow transition-shadow hover:shadow-lg"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600">{card.title}</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">{card.value}</p>
                  {card.subtitle && (
                    <p className="mt-1 text-sm text-gray-500">{card.subtitle}</p>
                  )}
                </div>
                <div className={`${card.iconBg} rounded-lg p-3`}>
                  <Icon className={`h-6 w-6 ${card.iconColor}`} />
                </div>
              </div>
              <div
                className={`absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r ${card.gradient}`}
              ></div>
            </div>
          );
        })}
      </div>

      {/* Credit Status Card */}
      <div className="overflow-hidden rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold">Credit Status</h3>
            {creditUsagePercent < 70 ? (
              <TrendingUp className="h-6 w-6 text-green-300" />
            ) : (
              <TrendingDown className="h-6 w-6 text-red-300" />
            )}
          </div>

          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-blue-100">Credit Limit</span>
              <span className="text-lg font-bold">{formatCurrency(stats.credit_limit)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-blue-100">Credit Used</span>
              <span className="text-lg font-bold">{formatCurrency(stats.credit_used)}</span>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-blue-100">
                <span>Usage</span>
                <span>{creditUsagePercent.toFixed(1)}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-blue-800">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    creditUsagePercent >= 90
                      ? 'bg-red-500'
                      : creditUsagePercent >= 70
                      ? 'bg-yellow-500'
                      : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(creditUsagePercent, 100)}%` }}
                ></div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-blue-500 pt-4">
              <span className="text-sm font-medium text-blue-100">Credit Available</span>
              <span className="text-2xl font-bold text-green-300">
                {formatCurrency(stats.credit_available)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Quick Actions</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <a
            href="/dashboard/phones"
            className="flex items-center justify-center space-x-2 rounded-lg bg-blue-600 px-6 py-4 text-white transition-colors hover:bg-blue-700"
          >
            <Smartphone className="h-5 w-5" />
            <span className="font-medium">Add New Phone</span>
          </a>
          <a
            href="/dashboard/sales"
            className="flex items-center justify-center space-x-2 rounded-lg bg-green-600 px-6 py-4 text-white transition-colors hover:bg-green-700"
          >
            <ShoppingCart className="h-5 w-5" />
            <span className="font-medium">Create Sale</span>
          </a>
          <a
            href="/dashboard/payments"
            className="flex items-center justify-center space-x-2 rounded-lg bg-purple-600 px-6 py-4 text-white transition-colors hover:bg-purple-700"
          >
            <DollarSign className="h-5 w-5" />
            <span className="font-medium">Record Payment</span>
          </a>
        </div>
      </div>
    </div>
  );
}
