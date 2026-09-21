'use client';

import { useEffect, useState, useCallback } from 'react';

interface OllamaTask {
  task_id: string;
  task_type: string;
  model_name: string;
  prompt: string;
  output: string | null;
  temperature: string;
  max_tokens: number;
  status: string;
  latency_ms: number | null;
  created_at: string;
  completed_at: string | null;
}

interface OllamaModel {
  model_name: string;
  size_gb: string;
  family: string;
  capabilities: string[];
  status: string;
  last_used: string | null;
}

interface ConfigRow {
  key: string;
  value: string;
}

interface Summary {
  available_models: number;
  tasks_queued: number;
  completed_today: number;
  avg_response_ms: number;
}

interface PageData {
  tasks: OllamaTask[];
  models: OllamaModel[];
  config: ConfigRow[];
  ollama_online: boolean;
  live_models: string[];
  summary: Summary;
}

const TASK_TYPES = [
  'Text Generation','Summarization','Classification','Entity Extraction',
  'Translation','Code Generation','Sentiment Analysis','Q&A','Embedding','Custom',
];

const MODEL_RECOMMENDATIONS: Record<string, { model: string; reason: string }> = {
  'Text Generation': { model: 'llama3.2:3b', reason: 'Fast, general-purpose generation' },
  'Summarization': { model: 'llama3.2:3b', reason: 'Efficient at condensing text' },
  'Classification': { model: 'gemma2:9b', reason: 'Strong at structured output' },
  'Entity Extraction': { model: 'gemma2:9b', reason: 'Precise structured extraction' },
  'Translation': { model: 'qwen2.5:7b', reason: 'Multilingual capability' },
  'Code Generation': { model: 'mistral:7b', reason: 'Excellent code understanding' },
  'Sentiment Analysis': { model: 'phi3:mini', reason: 'Fast, lightweight classifier' },
  'Q&A': { model: 'llama3.2:3b', reason: 'Good at answering questions' },
  'Embedding': { model: 'nomic-embed-text', reason: 'Purpose-built embedding model' },
  'Custom': { model: 'mistral:7b', reason: 'Flexible general-purpose model' },
};

const STATUS_COLOR: Record<string, string> = {
  completed: 'bg-green-100 text-green-700',
  running: 'bg-blue-100 text-blue-700',
  queued: 'bg-yellow-100 text-yellow-700',
  error: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-600',
  ollama_offline: 'bg-orange-100 text-orange-700',
};

const MODEL_STATUS_COLOR: Record<string, string> = {
  loaded: 'bg-green-100 text-green-700',
  available: 'bg-blue-100 text-blue-700',
  pulling: 'bg-yellow-100 text-yellow-700',
};

const TABS = ['Assign Task', 'Running', 'History', 'Model Registry', 'Config'] as const;
type Tab = typeof TABS[number];

export default function OllamaTasksPage() {
  const [tab, setTab] = useState<Tab>('Assign Task');
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Assign Task form state
  const [taskType, setTaskType] = useState(TASK_TYPES[0]);
  const [modelOverride, setModelOverride] = useState('');
  const [prompt, setPrompt] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(512);
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<OllamaTask | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/ollama-tasks');
      if (!r.ok) throw new Error(await r.text());
      setData(await r.json());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const recommended = MODEL_RECOMMENDATIONS[taskType] || MODEL_RECOMMENDATIONS['Custom'];
  const activeModel = modelOverride || recommended.model;

  const submitTask = async () => {
    if (!prompt.trim()) return;
    setSubmitting(true);
    setLastResult(null);
    try {
      const r = await fetch('/api/admin/ollama-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_type: taskType,
          model_name: activeModel,
          prompt,
          temperature,
          max_tokens: maxTokens,
        }),
      });
      const result: OllamaTask = await r.json();
      setLastResult(result);
      load();
    } catch (e) {
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const cancelTask = async (task_id: string) => {
    await fetch('/api/admin/ollama-tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id }),
    });
    load();
  };

  if (loading) return <div className="p-8 text-gray-500">Loading Ollama tasks...</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!data) return null;

  const { tasks, models, config, ollama_online, summary } = data;
  const running = tasks.filter(t => t.status === 'running' || t.status === 'queued');
  const history = tasks.filter(t => !['running', 'queued'].includes(t.status));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ollama Task Assignment</h1>
          <p className="text-gray-500 text-sm mt-1">Assign AI tasks to locally-running Ollama models</p>
        </div>
        <div className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-full ${ollama_online ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          <div className={`w-2 h-2 rounded-full ${ollama_online ? 'bg-green-500' : 'bg-red-500'}`} />
          {ollama_online ? 'Ollama Online' : 'Ollama Offline'}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Available Models', value: summary.available_models, color: 'bg-blue-50 border-blue-200' },
          { label: 'Tasks Queued', value: summary.tasks_queued, color: 'bg-yellow-50 border-yellow-200' },
          { label: 'Completed Today', value: summary.completed_today, color: 'bg-green-50 border-green-200' },
          { label: 'Avg Response (ms)', value: summary.avg_response_ms, color: 'bg-purple-50 border-purple-200' },
        ].map(s => (
          <div key={s.label} className={`border rounded-lg p-4 ${s.color}`}>
            <div className="text-2xl font-bold text-gray-900">{s.value}</div>
            <div className="text-sm text-gray-600 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1 overflow-x-auto">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab === t ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {t}
              {t === 'Running' && running.length > 0 && (
                <span className="ml-1.5 bg-yellow-500 text-white text-xs rounded-full px-1.5">{running.length}</span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Assign Task */}
      {tab === 'Assign Task' && (
        <div className="max-w-2xl space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Task Type</label>
              <select value={taskType} onChange={e => setTaskType(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                {TASK_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
              <select value={activeModel} onChange={e => setModelOverride(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                {models.map(m => (
                  <option key={m.model_name} value={m.model_name}>
                    {m.model_name} {m.model_name === recommended.model ? '★' : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Recommended: <strong>{recommended.model}</strong> — {recommended.reason}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prompt</label>
            <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
              rows={5} placeholder="Enter your prompt here..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Temperature: {temperature.toFixed(1)}
              </label>
              <input type="range" min="0" max="1" step="0.1" value={temperature}
                onChange={e => setTemperature(Number(e.target.value))}
                className="w-full" />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>0.0 (precise)</span><span>1.0 (creative)</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Tokens: {maxTokens}</label>
              <input type="range" min="128" max="4096" step="128" value={maxTokens}
                onChange={e => setMaxTokens(Number(e.target.value))}
                className="w-full" />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>128</span><span>4096</span>
              </div>
            </div>
          </div>

          <button onClick={submitTask} disabled={submitting || !prompt.trim()}
            className={`px-6 py-2.5 rounded-lg text-sm font-medium text-white transition-colors ${
              submitting || !prompt.trim() ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}>
            {submitting ? 'Running...' : 'Assign & Run'}
          </button>

          {lastResult && (
            <div className={`border rounded-lg p-4 ${STATUS_COLOR[lastResult.status] || 'bg-gray-50 border-gray-200'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{lastResult.task_id}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[lastResult.status]}`}>
                  {lastResult.status}
                </span>
              </div>
              {lastResult.output && (
                <div className="bg-white border border-gray-200 rounded p-3 text-sm text-gray-700 mt-2">
                  {lastResult.output}
                </div>
              )}
              {lastResult.latency_ms && (
                <div className="text-xs text-gray-500 mt-2">{lastResult.latency_ms}ms</div>
              )}
            </div>
          )}

          {/* Recommendations table */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Model Recommendations</h2>
            <div className="overflow-x-auto rounded border border-gray-200">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-600 uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">Task Type</th>
                    <th className="px-3 py-2 text-left">Model</th>
                    <th className="px-3 py-2 text-left">Why</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {Object.entries(MODEL_RECOMMENDATIONS).map(([tt, rec]) => (
                    <tr key={tt} className={`bg-white ${tt === taskType ? 'bg-blue-50' : ''}`}>
                      <td className="px-3 py-2 font-medium">{tt}</td>
                      <td className="px-3 py-2 font-mono">{rec.model}</td>
                      <td className="px-3 py-2 text-gray-500">{rec.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Running */}
      {tab === 'Running' && (
        <div>
          {running.length === 0 ? (
            <div className="text-gray-400 text-sm">No tasks currently running.</div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                  <tr>
                    {['Task ID', 'Type', 'Model', 'Prompt Preview', 'Status', 'Started', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {running.map(t => (
                    <tr key={t.task_id} className="bg-white">
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{t.task_id}</td>
                      <td className="px-4 py-3 text-gray-600">{t.task_type}</td>
                      <td className="px-4 py-3 font-mono text-xs">{t.model_name}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{t.prompt.slice(0, 60)}...</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLOR[t.status]}`}>{t.status}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{new Date(t.created_at).toLocaleTimeString()}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => cancelTask(t.task_id)}
                          className="text-xs text-red-600 hover:text-red-800">Cancel</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* History */}
      {tab === 'History' && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                {['Run ID', 'Type', 'Model', 'Prompt', 'Output', 'Latency', 'Status', 'Date'].map(h => (
                  <th key={h} className="px-4 py-3 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {history.map(t => (
                <tr key={t.task_id} className="bg-white hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{t.task_id}</td>
                  <td className="px-4 py-3 text-gray-600">{t.task_type}</td>
                  <td className="px-4 py-3 font-mono text-xs">{t.model_name}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs">
                    <span className="line-clamp-1">{t.prompt.slice(0, 50)}{t.prompt.length > 50 ? '...' : ''}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 max-w-xs">
                    <span className="line-clamp-1">{(t.output || '').slice(0, 60)}{(t.output || '').length > 60 ? '...' : ''}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{t.latency_ms ? `${t.latency_ms}ms` : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLOR[t.status] || 'bg-gray-100'}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(t.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Model Registry */}
      {tab === 'Model Registry' && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                {['Model Name', 'Size (GB)', 'Family', 'Capabilities', 'Status', 'Last Used'].map(h => (
                  <th key={h} className="px-4 py-3 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {models.map(m => (
                <tr key={m.model_name} className="bg-white hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-medium">{m.model_name}</td>
                  <td className="px-4 py-3 text-gray-600">{m.size_gb} GB</td>
                  <td className="px-4 py-3 text-gray-600 capitalize">{m.family}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(m.capabilities || []).map(c => (
                        <span key={c} className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-xs">{c}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${MODEL_STATUS_COLOR[m.status] || 'bg-gray-100 text-gray-600'}`}>
                      {m.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {m.last_used ? new Date(m.last_used).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Config */}
      {tab === 'Config' && (
        <div className="max-w-lg space-y-3">
          {config.map(c => (
            <div key={c.key} className="flex items-center justify-between py-3 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-700 font-mono">{c.key}</span>
              <input type="text" defaultValue={c.value}
                className="text-sm border border-gray-300 rounded px-3 py-1 w-56 font-mono" />
            </div>
          ))}
          <p className="text-xs text-gray-400 pt-2">
            Changes here are UI-only. Update via database or environment variables to persist.
          </p>
        </div>
      )}
    </div>
  );
}
