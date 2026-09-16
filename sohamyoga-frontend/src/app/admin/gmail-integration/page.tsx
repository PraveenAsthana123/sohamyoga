'use client';

import { useEffect, useState } from 'react';

interface GmailAccount {
  id: string;
  account_email: string;
  connection_name: string | null;
  status: string;
  labels_to_sync: string[];
  auto_tag_leads: boolean;
  auto_tag_orders: boolean;
  emails_synced: number;
  last_sync_at: string | null;
  created_at: string;
  labels_count: number;
}

const STATUS_COLOR: Record<string, string> = {
  connected: 'bg-green-100 text-green-700',
  disconnected: 'bg-gray-100 text-gray-600',
  error: 'bg-red-100 text-red-700',
};

const SEED_ACTIVITY = [
  { id: 1, event: 'Synced 12 emails', account: 'marketing@sohamyoga.com', ts: '2026-09-16 10:32', type: 'sync' },
  { id: 2, event: 'Tagged 3 leads from INBOX', account: 'marketing@sohamyoga.com', ts: '2026-09-16 10:32', type: 'tag' },
  { id: 3, event: 'Synced 8 emails', account: 'marketing@sohamyoga.com', ts: '2026-09-16 09:00', type: 'sync' },
  { id: 4, event: 'Tagged 1 order from SENT', account: 'marketing@sohamyoga.com', ts: '2026-09-16 09:00', type: 'tag' },
  { id: 5, event: 'Sync error — retried successfully', account: 'marketing@sohamyoga.com', ts: '2026-09-15 22:15', type: 'error' },
];

const ALL_LABELS = ['INBOX', 'SENT', 'IMPORTANT', 'CATEGORY_PROMOTIONS', 'CATEGORY_SOCIAL', 'STARRED', 'TRASH'];

const TABS = ['Accounts', 'Sync Rules', 'Activity Log'] as const;
type Tab = typeof TABS[number];

export default function GmailIntegrationPage() {
  const [tab, setTab] = useState<Tab>('Accounts');
  const [accounts, setAccounts] = useState<GmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [syncDir, setSyncDir] = useState<'one-way' | 'two-way'>('one-way');

  // Per-account toggle state (local)
  const [tagLeads, setTagLeads] = useState<Record<string, boolean>>({});
  const [tagOrders, setTagOrders] = useState<Record<string, boolean>>({});
  const [labelFilters, setLabelFilters] = useState<Record<string, string[]>>({});

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/gmail-integration', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Failed to load.'); return; }
      const accs: GmailAccount[] = data.accounts ?? [];
      setAccounts(accs);
      // Init local toggle state
      const leads: Record<string, boolean> = {};
      const orders: Record<string, boolean> = {};
      const labels: Record<string, string[]> = {};
      for (const a of accs) {
        leads[a.id] = a.auto_tag_leads;
        orders[a.id] = a.auto_tag_orders;
        labels[a.id] = a.labels_to_sync;
      }
      setTagLeads(leads);
      setTagOrders(orders);
      setLabelFilters(labels);
    } catch {
      setError('Network error.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  function toggleLabel(accountId: string, label: string) {
    setLabelFilters(prev => {
      const current = prev[accountId] ?? [];
      return {
        ...prev,
        [accountId]: current.includes(label)
          ? current.filter(l => l !== label)
          : [...current, label],
      };
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gmail Integration</h1>
          <p className="mt-1 text-sm text-gray-500">Connect Gmail accounts to auto-sync emails and tag leads, orders, and contacts.</p>
        </div>
        <button
          onClick={() => { window.location.href = '/api/auth/google?scope=gmail.readonly'; }}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          + Connect Gmail
        </button>
      </header>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
                tab === t ? 'border-red-500 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading…</p>}
      {error && <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {/* Tab: Accounts */}
      {tab === 'Accounts' && !loading && (
        <div className="space-y-4">
          {accounts.length === 0 && (
            <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-500">
              No Gmail accounts connected.{' '}
              <button
                onClick={() => { window.location.href = '/api/auth/google?scope=gmail.readonly'; }}
                className="text-red-600 underline"
              >
                Connect now
              </button>
            </div>
          )}
          {accounts.map(acc => (
            <div key={acc.id} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-xl">✉️</div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">{acc.connection_name ?? 'Gmail Account'}</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[acc.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {acc.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">{acc.account_email}</p>
                  </div>
                </div>
                <div className="text-right text-xs text-gray-500">
                  <p className="font-medium text-gray-800">{acc.emails_synced.toLocaleString()} emails synced</p>
                  <p>Last: {acc.last_sync_at ? new Date(acc.last_sync_at).toLocaleString() : 'Never'}</p>
                  <p>{acc.labels_count} labels active</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Sync Rules */}
      {tab === 'Sync Rules' && !loading && (
        <div className="space-y-6">
          {accounts.map(acc => (
            <div key={acc.id} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 font-semibold text-gray-900">{acc.account_email}</h3>

              <div className="mb-4">
                <p className="mb-2 text-sm font-medium text-gray-700">Label Filters</p>
                <div className="flex flex-wrap gap-2">
                  {ALL_LABELS.map(label => {
                    const active = (labelFilters[acc.id] ?? []).includes(label);
                    return (
                      <button
                        key={label}
                        onClick={() => toggleLabel(acc.id, label)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                          active ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mb-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Auto-tag as Leads</p>
                    <p className="text-xs text-gray-500">Emails matching lead patterns create lead records.</p>
                  </div>
                  <button
                    onClick={() => setTagLeads(prev => ({ ...prev, [acc.id]: !prev[acc.id] }))}
                    className={`relative h-6 w-11 rounded-full transition-colors ${tagLeads[acc.id] ? 'bg-red-500' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${tagLeads[acc.id] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Auto-tag as Orders</p>
                    <p className="text-xs text-gray-500">Order confirmation emails link to sales orders.</p>
                  </div>
                  <button
                    onClick={() => setTagOrders(prev => ({ ...prev, [acc.id]: !prev[acc.id] }))}
                    className={`relative h-6 w-11 rounded-full transition-colors ${tagOrders[acc.id] ? 'bg-red-500' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${tagOrders[acc.id] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {accounts.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <p className="mb-2 text-sm font-medium text-gray-700">Sync Direction</p>
              <div className="flex gap-4">
                {(['one-way', 'two-way'] as const).map(dir => (
                  <label key={dir} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="syncDir"
                      value={dir}
                      checked={syncDir === dir}
                      onChange={() => setSyncDir(dir)}
                      className="accent-red-600"
                    />
                    <span className="capitalize">{dir.replace('-', ' ')} sync</span>
                  </label>
                ))}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {syncDir === 'one-way'
                  ? 'Gmail → CRM only. No emails sent from this platform.'
                  : 'Emails sent from this platform are also tracked in Gmail.'}
              </p>

              <button className="mt-4 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
                Save Sync Rules
              </button>
            </div>
          )}

          {accounts.length === 0 && (
            <p className="text-sm text-gray-500">Connect a Gmail account first to configure sync rules.</p>
          )}
        </div>
      )}

      {/* Tab: Activity Log */}
      {tab === 'Activity Log' && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Event</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Account</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Time</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {SEED_ACTIVITY.map(row => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{row.event}</td>
                  <td className="px-4 py-3 text-gray-600">{row.account}</td>
                  <td className="px-4 py-3 text-gray-500">{row.ts}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      row.type === 'sync' ? 'bg-blue-100 text-blue-700'
                        : row.type === 'tag' ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                    }`}>
                      {row.type}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
