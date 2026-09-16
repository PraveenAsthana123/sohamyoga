'use client';

import { useState, useEffect } from 'react';

const PLATFORM_EMOJIS: Record<string, string> = {
  facebook: '📘', instagram: '📸', twitter: '🐦', linkedin: '💼',
  youtube: '▶️', tiktok: '🎵', pinterest: '📌', snapchat: '👻',
  whatsapp: '💬', telegram: '✈️', reddit: '🤖', github: '🐙',
  gitlab: '🦊', slack: '💬', discord: '🎮', stripe: '💳',
  shopify: '🛍️', google: '🔍', microsoft: '🪟', apple: '🍎',
  amazon: '📦', twitch: '🎮', spotify: '🎧', medium: '📝',
  substack: '📧', patreon: '🎨', mailchimp: '🐒', hubspot: '🔶',
  salesforce: '☁️', zendesk: '🎫', intercom: '💬', typeform: '📋',
  notion: '📓', airtable: '🗃️', zapier: '⚡', make: '🔧',
};

const PLATFORM_DESCRIPTIONS: Record<string, string> = {
  facebook: 'Connect Facebook Pages for social publishing and lead management.',
  instagram: 'Share content, reels, and stories to your Instagram Business account.',
  twitter: 'Post tweets, threads, and monitor mentions and DMs.',
  linkedin: 'Publish professional content and manage LinkedIn company pages.',
  youtube: 'Upload videos, manage playlists, and monitor comments.',
  tiktok: 'Schedule and publish short-form video content.',
  pinterest: 'Create and schedule pins to grow organic reach.',
  whatsapp: 'Manage WhatsApp Business messaging and broadcasts.',
  default: 'Connect and manage this platform integration.',
};

interface PlatformSetting {
  platform: string;
  display_name: string;
  category: string;
  globally_enabled: boolean;
  customer_enabled: boolean;
  enabled_by: string;
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
        checked ? 'bg-indigo-600' : 'bg-gray-200'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

export default function CustomerPlatformSettingsPage() {
  const [platforms, setPlatforms] = useState<PlatformSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/customer/platform-settings');
      if (!r.ok) {
        const d = await r.json() as { error?: string };
        setError(d.error ?? 'Failed to load platform settings');
        return;
      }
      const data = await r.json() as { platforms: PlatformSetting[] };
      setPlatforms(data.platforms);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(platform: string, enabled: boolean) {
    setToggling(platform);
    try {
      const r = await fetch('/api/customer/platform-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, enabled }),
      });
      if (r.ok) {
        setPlatforms(prev =>
          prev.map(p => p.platform === platform ? { ...p, customer_enabled: enabled } : p)
        );
      }
    } finally {
      setToggling(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400">Loading your platform settings…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-2xl mx-auto bg-red-50 border border-red-200 rounded-xl p-6 text-red-700">
          <p className="font-semibold">Error</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  const enabledCount = platforms.filter(p => p.customer_enabled).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">⚙️ Platform Settings</h1>
          <p className="text-gray-500 mt-1">Manage which platforms you want to use. Your admin has enabled these platforms globally.</p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-indigo-600">{platforms.length}</p>
            <p className="text-sm text-gray-500 mt-1">Available Platforms</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{enabledCount}</p>
            <p className="text-sm text-gray-500 mt-1">Enabled by You</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-gray-400">{platforms.length - enabledCount}</p>
            <p className="text-sm text-gray-500 mt-1">Paused</p>
          </div>
        </div>

        {/* Platform Grid */}
        {platforms.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-xl mb-2">No platforms available yet</p>
            <p className="text-sm">Your admin hasn&apos;t enabled any platforms globally. Check back later.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {platforms.map(p => {
              const isToggling = toggling === p.platform;
              const desc = PLATFORM_DESCRIPTIONS[p.platform] ?? PLATFORM_DESCRIPTIONS.default;

              return (
                <div
                  key={p.platform}
                  className={`bg-white border rounded-xl p-5 transition-all ${
                    p.customer_enabled ? 'border-green-200 shadow-sm' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                        p.customer_enabled ? 'bg-indigo-50' : 'bg-gray-50'
                      }`}>
                        {PLATFORM_EMOJIS[p.platform] ?? '🔌'}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 capitalize">{p.display_name ?? p.platform}</h3>
                        <p className="text-xs text-gray-400 capitalize">{p.category}</p>
                      </div>
                    </div>
                    <Toggle
                      checked={p.customer_enabled}
                      onChange={v => handleToggle(p.platform, v)}
                      disabled={isToggling}
                    />
                  </div>

                  <p className="text-sm text-gray-500 mb-4">{desc}</p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${p.customer_enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <span className="text-xs text-gray-500">
                        {p.customer_enabled ? 'Active' : 'Paused'}
                      </span>
                    </div>
                    <a
                      href={`/customer/integrations`}
                      className="text-xs text-indigo-600 hover:text-indigo-800"
                    >
                      Connect account →
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Info note */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
          <strong>Note:</strong> Disabling a platform here only prevents it from being used for your account.
          It does not disconnect any existing connections or delete your data. You can re-enable at any time.
        </div>
      </div>
    </div>
  );
}
