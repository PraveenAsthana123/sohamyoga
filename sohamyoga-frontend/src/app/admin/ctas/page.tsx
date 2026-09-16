'use client';

import { useEffect, useState, useCallback } from 'react';

interface CtaRow {
  id: string; label: string; type: string; destination_url: string; tracking_slug: string;
  placement: string; risk_classification: string; status: string; click_count: number;
  last_check_status: string; fallback_url: string | null; created_at: string; updated_at: string;
  clicks_30d: string;
}
interface Summary {
  total: number; active: number; clicks30d: number;
  topPerformer: { label: string; clicks: number } | null;
}

type Tab = 'overview' | 'active' | 'performance' | 'create';

const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600', active: 'bg-green-100 text-green-700',
  paused: 'bg-amber-100 text-amber-700', archived: 'bg-gray-200 text-gray-400',
};
const TYPES = ['form', 'booking', 'call', 'whatsapp', 'link', 'download', 'subscribe', 'share', 'custom'];
const PLACEMENTS = ['hero', 'footer', 'sidebar', 'inline', 'sticky', 'popup', 'email', 'other'];

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function CtaTable({ ctas, onRefresh }: { ctas: CtaRow[]; onRefresh: () => void }) {
  const [toggling, setToggling] = useState<string | null>(null);

  async function toggleStatus(id: string, currentStatus: string) {
    const next = currentStatus === 'active' ? 'paused' : currentStatus === 'draft' ? 'active' : 'active';
    setToggling(id);
    await fetch('/api/admin/ctas', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: next }),
    });
    setToggling(null);
    onRefresh();
  }

  async function archiveCta(id: string) {
    await fetch('/api/admin/ctas', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'archived' }),
    });
    onRefresh();
  }

  if (!ctas.length) return <p className="text-sm text-gray-400 py-8 text-center">No CTAs found.</p>;

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr className="text-left text-xs text-gray-500 uppercase">
            <th className="px-4 py-3">CTA</th>
            <th className="px-4 py-3">Type / Placement</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Clicks</th>
            <th className="px-4 py-3">30d Clicks</th>
            <th className="px-4 py-3">Risk</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {ctas.map(c => (
            <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
              <td className="px-4 py-3">
                <p className="font-medium text-gray-800">{c.label}</p>
                <p className="text-xs text-gray-400 font-mono">/go/{c.tracking_slug}</p>
                <p className="text-xs text-gray-300 truncate max-w-[180px]">{c.destination_url}</p>
              </td>
              <td className="px-4 py-3">
                <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{c.type}</span>
                <span className="ml-1 text-xs text-gray-500">{c.placement}</span>
              </td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[c.status] ?? 'bg-gray-100 text-gray-600'}`}>{c.status}</span>
              </td>
              <td className="px-4 py-3 font-semibold text-gray-800">{c.click_count.toLocaleString()}</td>
              <td className="px-4 py-3 text-gray-600">{Number(c.clicks_30d).toLocaleString()}</td>
              <td className="px-4 py-3">
                <span className={`text-xs px-1.5 py-0.5 rounded ${c.risk_classification === 'high' ? 'bg-red-100 text-red-600' : c.risk_classification === 'medium' ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>
                  {c.risk_classification}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-2 flex-wrap">
                  {c.status !== 'archived' && (
                    <button onClick={() => toggleStatus(c.id, c.status)} disabled={toggling === c.id}
                      className="text-xs text-indigo-600 hover:underline disabled:opacity-50">
                      {c.status === 'active' ? 'Pause' : 'Activate'}
                    </button>
                  )}
                  {c.status !== 'archived' && (
                    <button onClick={() => archiveCta(c.id)} className="text-xs text-gray-400 hover:underline">Archive</button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CreateCtaForm({ onCreated }: { onCreated: () => void }) {
  const [label, setLabel] = useState('');
  const [type, setType] = useState('link');
  const [destinationUrl, setDestinationUrl] = useState('');
  const [trackingSlug, setTrackingSlug] = useState('');
  const [placement, setPlacement] = useState('other');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleCreate() {
    setError(''); setSuccess('');
    if (!label.trim() || !destinationUrl.trim() || !trackingSlug.trim()) {
      setError('Label, Destination URL, and Tracking Slug are required.'); return;
    }
    setSaving(true);
    const res = await fetch('/api/admin/ctas', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, type, destinationUrl, trackingSlug, placement }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setError(body.error ?? 'Failed to create CTA.'); return; }
    setSuccess(`CTA "${label}" created successfully.`);
    setLabel(''); setDestinationUrl(''); setTrackingSlug('');
    onCreated();
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4 max-w-2xl">
      <h2 className="font-semibold text-gray-800">Create New CTA</h2>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Label *</label>
        <input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Book a Class"
          className="w-full border rounded-lg px-3 py-2 text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
          <select value={type} onChange={e => setType(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Placement</label>
          <select value={placement} onChange={e => setPlacement(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
            {PLACEMENTS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Destination URL *</label>
        <input value={destinationUrl} onChange={e => setDestinationUrl(e.target.value)} placeholder="https://example.com/book"
          className="w-full border rounded-lg px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Tracking Slug * (used in /go/slug)</label>
        <input value={trackingSlug} onChange={e => setTrackingSlug(e.target.value)} placeholder="book-class-hero"
          className="w-full border rounded-lg px-3 py-2 text-sm font-mono" />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}
      <button onClick={handleCreate} disabled={saving}
        className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
        {saving ? 'Creating…' : 'Create CTA'}
      </button>
    </div>
  );
}

export default function CtasPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [ctas, setCtas] = useState<CtaRow[]>([]);
  const [summary, setSummary] = useState<Summary>({ total: 0, active: 0, clicks30d: 0, topPerformer: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/admin/ctas', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setCtas(d.ctas ?? []);
      setSummary(d.summary ?? { total: 0, active: 0, clicks30d: 0, topPerformer: null });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load CTAs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const activeCtas = ctas.filter(c => c.status === 'active');
  const topByClicks = [...ctas].sort((a, b) => Number(b.clicks_30d) - Number(a.clicks_30d)).slice(0, 10);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'active', label: `Active CTAs (${activeCtas.length})` },
    { key: 'performance', label: 'Performance' },
    { key: 'create', label: 'Create' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">CTA Management</h1>
            <p className="text-sm text-gray-500 mt-0.5">Call-to-action registry with click tracking via <code className="bg-gray-100 rounded px-1">/go/slug</code></p>
          </div>
          <button onClick={load} className="text-sm text-indigo-600 hover:underline">Refresh</button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-4">
          <KpiCard label="Total CTAs" value={summary.total} />
          <KpiCard label="Active" value={summary.active} />
          <KpiCard label="Clicks (30d)" value={summary.clicks30d.toLocaleString()} />
          <KpiCard label="Top Performer"
            value={summary.topPerformer?.label ?? '—'}
            sub={summary.topPerformer ? `${summary.topPerformer.clicks.toLocaleString()} total clicks` : undefined} />
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
        {loading && <p className="text-sm text-gray-400">Loading CTAs…</p>}

        {!loading && tab === 'overview' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h2 className="font-semibold text-gray-800 mb-4">All CTAs</h2>
              <CtaTable ctas={ctas.slice(0, 10)} onRefresh={load} />
            </div>
          </div>
        )}

        {!loading && tab === 'active' && (
          <CtaTable ctas={activeCtas} onRefresh={load} />
        )}

        {!loading && tab === 'performance' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 className="font-semibold text-gray-800 mb-4">Top CTAs by 30-Day Clicks</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr className="text-left text-xs text-gray-500 uppercase">
                    <th className="px-4 py-3">Rank</th>
                    <th className="px-4 py-3">CTA</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">30d Clicks</th>
                    <th className="px-4 py-3">Total Clicks</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {topByClicks.map((c, i) => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="px-4 py-3 text-gray-500 font-bold">#{i + 1}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{c.label}</p>
                        <p className="text-xs text-gray-400 font-mono">/go/{c.tracking_slug}</p>
                      </td>
                      <td className="px-4 py-3 text-indigo-600 text-xs">{c.type}</td>
                      <td className="px-4 py-3 font-bold text-green-700">{Number(c.clicks_30d).toLocaleString()}</td>
                      <td className="px-4 py-3 text-gray-600">{c.click_count.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[c.status] ?? 'bg-gray-100 text-gray-600'}`}>{c.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!topByClicks.length && <p className="text-center text-sm text-gray-400 py-8">No CTAs found.</p>}
            </div>
          </div>
        )}

        {!loading && tab === 'create' && (
          <CreateCtaForm onCreated={load} />
        )}
      </div>
    </div>
  );
}
