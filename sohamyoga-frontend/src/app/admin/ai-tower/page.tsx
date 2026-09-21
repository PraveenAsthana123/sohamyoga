'use client';

import { useState, useEffect, useCallback } from 'react';

interface AIModel {
  model_id: string; name: string; provider: string; model_type: string;
  status: string; version: string; calls_today: number; avg_latency_ms: number;
}
interface Inference {
  id: number; call_id: string; model_id: string; prompt_preview: string;
  latency_ms: number; tokens_used: number; cost_usd: string; status: string; created_at: string;
}
interface Prompt {
  prompt_id: string; name: string; model_id: string; template: string;
  version: string; last_updated: string;
}
interface Experiment {
  exp_id: string; name: string; model_a: string; model_b: string;
  metric: string; winner: string | null; sample_size: number; started_at: string;
}
interface Guardrail {
  rule_id: string; rule_name: string; rule_type: string;
  threshold_value: string | null; is_active: boolean;
}
interface Stats { deployed: number; totalCalls: number; avgLatency: number; errorRate: number; }

type Tab = 'fleet' | 'inference' | 'prompts' | 'ab-tests' | 'guardrails';

const STATUS_COLOR: Record<string, string> = {
  serving: 'bg-green-100 text-green-700', loading: 'bg-amber-100 text-amber-700',
  offline: 'bg-gray-100 text-gray-500', deprecated: 'bg-red-100 text-red-600',
};

function KpiCard({ label, value, unit, color }: { label: string; value: string | number; unit?: string; color?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${color ?? 'text-gray-900'}`}>{value}{unit && <span className="text-lg ml-1 font-normal text-gray-500">{unit}</span>}</p>
    </div>
  );
}

export default function AITowerPage() {
  const [tab, setTab] = useState<Tab>('fleet');
  const [models, setModels] = useState<AIModel[]>([]);
  const [inferences, setInferences] = useState<Inference[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [guardrails, setGuardrails] = useState<Guardrail[]>([]);
  const [stats, setStats] = useState<Stats>({ deployed: 0, totalCalls: 0, avgLatency: 0, errorRate: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewPrompt, setViewPrompt] = useState<Prompt | null>(null);
  const [togglingRule, setTogglingRule] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/admin/ai-tower', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setStats(d.stats); setModels(d.models); setInferences(d.inferences);
      setPrompts(d.prompts); setExperiments(d.experiments); setGuardrails(d.guardrails);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const toggleGuardrail = async (rule: Guardrail) => {
    setTogglingRule(rule.rule_id);
    try {
      await fetch('/api/admin/ai-tower', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rule_id: rule.rule_id, is_active: !rule.is_active }),
      });
      await load();
    } catch { /* ignore */ }
    finally { setTogglingRule(null); }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'fleet', label: 'Model Fleet' },
    { key: 'inference', label: 'Inference Monitor' },
    { key: 'prompts', label: 'Prompt Registry' },
    { key: 'ab-tests', label: 'A/B Tests' },
    { key: 'guardrails', label: 'Guardrails' },
  ];

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">AI Control Tower</h1>
        <p className="text-gray-500 text-sm mt-1">Model fleet management, inference monitoring, prompt registry and safety guardrails</p>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Models Deployed" value={loading ? '...' : stats.deployed} color="text-indigo-600" />
        <KpiCard label="Inference Calls Today" value={loading ? '...' : stats.totalCalls.toLocaleString()} />
        <KpiCard label="Avg Latency" value={loading ? '...' : stats.avgLatency} unit="ms" />
        <KpiCard label="Error Rate" value={loading ? '...' : stats.errorRate} unit="%" color={stats.errorRate > 5 ? 'text-red-600' : 'text-green-600'} />
      </div>

      <div className="flex gap-1 mb-6 bg-white border border-gray-200 rounded-xl p-1 w-fit flex-wrap">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-slate-800 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Model Fleet */}
      {tab === 'fleet' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>{['Model Name', 'Provider', 'Type', 'Status', 'Version', 'Calls Today', 'Avg Latency'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {models.map(m => (
                <tr key={m.model_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{m.name}</td>
                  <td className="px-4 py-3 text-gray-600">{m.provider}</td>
                  <td className="px-4 py-3 text-gray-600">{m.model_type}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLOR[m.status] ?? 'bg-gray-100 text-gray-500'}`}>{m.status}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{m.version}</td>
                  <td className="px-4 py-3 text-gray-800 font-semibold">{m.calls_today.toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-600">{m.avg_latency_ms > 0 ? `${m.avg_latency_ms}ms` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Inference Monitor */}
      {tab === 'inference' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="font-semibold text-gray-700 text-sm">Recent Inference Calls (last 20)</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>{['Call ID', 'Model', 'Prompt Preview', 'Latency', 'Tokens', 'Cost', 'Status', 'Time'].map(h => (
                <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {inferences.map(inf => (
                <tr key={inf.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-xs text-gray-500">{inf.call_id}</td>
                  <td className="px-3 py-2 text-gray-700 text-xs">{inf.model_id}</td>
                  <td className="px-3 py-2 text-gray-600 text-xs max-w-xs truncate">{inf.prompt_preview}</td>
                  <td className="px-3 py-2 text-gray-700">{inf.latency_ms}ms</td>
                  <td className="px-3 py-2 text-gray-600">{inf.tokens_used}</td>
                  <td className="px-3 py-2 text-gray-600">${parseFloat(inf.cost_usd).toFixed(5)}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${inf.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{inf.status}</span>
                  </td>
                  <td className="px-3 py-2 text-gray-400 text-xs">{new Date(inf.created_at).toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Prompt Registry */}
      {tab === 'prompts' && (
        <div className="space-y-4">
          {viewPrompt && (
            <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-screen overflow-y-auto">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-gray-900">{viewPrompt.name}</h3>
                    <p className="text-xs text-gray-400">Model: {viewPrompt.model_id} · Version: {viewPrompt.version}</p>
                  </div>
                  <button onClick={() => setViewPrompt(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
                </div>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs text-gray-800 whitespace-pre-wrap font-mono overflow-x-auto">{viewPrompt.template}</pre>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {prompts.map(p => (
              <div key={p.prompt_id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-800 truncate">{p.name}</h4>
                    <p className="text-xs text-gray-500 mt-0.5">Model: {p.model_id} · {p.version}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Updated: {new Date(p.last_updated).toLocaleDateString()}</p>
                  </div>
                  <button onClick={() => setViewPrompt(p)}
                    className="ml-3 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-medium hover:bg-indigo-100 flex-shrink-0">
                    Copy
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* A/B Tests */}
      {tab === 'ab-tests' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>{['Experiment', 'Model A', 'Model B', 'Metric', 'Winner', 'Sample Size', 'Started'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {experiments.map(exp => (
                <tr key={exp.exp_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{exp.name}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs font-mono">{exp.model_a}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs font-mono">{exp.model_b}</td>
                  <td className="px-4 py-3 text-gray-600">{exp.metric}</td>
                  <td className="px-4 py-3">
                    {exp.winner
                      ? <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">{exp.winner}</span>
                      : <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">running</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-gray-600">{exp.sample_size.toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-400">{new Date(exp.started_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Guardrails */}
      {tab === 'guardrails' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>{['Rule Name', 'Type', 'Threshold', 'Status', 'Toggle'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {guardrails.map(g => (
                <tr key={g.rule_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{g.rule_name}</td>
                  <td className="px-4 py-3 text-gray-600">
                    <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">{g.rule_type}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                    {g.threshold_value !== null ? g.threshold_value : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${g.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {g.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleGuardrail(g)} disabled={togglingRule === g.rule_id}
                      className={`relative inline-flex w-10 h-5 rounded-full transition-colors ${g.is_active ? 'bg-green-500' : 'bg-gray-300'} disabled:opacity-50`}>
                      <span className={`inline-block w-4 h-4 bg-white rounded-full shadow transform transition-transform m-0.5 ${g.is_active ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
