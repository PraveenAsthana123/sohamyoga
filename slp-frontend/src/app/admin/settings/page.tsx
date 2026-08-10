'use client';

import { useState, useEffect } from 'react';
import { homeApi, type SiteSettings } from '@/lib/api';
import { AdminFormInput, AdminFormCheckbox } from '@/components/admin/AdminFormInput';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({
    companyName: '',
    tagline: '',
    description: '',
    phone: '',
    email: '',
    address: '',
    facebookUrl: '',
    twitterUrl: '',
    linkedInUrl: '',
    googleMapsEmbed: '',
    newsletterEnabled: true,
  });

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await homeApi.getSettings();
        setForm({
          companyName: settings.companyName || '',
          tagline: settings.tagline || '',
          description: settings.description || '',
          phone: settings.phone || '',
          email: settings.email || '',
          address: settings.address || '',
          facebookUrl: settings.facebookUrl || '',
          twitterUrl: settings.twitterUrl || '',
          linkedInUrl: settings.linkedInUrl || '',
          googleMapsEmbed: settings.googleMapsEmbed || '',
          newsletterEnabled: settings.newsletterEnabled ?? true,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const res = await fetch(`${API_URL}/api/home/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Failed to save settings' }));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }

      setSuccess('Settings saved successfully.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-3 text-dark-500">Loading settings...</span>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark-900">Site Settings</h1>
        <p className="text-dark-500 mt-1">Configure your website details and contact information.</p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Company Information */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-dark-900 mb-4">Company Information</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AdminFormInput
              label="Company Name"
              name="companyName"
              value={form.companyName}
              onChange={handleChange}
              required
              placeholder="SohamYoga"
            />
            <AdminFormInput
              label="Tagline"
              name="tagline"
              value={form.tagline}
              onChange={handleChange}
              placeholder="IT Management & AI Solutions"
            />
            <div className="lg:col-span-2">
              <label htmlFor="description" className="block text-sm font-medium text-dark-700 mb-1">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={3}
                className="w-full px-4 py-2 border border-dark-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                placeholder="Brief description of your company"
              />
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-dark-900 mb-4">Contact Information</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AdminFormInput
              label="Phone"
              name="phone"
              type="tel"
              value={form.phone}
              onChange={handleChange}
              placeholder="+1 (403) 555-0100"
            />
            <AdminFormInput
              label="Email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="info@sohamyoga.com"
            />
            <div className="lg:col-span-2">
              <label htmlFor="address" className="block text-sm font-medium text-dark-700 mb-1">
                Address
              </label>
              <textarea
                id="address"
                name="address"
                value={form.address}
                onChange={handleChange}
                rows={2}
                className="w-full px-4 py-2 border border-dark-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                placeholder="123 Main St, Calgary, AB"
              />
            </div>
          </div>
        </div>

        {/* Social Media */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-dark-900 mb-4">Social Media</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AdminFormInput
              label="Facebook URL"
              name="facebookUrl"
              type="url"
              value={form.facebookUrl}
              onChange={handleChange}
              placeholder="https://facebook.com/slpsystems"
            />
            <AdminFormInput
              label="Twitter URL"
              name="twitterUrl"
              type="url"
              value={form.twitterUrl}
              onChange={handleChange}
              placeholder="https://twitter.com/slpsystems"
            />
            <AdminFormInput
              label="LinkedIn URL"
              name="linkedInUrl"
              type="url"
              value={form.linkedInUrl}
              onChange={handleChange}
              placeholder="https://linkedin.com/company/slpsystems"
            />
          </div>
        </div>

        {/* Additional Settings */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-dark-900 mb-4">Additional Settings</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="googleMapsEmbed" className="block text-sm font-medium text-dark-700 mb-1">
                Google Maps Embed URL
              </label>
              <textarea
                id="googleMapsEmbed"
                name="googleMapsEmbed"
                value={form.googleMapsEmbed}
                onChange={handleChange}
                rows={2}
                className="w-full px-4 py-2 border border-dark-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                placeholder="https://www.google.com/maps/embed?..."
              />
            </div>
            <AdminFormCheckbox
              label="Newsletter Enabled"
              name="newsletterEnabled"
              checked={form.newsletterEnabled}
              onChange={handleChange}
              description="Allow visitors to subscribe to your newsletter."
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary py-2 px-6 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
