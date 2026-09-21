'use client';

import { useEffect, useState } from 'react';

interface SnapStory { id: number; title: string | null; snap_type: string; geo_target: string | null; views: number; swipe_ups: number; status: string; published_at: string | null; created_at: string; }
interface Summary { totalStories: number; totalViews: number; totalSwipeUps: number; }
interface ApiData { stories: SnapStory[]; summary: Summary; }

const TABS = ['Overview', 'Stories', 'Analytics', 'AI Content Generator'] as const;
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

export default function SnapchatManagementPage() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    fetch('/api/admin/snapchat-management')
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
        body: JSON.stringify({ model: 'llama3', prompt: `Write a short, fun Snapchat story caption with a geo-targeted hook for: ${aiPrompt}. Suggest an AR lens concept too.`, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      const j = await res.json() as { response?: string };
      setAiResult(res.ok ? (j.response ?? '') : 'Ollama error.');
    } catch { setAiResult('Ollama unavailable. Run: ollama serve'); }
    finally { setAiLoading(false); }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-400" /></div>;
  if (error || !data) return <div className="p-6 text-red-600 bg-red-50 rounded-lg">Error: {error ?? 'Unknown'}</div>;

  const { stories, summary } = data;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center text-white font-bold text-sm">SC</div>
        <div><h1 className="text-2xl font-bold text-gray-900">Snapchat Management</h1><p className="text-sm text-gray-500">Geo-targeted snaps, occasion content, AR lenses</p></div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard label="Stories" value={fmtNum(summary.totalStories)} color="text-gray-900" />
        <KpiCard label="Total Views" value={fmtNum(summary.totalViews)} color="text-yellow-600" />
        <KpiCard label="Swipe-Ups" value={fmtNum(summary.totalSwipeUps)} color="text-purple-700" />
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex gap-1 -mb-px">
          {TABS.map(tab => <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-yellow-500 text-yellow-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{tab}</button>)}
        </nav>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {activeTab === 'Overview' && (
          <div className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">Snapchat Overview</h2>
            <p className="text-sm text-gray-500">Track geo-targeted stories, occasion snaps, and AR lens engagement. Connect Snapchat Marketing API for live sync.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-yellow-50 rounded-lg p-4"><p className="text-xs text-gray-500 uppercase">Stories Published</p><p className="text-xl font-bold">{fmtNum(stories.filter(s => s.status === 'published').length)}</p></div>
              <div className="bg-gray-50 rounded-lg p-4"><p className="text-xs text-gray-500 uppercase">Avg Swipe-Up Rate</p><p className="text-xl font-bold text-purple-700">{summary.totalViews > 0 ? `${((summary.totalSwipeUps / summary.totalViews) * 100).toFixed(1)}%` : '—'}</p></div>
              <div className="bg-blue-50 rounded-lg p-4"><p className="text-xs text-gray-500 uppercase">Drafts</p><p className="text-xl font-bold text-blue-700">{fmtNum(stories.filter(s => s.status === 'draft').length)}</p></div>
            </div>
          </div>
        )}

        {activeTab === 'Stories' && (
          <div className="overflow-x-auto">
            {stories.length === 0 ? <Empty msg="No Snapchat stories tracked yet." /> : (
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50"><tr>{['Title', 'Type', 'Geo Target', 'Views', 'Swipe-Ups', 'Status', 'Published'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {stories.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900">{s.title ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600 capitalize">{s.snap_type}</td>
                      <td className="px-4 py-3 text-gray-500">{s.geo_target ?? '—'}</td>
                      <td className="px-4 py-3">{fmtNum(s.views)}</td>
                      <td className="px-4 py-3">{fmtNum(s.swipe_ups)}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge(s.status)}`}>{s.status}</span></td>
                      <td className="px-4 py-3 text-gray-500">{fmt(s.published_at)}</td>
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
              <div className="bg-gray-50 rounded-lg p-4 text-center"><p className="text-xs text-gray-500 uppercase">Stories</p><p className="text-2xl font-bold">{fmtNum(summary.totalStories)}</p></div>
              <div className="bg-yellow-50 rounded-lg p-4 text-center"><p className="text-xs text-gray-500 uppercase">Total Views</p><p className="text-2xl font-bold text-yellow-600">{fmtNum(summary.totalViews)}</p></div>
              <div className="bg-purple-50 rounded-lg p-4 text-center"><p className="text-xs text-gray-500 uppercase">Swipe-Ups</p><p className="text-2xl font-bold text-purple-700">{fmtNum(summary.totalSwipeUps)}</p></div>
            </div>
          </div>
        )}

        {activeTab === 'AI Content Generator' && (
          <div className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">AI Snapchat Content Generator</h2>
            <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-yellow-400"
              placeholder="Describe your snap idea (e.g. 'limited time summer salad for downtown area')" />
            <button onClick={generateAi} disabled={aiLoading || !aiPrompt.trim()}
              className="px-4 py-2 bg-yellow-400 text-gray-900 rounded-lg text-sm font-medium hover:bg-yellow-500 disabled:opacity-50">
              {aiLoading ? 'Generating...' : 'Generate Snap Content'}
            </button>
            {aiResult && <div className="bg-gray-50 border border-gray-200 rounded-lg p-4"><p className="text-xs font-medium text-gray-500 uppercase mb-2">AI Output</p><pre className="text-sm text-gray-800 whitespace-pre-wrap">{aiResult}</pre></div>}
          </div>
        )}
      </div>
    </div>
  );
}
