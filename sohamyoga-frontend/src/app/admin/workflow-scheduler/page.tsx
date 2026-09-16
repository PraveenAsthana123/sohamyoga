'use client';

import { useEffect, useState, useCallback } from 'react';

type TabId = 'workflows' | 'history' | 'create' | 'designer';

interface WorkflowStep {
  step_name: string;
  job_name: string | null;
  delay_ms?: number;
  condition?: string;
}

interface Workflow {
  id: number;
  name: string;
  description: string | null;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  steps: WorkflowStep[];
  status: string;
  last_run_at: string | null;
  last_run_status: string | null;
  run_count: number;
  created_at: string;
  latest_run_status: string | null;
  latest_run_started_at: string | null;
  latest_run_finished_at: string | null;
}

interface WfRun {
  id: number;
  wf_id: number;
  workflow_name: string;
  status: string;
  steps_completed: number;
  steps_total: number;
  started_at: string;
  finished_at: string | null;
  triggered_by: string;
  error_message: string | null;
}

function GlassCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl p-6 shadow-xl ${className}`}>
      {children}
    </div>
  );
}

function Spinner() {
  return <div className="animate-spin h-5 w-5 border-2 border-white/30 border-t-white rounded-full" />;
}

function TriggerBadge({ type }: { type: string }) {
  const cls = type === 'cron' ? 'bg-blue-500/30 text-blue-200 border-blue-400/40'
    : type === 'event' ? 'bg-purple-500/30 text-purple-200 border-purple-400/40'
    : type === 'webhook' ? 'bg-green-500/30 text-green-200 border-green-400/40'
    : 'bg-gray-500/30 text-gray-200 border-gray-400/40';
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>{type}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const s = status?.toLowerCase() ?? '';
  let cls = 'bg-amber-500/30 text-amber-200 border-amber-400/40';
  if (s === 'active' || s === 'completed') cls = 'bg-emerald-500/30 text-emerald-200 border-emerald-400/40';
  else if (s === 'failed' || s === 'cancelled') cls = 'bg-red-500/30 text-red-200 border-red-400/40';
  else if (s === 'running') cls = 'bg-blue-500/30 text-blue-200 border-blue-400/40';
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>{status}</span>;
}

function durationStr(started: string, finished: string | null): string {
  if (!finished) return 'running';
  const ms = new Date(finished).getTime() - new Date(started).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m`;
}

// ── Tab: Workflows ─────────────────────────────────────────────────────────
function WorkflowsTab({ workflows, onRefresh }: { workflows: Workflow[]; onRefresh: () => void }) {
  const [running, setRunning] = useState<number | null>(null);

  const toggleStatus = async (wf: Workflow) => {
    const next = wf.status === 'active' ? 'paused' : 'active';
    await fetch('/api/admin/wf-scheduler', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: wf.id, status: next }),
    });
    onRefresh();
  };

  const runNow = async (wf: Workflow) => {
    setRunning(wf.id);
    await fetch('/api/admin/wf-scheduler/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wf_id: wf.id }),
    });
    setRunning(null);
    onRefresh();
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {workflows.length === 0 && (
        <p className="text-white/40 text-sm col-span-3">No workflows defined yet.</p>
      )}
      {workflows.map(wf => {
        const stepCount = Array.isArray(wf.steps) ? wf.steps.length : 0;
        return (
          <GlassCard key={wf.id}>
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-white font-semibold text-sm">{wf.name}</h3>
              <TriggerBadge type={wf.trigger_type} />
            </div>
            {wf.description && <p className="text-white/60 text-xs mb-3">{wf.description}</p>}
            <div className="flex gap-3 text-xs text-white/50 mb-3">
              <span>{stepCount} step{stepCount !== 1 ? 's' : ''}</span>
              <span>·</span>
              <span>{wf.run_count} run{wf.run_count !== 1 ? 's' : ''}</span>
              {wf.latest_run_status && <><span>·</span><StatusBadge status={wf.latest_run_status} /></>}
            </div>
            {wf.last_run_at && (
              <p className="text-white/40 text-xs mb-3">Last run: {new Date(wf.last_run_at).toLocaleString()}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => void runNow(wf)}
                disabled={running === wf.id}
                className="flex-1 px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/40 text-blue-200 text-xs font-semibold disabled:opacity-50"
              >
                {running === wf.id ? '…' : 'Run Now'}
              </button>
              <button
                onClick={() => void toggleStatus(wf)}
                className="flex-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs"
              >
                {wf.status === 'active' ? 'Disable' : 'Enable'}
              </button>
            </div>
          </GlassCard>
        );
      })}
    </div>
  );
}

// ── Tab: Run History ───────────────────────────────────────────────────────
function RunHistoryTab({ runs }: { runs: WfRun[] }) {
  return (
    <GlassCard>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[650px]">
          <thead>
            <tr className="text-white/50 text-xs uppercase border-b border-white/10">
              <th className="text-left py-2">Workflow</th>
              <th className="text-left py-2">Status</th>
              <th className="text-left py-2">Progress</th>
              <th className="text-left py-2">Started</th>
              <th className="text-left py-2">Duration</th>
              <th className="text-left py-2">Trigger</th>
            </tr>
          </thead>
          <tbody>
            {runs.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-white/40 text-xs">No runs yet.</td></tr>
            )}
            {runs.map(r => {
              const pct = r.steps_total > 0 ? Math.round((r.steps_completed / r.steps_total) * 100) : 0;
              return (
                <tr key={r.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-2 text-white/90 text-xs font-medium">{r.workflow_name}</td>
                  <td className="py-2"><StatusBadge status={r.status} /></td>
                  <td className="py-2 min-w-[120px]">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-400/60 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-white/50 text-xs w-10">{r.steps_completed}/{r.steps_total}</span>
                    </div>
                  </td>
                  <td className="py-2 text-white/50 text-xs">{new Date(r.started_at).toLocaleString()}</td>
                  <td className="py-2 text-white/50 text-xs">{durationStr(r.started_at, r.finished_at)}</td>
                  <td className="py-2 text-white/50 text-xs">{r.triggered_by}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}

// ── Tab: Create Workflow ───────────────────────────────────────────────────
function CreateWorkflowTab({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState('manual');
  const [triggerConfig, setTriggerConfig] = useState('{}');
  const [steps, setSteps] = useState<{ step_name: string; job_name: string }[]>([{ step_name: '', job_name: '' }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const addStep = () => setSteps(prev => [...prev, { step_name: '', job_name: '' }]);
  const removeStep = (i: number) => setSteps(prev => prev.filter((_, idx) => idx !== i));
  const updateStep = (i: number, field: 'step_name' | 'job_name', val: string) => {
    setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s));
  };

  const create = async () => {
    setError('');
    if (!name) { setError('Name is required'); return; }
    let parsedConfig: unknown;
    try { parsedConfig = JSON.parse(triggerConfig); } catch { setError('Trigger config must be valid JSON'); return; }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/wf-scheduler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, trigger_type: triggerType, trigger_config: parsedConfig, steps }),
      });
      if (res.ok) {
        setSuccess('Workflow created!');
        setName(''); setDescription(''); setTriggerConfig('{}'); setSteps([{ step_name: '', job_name: '' }]);
        onCreated();
      } else {
        setError('Failed to create workflow');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <GlassCard className="max-w-2xl">
      <h3 className="text-white font-semibold mb-4">Create New Workflow</h3>
      <div className="space-y-4">
        {[
          { label: 'Name', value: name, set: setName, placeholder: 'Workflow name' },
          { label: 'Description', value: description, set: setDescription, placeholder: 'Optional description' },
        ].map(f => (
          <div key={f.label}>
            <label className="block text-white/60 text-xs mb-1">{f.label}</label>
            <input
              value={f.value}
              onChange={e => f.set(e.target.value)}
              placeholder={f.placeholder}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/30"
            />
          </div>
        ))}

        <div>
          <label className="block text-white/60 text-xs mb-1">Trigger Type</label>
          <select
            value={triggerType}
            onChange={e => setTriggerType(e.target.value)}
            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
          >
            {['manual', 'cron', 'event', 'webhook'].map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-white/60 text-xs mb-1">Trigger Config (JSON)</label>
          <textarea
            value={triggerConfig}
            onChange={e => setTriggerConfig(e.target.value)}
            rows={3}
            placeholder='e.g. {"cron": "0 9 * * 1"} or {"event": "new_lead"}'
            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm font-mono placeholder:text-white/30"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-white/60 text-xs">Steps</label>
            <button onClick={addStep} className="text-xs text-blue-300 hover:text-blue-200 underline">+ Add Step</button>
          </div>
          <div className="space-y-2">
            {steps.map((s, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  value={s.step_name}
                  onChange={e => updateStep(i, 'step_name', e.target.value)}
                  placeholder="Step name"
                  className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm placeholder:text-white/30"
                />
                <input
                  value={s.job_name}
                  onChange={e => updateStep(i, 'job_name', e.target.value)}
                  placeholder="Job name (optional)"
                  className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm placeholder:text-white/30"
                />
                {steps.length > 1 && (
                  <button onClick={() => removeStep(i)} className="text-red-300 hover:text-red-200 text-xs">✕</button>
                )}
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-red-300 text-sm">{error}</p>}
        {success && <p className="text-emerald-300 text-sm">{success}</p>}

        <button
          onClick={() => void create()}
          disabled={saving}
          className="w-full px-4 py-2 rounded-xl bg-blue-500/30 hover:bg-blue-500/50 text-blue-200 text-sm font-semibold disabled:opacity-50"
        >
          {saving ? 'Creating…' : 'Create Workflow'}
        </button>
      </div>
    </GlassCard>
  );
}

// ── Tab: Workflow Designer ─────────────────────────────────────────────────
function WorkflowDesignerTab({ workflows }: { workflows: Workflow[] }) {
  const [selectedId, setSelectedId] = useState<number | ''>('');
  const selected = workflows.find(w => w.id === selectedId);

  const steps: WorkflowStep[] = Array.isArray(selected?.steps) ? selected!.steps : [];

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-white/60 text-xs mb-1">Select Workflow</label>
        <select
          value={selectedId}
          onChange={e => setSelectedId(e.target.value ? parseInt(e.target.value, 10) : '')}
          className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm w-64"
        >
          <option value="">— Choose a workflow —</option>
          {workflows.map(w => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
      </div>

      {selected && (
        <GlassCard>
          <h3 className="text-white font-semibold mb-1">{selected.name}</h3>
          {selected.description && <p className="text-white/60 text-xs mb-4">{selected.description}</p>}

          <div className="flex items-center gap-2 overflow-x-auto pb-4">
            {/* Trigger */}
            <div className="flex-shrink-0 px-4 py-3 bg-purple-500/20 border border-purple-400/30 rounded-xl text-center min-w-[100px]">
              <p className="text-purple-200 text-xs font-bold uppercase">Trigger</p>
              <p className="text-white/80 text-xs mt-1">{selected.trigger_type}</p>
              {selected.trigger_config?.cron != null && (
                <p className="text-white/50 text-xs font-mono mt-0.5">{String(selected.trigger_config.cron)}</p>
              )}
              {selected.trigger_config?.event != null && (
                <p className="text-white/50 text-xs mt-0.5">{String(selected.trigger_config.event)}</p>
              )}
            </div>

            {/* Arrow */}
            {steps.length > 0 && <span className="text-white/40 flex-shrink-0 text-lg">→</span>}

            {/* Steps */}
            {steps.map((step, i) => (
              <div key={i} className="flex items-center gap-2 flex-shrink-0">
                <div className="px-4 py-3 bg-blue-500/20 border border-blue-400/30 rounded-xl text-center min-w-[100px]">
                  <p className="text-blue-200 text-xs font-bold">Step {i + 1}</p>
                  <p className="text-white/90 text-xs mt-1">{step.step_name}</p>
                  {step.job_name && <p className="text-white/50 text-xs mt-0.5 font-mono">{step.job_name}</p>}
                  {step.delay_ms && step.delay_ms > 0 && (
                    <p className="text-amber-300/70 text-xs mt-0.5">+{Math.round(step.delay_ms / 3600000)}h delay</p>
                  )}
                </div>
                {i < steps.length - 1 && <span className="text-white/40 text-lg">→</span>}
              </div>
            ))}

            {/* End */}
            {steps.length > 0 && (
              <>
                <span className="text-white/40 flex-shrink-0 text-lg">→</span>
                <div className="flex-shrink-0 px-4 py-3 bg-emerald-500/20 border border-emerald-400/30 rounded-xl text-center min-w-[80px]">
                  <p className="text-emerald-200 text-xs font-bold">Done</p>
                </div>
              </>
            )}

            {steps.length === 0 && (
              <p className="text-white/40 text-sm">No steps configured.</p>
            )}
          </div>
        </GlassCard>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
const TABS: { id: TabId; label: string }[] = [
  { id: 'workflows', label: 'Workflows' },
  { id: 'history', label: 'Run History' },
  { id: 'create', label: 'Create Workflow' },
  { id: 'designer', label: 'Workflow Designer' },
];

export default function WorkflowSchedulerPage() {
  const [activeTab, setActiveTab] = useState<TabId>('workflows');
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [runs, setRuns] = useState<WfRun[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/wf-scheduler', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json() as { workflows: Workflow[]; runs: WfRun[] };
        setWorkflows(data.workflows ?? []);
        setRuns(data.runs ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Workflow Scheduler</h1>
          <p className="text-white/60 text-sm mt-1">Design, schedule, and monitor multi-step workflows.</p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === t.id ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10 rounded-lg px-4 py-2'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div>
          {loading && (activeTab === 'workflows' || activeTab === 'history' || activeTab === 'designer') ? (
            <div className="py-12 text-center"><Spinner /></div>
          ) : (
            <>
              {activeTab === 'workflows' && <WorkflowsTab workflows={workflows} onRefresh={load} />}
              {activeTab === 'history' && <RunHistoryTab runs={runs} />}
              {activeTab === 'create' && <CreateWorkflowTab onCreated={load} />}
              {activeTab === 'designer' && <WorkflowDesignerTab workflows={workflows} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
