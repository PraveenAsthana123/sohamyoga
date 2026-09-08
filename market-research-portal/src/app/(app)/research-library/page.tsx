'use client';

// Real, admin-curated research resource library. Deliberately not seeded
// with any pre-written papers -- the source ChatGPT conversation's actual
// paper list came back permanently redacted (ChatGPT's own browsing tool
// output, unrecoverable), so this ships as real, empty infrastructure for a
// human to populate with real, verifiable citations, not invented ones.

import { useEffect, useState, useCallback } from 'react';

interface Resource {
  id: string; title: string; authors: string | null; source_url: string;
  publication_year: number | null; category: string; summary: string; status: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  market_research: 'Market Research', digital_marketing: 'Digital Marketing', ai_automation: 'AI & Automation',
};

export default function ResearchLibraryPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [form, setForm] = useState({ title: '', authors: '', sourceUrl: '', publicationYear: '', category: 'digital_marketing', summary: '' });
  const [msg, setMsg] = useState('');

  const load = useCallback(() => fetch('/api/research-library', { cache: 'no-store' }).then(r => r.json()).then(d => setResources(d.resources ?? [])), []);
  useEffect(() => { void load() }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch('/api/research-library', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, publicationYear: form.publicationYear ? Number(form.publicationYear) : undefined }),
    });
    const j = await r.json();
    setMsg(r.ok ? 'Added as draft.' : j.error);
    if (r.ok) setForm({ title: '', authors: '', sourceUrl: '', publicationYear: '', category: 'digital_marketing', summary: '' });
    await load();
  }
  async function setStatus(resourceId: string, action: string) {
    await fetch('/api/research-library', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resourceId, action }) });
    await load();
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold">Research Resource Library</h1>
        <p className="text-sm text-gray-500">A real, admin-curated library of research papers and resources. Add a real title and source link — this app never invents citations on your behalf.</p>
      </div>

      <form onSubmit={create} className="space-y-2 rounded-xl border bg-white p-5">
        <h2 className="font-semibold">Add a resource</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <input required placeholder="Title" className="rounded border p-2 text-sm" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          <input placeholder="Authors" className="rounded border p-2 text-sm" value={form.authors} onChange={e => setForm({ ...form, authors: e.target.value })} />
          <input required type="url" placeholder="Source URL" className="rounded border p-2 text-sm" value={form.sourceUrl} onChange={e => setForm({ ...form, sourceUrl: e.target.value })} />
          <input type="number" placeholder="Publication year" className="rounded border p-2 text-sm" value={form.publicationYear} onChange={e => setForm({ ...form, publicationYear: e.target.value })} />
          <select className="rounded border p-2 text-sm" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <textarea placeholder="Summary" className="w-full rounded border p-2 text-sm" value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} />
        <button className="rounded bg-brand-600 px-4 py-2 text-sm font-medium text-white">Add resource</button>
        {msg && <p className="text-sm text-gray-500">{msg}</p>}
      </form>

      <div className="space-y-2">
        {resources.map(r => (
          <div key={r.id} className="rounded-lg border bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{CATEGORY_LABELS[r.category]}</span>
                <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{r.status}</span>
                <h3 className="mt-1 font-semibold"><a href={r.source_url} target="_blank" rel="noreferrer" className="hover:underline">{r.title}</a></h3>
                {r.authors && <p className="text-xs text-gray-500">{r.authors}{r.publication_year ? ` · ${r.publication_year}` : ''}</p>}
                {r.summary && <p className="mt-1 text-sm text-gray-600">{r.summary}</p>}
              </div>
              <div className="flex shrink-0 gap-1">
                {r.status !== 'published' && <button onClick={() => setStatus(r.id, 'publish')} className="rounded bg-emerald-600 px-2 py-1 text-xs text-white">Publish</button>}
                {r.status !== 'archived' && <button onClick={() => setStatus(r.id, 'archive')} className="rounded bg-gray-500 px-2 py-1 text-xs text-white">Archive</button>}
              </div>
            </div>
          </div>
        ))}
        {!resources.length && <p className="text-sm text-gray-400">No resources yet — add one above.</p>}
      </div>
    </div>
  );
}
