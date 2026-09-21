'use client';

import { useState, useEffect, useCallback } from 'react';

interface TaskMapping {
  id: number;
  input_type: string;
  subtask_name: string;
  model_type: string;
  model_name: string;
  agent_type: string;
  agent_name: string;
  avg_latency_ms: number;
  is_active: boolean;
}

interface Execution {
  id: number;
  execution_id: string;
  input_type: string;
  input_data: string | null;
  status: string;
  started_at: string;
  completed_at: string | null;
  subtask_count: number;
  total_latency_ms: number;
}

interface AIModel {
  id: number;
  model_id: string;
  model_name: string;
  model_type: string;
  provider: string;
  status: string;
  last_used_at: string | null;
}

interface Agent {
  id: number;
  agent_id: string;
  agent_name: string;
  agent_type: string;
  capabilities: string[];
  status: string;
  active_tasks: number;
}

interface ApiResponse {
  mappings: TaskMapping[];
  executions: Execution[];
  models: AIModel[];
  agents: Agent[];
  generated_at: string;
}

const MODEL_TYPE_COLORS: Record<string, string> = {
  'Transformer/LLM': 'bg-purple-100 text-purple-800',
  'ML/Deep Learning': 'bg-blue-100 text-blue-800',
  'Statistical': 'bg-cyan-100 text-cyan-800',
  'Rule-Based': 'bg-gray-100 text-gray-700',
  'Time Series': 'bg-indigo-100 text-indigo-800',
  'Probabilistic': 'bg-teal-100 text-teal-800',
  'Deterministic': 'bg-slate-100 text-slate-700',
  'Computer Vision': 'bg-orange-100 text-orange-800',
  'NLP': 'bg-green-100 text-green-800',
  'Reinforcement Learning': 'bg-rose-100 text-rose-800',
};

const AGENT_TYPE_COLORS: Record<string, string> = {
  'Single Agent': 'bg-blue-50 text-blue-700',
  'Multi-Agent': 'bg-violet-50 text-violet-700',
  'Agent Mesh': 'bg-pink-50 text-pink-700',
  'Supervisor Agent': 'bg-amber-50 text-amber-700',
  'Pipeline Agent': 'bg-emerald-50 text-emerald-700',
  'Tool-Use Agent': 'bg-sky-50 text-sky-700',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  idle: 'bg-gray-100 text-gray-600',
  loading: 'bg-yellow-100 text-yellow-700',
  running: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  failed: 'bg-red-100 text-red-700',
};

const INPUT_TYPES = [
  'Generate Marketing Content',
  'Analyze Campaign Performance',
  'Process Customer Order',
  'Social Media Post',
  'Video Generation Request',
  'Email Campaign',
  'SEO Analysis',
  'Product Recommendation',
];

export default function AgentTaskMappingPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'taskmap' | 'live' | 'models' | 'agents' | 'config'>('taskmap');
  const [selectedInput, setSelectedInput] = useState<string>(INPUT_TYPES[0]);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/agent-task-mapping');
      if (res.ok) {
        const json: ApiResponse = await res.json();
        setData(json);
      }
    } catch {
      // network error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredMappings = (data?.mappings ?? []).filter((m) => m.input_type === selectedInput);

  const allInputTypes = Array.from(new Set((data?.mappings ?? []).map((m) => m.input_type)));

  const modelTypes = Array.from(new Set((data?.models ?? []).map((m) => m.model_type)));

  const summary = {
    totalMappings: data?.mappings.length ?? 0,
    activeAgents: (data?.agents ?? []).filter((a) => a.status === 'active').length,
    modelTypes: Array.from(new Set((data?.models ?? []).map((m) => m.model_type))).length,
    avgSubtasks:
      allInputTypes.length > 0
        ? Math.round(
            allInputTypes.reduce((sum, t) => {
              const count = (data?.mappings ?? []).filter((m) => m.input_type === t).length;
              return sum + count;
            }, 0) / allInputTypes.length,
          )
        : 0,
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-64">
        <div className="text-gray-500">Loading Agent Task Mapping...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Agent Task Mapping</h1>
        <p className="text-sm text-gray-500 mt-1">
          How user inputs break into subtasks and get routed to models and agents
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-500">Total Mappings</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{summary.totalMappings}</div>
        </div>
        <div className="bg-white border border-blue-200 rounded-lg p-4">
          <div className="text-sm text-blue-600">Active Agents</div>
          <div className="text-3xl font-bold text-blue-700 mt-1">{summary.activeAgents}</div>
        </div>
        <div className="bg-white border border-purple-200 rounded-lg p-4">
          <div className="text-sm text-purple-600">Model Types</div>
          <div className="text-3xl font-bold text-purple-700 mt-1">{summary.modelTypes}</div>
        </div>
        <div className="bg-white border border-green-200 rounded-lg p-4">
          <div className="text-sm text-green-600">Avg Subtasks / Input</div>
          <div className="text-3xl font-bold text-green-700 mt-1">{summary.avgSubtasks}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex -mb-px space-x-6">
          {(
            [
              { key: 'taskmap', label: 'Task Map' },
              { key: 'live', label: 'Live Execution' },
              { key: 'models', label: 'Model Registry' },
              { key: 'agents', label: 'Agent Registry' },
              { key: 'config', label: 'Config' },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === key
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Task Map Tab */}
      {activeTab === 'taskmap' && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Input Type:</label>
            <select
              value={selectedInput}
              onChange={(e) => setSelectedInput(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-800 min-w-64"
            >
              {INPUT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <span className="text-sm text-gray-500">{filteredMappings.length} subtasks</span>
          </div>

          {filteredMappings.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
              No mappings found for this input type
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">{selectedInput}</h3>
                <p className="text-xs text-gray-500 mt-0.5">Pipeline of {filteredMappings.length} subtasks</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">#</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Subtask</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Model Type</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Model Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Agent Type</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Agent Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Avg Latency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredMappings.map((m, idx) => {
                      const modelColor = MODEL_TYPE_COLORS[m.model_type] ?? 'bg-gray-100 text-gray-700';
                      const agentColor = AGENT_TYPE_COLORS[m.agent_type] ?? 'bg-gray-100 text-gray-700';
                      return (
                        <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>
                          <td className="px-4 py-3 text-gray-800 font-medium text-sm">{m.subtask_name}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${modelColor}`}>
                              {m.model_type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600 font-mono">{m.model_name}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${agentColor}`}>
                              {m.agent_type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600">{m.agent_name}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                              Active
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600 font-mono">
                            {m.avg_latency_ms >= 1000
                              ? `${(m.avg_latency_ms / 1000).toFixed(1)}s`
                              : `${m.avg_latency_ms}ms`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
                <span>
                  Total pipeline latency:{' '}
                  <strong className="text-gray-700">
                    {(filteredMappings.reduce((sum, m) => sum + m.avg_latency_ms, 0) / 1000).toFixed(1)}s
                  </strong>
                </span>
                <span>Estimated sequential execution time</span>
              </div>
            </div>
          )}

          {/* Model type legend */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Model Type Legend</h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(MODEL_TYPE_COLORS).map(([type, cls]) => (
                <span key={type} className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
                  {type}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Live Execution Tab */}
      {activeTab === 'live' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Execution History</h2>
            <button
              onClick={() => {
                const inputType = INPUT_TYPES[Math.floor(Math.random() * INPUT_TYPES.length)];
                fetch('/api/admin/agent-task-mapping', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ input_type: inputType, input_data: `Test run for ${inputType}` }),
                }).then(() => fetchData());
              }}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
            >
              Simulate Execution
            </button>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Execution ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Input Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Input Data</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Subtasks</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Latency</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Started</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(data?.executions ?? []).map((exec) => {
                    const statusCls = STATUS_COLORS[exec.status] ?? 'bg-gray-100 text-gray-600';
                    return (
                      <tr key={exec.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{exec.execution_id}</td>
                        <td className="px-4 py-3 text-sm text-gray-800">{exec.input_type}</td>
                        <td className="px-4 py-3 text-xs text-gray-600 max-w-xs">
                          <div className="truncate" title={exec.input_data ?? ''}>
                            {exec.input_data ?? '—'}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${statusCls}`}>
                            {exec.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">{exec.subtask_count}</td>
                        <td className="px-4 py-3 text-xs text-gray-600 font-mono">
                          {exec.total_latency_ms > 0
                            ? `${(exec.total_latency_ms / 1000).toFixed(2)}s`
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {new Date(exec.started_at).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Model Registry Tab */}
      {activeTab === 'models' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Registered Models</h2>

          {/* Group by model type */}
          {modelTypes.map((mType) => {
            const typeModels = (data?.models ?? []).filter((m) => m.model_type === mType);
            const typeColor = MODEL_TYPE_COLORS[mType] ?? 'bg-gray-100 text-gray-700';
            return (
              <div key={mType} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeColor}`}>{mType}</span>
                  <span className="text-xs text-gray-500">{typeModels.length} model{typeModels.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="divide-y divide-gray-100">
                  {typeModels.map((model) => {
                    const statusCls = STATUS_COLORS[model.status] ?? 'bg-gray-100 text-gray-600';
                    return (
                      <div key={model.id} className="px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div>
                            <div className="text-sm font-medium text-gray-800">{model.model_name}</div>
                            <div className="text-xs text-gray-500">Provider: {model.provider}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {model.last_used_at && (
                            <span className="text-xs text-gray-400">
                              last used {new Date(model.last_used_at).toLocaleDateString()}
                            </span>
                          )}
                          <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${statusCls}`}>
                            {model.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Agent Registry Tab */}
      {activeTab === 'agents' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Registered Agents</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(data?.agents ?? []).map((agent) => {
              const agentColor = AGENT_TYPE_COLORS[agent.agent_type] ?? 'bg-gray-100 text-gray-700';
              const statusCls = STATUS_COLORS[agent.status] ?? 'bg-gray-100 text-gray-600';
              return (
                <div key={agent.id} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-semibold text-gray-900">{agent.agent_name}</div>
                      <div className="font-mono text-xs text-gray-400 mt-0.5">{agent.agent_id}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${statusCls}`}>
                        {agent.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${agentColor}`}>
                      {agent.agent_type}
                    </span>
                    {agent.active_tasks > 0 && (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                        {agent.active_tasks} active task{agent.active_tasks !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Capabilities:</div>
                    <div className="flex flex-wrap gap-1">
                      {(Array.isArray(agent.capabilities) ? agent.capabilities : []).map((cap) => (
                        <span
                          key={cap}
                          className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs"
                        >
                          {cap}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Config Tab */}
      {activeTab === 'config' && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-5">
          <h2 className="text-lg font-semibold text-gray-900">Agent Task Mapping Config</h2>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Default LLM Provider</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
                <option>Ollama (local)</option>
                <option>OpenAI API</option>
                <option>HuggingFace Inference</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Max Parallel Agents</label>
              <input
                type="number"
                defaultValue={5}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Task Timeout (seconds)</label>
              <input
                type="number"
                defaultValue={30}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Retry Policy</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
                <option>Retry once on failure</option>
                <option>Retry 3 times</option>
                <option>No retry</option>
              </select>
            </div>
          </div>
          <div className="pt-2">
            <button className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">
              Save Config
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
