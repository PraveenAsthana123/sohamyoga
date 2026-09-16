'use client';

import { useEffect, useState } from 'react';

interface ClientPortal {
  id: string;
  company_name: string;
  primary_contact_name: string | null;
  primary_contact_email: string;
  slug: string;
  logo_url: string | null;
  brand_color: string;
  allowed_modules: string[];
  status: string;
  plan: string;
  retainer_cad: string | null;
  trial_ends_at: string | null;
  created_at: string;
}

const STATUS_COLOR: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  trial: 'bg-amber-100 text-amber-700',
  suspended: 'bg-red-100 text-red-700',
};

const PLAN_COLOR: Record<string, string> = {
  trial: 'bg-gray-100 text-gray-600',
  standard: 'bg-blue-100 text-blue-700',
  premium: 'bg-purple-100 text-purple-700',
};

const ALL_MODULES = ['campaigns', 'analytics', 'reports', 'invoices', 'social', 'ads'];

const TABS = ['Clients', 'Branding', 'Access Control', 'Reports'] as const;
type Tab = typeof TABS[number];

const MOCK_REPORT_DATES: Record<string, string> = {};

export default function ClientPortalPage() {
  const [tab, setTab] = useState<Tab>('Clients');
  const [clients, setClients] = useState<ClientPortal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reportStatus, setReportStatus] = useState<Record<string, string>>({});
  const [editingBrand, setEditingBrand] = useState<string | null>(null);
  const [brandDraft, setBrandDraft] = useState<{ logoUrl: string; brandColor: string; customDomain: string }>({
    logoUrl: '', brandColor: '#3B82F6', customDomain: '',
  });
  const [moduleEdits, setModuleEdits] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/client-portal', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Failed to load.'); return; }
      const list: ClientPortal[] = data.clients ?? [];
      setClients(list);
      // Init module edits from DB state
      const mods: Record<string, string[]> = {};
      for (const c of list) { mods[c.id] = c.allowed_modules; }
      setModuleEdits(mods);
    } catch {
      setError('Network error.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  async function generateReport(clientId: string) {
    setReportStatus(prev => ({ ...prev, [clientId]: 'generating' }));
    try {
      await fetch(`/api/admin/client-portal/${clientId}/report`);
      const now = new Date().toLocaleString();
      setReportStatus(prev => ({ ...prev, [clientId]: now }));
      MOCK_REPORT_DATES[clientId] = now;
    } catch {
      setReportStatus(prev => ({ ...prev, [clientId]: 'error' }));
    }
  }

  async function impersonate(clientId: string) {
    // Sets admin override cookie for impersonation
    document.cookie = `admin_impersonate_client=${clientId}; path=/; max-age=3600; SameSite=Strict`;
    setSuccessMsg(`Impersonating client ${clientId}. Cookie set for 1 hour.`);
  }

  function toggleModule(clientId: string, mod: string) {
    setModuleEdits(prev => {
      const current = prev[clientId] ?? [];
      return {
        ...prev,
        [clientId]: current.includes(mod) ? current.filter(m => m !== mod) : [...current, mod],
      };
    });
  }

  async function saveModules(clientId: string) {
    setSaving(true);
    try {
      await fetch(`/api/admin/client-portal/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowedModules: moduleEdits[clientId] }),
      });
      setSuccessMsg('Access control saved.');
      load();
    } catch {
      setError('Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function saveBranding(clientId: string) {
    setSaving(true);
    try {
      await fetch(`/api/admin/client-portal/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logoUrl: brandDraft.logoUrl || undefined, brandColor: brandDraft.brandColor }),
      });
      setEditingBrand(null);
      setSuccessMsg('Branding saved.');
      load();
    } catch {
      setError('Save failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">White-Label Client Portal</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage agency clients — each gets a branded portal at <code className="rounded bg-gray-100 px-1">/portal/&#123;slug&#125;</code>.
        </p>
      </header>

      {successMsg && (
        <div className="flex items-center justify-between rounded bg-green-50 p-3">
          <p className="text-sm text-green-700">{successMsg}</p>
          <button onClick={() => setSuccessMsg('')} className="text-green-500 hover:text-green-700">✕</button>
        </div>
      )}
      {error && <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
                tab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading…</p>}

      {/* Tab: Clients */}
      {tab === 'Clients' && !loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map(c => (
            <div key={c.id} className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              {/* Logo / color band */}
              <div
                className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl text-white text-xl font-bold"
                style={{ backgroundColor: c.brand_color }}
              >
                {c.logo_url
                  ? <img src={c.logo_url} alt={c.company_name} className="h-full w-full rounded-xl object-contain" />
                  : c.company_name.charAt(0)}
              </div>

              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{c.company_name}</p>
                    <p className="text-xs text-gray-500">{c.primary_contact_email}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {c.status}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PLAN_COLOR[c.plan] ?? 'bg-gray-100 text-gray-600'}`}>
                      {c.plan}
                    </span>
                  </div>
                </div>
                {c.retainer_cad && (
                  <p className="mt-1 text-xs text-gray-500">Retainer: ${Number(c.retainer_cad).toLocaleString()} CAD/mo</p>
                )}
                {c.trial_ends_at && (
                  <p className="mt-1 text-xs text-amber-600">Trial ends: {c.trial_ends_at}</p>
                )}
              </div>

              <div className="mt-4 flex gap-2">
                <a
                  href={`/portal/${c.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 rounded-md bg-indigo-50 py-1.5 text-center text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                >
                  View Portal →
                </a>
                <button
                  onClick={() => {
                    setTab('Branding');
                    setEditingBrand(c.id);
                    setBrandDraft({ logoUrl: c.logo_url ?? '', brandColor: c.brand_color, customDomain: '' });
                  }}
                  className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
                >
                  Edit
                </button>
                <button
                  onClick={() => impersonate(c.id)}
                  className="rounded-md bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100"
                >
                  Impersonate
                </button>
              </div>
            </div>
          ))}

          {clients.length === 0 && (
            <div className="col-span-3 rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-500">
              No client portals yet.
            </div>
          )}
        </div>
      )}

      {/* Tab: Branding */}
      {tab === 'Branding' && !loading && (
        <div className="space-y-4">
          {clients.map(c => (
            <div key={c.id} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="h-8 w-8 rounded-lg"
                    style={{ backgroundColor: c.brand_color }}
                  />
                  <p className="font-semibold text-gray-900">{c.company_name}</p>
                  <p className="text-xs text-gray-500">/portal/{c.slug}</p>
                </div>
                {editingBrand !== c.id && (
                  <button
                    onClick={() => {
                      setEditingBrand(c.id);
                      setBrandDraft({ logoUrl: c.logo_url ?? '', brandColor: c.brand_color, customDomain: '' });
                    }}
                    className="rounded bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
                  >
                    Edit Branding
                  </button>
                )}
              </div>

              {editingBrand === c.id && (
                <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">Logo URL</label>
                    <input
                      type="text"
                      value={brandDraft.logoUrl}
                      onChange={e => setBrandDraft(d => ({ ...d, logoUrl: e.target.value }))}
                      placeholder="https://example.com/logo.png"
                      className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">Brand Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={brandDraft.brandColor}
                        onChange={e => setBrandDraft(d => ({ ...d, brandColor: e.target.value }))}
                        className="h-8 w-12 cursor-pointer rounded border border-gray-300"
                      />
                      <span className="text-sm text-gray-600">{brandDraft.brandColor}</span>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">Custom Domain (placeholder)</label>
                    <input
                      type="text"
                      value={brandDraft.customDomain}
                      onChange={e => setBrandDraft(d => ({ ...d, customDomain: e.target.value }))}
                      placeholder="portal.clientdomain.com"
                      className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <p className="mt-1 text-xs text-gray-400">Custom domains require DNS CNAME + SSL provisioning. Contact support.</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveBranding(c.id)}
                      disabled={saving}
                      className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {saving ? 'Saving…' : 'Save Branding'}
                    </button>
                    <button
                      onClick={() => setEditingBrand(null)}
                      className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tab: Access Control */}
      {tab === 'Access Control' && !loading && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Toggle which modules each client can access in their portal.</p>
          {clients.map(c => (
            <div key={c.id} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-semibold text-gray-900">{c.company_name}</p>
                <button
                  onClick={() => saveModules(c.id)}
                  disabled={saving}
                  className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {ALL_MODULES.map(mod => {
                  const enabled = (moduleEdits[c.id] ?? []).includes(mod);
                  return (
                    <label key={mod} className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 p-2 hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={() => toggleModule(c.id, mod)}
                        className="accent-indigo-600"
                      />
                      <span className="text-sm capitalize text-gray-700">{mod}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Reports */}
      {tab === 'Reports' && !loading && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Client</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Plan</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Last Report</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clients.map(c => {
                const status = reportStatus[c.id];
                return (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{c.company_name}</p>
                      <p className="text-xs text-gray-500">{c.primary_contact_email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PLAN_COLOR[c.plan] ?? 'bg-gray-100 text-gray-600'}`}>
                        {c.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {status && status !== 'generating' && status !== 'error'
                        ? status
                        : MOCK_REPORT_DATES[c.id] ?? 'Never generated'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => generateReport(c.id)}
                        disabled={status === 'generating'}
                        className="rounded-md bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                      >
                        {status === 'generating' ? 'Generating…' : 'Generate Report'}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {clients.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400">No clients found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
