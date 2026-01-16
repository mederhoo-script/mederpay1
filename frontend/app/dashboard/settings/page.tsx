'use client';

import { useEffect, useState } from 'react';
import apiClient from '@/lib/api';

interface AgentProfile {
  id: number;
  business_name: string;
  business_address: string;
  monnify_public_key: string;
  monnify_contract_code: string;
  monnify_webhook_secret: string;
  has_monnify_configured: boolean;
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    business_name: '',
    business_address: '',
    monnify_public_key: '',
    monnify_secret_key: '',
    monnify_contract_code: '',
    monnify_webhook_secret: '',
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data } = await apiClient.get('/agents/me/');
      setProfile(data);
      setFormData({
        business_name: data.business_name || '',
        business_address: data.business_address || '',
        monnify_public_key: data.monnify_public_key || '',
        monnify_secret_key: '', // Never send back the secret key
        monnify_contract_code: data.monnify_contract_code || '',
        monnify_webhook_secret: data.monnify_webhook_secret || '',
      });
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      await apiClient.patch('/agents/me/', formData);
      setMessage({ type: 'success', text: 'Settings saved successfully!' });
      fetchProfile();
    } catch (error: any) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Failed to save settings' 
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div>Loading settings...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-2 text-gray-600">
          Manage your business profile and Monnify payment integration
        </p>
      </div>

      {/* Status Alert */}
      {message && (
        <div
          className={`rounded-lg p-4 ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800'
              : 'bg-red-50 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Business Information */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold">Business Information</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium">Business Name</label>
              <input
                type="text"
                required
                value={formData.business_name}
                onChange={(e) =>
                  setFormData({ ...formData, business_name: e.target.value })
                }
                className="mt-1 w-full rounded border px-3 py-2"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium">Business Address</label>
              <textarea
                rows={3}
                value={formData.business_address}
                onChange={(e) =>
                  setFormData({ ...formData, business_address: e.target.value })
                }
                className="mt-1 w-full rounded border px-3 py-2"
              />
            </div>
          </div>

          {/* Monnify Configuration */}
          <div className="mt-6 border-t pt-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Monnify Payment Integration</h3>
                <p className="text-sm text-gray-600">
                  Configure your Monnify credentials to receive payments
                </p>
              </div>
              {profile?.has_monnify_configured && (
                <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
                  ✓ Configured
                </span>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium">
                  Monnify Public Key (API Key)
                </label>
                <input
                  type="text"
                  placeholder="MK_TEST_XXXXXXXXXX or MK_PROD_XXXXXXXXXX"
                  value={formData.monnify_public_key}
                  onChange={(e) =>
                    setFormData({ ...formData, monnify_public_key: e.target.value })
                  }
                  className="mt-1 w-full rounded border px-3 py-2"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Get this from your Monnify dashboard under Settings → API Keys
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium">
                  Monnify Secret Key
                </label>
                <input
                  type="password"
                  placeholder={profile?.has_monnify_configured ? '••••••••••••••••' : 'Enter your secret key'}
                  value={formData.monnify_secret_key}
                  onChange={(e) =>
                    setFormData({ ...formData, monnify_secret_key: e.target.value })
                  }
                  className="mt-1 w-full rounded border px-3 py-2"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Your secret key is encrypted and stored securely. Leave blank to keep existing key.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium">
                  Contract Code
                </label>
                <input
                  type="text"
                  placeholder="1234567890"
                  value={formData.monnify_contract_code}
                  onChange={(e) =>
                    setFormData({ ...formData, monnify_contract_code: e.target.value })
                  }
                  className="mt-1 w-full rounded border px-3 py-2"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Your Monnify contract code for payment processing
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium">
                  Webhook Secret
                </label>
                <input
                  type="password"
                  placeholder="Enter webhook secret"
                  value={formData.monnify_webhook_secret}
                  onChange={(e) =>
                    setFormData({ ...formData, monnify_webhook_secret: e.target.value })
                  }
                  className="mt-1 w-full rounded border px-3 py-2"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Used to verify webhook requests from Monnify
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-lg bg-blue-50 p-4">
              <h4 className="text-sm font-semibold text-blue-900">How to get your Monnify credentials:</h4>
              <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-blue-800">
                <li>Log in to your Monnify dashboard at <a href="https://app.monnify.com" target="_blank" rel="noopener noreferrer" className="underline">app.monnify.com</a></li>
                <li>Navigate to Settings → API Settings</li>
                <li>Copy your API Key (Public Key) and Secret Key</li>
                <li>Find your Contract Code in Settings → Business Settings</li>
                <li>Set up webhook URL: <code className="rounded bg-blue-100 px-1">{process.env.NEXT_PUBLIC_API_URL}/webhooks/monnify/</code></li>
              </ol>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={saving}
              className={`rounded px-6 py-2 text-white ${
                saving
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>

      {/* Security Notice */}
      <div className="rounded-lg bg-yellow-50 p-4">
        <h4 className="text-sm font-semibold text-yellow-900">🔒 Security Notice</h4>
        <p className="mt-1 text-sm text-yellow-800">
          Your Monnify secret key is encrypted before storage and never displayed after saving.
          Keep your credentials secure and never share them with anyone.
        </p>
      </div>
    </div>
  );
}
