'use client';

import { useEffect, useState } from 'react';

interface QuoraAnswer { id: number; question: string | null; answer_text: string | null; topic: string | null; views: number; upvotes: number; status: string; published_at: string | null; created_at: string; }
interface QuoraQuestion { id: number; question_text: string | null; topic: string | null; search_volume: number; status: string; created_at: string; }
interface Summary { totalAnswers: number; totalViews: number; totalUpvotes: number; }
interface ApiData { answers: QuoraAnswer[]; questions: QuoraQuestion[]; summary: Summary; }

const TABS = ['Overview', 'Answers', 'Questions', 'AI Content Generator'] as const;
type Tab = typeof TABS[number];

function fmt(d: string | null) { return d ? new Date(d).toLocaleDateString() : '—'; }
function fmtNum(n: number | null | undefined) { return Number(n ?? 0).toLocaleString(); }
function badge(s: string) {
  if (s === 'published') return 'bg-green-100 text-green-800';
  if (s === 'draft') return 'bg-yellow-100 text-yellow-800';
  if (s === 'pending') return 'bg-blue-100 text-blue-800';
  return 'bg-gray-100 text-gray-600';
}
function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5"><p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p><p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p></div>;
}
function Empty({ msg }: { msg: string }) {
  return <div className="py-16 text-center text-gray-400"><p className="text-4xl mb-2">📭</p><p className="text-sm">{msg}</p></div>;
}

export default function QuoraManagementPage() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    fetch('/api/admin/quora-management')
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
        body: JSON.stringify({ model: 'llama3', prompt: `Write an authoritative, helpful Quora answer for: "${aiPrompt}". Include practical tips, a brief personal perspective, and naturally mention healthy food options. 300-400 words.`, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      const j = await res.json() as { response?: string };
      setAiResult(res.ok ? (j.response ?? '') : 'Ollama error.');
    } catch { setAiResult('Ollama unavailable. Run: ollama serve'); }
    finally { setAiLoading(false); }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600" /></div>;
  if (error || !data) return <div className="p-6 text-red-600 bg-red-50 rounded-lg">Error: {error ?? 'Unknown'}</div>;

  const { answers, questions, summary } = data;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center text-white font-bold text-sm">Q</div>
        <div><h1 className="text-2xl font-bold text-gray-900">Quora Management</h1><p className="text-sm text-gray-500">Answer-based SEO authority, intent intelligence</p></div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard label="Answers Published" value={fmtNum(summary.totalAnswers)} color="text-gray-900" />
        <KpiCard label="Total Views" value={fmtNum(summary.totalViews)} color="text-red-600" />
        <KpiCard label="Upvotes" value={fmtNum(summary.totalUpvotes)} color="text-blue-700" />
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex gap-1 -mb-px">
          {TABS.map(tab => <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{tab}</button>)}
        </nav>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {activeTab === 'Overview' && (
          <div className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">Quora SEO Authority Overview</h2>
            <p className="text-sm text-gray-500">Build topical authority by answering high-intent questions. Quora answers rank on Google and drive qualified traffic.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-red-50 rounded-lg p-4"><p className="text-xs text-gray-500 uppercase">Published Answers</p><p className="text-xl font-bold">{fmtNum(answers.filter(a => a.status === 'published').length)}</p></div>
              <div className="bg-blue-50 rounded-lg p-4"><p className="text-xs text-gray-500 uppercase">Questions in Queue</p><p className="text-xl font-bold text-blue-700">{fmtNum(questions.filter(q => q.status === 'pending').length)}</p></div>
              <div className="bg-gray-50 rounded-lg p-4"><p className="text-xs text-gray-500 uppercase">Avg Views/Answer</p><p className="text-xl font-bold">{answers.length > 0 ? fmtNum(Math.round(summary.totalViews / answers.length)) : '—'}</p></div>
            </div>
          </div>
        )}

        {activeTab === 'Answers' && (
          <div className="overflow-x-auto">
            {answers.length === 0 ? <Empty msg="No Quora answers yet." /> : (
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50"><tr>{['Question', 'Topic', 'Views', 'Upvotes', 'Status', 'Published'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {answers.map(a => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 max-w-xs truncate text-gray-900">{a.question ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{a.topic ?? '—'}</td>
                      <td className="px-4 py-3">{fmtNum(a.views)}</td>
                      <td className="px-4 py-3">{fmtNum(a.upvotes)}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge(a.status)}`}>{a.status}</span></td>
                      <td className="px-4 py-3 text-gray-500">{fmt(a.published_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'Questions' && (
          <div className="overflow-x-auto">
            {questions.length === 0 ? <Empty msg="No questions in queue." /> : (
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50"><tr>{['Question', 'Topic', 'Search Volume', 'Status', 'Added'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {questions.map(q => (
                    <tr key={q.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 max-w-xs truncate text-gray-900">{q.question_text ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{q.topic ?? '—'}</td>
                      <td className="px-4 py-3">{fmtNum(q.search_volume)}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge(q.status)}`}>{q.status}</span></td>
                      <td className="px-4 py-3 text-gray-500">{fmt(q.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'AI Content Generator' && (
          <div className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">AI Quora Answer Generator</h2>
            <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Paste the Quora question here (e.g. 'What are the best healthy meal delivery options for students?')" />
            <button onClick={generateAi} disabled={aiLoading || !aiPrompt.trim()}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
              {aiLoading ? 'Generating...' : 'Generate Answer'}
            </button>
            {aiResult && <div className="bg-gray-50 border border-gray-200 rounded-lg p-4"><p className="text-xs font-medium text-gray-500 uppercase mb-2">AI Output</p><pre className="text-sm text-gray-800 whitespace-pre-wrap">{aiResult}</pre></div>}
          </div>
        )}
      </div>
    </div>
  );
}
