'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['All Documents', 'Ad Documents', 'Video Documents', 'Upload New', 'Version History', 'Compliance'] as const;
type Tab = typeof TABS[number];

interface DocRow {
  id: number;
  title: string;
  description: string | null;
  entity_type: string | null;
  entity_id: number | null;
  file_name: string | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  storage_path: string | null;
  version: number;
  status: string;
  tags: string[] | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
  campaign_name: string | null;
  video_title: string | null;
}

const badge = (color: string, label: string) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium bg-${color}-500/20 text-${color}-300`}>{label}</span>
);

const statusColor: Record<string, string> = {
  draft: 'gray', under_review: 'yellow', approved: 'green', archived: 'red', signed: 'blue',
};

const entityColor: Record<string, string> = {
  ad: 'purple', video: 'indigo', campaign: 'blue', contact: 'teal', contract: 'orange', general: 'gray',
};

function formatBytes(b: number | null): string {
  if (!b) return '—';
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

function formatDate(s: string): string {
  return new Date(s).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function DocumentManagementPage() {
  const [tab, setTab] = useState<Tab>('All Documents');
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [entityFilter, setEntityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Upload form
  const [form, setForm] = useState({
    title: '', description: '', entity_type: '', entity_id: '',
    file_name: '', file_size_bytes: '', mime_type: '', tags: '',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (entityFilter) params.set('entity_type', entityFilter);
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/admin/documents?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json() as { documents: DocRow[] };
      setDocs(data.documents ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [entityFilter, statusFilter]);

  useEffect(() => { void fetchDocs(); }, [fetchDocs]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setMsg('');
    try {
      const body = {
        title: form.title,
        description: form.description || undefined,
        entity_type: form.entity_type || undefined,
        entity_id: form.entity_id ? Number(form.entity_id) : undefined,
        file_name: form.file_name || undefined,
        file_size_bytes: form.file_size_bytes ? Number(form.file_size_bytes) : undefined,
        mime_type: form.mime_type || undefined,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
      };
      const res = await fetch('/api/admin/documents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (res.ok) {
        setMsg('Document created successfully.');
        setForm({ title: '', description: '', entity_type: '', entity_id: '', file_name: '', file_size_bytes: '', mime_type: '', tags: '' });
        void fetchDocs();
      } else {
        const d = await res.json() as { error: string };
        setMsg(`Error: ${d.error}`);
      }
    } catch { setMsg('Network error.'); }
    setSaving(false);
  }

  async function archiveDoc(id: number) {
    await fetch(`/api/admin/documents?id=${id}`, { method: 'DELETE' });
    void fetchDocs();
  }

  const adDocs = docs.filter(d => d.entity_type === 'ad');
  const videoDocs = docs.filter(d => d.entity_type === 'video');

  // Version history: group by title, show only those with version > 1 or multiple entries
  const byTitle: Record<string, DocRow[]> = {};
  for (const d of docs) { (byTitle[d.title] ??= []).push(d); }
  const versioned = Object.entries(byTitle).filter(([, v]) => v.some(d => d.version > 1) || v.length > 1);

  // Compliance: counts + flagged
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const staleReview = docs.filter(d => d.status === 'under_review' && now - new Date(d.created_at).getTime() > sevenDays);
  const statusCounts: Record<string, number> = { draft: 0, under_review: 0, approved: 0, signed: 0, archived: 0 };
  for (const d of docs) { if (d.status in statusCounts) statusCounts[d.status]++; }

  const glassCard = 'backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl p-6 shadow-xl';
  const inputClass = 'w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-white/40 focus:outline-none focus:border-indigo-400';
  const labelClass = 'block text-white/70 text-sm mb-1';

  const DocTable = ({ rows }: { rows: DocRow[] }) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-white/80">
        <thead>
          <tr className="border-b border-white/10 text-white/50 text-xs uppercase">
            <th className="text-left py-2 pr-3">Title</th>
            <th className="text-left py-2 pr-3">Type</th>
            <th className="text-left py-2 pr-3">Entity</th>
            <th className="text-left py-2 pr-3">Ver</th>
            <th className="text-left py-2 pr-3">Status</th>
            <th className="text-left py-2 pr-3">Size</th>
            <th className="text-left py-2 pr-3">Created</th>
            <th className="text-left py-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={8} className="py-8 text-center text-white/40">No documents found.</td></tr>
          )}
          {rows.map(d => (
            <tr key={d.id} className="border-b border-white/5 hover:bg-white/5">
              <td className="py-2 pr-3 font-medium text-white">{d.title}</td>
              <td className="py-2 pr-3">{badge(entityColor[d.entity_type ?? ''] ?? 'gray', d.entity_type ?? '—')}</td>
              <td className="py-2 pr-3 text-white/60">{d.campaign_name ?? d.video_title ?? (d.entity_id ? `#${d.entity_id}` : '—')}</td>
              <td className="py-2 pr-3">{d.version}</td>
              <td className="py-2 pr-3">{badge(statusColor[d.status] ?? 'gray', d.status)}</td>
              <td className="py-2 pr-3">{formatBytes(d.file_size_bytes)}</td>
              <td className="py-2 pr-3 text-white/60">{formatDate(d.created_at)}</td>
              <td className="py-2">
                <button onClick={() => void archiveDoc(d.id)} className="bg-red-600/80 hover:bg-red-700 text-white px-3 py-1 rounded text-xs">Archive</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Document Management</h1>
          <p className="text-white/60 mt-1">Manage documents, versions, and compliance across all entities</p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10'}`}>
              {t}
            </button>
          ))}
        </div>

        {/* All Documents */}
        {tab === 'All Documents' && (
          <div className={glassCard}>
            <div className="flex flex-wrap gap-2 mb-4">
              {['', 'ad', 'video', 'campaign', 'contract', 'general'].map(v => (
                <button key={v} onClick={() => setEntityFilter(v)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${entityFilter === v ? 'bg-indigo-600 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}>
                  {v === '' ? 'All' : v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
              <span className="mx-2 text-white/20">|</span>
              {['', 'draft', 'under_review', 'approved', 'signed', 'archived'].map(v => (
                <button key={v} onClick={() => setStatusFilter(v)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${statusFilter === v ? 'bg-indigo-600 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}>
                  {v === '' ? 'All Status' : v.replace('_', ' ')}
                </button>
              ))}
            </div>
            {loading ? <p className="text-white/50">Loading…</p> : <DocTable rows={docs} />}
          </div>
        )}

        {/* Ad Documents */}
        {tab === 'Ad Documents' && (
          <div className={glassCard}>
            <h2 className="text-white font-semibold mb-4">Documents linked to Ad Campaigns</h2>
            {loading ? <p className="text-white/50">Loading…</p> : <DocTable rows={adDocs} />}
          </div>
        )}

        {/* Video Documents */}
        {tab === 'Video Documents' && (
          <div className={glassCard}>
            <h2 className="text-white font-semibold mb-4">Documents linked to Videos</h2>
            {loading ? <p className="text-white/50">Loading…</p> : <DocTable rows={videoDocs} />}
          </div>
        )}

        {/* Upload New */}
        {tab === 'Upload New' && (
          <div className={glassCard}>
            <h2 className="text-white font-semibold text-lg mb-4">Create Document Record</h2>
            <form onSubmit={e => void handleUpload(e)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Title *</label>
                <input className={inputClass} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Document title" required />
              </div>
              <div>
                <label className={labelClass}>Entity Type</label>
                <select className={inputClass} value={form.entity_type} onChange={e => setForm(f => ({ ...f, entity_type: e.target.value }))}>
                  <option value="">— Select —</option>
                  {['ad', 'video', 'campaign', 'contact', 'contract', 'general'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Entity ID</label>
                <input type="number" className={inputClass} value={form.entity_id} onChange={e => setForm(f => ({ ...f, entity_id: e.target.value }))} placeholder="e.g. 42" />
              </div>
              <div>
                <label className={labelClass}>File Name</label>
                <input className={inputClass} value={form.file_name} onChange={e => setForm(f => ({ ...f, file_name: e.target.value }))} placeholder="contract.pdf" />
              </div>
              <div>
                <label className={labelClass}>File Size (bytes)</label>
                <input type="number" className={inputClass} value={form.file_size_bytes} onChange={e => setForm(f => ({ ...f, file_size_bytes: e.target.value }))} placeholder="204800" />
              </div>
              <div>
                <label className={labelClass}>MIME Type</label>
                <input className={inputClass} value={form.mime_type} onChange={e => setForm(f => ({ ...f, mime_type: e.target.value }))} placeholder="application/pdf" />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Description</label>
                <textarea rows={2} className={inputClass} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description…" />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Tags (comma-separated)</label>
                <input className={inputClass} value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="contract, legal, 2026" />
              </div>
              <div className="md:col-span-2 flex items-center gap-4">
                <button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg disabled:opacity-50">
                  {saving ? 'Saving…' : 'Create Document'}
                </button>
                {msg && <span className={`text-sm ${msg.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>{msg}</span>}
              </div>
            </form>
          </div>
        )}

        {/* Version History */}
        {tab === 'Version History' && (
          <div className={glassCard}>
            <h2 className="text-white font-semibold text-lg mb-4">Documents with Multiple Versions</h2>
            {versioned.length === 0 ? (
              <p className="text-white/50">No versioned documents found. Documents with version &gt; 1 will appear here.</p>
            ) : (
              <div className="space-y-6">
                {versioned.map(([title, versions]) => (
                  <div key={title} className="border border-white/10 rounded-xl p-4">
                    <h3 className="text-white font-medium mb-3">{title}</h3>
                    <div className="flex gap-4 overflow-x-auto">
                      {versions.sort((a, b) => a.version - b.version).map(v => (
                        <div key={v.id} className="flex flex-col items-center gap-1 min-w-[80px]">
                          <div className="w-10 h-10 rounded-full bg-indigo-600/40 border-2 border-indigo-400 flex items-center justify-center text-white font-bold text-sm">
                            v{v.version}
                          </div>
                          <span className="text-white/60 text-xs">{badge(statusColor[v.status] ?? 'gray', v.status)}</span>
                          <span className="text-white/40 text-xs">{formatDate(v.created_at)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Compliance */}
        {tab === 'Compliance' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {Object.entries(statusCounts).map(([s, c]) => (
                <div key={s} className={glassCard + ' text-center'}>
                  <div className="text-3xl font-bold text-white">{c}</div>
                  <div className="text-white/60 text-sm mt-1 capitalize">{s.replace('_', ' ')}</div>
                </div>
              ))}
            </div>
            <div className={glassCard}>
              <h2 className="text-white font-semibold text-lg mb-4">
                ⚠️ Stale Reviews ({staleReview.length})
                <span className="text-white/50 font-normal text-sm ml-2">Documents in &apos;under_review&apos; for &gt;7 days</span>
              </h2>
              {staleReview.length === 0 ? (
                <p className="text-green-400 text-sm">No stale reviews — all documents under review were submitted within 7 days.</p>
              ) : (
                <table className="w-full text-sm text-white/80">
                  <thead>
                    <tr className="border-b border-white/10 text-white/50 text-xs uppercase">
                      <th className="text-left py-2 pr-4">Title</th>
                      <th className="text-left py-2 pr-4">Entity</th>
                      <th className="text-left py-2">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staleReview.map(d => (
                      <tr key={d.id} className="border-b border-white/5">
                        <td className="py-2 pr-4 text-white font-medium">{d.title}</td>
                        <td className="py-2 pr-4">{badge(entityColor[d.entity_type ?? ''] ?? 'gray', d.entity_type ?? '—')}</td>
                        <td className="py-2 text-red-400">{formatDate(d.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
