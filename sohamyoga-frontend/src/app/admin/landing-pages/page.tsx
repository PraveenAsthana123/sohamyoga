'use client';
// Module 7 — Landing Page Management. Was "0 of 16": no LandingPage entity
// existed anywhere. Real slug-addressed pages, rendered live at /lp/[slug],
// with a linked CTA from the CTA registry and real publish/version history.

import { useEffect, useState, useCallback } from 'react';

interface CtaOption { id: string; label: string }
interface PageRow {
  id: string; slug: string; title: string; headline: string; status: string; viewCount: number;
  version: number; url: string; ctaLabel: string | null;
}

function NewPageForm({ ctas, onCreated }: { ctas: CtaOption[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState(''); const [title, setTitle] = useState(''); const [headline, setHeadline] = useState('');
  const [ctaId, setCtaId] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setBusy(true); setError(null);
    const res = await fetch('/api/landing-pages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, title, headline, ctaId: ctaId || undefined }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) { setOpen(false); setSlug(''); setTitle(''); setHeadline(''); onCreated(); }
    else setError(body.error ?? 'Failed to create page.');
  }

  if (!open) return <button onClick={() => setOpen(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">+ New Landing Page</button>;
  return (
    <div className="bg-white border rounded-lg p-4 space-y-2 w-full max-w-md">
      <input value={slug} onChange={e => setSlug(e.target.value)} placeholder="slug (used at /lp/slug)" className="w-full border rounded px-2 py-1.5 text-sm font-mono" />
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Internal title" className="w-full border rounded px-2 py-1.5 text-sm" />
      <input value={headline} onChange={e => setHeadline(e.target.value)} placeholder="Public headline" className="w-full border rounded px-2 py-1.5 text-sm" />
      <select value={ctaId} onChange={e => setCtaId(e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm">
        <option value="">No CTA</option>
        {ctas.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button onClick={handleCreate} disabled={busy || !slug || !title || !headline} className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm disabled:opacity-50">Create draft</button>
        <button onClick={() => setOpen(false)} className="px-3 py-1.5 text-sm text-gray-500">Cancel</button>
      </div>
    </div>
  );
}

export default function LandingPagesAdmin() {
  const [pages, setPages] = useState<PageRow[]>([]);
  const [ctas, setCtas] = useState<CtaOption[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/landing-pages', { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
      fetch('/api/ctas', { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
    ]).then(([p, c]) => { setPages(p?.pages ?? []); setCtas((c?.ctas ?? []).map((x: { id: string; label: string }) => ({ id: x.id, label: x.label }))); }).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function transition(id: string, action: 'publish' | 'archive') {
    await fetch(`/api/landing-pages/${id}/publish`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
    load();
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Landing Page Management</h1><p className="text-sm text-gray-500">Real pages, rendered live at /lp/&lt;slug&gt; — was completely unbuilt before.</p></div>
        <NewPageForm ctas={ctas} onCreated={load} />
      </div>
      {loading ? <p className="text-sm text-gray-400">Loading…</p> : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b"><tr className="text-left text-xs text-gray-500 uppercase">
              <th className="px-4 py-3">Page</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Views</th><th className="px-4 py-3">Version</th><th className="px-4 py-3">CTA</th><th className="px-4 py-3">Actions</th>
            </tr></thead>
            <tbody>
              {pages.map(p => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3"><p className="font-medium text-gray-800">{p.title}</p><a href={p.url} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline">{p.url}</a></td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${p.status === 'published' ? 'bg-green-100 text-green-700' : p.status === 'archived' ? 'bg-gray-100 text-gray-500' : 'bg-amber-100 text-amber-700'}`}>{p.status}</span></td>
                  <td className="px-4 py-3 text-gray-600">{p.viewCount}</td>
                  <td className="px-4 py-3 text-gray-600">v{p.version}</td>
                  <td className="px-4 py-3 text-gray-600">{p.ctaLabel ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {p.status !== 'published' && <button onClick={() => transition(p.id, 'publish')} className="text-xs text-green-600 hover:underline">Publish</button>}
                      {p.status !== 'archived' && <button onClick={() => transition(p.id, 'archive')} className="text-xs text-gray-400 hover:underline">Archive</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!pages.length && <p className="text-center text-sm text-gray-400 py-8">No landing pages yet — create one above.</p>}
        </div>
      )}
    </div>
  );
}
