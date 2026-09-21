'use client';

import { useEffect, useState } from 'react';

interface RedditMention { id: number; subreddit: string | null; post_title: string | null; post_url: string | null; sentiment: string; upvotes: number; comments: number; found_at: string; status: string; }
interface RedditKeyword { id: number; keyword: string; subreddits: string | null; active: boolean; created_at: string; }
interface Summary { totalMentions: number; positiveMentions: number; negativeMentions: number; neutralMentions: number; }
interface ApiData { mentions: RedditMention[]; keywords: RedditKeyword[]; summary: Summary; }

const TABS = ['Overview', 'Mentions', 'Keywords', 'AI Intel Generator'] as const;
type Tab = typeof TABS[number];

function fmt(d: string | null) { return d ? new Date(d).toLocaleDateString() : '—'; }
function fmtNum(n: number | null | undefined) { return Number(n ?? 0).toLocaleString(); }
function sentBadge(s: string) {
  if (s === 'positive') return 'bg-green-100 text-green-800';
  if (s === 'negative') return 'bg-red-100 text-red-800';
  return 'bg-gray-100 text-gray-600';
}
function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5"><p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p><p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p></div>;
}
function Empty({ msg }: { msg: string }) {
  return <div className="py-16 text-center text-gray-400"><p className="text-4xl mb-2">📭</p><p className="text-sm">{msg}</p></div>;
}

export default function RedditListeningPage() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    fetch('/api/admin/reddit-listening')
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
        body: JSON.stringify({ model: 'llama3', prompt: `You are a community manager. Write a helpful, non-promotional Reddit reply for: ${aiPrompt}. Keep it genuine and value-focused.`, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      const j = await res.json() as { response?: string };
      setAiResult(res.ok ? (j.response ?? '') : 'Ollama error.');
    } catch { setAiResult('Ollama unavailable. Run: ollama serve'); }
    finally { setAiLoading(false); }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-600" /></div>;
  if (error || !data) return <div className="p-6 text-red-600 bg-red-50 rounded-lg">Error: {error ?? 'Unknown'}</div>;

  const { mentions, keywords, summary } = data;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-orange-600 flex items-center justify-center text-white font-bold text-sm">R</div>
        <div><h1 className="text-2xl font-bold text-gray-900">Reddit Listening</h1><p className="text-sm text-gray-500">Subreddit monitoring, community trust, market intel</p></div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total Mentions" value={fmtNum(summary.totalMentions)} color="text-gray-900" />
        <KpiCard label="Positive" value={fmtNum(summary.positiveMentions)} color="text-green-700" />
        <KpiCard label="Negative" value={fmtNum(summary.negativeMentions)} color="text-red-600" />
        <KpiCard label="Neutral" value={fmtNum(summary.neutralMentions)} color="text-gray-500" />
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex gap-1 -mb-px">
          {TABS.map(tab => <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-orange-600 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{tab}</button>)}
        </nav>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {activeTab === 'Overview' && (
          <div className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">Reddit Listening Overview</h2>
            <p className="text-sm text-gray-500">Monitor brand mentions across subreddits. Add keywords to track relevant discussions and identify market intelligence opportunities.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-orange-50 rounded-lg p-4"><p className="text-xs text-gray-500 uppercase">Keywords Tracked</p><p className="text-xl font-bold">{fmtNum(keywords.length)}</p></div>
              <div className="bg-green-50 rounded-lg p-4"><p className="text-xs text-gray-500 uppercase">Positive Sentiment</p><p className="text-xl font-bold text-green-700">{summary.totalMentions > 0 ? `${Math.round((summary.positiveMentions / summary.totalMentions) * 100)}%` : '—'}</p></div>
              <div className="bg-gray-50 rounded-lg p-4"><p className="text-xs text-gray-500 uppercase">Active Keywords</p><p className="text-xl font-bold">{fmtNum(keywords.filter(k => k.active).length)}</p></div>
            </div>
          </div>
        )}

        {activeTab === 'Mentions' && (
          <div className="overflow-x-auto">
            {mentions.length === 0 ? <Empty msg="No Reddit mentions tracked yet. Add keywords to start monitoring." /> : (
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50"><tr>{['Subreddit', 'Post Title', 'Sentiment', 'Upvotes', 'Comments', 'Found', 'Status'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {mentions.map(m => (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-orange-700 font-medium">r/{m.subreddit ?? '?'}</td>
                      <td className="px-4 py-3 max-w-xs truncate">{m.post_url ? <a href={m.post_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{m.post_title ?? '—'}</a> : (m.post_title ?? '—')}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sentBadge(m.sentiment)}`}>{m.sentiment}</span></td>
                      <td className="px-4 py-3">{fmtNum(m.upvotes)}</td>
                      <td className="px-4 py-3">{fmtNum(m.comments)}</td>
                      <td className="px-4 py-3 text-gray-500">{fmt(m.found_at)}</td>
                      <td className="px-4 py-3 text-gray-500 capitalize">{m.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'Keywords' && (
          <div className="overflow-x-auto">
            {keywords.length === 0 ? <Empty msg="No keywords configured yet." /> : (
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50"><tr>{['Keyword', 'Subreddits', 'Active', 'Created'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {keywords.map(k => (
                    <tr key={k.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{k.keyword}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{k.subreddits ?? 'All'}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${k.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{k.active ? 'Active' : 'Paused'}</span></td>
                      <td className="px-4 py-3 text-gray-500">{fmt(k.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'AI Intel Generator' && (
          <div className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">AI Community Response Generator</h2>
            <p className="text-sm text-gray-500">Generate authentic, non-promotional Reddit replies using local Ollama.</p>
            <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Paste the Reddit question or thread context here..." />
            <button onClick={generateAi} disabled={aiLoading || !aiPrompt.trim()}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50">
              {aiLoading ? 'Generating...' : 'Generate Community Reply'}
            </button>
            {aiResult && <div className="bg-gray-50 border border-gray-200 rounded-lg p-4"><p className="text-xs font-medium text-gray-500 uppercase mb-2">AI Output</p><pre className="text-sm text-gray-800 whitespace-pre-wrap">{aiResult}</pre></div>}
          </div>
        )}
      </div>
    </div>
  );
}
