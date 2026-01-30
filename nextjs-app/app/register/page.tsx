'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, UserPlus } from 'lucide-react';
import { registerSchema, type RegisterInput } from '@/lib/validations';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<Omit<RegisterInput, 'confirmPassword'>>({
    username: '',
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone_number: '',
    business_name: '',
    business_address: '',
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof RegisterInput, string>>>({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    // Validate with Zod schema
    const dataWithConfirm = { ...formData, confirmPassword };
    const validation = registerSchema.safeParse(dataWithConfirm);
    
    if (!validation.success) {
      const errors: Partial<Record<keyof RegisterInput, string>> = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0]) {
          errors[err.path[0] as keyof RegisterInput] = err.message;
        }
      });
      setFieldErrors(errors);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 px-4 py-12">
      <div className="w-full max-w-3xl space-y-8 rounded-2xl bg-white p-8 shadow-xl">
        <div className="text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-purple-600 text-white shadow-lg">
            <UserPlus size={32} />
          </div>
          <h2 className="mt-4 text-3xl font-bold text-gray-900">Create Agent Account</h2>
          <p className="mt-2 text-gray-600">Register your business with MederPay</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="space-y-6">
            {/* Personal Information Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Personal Information</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="first_name" className="block text-sm font-medium text-gray-700">
                    First Name
                  </label>
                  <input
                    id="first_name"
                    name="first_name"
                    type="text"
                    autoComplete="given-name"
                    required
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className={`mt-1 w-full rounded-lg border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all ${
                      fieldErrors.first_name
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                        : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                    }`}
                    placeholder="John"
                    aria-invalid={!!fieldErrors.first_name}
                    aria-describedby={fieldErrors.first_name ? 'first_name-error' : undefined}
                  />
                  {fieldErrors.first_name && (
                    <p id="first_name-error" className="mt-1 text-sm text-red-600">
                      {fieldErrors.first_name}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="last_name" className="block text-sm font-medium text-gray-700">
                    Last Name
                  </label>
                  <input
                    id="last_name"
                    name="last_name"
                    type="text"
                    autoComplete="family-name"
                    required
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className={`mt-1 w-full rounded-lg border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all ${
                      fieldErrors.last_name
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                        : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                    }`}
                    placeholder="Doe"
                    aria-invalid={!!fieldErrors.last_name}
                    aria-describedby={fieldErrors.last_name ? 'last_name-error' : undefined}
                  />
                  {fieldErrors.last_name && (
                    <p id="last_name-error" className="mt-1 text-sm text-red-600">
                      {fieldErrors.last_name}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                    Username
                  </label>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    required
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className={`mt-1 w-full rounded-lg border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all ${
                      fieldErrors.username
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                        : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                    }`}
                    placeholder="johndoe"
                    aria-invalid={!!fieldErrors.username}
                    aria-describedby={fieldErrors.username ? 'username-error' : undefined}
                  />
                  {fieldErrors.username && (
                    <p id="username-error" className="mt-1 text-sm text-red-600">
                      {fieldErrors.username}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email Address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={`mt-1 w-full rounded-lg border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all ${
                      fieldErrors.email
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                        : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                    }`}
                    placeholder="john@example.com"
                    aria-invalid={!!fieldErrors.email}
                    aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                  />
                  {fieldErrors.email && (
                    <p id="email-error" className="mt-1 text-sm text-red-600">
                      {fieldErrors.email}
                    </p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="phone_number" className="block text-sm font-medium text-gray-700">
                    Phone Number <span className="text-gray-400">(optional)</span>
                  </label>
                  <input
                    id="phone_number"
                    name="phone_number"
                    type="tel"
                    autoComplete="tel"
                    value={formData.phone_number}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                    className={`mt-1 w-full rounded-lg border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all ${
                      fieldErrors.phone_number
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                        : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                    }`}
                    placeholder="+234 800 000 0000"
                    aria-invalid={!!fieldErrors.phone_number}
                    aria-describedby={fieldErrors.phone_number ? 'phone_number-error' : undefined}
                  />
                  {fieldErrors.phone_number && (
                    <p id="phone_number-error" className="mt-1 text-sm text-red-600">
                      {fieldErrors.phone_number}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Password Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Security</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className={`mt-1 w-full rounded-lg border px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all ${
                        fieldErrors.password
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                          : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                      }`}
                      placeholder="Enter password"
                      aria-invalid={!!fieldErrors.password}
                      aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md p-1 transition-colors"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  {fieldErrors.password ? (
                    <p id="password-error" className="mt-1 text-sm text-red-600">
                      {fieldErrors.password}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-gray-500">
                      Must be at least 8 characters long
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`mt-1 w-full rounded-lg border px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all ${
                        fieldErrors.confirmPassword
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                          : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                      }`}
                      placeholder="Confirm password"
                      aria-invalid={!!fieldErrors.confirmPassword}
                      aria-describedby={fieldErrors.confirmPassword ? 'confirmPassword-error' : undefined}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={showConfirmPassword ? 'Hide password confirmation' : 'Show password confirmation'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md p-1 transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  {fieldErrors.confirmPassword && (
                    <p id="confirmPassword-error" className="mt-1 text-sm text-red-600">
                      {fieldErrors.confirmPassword}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Business Information Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Business Information</h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="business_name" className="block text-sm font-medium text-gray-700">
                    Business Name
                  </label>
                  <input
                    id="business_name"
                    name="business_name"
                    type="text"
                    autoComplete="organization"
                    required
                    value={formData.business_name}
                    onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                    className={`mt-1 w-full rounded-lg border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all ${
                      fieldErrors.business_name
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                        : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                    }`}
                    placeholder="Your Business Ltd"
                    aria-invalid={!!fieldErrors.business_name}
                    aria-describedby={fieldErrors.business_name ? 'business_name-error' : undefined}
                  />
                  {fieldErrors.business_name && (
                    <p id="business_name-error" className="mt-1 text-sm text-red-600">
                      {fieldErrors.business_name}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="business_address" className="block text-sm font-medium text-gray-700">
                    Business Address <span className="text-gray-400">(optional)</span>
                  </label>
                  <textarea
                    id="business_address"
                    name="business_address"
                    autoComplete="street-address"
                    value={formData.business_address}
                    onChange={(e) => setFormData({ ...formData, business_address: e.target.value })}
                    className={`mt-1 w-full rounded-lg border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all ${
                      fieldErrors.business_address
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                        : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                    }`}
                    rows={3}
                    placeholder="123 Main Street, Lagos, Nigeria"
                    aria-invalid={!!fieldErrors.business_address}
                    aria-describedby={fieldErrors.business_address ? 'business_address-error' : undefined}
                  />
                  {fieldErrors.business_address && (
                    <p id="business_address-error" className="mt-1 text-sm text-red-600">
                      {fieldErrors.business_address}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-3 text-white font-semibold shadow-md hover:shadow-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Creating account...
              </span>
            ) : (
              'Create account'
            )}
          </button>

          <div className="text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link
                href="/login"
                className="font-semibold text-blue-600 hover:text-blue-700 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded transition-colors"
              >
                Sign in here
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
