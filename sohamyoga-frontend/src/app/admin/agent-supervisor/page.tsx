'use client';

import { useState, useEffect, useCallback } from 'react';

const BACKEND = 'http://127.0.0.1:8100';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Agent {
  name: string;
  description: string;
  model: string;
  tools: string[];
  last_run_status: string | null;
  last_run_at: string | null;
  last_run_id: number | null;
}

interface AgentRun {
  id: number;
  agent_name: string;
  task_input: string;
  task_output: string | null;
  status: string;
  langsmith_trace_url: string | null;
  langsmith_run_id: string | null;
  tokens_used: number | null;
  latency_ms: number | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

interface TestCase {
  id: number;
  agent_name: string;
  test_name: string;
  input: string;
  expected_output: string;
  actual_output: string | null;
  status: string;
  run_at: string | null;
  latency_ms: number | null;
}

interface TestResult {
  id: number;
  suite_name: string;
  run_at: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  log: string;
  duration_ms: number;
}

interface LangSmithConfig {
  configured: boolean;
  tracing_enabled: boolean;
  project: string;
  endpoint: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  success: 'bg-green-100 text-green-800',
  pass: 'bg-green-100 text-green-800',
  running: 'bg-blue-100 text-blue-800',
  pending: 'bg-gray-100 text-gray-600',
  failed: 'bg-red-100 text-red-800',
  fail: 'bg-red-100 text-red-800',
  skip: 'bg-yellow-100 text-yellow-700',
};

const STATUS_DOT: Record<string, string> = {
  success: 'bg-green-500',
  pass: 'bg-green-500',
  running: 'bg-blue-500 animate-pulse',
  pending: 'bg-gray-400',
  failed: 'bg-red-500',
  fail: 'bg-red-500',
  skip: 'bg-yellow-400',
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

function StatusDot({ status }: { status: string | null }) {
  const cls = status ? (STATUS_DOT[status] ?? 'bg-gray-400') : 'bg-gray-300';
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${cls}`} />;
}

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function useFetch<T>(url: string, deps: unknown[] = []): { data: T | null; loading: boolean; error: string | null; refetch: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    setLoading(true);
    fetch(url, { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then(d => { setData(d); setError(null); })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...deps]);

  useEffect(() => { refetch(); }, [refetch]);
  return { data, loading, error, refetch };
}

// ---------------------------------------------------------------------------
// Run Task Modal
// ---------------------------------------------------------------------------

function RunTaskModal({
  agent,
  onClose,
  onSuccess,
}: {
  agent: Agent;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [task, setTask] = useState('');
  const [contextRaw, setContextRaw] = useState('{}');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const handleRun = async () => {
    setRunning(true);
    setErr(null);
    setResult(null);
    try {
      let ctx = {};
      try { ctx = JSON.parse(contextRaw); } catch { /* ignore bad JSON */ }
      const resp = await fetch(`${BACKEND}/api/agents/${agent.name}/run`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, context: ctx }),
      });
      const data = await resp.json();
      setResult(data);
      if (data.status === 'success') onSuccess();
    } catch (e) {
      setErr(String(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Run: {agent.name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl">&times;</button>
        </div>
        <p className="text-sm text-gray-500 mb-4">{agent.description}</p>

        <label className="block text-sm font-medium text-gray-700 mb-1">Task description</label>
        <textarea
          className="w-full border border-gray-300 rounded-lg p-2.5 text-sm mb-3 resize-none"
          rows={3}
          placeholder="e.g. Generate an Instagram post about morning yoga"
          value={task}
          onChange={e => setTask(e.target.value)}
        />

        <label className="block text-sm font-medium text-gray-700 mb-1">Context JSON (optional)</label>
        <textarea
          className="w-full border border-gray-300 rounded-lg p-2.5 text-sm font-mono mb-4 resize-none"
          rows={3}
          placeholder='{"platform": "instagram", "topic": "morning yoga"}'
          value={contextRaw}
          onChange={e => setContextRaw(e.target.value)}
        />

        {err && <p className="text-red-600 text-sm mb-3">{err}</p>}

        {result && (
          <div className={`rounded-lg p-3 mb-4 text-sm ${result.status === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <p className="font-medium mb-1">
              {result.status === 'success' ? 'Success' : 'Failed'} — run_id #{String(result.run_id)} ({result.latency_ms}ms)
            </p>
            <pre className="text-xs whitespace-pre-wrap overflow-auto max-h-32">{String(result.output ?? result.error ?? '')}</pre>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleRun}
            disabled={!task.trim() || running}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg py-2.5 disabled:opacity-50"
          >
            {running ? 'Running...' : 'Run Task'}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 1: Agents
// ---------------------------------------------------------------------------

function AgentsTab() {
  const { data: agents, loading, refetch } = useFetch<Agent[]>(`${BACKEND}/api/agents`);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  const runsToday = agents?.filter(a => a.last_run_at && a.last_run_at.startsWith(new Date().toISOString().slice(0, 10))).length ?? 0;
  const successCount = agents?.filter(a => a.last_run_status === 'success').length ?? 0;
  const successRate = agents?.length ? Math.round((successCount / agents.length) * 100) : 0;

  if (loading) return <div className="p-8 text-center text-gray-500">Loading agents...</div>;

  return (
    <div>
      {selectedAgent && (
        <RunTaskModal
          agent={selectedAgent}
          onClose={() => setSelectedAgent(null)}
          onSuccess={() => { setSelectedAgent(null); refetch(); }}
        />
      )}

      {/* KPI bar */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard label="Total Agents" value={agents?.length ?? 0} />
        <KpiCard label="Active (ran today)" value={runsToday} />
        <KpiCard label="Runs Today" value={runsToday} />
        <KpiCard label="Success Rate" value={`${successRate}%`} sub="based on last run per agent" />
      </div>

      {/* Agent cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {agents?.map(agent => (
          <div key={agent.name} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <StatusDot status={agent.last_run_status} />
                <h3 className="font-semibold text-gray-900 text-sm">{agent.name}</h3>
              </div>
              {agent.last_run_status && <StatusBadge status={agent.last_run_status} />}
            </div>
            <p className="text-xs text-gray-500 mb-3 line-clamp-2">{agent.description}</p>
            <p className="text-xs text-gray-400 mb-1">Model: {agent.model}</p>
            <p className="text-xs text-gray-400 mb-3">
              Tools: {agent.tools.join(', ')}
            </p>
            {agent.last_run_at && (
              <p className="text-xs text-gray-400 mb-3">Last run: {new Date(agent.last_run_at).toLocaleString()}</p>
            )}
            <button
              onClick={() => setSelectedAgent(agent)}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg py-2"
            >
              Run Task
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 2: Run History
// ---------------------------------------------------------------------------

function RunHistoryTab() {
  const { data: runs, loading, refetch } = useFetch<AgentRun[]>(`${BACKEND}/api/agents/runs?limit=100`);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (loading) return <div className="p-8 text-center text-gray-500">Loading runs...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-sm font-semibold text-gray-700">Recent Agent Runs</h2>
        <button onClick={refetch} className="text-xs text-indigo-600 hover:underline">Refresh</button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['ID', 'Agent', 'Task', 'Status', 'Tokens', 'Latency', 'LangSmith', 'Started', 'Error'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {runs?.map(run => (
              <>
                <tr
                  key={run.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === run.id ? null : run.id)}
                >
                  <td className="px-3 py-2 text-gray-500">#{run.id}</td>
                  <td className="px-3 py-2 font-medium text-gray-900">{run.agent_name}</td>
                  <td className="px-3 py-2 text-gray-600 max-w-xs truncate">{run.task_input?.slice(0, 80)}</td>
                  <td className="px-3 py-2"><StatusBadge status={run.status} /></td>
                  <td className="px-3 py-2 text-gray-500">{run.tokens_used ?? '-'}</td>
                  <td className="px-3 py-2 text-gray-500">{run.latency_ms != null ? `${run.latency_ms}ms` : '-'}</td>
                  <td className="px-3 py-2">
                    {run.langsmith_trace_url ? (
                      <a href={run.langsmith_trace_url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline text-xs">
                        View Trace
                      </a>
                    ) : '-'}
                  </td>
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                    {run.created_at ? new Date(run.created_at).toLocaleString() : '-'}
                  </td>
                  <td className="px-3 py-2 text-red-500 max-w-xs truncate">{run.error_message?.slice(0, 60) ?? '-'}</td>
                </tr>
                {expandedId === run.id && (
                  <tr key={`expand-${run.id}`}>
                    <td colSpan={9} className="px-3 py-3 bg-gray-50">
                      <div className="text-xs space-y-2">
                        <div>
                          <p className="font-medium text-gray-700 mb-1">Input:</p>
                          <pre className="whitespace-pre-wrap bg-white border rounded p-2 max-h-32 overflow-auto">{run.task_input}</pre>
                        </div>
                        {run.task_output && (
                          <div>
                            <p className="font-medium text-gray-700 mb-1">Output:</p>
                            <pre className="whitespace-pre-wrap bg-white border rounded p-2 max-h-32 overflow-auto">{run.task_output}</pre>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {!runs?.length && (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-gray-400">No runs yet — use the Agents tab to trigger your first run.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 3: Test Cases
// ---------------------------------------------------------------------------

function TestCasesTab() {
  const { data: cases, loading, refetch } = useFetch<TestCase[]>(`${BACKEND}/api/agents/test-cases`);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<Record<string, unknown> | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const handleRunAll = async () => {
    setRunning(true);
    setRunResult(null);
    try {
      const resp = await fetch(`${BACKEND}/api/agents/run-tests`, { method: 'POST', credentials: 'include' });
      const data = await resp.json();
      setRunResult(data);
      refetch();
    } catch (e) {
      setRunResult({ error: String(e) });
    } finally {
      setRunning(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading test cases...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-sm font-semibold text-gray-700">Seeded Test Cases ({cases?.length ?? 0})</h2>
        <button
          onClick={handleRunAll}
          disabled={running}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg px-4 py-2 disabled:opacity-50"
        >
          {running ? 'Running All Tests...' : 'Run All Tests'}
        </button>
      </div>

      {runResult && (
        <div className={`rounded-lg p-4 mb-4 text-sm ${runResult.error ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
          {runResult.error ? (
            <p className="text-red-700">{String(runResult.error)}</p>
          ) : (
            <>
              <div className="flex gap-4 mb-2 text-xs font-medium">
                <span className="text-green-700">Passed: {String(runResult.passed)}</span>
                <span className="text-red-700">Failed: {String(runResult.failed)}</span>
                <span className="text-yellow-700">Skipped: {String(runResult.skipped)}</span>
                <span className="text-gray-700">Duration: {String(runResult.duration_ms)}ms</span>
              </div>
              <pre className="text-xs whitespace-pre-wrap overflow-auto max-h-40 bg-white border rounded p-2">{String(runResult.log)}</pre>
            </>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['Agent', 'Test Name', 'Status', 'Latency', 'Last Run'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {cases?.map(tc => (
              <>
                <tr
                  key={tc.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === tc.id ? null : tc.id)}
                >
                  <td className="px-3 py-2 font-medium text-gray-900">{tc.agent_name}</td>
                  <td className="px-3 py-2 text-gray-600">{tc.test_name}</td>
                  <td className="px-3 py-2"><StatusBadge status={tc.status} /></td>
                  <td className="px-3 py-2 text-gray-500">{tc.latency_ms != null ? `${tc.latency_ms}ms` : '-'}</td>
                  <td className="px-3 py-2 text-gray-500">{tc.run_at ? new Date(tc.run_at).toLocaleString() : 'Not run'}</td>
                </tr>
                {expandedId === tc.id && (
                  <tr key={`expand-tc-${tc.id}`}>
                    <td colSpan={5} className="px-3 py-3 bg-gray-50">
                      <div className="text-xs space-y-2">
                        <div>
                          <p className="font-medium text-gray-700">Input:</p>
                          <pre className="whitespace-pre-wrap bg-white border rounded p-2">{tc.input}</pre>
                        </div>
                        <div>
                          <p className="font-medium text-gray-700">Expected:</p>
                          <pre className="whitespace-pre-wrap bg-white border rounded p-2">{tc.expected_output}</pre>
                        </div>
                        {tc.actual_output && (
                          <div>
                            <p className="font-medium text-gray-700">Actual:</p>
                            <pre className="whitespace-pre-wrap bg-white border rounded p-2 max-h-32 overflow-auto">{tc.actual_output}</pre>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 4: Test Results
// ---------------------------------------------------------------------------

function TestResultsTab() {
  const { data: results, loading } = useFetch<TestResult[]>(`${BACKEND}/api/agents/test-results`);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (loading) return <div className="p-8 text-center text-gray-500">Loading test results...</div>;

  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-700 mb-4">Test Suite History</h2>
      <div className="space-y-3">
        {results?.map(r => {
          const passRate = r.total > 0 ? Math.round((r.passed / r.total) * 100) : 0;
          return (
            <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
              >
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{r.suite_name}</p>
                    <p className="text-xs text-gray-500">{new Date(r.run_at).toLocaleString()}</p>
                  </div>
                  <div className="flex gap-3 text-xs">
                    <span className="text-green-700 font-medium">{r.passed} pass</span>
                    <span className="text-red-600 font-medium">{r.failed} fail</span>
                    <span className="text-yellow-600">{r.skipped} skip</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full" style={{ width: `${passRate}%` }} />
                  </div>
                  <span className="text-xs text-gray-600">{passRate}%</span>
                  <span className="text-xs text-gray-400">{r.duration_ms}ms</span>
                </div>
              </div>
              {expandedId === r.id && (
                <pre className="mt-3 text-xs whitespace-pre-wrap overflow-auto max-h-48 bg-gray-50 border rounded p-3">{r.log}</pre>
              )}
            </div>
          );
        })}
        {!results?.length && (
          <div className="text-center py-12 text-gray-400">No test results yet — run tests from the Test Cases tab.</div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 5: LangSmith
// ---------------------------------------------------------------------------

function LangSmithTab() {
  const { data: config } = useFetch<LangSmithConfig>(`${BACKEND}/api/agents/langsmith-config`);
  const { data: runs } = useFetch<AgentRun[]>(`${BACKEND}/api/agents/runs?limit=100`);
  const tracedRuns = runs?.filter(r => r.langsmith_trace_url) ?? [];

  return (
    <div className="space-y-6">
      {/* Config panel */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">LangSmith Configuration</h2>
        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
          <div>
            <p className="text-gray-500 text-xs uppercase mb-1">API Key Configured</p>
            <span className={`font-medium ${config?.configured ? 'text-green-700' : 'text-red-600'}`}>
              {config?.configured ? 'Yes' : 'No'}
            </span>
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase mb-1">Tracing Enabled</p>
            <span className={`font-medium ${config?.tracing_enabled ? 'text-green-700' : 'text-gray-600'}`}>
              {config?.tracing_enabled ? 'Active' : 'Disabled'}
            </span>
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase mb-1">Project</p>
            <span className="font-mono text-gray-700">{config?.project}</span>
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase mb-1">Endpoint</p>
            <span className="font-mono text-gray-700 text-xs">{config?.endpoint}</span>
          </div>
        </div>

        {!config?.configured && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800 mb-4">
            <p className="font-medium mb-1">How to enable LangSmith tracing</p>
            <ol className="list-decimal list-inside space-y-1 text-xs">
              <li>Sign up at <a href="https://smith.langchain.com" className="underline" target="_blank" rel="noopener noreferrer">smith.langchain.com</a></li>
              <li>Copy your API key from Settings → API Keys</li>
              <li>Add to <code className="font-mono bg-amber-100 px-1">backend/.env</code>: <code className="font-mono bg-amber-100 px-1">LANGCHAIN_API_KEY=ls__...</code></li>
              <li>Restart the backend: <code className="font-mono bg-amber-100 px-1">./run.sh</code></li>
            </ol>
          </div>
        )}

        <div className="flex gap-3">
          <a
            href="https://smith.langchain.com"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg px-4 py-2"
          >
            Open LangSmith Dashboard
          </a>
          <a
            href="http://127.0.0.1:7860"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg px-4 py-2"
          >
            Open LangFlow Builder
          </a>
        </div>
      </div>

      {/* Recent traced runs */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Recent Traced Runs ({tracedRuns.length})</h2>
        {tracedRuns.length === 0 ? (
          <p className="text-sm text-gray-400">No traced runs yet — configure LangSmith and run some agents.</p>
        ) : (
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                {['Agent', 'Status', 'Latency', 'Trace Link', 'Started'].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tracedRuns.map(r => (
                <tr key={r.id}>
                  <td className="px-3 py-2 font-medium">{r.agent_name}</td>
                  <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                  <td className="px-3 py-2">{r.latency_ms != null ? `${r.latency_ms}ms` : '-'}</td>
                  <td className="px-3 py-2">
                    <a href={r.langsmith_trace_url!} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                      View
                    </a>
                  </td>
                  <td className="px-3 py-2 text-gray-500">{new Date(r.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 6: Workflows
// ---------------------------------------------------------------------------

function WorkflowsTab() {
  const [workflows, setWorkflows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [triggerResult, setTriggerResult] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    // Try to load workflows from the sohamyoga PostgreSQL via a future API endpoint
    // For now, show a helpful placeholder — the workflow engine is in sohamyoga-frontend
    setWorkflows([]);
    setLoading(false);
  }, []);

  const handleTrigger = async (workflowId: string) => {
    setTriggering(workflowId);
    setTriggerResult(null);
    try {
      const resp = await fetch(`${BACKEND}/api/agents/supervisor/run`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: `execute workflow ${workflowId}`, context: { workflow_id: workflowId } }),
      });
      const data = await resp.json();
      setTriggerResult(data);
    } catch (e) {
      setTriggerResult({ error: String(e) });
    } finally {
      setTriggering(null);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading workflows...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-sm font-semibold text-gray-700">Platform Workflows</h2>
      </div>

      {triggerResult && (
        <div className="rounded-lg p-4 mb-4 text-sm bg-blue-50 border border-blue-200">
          <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(triggerResult, null, 2)}</pre>
        </div>
      )}

      {workflows.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-500 text-sm mb-2">No workflows connected yet.</p>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            Workflows are managed in the sohamyoga platform_workflow table.
            Future versions will load them here for supervisor-triggered execution.
          </p>
          <button
            onClick={() => handleTrigger('demo')}
            disabled={triggering === 'demo'}
            className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg px-4 py-2 disabled:opacity-50"
          >
            {triggering === 'demo' ? 'Triggering...' : 'Trigger Demo Workflow via Supervisor'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {workflows.map((wf, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{String(wf.name ?? 'Workflow')}</p>
                <p className="text-xs text-gray-500">Trigger: {String(wf.trigger ?? '-')}</p>
              </div>
              <button
                onClick={() => handleTrigger(String(wf.id ?? i))}
                disabled={triggering === String(wf.id ?? i)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg px-3 py-1.5 disabled:opacity-50"
              >
                {triggering === String(wf.id ?? i) ? 'Triggering...' : 'Trigger'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

const TABS = [
  { id: 'agents', label: 'Agents' },
  { id: 'runs', label: 'Run History' },
  { id: 'test-cases', label: 'Test Cases' },
  { id: 'test-results', label: 'Test Results' },
  { id: 'langsmith', label: 'LangSmith' },
  { id: 'workflows', label: 'Workflows' },
] as const;

type TabId = typeof TABS[number]['id'];

export default function AgentSupervisorPage() {
  const [activeTab, setActiveTab] = useState<TabId>('agents');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-6 py-6 max-w-screen-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Agent Supervisor</h1>
          <p className="text-sm text-gray-500 mt-1">
            LangGraph multi-agent supervisor — content, analytics, reviews, scheduling
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'agents' && <AgentsTab />}
        {activeTab === 'runs' && <RunHistoryTab />}
        {activeTab === 'test-cases' && <TestCasesTab />}
        {activeTab === 'test-results' && <TestResultsTab />}
        {activeTab === 'langsmith' && <LangSmithTab />}
        {activeTab === 'workflows' && <WorkflowsTab />}
      </div>
    </div>
  );
}
