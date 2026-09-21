'use client';

import { useState, useEffect, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Agent {
  agent_id: string;
  name: string;
  description: string;
  agent_type: string;
  base_model: string;
  tools: string[];
  max_iterations: number;
  system_prompt: string;
  status: 'production' | 'testing' | 'draft';
  version: string;
  created_at: string;
}

interface Blueprint {
  blueprint_id: string;
  name: string;
  description: string;
  agent_type: string;
  base_model: string;
  tools: string[];
  is_deployed: boolean;
}

interface Evaluation {
  id: number;
  agent_id: string;
  eval_dataset: string;
  metric: string;
  score: string;
  test_cases_run: number;
  passed: number;
  created_at: string;
}

interface Deployment {
  id: number;
  agent_id: string;
  version: string;
  environment: string;
  deployed_by: string;
  status: string;
  deployed_at: string;
}

interface AgentEngData {
  agents: Agent[];
  blueprints: Blueprint[];
  evaluations: Evaluation[];
  deployments: Deployment[];
}

type Tab = 'catalog' | 'builder' | 'blueprints' | 'evaluation' | 'deployment';

const ALL_TOOLS = ['web_search', 'code_exec', 'db_query', 'file_read', 'api_call', 'email', 'calendar'];
const AGENT_TYPES = ['ReAct', 'Chain', 'Plan&Execute', 'Tool-Use', 'RAG', 'Custom'];
const BASE_MODELS = ['gpt-4o', 'claude-3-5', 'llama3.1', 'mixtral-8x7b', 'gemini-1.5'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    production: 'bg-green-100 text-green-800',
    testing: 'bg-yellow-100 text-yellow-800',
    draft: 'bg-gray-100 text-gray-600',
    success: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

function fmt(ts: string) {
  return new Date(ts).toLocaleDateString();
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function AgentEngineeringPage() {
  const [data, setData] = useState<AgentEngData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('catalog');
  const [submitting, setSubmitting] = useState(false);

  const [builderForm, setBuilderForm] = useState({
    name: '', description: '', agent_type: 'ReAct', base_model: 'gpt-4o',
    tools: [] as string[], max_iterations: 5, system_prompt: '',
  });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/agent-engineering');
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json() as AgentEngData;
      setData(json);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreateAgent = async () => {
    if (!builderForm.name) return;
    setSubmitting(true);
    await fetch('/api/admin/agent-engineering', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create_agent', ...builderForm }),
    });
    setSubmitting(false);
    await fetchData();
    setActiveTab('catalog');
  };

  const handleDeployBlueprint = async (blueprintId: string) => {
    await fetch('/api/admin/agent-engineering', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'deploy_blueprint', blueprint_id: blueprintId, environment: 'prod' }),
    });
    await fetchData();
  };

  const handleToolToggle = (tool: string) => {
    setBuilderForm(f => ({
      ...f,
      tools: f.tools.includes(tool) ? f.tools.filter(t => t !== tool) : [...f.tools, tool],
    }));
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'catalog', label: 'Agent Catalog' },
    { id: 'builder', label: 'Builder' },
    { id: 'blueprints', label: 'Blueprints' },
    { id: 'evaluation', label: 'Evaluation' },
    { id: 'deployment', label: 'Deployment' },
  ];

  if (loading) return <div className="p-8 text-gray-500">Loading Agent Engineering data…</div>;
  if (error) return <div className="p-8 text-red-600">Error: {error}</div>;
  if (!data) return null;

  const prodCount = data.agents.filter(a => a.status === 'production').length;
  const testCount = data.agents.filter(a => a.status === 'testing').length;
  const blueprintCount = data.blueprints.length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Agent Engineering</h1>
        <p className="text-gray-500 text-sm mt-1">Build, evaluate, and deploy AI agents</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Agents', value: data.agents.length, color: 'text-gray-800' },
          { label: 'Deployed', value: prodCount, color: 'text-green-600' },
          { label: 'In Testing', value: testCount, color: 'text-yellow-600' },
          { label: 'Blueprints', value: blueprintCount, color: 'text-indigo-600' },
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

      {/* Catalog Tab */}
      {activeTab === 'catalog' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Name', 'Type', 'Version', 'Status', 'Capabilities', 'Last Updated', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.agents.map(a => (
                <tr key={a.agent_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{a.name}</div>
                    <div className="text-xs text-gray-400">{a.description.slice(0, 60)}…</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-xs">{a.agent_type}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{a.version}</td>
                  <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(a.tools || []).slice(0, 3).map(tool => (
                        <span key={tool} className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-xs">{tool}</span>
                      ))}
                      {(a.tools || []).length > 3 && (
                        <span className="text-gray-400 text-xs">+{(a.tools || []).length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{fmt(a.created_at)}</td>
                  <td className="px-4 py-3">
                    <button className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Builder Tab */}
      {activeTab === 'builder' && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 max-w-2xl">
          <h2 className="font-semibold text-gray-800 mb-4">Define New Agent</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                value={builderForm.name}
                onChange={e => setBuilderForm(f => ({ ...f, name: e.target.value }))}
                placeholder="My Custom Agent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                value={builderForm.description}
                onChange={e => setBuilderForm(f => ({ ...f, description: e.target.value }))}
                placeholder="What does this agent do?"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Agent Type</label>
                <select
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  value={builderForm.agent_type}
                  onChange={e => setBuilderForm(f => ({ ...f, agent_type: e.target.value }))}
                >
                  {AGENT_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Base Model</label>
                <select
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  value={builderForm.base_model}
                  onChange={e => setBuilderForm(f => ({ ...f, base_model: e.target.value }))}
                >
                  {BASE_MODELS.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tools</label>
              <div className="flex flex-wrap gap-2">
                {ALL_TOOLS.map(tool => (
                  <button
                    key={tool}
                    onClick={() => handleToolToggle(tool)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      builderForm.tools.includes(tool)
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                    }`}
                  >
                    {tool}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Iterations: <strong>{builderForm.max_iterations}</strong>
              </label>
              <input
                type="range" min={1} max={20} value={builderForm.max_iterations}
                onChange={e => setBuilderForm(f => ({ ...f, max_iterations: Number(e.target.value) }))}
                className="w-full accent-blue-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">System Prompt</label>
              <textarea
                rows={4}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono"
                value={builderForm.system_prompt}
                onChange={e => setBuilderForm(f => ({ ...f, system_prompt: e.target.value }))}
                placeholder="You are a helpful AI assistant..."
              />
            </div>
            <button
              onClick={handleCreateAgent}
              disabled={submitting || !builderForm.name}
              className="px-6 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Creating…' : 'Create Agent'}
            </button>
          </div>
        </div>
      )}

      {/* Blueprints Tab */}
      {activeTab === 'blueprints' && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.blueprints.map(bp => (
            <div key={bp.blueprint_id} className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-gray-800">{bp.name}</h3>
                {bp.is_deployed && (
                  <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs">Deployed</span>
                )}
              </div>
              <p className="text-xs text-gray-500 mb-3">{bp.description}</p>
              <div className="flex items-center gap-2 mb-3 flex-wrap text-xs">
                <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">{bp.agent_type}</span>
                <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{bp.base_model}</span>
              </div>
              <div className="flex flex-wrap gap-1 mb-4">
                {(bp.tools || []).map(t => (
                  <span key={t} className="bg-gray-50 border border-gray-200 text-gray-600 px-1.5 py-0.5 rounded text-xs">{t}</span>
                ))}
              </div>
              <button
                onClick={() => handleDeployBlueprint(bp.blueprint_id)}
                className="w-full py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              >
                Deploy
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Evaluation Tab */}
      {activeTab === 'evaluation' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Agent', 'Dataset', 'Metric', 'Score', 'Tests Run', 'Passed', 'Pass Rate', 'Date'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.evaluations.map(ev => {
                const agent = data.agents.find(a => a.agent_id === ev.agent_id);
                const passRate = ev.test_cases_run > 0 ? Math.round((ev.passed / ev.test_cases_run) * 100) : 0;
                return (
                  <tr key={ev.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{agent?.name ?? ev.agent_id}</td>
                    <td className="px-4 py-3">
                      <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs">{ev.eval_dataset}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{ev.metric}</td>
                    <td className="px-4 py-3">
                      <span className={`font-bold text-sm ${parseFloat(ev.score) >= 85 ? 'text-green-600' : parseFloat(ev.score) >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {parseFloat(ev.score).toFixed(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{ev.test_cases_run}</td>
                    <td className="px-4 py-3 text-gray-500">{ev.passed}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-100 rounded h-2">
                          <div className="h-full bg-green-500 rounded" style={{ width: `${passRate}%` }} />
                        </div>
                        <span className="text-xs text-gray-600">{passRate}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{fmt(ev.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Deployment Tab */}
      {activeTab === 'deployment' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Agent', 'Version', 'Environment', 'Deployed By', 'Status', 'Deployed At'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.deployments.map(d => {
                const agent = data.agents.find(a => a.agent_id === d.agent_id);
                return (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{agent?.name ?? d.agent_id}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{d.version}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        d.environment === 'prod' ? 'bg-red-100 text-red-700' :
                        d.environment === 'staging' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{d.environment}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{d.deployed_by}</td>
                    <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                    <td className="px-4 py-3 text-xs text-gray-400">{fmt(d.deployed_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
