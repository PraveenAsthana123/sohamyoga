'use client';

import { useEffect, useState } from 'react';

interface PromptVersion { id: number; prompt_name: string; version: string | null; content: string | null; model: string; grounding_pct: number; acceptance_pct: number; avg_tokens: number; avg_cost_cents: number; avg_latency_ms: number; is_champion: boolean; status: string; created_at: string; }
interface LlmEval { id: number; prompt_name?: string; eval_type: string | null; score: number | null; evaluator: string | null; notes: string | null; created_at: string; }
interface Summary { totalPrompts: number; championPrompts: number; avgAcceptance: number; }
interface ApiData { prompts: PromptVersion[]; evals: LlmEval[]; summary: Summary; }

const TABS = ['Prompt Registry', 'Eval Log', 'Performance Matrix', 'AI Playground'] as const;
type Tab = typeof TABS[number];

function fmt(d: string | null) { return d ? new Date(d).toLocaleDateString() : '—'; }
function fmtNum(n: number | null | undefined) { return Number(n ?? 0).toLocaleString(); }
function badge(s: string) {
  if (s === 'production') return 'bg-green-100 text-green-800';
  if (s === 'staging') return 'bg-blue-100 text-blue-800';
  if (s === 'draft') return 'bg-yellow-100 text-yellow-800';
  if (s === 'deprecated') return 'bg-gray-100 text-gray-600';
  return 'bg-gray-100 text-gray-600';
}
function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5"><p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p><p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p></div>;
}
function Empty({ msg }: { msg: string }) {
  return <div className="py-16 text-center text-gray-400"><p className="text-4xl mb-2">📭</p><p className="text-sm">{msg}</p></div>;
}

export default function LlmopsPage() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('Prompt Registry');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    fetch('/api/admin/llmops')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<ApiData>; })
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed'))
      .finally(() => setLoading(false));
  }, []);

  async function runPlayground() {
    if (!aiPrompt.trim()) return;
    setAiLoading(true); setAiResult('');
    try {
      const start = Date.now();
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3', prompt: aiPrompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      const latency = Date.now() - start;
      const j = await res.json() as { response?: string; eval_count?: number };
      if (res.ok) setAiResult(`[Latency: ${latency}ms | Tokens: ${j.eval_count ?? '?'}]\n\n${j.response ?? ''}`);
      else setAiResult('Ollama error.');
    } catch { setAiResult('Ollama unavailable. Run: ollama serve'); }
    finally { setAiLoading(false); }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" /></div>;
  if (error || !data) return <div className="p-6 text-red-600 bg-red-50 rounded-lg">Error: {error ?? 'Unknown'}</div>;

  const { prompts, evals, summary } = data;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-sm">LLM</div>
        <div><h1 className="text-2xl font-bold text-gray-900">LLMOps</h1><p className="text-sm text-gray-500">Prompt versioning, performance matrix, eval tracking, RAG observability</p></div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard label="Prompt Versions" value={fmtNum(summary.totalPrompts)} color="text-gray-900" />
        <KpiCard label="Champions" value={fmtNum(summary.championPrompts)} color="text-purple-700" />
        <KpiCard label="Avg Acceptance" value={`${summary.avgAcceptance}%`} color="text-green-700" />
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex gap-1 -mb-px">
          {TABS.map(tab => <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{tab}</button>)}
        </nav>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {activeTab === 'Prompt Registry' && (
          <div className="overflow-x-auto">
            {prompts.length === 0 ? <Empty msg="No prompt versions registered yet." /> : (
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50"><tr>{['Name', 'Version', 'Model', 'Grounding', 'Acceptance', 'Avg Tokens', 'Latency', 'Champion', 'Status'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {prompts.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{p.prompt_name}</td>
                      <td className="px-4 py-3 text-gray-500">{p.version ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{p.model}</td>
                      <td className="px-4 py-3">{p.grounding_pct}%</td>
                      <td className="px-4 py-3">{p.acceptance_pct}%</td>
                      <td className="px-4 py-3">{fmtNum(p.avg_tokens)}</td>
                      <td className="px-4 py-3">{fmtNum(p.avg_latency_ms)}ms</td>
                      <td className="px-4 py-3">{p.is_champion ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">Champion</span> : '—'}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge(p.status)}`}>{p.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'Eval Log' && (
          <div className="overflow-x-auto">
            {evals.length === 0 ? <Empty msg="No evals recorded yet." /> : (
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50"><tr>{['Prompt', 'Eval Type', 'Score', 'Evaluator', 'Notes', 'Date'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {evals.map(e => (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600">{e.prompt_name ?? '—'}</td>
                      <td className="px-4 py-3 capitalize text-gray-900">{e.eval_type ?? '—'}</td>
                      <td className="px-4 py-3 font-medium">{e.score != null ? `${Number(e.score).toFixed(1)}/10` : '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{e.evaluator ?? '—'}</td>
                      <td className="px-4 py-3 max-w-xs truncate text-gray-500">{e.notes ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{fmt(e.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'Performance Matrix' && (
          <div className="p-6">
            {prompts.length === 0 ? <Empty msg="No prompts to compare yet." /> : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50"><tr>{['Name', 'Ver', 'Grounding%', 'Acceptance%', 'Tokens', 'Cost¢', 'Latency'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {prompts.map(p => (
                      <tr key={p.id} className={`hover:bg-gray-50 ${p.is_champion ? 'bg-purple-50' : ''}`}>
                        <td className="px-4 py-3 font-medium text-gray-900">{p.prompt_name}{p.is_champion && <span className="ml-2 text-xs text-purple-700 font-semibold">★</span>}</td>
                        <td className="px-4 py-3 text-gray-500">{p.version}</td>
                        <td className="px-4 py-3"><span className={p.grounding_pct >= 80 ? 'text-green-700 font-medium' : 'text-yellow-700'}>{p.grounding_pct}%</span></td>
                        <td className="px-4 py-3"><span className={p.acceptance_pct >= 80 ? 'text-green-700 font-medium' : 'text-yellow-700'}>{p.acceptance_pct}%</span></td>
                        <td className="px-4 py-3">{fmtNum(p.avg_tokens)}</td>
                        <td className="px-4 py-3">{Number(p.avg_cost_cents).toFixed(3)}¢</td>
                        <td className="px-4 py-3">{fmtNum(p.avg_latency_ms)}ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'AI Playground' && (
          <div className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">LLM Playground (Ollama)</h2>
            <p className="text-sm text-gray-500">Test prompts live against the local Ollama instance. Response includes latency and token count for evaluation.</p>
            <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3 text-sm min-h-[100px] font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Enter your prompt here..." />
            <button onClick={runPlayground} disabled={aiLoading || !aiPrompt.trim()}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
              {aiLoading ? 'Running...' : 'Run Prompt'}
            </button>
            {aiResult && <div className="bg-gray-50 border border-gray-200 rounded-lg p-4"><p className="text-xs font-medium text-gray-500 uppercase mb-2">Output</p><pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">{aiResult}</pre></div>}
          </div>
        )}
      </div>
    </div>
  );
}
