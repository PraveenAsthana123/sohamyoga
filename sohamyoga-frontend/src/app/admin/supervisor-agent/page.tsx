'use client';

import { useState, useEffect, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface SupervisorWorker {
  worker_id: string;
  worker_type: string;
  status: 'idle' | 'busy' | 'error' | 'offline';
  current_task: string | null;
  started_at: string;
  last_heartbeat: string;
}

interface QueuedTask {
  task_id: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  task_type: string;
  assigned_worker: string | null;
  status: 'queued' | 'running' | 'completed' | 'failed';
  retry_count: number;
  created_at: string;
}

interface Escalation {
  id: number;
  task_id: string;
  reason: string;
  resolution: string;
  created_at: string;
}

interface LogEntry {
  id: number;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  created_at: string;
}

interface SupervisorData {
  workers: SupervisorWorker[];
  queue: QueuedTask[];
  escalations: Escalation[];
  logs: LogEntry[];
  settings: { max_workers: number; retry_limit: number; escalation_threshold: number };
}

type Tab = 'dashboard' | 'workers' | 'queue' | 'escalations' | 'logs' | 'settings';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    idle: 'bg-green-100 text-green-800',
    busy: 'bg-blue-100 text-blue-800',
    error: 'bg-red-100 text-red-800',
    offline: 'bg-gray-200 text-gray-600',
    queued: 'bg-yellow-100 text-yellow-800',
    running: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${map[status] ?? 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    P0: 'bg-red-600 text-white',
    P1: 'bg-orange-500 text-white',
    P2: 'bg-yellow-500 text-white',
    P3: 'bg-gray-400 text-white',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-bold ${map[priority] ?? 'bg-gray-300 text-gray-700'}`}>
      {priority}
    </span>
  );
}

function LogLevelBadge({ level }: { level: string }) {
  const map: Record<string, string> = {
    INFO: 'bg-blue-100 text-blue-700',
    WARN: 'bg-yellow-100 text-yellow-700',
    ERROR: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`px-1.5 py-0.5 rounded text-xs font-mono font-semibold ${map[level] ?? 'bg-gray-100 text-gray-700'}`}>
      {level}
    </span>
  );
}

function fmt(ts: string) {
  return new Date(ts).toLocaleString();
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function SupervisorAgentPage() {
  const [data, setData] = useState<SupervisorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [settings, setSettings] = useState({ max_workers: 10, retry_limit: 3, escalation_threshold: 5 });
  const [addTaskForm, setAddTaskForm] = useState({ task_type: '', priority: 'P2' });
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/supervisor-agent');
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json() as SupervisorData;
      setData(json);
      setSettings(json.settings);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleWorkerAction = async (workerId: string, status: string) => {
    await fetch('/api/admin/supervisor-agent', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity: 'worker', id: workerId, status }),
    });
    await fetchData();
  };

  const handleAddTask = async () => {
    if (!addTaskForm.task_type) return;
    setSubmitting(true);
    await fetch('/api/admin/supervisor-agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(addTaskForm),
    });
    setAddTaskForm({ task_type: '', priority: 'P2' });
    setSubmitting(false);
    await fetchData();
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'workers', label: 'Worker Pool' },
    { id: 'queue', label: 'Task Queue' },
    { id: 'escalations', label: 'Escalations' },
    { id: 'logs', label: 'Logs' },
    { id: 'settings', label: 'Settings' },
  ];

  if (loading) return <div className="p-8 text-gray-500">Loading supervisor agent data…</div>;
  if (error) return <div className="p-8 text-red-600">Error: {error}</div>;
  if (!data) return null;

  const activeWorkers = data.workers.filter(w => w.status === 'busy').length;
  const queueDepth = data.queue.filter(t => t.status === 'queued').length;
  const completedToday = data.queue.filter(t => t.status === 'completed').length;
  const failures = data.workers.filter(w => w.status === 'error').length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Supervisor Agent</h1>
        <p className="text-gray-500 text-sm mt-1">Orchestrate and monitor the multi-agent worker pool</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Active Workers', value: activeWorkers, color: 'text-blue-600' },
          { label: 'Tasks Queued', value: queueDepth, color: 'text-yellow-600' },
          { label: 'Completed Today', value: completedToday, color: 'text-green-600' },
          { label: 'Failures Caught', value: failures, color: 'text-red-600' },
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
              activeTab === t.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 mb-3">Supervisor Health</h2>
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-green-500 inline-block animate-pulse" />
              <span className="text-green-700 font-medium">Running</span>
              <span className="text-gray-400">•</span>
              <span className="text-gray-600 text-sm">{data.workers.length} workers registered</span>
              <span className="text-gray-400">•</span>
              <span className="text-gray-600 text-sm">Queue depth: {queueDepth}</span>
              <span className="text-gray-400">•</span>
              <span className="text-gray-600 text-sm">{data.escalations.length} escalation(s)</span>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 mb-3">Recent Escalations</h2>
            {data.escalations.slice(0, 3).map(e => (
              <div key={e.id} className="border-l-4 border-red-400 pl-3 mb-3">
                <p className="text-sm font-medium text-gray-800">{e.task_id}</p>
                <p className="text-xs text-red-600">{e.reason}</p>
                <p className="text-xs text-gray-500">{e.resolution}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Workers Tab */}
      {activeTab === 'workers' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Worker ID', 'Type', 'Status', 'Current Task', 'Uptime', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.workers.map(w => (
                <tr key={w.worker_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{w.worker_id}</td>
                  <td className="px-4 py-3">
                    <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded text-xs">{w.worker_type}</span>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={w.status} /></td>
                  <td className="px-4 py-3 text-gray-600 text-xs max-w-xs truncate">{w.current_task || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{fmt(w.started_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleWorkerAction(w.worker_id, 'idle')}
                        className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                      >Restart</button>
                      <button
                        onClick={() => handleWorkerAction(w.worker_id, 'offline')}
                        className="text-xs px-2 py-1 bg-red-50 text-red-700 rounded hover:bg-red-100"
                      >Kill</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Queue Tab */}
      {activeTab === 'queue' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-medium text-gray-800 mb-3">Add Task</h3>
            <div className="flex gap-3 flex-wrap">
              <input
                className="border border-gray-300 rounded px-3 py-1.5 text-sm flex-1 min-w-[200px]"
                placeholder="Task type (e.g. llm_summarise)"
                value={addTaskForm.task_type}
                onChange={e => setAddTaskForm(f => ({ ...f, task_type: e.target.value }))}
              />
              <select
                className="border border-gray-300 rounded px-3 py-1.5 text-sm"
                value={addTaskForm.priority}
                onChange={e => setAddTaskForm(f => ({ ...f, priority: e.target.value }))}
              >
                {['P0', 'P1', 'P2', 'P3'].map(p => <option key={p}>{p}</option>)}
              </select>
              <button
                onClick={handleAddTask}
                disabled={submitting}
                className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Adding…' : 'Add Task'}
              </button>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Task ID', 'Priority', 'Type', 'Worker', 'Status', 'Retries', 'Created'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.queue.map(t => (
                  <tr key={t.task_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{t.task_id}</td>
                    <td className="px-4 py-3"><PriorityBadge priority={t.priority} /></td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{t.task_type}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{t.assigned_worker || '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                    <td className="px-4 py-3 text-center text-gray-500">{t.retry_count}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{fmt(t.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Escalations Tab */}
      {activeTab === 'escalations' && (
        <div className="space-y-3">
          {data.escalations.map(e => (
            <div key={e.id} className="bg-white border border-red-200 rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <span className="font-mono text-sm font-semibold text-gray-800">{e.task_id}</span>
                <span className="text-xs text-gray-400">{fmt(e.created_at)}</span>
              </div>
              <p className="text-sm text-red-700 mb-1"><strong>Reason:</strong> {e.reason}</p>
              <p className="text-sm text-green-700"><strong>Resolution:</strong> {e.resolution}</p>
            </div>
          ))}
          {data.escalations.length === 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center text-green-700">
              No escalations — all tasks are healthy.
            </div>
          )}
        </div>
      )}

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <div className="bg-gray-950 rounded-lg border border-gray-700 p-4 max-h-[500px] overflow-y-auto font-mono text-xs">
          {data.logs.map(l => (
            <div key={l.id} className="flex gap-3 mb-1">
              <span className="text-gray-500 shrink-0">{new Date(l.created_at).toISOString().replace('T', ' ').slice(0, 19)}</span>
              <LogLevelBadge level={l.level} />
              <span className={l.level === 'ERROR' ? 'text-red-400' : l.level === 'WARN' ? 'text-yellow-300' : 'text-green-300'}>
                {l.message}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 max-w-lg space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Workers: <strong>{settings.max_workers}</strong>
            </label>
            <input
              type="range" min={1} max={20} value={settings.max_workers}
              onChange={e => setSettings(s => ({ ...s, max_workers: Number(e.target.value) }))}
              className="w-full accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-400"><span>1</span><span>20</span></div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Retry Limit: <strong>{settings.retry_limit}</strong>
            </label>
            <input
              type="range" min={1} max={5} value={settings.retry_limit}
              onChange={e => setSettings(s => ({ ...s, retry_limit: Number(e.target.value) }))}
              className="w-full accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-400"><span>1</span><span>5</span></div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Escalation Threshold (failures): <strong>{settings.escalation_threshold}</strong>
            </label>
            <input
              type="range" min={1} max={10} value={settings.escalation_threshold}
              onChange={e => setSettings(s => ({ ...s, escalation_threshold: Number(e.target.value) }))}
              className="w-full accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-400"><span>1</span><span>10</span></div>
          </div>
          <button
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
            onClick={() => alert('Settings saved (UI only — wire PATCH to persist)')}
          >
            Save Settings
          </button>
        </div>
      )}
    </div>
  );
}
