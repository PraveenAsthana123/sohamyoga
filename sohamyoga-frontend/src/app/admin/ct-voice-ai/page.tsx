'use client';
import { useEffect, useState, useCallback } from 'react';

interface Kpi { label: string; value: number | string; target: number; trend: 'up' | 'down'; unit: string; }
interface Call { id: number; agent_name?: string; caller_number?: string; direction?: string; duration_seconds?: number; outcome?: string; sentiment?: string; transcript_snippet?: string; cost_usd?: number; created_at: string; }
interface Agent { id: number; name: string; voice_id?: string; persona?: string; script?: string; status: string; calls_handled: number; avg_csat: number; }
interface VoiceScript { id: number; agent_id?: number; script_name?: string; intent?: string; utterances?: string[]; response?: string; }
interface CtData {
  health_score: number; traffic_light: 'red' | 'yellow' | 'green'; kpis: Kpi[]; updated_at: string;
}

const TABS = ['Overview', 'Call Log', 'Agent Manager', 'Script Builder', 'AI Advisor'] as const;
type Tab = typeof TABS[number];

const TL_BG = { red: 'bg-red-50 border-red-200', yellow: 'bg-amber-50 border-amber-200', green: 'bg-emerald-50 border-emerald-200' };
const TL_EMOJI = { red: '🔴', yellow: '🟡', green: '🟢' };

const SENTIMENT_COLOR: Record<string, string> = {
  positive: 'bg-green-100 text-green-800', negative: 'bg-red-100 text-red-800',
  neutral: 'bg-gray-100 text-gray-600',
};
const OUTCOME_COLOR: Record<string, string> = {
  completed: 'bg-green-100 text-green-800', sale: 'bg-emerald-100 text-emerald-800',
  resolved: 'bg-blue-100 text-blue-800', escalated: 'bg-red-100 text-red-800',
  no_answer: 'bg-gray-100 text-gray-600', voicemail: 'bg-amber-100 text-amber-700',
};

function KpiCard({ kpi }: { kpi: Kpi }) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{kpi.label}</p>
      <p className="text-2xl font-bold mt-1">{kpi.value} <span className="text-sm text-gray-400">{kpi.unit}</span></p>
      <p className={`text-xs mt-2 font-medium ${kpi.trend === 'up' ? 'text-emerald-600' : 'text-red-500'}`}>
        {kpi.trend === 'up' ? '▲' : '▼'} Target: {kpi.target}
      </p>
    </div>
  );
}

function CsatStars({ score }: { score: number }) {
  return (
    <span className="text-amber-400 text-sm">
      {'★'.repeat(Math.round(score))}{'☆'.repeat(5 - Math.round(score))}
      <span className="text-gray-500 ml-1 text-xs">{Number(score).toFixed(1)}</span>
    </span>
  );
}

export default function CtVoiceAiPage() {
  const [tab, setTab] = useState<Tab>('Overview');
  const [data, setData] = useState<CtData | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [scripts, setScripts] = useState<VoiceScript[]>([]);
  const [loading, setLoading] = useState(true);
  const [brief, setBrief] = useState('');
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, c, a] = await Promise.all([
        fetch('/api/admin/ct-voice-ai').then(r => r.json()),
        fetch('/api/admin/ct-voice-ai/calls').then(r => r.json()),
        fetch('/api/admin/ct-voice-ai/agents').then(r => r.json()),
      ]);
      setData(d);
      setCalls(c.calls ?? []);
      setAgents(a.agents ?? []);
      setScripts(a.scripts ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const generateBrief = async () => {
    if (!data) return;
    setGenerating(true); setBrief('');
    try {
      const res = await fetch('/api/admin/ct-voice-ai/advisor', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ health_score: data.health_score, kpis: data.kpis }),
      });
      setBrief((await res.json()).brief ?? '');
    } finally { setGenerating(false); }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-gray-50"><p className="text-gray-500">Loading…</p></div>;

  const tl = data?.traffic_light ?? 'red';

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className={`rounded-xl border p-5 mb-6 ${TL_BG[tl]}`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Voice AI Control Tower</h1>
              <p className="text-sm text-gray-500 mt-1">Calls · Agents · Scripts · CSAT</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-4xl">{TL_EMOJI[tl]}</span>
              <div className="text-right">
                <p className="text-3xl font-bold">{data?.health_score ?? 0}<span className="text-base font-normal text-gray-400">/100</span></p>
                <p className="text-xs text-gray-400">Health Score</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 mb-6 bg-white rounded-xl border p-1 w-fit">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              {t}
            </button>
          ))}
        </div>

        {tab === 'Overview' && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {(data?.kpis ?? []).map(k => <KpiCard key={k.label} kpi={k} />)}
          </div>
        )}

        {tab === 'Call Log' && (
          <div className="bg-white rounded-xl border p-5 overflow-x-auto">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Recent Calls ({calls.length})</h2>
            <table className="w-full text-sm min-w-max">
              <thead><tr className="text-left text-xs text-gray-400 border-b">
                <th className="pb-2 pr-4">Agent</th><th className="pb-2 pr-4">Caller</th>
                <th className="pb-2 pr-4">Direction</th><th className="pb-2 pr-4">Duration</th>
                <th className="pb-2 pr-4">Outcome</th><th className="pb-2 pr-4">Sentiment</th>
                <th className="pb-2 pr-4">Cost</th><th className="pb-2">Time</th>
              </tr></thead>
              <tbody>
                {calls.map(c => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-2 pr-4 font-medium text-gray-800">{c.agent_name ?? '—'}</td>
                    <td className="py-2 pr-4 text-gray-500 font-mono text-xs">{c.caller_number ?? '—'}</td>
                    <td className="py-2 pr-4"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.direction === 'inbound' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>{c.direction}</span></td>
                    <td className="py-2 pr-4 text-gray-600">{c.duration_seconds ?? 0}s</td>
                    <td className="py-2 pr-4"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${OUTCOME_COLOR[c.outcome ?? ''] ?? 'bg-gray-100 text-gray-600'}`}>{c.outcome}</span></td>
                    <td className="py-2 pr-4"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${SENTIMENT_COLOR[c.sentiment ?? ''] ?? 'bg-gray-100 text-gray-600'}`}>{c.sentiment}</span></td>
                    <td className="py-2 pr-4 text-gray-500">${Number(c.cost_usd ?? 0).toFixed(2)}</td>
                    <td className="py-2 text-gray-400 text-xs">{new Date(c.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'Agent Manager' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {agents.map(a => (
              <div key={a.id} className="bg-white rounded-xl border p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-lg font-bold text-gray-800">{a.name}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${a.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{a.status}</span>
                </div>
                <p className="text-xs text-gray-500 mb-3">{a.persona ?? '—'}</p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-gray-400">Voice ID</span><span className="text-gray-700 font-mono">{a.voice_id ?? '—'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Calls Handled</span><span className="font-semibold">{a.calls_handled}</span></div>
                  <div className="flex justify-between items-center"><span className="text-gray-400">Avg CSAT</span><CsatStars score={Number(a.avg_csat)} /></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'Script Builder' && (
          <div className="space-y-4">
            {scripts.map(s => (
              <div key={s.id} className="bg-white rounded-xl border p-5">
                <div className="flex items-center gap-3 mb-3">
                  <p className="font-semibold text-gray-800">{s.script_name ?? 'Unnamed Script'}</p>
                  <span className="rounded-full px-2 py-0.5 text-xs font-semibold bg-indigo-100 text-indigo-800">{s.intent ?? 'no intent'}</span>
                </div>
                {(s.utterances ?? []).length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-gray-400 mb-1">Sample Utterances</p>
                    <div className="flex flex-wrap gap-1">
                      {(s.utterances ?? []).map((u, i) => (
                        <span key={i} className="bg-gray-100 text-gray-600 rounded px-2 py-0.5 text-xs">"{u}"</span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="bg-slate-800 text-green-300 rounded-lg p-3 text-xs font-mono">
                  <span className="text-slate-400">Agent response: </span>{s.response ?? '—'}
                </div>
              </div>
            ))}
            {scripts.length === 0 && <div className="bg-white rounded-xl border p-6 text-center text-gray-400 text-sm">No scripts found.</div>}
          </div>
        )}

        {tab === 'AI Advisor' && (
          <div className="bg-white rounded-xl border p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-700">AI Call Pattern Analyzer</h2>
                <p className="text-xs text-gray-400 mt-0.5">Script improvements · Powered by Ollama llama3.2</p>
              </div>
              <button onClick={generateBrief} disabled={generating}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-indigo-700">
                {generating ? 'Analyzing…' : 'Analyze Calls'}
              </button>
            </div>
            {brief
              ? <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">{brief}</div>
              : <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-400 text-sm">Click "Analyze Calls" to get AI-powered call pattern analysis and script recommendations.</div>
            }
          </div>
        )}
      </div>
    </div>
  );
}
