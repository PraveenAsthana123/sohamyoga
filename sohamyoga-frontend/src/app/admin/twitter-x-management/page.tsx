'use client';

import { useEffect, useState } from 'react';

interface TwitterPost { id: number; content: string | null; hashtags: string | null; impressions: number; likes: number; retweets: number; status: string; published_at: string | null; created_at: string; }
interface TwitterThread { id: number; title: string | null; post_count: number; status: string; created_at: string; }
interface Summary { totalPosts: number; totalImpressions: number; totalLikes: number; totalRetweets: number; }
interface ApiData { posts: TwitterPost[]; threads: TwitterThread[]; summary: Summary; }

const TABS = ['Overview', 'Posts', 'Threads', 'AI Content Generator'] as const;
type Tab = typeof TABS[number];

function fmt(d: string | null) { return d ? new Date(d).toLocaleDateString() : '—'; }
function fmtNum(n: number | null | undefined) { return Number(n ?? 0).toLocaleString(); }
function badge(s: string) {
  if (s === 'published') return 'bg-green-100 text-green-800';
  if (s === 'draft') return 'bg-yellow-100 text-yellow-800';
  if (s === 'scheduled') return 'bg-blue-100 text-blue-800';
  return 'bg-gray-100 text-gray-600';
}
function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5"><p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p><p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p></div>;
}
function Empty({ msg }: { msg: string }) {
  return <div className="py-16 text-center text-gray-400"><p className="text-4xl mb-2">📭</p><p className="text-sm">{msg}</p></div>;
}

export default function TwitterXManagementPage() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    fetch('/api/admin/twitter-x-management')
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
        body: JSON.stringify({ model: 'llama3', prompt: `Write a punchy X/Twitter post (under 280 chars) for: ${aiPrompt}. Include 2-3 relevant hashtags. Make it conversational and engaging.`, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      const j = await res.json() as { response?: string };
      setAiResult(res.ok ? (j.response ?? '') : 'Ollama error.');
    } catch { setAiResult('Ollama unavailable. Run: ollama serve'); }
    finally { setAiLoading(false); }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900" /></div>;
  if (error || !data) return <div className="p-6 text-red-600 bg-red-50 rounded-lg">Error: {error ?? 'Unknown'}</div>;

  const { posts, threads, summary } = data;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center text-white font-bold text-sm">X</div>
        <div><h1 className="text-2xl font-bold text-gray-900">X / Twitter Management</h1><p className="text-sm text-gray-500">Real-time moments, local conversation, game-day posts</p></div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Posts" value={fmtNum(summary.totalPosts)} color="text-gray-900" />
        <KpiCard label="Impressions" value={fmtNum(summary.totalImpressions)} color="text-blue-700" />
        <KpiCard label="Likes" value={fmtNum(summary.totalLikes)} color="text-red-600" />
        <KpiCard label="Retweets" value={fmtNum(summary.totalRetweets)} color="text-green-700" />
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex gap-1 -mb-px">
          {TABS.map(tab => <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{tab}</button>)}
        </nav>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {activeTab === 'Overview' && (
          <div className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">X/Twitter Overview</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-4"><p className="text-xs text-gray-500 uppercase">Threads</p><p className="text-xl font-bold">{fmtNum(threads.length)}</p></div>
              <div className="bg-blue-50 rounded-lg p-4"><p className="text-xs text-gray-500 uppercase">Impressions</p><p className="text-xl font-bold text-blue-700">{fmtNum(summary.totalImpressions)}</p></div>
              <div className="bg-red-50 rounded-lg p-4"><p className="text-xs text-gray-500 uppercase">Likes</p><p className="text-xl font-bold text-red-600">{fmtNum(summary.totalLikes)}</p></div>
              <div className="bg-green-50 rounded-lg p-4"><p className="text-xs text-gray-500 uppercase">Retweets</p><p className="text-xl font-bold text-green-700">{fmtNum(summary.totalRetweets)}</p></div>
            </div>
          </div>
        )}

        {activeTab === 'Posts' && (
          <div className="overflow-x-auto">
            {posts.length === 0 ? <Empty msg="No posts yet." /> : (
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50"><tr>{['Content', 'Hashtags', 'Impressions', 'Likes', 'Retweets', 'Status', 'Published'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {posts.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 max-w-xs truncate text-gray-900">{p.content ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{p.hashtags ?? '—'}</td>
                      <td className="px-4 py-3">{fmtNum(p.impressions)}</td>
                      <td className="px-4 py-3">{fmtNum(p.likes)}</td>
                      <td className="px-4 py-3">{fmtNum(p.retweets)}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge(p.status)}`}>{p.status}</span></td>
                      <td className="px-4 py-3 text-gray-500">{fmt(p.published_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'Threads' && (
          <div className="overflow-x-auto">
            {threads.length === 0 ? <Empty msg="No threads yet." /> : (
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50"><tr>{['Title', 'Posts', 'Status', 'Created'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {threads.map(t => (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900">{t.title ?? '—'}</td>
                      <td className="px-4 py-3">{fmtNum(t.post_count)}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge(t.status)}`}>{t.status}</span></td>
                      <td className="px-4 py-3 text-gray-500">{fmt(t.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'AI Content Generator' && (
          <div className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">AI X/Twitter Content Generator</h2>
            <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-gray-800"
              placeholder="Describe your tweet topic (e.g. 'new avocado toast menu launch')" />
            <button onClick={generateAi} disabled={aiLoading || !aiPrompt.trim()}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50">
              {aiLoading ? 'Generating...' : 'Generate Tweet'}
            </button>
            {aiResult && <div className="bg-gray-50 border border-gray-200 rounded-lg p-4"><p className="text-xs font-medium text-gray-500 uppercase mb-2">AI Output</p><pre className="text-sm text-gray-800 whitespace-pre-wrap">{aiResult}</pre></div>}
          </div>
        )}
      </div>
    </div>
  );
}
