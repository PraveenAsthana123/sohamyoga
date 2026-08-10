'use client';

import { useState, useEffect, useCallback } from 'react';
import { homeApi, SiteSettings } from '@/lib/api';

type Section = 'social' | 'smtp' | 'features' | 'api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export default function ConfigPage() {
  const [section, setSection] = useState<Section>('social');
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [form, setForm] = useState<Partial<SiteSettings>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // SMTP test state
  const [testEmail, setTestEmail] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await homeApi.getSettings();
      setSettings(s);
      setForm({
        facebookUrl: s.facebookUrl || '',
        twitterUrl: s.twitterUrl || '',
        linkedInUrl: s.linkedInUrl || '',
        newsletterEnabled: s.newsletterEnabled,
      });
    } catch {
      setError('Failed to load settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (patch: Partial<SiteSettings>) => {
    if (!settings) return;
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await fetch(`${API_URL}/api/home/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...settings, ...patch }),
      });
      setSaved(true);
      await load();
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const testSmtp = async () => {
    if (!testEmail) return;
    setTesting(true);
    setTestResult('');
    try {
      const res = await fetch(`${API_URL}/api/home/test-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: testEmail }),
      });
      if (res.ok) setTestResult('✓ Test email sent successfully!');
      else setTestResult('✗ Failed to send. Check SMTP credentials in Settings → Company → SMTP.');
    } catch {
      setTestResult('✗ Failed to reach server.');
    } finally {
      setTesting(false);
    }
  };

  const sections: { id: Section; label: string; icon: string; desc: string }[] = [
    { id: 'social', label: 'Social Media', icon: '📣', desc: 'Manage social media links and campaign URLs' },
    { id: 'smtp', label: 'Email / SMTP', icon: '✉️', desc: 'Configure email delivery and test connection' },
    { id: 'features', label: 'Feature Flags', icon: '🔧', desc: 'Toggle site features on or off' },
    { id: 'api', label: 'API & Integrations', icon: '🔌', desc: 'External service connections and status' },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Configuration Panel</h1>
        <p className="text-gray-500 text-sm mt-1">Central hub for managing site configuration and integrations</p>
      </div>

      {saved && (
        <div className="mb-4 flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Changes saved successfully.
        </div>
      )}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <div className="grid md:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="space-y-1">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`w-full flex items-start gap-3 px-4 py-3 rounded-lg text-left transition-all ${
                section === s.id
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="text-xl leading-none mt-0.5">{s.icon}</span>
              <div>
                <div className="font-medium text-sm">{s.label}</div>
                <div className="text-xs text-gray-500 mt-0.5 hidden lg:block">{s.desc}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="md:col-span-3">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {section === 'social' && <SocialSection form={form} setForm={setForm} onSave={save} saving={saving} />}
              {section === 'smtp' && <SmtpSection settings={settings} testEmail={testEmail} setTestEmail={setTestEmail} onTest={testSmtp} testing={testing} testResult={testResult} />}
              {section === 'features' && <FeaturesSection form={form} setForm={setForm} onSave={save} saving={saving} />}
              {section === 'api' && <ApiSection />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Social Media Section ─────────────────────────────────────────────────────

function SocialSection({ form, setForm, onSave, saving }: {
  form: Partial<SiteSettings & { instagramUrl?: string }>;
  setForm: React.Dispatch<React.SetStateAction<Partial<SiteSettings>>>;
  onSave: (p: Partial<SiteSettings>) => void;
  saving: boolean;
}) {
  const socialLinks = [
    { key: 'facebookUrl', label: 'Facebook', icon: '📘', placeholder: 'https://facebook.com/yourpage', campaign: 'utm_source=facebook&utm_medium=social&utm_campaign=sohamyoga' },
    { key: 'twitterUrl', label: 'Twitter / X', icon: '🐦', placeholder: 'https://twitter.com/yourhandle', campaign: 'utm_source=twitter&utm_medium=social&utm_campaign=sohamyoga' },
    { key: 'linkedInUrl', label: 'LinkedIn', icon: '💼', placeholder: 'https://linkedin.com/company/yourcompany', campaign: 'utm_source=linkedin&utm_medium=social&utm_campaign=sohamyoga' },
    { key: 'instagramUrl', label: 'Instagram', icon: '📸', placeholder: 'https://instagram.com/yourhandle', campaign: 'utm_source=instagram&utm_medium=social&utm_campaign=sohamyoga' },
  ] as const;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Social Media Links</h2>
      <p className="text-sm text-gray-500 mb-6">Update your social media profile URLs. These appear in the site footer and contact page.</p>

      <div className="space-y-5">
        {socialLinks.map(({ key, label, icon, placeholder, campaign }) => (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {icon} {label}
            </label>
            <input
              type="url"
              value={(form as Record<string, string>)[key] || ''}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder={placeholder}
            />
            {(form as Record<string, string>)[key] && (
              <div className="mt-1 flex items-center gap-2">
                <span className="text-xs text-gray-400">Campaign URL:</span>
                <code className="text-xs text-blue-600 break-all">
                  {(form as Record<string, string>)[key]}?{campaign}
                </code>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(`${(form as Record<string, string>)[key]}?${campaign}`)}
                  className="text-xs text-gray-400 hover:text-blue-600 transition-colors flex-shrink-0"
                  title="Copy campaign URL"
                >
                  Copy
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-gray-100">
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-800 mb-4">
          <strong>Campaign Tip:</strong> Use the campaign URLs shown above when posting on social media to track traffic in Google Analytics or similar tools.
        </div>
        <button
          onClick={() => onSave(form as Partial<SiteSettings>)}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium px-6 py-2.5 rounded-lg transition-colors text-sm flex items-center gap-2"
        >
          {saving ? (
            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</>
          ) : 'Save Social Links'}
        </button>
      </div>
    </div>
  );
}

// ─── SMTP Section ─────────────────────────────────────────────────────────────

function SmtpSection({ settings, testEmail, setTestEmail, onTest, testing, testResult }: {
  settings: SiteSettings | null;
  testEmail: string;
  setTestEmail: (v: string) => void;
  onTest: () => void;
  testing: boolean;
  testResult: string;
}) {
  return (
    <div className="space-y-4">
      {/* Current Config (read-only display) */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Email Configuration</h2>
        <p className="text-sm text-gray-500 mb-4">
          SMTP settings are configured via environment variables or{' '}
          <a href="/admin/settings" className="text-blue-600 hover:underline">Admin → Settings</a>.
        </p>
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          {[
            { label: 'SMTP Host', value: (settings as SiteSettings & { smtpHost?: string })?.smtpHost || 'Not configured' },
            { label: 'SMTP Port', value: (settings as SiteSettings & { smtpPort?: number })?.smtpPort?.toString() || '587' },
            { label: 'Username', value: (settings as SiteSettings & { smtpUsername?: string })?.smtpUsername ? '••••••••' : 'Not set' },
            { label: 'Password', value: (settings as SiteSettings & { smtpPassword?: string })?.smtpPassword ? '••••••••' : 'Not set' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-0.5">{label}</div>
              <div className="font-medium text-gray-900">{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Test Email */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-1">Test Email Delivery</h3>
        <p className="text-sm text-gray-500 mb-4">Send a test email to verify your SMTP configuration is working.</p>
        <div className="flex gap-3">
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="recipient@example.com"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
          <button
            onClick={onTest}
            disabled={testing || !testEmail}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium px-5 py-2 rounded-lg transition-colors text-sm flex items-center gap-2 whitespace-nowrap"
          >
            {testing ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Sending...</>
            ) : 'Send Test'}
          </button>
        </div>
        {testResult && (
          <div className={`mt-3 text-sm px-4 py-2 rounded-lg ${testResult.startsWith('✓') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {testResult}
          </div>
        )}
      </div>

      {/* Sendgrid Quick Setup */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
        <h3 className="font-semibold text-blue-900 mb-2">🚀 Quick Setup with SendGrid</h3>
        <ol className="text-sm text-blue-800 space-y-1.5 list-decimal list-inside">
          <li>Sign up at sendgrid.com (free tier: 100 emails/day)</li>
          <li>Create an API key in Settings → API Keys → Full Access</li>
          <li>Set in <code className="bg-blue-100 px-1 rounded">.env</code>: <code className="bg-blue-100 px-1 rounded">SMTP_HOST=smtp.sendgrid.net</code>, <code className="bg-blue-100 px-1 rounded">SMTP_USERNAME=apikey</code>, <code className="bg-blue-100 px-1 rounded">SMTP_PASSWORD=SG.xxx</code></li>
          <li>Restart the backend container and test above</li>
        </ol>
      </div>
    </div>
  );
}

// ─── Feature Flags Section ────────────────────────────────────────────────────

function FeaturesSection({ form, setForm, onSave, saving }: {
  form: Partial<SiteSettings>;
  setForm: React.Dispatch<React.SetStateAction<Partial<SiteSettings>>>;
  onSave: (p: Partial<SiteSettings>) => void;
  saving: boolean;
}) {
  const features = [
    { key: 'newsletterEnabled', label: 'Newsletter Subscription', desc: 'Show the newsletter signup form on the homepage and blog', icon: '📧' },
  ];

  // Frontend-only toggles (stored in localStorage for now)
  const [localFlags, setLocalFlags] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return { careersPage: true, liveChat: true, blogEnabled: true };
    return {
      careersPage: localStorage.getItem('flag_careersPage') !== 'false',
      liveChat: localStorage.getItem('flag_liveChat') !== 'false',
      blogEnabled: localStorage.getItem('flag_blogEnabled') !== 'false',
    };
  });

  const localFeatures = [
    { key: 'careersPage', label: 'Careers Page', desc: 'Show the /careers page and nav link (frontend flag)', icon: '💼' },
    { key: 'liveChat', label: 'Live Chat Widget', desc: 'Show the floating chat widget on all public pages', icon: '💬' },
    { key: 'blogEnabled', label: 'Blog Section', desc: 'Show blog pages and navigation links', icon: '📝' },
  ];

  const toggleLocal = (key: string, val: boolean) => {
    setLocalFlags((f) => ({ ...f, [key]: val }));
    localStorage.setItem(`flag_${key}`, String(val));
  };

  return (
    <div className="space-y-4">
      {/* Backend flags */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Site Features</h2>
        <p className="text-sm text-gray-500 mb-5">Toggle features on/off. These are saved in the database.</p>
        <div className="space-y-4">
          {features.map(({ key, label, desc, icon }) => (
            <div key={key} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
              <div className="flex items-start gap-3">
                <span className="text-xl mt-0.5">{icon}</span>
                <div>
                  <div className="font-medium text-gray-900 text-sm">{label}</div>
                  <div className="text-xs text-gray-500">{desc}</div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-4">
                <input
                  type="checkbox"
                  checked={(form[key as keyof SiteSettings] as boolean) ?? false}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5" />
              </label>
            </div>
          ))}
        </div>
        <button
          onClick={() => onSave(form)}
          disabled={saving}
          className="mt-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium px-6 py-2 rounded-lg transition-colors text-sm flex items-center gap-2"
        >
          {saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</> : 'Save'}
        </button>
      </div>

      {/* Frontend-only flags */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Frontend Toggles</h2>
        <p className="text-sm text-gray-500 mb-5">Stored in browser localStorage. Useful for quick A/B testing or hiding sections during maintenance.</p>
        <div className="space-y-4">
          {localFeatures.map(({ key, label, desc, icon }) => (
            <div key={key} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
              <div className="flex items-start gap-3">
                <span className="text-xl mt-0.5">{icon}</span>
                <div>
                  <div className="font-medium text-gray-900 text-sm">{label}</div>
                  <div className="text-xs text-gray-500">{desc}</div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-4">
                <input
                  type="checkbox"
                  checked={localFlags[key] ?? true}
                  onChange={(e) => toggleLocal(key, e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5" />
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── API & Integrations Section ───────────────────────────────────────────────

function ApiSection() {
  const [health, setHealth] = useState<{ status: string; uptime?: string; environment?: string } | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/health`)
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth({ status: 'unhealthy' }));
  }, []);

  const integrations = [
    { name: 'SendGrid (SMTP)', status: 'configure', desc: 'Transactional email delivery', docsUrl: 'https://sendgrid.com', envVars: ['SMTP_HOST', 'SMTP_USERNAME', 'SMTP_PASSWORD'] },
    { name: 'Cloudflare Tunnel', status: 'configure', desc: 'Zero-trust remote access without port forwarding', docsUrl: 'https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/', envVars: ['cloudflared tunnel --url http://localhost:3000'] },
    { name: 'SignalR (Live Chat)', status: 'active', desc: 'Real-time WebSocket communication', envVars: [] },
    { name: 'SQLite Database', status: 'active', desc: 'Local database — no external connection needed', envVars: ['ConnectionStrings__DefaultConnection'] },
    { name: 'GitHub Actions CI/CD', status: 'configure', desc: 'Automated build, test, and deploy pipeline', envVars: ['DEPLOY_HOST', 'DEPLOY_USER', 'DEPLOY_SSH_KEY'] },
  ];

  return (
    <div className="space-y-4">
      {/* Backend health */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Backend Health</h2>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${health?.status === 'Healthy' ? 'bg-green-100 text-green-700' : health ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${health?.status === 'Healthy' ? 'bg-green-500' : 'bg-red-500'}`} />
            {health?.status || 'Checking...'}
          </span>
        </div>
        {health && (
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
            {health.environment && <span>Environment: <strong>{health.environment}</strong></span>}
            {health.uptime && <span>Uptime: <strong>{health.uptime}</strong></span>}
          </div>
        )}
      </div>

      {/* Integrations list */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Service Integrations</h2>
        <div className="space-y-4">
          {integrations.map((intg) => (
            <div key={intg.name} className="flex items-start gap-4 py-3 border-b border-gray-100 last:border-0">
              <span className={`mt-0.5 inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${intg.status === 'active' ? 'bg-green-500' : 'bg-yellow-400'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-gray-900">{intg.name}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${intg.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
                    {intg.status === 'active' ? 'Active' : 'Setup Required'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{intg.desc}</p>
                {intg.envVars.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {intg.envVars.map((v) => (
                      <code key={v} className="text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">{v}</code>
                    ))}
                  </div>
                )}
              </div>
              {intg.docsUrl && (
                <a href={intg.docsUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex-shrink-0">
                  Docs →
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
