'use client';

import { useEffect, useState } from 'react';

interface NdPost { id: number; content: string | null; neighborhood: string | null; post_type: string; reactions: number; comments: number; status: string; published_at: string | null; created_at: string; }
interface Summary { totalPosts: number; totalReactions: number; totalComments: number; }
interface ApiData { posts: NdPost[]; summary: Summary; }

const TABS = ['Overview', 'Posts', 'Analytics', 'AI Content Generator'] as const;
type Tab = typeof TABS[number];

function fmt(d: string | null) { return d ? new Date(d).toLocaleDateString() : '—'; }
function fmtNum(n: number | null | undefined) { return Number(n ?? 0).toLocaleString(); }
function badge(s: string) {
  if (s === 'published') return 'bg-green-100 text-green-800';
  if (s === 'draft') return 'bg-yellow-100 text-yellow-800';
  return 'bg-gray-100 text-gray-600';
}
function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5"><p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p><p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p></div>;
}
function Empty({ msg }: { msg: string }) {
  return <div className="py-16 text-center text-gray-400"><p className="text-4xl mb-2">📭</p><p className="text-sm">{msg}</p></div>;
}

export default function NextdoorManagementPage() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    fetch('/api/admin/nextdoor-management')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<ApiData>; })
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed'))
      .finally(() => setLoading(false));
  }, []);

  async function generateAi() {
    if (!aiPrompt.trim()) return;
    setAiLoading(true); setAiResult('');
    try {
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3', prompt: `Write a warm, neighborhood-focused Nextdoor announcement for: ${aiPrompt}. Emphasize community connection and local trust.`, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      const j = await res.json() as { response?: string };
      setAiResult(res.ok ? (j.response ?? '') : 'Ollama error.');
    } catch { setAiResult('Ollama unavailable. Run: ollama serve'); }
    finally { setAiLoading(false); }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-700" /></div>;
  if (error || !data) return <div className="p-6 text-red-600 bg-red-50 rounded-lg">Error: {error ?? 'Unknown'}</div>;

  const { posts, summary } = data;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-green-700 flex items-center justify-center text-white font-bold text-sm">ND</div>
        <div><h1 className="text-2xl font-bold text-gray-900">Nextdoor Management</h1><p className="text-sm text-gray-500">Neighborhood targeting, local trust, household marketing</p></div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard label="Total Posts" value={fmtNum(summary.totalPosts)} color="text-gray-900" />
        <KpiCard label="Reactions" value={fmtNum(summary.totalReactions)} color="text-green-700" />
        <KpiCard label="Comments" value={fmtNum(summary.totalComments)} color="text-blue-700" />
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex gap-1 -mb-px">
          {TABS.map(tab => <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-green-700 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{tab}</button>)}
        </nav>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {activeTab === 'Overview' && (
          <div className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">Nextdoor Overview</h2>
            <p className="text-sm text-gray-500">Post to specific neighborhoods to build hyper-local trust and drive household orders. Track engagement per neighborhood.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="bg-green-50 rounded-lg p-4"><p className="text-xs text-gray-500 uppercase">Published</p><p className="text-xl font-bold">{fmtNum(posts.filter(p => p.status === 'published').length)}</p></div>
              <div className="bg-yellow-50 rounded-lg p-4"><p className="text-xs text-gray-500 uppercase">Drafts</p><p className="text-xl font-bold">{fmtNum(posts.filter(p => p.status === 'draft').length)}</p></div>
              <div className="bg-gray-50 rounded-lg p-4"><p className="text-xs text-gray-500 uppercase">Neighborhoods</p><p className="text-xl font-bold">{new Set(posts.map(p => p.neighborhood).filter(Boolean)).size}</p></div>
            </div>
          </div>
        )}

        {activeTab === 'Posts' && (
          <div className="overflow-x-auto">
            {posts.length === 0 ? <Empty msg="No Nextdoor posts yet." /> : (
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50"><tr>{['Content', 'Neighborhood', 'Type', 'Reactions', 'Comments', 'Status', 'Published'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {posts.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 max-w-xs truncate text-gray-900">{p.content ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{p.neighborhood ?? '—'}</td>
                      <td className="px-4 py-3 capitalize text-gray-500">{p.post_type}</td>
                      <td className="px-4 py-3">{fmtNum(p.reactions)}</td>
                      <td className="px-4 py-3">{fmtNum(p.comments)}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge(p.status)}`}>{p.status}</span></td>
                      <td className="px-4 py-3 text-gray-500">{fmt(p.published_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'Analytics' && (
          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-lg p-4 text-center"><p className="text-xs text-gray-500 uppercase">Total Posts</p><p className="text-2xl font-bold">{fmtNum(summary.totalPosts)}</p></div>
              <div className="bg-green-50 rounded-lg p-4 text-center"><p className="text-xs text-gray-500 uppercase">Reactions</p><p className="text-2xl font-bold text-green-700">{fmtNum(summary.totalReactions)}</p></div>
              <div className="bg-blue-50 rounded-lg p-4 text-center"><p className="text-xs text-gray-500 uppercase">Comments</p><p className="text-2xl font-bold text-blue-700">{fmtNum(summary.totalComments)}</p></div>
            </div>
          </div>
        )}

        {activeTab === 'AI Content Generator' && (
          <div className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">AI Nextdoor Content Generator</h2>
            <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-green-600"
              placeholder="Describe your neighborhood post (e.g. 'family meal deal for the Riverside neighborhood this weekend')" />
            <button onClick={generateAi} disabled={aiLoading || !aiPrompt.trim()}
              className="px-4 py-2 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 disabled:opacity-50">
              {aiLoading ? 'Generating...' : 'Generate Post'}
            </button>
            {aiResult && <div className="bg-gray-50 border border-gray-200 rounded-lg p-4"><p className="text-xs font-medium text-gray-500 uppercase mb-2">AI Output</p><pre className="text-sm text-gray-800 whitespace-pre-wrap">{aiResult}</pre></div>}
          </div>
        )}
      </div>
    </div>
  );
}
