'use client';

import { useEffect, useState, useCallback } from 'react';

interface VectorDocument {
  id: number;
  title: string;
  source_type: string;
  source_ref: string | null;
  content_preview: string | null;
  chunk_count: number;
  embedding_model: string;
  embedding_status: string;
  vector_collection: string;
  last_indexed_at: string | null;
  created_at: string;
}

interface VectorStats {
  total_docs: number;
  completed: number;
  pending: number;
  failed: number;
  processing: number;
  collections: string[];
  ollama_embed_available: boolean;
}

const glass = 'bg-slate-800/70 border border-white/20 rounded-2xl p-6 shadow-xl';
const tabBase = 'px-4 py-2 rounded-lg text-sm font-medium transition-colors';
const tabActive = 'bg-white/20 text-white';
const tabInactive = 'text-white/60 hover:bg-white/10';

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-500/30 text-green-200',
  pending: 'bg-amber-500/30 text-amber-200',
  processing: 'bg-blue-500/30 text-blue-200',
  failed: 'bg-red-500/30 text-red-200',
  outdated: 'bg-orange-500/30 text-orange-200',
};

type Tab = 'overview' | 'documents' | 'add' | 'collections' | 'ollama';

export default function VectorDbPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [docs, setDocs] = useState<VectorDocument[]>([]);
  const [stats, setStats] = useState<VectorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [form, setForm] = useState({
    title: '', source_type: 'manual', source_ref: '', content_preview: '',
    vector_collection: 'default', embedding_model: 'nomic-embed-text',
  });

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const [docsRes, statsRes] = await Promise.all([
        fetch('/api/admin/vector-db').then((r) => r.json() as Promise<{ documents: VectorDocument[] }>),
        fetch('/api/admin/vector-db/stats').then((r) => r.json() as Promise<VectorStats>),
      ]);
      setDocs(docsRes.documents || []);
      setStats(statsRes);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const reindex = async (id: number) => {
    await fetch('/api/admin/vector-db', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, embedding_status: 'processing' }),
    });
    showToast('Re-index queued');
    loadDocs();
  };

  const deleteDoc = async (id: number) => {
    if (!confirm('Delete this document?')) return;
    await fetch(`/api/admin/vector-db?id=${id}`, { method: 'DELETE' });
    showToast('Deleted');
    loadDocs();
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/vector-db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) { showToast('Document added to queue'); setTab('documents'); loadDocs(); }
    else showToast('Error adding document');
  };

  const collectionGroups = docs.reduce<Record<string, VectorDocument[]>>((acc, d) => {
    acc[d.vector_collection] = [...(acc[d.vector_collection] || []), d];
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 p-6">
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-xl bg-white/20 px-4 py-2 text-white  shadow-xl">{toast}</div>
      )}
      <h1 className="mb-6 text-3xl font-bold text-white">Vector DB Management 🧠</h1>

      <div className="mb-6 flex gap-2 flex-wrap">
        {(['overview','documents','add','collections','ollama'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`${tabBase} ${tab === t ? tabActive : tabInactive}`}>
            {t === 'overview' ? 'Overview' : t === 'documents' ? 'Documents' : t === 'add' ? 'Add Document' : t === 'collections' ? 'Collections' : 'Ollama Integration'}
          </button>
        ))}
      </div>

      {tab === 'overview' && stats && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Total Documents', value: stats.total_docs, color: 'text-white' },
              { label: 'Indexed', value: stats.completed, color: 'text-green-300' },
              { label: 'Pending', value: stats.pending, color: 'text-amber-300' },
              { label: 'Failed', value: stats.failed, color: 'text-red-300' },
            ].map(({ label, value, color }) => (
              <div key={label} className={glass}>
                <p className="text-xs text-white/60 uppercase tracking-wide">{label}</p>
                <p className={`text-3xl font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>
          <div className={glass}>
            <h3 className="mb-3 text-lg font-semibold text-white">Ollama Embedding Status</h3>
            <span className={`rounded-full px-3 py-1 text-sm font-semibold ${stats.ollama_embed_available ? 'bg-green-500/30 text-green-200' : 'bg-red-500/30 text-red-200'}`}>
              {stats.ollama_embed_available ? '● Available' : '● Unavailable'}
            </span>
            <h3 className="mt-4 mb-2 text-lg font-semibold text-white">Collections</h3>
            <div className="flex flex-wrap gap-2">
              {stats.collections.map((c) => (
                <span key={c} className="rounded-full bg-indigo-500/30 border border-indigo-400/30 px-3 py-1 text-sm text-indigo-200">{c}</span>
              ))}
              {!stats.collections.length && <span className="text-white/40 text-sm">No collections yet</span>}
            </div>
          </div>
        </div>
      )}

      {tab === 'documents' && (
        <div className={glass}>
          <h2 className="mb-4 text-xl font-semibold text-white">Documents ({docs.length})</h2>
          {loading ? <p className="text-white/60">Loading…</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-white/80">
                <thead><tr className="border-b border-white/20 text-white/60">
                  <th className="pb-2 text-left">Title</th>
                  <th className="pb-2 text-left">Source</th>
                  <th className="pb-2 text-left">Chunks</th>
                  <th className="pb-2 text-left">Model</th>
                  <th className="pb-2 text-left">Status</th>
                  <th className="pb-2 text-left">Last Indexed</th>
                  <th className="pb-2 text-left">Actions</th>
                </tr></thead>
                <tbody>
                  {docs.map((d) => (
                    <tr key={d.id} className="border-b border-white/10">
                      <td className="py-2 font-medium text-white">{d.title}</td>
                      <td className="py-2">{d.source_type}</td>
                      <td className="py-2">{d.chunk_count}</td>
                      <td className="py-2 text-xs font-mono">{d.embedding_model}</td>
                      <td className="py-2"><span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[d.embedding_status] || 'bg-white/20 text-white'}`}>{d.embedding_status}</span></td>
                      <td className="py-2 text-xs">{d.last_indexed_at ? new Date(d.last_indexed_at).toLocaleDateString() : '—'}</td>
                      <td className="py-2 flex gap-2">
                        <button onClick={() => reindex(d.id)} className="text-xs text-blue-300 hover:text-blue-100">Re-index</button>
                        <button onClick={() => deleteDoc(d.id)} className="text-xs text-red-300 hover:text-red-100">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!docs.length && <p className="py-8 text-center text-white/40">No documents yet</p>}
            </div>
          )}
        </div>
      )}

      {tab === 'add' && (
        <div className={glass}>
          <h2 className="mb-4 text-xl font-semibold text-white">Add Document</h2>
          <form onSubmit={handleAdd} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm text-white/70">Title *</label>
              <input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-white/70">Source Type</label>
              <select value={form.source_type} onChange={(e) => setForm((f) => ({ ...f, source_type: e.target.value }))}
                className="w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-white focus:outline-none">
                {['manual','file','url','database','api'].map((t) => <option key={t} value={t} className="bg-slate-800">{t}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-white/70">Source Reference</label>
              <input value={form.source_ref} onChange={(e) => setForm((f) => ({ ...f, source_ref: e.target.value }))}
                placeholder="URL or file path"
                className="w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-white placeholder-white/40 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-white/70">Collection</label>
              <input value={form.vector_collection} onChange={(e) => setForm((f) => ({ ...f, vector_collection: e.target.value }))}
                className="w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-white placeholder-white/40 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-white/70">Embedding Model</label>
              <input value={form.embedding_model} onChange={(e) => setForm((f) => ({ ...f, embedding_model: e.target.value }))}
                className="w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-white placeholder-white/40 focus:outline-none" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm text-white/70">Content Preview</label>
              <textarea rows={4} value={form.content_preview} onChange={(e) => setForm((f) => ({ ...f, content_preview: e.target.value }))}
                className="w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-white placeholder-white/40 focus:outline-none" />
            </div>
            <div className="sm:col-span-2">
              <button type="submit" className="rounded-xl bg-indigo-600 px-6 py-2 text-white font-semibold hover:bg-indigo-500">Add to Queue</button>
            </div>
          </form>
        </div>
      )}

      {tab === 'collections' && (
        <div className="space-y-4">
          {Object.entries(collectionGroups).map(([col, colDocs]) => {
            const statusCount = colDocs.reduce<Record<string, number>>((acc, d) => {
              acc[d.embedding_status] = (acc[d.embedding_status] || 0) + 1;
              return acc;
            }, {});
            return (
              <div key={col} className={glass}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-white">{col}</h3>
                  <span className="text-white/60 text-sm">{colDocs.length} docs</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(statusCount).map(([s, cnt]) => (
                    <span key={s} className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[s] || 'bg-white/20 text-white'}`}>{s}: {cnt}</span>
                  ))}
                </div>
              </div>
            );
          })}
          {!Object.keys(collectionGroups).length && <div className={glass}><p className="text-white/40">No collections yet</p></div>}
        </div>
      )}

      {tab === 'ollama' && (
        <div className={glass}>
          <h2 className="mb-4 text-xl font-semibold text-white">Ollama Integration</h2>
          <div className="space-y-4">
            <div className="rounded-xl bg-indigo-500/20 border border-indigo-400/30 p-4">
              <p className="text-white/90 font-semibold mb-1">Current Embedding Model</p>
              <p className="font-mono text-indigo-200">nomic-embed-text</p>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <p className="text-white/90 font-semibold mb-2">Ollama Status</p>
              <p className="text-sm text-white/60 mb-3">{stats?.ollama_embed_available ? '✅ Ollama is reachable at localhost:11434' : '❌ Ollama not reachable — start Ollama to enable embedding'}</p>
              <p className="text-sm text-white/50">To pull the embedding model: <code className="font-mono bg-black/20 px-1 rounded">ollama pull nomic-embed-text</code></p>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <p className="text-white/90 font-semibold mb-2">Setup Instructions</p>
              <ol className="text-sm text-white/60 space-y-1 list-decimal list-inside">
                <li>Install Ollama from ollama.ai</li>
                <li>Run: <code className="font-mono bg-black/20 px-1 rounded">ollama pull nomic-embed-text</code></li>
                <li>Add documents using the Add Document tab</li>
                <li>Documents will be embedded automatically when Ollama is available</li>
              </ol>
              <p className="mt-3 text-sm text-white/40">For AI Control Tower settings, visit <a href="/admin/ai-control-tower" className="text-blue-300 hover:underline">/admin/ai-control-tower</a></p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
