'use client';

import { useState, useEffect, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface AgentRun {
  run_id: string;
  agent_name: string;
  model_used: string;
  status: 'success' | 'failed' | 'running';
  input_text: string | null;
  output_text: string | null;
  tokens_used: number | null;
  cost_usd: string | null;
  latency_ms: number | null;
  started_at: string;
  completed_at: string | null;
}

interface TraceStep {
  id: number;
  run_id: string;
  step_number: number;
  action_type: string;
  input_text: string | null;
  output_text: string | null;
  latency_ms: number | null;
  status: string;
  created_at: string;
}

interface Alert {
  id: number;
  metric: string;
  threshold: string;
  operator: string;
  is_active: boolean;
  created_at: string;
}

interface CostByModel {
  model: string;
  cost: string;
}

interface AgentOpsData {
  runs: AgentRun[];
  traces: TraceStep[];
  alerts: Alert[];
  cost_summary: { today: number; month_to_date: number; by_model: CostByModel[] };
}

type Tab = 'runs' | 'traces' | 'cost' | 'alerts' | 'integrations';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    success: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    running: 'bg-blue-100 text-blue-800',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${map[status] ?? 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  );
}

function truncate(text: string | null, len = 60) {
  if (!text) return '—';
  return text.length > len ? text.slice(0, len) + '…' : text;
}

function fmt(ts: string | null) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString();
}

// Fake CSS sparkline for daily costs
function CostBar({ pct, label }: { pct: number; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 text-right text-gray-500 shrink-0">{label}</span>
      <div className="flex-1 bg-gray-100 rounded h-4 overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded"
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </div>
      <span className="w-10 text-gray-600">{pct.toFixed(0)}%</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function AgentOpsPage() {
  const [data, setData] = useState<AgentOpsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('runs');
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [alertForm, setAlertForm] = useState({ metric: '', threshold: '', operator: '>' });
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/agentops');
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json() as AgentOpsData;
      setData(json);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleToggleAlert = async (id: number, is_active: boolean) => {
    await fetch('/api/admin/agentops', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity: 'alert', id, is_active: !is_active }),
    });
    await fetchData();
  };

  const handleAddAlert = async () => {
    if (!alertForm.metric || !alertForm.threshold) return;
    setSubmitting(true);
    await fetch('/api/admin/agentops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'new_alert', ...alertForm, threshold: parseFloat(alertForm.threshold) }),
    });
    setAlertForm({ metric: '', threshold: '', operator: '>' });
    setSubmitting(false);
    await fetchData();
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'runs', label: 'Runs' },
    { id: 'traces', label: 'Traces' },
    { id: 'cost', label: 'Cost Tracker' },
    { id: 'alerts', label: 'Alerts' },
    { id: 'integrations', label: 'Integrations' },
  ];

  if (loading) return <div className="p-8 text-gray-500">Loading AgentOps data…</div>;
  if (error) return <div className="p-8 text-red-600">Error: {error}</div>;
  if (!data) return null;

  const totalRuns = data.runs.length;
  const successCount = data.runs.filter(r => r.status === 'success').length;
  const successRate = totalRuns ? Math.round((successCount / totalRuns) * 100) : 0;
  const avgLatency = data.runs.filter(r => r.latency_ms).reduce((s, r) => s + (r.latency_ms ?? 0), 0) /
    (data.runs.filter(r => r.latency_ms).length || 1);
  const activeNow = data.runs.filter(r => r.status === 'running').length;

  const tracesByRun = data.traces.filter(t => t.run_id === selectedRun);

  const maxModelCost = Math.max(...data.cost_summary.by_model.map(m => parseFloat(m.cost) || 0), 0.01);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">AgentOps</h1>
        <p className="text-gray-500 text-sm mt-1">Monitor, trace, and cost-track every agent run</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Runs', value: totalRuns, color: 'text-gray-800' },
          { label: 'Success Rate', value: `${successRate}%`, color: 'text-green-600' },
          { label: 'Avg Latency', value: `${Math.round(avgLatency)}ms`, color: 'text-blue-600' },
          { label: 'Active Now', value: activeNow, color: 'text-orange-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Runs Tab */}
      {activeTab === 'runs' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Run ID', 'Agent', 'Start Time', 'Duration', 'Status', 'Input', 'Output', 'Model', 'Tokens', 'Cost ($)'].map(h => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.runs.map(r => (
                <tr
                  key={r.run_id}
                  className="hover:bg-blue-50 cursor-pointer"
                  onClick={() => { setSelectedRun(r.run_id); setActiveTab('traces'); }}
                >
                  <td className="px-3 py-3 font-mono text-xs text-blue-700 hover:underline">{r.run_id}</td>
                  <td className="px-3 py-3 text-xs text-gray-700 whitespace-nowrap">{r.agent_name}</td>
                  <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">{fmt(r.started_at)}</td>
                  <td className="px-3 py-3 text-xs text-gray-500">{r.latency_ms ? `${r.latency_ms}ms` : '—'}</td>
                  <td className="px-3 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-3 py-3 text-xs text-gray-500 max-w-[120px] truncate">{truncate(r.input_text, 40)}</td>
                  <td className="px-3 py-3 text-xs text-gray-500 max-w-[120px] truncate">{truncate(r.output_text, 40)}</td>
                  <td className="px-3 py-3 text-xs text-indigo-600">{r.model_used}</td>
                  <td className="px-3 py-3 text-xs text-gray-500">{r.tokens_used ?? '—'}</td>
                  <td className="px-3 py-3 text-xs text-gray-700">{r.cost_usd ? `$${parseFloat(r.cost_usd).toFixed(4)}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Traces Tab */}
      {activeTab === 'traces' && (
        <div className="space-y-4">
          <div className="flex gap-3 items-center">
            <label className="text-sm text-gray-600 font-medium">Select Run:</label>
            <select
              className="border border-gray-300 rounded px-3 py-1.5 text-sm"
              value={selectedRun ?? ''}
              onChange={e => setSelectedRun(e.target.value)}
            >
              <option value="">— pick a run —</option>
              {data.runs.map(r => (
                <option key={r.run_id} value={r.run_id}>{r.run_id} ({r.agent_name})</option>
              ))}
            </select>
          </div>
          {selectedRun && tracesByRun.length > 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Step', 'Action', 'Input', 'Output', 'Latency', 'Status'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tracesByRun.map(t => (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-center font-bold text-gray-700">{t.step_number}</td>
                      <td className="px-4 py-3">
                        <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs">{t.action_type}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-xs">{truncate(t.input_text)}</td>
                      <td className="px-4 py-3 text-xs text-gray-700 max-w-xs">{truncate(t.output_text)}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{t.latency_ms ? `${t.latency_ms}ms` : '—'}</td>
                      <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : selectedRun ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-4 text-yellow-700 text-sm">
              No trace steps recorded for this run. Steps are logged only for tracked runs.
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded p-4 text-gray-500 text-sm">
              Click a run in the Runs tab, or select one above, to view its trace.
            </div>
          )}
        </div>
      )}

      {/* Cost Tracker Tab */}
      {activeTab === 'cost' && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Daily Cost Overview</h3>
            <div className="space-y-2">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => (
                <CostBar key={day} label={day} pct={[22, 45, 60, 38, 75, 55, 30][i]} />
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between text-sm">
              <span className="text-gray-500">Today</span>
              <span className="font-bold text-gray-800">${data.cost_summary.today.toFixed(4)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Month-to-date</span>
              <span className="font-bold text-gray-800">${data.cost_summary.month_to_date.toFixed(4)}</span>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Cost by Model</h3>
            {data.cost_summary.by_model.length > 0 ? (
              <div className="space-y-3">
                {data.cost_summary.by_model.map(m => (
                  <div key={m.model}>
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>{m.model}</span>
                      <span>${parseFloat(m.cost).toFixed(4)}</span>
                    </div>
                    <div className="bg-gray-100 rounded h-3">
                      <div
                        className="h-full bg-indigo-500 rounded"
                        style={{ width: `${(parseFloat(m.cost) / maxModelCost) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-sm">No model cost data yet.</p>
            )}
          </div>
        </div>
      )}

      {/* Alerts Tab */}
      {activeTab === 'alerts' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-medium text-gray-800 mb-3">Add Alert</h3>
            <div className="flex gap-3 flex-wrap">
              <input
                className="border border-gray-300 rounded px-3 py-1.5 text-sm flex-1 min-w-[160px]"
                placeholder="Metric (e.g. latency_ms)"
                value={alertForm.metric}
                onChange={e => setAlertForm(f => ({ ...f, metric: e.target.value }))}
              />
              <select
                className="border border-gray-300 rounded px-3 py-1.5 text-sm"
                value={alertForm.operator}
                onChange={e => setAlertForm(f => ({ ...f, operator: e.target.value }))}
              >
                {['>', '<', '>=', '<=', '='].map(op => <option key={op}>{op}</option>)}
              </select>
              <input
                className="border border-gray-300 rounded px-3 py-1.5 text-sm w-32"
                placeholder="Threshold"
                value={alertForm.threshold}
                onChange={e => setAlertForm(f => ({ ...f, threshold: e.target.value }))}
              />
              <button
                onClick={handleAddAlert}
                disabled={submitting}
                className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Adding…' : 'Add Alert'}
              </button>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Metric', 'Condition', 'Active', 'Created', 'Action'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.alerts.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{a.metric}</td>
                    <td className="px-4 py-3 font-mono text-sm text-gray-600">{a.operator} {a.threshold}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${a.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-500'}`}>
                        {a.is_active ? 'Active' : 'Paused'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{fmt(a.created_at)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleAlert(a.id, a.is_active)}
                        className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                      >
                        {a.is_active ? 'Pause' : 'Enable'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Integrations Tab */}
      {activeTab === 'integrations' && (
        <div className="grid md:grid-cols-2 gap-4">
          {[
            { name: 'LangSmith', status: 'not configured', description: 'LangChain observability — trace, evaluate, and monitor LLM apps' },
            { name: 'Langfuse', status: 'not configured', description: 'Open-source LLM observability with prompt management and evals' },
            { name: 'Phoenix (Arize)', status: 'not configured', description: 'ML observability platform for LLM and ML model monitoring' },
            { name: 'Weights & Biases', status: 'not configured', description: 'Experiment tracking, model versioning, and dataset management' },
          ].map(integ => (
            <div key={integ.name} className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex justify-between items-start mb-2">
                <span className="font-semibold text-gray-800">{integ.name}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${integ.status === 'connected' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                  {integ.status}
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-3">{integ.description}</p>
              <input
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                placeholder="API Key"
                type="password"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
