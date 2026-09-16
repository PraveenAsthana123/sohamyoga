'use client';

import { useState, useEffect, useCallback } from 'react';

type Tab = 'FinOps Dashboard' | 'AIOps' | 'AgentOps' | 'Red Teaming' | 'Cost Optimizer';
const TABS: Tab[] = ['FinOps Dashboard', 'AIOps', 'AgentOps', 'Red Teaming', 'Cost Optimizer'];

interface CostRecord {
  id: number;
  model_name: string;
  provider: string;
  month: string;
  token_count: number;
  cost_usd: number;
  budget_usd: number;
  pct_used: number;
}

interface CostSummary {
  total_cost: number;
  total_budget: number;
  total_tokens: number;
}

interface Incident {
  id: number;
  title: string;
  severity: string;
  status: string;
  affected_model: string;
  root_cause: string;
  resolution: string | null;
  detected_at: string;
  resolved_at: string | null;
}

interface AgentRun {
  id: number;
  agent_name: string;
  task: string;
  status: string;
  steps_completed: number;
  total_steps: number;
  cost_usd: number;
  started_at: string;
  output: string | null;
}

interface RunStats {
  completed: number;
  failed: number;
  running: number;
  avg_cost: number;
  success_rate: number;
}

interface RedTeamFinding {
  id: number;
  model_name: string;
  attack_type: string;
  prompt: string;
  response_snippet: string;
  severity: string;
  status: string;
}

const SEV_COLOR: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-blue-100 text-blue-800',
};
const STATUS_COLOR: Record<string, string> = {
  open: 'bg-red-100 text-red-700',
  resolved: 'bg-green-100 text-green-700',
  running: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

export default function AiFinOpsPage() {
  const [tab, setTab] = useState<Tab>('FinOps Dashboard');
  const [costs, setCosts] = useState<CostRecord[]>([]);
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [mttr, setMttr] = useState<number | null>(null);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [runStats, setRunStats] = useState<RunStats | null>(null);
  const [findings, setFindings] = useState<RedTeamFinding[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiWorking, setAiWorking] = useState(false);
  const [aiResult, setAiResult] = useState('');
  const [scanModel, setScanModel] = useState('llama3.2');
  const [scanUseCase, setScanUseCase] = useState('yoga studio marketing AI assistant');
  const [scannedPrompts, setScannedPrompts] = useState<object[]>([]);
  const [resolveId, setResolveId] = useState<number | null>(null);
  const [resolution, setResolution] = useState('');

  const loadCosts = useCallback(async () => {
    const res = await fetch('/api/admin/ai-finops');
    if (res.ok) { const d = await res.json(); setCosts(d.costs ?? []); setSummary(d.summary); }
  }, []);

  const loadIncidents = useCallback(async () => {
    const res = await fetch('/api/admin/ai-finops/incidents');
    if (res.ok) { const d = await res.json(); setIncidents(d.incidents ?? []); setMttr(d.mttr_hours); }
  }, []);

  const loadRuns = useCallback(async () => {
    const res = await fetch('/api/admin/ai-finops/agent-runs');
    if (res.ok) { const d = await res.json(); setRuns(d.runs ?? []); setRunStats(d.stats); }
  }, []);

  const loadFindings = useCallback(async () => {
    const res = await fetch('/api/admin/ai-finops/red-team');
    if (res.ok) { const d = await res.json(); setFindings(d.findings ?? []); }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadCosts(), loadIncidents(), loadRuns(), loadFindings()]).finally(() => setLoading(false));
  }, [loadCosts, loadIncidents, loadRuns, loadFindings]);

  const resolveIncident = async () => {
    if (!resolveId) return;
    await fetch(`/api/admin/ai-finops/incidents/${resolveId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'resolved', resolution }),
    });
    setResolveId(null);
    setResolution('');
    loadIncidents();
  };

  const runRedTeamScan = async () => {
    setAiWorking(true);
    setScannedPrompts([]);
    try {
      const res = await fetch('/api/admin/ai-finops/red-team/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_name: scanModel, use_case: scanUseCase }),
      });
      const d = await res.json();
      setScannedPrompts(d.adversarial_prompts ?? []);
    } catch {
      setScannedPrompts([]);
    } finally {
      setAiWorking(false);
    }
  };

  const runCostOptimizer = async () => {
    setAiWorking(true);
    setAiResult('');
    const prompt = `You are an AI cost optimization expert. Analyze this spend data and suggest cheaper model alternatives:

Current spend: $${summary?.total_cost ?? 0} of $${summary?.total_budget ?? 0} budget
Total tokens: ${summary?.total_tokens ?? 0}

Models in use:
${[...new Set(costs.map(c => c.model_name))].map(m => `- ${m} (${costs.find(c => c.model_name === m)?.provider})`).join('\n')}

Provide: (1) 3 specific cheaper alternatives with cost comparison, (2) which tasks can move to local Ollama models, (3) token optimization tips. Be concise and specific.`;

    try {
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      const d = await res.json();
      setAiResult(d.response ?? 'No response');
    } catch {
      setAiResult('Ollama unavailable. Tip: Replace gpt-4o with llama3.2 (local) for content generation tasks — saves 100% of API cost. Use smaller models (llama3.2:1b) for classification tasks.');
    } finally {
      setAiWorking(false);
    }
  };

  const uniqueModels = [...new Set(costs.map(c => c.model_name))];
  const months = [...new Set(costs.map(c => c.month))].sort();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-slate-800 text-white px-6 py-4">
        <h1 className="text-2xl font-bold">AI FinOps & Operations Center</h1>
        <p className="text-slate-300 text-sm mt-1">Cost management · AIOps · AgentOps · Red Teaming</p>
      </div>

      <div className="flex border-b bg-white px-6">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="p-6">
        {loading && <div className="text-center text-gray-400 py-10">Loading...</div>}

        {/* ── FinOps Dashboard ── */}
        {tab === 'FinOps Dashboard' && !loading && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-4 border">
                <div className="text-sm text-gray-500">Total Spend</div>
                <div className="text-2xl font-bold text-gray-800">${Number(summary?.total_cost ?? 0).toFixed(2)}</div>
              </div>
              <div className="bg-white rounded-lg p-4 border">
                <div className="text-sm text-gray-500">Total Budget</div>
                <div className="text-2xl font-bold text-green-700">${Number(summary?.total_budget ?? 0).toFixed(2)}</div>
              </div>
              <div className="bg-white rounded-lg p-4 border">
                <div className="text-sm text-gray-500">Total Tokens</div>
                <div className="text-2xl font-bold text-blue-700">{Number(summary?.total_tokens ?? 0).toLocaleString()}</div>
              </div>
            </div>

            <div className="bg-white rounded-lg border p-4">
              <h2 className="font-semibold text-gray-700 mb-4">Spend vs Budget by Model (Monthly)</h2>
              <div className="space-y-3">
                {months.map(month => (
                  <div key={month}>
                    <div className="text-xs text-gray-500 font-medium mb-1">{month}</div>
                    {costs.filter(c => c.month === month).map(c => (
                      <div key={c.id} className="mb-2">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium">{c.model_name} <span className="text-gray-400">({c.provider})</span></span>
                          <span>${Number(c.cost_usd).toFixed(2)} / ${Number(c.budget_usd).toFixed(2)}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${Number(c.pct_used) > 90 ? 'bg-red-500' : Number(c.pct_used) > 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
                            style={{ width: `${Math.min(Number(c.pct_used ?? 0), 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg border p-4">
              <h2 className="font-semibold text-gray-700 mb-3">Cost by Model</h2>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Model', 'Provider', 'Month', 'Tokens', 'Cost', 'Budget', '% Used'].map(h => (
                      <th key={h} className="text-left px-3 py-2 text-gray-500 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {costs.map(c => (
                    <tr key={c.id} className="border-t">
                      <td className="px-3 py-2 font-medium">{c.model_name}</td>
                      <td className="px-3 py-2 text-gray-500">{c.provider}</td>
                      <td className="px-3 py-2">{c.month}</td>
                      <td className="px-3 py-2">{Number(c.token_count).toLocaleString()}</td>
                      <td className="px-3 py-2">${Number(c.cost_usd).toFixed(2)}</td>
                      <td className="px-3 py-2">${Number(c.budget_usd).toFixed(2)}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${Number(c.pct_used) > 90 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                          {c.pct_used ?? 0}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── AIOps ── */}
        {tab === 'AIOps' && !loading && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-4 border">
                <div className="text-sm text-gray-500">Open Incidents</div>
                <div className="text-2xl font-bold text-red-600">{incidents.filter(i => i.status === 'open').length}</div>
              </div>
              <div className="bg-white rounded-lg p-4 border">
                <div className="text-sm text-gray-500">Resolved</div>
                <div className="text-2xl font-bold text-green-600">{incidents.filter(i => i.status === 'resolved').length}</div>
              </div>
              <div className="bg-white rounded-lg p-4 border">
                <div className="text-sm text-gray-500">MTTR (hours)</div>
                <div className="text-2xl font-bold text-blue-600">{mttr ?? 'N/A'}</div>
              </div>
            </div>

            {resolveId && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="font-semibold text-yellow-800 mb-2">Resolve Incident #{resolveId}</h3>
                <textarea
                  className="w-full border rounded p-2 text-sm h-20"
                  placeholder="Enter resolution notes..."
                  value={resolution}
                  onChange={e => setResolution(e.target.value)}
                />
                <div className="flex gap-2 mt-2">
                  <button onClick={resolveIncident} className="px-4 py-1.5 bg-green-600 text-white rounded text-sm">Mark Resolved</button>
                  <button onClick={() => setResolveId(null)} className="px-4 py-1.5 bg-gray-200 rounded text-sm">Cancel</button>
                </div>
              </div>
            )}

            <div className="bg-white rounded-lg border">
              <div className="px-4 py-3 border-b font-semibold text-gray-700">Incident Tracker</div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Title', 'Severity', 'Status', 'Model', 'Root Cause', 'Detected', 'Action'].map(h => (
                      <th key={h} className="text-left px-3 py-2 text-gray-500 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {incidents.map(inc => (
                    <tr key={inc.id} className="border-t">
                      <td className="px-3 py-2 font-medium max-w-xs">{inc.title}</td>
                      <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-xs font-medium ${SEV_COLOR[inc.severity] ?? ''}`}>{inc.severity}</span></td>
                      <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLOR[inc.status] ?? ''}`}>{inc.status}</span></td>
                      <td className="px-3 py-2 text-gray-500">{inc.affected_model}</td>
                      <td className="px-3 py-2 text-gray-500 max-w-xs truncate">{inc.root_cause}</td>
                      <td className="px-3 py-2 text-gray-400 text-xs">{new Date(inc.detected_at).toLocaleDateString()}</td>
                      <td className="px-3 py-2">
                        {inc.status === 'open' && (
                          <button onClick={() => setResolveId(inc.id)} className="text-xs text-blue-600 hover:underline">Resolve</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── AgentOps ── */}
        {tab === 'AgentOps' && !loading && (
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-white rounded-lg p-4 border">
                <div className="text-sm text-gray-500">Success Rate</div>
                <div className="text-2xl font-bold text-green-600">{runStats?.success_rate ?? 0}%</div>
              </div>
              <div className="bg-white rounded-lg p-4 border">
                <div className="text-sm text-gray-500">Avg Cost/Run</div>
                <div className="text-2xl font-bold text-blue-600">${Number(runStats?.avg_cost ?? 0).toFixed(4)}</div>
              </div>
              <div className="bg-white rounded-lg p-4 border">
                <div className="text-sm text-gray-500">Running</div>
                <div className="text-2xl font-bold text-yellow-600">{runStats?.running ?? 0}</div>
              </div>
              <div className="bg-white rounded-lg p-4 border">
                <div className="text-sm text-gray-500">Failed</div>
                <div className="text-2xl font-bold text-red-600">{runStats?.failed ?? 0}</div>
              </div>
            </div>

            <div className="bg-white rounded-lg border">
              <div className="px-4 py-3 border-b font-semibold text-gray-700">Run History</div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Agent', 'Task', 'Status', 'Progress', 'Cost', 'Started', 'Output'].map(h => (
                      <th key={h} className="text-left px-3 py-2 text-gray-500 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {runs.map(r => (
                    <tr key={r.id} className="border-t">
                      <td className="px-3 py-2 font-medium">{r.agent_name}</td>
                      <td className="px-3 py-2 text-gray-600 max-w-xs truncate">{r.task}</td>
                      <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLOR[r.status] ?? ''}`}>{r.status}</span></td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-gray-200 rounded-full h-1.5">
                            <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.round((r.steps_completed / r.total_steps) * 100)}%` }} />
                          </div>
                          <span className="text-xs text-gray-400">{r.steps_completed}/{r.total_steps}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2">${Number(r.cost_usd).toFixed(4)}</td>
                      <td className="px-3 py-2 text-gray-400 text-xs">{new Date(r.started_at).toLocaleDateString()}</td>
                      <td className="px-3 py-2 text-gray-500 text-xs max-w-xs truncate">{r.output ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Red Teaming ── */}
        {tab === 'Red Teaming' && !loading && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-lg border p-4">
                <h3 className="font-semibold text-gray-700 mb-3">Severity Breakdown</h3>
                {(['critical', 'high', 'medium', 'low'] as const).map(sev => {
                  const count = findings.filter(f => f.severity === sev).length;
                  return (
                    <div key={sev} className="flex items-center gap-3 mb-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium w-16 text-center ${SEV_COLOR[sev]}`}>{sev}</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${findings.length ? (count / findings.length) * 100 : 0}%` }} />
                      </div>
                      <span className="text-sm text-gray-600 w-6">{count}</span>
                    </div>
                  );
                })}
              </div>
              <div className="bg-white rounded-lg border p-4">
                <h3 className="font-semibold text-gray-700 mb-3">Attack Types</h3>
                {[...new Set(findings.map(f => f.attack_type))].map(at => (
                  <div key={at} className="flex justify-between text-sm py-1 border-b last:border-0">
                    <span className="text-gray-600">{at.replace(/_/g, ' ')}</span>
                    <span className="font-medium">{findings.filter(f => f.attack_type === at).length}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg border">
              <div className="px-4 py-3 border-b font-semibold text-gray-700">Findings</div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Model', 'Attack Type', 'Prompt (truncated)', 'Severity', 'Status'].map(h => (
                      <th key={h} className="text-left px-3 py-2 text-gray-500 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {findings.map(f => (
                    <tr key={f.id} className="border-t">
                      <td className="px-3 py-2 font-medium">{f.model_name}</td>
                      <td className="px-3 py-2 text-gray-500">{f.attack_type?.replace(/_/g, ' ')}</td>
                      <td className="px-3 py-2 text-gray-500 max-w-xs truncate">{f.prompt}</td>
                      <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-xs font-medium ${SEV_COLOR[f.severity] ?? ''}`}>{f.severity}</span></td>
                      <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLOR[f.status] ?? ''}`}>{f.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Cost Optimizer ── */}
        {tab === 'Cost Optimizer' && !loading && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border p-6">
              <h2 className="font-semibold text-gray-700 mb-2">AI Red Team Scanner</h2>
              <p className="text-sm text-gray-500 mb-4">Generate adversarial test prompts for a model and use-case using Ollama</p>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Model Name</label>
                  <input className="w-full border rounded px-3 py-2 text-sm" value={scanModel} onChange={e => setScanModel(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Use Case</label>
                  <input className="w-full border rounded px-3 py-2 text-sm" value={scanUseCase} onChange={e => setScanUseCase(e.target.value)} />
                </div>
              </div>
              <button onClick={runRedTeamScan} disabled={aiWorking} className="px-4 py-2 bg-red-600 text-white rounded text-sm disabled:opacity-50">
                {aiWorking ? 'Scanning...' : 'Run Red Team Scan'}
              </button>
              {scannedPrompts.length > 0 && (
                <div className="mt-4 space-y-2">
                  {(scannedPrompts as Array<Record<string, string>>).map((p, i) => (
                    <div key={i} className="border rounded p-3 bg-gray-50">
                      <div className="flex gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${SEV_COLOR[p.severity] ?? 'bg-gray-100 text-gray-600'}`}>{p.severity}</span>
                        <span className="text-xs text-gray-500">{p.attack_type?.replace(/_/g, ' ')}</span>
                      </div>
                      <div className="text-sm font-medium text-gray-700 mb-1">{p.prompt}</div>
                      <div className="text-xs text-gray-500">Risk: {p.expected_risk}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg border p-6">
              <h2 className="font-semibold text-gray-700 mb-2">Cost Optimizer</h2>
              <p className="text-sm text-gray-500 mb-4">Ollama analyzes your current AI spend and suggests cheaper alternatives</p>
              <button onClick={runCostOptimizer} disabled={aiWorking} className="px-4 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50">
                {aiWorking ? 'Analyzing...' : 'Get Cost Optimization Recommendations'}
              </button>
              {aiResult && (
                <div className="mt-4 bg-blue-50 border border-blue-100 rounded p-4 text-sm text-gray-700 whitespace-pre-wrap">{aiResult}</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
