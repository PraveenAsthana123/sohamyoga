'use client';

import { useState, useEffect, useCallback } from 'react';

interface PipelineStage {
  name: string;
  type: string;
  order: number;
}

interface Pipeline {
  id: number;
  name: string;
  pipeline_type: string;
  description: string;
  stages: PipelineStage[];
  status: string;
  trigger_type: string;
  cron_expression: string | null;
  last_run_at: string | null;
  last_run_status: string | null;
  last_run_duration_ms: number | null;
  success_rate: number;
  run_count: number;
  stage_count: number;
  owner: string | null;
  tags: string[] | null;
  created_at: string;
  latest_run_status: string | null;
  latest_run_at: string | null;
  latest_run_duration_ms: number | null;
  latest_run_id: string | null;
}

interface PipelineRun {
  id: number;
  pipeline_id: number;
  pipeline_name: string;
  run_id: string;
  status: string;
  triggered_by: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  stages_completed: number;
  stages_total: number;
  records_in: number;
  records_out: number;
  records_failed: number;
  error_stage: string | null;
  error_message: string | null;
}

const GLASS = 'bg-slate-800/70 border border-white/20 rounded-2xl p-6 shadow-xl';
const GLASS_SM = 'bg-slate-800/70 border border-white/20 rounded-xl p-4 shadow-lg';

const TYPE_COLORS: Record<string, string> = {
  data: 'bg-blue-500/30 text-blue-200',
  ml: 'bg-purple-500/30 text-purple-200',
  etl: 'bg-cyan-500/30 text-cyan-200',
  content: 'bg-green-500/30 text-green-200',
  marketing: 'bg-pink-500/30 text-pink-200',
  ai: 'bg-violet-500/30 text-violet-200',
  integration: 'bg-orange-500/30 text-orange-200',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/30 text-green-200',
  running: 'bg-blue-500/30 text-blue-200',
  paused: 'bg-amber-500/30 text-amber-200',
  failed: 'bg-red-500/30 text-red-200',
  idle: 'bg-gray-500/30 text-gray-200',
  success: 'bg-green-500/30 text-green-200',
  partial: 'bg-amber-500/30 text-amber-200',
  cancelled: 'bg-gray-500/30 text-gray-200',
  timeout: 'bg-red-400/30 text-red-200',
};

const STAGE_ICONS: Record<string, string> = {
  extract: '📥',
  transform: '⚙️',
  load: '📤',
  ai: '🤖',
  monitor: '📊',
  action: '⚡',
  stream: '🌊',
  trigger: '🚀',
  classify: '🏷️',
  aggregate: '📈',
  analyze: '🔍',
  ml: '🧠',
  output: '📝',
};

function Badge({ text, className }: { text: string; className: string }) {
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${className}`}>{text}</span>;
}

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className={GLASS_SM}>
      <p className="text-white/60 text-xs mb-1">{label}</p>
      <p className="text-white text-2xl font-bold">{value}</p>
      {sub && <p className="text-white/50 text-xs mt-1">{sub}</p>}
    </div>
  );
}

export default function PipelinesPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [runFilter, setRunFilter] = useState({ pipeline_id: '', status: '' });
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '', pipeline_type: 'data', description: '', trigger_type: 'manual',
    cron_expression: '', owner: '', tags: '',
  });
  const [formStages, setFormStages] = useState<{ name: string; type: string }[]>([{ name: '', type: 'extract' }]);

  const loadPipelines = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/pipelines');
      const data = await res.json();
      setPipelines(data.pipelines || []);
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  const loadRuns = useCallback(async () => {
    const params = new URLSearchParams();
    if (runFilter.pipeline_id) params.set('pipeline_id', runFilter.pipeline_id);
    if (runFilter.status) params.set('status', runFilter.status);
    try {
      const res = await fetch(`/api/admin/pipelines/runs?${params}`);
      const data = await res.json();
      setRuns(data.runs || []);
    } catch { /* silent */ }
  }, [runFilter]);

  useEffect(() => { loadPipelines(); }, [loadPipelines]);
  useEffect(() => { if (activeTab === 1) loadRuns(); }, [activeTab, loadRuns]);

  async function triggerRun(pipelineId: number) {
    await fetch(`/api/admin/pipelines/${pipelineId}/run`, { method: 'POST' });
    await loadPipelines();
  }

  async function toggleStatus(p: Pipeline) {
    const newStatus = p.status === 'paused' ? 'active' : 'paused';
    await fetch('/api/admin/pipelines', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, status: newStatus }),
    });
    await loadPipelines();
  }

  async function createPipeline() {
    const stages = formStages.filter(s => s.name.trim());
    await fetch('/api/admin/pipelines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()) : [],
        stages,
        cron_expression: form.trigger_type === 'cron' ? form.cron_expression : undefined,
      }),
    });
    await loadPipelines();
    setActiveTab(0);
  }

  const tabs = ['All Pipelines', 'Run History', 'Pipeline Designer', 'Create Pipeline', 'Health Dashboard'];

  // Health stats
  const totalPipelines = pipelines.length;
  const runningNow = pipelines.filter(p => p.status === 'running' || p.latest_run_status === 'running').length;
  const failedPipelines = pipelines.filter(p => p.latest_run_status === 'failed').length;
  const avgSuccessRate = pipelines.length > 0 ? (pipelines.reduce((a, p) => a + Number(p.success_rate || 100), 0) / pipelines.length).toFixed(1) : '100';

  return (
    <div className="min-h-screen p-6" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)' }}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Pipeline Registry & Monitoring 🔀</h1>
          <p className="text-white/60 mt-1">Manage, run and monitor data pipelines</p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {tabs.map((t, i) => (
            <button key={i} onClick={() => setActiveTab(i)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === i ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10'}`}>
              {t}
            </button>
          ))}
        </div>

        {/* Tab 0: All Pipelines */}
        {activeTab === 0 && (
          <div>
            {loading && <p className="text-white/60">Loading…</p>}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pipelines.map(p => (
                <div key={p.id} className={`${GLASS} flex flex-col gap-3`}>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-white font-semibold text-sm">{p.name}</h3>
                    <Badge text={p.pipeline_type} className={TYPE_COLORS[p.pipeline_type] || 'bg-gray-500/30 text-gray-200'} />
                  </div>
                  <p className="text-white/60 text-xs">{p.description}</p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge text={p.status} className={STATUS_COLORS[p.status] || 'bg-gray-500/30 text-gray-200'} />
                    <Badge text={p.trigger_type} className="bg-white/10 text-white/70" />
                    <span className="text-white/50">{p.stage_count} stages</span>
                  </div>
                  {p.latest_run_status && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-white/50">Last run:</span>
                      <Badge text={p.latest_run_status} className={STATUS_COLORS[p.latest_run_status] || 'bg-gray-500/30 text-gray-200'} />
                      {p.latest_run_duration_ms && <span className="text-white/50">{p.latest_run_duration_ms}ms</span>}
                    </div>
                  )}
                  {/* Success rate bar */}
                  <div>
                    <div className="flex justify-between text-xs text-white/50 mb-1">
                      <span>Success Rate</span><span>{Number(p.success_rate || 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/10 rounded-full">
                      <div className="h-1.5 rounded-full bg-green-400" style={{ width: `${p.success_rate || 100}%` }} />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-1">
                    <button onClick={() => triggerRun(p.id)} className="flex-1 text-xs py-1.5 rounded-lg bg-blue-500/30 hover:bg-blue-500/50 text-blue-200 transition-colors">Run Now</button>
                    <button onClick={() => toggleStatus(p)} className="flex-1 text-xs py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 transition-colors">
                      {p.status === 'paused' ? 'Resume' : 'Pause'}
                    </button>
                    <button onClick={() => { setSelectedPipeline(p); setActiveTab(2); }} className="flex-1 text-xs py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 transition-colors">Design</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 1: Run History */}
        {activeTab === 1 && (
          <div className={GLASS}>
            <div className="flex flex-wrap gap-3 mb-4">
              <select value={runFilter.pipeline_id} onChange={e => setRunFilter(f => ({ ...f, pipeline_id: e.target.value }))}
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm">
                <option value="">All Pipelines</option>
                {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select value={runFilter.status} onChange={e => setRunFilter(f => ({ ...f, status: e.target.value }))}
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm">
                <option value="">All Statuses</option>
                {['running', 'success', 'failed', 'cancelled', 'timeout'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button onClick={loadRuns} className="px-4 py-1.5 rounded-lg bg-blue-500/30 hover:bg-blue-500/50 text-blue-200 text-sm">Filter</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-white/60 text-left border-b border-white/10">
                    <th className="pb-2 pr-4">Pipeline</th>
                    <th className="pb-2 pr-4">Run ID</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">Triggered By</th>
                    <th className="pb-2 pr-4">Started</th>
                    <th className="pb-2 pr-4">Duration</th>
                    <th className="pb-2 pr-4">Records In→Out→Failed</th>
                    <th className="pb-2">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map(r => (
                    <tr key={r.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-2 pr-4 text-white/80">{r.pipeline_name}</td>
                      <td className="py-2 pr-4 text-white/60 font-mono text-xs">{r.run_id.slice(0, 30)}</td>
                      <td className="py-2 pr-4"><Badge text={r.status} className={STATUS_COLORS[r.status] || 'bg-gray-500/30 text-gray-200'} /></td>
                      <td className="py-2 pr-4 text-white/60">{r.triggered_by}</td>
                      <td className="py-2 pr-4 text-white/60 text-xs">{new Date(r.started_at).toLocaleString()}</td>
                      <td className="py-2 pr-4 text-white/60">{r.duration_ms ? `${r.duration_ms}ms` : '—'}</td>
                      <td className="py-2 pr-4 text-white/60">{r.records_in}→{r.records_out}→{r.records_failed}</td>
                      <td className="py-2 text-red-300 text-xs max-w-[150px] truncate">{r.error_message || '—'}</td>
                    </tr>
                  ))}
                  {runs.length === 0 && <tr><td colSpan={8} className="py-4 text-center text-white/40">No runs found</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Pipeline Designer */}
        {activeTab === 2 && (
          <div className={GLASS}>
            <div className="mb-4">
              <select value={selectedPipeline?.id || ''} onChange={e => setSelectedPipeline(pipelines.find(p => p.id === Number(e.target.value)) || null)}
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white">
                <option value="">Select a pipeline…</option>
                {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            {selectedPipeline && (
              <div>
                <h3 className="text-white font-semibold mb-6">{selectedPipeline.name}</h3>
                <div className="flex flex-wrap items-center gap-3">
                  {(Array.isArray(selectedPipeline.stages) ? selectedPipeline.stages : []).sort((a, b) => (a.order || 0) - (b.order || 0)).map((stage, i, arr) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="bg-slate-800/70 border border-white/20 rounded-full px-5 py-3 flex flex-col items-center gap-1 min-w-[100px]">
                        <span className="text-lg">{STAGE_ICONS[stage.type] || '⬜'}</span>
                        <span className="text-white text-xs font-medium text-center">{stage.name}</span>
                        <span className="text-white/50 text-xs">{stage.type}</span>
                        <span className="text-white/30 text-xs">#{stage.order || i + 1}</span>
                      </div>
                      {i < arr.length - 1 && <span className="text-white/40 text-2xl">→</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Create Pipeline */}
        {activeTab === 3 && (
          <div className={GLASS}>
            <h3 className="text-white font-semibold mb-4">Create Pipeline</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {(['name', 'description', 'owner'] as const).map(field => (
                <div key={field}>
                  <label className="text-white/60 text-xs mb-1 block capitalize">{field}</label>
                  <input value={form[field as keyof typeof form]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm" placeholder={field} />
                </div>
              ))}
              <div>
                <label className="text-white/60 text-xs mb-1 block">Pipeline Type</label>
                <select value={form.pipeline_type} onChange={e => setForm(f => ({ ...f, pipeline_type: e.target.value }))}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm">
                  {['data', 'ml', 'etl', 'content', 'marketing', 'ai', 'integration'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-white/60 text-xs mb-1 block">Trigger Type</label>
                <select value={form.trigger_type} onChange={e => setForm(f => ({ ...f, trigger_type: e.target.value }))}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm">
                  {['manual', 'cron', 'event', 'webhook', 'stream'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              {form.trigger_type === 'cron' && (
                <div>
                  <label className="text-white/60 text-xs mb-1 block">Cron Expression</label>
                  <input value={form.cron_expression} onChange={e => setForm(f => ({ ...f, cron_expression: e.target.value }))}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm" placeholder="0 * * * *" />
                </div>
              )}
              <div>
                <label className="text-white/60 text-xs mb-1 block">Tags (comma-separated)</label>
                <input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm" placeholder="tag1, tag2" />
              </div>
            </div>
            {/* Stage builder */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-white/60 text-xs">Stages</label>
                <button onClick={() => setFormStages(s => [...s, { name: '', type: 'extract' }])}
                  className="text-xs px-3 py-1 rounded-lg bg-blue-500/30 text-blue-200 hover:bg-blue-500/50">+ Add Stage</button>
              </div>
              {formStages.map((stage, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input value={stage.name} onChange={e => setFormStages(s => s.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                    className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm" placeholder={`Stage ${i + 1} name`} />
                  <select value={stage.type} onChange={e => setFormStages(s => s.map((x, j) => j === i ? { ...x, type: e.target.value } : x))}
                    className="bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-white text-sm">
                    {Object.keys(STAGE_ICONS).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <button onClick={() => setFormStages(s => s.filter((_, j) => j !== i))} className="text-red-300 hover:text-red-200 px-2">×</button>
                </div>
              ))}
            </div>
            <button onClick={createPipeline} className="px-6 py-2 rounded-xl bg-blue-500/40 hover:bg-blue-500/60 text-white font-medium">Create Pipeline</button>
          </div>
        )}

        {/* Tab 4: Health Dashboard */}
        {activeTab === 4 && (
          <div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <KpiCard label="Total Pipelines" value={totalPipelines} />
              <KpiCard label="Running Now" value={runningNow} />
              <KpiCard label="Failed (last 24h)" value={failedPipelines} />
              <KpiCard label="Avg Success Rate" value={`${avgSuccessRate}%`} />
            </div>
            <div className={GLASS}>
              <h3 className="text-white font-semibold mb-4">Pipeline Status</h3>
              <div className="flex flex-col gap-3">
                {pipelines.map(p => (
                  <div key={p.id} className={`flex items-center justify-between p-3 rounded-xl border ${p.latest_run_status === 'failed' ? 'border-red-500/50 bg-red-500/10' : 'border-white/10 bg-white/5'}`}>
                    <div className="flex items-center gap-3">
                      <Badge text={p.pipeline_type} className={TYPE_COLORS[p.pipeline_type] || 'bg-gray-500/30 text-gray-200'} />
                      <span className="text-white text-sm">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-white/50">{p.run_count} runs</span>
                      <Badge text={p.status} className={STATUS_COLORS[p.status] || 'bg-gray-500/30 text-gray-200'} />
                      {p.latest_run_status && <Badge text={p.latest_run_status} className={STATUS_COLORS[p.latest_run_status] || 'bg-gray-500/30 text-gray-200'} />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
