'use client';

import { useEffect, useState, useCallback } from 'react';

interface Segment {
  id: string; name: string; description: string; criteria: unknown;
  logic: string; estimated_size: number; last_computed_at: string | null;
  is_dynamic: boolean; created_by_id: string; created_at: string;
}
interface Summary { total: number; active: number; newThisMonth: number }

type Tab = 'overview' | 'all' | 'active' | 'create';

const LOGIC_OPTIONS = ['AND', 'OR'];

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function SegmentTable({ segments, onRefresh }: { segments: Segment[]; onRefresh: () => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [saving, setSaving] = useState(false);

  async function saveEdit(id: string) {
    setSaving(true);
    await fetch('/api/admin/segments', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name: editName, description: editDesc }),
    });
    setSaving(false);
    setEditing(null);
    onRefresh();
  }

  if (!segments.length) return <p className="text-sm text-gray-400 py-8 text-center">No segments found.</p>;

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr className="text-left text-xs text-gray-500 uppercase">
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Logic</th>
            <th className="px-4 py-3">Est. Size</th>
            <th className="px-4 py-3">Dynamic</th>
            <th className="px-4 py-3">Last Computed</th>
            <th className="px-4 py-3">Created</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {segments.map(s => (
            <tr key={s.id} className="border-b last:border-0 hover:bg-gray-50">
              <td className="px-4 py-3">
                {editing === s.id ? (
                  <div className="space-y-1">
                    <input value={editName} onChange={e => setEditName(e.target.value)}
                      className="w-full border rounded px-2 py-1 text-sm" />
                    <input value={editDesc} onChange={e => setEditDesc(e.target.value)}
                      className="w-full border rounded px-2 py-1 text-xs text-gray-500" placeholder="Description" />
                  </div>
                ) : (
                  <div>
                    <p className="font-medium text-gray-800">{s.name}</p>
                    {s.description && <p className="text-xs text-gray-400">{s.description}</p>}
                  </div>
                )}
              </td>
              <td className="px-4 py-3">
                <span className="rounded-full bg-indigo-50 text-indigo-600 px-2 py-0.5 text-xs font-medium">{s.logic}</span>
              </td>
              <td className="px-4 py-3 font-semibold text-gray-800">{s.estimated_size.toLocaleString()}</td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.is_dynamic ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {s.is_dynamic ? 'Dynamic' : 'Static'}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-500 text-xs">
                {s.last_computed_at ? new Date(s.last_computed_at).toLocaleString() : '—'}
              </td>
              <td className="px-4 py-3 text-gray-400 text-xs">{new Date(s.created_at).toLocaleDateString()}</td>
              <td className="px-4 py-3">
                {editing === s.id ? (
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(s.id)} disabled={saving} className="text-xs text-green-600 hover:underline disabled:opacity-50">Save</button>
                    <button onClick={() => setEditing(null)} className="text-xs text-gray-400 hover:underline">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => { setEditing(s.id); setEditName(s.name); setEditDesc(s.description); }}
                    className="text-xs text-indigo-600 hover:underline">Edit</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CreateSegmentForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [logic, setLogic] = useState('AND');
  const [criteriaJson, setCriteriaJson] = useState('{\n  "field": "last_active_days",\n  "operator": "lte",\n  "value": 30\n}');
  const [isDynamic, setIsDynamic] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');

  async function handleCreate() {
    setError(''); setSuccess('');
    if (!name.trim()) { setError('Name is required.'); return; }
    let criteria: unknown;
    try { criteria = JSON.parse(criteriaJson); } catch { setError('Criteria must be valid JSON.'); return; }
    setSaving(true);
    const res = await fetch('/api/admin/segments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, criteria, logic, isDynamic }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setError(body.error ?? 'Failed to create segment.'); return; }
    setSuccess(`Segment "${name}" created.`);
    setName(''); setDescription(''); setCriteriaJson('{\n  "field": "last_active_days",\n  "operator": "lte",\n  "value": 30\n}');
    onCreated();
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4 max-w-2xl">
      <h2 className="font-semibold text-gray-800">Create Audience Segment</h2>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Active Last 30 Days"
            className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Logic</label>
          <select value={logic} onChange={e => setLogic(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
            {LOGIC_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
        <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description"
          className="w-full border rounded-lg px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Criteria (JSON)</label>
        <textarea value={criteriaJson} onChange={e => setCriteriaJson(e.target.value)} rows={6}
          className="w-full border rounded-lg px-3 py-2 text-sm font-mono" />
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={isDynamic} onChange={e => setIsDynamic(e.target.checked)} />
        Dynamic segment (auto-recomputes)
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}
      <button onClick={handleCreate} disabled={saving}
        className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
        {saving ? 'Creating…' : 'Create Segment'}
      </button>
    </div>
  );
}

export default function SegmentsPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [segments, setSegments] = useState<Segment[]>([]);
  const [summary, setSummary] = useState<Summary>({ total: 0, active: 0, newThisMonth: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/admin/segments', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setSegments(d.segments ?? []);
      setSummary(d.summary ?? { total: 0, active: 0, newThisMonth: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load segments.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const activeSegments = segments.filter(s => s.is_dynamic);
  const visibleSegments = tab === 'active' ? activeSegments : segments;
  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'all', label: `All Segments (${segments.length})` },
    { key: 'active', label: `Active (${activeSegments.length})` },
    { key: 'create', label: 'Create' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Audience Segments</h1>
            <p className="text-sm text-gray-500 mt-0.5">Define and manage customer audience segments for targeting</p>
          </div>
          <button onClick={load} className="text-sm text-indigo-600 hover:underline">Refresh</button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-3 gap-4">
          <KpiCard label="Total Segments" value={summary.total} />
          <KpiCard label="Dynamic (Active)" value={summary.active} />
          <KpiCard label="New This Month" value={summary.newThisMonth} />
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
        {loading && <p className="text-sm text-gray-400">Loading segments…</p>}

        {!loading && tab === 'overview' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h2 className="font-semibold text-gray-800 mb-4">Segment Overview</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">{summary.total}</p>
                  <p className="text-xs text-gray-500 mt-1">Total Segments</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-green-700">{summary.active}</p>
                  <p className="text-xs text-gray-500 mt-1">Dynamic</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">{summary.total - summary.active}</p>
                  <p className="text-xs text-gray-500 mt-1">Static</p>
                </div>
                <div className="bg-indigo-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-indigo-700">{summary.newThisMonth}</p>
                  <p className="text-xs text-gray-500 mt-1">New This Month</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h2 className="font-semibold text-gray-800 mb-3">Recent Segments</h2>
              <SegmentTable segments={segments.slice(0, 5)} onRefresh={load} />
            </div>
          </div>
        )}

        {!loading && (tab === 'all' || tab === 'active') && (
          <SegmentTable segments={visibleSegments} onRefresh={load} />
        )}

        {!loading && tab === 'create' && (
          <CreateSegmentForm onCreated={load} />
        )}
      </div>
    </div>
  );
}
