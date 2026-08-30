'use client';
// Module 9 — CTA Management. Was "1 of 13" real: a CTA existed only as a
// label+url field on Banner. This is the real central registry + redirect
// service (/go/[slug]) + destination-health monitoring.

import { useEffect, useState, useCallback } from 'react';

interface CtaRow {
  id: string; label: string; type: string; destinationUrl: string; trackingSlug: string; goUrl: string;
  placement: string; risk: string; status: string; clickCount: number; lastCheckStatus: string;
  fallbackUrl: string | null; createdAt: string;
}

const TYPES = ['form', 'booking', 'call', 'whatsapp', 'link', 'download', 'subscribe', 'share', 'custom'];
const PLACEMENTS = ['hero', 'footer', 'sidebar', 'inline', 'sticky', 'popup', 'email', 'other'];

function Badge({ label, color }: { label: string; color: string }) {
  return <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${color}`}>{label}</span>;
}
const STATUS_COLOR: Record<string, string> = { draft: 'bg-gray-100 text-gray-600', active: 'bg-green-100 text-green-700', paused: 'bg-amber-100 text-amber-700', archived: 'bg-gray-100 text-gray-400' };
const CHECK_COLOR: Record<string, string> = { ok: 'bg-green-100 text-green-700', broken: 'bg-red-100 text-red-700', unknown: 'bg-gray-100 text-gray-500' };

function NewCtaForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(''); const [type, setType] = useState('link');
  const [destinationUrl, setDestinationUrl] = useState(''); const [trackingSlug, setTrackingSlug] = useState('');
  const [placement, setPlacement] = useState('other'); const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setBusy(true); setError(null);
    const res = await fetch('/api/ctas', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, type, destinationUrl, trackingSlug, placement }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      setOpen(false); setLabel(''); setDestinationUrl(''); setTrackingSlug('');
      onCreated();
      if (body.lastCheckStatus === 'broken') alert('CTA created, but its destination URL failed a live health check — it cannot be activated until fixed or a fallback URL is set.');
    } else setError(body.error ?? 'Failed to create CTA.');
  }

  if (!open) return <button onClick={() => setOpen(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">+ New CTA</button>;
  return (
    <div className="bg-white border rounded-lg p-4 space-y-2 w-full max-w-md">
      <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Label (e.g. Book Now)" className="w-full border rounded px-2 py-1.5 text-sm" />
      <select value={type} onChange={e => setType(e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm">{TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select>
      <input value={destinationUrl} onChange={e => setDestinationUrl(e.target.value)} placeholder="https://destination.example.com" className="w-full border rounded px-2 py-1.5 text-sm" />
      <input value={trackingSlug} onChange={e => setTrackingSlug(e.target.value)} placeholder="tracking-slug (used in /go/slug)" className="w-full border rounded px-2 py-1.5 text-sm font-mono" />
      <select value={placement} onChange={e => setPlacement(e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm">{PLACEMENTS.map(p => <option key={p} value={p}>{p}</option>)}</select>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button onClick={handleCreate} disabled={busy || !label || !destinationUrl || !trackingSlug} className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm disabled:opacity-50">{busy ? 'Checking destination…' : 'Create (runs a live health check)'}</button>
        <button onClick={() => setOpen(false)} className="px-3 py-1.5 text-sm text-gray-500">Cancel</button>
      </div>
    </div>
  );
}

export default function CtasPage() {
  const [ctas, setCtas] = useState<CtaRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/ctas', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => setCtas(d?.ctas ?? [])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function transition(id: string, action: string) {
    await fetch(`/api/ctas/${id}/transition`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
    load();
  }
  async function recheck(id: string) {
    await fetch(`/api/ctas/${id}/check`, { method: 'POST' });
    load();
  }

  const brokenCount = ctas.filter(c => c.lastCheckStatus === 'broken').length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CTA Management</h1>
          <p className="text-sm text-gray-500">Central action registry. Every CTA gets a real tracked redirect at <code className="rounded bg-gray-100 px-1">/go/&lt;slug&gt;</code>.</p>
        </div>
        <NewCtaForm onCreated={load} />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border rounded-lg p-4 text-center"><div className="text-2xl font-bold text-gray-800">{ctas.length}</div><div className="text-xs text-gray-500">Total CTAs</div></div>
        <div className="bg-white border rounded-lg p-4 text-center"><div className="text-2xl font-bold text-green-600">{ctas.reduce((s, c) => s + c.clickCount, 0)}</div><div className="text-xs text-gray-500">Total clicks</div></div>
        <div className="bg-white border rounded-lg p-4 text-center"><div className={`text-2xl font-bold ${brokenCount > 0 ? 'text-red-600' : 'text-gray-800'}`}>{brokenCount}</div><div className="text-xs text-gray-500">Broken destinations</div></div>
      </div>

      {loading ? <p className="text-sm text-gray-400">Loading…</p> : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b"><tr className="text-left text-xs text-gray-500 uppercase">
              <th className="px-4 py-3">CTA</th><th className="px-4 py-3">Placement</th><th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Destination check</th><th className="px-4 py-3">Clicks</th><th className="px-4 py-3">Actions</th>
            </tr></thead>
            <tbody>
              {ctas.map(c => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{c.label}</p>
                    <p className="text-xs text-gray-400 font-mono">{c.type} · <a href={c.goUrl} className="text-indigo-600 hover:underline" target="_blank" rel="noreferrer">{c.goUrl}</a></p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.placement}</td>
                  <td className="px-4 py-3"><Badge label={c.status} color={STATUS_COLOR[c.status]} /></td>
                  <td className="px-4 py-3"><Badge label={c.lastCheckStatus} color={CHECK_COLOR[c.lastCheckStatus]} /></td>
                  <td className="px-4 py-3 text-gray-700 font-medium">{c.clickCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 flex-wrap">
                      <button onClick={() => recheck(c.id)} className="text-xs text-blue-600 hover:underline">Re-check</button>
                      {c.status !== 'active' && c.status !== 'archived' && <button onClick={() => transition(c.id, 'activate')} className="text-xs text-green-600 hover:underline">Activate</button>}
                      {c.status === 'active' && <button onClick={() => transition(c.id, 'pause')} className="text-xs text-amber-600 hover:underline">Pause</button>}
                      {c.status !== 'archived' && <button onClick={() => transition(c.id, 'archive')} className="text-xs text-gray-400 hover:underline">Archive</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!ctas.length && <p className="text-center text-sm text-gray-400 py-8">No CTAs yet — create one above.</p>}
        </div>
      )}
    </div>
  );
}
