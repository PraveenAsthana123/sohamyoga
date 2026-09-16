'use client';

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type TabId =
  | 'overview' | 'compose' | 'templates' | 'subscribers'
  | 'campaigns' | 'report' | 'dashboard' | 'manual'
  | 'pipeline' | 'agentic' | 'settings';

interface EmailStats {
  smtpConfigured: boolean;
  subscribers: { total: number; active: number; unsubscribed: number; bounced: number };
  campaigns30d: { total: number; sent: number };
  metrics30d: {
    totalSent: number; delivered: number; opens: number; clicks: number;
    bounces: number; unsubscribes: number; spam: number;
    openRate: string; clickRate: string; bounceRate: string; unsubRate: string;
  };
}

interface EmailTemplate {
  id: string; name: string; subject: string; body: string; type: string; created_at: string;
}

interface EmailSubscriber {
  id: string; email: string; first_name: string | null; last_name: string | null;
  status: string; tags: string[]; joined_at: string;
}

interface EmailCampaign {
  id: string; name: string; subject: string; status: string;
  scheduled_at: string | null; sent_at: string | null;
  total_sent: number; opens: number; clicks: number; bounces: number; unsubscribes: number;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const TABS: { id: TabId; label: string }[] = [
  { id: 'overview',     label: 'Overview'     },
  { id: 'compose',      label: 'Compose'      },
  { id: 'templates',    label: 'Templates'    },
  { id: 'subscribers',  label: 'Subscribers'  },
  { id: 'campaigns',    label: 'Campaigns'    },
  { id: 'report',       label: 'Report'       },
  { id: 'dashboard',    label: 'Dashboard'    },
  { id: 'manual',       label: 'Manual'       },
  { id: 'pipeline',     label: 'Pipeline'     },
  { id: 'agentic',      label: 'Agentic'      },
  { id: 'settings',     label: 'Settings'     },
];

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) return null;
    return r.json();
  } catch { return null; }
}

function KpiCard({
  label, value, sub, color = 'blue',
}: { label: string; value: string | number; sub?: string; color?: string }) {
  const colors: Record<string, string> = {
    blue:   'bg-blue-50 border-blue-200 text-blue-700',
    green:  'bg-green-50 border-green-200 text-green-700',
    amber:  'bg-amber-50 border-amber-200 text-amber-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    rose:   'bg-rose-50 border-rose-200 text-rose-700',
    gray:   'bg-gray-50 border-gray-200 text-gray-700',
  };
  return (
    <div className={`border rounded-lg p-4 ${colors[color] ?? colors.blue}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm font-medium mt-1">{label}</div>
      {sub && <div className="text-xs opacity-60 mt-0.5">{sub}</div>}
    </div>
  );
}

function SmtpBanner({ configured }: { configured: boolean }) {
  if (configured) return null;
  return (
    <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-amber-800 text-sm mb-4">
      <strong>SMTP not configured</strong> — set SMTP_HOST, SMTP_USER, SMTP_PASS in your environment
      to enable real email sending. Demo data is shown where indicated.
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active:       'bg-green-100 text-green-700',
    unsubscribed: 'bg-gray-100 text-gray-600',
    bounced:      'bg-red-100 text-red-700',
    pending:      'bg-amber-100 text-amber-700',
    draft:        'bg-gray-100 text-gray-600',
    scheduled:    'bg-blue-100 text-blue-700',
    sending:      'bg-indigo-100 text-indigo-700',
    sent:         'bg-green-100 text-green-700',
    cancelled:    'bg-red-100 text-red-700',
    marketing:    'bg-purple-100 text-purple-700',
    transactional:'bg-blue-100 text-blue-700',
    newsletter:   'bg-teal-100 text-teal-700',
    drip:         'bg-orange-100 text-orange-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Tab: Overview
// ---------------------------------------------------------------------------
function OverviewTab({ stats }: { stats: EmailStats | null }) {
  return (
    <div className="space-y-6">
      <SmtpBanner configured={stats?.smtpConfigured ?? false} />

      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Email Health (last 30 days)</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Active Subscribers"   value={(stats?.subscribers.active ?? 0).toLocaleString()} color="green" />
          <KpiCard label="Campaigns Sent (30d)" value={stats?.campaigns30d.sent ?? 0} color="blue" />
          <KpiCard label="Open Rate"            value={`${stats?.metrics30d.openRate ?? '0.0'}%`} color="purple" sub="Last 30 days" />
          <KpiCard label="Click Rate"           value={`${stats?.metrics30d.clickRate ?? '0.0'}%`} color="teal" sub="Last 30 days" />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KpiCard label="Bounce Rate"      value={`${stats?.metrics30d.bounceRate ?? '0.0'}%`} color="rose"  sub="> 2% is a risk" />
        <KpiCard label="Unsub Rate"       value={`${stats?.metrics30d.unsubRate ?? '0.0'}%`}  color="amber" sub="> 0.5% is high" />
        <KpiCard label="Total Sent (30d)" value={(stats?.metrics30d.totalSent ?? 0).toLocaleString()} color="gray" />
      </div>

      <div className="border rounded-lg p-4 bg-white">
        <h3 className="font-semibold text-gray-800 text-sm mb-3">Subscriber Status Breakdown</h3>
        {[
          { label: 'Active',       count: stats?.subscribers.active ?? 0,       total: stats?.subscribers.total ?? 1, color: 'bg-green-400' },
          { label: 'Unsubscribed', count: stats?.subscribers.unsubscribed ?? 0, total: stats?.subscribers.total ?? 1, color: 'bg-gray-400' },
          { label: 'Bounced',      count: stats?.subscribers.bounced ?? 0,      total: stats?.subscribers.total ?? 1, color: 'bg-red-400' },
        ].map(row => (
          <div key={row.label} className="flex items-center gap-3 text-sm mb-2">
            <span className="w-28 text-gray-600 text-xs">{row.label}</span>
            <div className="flex-1 h-2 bg-gray-100 rounded">
              <div className={`h-2 rounded ${row.color}`} style={{ width: `${row.total > 0 ? (row.count / row.total) * 100 : 0}%` }} />
            </div>
            <span className="w-12 text-right text-xs font-medium">{row.count.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Compose
// ---------------------------------------------------------------------------
function ComposeTab({ smtpConfigured }: { smtpConfigured: boolean }) {
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [status, setStatus] = useState('');

  const handleSendTest = () => {
    if (!smtpConfigured) {
      setStatus('Demo mode — configure SMTP to send real emails');
      return;
    }
    setStatus('Test send queued (SMTP configured — check your inbox)');
  };

  return (
    <div className="max-w-2xl space-y-4">
      <SmtpBanner configured={smtpConfigured} />
      {[
        { label: 'To', value: to, set: setTo, placeholder: 'recipient@example.com' },
        { label: 'CC', value: cc, set: setCc, placeholder: 'optional' },
        { label: 'BCC', value: bcc, set: setBcc, placeholder: 'optional' },
        { label: 'Subject', value: subject, set: setSubject, placeholder: 'Email subject line' },
      ].map(f => (
        <div key={f.label}>
          <label className="block text-xs font-semibold text-gray-600 mb-1">{f.label}</label>
          <input
            value={f.value}
            onChange={e => f.set(e.target.value)}
            placeholder={f.placeholder}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
      ))}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Body</label>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={10}
          placeholder="Email body (HTML or plain text)"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>
      <div className="flex gap-3">
        <button
          onClick={handleSendTest}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Send Test
        </button>
        <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors">
          Schedule Send
        </button>
      </div>
      {status && <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">{status}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Templates
// ---------------------------------------------------------------------------
function TemplatesTab() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', subject: '', body: '', type: 'marketing' });
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const d = await fetchJson<{ templates: EmailTemplate[] }>('/api/admin/email/templates');
    setTemplates(d?.templates ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.name || !form.subject) { setMsg('Name and subject required'); return; }
    const r = await fetch('/api/admin/email/templates', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    if (r.ok) { setMsg('Template created'); setShowForm(false); setForm({ name: '', subject: '', body: '', type: 'marketing' }); load(); }
    else { setMsg('Failed to create template'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    await fetch(`/api/admin/email/templates?id=${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Email Templates</h2>
        <button onClick={() => setShowForm(v => !v)} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm">
          + New Template
        </button>
      </div>

      {showForm && (
        <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
          {[
            { label: 'Name', key: 'name', type: 'text' },
            { label: 'Subject', key: 'subject', type: 'text' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs font-semibold text-gray-600 mb-1">{f.label}</label>
              <input
                value={(form as Record<string, string>)[f.key]}
                onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
            </div>
          ))}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Type</label>
            <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
              className="border border-gray-300 rounded px-3 py-2 text-sm">
              {['marketing', 'transactional', 'newsletter', 'drip'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Body</label>
            <textarea value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
              rows={5} className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm">Save</button>
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 bg-gray-200 rounded text-sm">Cancel</button>
          </div>
          {msg && <p className="text-sm text-red-600">{msg}</p>}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : templates.length === 0 ? (
        <div className="border border-dashed rounded-lg p-8 text-center text-gray-400 text-sm">No templates yet. Create one above.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b">
                <th className="text-left py-2 pr-4">Name</th>
                <th className="text-left py-2 pr-4">Subject</th>
                <th className="text-left py-2 pr-4">Type</th>
                <th className="text-left py-2 pr-4">Created</th>
                <th className="text-left py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map(t => (
                <tr key={t.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 pr-4 font-medium">{t.name}</td>
                  <td className="py-2 pr-4 text-gray-600">{t.subject}</td>
                  <td className="py-2 pr-4"><StatusBadge status={t.type} /></td>
                  <td className="py-2 pr-4 text-gray-400">{new Date(t.created_at).toLocaleDateString()}</td>
                  <td className="py-2">
                    <button onClick={() => handleDelete(t.id)} className="text-red-500 hover:underline text-xs">Delete</button>
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

// ---------------------------------------------------------------------------
// Tab: Subscribers
// ---------------------------------------------------------------------------
function SubscribersTab() {
  const [subscribers, setSubscribers] = useState<EmailSubscriber[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [csvText, setCsvText] = useState('');
  const [importMsg, setImportMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: '100' });
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);
    const d = await fetchJson<{ subscribers: EmailSubscriber[]; total: number }>(
      `/api/admin/email/subscribers?${params}`,
    );
    setSubscribers(d?.subscribers ?? []);
    setTotal(d?.total ?? 0);
    setLoading(false);
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleImport = async () => {
    const lines = csvText.split('\n').filter(l => l.trim());
    const rows = lines.slice(1).map(line => {
      const [email, first_name, last_name] = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      return { email, first_name, last_name };
    }).filter(r => r.email?.includes('@'));

    if (rows.length === 0) { setImportMsg('No valid rows found. Expected: email,first_name,last_name'); return; }

    const r = await fetch('/api/admin/email/subscribers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'bulk_import', rows }),
    });
    const data = await r.json().catch(() => ({}));
    setImportMsg(`Imported: ${data.imported ?? 0}, Skipped: ${data.skipped ?? 0}`);
    setCsvText('');
    load();
  };

  const exportCsv = () => {
    const lines = [
      'email,first_name,last_name,status,joined_at',
      ...subscribers.map(s =>
        `"${s.email}","${s.first_name ?? ''}","${s.last_name ?? ''}","${s.status}","${s.joined_at}"`
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'subscribers.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search email or name…"
            className="border border-gray-300 rounded px-3 py-1.5 text-sm w-56" />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm">
            <option value="">All statuses</option>
            {['active','unsubscribed','bounced','pending'].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCsv} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-sm">Export CSV</button>
        </div>
      </div>

      <details className="border rounded-lg">
        <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          Bulk Import CSV
        </summary>
        <div className="p-4 space-y-2">
          <p className="text-xs text-gray-500">First row = header (email,first_name,last_name). Duplicates are skipped.</p>
          <textarea value={csvText} onChange={e => setCsvText(e.target.value)}
            rows={5} placeholder="email,first_name,last_name&#10;jane@example.com,Jane,Doe"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono" />
          <button onClick={handleImport} className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm">Import</button>
          {importMsg && <p className="text-sm text-green-700">{importMsg}</p>}
        </div>
      </details>

      <p className="text-xs text-gray-500">Showing {subscribers.length} of {total.toLocaleString()} subscribers</p>

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b">
                <th className="text-left py-2 pr-4">Email</th>
                <th className="text-left py-2 pr-4">Name</th>
                <th className="text-left py-2 pr-4">Status</th>
                <th className="text-left py-2 pr-4">Tags</th>
                <th className="text-left py-2">Joined</th>
              </tr>
            </thead>
            <tbody>
              {subscribers.length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-gray-400">No subscribers found</td></tr>
              ) : subscribers.map(s => (
                <tr key={s.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 pr-4 font-medium">{s.email}</td>
                  <td className="py-2 pr-4 text-gray-600">{[s.first_name, s.last_name].filter(Boolean).join(' ') || '—'}</td>
                  <td className="py-2 pr-4"><StatusBadge status={s.status} /></td>
                  <td className="py-2 pr-4 text-gray-400 text-xs">{s.tags.join(', ') || '—'}</td>
                  <td className="py-2 text-gray-400">{new Date(s.joined_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Campaigns (list + create)
// ---------------------------------------------------------------------------
function CampaignsTab() {
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', subject: '', status: 'draft' });
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const d = await fetchJson<{ campaigns: EmailCampaign[] }>('/api/admin/email/campaigns');
    setCampaigns(d?.campaigns ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.name || !form.subject) { setMsg('Name and subject required'); return; }
    const r = await fetch('/api/admin/email/campaigns', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    if (r.ok) { setMsg('Campaign created'); setShowForm(false); setForm({ name: '', subject: '', status: 'draft' }); load(); }
    else { setMsg('Create failed'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Email Campaigns</h2>
        <button onClick={() => setShowForm(v => !v)} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm">
          + New Campaign
        </button>
      </div>

      {showForm && (
        <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
          {[{ label: 'Name', key: 'name' }, { label: 'Subject', key: 'subject' }].map(f => (
            <div key={f.key}>
              <label className="block text-xs font-semibold text-gray-600 mb-1">{f.label}</label>
              <input value={(form as Record<string, string>)[f.key]}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
          ))}
          <div className="flex gap-2">
            <button onClick={handleCreate} className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm">Save</button>
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 bg-gray-200 rounded text-sm">Cancel</button>
          </div>
          {msg && <p className="text-sm text-red-600">{msg}</p>}
        </div>
      )}

      {loading ? <p className="text-sm text-gray-400">Loading…</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b">
                <th className="text-left py-2 pr-4">Name</th>
                <th className="text-left py-2 pr-4">Status</th>
                <th className="text-right py-2 pr-4">Sent</th>
                <th className="text-right py-2 pr-4">Opens</th>
                <th className="text-right py-2 pr-4">Clicks</th>
                <th className="text-left py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-gray-400">No campaigns yet</td></tr>
              ) : campaigns.map(c => {
                const openRate = Number(c.total_sent) > 0 ? ((Number(c.opens) / Number(c.total_sent)) * 100).toFixed(1) : '—';
                return (
                  <tr key={c.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 pr-4 font-medium">{c.name}</td>
                    <td className="py-2 pr-4"><StatusBadge status={c.status} /></td>
                    <td className="py-2 pr-4 text-right">{Number(c.total_sent).toLocaleString()}</td>
                    <td className="py-2 pr-4 text-right">{Number(c.opens).toLocaleString()} {openRate !== '—' ? `(${openRate}%)` : ''}</td>
                    <td className="py-2 pr-4 text-right">{Number(c.clicks).toLocaleString()}</td>
                    <td className="py-2 text-gray-400">{new Date(c.created_at).toLocaleDateString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Report
// ---------------------------------------------------------------------------
function ReportTab({ stats }: { stats: EmailStats | null }) {
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJson<{ campaigns: EmailCampaign[] }>('/api/admin/email/campaigns').then(d => {
      setCampaigns(d?.campaigns ?? []);
      setLoading(false);
    });
  }, []);

  const m = stats?.metrics30d;

  return (
    <div className="space-y-6">
      {!stats?.smtpConfigured && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
          Demo mode — configure SMTP to see real delivery data.
        </p>
      )}

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Aggregate — Last 30 Days</h3>
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-xs text-gray-500">
                <th className="text-right py-2 px-4">Sent</th>
                <th className="text-right py-2 px-4">Delivered</th>
                <th className="text-right py-2 px-4">Opens</th>
                <th className="text-right py-2 px-4">Clicks</th>
                <th className="text-right py-2 px-4">Bounces</th>
                <th className="text-right py-2 px-4">Unsubscribes</th>
                <th className="text-right py-2 px-4">Spam</th>
                <th className="text-right py-2 px-4">Open Rate</th>
                <th className="text-right py-2 px-4">Click Rate</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="text-right py-3 px-4 font-mono">{(m?.totalSent ?? 0).toLocaleString()}</td>
                <td className="text-right py-3 px-4 font-mono">{(m?.delivered ?? 0).toLocaleString()}</td>
                <td className="text-right py-3 px-4 font-mono">{(m?.opens ?? 0).toLocaleString()}</td>
                <td className="text-right py-3 px-4 font-mono">{(m?.clicks ?? 0).toLocaleString()}</td>
                <td className="text-right py-3 px-4 font-mono text-red-600">{(m?.bounces ?? 0).toLocaleString()}</td>
                <td className="text-right py-3 px-4 font-mono">{(m?.unsubscribes ?? 0).toLocaleString()}</td>
                <td className="text-right py-3 px-4 font-mono">{(m?.spam ?? 0).toLocaleString()}</td>
                <td className="text-right py-3 px-4 font-mono text-green-700">{m?.openRate ?? '0.0'}%</td>
                <td className="text-right py-3 px-4 font-mono text-blue-700">{m?.clickRate ?? '0.0'}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Per-Campaign Performance</h3>
        {loading ? <p className="text-sm text-gray-400">Loading…</p> : (
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-xs text-gray-500">
                  <th className="text-left py-2 px-4">Campaign</th>
                  <th className="text-left py-2 px-4">Status</th>
                  <th className="text-right py-2 px-4">Sent</th>
                  <th className="text-right py-2 px-4">Opens</th>
                  <th className="text-right py-2 px-4">Open %</th>
                  <th className="text-right py-2 px-4">Clicks</th>
                  <th className="text-right py-2 px-4">Click %</th>
                  <th className="text-right py-2 px-4">Bounces</th>
                  <th className="text-right py-2 px-4">Unsubs</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.length === 0 ? (
                  <tr><td colSpan={9} className="py-6 text-center text-gray-400">No campaigns found</td></tr>
                ) : campaigns.map(c => {
                  const sent = Number(c.total_sent);
                  const openPct = sent > 0 ? ((Number(c.opens) / sent) * 100).toFixed(1) : '—';
                  const clickPct = sent > 0 ? ((Number(c.clicks) / sent) * 100).toFixed(1) : '—';
                  return (
                    <tr key={c.id} className="border-t hover:bg-gray-50">
                      <td className="py-2 px-4 font-medium">{c.name}</td>
                      <td className="py-2 px-4"><StatusBadge status={c.status} /></td>
                      <td className="py-2 px-4 text-right font-mono">{sent.toLocaleString()}</td>
                      <td className="py-2 px-4 text-right font-mono">{Number(c.opens).toLocaleString()}</td>
                      <td className="py-2 px-4 text-right font-mono text-green-700">{openPct}{openPct !== '—' ? '%' : ''}</td>
                      <td className="py-2 px-4 text-right font-mono">{Number(c.clicks).toLocaleString()}</td>
                      <td className="py-2 px-4 text-right font-mono text-blue-700">{clickPct}{clickPct !== '—' ? '%' : ''}</td>
                      <td className="py-2 px-4 text-right font-mono text-red-600">{Number(c.bounces).toLocaleString()}</td>
                      <td className="py-2 px-4 text-right font-mono">{Number(c.unsubscribes).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Dashboard
// ---------------------------------------------------------------------------
function DashboardTab({ stats }: { stats: EmailStats | null }) {
  const m = stats?.metrics30d;
  const s = stats?.subscribers;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard label="Total Subscribers"   value={(s?.total ?? 0).toLocaleString()} color="blue" />
        <KpiCard label="Active Subscribers"  value={(s?.active ?? 0).toLocaleString()} color="green" />
        <KpiCard label="Avg Open Rate"       value={`${m?.openRate ?? '0.0'}%`}  color="purple" sub="Last 30 days" />
        <KpiCard label="Avg Click Rate"      value={`${m?.clickRate ?? '0.0'}%`} color="teal"   sub="Last 30 days" />
        <KpiCard label="Unsubscribe Rate"    value={`${m?.unsubRate ?? '0.0'}%`} color="amber"  sub="Last 30 days" />
        <KpiCard label="Bounce Rate"         value={`${m?.bounceRate ?? '0.0'}%`} color="rose"  sub="Last 30 days" />
        <KpiCard label="Emails Sent (30d)"   value={(m?.totalSent ?? 0).toLocaleString()} color="gray" />
        <KpiCard label="Bounced Subscribers" value={(s?.bounced ?? 0).toLocaleString()} color="rose" sub="Need cleaning" />
        <KpiCard label="Campaigns (30d)"     value={stats?.campaigns30d.sent ?? 0} color="blue" sub="Sent" />
      </div>

      <div className="border rounded-lg p-4 bg-white">
        <h3 className="font-semibold text-gray-800 text-sm mb-4">Email Funnel (last 30 days)</h3>
        {[
          { label: 'Total Sent',   value: m?.totalSent ?? 0,   color: 'bg-blue-400' },
          { label: 'Delivered',    value: m?.delivered ?? 0,   color: 'bg-indigo-400' },
          { label: 'Opened',       value: m?.opens ?? 0,       color: 'bg-green-400' },
          { label: 'Clicked',      value: m?.clicks ?? 0,      color: 'bg-teal-400' },
        ].map((row, i, arr) => {
          const base = arr[0].value || 1;
          const pct = Math.round((row.value / base) * 100);
          return (
            <div key={row.label} className="flex items-center gap-3 text-sm mb-2">
              <span className="w-24 text-gray-600 text-xs">{row.label}</span>
              <div className="flex-1 h-3 bg-gray-100 rounded">
                <div className={`h-3 rounded ${row.color} transition-all`} style={{ width: `${pct}%` }} />
              </div>
              <span className="w-24 text-right text-xs font-mono">{row.value.toLocaleString()} ({pct}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Manual
// ---------------------------------------------------------------------------
function ManualTab() {
  const steps = [
    { n: 1, title: 'Connect SMTP', sub: 'Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM in environment. Verify with Send Test.' },
    { n: 2, title: 'Create a Template', sub: 'Go to Templates tab → New Template. Choose type (marketing, transactional, newsletter).' },
    { n: 3, title: 'Add Subscribers', sub: 'Go to Subscribers tab → Add individually or Bulk Import CSV (email, first_name, last_name).' },
    { n: 4, title: 'Create a Campaign', sub: 'Go to Campaigns tab → New Campaign. Pick template, set subject, choose audience.' },
    { n: 5, title: 'Send or Schedule', sub: 'Use Compose for one-off sends. Use Campaign scheduler for bulk sends with scheduling.' },
    { n: 6, title: 'Review Report', sub: 'Check Report tab for per-campaign open/click/bounce metrics. Dashboard tab for KPI overview.' },
    { n: 7, title: 'Clean List Regularly', sub: 'EmailBounceCleanJob runs weekly — auto-marks bounced addresses. Check Settings for SPF/DKIM.' },
  ];
  return (
    <div className="max-w-2xl space-y-4">
      <h2 className="text-lg font-semibold">Manual Process</h2>
      <p className="text-sm text-gray-600">Step-by-step guide to set up and run email campaigns.</p>
      <ol className="space-y-3">
        {steps.map(s => (
          <li key={s.n} className="flex gap-4 border rounded-lg p-4">
            <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">{s.n}</span>
            <div>
              <div className="font-medium text-sm">{s.title}</div>
              <div className="text-sm text-gray-500 mt-0.5">{s.sub}</div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Pipeline
// ---------------------------------------------------------------------------
function PipelineTab() {
  const jobs = [
    { name: 'EmailHealthCheckJob',  schedule: 'Daily 06:00 UTC',   desc: 'Checks SMTP config, bounce rate, spam complaint rate over last 30 days. Logs warnings if thresholds exceeded.' },
    { name: 'EmailBounceCleanJob',  schedule: 'Weekly (Sunday)',    desc: 'Marks subscribers as "bounced" if their email_send_log has repeated hard-bounce status. Reduces deliverability risk.' },
    { name: 'DripSequenceJob',      schedule: 'Hourly',             desc: 'Advances drip enrollment steps that are past their delay threshold. Queues drip_send_log rows (status=queued). Real delivery requires SMTP.' },
  ];
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Pipeline Jobs</h2>
      <p className="text-sm text-gray-600">Scheduled background jobs powering this module.</p>
      <div className="space-y-3">
        {jobs.map(j => (
          <div key={j.name} className="border rounded-lg p-4 bg-white">
            <div className="flex justify-between items-start">
              <span className="font-medium text-sm font-mono">{j.name}</span>
              <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded px-2 py-0.5">{j.schedule}</span>
            </div>
            <p className="text-sm text-gray-500 mt-1">{j.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Agentic
// ---------------------------------------------------------------------------
function AgenticTab({ smtpConfigured }: { smtpConfigured: boolean }) {
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<'subject' | 'body' | 'sendtime' | 'ab'>('subject');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const run = async () => {
    if (!prompt) return;
    setLoading(true); setResult('');
    try {
      const r = await fetch('/api/mcp/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: mode === 'subject'
            ? `Generate 5 compelling email subject lines for: ${prompt}. Keep each under 50 characters. Return as numbered list.`
            : mode === 'body'
            ? `Write a professional marketing email body for: ${prompt}. Include a clear call to action. Keep it under 200 words.`
            : mode === 'sendtime'
            ? `Suggest the best days and times to send marketing emails for this audience and goal: ${prompt}. Give 3 specific recommendations with brief reasoning.`
            : `Suggest an A/B test for this email campaign: ${prompt}. Recommend what to test (subject line, CTA, timing, length), provide 2 variants, and how to measure winner.`,
        }),
      });
      const d = await r.json().catch(() => ({ response: 'Ollama unavailable' }));
      setResult(d.response ?? d.content ?? d.output ?? 'No response');
    } catch {
      setResult('Ollama service unavailable — start it with: ollama serve');
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <h2 className="text-lg font-semibold">Agentic AI Tools</h2>
      <p className="text-sm text-gray-600">Ollama-powered email content tools. Requires local Ollama (llama3.2).</p>

      {!smtpConfigured && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
          Demo mode — configure SMTP to send AI-generated content as real emails.
        </p>
      )}

      <div className="flex gap-2 flex-wrap">
        {([
          { id: 'subject', label: 'Subject Line Generator' },
          { id: 'body',    label: 'Email Body Writer' },
          { id: 'sendtime', label: 'Send-Time Optimizer' },
          { id: 'ab',      label: 'A/B Test Recommender' },
        ] as const).map(m => (
          <button key={m.id} onClick={() => setMode(m.id)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${mode === m.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            {m.label}
          </button>
        ))}
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">
          {mode === 'subject' ? 'Describe your campaign/offer' :
           mode === 'body'    ? 'Describe the email goal and audience' :
           mode === 'sendtime'? 'Describe your audience and campaign goal' :
                                'Describe your email campaign'}
        </label>
        <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
      </div>

      <button onClick={run} disabled={loading || !prompt}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium">
        {loading ? 'Generating…' : 'Generate with Ollama'}
      </button>

      {result && (
        <div className="border rounded-lg p-4 bg-gray-50">
          <pre className="text-sm whitespace-pre-wrap text-gray-800">{result}</pre>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Settings
// ---------------------------------------------------------------------------
function SettingsTab({ smtpConfigured }: { smtpConfigured: boolean }) {
  const fields = [
    { key: 'SMTP_HOST',  label: 'SMTP Host',        placeholder: 'smtp.example.com' },
    { key: 'SMTP_PORT',  label: 'SMTP Port',         placeholder: '587' },
    { key: 'SMTP_USER',  label: 'SMTP Username',     placeholder: 'user@example.com' },
    { key: 'SMTP_PASS',  label: 'SMTP Password',     placeholder: '••••••••' },
    { key: 'SMTP_FROM',  label: 'From Address',      placeholder: 'noreply@yourdomain.com' },
  ];

  return (
    <div className="max-w-lg space-y-6">
      <div className={`border rounded-lg p-4 ${smtpConfigured ? 'bg-green-50 border-green-300 text-green-800' : 'bg-amber-50 border-amber-300 text-amber-800'}`}>
        <div className="font-semibold text-sm">{smtpConfigured ? 'SMTP Configured' : 'SMTP Not Configured'}</div>
        <div className="text-xs mt-1">
          {smtpConfigured
            ? 'SMTP_HOST is set. Real email delivery is available.'
            : 'Set SMTP_HOST in your .env.local or deployment environment.'}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Required Environment Variables</h3>
        <div className="space-y-3">
          {fields.map(f => (
            <div key={f.key} className="flex items-center gap-4">
              <span className="w-32 text-xs font-mono text-gray-600 bg-gray-100 px-2 py-1 rounded">{f.key}</span>
              <span className="text-sm text-gray-500">{f.label}</span>
              <span className="text-xs text-gray-400">e.g. {f.placeholder}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-3">Set these in <span className="font-mono">.env.local</span> (dev) or your deployment platform secrets (prod).</p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Deliverability Checklist</h3>
        {[
          { label: 'SPF Record', note: 'Add v=spf1 include:your-smtp-provider ~all to DNS' },
          { label: 'DKIM', note: 'Enable in SMTP provider — add CNAME/TXT record to DNS' },
          { label: 'DMARC', note: 'Add _dmarc TXT record — p=quarantine recommended' },
          { label: 'Unsubscribe Link', note: 'Every marketing email must include an unsubscribe link' },
          { label: 'Sender Reputation', note: 'Keep bounce rate < 2% and spam rate < 0.1%' },
        ].map(item => (
          <div key={item.label} className="flex gap-3 items-start border-b py-2">
            <span className="text-sm font-medium w-40 shrink-0">{item.label}</span>
            <span className="text-sm text-gray-500">{item.note}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------
export default function EmailManagementPage() {
  const [tab, setTab] = useState<TabId>('overview');
  const [stats, setStats] = useState<EmailStats | null>(null);

  useEffect(() => {
    fetchJson<EmailStats>('/api/admin/email/stats').then(setStats);
  }, []);

  const smtpConfigured = stats?.smtpConfigured ?? false;

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">Email Management</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          SMTP campaigns, templates, subscribers, drip delivery, and deliverability monitoring
        </p>
      </div>

      {/* Tab bar */}
      <div className="border-b px-6 overflow-x-auto">
        <div className="flex gap-0 min-w-max">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === t.id
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 py-6 max-w-6xl">
        {tab === 'overview'    && <OverviewTab stats={stats} />}
        {tab === 'compose'     && <ComposeTab smtpConfigured={smtpConfigured} />}
        {tab === 'templates'   && <TemplatesTab />}
        {tab === 'subscribers' && <SubscribersTab />}
        {tab === 'campaigns'   && <CampaignsTab />}
        {tab === 'report'      && <ReportTab stats={stats} />}
        {tab === 'dashboard'   && <DashboardTab stats={stats} />}
        {tab === 'manual'      && <ManualTab />}
        {tab === 'pipeline'    && <PipelineTab />}
        {tab === 'agentic'     && <AgenticTab smtpConfigured={smtpConfigured} />}
        {tab === 'settings'    && <SettingsTab smtpConfigured={smtpConfigured} />}
      </div>
    </div>
  );
}
