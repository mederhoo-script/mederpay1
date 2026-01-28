'use client';

import { useEffect, useState } from 'react';
import { agentSettingsSchema, type AgentSettingsInput } from '@/lib/validations';
import {
  Settings as SettingsIcon,
  Building,
  CreditCard,
  Key,
  Save,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  CheckCircle,
} from 'lucide-react';

interface Agent {
  id: string;
  business_name: string;
  business_address: string | null;
  nin: string | null;
  bvn: string | null;
  monnify_api_key: string | null;
  monnify_secret_key: string | null;
  monnify_contract_code: string | null;
  monnify_account_number: string | null;
  monnify_account_name: string | null;
  monnify_bank_name: string | null;
}

type SettingsFormData = {
  business_name: string;
  business_address: string;
  nin: string;
  bvn: string;
  monnify_api_key: string;
  monnify_secret_key: string;
  monnify_contract_code: string;
};

export default function SettingsPage() {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<SettingsFormData>({
    business_name: '',
    business_address: '',
    nin: '',
    bvn: '',
    monnify_api_key: '',
    monnify_secret_key: '',
    monnify_contract_code: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchAgentProfile();
  }, []);

  const fetchAgentProfile = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/agents/profile');
      if (!response.ok) {
        throw new Error('Failed to fetch agent profile');
      }
      const data = await response.json();
      setAgent(data);
      setFormData({
        business_name: data.business_name || '',
        business_address: data.business_address || '',
        nin: data.nin || '',
        bvn: data.bvn || '',
        monnify_api_key: data.monnify_api_key || '',
        monnify_secret_key: data.monnify_secret_key || '',
        monnify_contract_code: data.monnify_contract_code || '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch agent profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (section: 'business' | 'kyc' | 'monnify') => {
    setFormErrors({});
    setSubmitting(true);

    try {
      let payload: Partial<AgentSettingsInput> = {};

      if (section === 'business') {
        payload = {
          business_name: formData.business_name,
          business_address: formData.business_address || undefined,
        };
      } else if (section === 'kyc') {
        payload = {
          nin: formData.nin || undefined,
          bvn: formData.bvn || undefined,
        };
      } else if (section === 'monnify') {
        payload = {
          monnify_api_key: formData.monnify_api_key || undefined,
          monnify_secret_key: formData.monnify_secret_key || undefined,
          monnify_contract_code: formData.monnify_contract_code || undefined,
        };
      }

      // Merge with existing data for validation
      const fullPayload = {
        business_name: formData.business_name,
        ...payload,
      };

      const validation = agentSettingsSchema.safeParse(fullPayload);
      if (!validation.success) {
        const errors: Record<string, string> = {};
        validation.error.errors.forEach((err) => {
          if (err.path[0]) {
            errors[err.path[0].toString()] = err.message;
          }
        });
        setFormErrors(errors);
        return;
      }

      const response = await fetch('/api/agents/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update settings');
      }

      const updatedAgent = await response.json();
      setAgent(updatedAgent);
      showToast('Settings updated successfully', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update settings', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateAccount = async () => {
    setCreatingAccount(true);

    try {
      const response = await fetch('/api/monnify/create-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create reserved account');
      }

      await response.json();
      showToast('Reserved account created successfully', 'success');
      fetchAgentProfile(); // Refresh to get account details
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create reserved account', 'error');
    } finally {
      setCreatingAccount(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <SettingsIcon className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        </div>
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <SettingsIcon className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900">Error</h3>
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <SettingsIcon className="h-8 w-8 text-blue-600" />
          Settings
        </h1>
        <p className="text-gray-600 mt-1">Manage your business information and integrations</p>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ${
            toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          } text-white`}
        >
          {toast.message}
        </div>
      )}

      {/* Business Information */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <Building className="h-6 w-6 text-blue-600" />
          <h2 className="text-xl font-semibold">Business Information</h2>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit('business');
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Business Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.business_name}
              onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                formErrors.business_name ? 'border-red-500' : 'border-gray-300'
              }`}
              required
            />
            {formErrors.business_name && (
              <p className="text-red-500 text-sm mt-1">{formErrors.business_name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Business Address
            </label>
            <textarea
              value={formData.business_address}
              onChange={(e) => setFormData({ ...formData, business_address: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Optional"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-5 w-5" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* KYC Information */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="h-6 w-6 text-blue-600" />
          <h2 className="text-xl font-semibold">KYC Information</h2>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit('kyc');
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                NIN (National Identification Number)
              </label>
              <input
                type="text"
                value={formData.nin}
                onChange={(e) => setFormData({ ...formData, nin: e.target.value })}
                maxLength={11}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  formErrors.nin ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="11 digits"
              />
              {formErrors.nin && <p className="text-red-500 text-sm mt-1">{formErrors.nin}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                BVN (Bank Verification Number)
              </label>
              <input
                type="text"
                value={formData.bvn}
                onChange={(e) => setFormData({ ...formData, bvn: e.target.value })}
                maxLength={11}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  formErrors.bvn ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="11 digits"
              />
              {formErrors.bvn && <p className="text-red-500 text-sm mt-1">{formErrors.bvn}</p>}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-5 w-5" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Monnify Integration */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <Key className="h-6 w-6 text-blue-600" />
          <h2 className="text-xl font-semibold">Monnify Integration</h2>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit('monnify');
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={formData.monnify_api_key}
                onChange={(e) => setFormData({ ...formData, monnify_api_key: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                placeholder="Enter Monnify API Key"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showApiKey ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Secret Key</label>
            <div className="relative">
              <input
                type={showSecretKey ? 'text' : 'password'}
                value={formData.monnify_secret_key}
                onChange={(e) =>
                  setFormData({ ...formData, monnify_secret_key: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                placeholder="Enter Monnify Secret Key"
              />
              <button
                type="button"
                onClick={() => setShowSecretKey(!showSecretKey)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showSecretKey ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contract Code</label>
            <input
              type="text"
              value={formData.monnify_contract_code}
              onChange={(e) =>
                setFormData({ ...formData, monnify_contract_code: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter Monnify Contract Code"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-5 w-5" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>

        {/* Reserved Account Section */}
        {agent?.monnify_api_key && agent?.monnify_secret_key && agent?.monnify_contract_code && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="text-lg font-semibold mb-4">Reserved Account</h3>
            {agent.monnify_account_number ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-green-900 mb-2">Account Created</h4>
                    <div className="space-y-2 text-sm text-green-800">
                      <div className="flex justify-between">
                        <span className="font-medium">Account Number:</span>
                        <span className="font-mono">{agent.monnify_account_number}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">Account Name:</span>
                        <span>{agent.monnify_account_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">Bank Name:</span>
                        <span>{agent.monnify_bank_name}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-600 mb-4">
                  Create a reserved account to receive automatic payment notifications from
                  Monnify.
                </p>
                <button
                  onClick={handleCreateAccount}
                  disabled={creatingAccount}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creatingAccount ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Creating Account...
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-5 w-5" />
                      Create Reserved Account
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
