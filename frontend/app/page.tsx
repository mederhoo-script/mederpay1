'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Shield, TrendingUp, Users, Lock, FileText, CheckCircle, BarChart3, Smartphone } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      router.push('/dashboard');
    } else {
      setIsChecking(false);
    }
  }, [router]);

  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <h1 className="text-2xl font-semibold text-gray-900">MederPay</h1>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/login"
                className="text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="border-b border-gray-200 bg-gray-50 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
              Enterprise-Grade Phone Sales Management
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-gray-600">
              A complete platform for agents and distributors to manage phone inventory, track installment payments, and enforce payment compliance—with full accountability at every step.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <Link
                href="/register"
                className="rounded-md bg-blue-600 px-6 py-3 text-base font-medium text-white hover:bg-blue-700"
              >
                Create Agent Account
              </Link>
              <Link
                href="#how-it-works"
                className="rounded-md border border-gray-300 bg-white px-6 py-3 text-base font-medium text-gray-700 hover:bg-gray-50"
              >
                Learn More
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* What We Do */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h3 className="text-3xl font-bold text-gray-900">Built for Agents and Distributors</h3>
            <p className="mt-4 text-lg text-gray-600">
              Manage your entire phone sales operation from a single platform
            </p>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                <Smartphone className="h-6 w-6 text-blue-600" />
              </div>
              <h4 className="mt-4 text-lg font-semibold text-gray-900">Inventory Management</h4>
              <p className="mt-2 text-sm text-gray-600">
                Track every device by IMEI. Monitor stock levels, device status, and sale history in real-time.
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <h4 className="mt-4 text-lg font-semibold text-gray-900">Payment Tracking</h4>
              <p className="mt-2 text-sm text-gray-600">
                Automated installment schedules, payment reminders, and balance calculations. Integrated with Monnify for secure payment processing.
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                <Lock className="h-6 w-6 text-blue-600" />
              </div>
              <h4 className="mt-4 text-lg font-semibold text-gray-900">Device Enforcement</h4>
              <p className="mt-2 text-sm text-gray-600">
                Tamper-proof device lock enforcement for overdue payments. Automatic unlock when balance is settled.
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <h4 className="mt-4 text-lg font-semibold text-gray-900">Staff Management</h4>
              <p className="mt-2 text-sm text-gray-600">
                Create sub-agent accounts for your sales team. Set permissions and track individual performance.
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                <BarChart3 className="h-6 w-6 text-blue-600" />
              </div>
              <h4 className="mt-4 text-lg font-semibold text-gray-900">Business Analytics</h4>
              <p className="mt-2 text-sm text-gray-600">
                Dashboard with sales metrics, payment collection rates, outstanding balances, and performance trends.
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                <Shield className="h-6 w-6 text-blue-600" />
              </div>
              <h4 className="mt-4 text-lg font-semibold text-gray-900">Complete Audit Trail</h4>
              <p className="mt-2 text-sm text-gray-600">
                Every action is logged. Full visibility into who did what and when for compliance and dispute resolution.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="border-t border-gray-200 bg-gray-50 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h3 className="text-3xl font-bold text-gray-900">How It Works</h3>
            <p className="mt-4 text-lg text-gray-600">
              Four steps to manage your phone sales operation
            </p>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-2xl font-bold text-white">
                1
              </div>
              <h4 className="mt-4 text-lg font-semibold text-gray-900">Register Your Devices</h4>
              <p className="mt-2 text-sm text-gray-600">
                Add phones to your inventory using IMEI numbers. Platform validates and tracks each device globally.
              </p>
            </div>

            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-2xl font-bold text-white">
                2
              </div>
              <h4 className="mt-4 text-lg font-semibold text-gray-900">Create Sales</h4>
              <p className="mt-2 text-sm text-gray-600">
                Record customer details, payment terms, and installment schedules. One active sale per device enforced automatically.
              </p>
            </div>

            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-2xl font-bold text-white">
                3
              </div>
              <h4 className="mt-4 text-lg font-semibold text-gray-900">Track Payments</h4>
              <p className="mt-2 text-sm text-gray-600">
                Customers make payments through Monnify. System automatically updates balances and sends enforcement commands.
              </p>
            </div>

            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-2xl font-bold text-white">
                4
              </div>
              <h4 className="mt-4 text-lg font-semibold text-gray-900">Monitor & Scale</h4>
              <p className="mt-2 text-sm text-gray-600">
                Dashboard shows real-time status. Add staff, grow inventory, and expand your business with confidence.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust & Security */}
      <section className="border-t border-gray-200 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h3 className="text-3xl font-bold text-gray-900">Enterprise-Grade Security</h3>
            <p className="mt-4 text-lg text-gray-600">
              Built with the same standards used by financial institutions
            </p>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            <div className="flex gap-4">
              <CheckCircle className="h-6 w-6 flex-shrink-0 text-blue-600" />
              <div>
                <h4 className="font-semibold text-gray-900">Data Encryption</h4>
                <p className="mt-1 text-sm text-gray-600">
                  All sensitive data encrypted at rest and in transit using industry-standard protocols.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <CheckCircle className="h-6 w-6 flex-shrink-0 text-blue-600" />
              <div>
                <h4 className="font-semibold text-gray-900">Payment Security</h4>
                <p className="mt-1 text-sm text-gray-600">
                  Integrated with Monnify for PCI-compliant payment processing. No card data touches your servers.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <CheckCircle className="h-6 w-6 flex-shrink-0 text-blue-600" />
              <div>
                <h4 className="font-semibold text-gray-900">Role-Based Access</h4>
                <p className="mt-1 text-sm text-gray-600">
                  Granular permission controls. Staff can only access what they need to do their jobs.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <CheckCircle className="h-6 w-6 flex-shrink-0 text-blue-600" />
              <div>
                <h4 className="font-semibold text-gray-900">Tamper-Proof Architecture</h4>
                <p className="mt-1 text-sm text-gray-600">
                  Dual-app enforcement system prevents bypassing. Device Admin API integration for Android.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <CheckCircle className="h-6 w-6 flex-shrink-0 text-blue-600" />
              <div>
                <h4 className="font-semibold text-gray-900">Complete Audit Logs</h4>
                <p className="mt-1 text-sm text-gray-600">
                  Immutable audit trail of every action. Critical for compliance and dispute resolution.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <CheckCircle className="h-6 w-6 flex-shrink-0 text-blue-600" />
              <div>
                <h4 className="font-semibold text-gray-900">Regular Backups</h4>
                <p className="mt-1 text-sm text-gray-600">
                  Automated PostgreSQL backups ensure your business data is never lost.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Technical Platform Details */}
      <section className="border-t border-gray-200 bg-gray-50 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h3 className="text-3xl font-bold text-gray-900">Platform Capabilities</h3>
            <p className="mt-4 text-lg text-gray-600">
              Technical features that give you complete control
            </p>
          </div>

          <div className="mt-16 grid gap-6 md:grid-cols-2">
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h4 className="text-lg font-semibold text-gray-900">Business Rules Enforcement</h4>
              <ul className="mt-4 space-y-2 text-sm text-gray-600">
                <li className="flex gap-2">
                  <span className="text-blue-600">•</span>
                  <span>One active sale per device (PostgreSQL constraint)</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600">•</span>
                  <span>IMEI blacklist prevents operations on flagged devices</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600">•</span>
                  <span>Automatic device unlock when balance is paid in full</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600">•</span>
                  <span>Credit limit enforcement per agent</span>
                </li>
              </ul>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h4 className="text-lg font-semibold text-gray-900">Multi-Tier Architecture</h4>
              <ul className="mt-4 space-y-2 text-sm text-gray-600">
                <li className="flex gap-2">
                  <span className="text-blue-600">•</span>
                  <span>Django REST API with JWT authentication</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600">•</span>
                  <span>Next.js web dashboard with server-side rendering</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600">•</span>
                  <span>Android enforcement apps with Device Admin API</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600">•</span>
                  <span>PostgreSQL database with proper indexes and constraints</span>
                </li>
              </ul>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h4 className="text-lg font-semibold text-gray-900">Payment Integration</h4>
              <ul className="mt-4 space-y-2 text-sm text-gray-600">
                <li className="flex gap-2">
                  <span className="text-blue-600">•</span>
                  <span>Monnify payment gateway with webhook handlers</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600">•</span>
                  <span>Automatic payment reconciliation and balance updates</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600">•</span>
                  <span>Installment schedule generation and tracking</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600">•</span>
                  <span>Webhook signature verification for security</span>
                </li>
              </ul>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h4 className="text-lg font-semibold text-gray-900">Operational Control</h4>
              <ul className="mt-4 space-y-2 text-sm text-gray-600">
                <li className="flex gap-2">
                  <span className="text-blue-600">•</span>
                  <span>Real-time device enforcement status monitoring</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600">•</span>
                  <span>Manual lock/unlock commands for exceptional cases</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600">•</span>
                  <span>Device health check reporting from Android apps</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600">•</span>
                  <span>Command expiry and acknowledgment tracking</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t border-gray-200 bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h3 className="text-3xl font-bold text-gray-900">
            Start Managing Your Phone Sales Operation
          </h3>
          <p className="mt-4 text-lg text-gray-600">
            Join agents and distributors who trust MederPay to manage their business. Create your account in minutes.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/register"
              className="w-full rounded-md bg-blue-600 px-8 py-3 text-base font-medium text-white hover:bg-blue-700 sm:w-auto"
            >
              Create Agent Account
            </Link>
            <Link
              href="/login"
              className="w-full rounded-md border border-gray-300 bg-white px-8 py-3 text-base font-medium text-gray-700 hover:bg-gray-50 sm:w-auto"
            >
              Sign In to Existing Account
            </Link>
          </div>
          <p className="mt-6 text-sm text-gray-500">
            Questions? Contact us at{' '}
            <a href="mailto:support@mederpay.com" className="text-blue-600 hover:underline">
              support@mederpay.com
            </a>
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-gray-50 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-sm text-gray-600">
              © {new Date().getFullYear()} MederPay. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm text-gray-600">
              <a href="#" className="hover:text-gray-900">Terms of Service</a>
              <a href="#" className="hover:text-gray-900">Privacy Policy</a>
              <a href="#" className="hover:text-gray-900">Documentation</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
