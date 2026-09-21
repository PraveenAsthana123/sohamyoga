'use client';

import { useEffect, useState } from 'react';

interface ChannelStatus { id: number; channel_name: string; channel_type: string; is_active: boolean; last_post_at: string | null; follower_count: number; engagement_rate: number; posts_this_month: number; status: string; updated_at: string; }
interface OrchestrateJob { id: number; job_type: string; channels: string[] | null; triggered_by: string | null; status: string; result_summary: string | null; started_at: string | null; completed_at: string | null; created_at: string; }
interface Summary { totalChannels: number; activeChannels: number; warningChannels: number; inactiveChannels: number; }
interface ApiData { channels: ChannelStatus[]; jobs: OrchestrateJob[]; summary: Summary; }

const TABS = ['Channel Grid', 'Orchestration Jobs', 'AI Layer Status', 'AI Orchestrator'] as const;
type Tab = typeof TABS[number];

function fmt(d: string | null) { return d ? new Date(d).toLocaleString() : 'Never'; }
function fmtNum(n: number | null | undefined) { return Number(n ?? 0).toLocaleString(); }

function channelHealth(c: ChannelStatus): { dot: string; bg: string } {
  if (c.is_active && c.status === 'active') return { dot: 'bg-green-500', bg: 'bg-green-50 border-green-200' };
  if (c.status === 'warning') return { dot: 'bg-yellow-400', bg: 'bg-yellow-50 border-yellow-200' };
  return { dot: 'bg-gray-300', bg: 'bg-gray-50 border-gray-200' };
}

function jobBadge(s: string) {
  if (s === 'completed') return 'bg-green-100 text-green-800';
  if (s === 'running') return 'bg-blue-100 text-blue-800';
  if (s === 'failed') return 'bg-red-100 text-red-800';
  if (s === 'pending') return 'bg-yellow-100 text-yellow-800';
  return 'bg-gray-100 text-gray-600';
}

function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5"><p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p><p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p></div>;
}
function Empty({ msg }: { msg: string }) {
  return <div className="py-16 text-center text-gray-400"><p className="text-4xl mb-2">📭</p><p className="text-sm">{msg}</p></div>;
}

const AI_LAYERS = [
  { name: 'Content AI (Ollama/llama3)', desc: 'Local LLM for caption generation', status: 'active' },
  { name: 'Sentiment Analysis', desc: 'NLP pipeline for brand monitoring', status: 'active' },
  { name: 'Scheduling Optimizer', desc: 'Best-time-to-post AI', status: 'staged' },
  { name: 'Lookalike Targeting', desc: 'ML audience expansion', status: 'planned' },
  { name: 'RAG Knowledge Base', desc: 'Menu/brand context retrieval', status: 'active' },
  { name: 'Campaign Attribution AI', desc: 'Multi-touch attribution model', status: 'planned' },
];

export default function HyperlocalOrchestratorPage() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('Channel Grid');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    fetch('/api/admin/hyperlocal-orchestrator')
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
        body: JSON.stringify({ model: 'llama3', prompt: `As a hyperlocal marketing orchestrator, create a coordinated multi-channel campaign plan for: ${aiPrompt}. Specify which of the 25 channels to activate, what content per channel, and the sequencing/timing.`, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      const j = await res.json() as { response?: string };
      setAiResult(res.ok ? (j.response ?? '') : 'Ollama error.');
    } catch { setAiResult('Ollama unavailable. Run: ollama serve'); }
    finally { setAiLoading(false); }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-700" /></div>;
  if (error || !data) return <div className="p-6 text-red-600 bg-red-50 rounded-lg">Error: {error ?? 'Unknown'}</div>;

  const { channels, jobs, summary } = data;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-white font-bold text-sm">HO</div>
        <div><h1 className="text-2xl font-bold text-gray-900">Hyperlocal Orchestrator</h1><p className="text-sm text-gray-500">Unified 25-channel view + AI layers for a single trading area</p></div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total Channels" value={fmtNum(summary.totalChannels)} color="text-gray-900" />
        <KpiCard label="Active" value={fmtNum(summary.activeChannels)} color="text-green-700" />
        <KpiCard label="Warning" value={fmtNum(summary.warningChannels)} color="text-yellow-600" />
        <KpiCard label="Inactive" value={fmtNum(summary.inactiveChannels)} color="text-gray-500" />
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex gap-1 -mb-px">
          {TABS.map(tab => <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-slate-800 text-slate-800' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{tab}</button>)}
        </nav>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {activeTab === 'Channel Grid' && (
          <div className="p-4">
            {channels.length === 0 ? <Empty msg="No channels configured." /> : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {channels.map(ch => {
                  const { dot, bg } = channelHealth(ch);
                  return (
                    <div key={ch.id} className={`rounded-lg border p-3 ${bg}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
                        <p className="text-xs font-semibold text-gray-900 truncate">{ch.channel_name}</p>
                      </div>
                      <p className="text-xs text-gray-500 capitalize">{ch.channel_type}</p>
                      <p className="text-xs text-gray-400 mt-1">{ch.posts_this_month} posts/mo</p>
                      {ch.follower_count > 0 && <p className="text-xs text-gray-400">{fmtNum(ch.follower_count)} followers</p>}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex gap-4 mt-4 pt-3 border-t border-gray-100">
              <div className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-2 h-2 rounded-full bg-green-500" />Active</div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-2 h-2 rounded-full bg-yellow-400" />Warning</div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-2 h-2 rounded-full bg-gray-300" />Inactive</div>
            </div>
          </div>
        )}

        {activeTab === 'Orchestration Jobs' && (
          <div className="overflow-x-auto">
            {jobs.length === 0 ? <Empty msg="No orchestration jobs yet." /> : (
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50"><tr>{['Job Type', 'Channels', 'Triggered By', 'Status', 'Result', 'Started', 'Completed'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {jobs.map(j => (
                    <tr key={j.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900 capitalize">{j.job_type}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{j.channels?.length ? `${j.channels.length} channels` : 'All'}</td>
                      <td className="px-4 py-3 text-gray-500">{j.triggered_by ?? '—'}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${jobBadge(j.status)}`}>{j.status}</span></td>
                      <td className="px-4 py-3 max-w-xs truncate text-gray-500">{j.result_summary ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{fmt(j.started_at)}</td>
                      <td className="px-4 py-3 text-gray-500">{fmt(j.completed_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'AI Layer Status' && (
          <div className="p-6 space-y-3">
            <h2 className="text-lg font-semibold">AI Intelligence Layers</h2>
            <p className="text-sm text-gray-500">Status of AI automation layers powering the hyperlocal orchestrator.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {AI_LAYERS.map(layer => (
                <div key={layer.name} className={`rounded-lg border p-4 ${layer.status === 'active' ? 'bg-green-50 border-green-200' : layer.status === 'staged' ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium text-gray-900 text-sm">{layer.name}</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${layer.status === 'active' ? 'bg-green-100 text-green-800' : layer.status === 'staged' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>{layer.status}</span>
                  </div>
                  <p className="text-xs text-gray-500">{layer.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'AI Orchestrator' && (
          <div className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">AI Multi-Channel Campaign Planner</h2>
            <p className="text-sm text-gray-500">Describe a campaign goal and get an AI-generated plan across all 25 channels.</p>
            <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-slate-700"
              placeholder="Describe your campaign (e.g. 'grand opening of new location in Midtown, target radius 5km, launch weekend')" />
            <button onClick={generateAi} disabled={aiLoading || !aiPrompt.trim()}
              className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50">
              {aiLoading ? 'Orchestrating...' : 'Generate Multi-Channel Plan'}
            </button>
            {aiResult && <div className="bg-gray-50 border border-gray-200 rounded-lg p-4"><p className="text-xs font-medium text-gray-500 uppercase mb-2">AI Orchestration Plan</p><pre className="text-sm text-gray-800 whitespace-pre-wrap">{aiResult}</pre></div>}
          </div>
        )}
      </div>
    </div>
  );
}
