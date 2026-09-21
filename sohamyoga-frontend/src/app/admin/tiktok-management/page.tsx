'use client';

import { useEffect, useState } from 'react';

interface TiktokPost {
  id: number;
  caption: string | null;
  hashtags: string | null;
  video_url: string | null;
  views: number;
  likes: number;
  shares: number;
  status: string;
  published_at: string | null;
  created_at: string;
}

interface TiktokAnalytics {
  id: number;
  date: string | null;
  followers: number;
  views: number;
  likes: number;
  shares: number;
}

interface Summary { totalPosts: number; totalViews: number; totalLikes: number; totalShares: number; }

interface ApiData { posts: TiktokPost[]; analytics: TiktokAnalytics[]; summary: Summary; }

const TABS = ['Overview', 'Posts', 'Analytics', 'AI Content Generator'] as const;
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
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="py-16 text-center text-gray-400"><p className="text-4xl mb-2">📭</p><p className="text-sm">{msg}</p></div>;
}

export default function TiktokManagementPage() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    fetch('/api/admin/tiktok-management')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<ApiData>; })
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  async function generateAiContent() {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiResult('');
    try {
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3', prompt: `You are a TikTok content strategist. Generate a viral TikTok caption with hashtags for: ${aiPrompt}. Include trending hooks and a call-to-action.`, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      if (res.ok) {
        const j = await res.json() as { response?: string };
        setAiResult(j.response ?? '');
      } else {
        setAiResult('Ollama returned an error. Ensure the service is running at localhost:11434.');
      }
    } catch {
      setAiResult('Ollama is unavailable. Start it with: ollama serve');
    } finally {
      setAiLoading(false);
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pink-600" /></div>;
  if (error || !data) return <div className="p-6 text-red-600 bg-red-50 rounded-lg">Error: {error ?? 'Unknown error'}</div>;

  const { posts, analytics, summary } = data;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-white font-bold text-sm">TT</div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">TikTok Management</h1>
          <p className="text-sm text-gray-500">Viral food content, challenges, trending audio</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total Posts" value={fmtNum(summary.totalPosts)} color="text-gray-900" />
        <KpiCard label="Total Views" value={fmtNum(summary.totalViews)} color="text-pink-700" />
        <KpiCard label="Total Likes" value={fmtNum(summary.totalLikes)} color="text-red-600" />
        <KpiCard label="Total Shares" value={fmtNum(summary.totalShares)} color="text-purple-700" />
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex gap-1 -mb-px">
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-pink-600 text-pink-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {tab}
            </button>
          ))}
        </nav>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {activeTab === 'Overview' && (
          <div className="p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Platform Overview</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 uppercase">Posts Tracked</p>
                <p className="mt-1 text-xl font-bold text-gray-900">{fmtNum(summary.totalPosts)}</p>
              </div>
              <div className="bg-pink-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 uppercase">Total Reach</p>
                <p className="mt-1 text-xl font-bold text-pink-700">{fmtNum(summary.totalViews + summary.totalShares)}</p>
              </div>
            </div>
            <p className="text-sm text-gray-500">Connect TikTok Business API to enable live sync. Use the Posts tab to track content manually or via API.</p>
          </div>
        )}

        {activeTab === 'Posts' && (
          <div className="overflow-x-auto">
            {posts.length === 0 ? <Empty msg="No TikTok posts tracked yet." /> : (
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>{['Caption', 'Hashtags', 'Views', 'Likes', 'Shares', 'Status', 'Published'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {posts.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 max-w-xs truncate text-gray-900">{p.caption ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{p.hashtags ?? '—'}</td>
                      <td className="px-4 py-3">{fmtNum(p.views)}</td>
                      <td className="px-4 py-3">{fmtNum(p.likes)}</td>
                      <td className="px-4 py-3">{fmtNum(p.shares)}</td>
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
          <div className="overflow-x-auto">
            {analytics.length === 0 ? <Empty msg="No analytics data yet." /> : (
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>{['Date', 'Followers', 'Views', 'Likes', 'Shares'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {analytics.map(a => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">{a.date ?? '—'}</td>
                      <td className="px-4 py-3">{fmtNum(a.followers)}</td>
                      <td className="px-4 py-3">{fmtNum(a.views)}</td>
                      <td className="px-4 py-3">{fmtNum(a.likes)}</td>
                      <td className="px-4 py-3">{fmtNum(a.shares)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'AI Content Generator' && (
          <div className="p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">AI TikTok Content Generator</h2>
            <p className="text-sm text-gray-500">Uses local Ollama (llama3) to generate viral captions and hashtags.</p>
            <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-pink-500"
              placeholder="Describe your TikTok content idea (e.g. 'healthy meal prep for busy students')" />
            <button onClick={generateAiContent} disabled={aiLoading || !aiPrompt.trim()}
              className="px-4 py-2 bg-pink-600 text-white rounded-lg text-sm font-medium hover:bg-pink-700 disabled:opacity-50">
              {aiLoading ? 'Generating...' : 'Generate Caption + Hashtags'}
            </button>
            {aiResult && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">AI Output</p>
                <pre className="text-sm text-gray-800 whitespace-pre-wrap">{aiResult}</pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
