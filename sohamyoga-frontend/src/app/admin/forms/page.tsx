'use client';

import { useEffect, useState, useCallback } from 'react';

interface FieldDef { key: string; label: string; type: string; required: boolean }
interface FormRow {
  id: string; slug: string; name: string; fields: FieldDef[];
  consent_required: boolean; status: string; submission_count: number;
  created_by: string; created_at: string; updated_at: string; recent_submissions: string;
}
interface Submission {
  id: string; form_id: string; form_name: string; data: Record<string, string>;
  consent_given: boolean; lead_id: string | null; created_at: string;
}
interface Summary { total: number; active: number; submissions30d: number; conversionRate: number }

type Tab = 'overview' | 'forms' | 'submissions' | 'analytics';

const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-700',
  active: 'bg-green-100 text-green-700',
  archived: 'bg-gray-100 text-gray-500',
};
const FIELD_TYPES = ['text', 'email', 'phone', 'textarea', 'select', 'checkbox'];

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function CreateFormPanel({ onCreated }: { onCreated: () => void }) {
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [fields, setFields] = useState<FieldDef[]>([
    { key: 'name', label: 'Full Name', type: 'text', required: true },
    { key: 'email', label: 'Email', type: 'email', required: true },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function addField() {
    setFields(f => [...f, { key: '', label: '', type: 'text', required: false }]);
  }
  function removeField(i: number) {
    setFields(f => f.filter((_, j) => j !== i));
  }
  function updateField(i: number, patch: Partial<FieldDef>) {
    setFields(f => f.map((x, j) => j === i ? { ...x, ...patch } : x));
  }

  async function handleCreate() {
    setError(''); setSuccess('');
    if (!slug.trim() || !name.trim()) { setError('Slug and name are required.'); return; }
    setSaving(true);
    const res = await fetch('/api/admin/forms', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, name, fields }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setError(body.error ?? 'Failed to create form.'); return; }
    setSuccess(`Form "${name}" created as draft.`);
    setSlug(''); setName('');
    setFields([
      { key: 'name', label: 'Full Name', type: 'text', required: true },
      { key: 'email', label: 'Email', type: 'email', required: true },
    ]);
    onCreated();
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4 max-w-2xl">
      <h2 className="font-semibold text-gray-800">Create New Form</h2>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Slug * (URL-safe)</label>
          <input value={slug} onChange={e => setSlug(e.target.value)} placeholder="contact-form"
            className="w-full border rounded-lg px-3 py-2 text-sm font-mono" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Contact Form"
            className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-gray-600">Fields</label>
          <button onClick={addField} className="text-xs text-indigo-600 hover:underline">+ Add Field</button>
        </div>
        <div className="space-y-2">
          {fields.map((f, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input value={f.key} onChange={e => updateField(i, { key: e.target.value })}
                placeholder="key" className="w-24 border rounded px-2 py-1 text-xs font-mono" />
              <input value={f.label} onChange={e => updateField(i, { label: e.target.value })}
                placeholder="Label" className="flex-1 border rounded px-2 py-1 text-xs" />
              <select value={f.type} onChange={e => updateField(i, { type: e.target.value })}
                className="border rounded px-1 py-1 text-xs">
                {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <label className="flex items-center gap-1 text-xs text-gray-600">
                <input type="checkbox" checked={f.required} onChange={e => updateField(i, { required: e.target.checked })} />
                req
              </label>
              {fields.length > 1 && (
                <button onClick={() => removeField(i)} className="text-xs text-red-400 hover:underline">×</button>
              )}
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}
      <button onClick={handleCreate} disabled={saving}
        className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
        {saving ? 'Creating…' : 'Create Form (draft)'}
      </button>
    </div>
  );
}

export default function FormsAdminPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [forms, setForms] = useState<FormRow[]>([]);
  const [recentSubmissions, setRecentSubmissions] = useState<Submission[]>([]);
  const [summary, setSummary] = useState<Summary>({ total: 0, active: 0, submissions30d: 0, conversionRate: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [expandedSubs, setExpandedSubs] = useState<Submission[]>([]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/admin/forms', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setForms(d.forms ?? []);
      setRecentSubmissions(d.recentSubmissions ?? []);
      setSummary(d.summary ?? { total: 0, active: 0, submissions30d: 0, conversionRate: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load forms.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function toggleStatus(id: string, currentStatus: string) {
    const next = currentStatus === 'active' ? 'archived' : currentStatus === 'draft' ? 'active' : 'active';
    await fetch('/api/admin/forms', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: next }),
    });
    load();
  }

  async function viewSubmissions(id: string) {
    if (expanded === id) { setExpanded(null); return; }
    const res = await fetch(`/api/admin/forms?formId=${id}`, { cache: 'no-store' });
    const body = await res.json().catch(() => ({}));
    setExpandedSubs(body.submissions ?? []);
    setExpanded(id);
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'forms', label: `Forms (${forms.length})` },
    { key: 'submissions', label: `Submissions (${summary.submissions30d} / 30d)` },
    { key: 'analytics', label: 'Analytics' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Form Management</h1>
            <p className="text-sm text-gray-500 mt-0.5">Create and manage multi-field forms with consent capture and lead creation</p>
          </div>
          <button onClick={load} className="text-sm text-indigo-600 hover:underline">Refresh</button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-4">
          <KpiCard label="Total Forms" value={summary.total} />
          <KpiCard label="Active Forms" value={summary.active} />
          <KpiCard label="Submissions (30d)" value={summary.submissions30d.toLocaleString()} />
          <KpiCard label="Avg Submissions / Active Form" value={summary.conversionRate} sub="last 30 days" />
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex gap-1">
            {tabs.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
        {loading && <p className="text-sm text-gray-400">Loading forms…</p>}

        {!loading && tab === 'overview' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h2 className="font-semibold text-gray-800 mb-4">Recent Submissions</h2>
              {recentSubmissions.length > 0 ? (
                <div className="space-y-2">
                  {recentSubmissions.slice(0, 5).map(s => (
                    <div key={s.id} className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0">
                      <span className="text-xs text-gray-400 whitespace-nowrap">{new Date(s.created_at).toLocaleString()}</span>
                      <span className="text-xs bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded">{s.form_name}</span>
                      <span className="text-xs text-gray-600 truncate">{JSON.stringify(s.data)}</span>
                      {s.lead_id && <span className="text-xs bg-green-50 text-green-600 px-1.5 py-0.5 rounded whitespace-nowrap">lead created</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No submissions yet.</p>
              )}
            </div>
            <CreateFormPanel onCreated={load} />
          </div>
        )}

        {!loading && tab === 'forms' && (
          <div className="space-y-3">
            {forms.map(f => (
              <div key={f.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-gray-800">{f.name}</p>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">/{f.slug} · {f.fields?.length ?? 0} field(s)</p>
                    <p className="text-xs text-gray-400 mt-0.5">By {f.created_by} · {new Date(f.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[f.status] ?? 'bg-gray-100 text-gray-500'}`}>{f.status}</span>
                </div>
                <div className="flex gap-3 mt-3 items-center">
                  <button onClick={() => toggleStatus(f.id, f.status)} className="text-xs text-indigo-600 hover:underline">
                    {f.status === 'active' ? 'Archive' : 'Activate'}
                  </button>
                  <button onClick={() => viewSubmissions(f.id)} className="text-xs text-gray-500 hover:underline">
                    {f.submission_count} submission(s) {expanded === f.id ? '▲' : '▼'}
                  </button>
                  <span className="text-xs text-green-600">{f.recent_submissions} in last 30d</span>
                </div>
                {expanded === f.id && (
                  <div className="mt-3 border-t pt-3 space-y-1">
                    {expandedSubs.map(s => (
                      <div key={s.id} className="text-xs bg-gray-50 rounded px-3 py-2">
                        <span className="text-gray-400">{new Date(s.created_at).toLocaleString()}</span>
                        <span className="ml-2 text-gray-700">{JSON.stringify(s.data)}</span>
                        {s.lead_id && <span className="ml-2 text-green-600">→ lead</span>}
                      </div>
                    ))}
                    {!expandedSubs.length && <p className="text-xs text-gray-400">No submissions.</p>}
                  </div>
                )}
              </div>
            ))}
            {!forms.length && <p className="text-sm text-gray-400 text-center py-8">No forms yet.</p>}
          </div>
        )}

        {!loading && tab === 'submissions' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h2 className="font-semibold text-gray-800">Recent Submissions (last 20)</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {recentSubmissions.map(s => (
                <div key={s.id} className="px-6 py-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xs text-gray-400 whitespace-nowrap pt-0.5">{new Date(s.created_at).toLocaleString()}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-medium">{s.form_name}</span>
                        {s.consent_given && <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">consent given</span>}
                        {s.lead_id && <span className="text-xs bg-green-50 text-green-600 px-1.5 py-0.5 rounded">lead created</span>}
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {Object.entries(s.data ?? {}).map(([k, v]) => (
                          <span key={k} className="text-xs text-gray-600"><span className="text-gray-400">{k}:</span> {String(v)}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {!recentSubmissions.length && <p className="text-center text-sm text-gray-400 py-8">No submissions found.</p>}
            </div>
          </div>
        )}

        {!loading && tab === 'analytics' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h2 className="font-semibold text-gray-800 mb-4">Form Analytics</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr className="text-left text-xs text-gray-500 uppercase">
                      <th className="px-4 py-3">Form</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Total Submissions</th>
                      <th className="px-4 py-3">Last 30d</th>
                      <th className="px-4 py-3">Fields</th>
                      <th className="px-4 py-3">Consent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forms.map(f => (
                      <tr key={f.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800">{f.name}</p>
                          <p className="text-xs text-gray-400 font-mono">{f.slug}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[f.status] ?? 'bg-gray-100 text-gray-500'}`}>{f.status}</span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-800">{f.submission_count.toLocaleString()}</td>
                        <td className="px-4 py-3 text-green-700 font-medium">{f.recent_submissions}</td>
                        <td className="px-4 py-3 text-gray-600">{f.fields?.length ?? 0}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs ${f.consent_required ? 'text-green-600' : 'text-gray-400'}`}>
                            {f.consent_required ? 'Required' : 'Optional'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!forms.length && <p className="text-center text-sm text-gray-400 py-8">No forms yet.</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
