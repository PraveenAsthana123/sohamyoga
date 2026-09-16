'use client';

import { useEffect, useState, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface AutomationJob {
  id: string; name: string; category: string; trigger_type: string;
  trigger_config: Record<string, string>; status: string; last_run_at: string | null;
  last_run_status: string | null; run_count: number; success_count: number;
  error_count: number; avg_duration_seconds: number | null; description: string | null;
  steps_json: StepItem[]; tool: string; roi_hours_saved_per_run: number | null;
  created_at: string;
}
interface AutomationRun {
  id: string; job_id: string; job_name: string; category: string; status: string;
  started_at: string; ended_at: string | null; duration_seconds: number | null;
  items_processed: number; errors_json: ErrorItem[]; output_json: Record<string, unknown>;
}
interface AutomationTemplate {
  id: string; name: string; category: string; description: string;
  use_case: string; tool: string; estimated_hours_saved_per_month: number;
  difficulty: string; steps_json: StepItem[];
}
interface StepItem { step: number; action: string; config: Record<string, string>; }
interface ErrorItem { code: string; message: string; }
interface CategoryRow { category: string; total: number; active: number; idle: number; error_count: number; }
interface Kpi {
  totalJobs: number; activeJobs: number; errorJobs: number; idleJobs: number;
  totalRuns: number; totalSuccesses: number; totalErrors: number;
  totalHoursSaved: number; successRate: number;
}
interface ApiData { jobs: AutomationJob[]; runs: AutomationRun[]; templates: AutomationTemplate[]; kpi: Kpi; categoryMatrix: CategoryRow[]; }
interface RunResult {
  runId: string; status: string; itemsProcessed: number; durationSeconds: number;
  errors: ErrorItem[]; output: Record<string, unknown>; aiInsight: string;
}
interface DiscoveryResult {
  description: string; whatToAutomate: string; bestTool: string;
  estimatedHoursSavedMonth: number; difficulty: string; roiScore: number;
  rawAnalysis: string; analyzedAt: string;
}
interface NewJobForm {
  name: string; category: string; trigger_type: string; trigger_config: string;
  description: string; tool: string; roi_hours_saved_per_run: string; steps_json: string;
}
interface StepBuilderItem { type: string; action: string; config: string; }
interface RoiState { hoursPerRun: string; runsPerMonth: string; hourlyRate: string; }

// ── Constants ─────────────────────────────────────────────────────────────────
const TABS = ['Dashboard', 'All Automations', 'Builder', 'Library', 'Discovery', 'Run History', 'ROI Calculator'] as const;
type Tab = typeof TABS[number];

const CATEGORIES = ['rpa', 'api', 'email', 'crm', 'outbound', 'meeting', 'social', 'data', 'document', 'finance', 'hr', 'support'];
const TOOLS = ['custom', 'n8n', 'zapier', 'make', 'power_automate', 'rpa_tool'];
const TRIGGERS = ['manual', 'scheduled', 'webhook', 'event'];
const STEP_TYPES = ['Fetch URL', 'Send Email', 'Update DB', 'Call API', 'AI Transform', 'Filter', 'Loop', 'Notify Slack', 'Wait', 'Branch'];
const EXAMPLE_PROCESSES = [
  'Every Monday, I manually export leads from our CRM, clean the data in Excel, and send a summary email to the sales team.',
  'When a customer submits a contact form, I copy their details into our CRM, send a welcome email, and add them to a Slack channel.',
  'Each week I review all new social media comments and manually reply to each one with a relevant response.',
  'After every sales meeting, I type up the notes, create action items in Jira, and send the summary email to all attendees.',
  'We manually download our bank transactions daily, categorize each expense in a spreadsheet, and update our accounting software.',
];

const CAT_COLORS: Record<string, string> = {
  rpa: 'bg-purple-100 text-purple-800', api: 'bg-blue-100 text-blue-800',
  email: 'bg-indigo-100 text-indigo-800', crm: 'bg-green-100 text-green-800',
  outbound: 'bg-orange-100 text-orange-800', meeting: 'bg-teal-100 text-teal-800',
  social: 'bg-pink-100 text-pink-800', data: 'bg-amber-100 text-amber-800',
  document: 'bg-cyan-100 text-cyan-800', finance: 'bg-emerald-100 text-emerald-800',
  hr: 'bg-rose-100 text-rose-800', support: 'bg-sky-100 text-sky-800',
};
const TOOL_COLORS: Record<string, string> = {
  n8n: 'bg-red-100 text-red-700', zapier: 'bg-orange-100 text-orange-700',
  make: 'bg-violet-100 text-violet-700', power_automate: 'bg-blue-100 text-blue-700',
  rpa_tool: 'bg-gray-100 text-gray-700', custom: 'bg-slate-100 text-slate-700',
};
const STATUS_DOT: Record<string, string> = {
  active: 'bg-green-500', idle: 'bg-gray-400', running: 'bg-blue-500',
  paused: 'bg-amber-500', error: 'bg-red-500', completed: 'bg-teal-500',
};
const DIFF_COLORS: Record<string, string> = {
  easy: 'bg-green-100 text-green-700', medium: 'bg-amber-100 text-amber-700', hard: 'bg-red-100 text-red-700',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function Badge({ label, cls }: { label: string; cls: string }) {
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>;
}
function Kpi({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const borders: Record<string, string> = {
    blue: 'border-l-4 border-blue-500 bg-blue-50', green: 'border-l-4 border-green-500 bg-green-50',
    amber: 'border-l-4 border-amber-500 bg-amber-50', purple: 'border-l-4 border-purple-500 bg-purple-50',
    teal: 'border-l-4 border-teal-500 bg-teal-50', red: 'border-l-4 border-red-500 bg-red-50',
    indigo: 'border-l-4 border-indigo-500 bg-indigo-50',
  };
  return (
    <div className={`rounded-lg p-4 ${borders[color] ?? borders.blue}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}
function StatusDot({ status }: { status: string }) {
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${STATUS_DOT[status] ?? 'bg-gray-300'}`} />;
}
function fmtDur(s: number | null) {
  if (!s) return '—';
  if (s < 60) return `${s.toFixed(1)}s`;
  return `${(s / 60).toFixed(1)}m`;
}
function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function miniBar(val: number, max: number = 14) {
  const blocks = Math.round((val / max) * 8);
  return '▓'.repeat(Math.max(0, blocks)) + '░'.repeat(Math.max(0, 8 - blocks));
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AiAutomationPage() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('Dashboard');
  const [runningId, setRunningId] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<RunResult | null>(null);
  const [filterCat, setFilterCat] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterTool, setFilterTool] = useState('all');
  const [filterTrigger, setFilterTrigger] = useState('all');
  const [showNewModal, setShowNewModal] = useState(false);
  const [newJob, setNewJob] = useState<NewJobForm>({ name: '', category: 'rpa', trigger_type: 'manual', trigger_config: '{}', description: '', tool: 'custom', roi_hours_saved_per_run: '', steps_json: '[]' });
  const [saving, setSaving] = useState(false);
  const [builderStep, setBuilderStep] = useState(1);
  const [builderForm, setBuilderForm] = useState({ name: '', description: '', category: 'rpa', tool: 'n8n', trigger_type: 'manual', trigger_cron: '', trigger_webhook: '', trigger_event: '' });
  const [builderSteps, setBuilderSteps] = useState<StepBuilderItem[]>([{ type: 'Fetch URL', action: '', config: '' }]);
  const [discoverText, setDiscoverText] = useState('');
  const [discovering, setDiscovering] = useState(false);
  const [discoverResult, setDiscoverResult] = useState<DiscoveryResult | null>(null);
  const [discoverHistory, setDiscoverHistory] = useState<DiscoveryResult[]>([]);
  const [roi, setRoi] = useState<RoiState>({ hoursPerRun: '2', runsPerMonth: '20', hourlyRate: '75' });
  const [runFilter, setRunFilter] = useState({ job: 'all', status: 'all' });
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/ai-automation');
      if (res.ok) setData(await res.json() as ApiData);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function runJob(id: string) {
    setRunningId(id);
    setLastRun(null);
    try {
      const res = await fetch(`/api/admin/ai-automation/${id}/run`, { method: 'POST' });
      if (res.ok) {
        const result = await res.json() as RunResult;
        setLastRun(result);
        await load();
      }
    } finally {
      setRunningId(null);
    }
  }

  async function createJob() {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/ai-automation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newJob,
          trigger_config: JSON.parse(newJob.trigger_config || '{}'),
          steps_json: JSON.parse(newJob.steps_json || '[]'),
          roi_hours_saved_per_run: newJob.roi_hours_saved_per_run ? Number(newJob.roi_hours_saved_per_run) : null,
        }),
      });
      if (res.ok) {
        setShowNewModal(false);
        setNewJob({ name: '', category: 'rpa', trigger_type: 'manual', trigger_config: '{}', description: '', tool: 'custom', roi_hours_saved_per_run: '', steps_json: '[]' });
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function cloneTemplate(t: AutomationTemplate) {
    await fetch('/api/admin/ai-automation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: t.name + ' (Clone)', category: t.category, description: t.description, tool: t.tool, steps_json: t.steps_json }),
    });
    await load();
    setActiveTab('All Automations');
  }

  async function discover() {
    if (!discoverText.trim()) return;
    setDiscovering(true);
    try {
      const res = await fetch('/api/admin/ai-automation/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: discoverText }),
      });
      if (res.ok) {
        const result = await res.json() as DiscoveryResult;
        setDiscoverResult(result);
        setDiscoverHistory(h => [result, ...h].slice(0, 10));
      }
    } finally {
      setDiscovering(false);
    }
  }

  function useDiscoverAsBuilder(r: DiscoveryResult) {
    setBuilderForm({ name: `Auto: ${r.whatToAutomate.substring(0, 40)}`, description: r.description, category: 'api', tool: r.bestTool.toLowerCase().replace(/[^a-z0-9_]/g, '_'), trigger_type: 'manual', trigger_cron: '', trigger_webhook: '', trigger_event: '' });
    setBuilderStep(1);
    setActiveTab('Builder');
  }

  // Computed
  const filteredJobs = (data?.jobs ?? []).filter(j => {
    if (filterCat !== 'all' && j.category !== filterCat) return false;
    if (filterStatus !== 'all' && j.status !== filterStatus) return false;
    if (filterTool !== 'all' && j.tool !== filterTool) return false;
    if (filterTrigger !== 'all' && j.trigger_type !== filterTrigger) return false;
    return true;
  });

  const filteredRuns = (data?.runs ?? []).filter(r => {
    if (runFilter.job !== 'all' && r.job_id !== runFilter.job) return false;
    if (runFilter.status !== 'all' && r.status !== runFilter.status) return false;
    return true;
  });

  const topRoi = [...(data?.jobs ?? [])].sort((a, b) => ((b.roi_hours_saved_per_run ?? 0) * b.run_count) - ((a.roi_hours_saved_per_run ?? 0) * a.run_count)).slice(0, 5);

  const roiMonthly = Number(roi.hoursPerRun) * Number(roi.runsPerMonth) * Number(roi.hourlyRate);
  const roiAnnual = roiMonthly * 12;

  // Runs per day (last 14)
  const runsByDay: Record<string, { success: number; error: number }> = {};
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    runsByDay[d.toISOString().slice(0, 10)] = { success: 0, error: 0 };
  }
  for (const r of data?.runs ?? []) {
    const day = r.started_at.slice(0, 10);
    if (runsByDay[day]) {
      if (r.status === 'success') runsByDay[day].success++;
      else runsByDay[day].error++;
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500">Loading AI Automation Hub...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI Automation Command Center</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage, monitor, and discover intelligent business automations</p>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Refresh</button>
            <button onClick={() => setShowNewModal(true)} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">+ New Automation</button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b px-6">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 py-6 max-w-screen-xl mx-auto">

        {/* ── Tab 1: Dashboard ── */}
        {activeTab === 'Dashboard' && data && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <Kpi label="Total Automations" value={data.kpi.totalJobs} color="blue" />
              <Kpi label="Running Now" value={data.kpi.activeJobs} sub="active jobs" color="green" />
              <Kpi label="Hours Saved" value={`${data.kpi.totalHoursSaved.toFixed(0)}h`} sub="all time" color="teal" />
              <Kpi label="Success Rate" value={`${data.kpi.successRate}%`} sub="of all runs" color="purple" />
              <Kpi label="Total Runs" value={data.kpi.totalRuns} color="indigo" />
              <Kpi label="Error Jobs" value={data.kpi.errorJobs} sub="need attention" color="red" />
            </div>

            {/* Category Health Matrix */}
            <div className="bg-white rounded-xl border p-5">
              <h2 className="text-base font-semibold mb-4">Automation Health Matrix</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b">
                      <th className="pb-2 pr-6">Category</th>
                      <th className="pb-2 pr-4 text-center">Total</th>
                      <th className="pb-2 pr-4 text-center">Active</th>
                      <th className="pb-2 pr-4 text-center">Idle</th>
                      <th className="pb-2 text-center">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.categoryMatrix.map(r => (
                      <tr key={r.category} className="border-b last:border-0">
                        <td className="py-2 pr-6"><Badge label={r.category.toUpperCase()} cls={CAT_COLORS[r.category] ?? 'bg-gray-100 text-gray-700'} /></td>
                        <td className="py-2 pr-4 text-center font-semibold">{r.total}</td>
                        <td className="py-2 pr-4 text-center text-green-600 font-medium">{r.active}</td>
                        <td className="py-2 pr-4 text-center text-gray-500">{r.idle}</td>
                        <td className="py-2 text-center text-red-600 font-medium">{r.error_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top ROI + Recent Runs side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border p-5">
                <h2 className="text-base font-semibold mb-4">Top ROI Automations</h2>
                <div className="space-y-3">
                  {topRoi.map((j, i) => (
                    <div key={j.id} className="flex items-center gap-3">
                      <span className="w-6 h-6 bg-amber-100 text-amber-700 rounded-full text-xs font-bold flex items-center justify-center">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{j.name}</p>
                        <p className="text-xs text-gray-400">{j.run_count} runs · {(j.roi_hours_saved_per_run ?? 0).toFixed(1)}h/run</p>
                      </div>
                      <span className="text-sm font-bold text-green-600">{((j.roi_hours_saved_per_run ?? 0) * j.run_count).toFixed(0)}h</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl border p-5">
                <h2 className="text-base font-semibold mb-4">Recent Runs (last 10)</h2>
                <div className="space-y-2">
                  {data.runs.slice(0, 10).map(r => (
                    <div key={r.id} className="flex items-center gap-2 text-sm">
                      <StatusDot status={r.status} />
                      <span className="flex-1 truncate text-gray-700">{r.job_name}</span>
                      <span className="text-xs text-gray-400">{fmtDur(r.duration_seconds)}</span>
                      <span className="text-xs text-gray-400">{r.items_processed} items</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Last run result banner */}
            {lastRun && (
              <div className={`rounded-xl border p-4 ${lastRun.status === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{lastRun.status === 'success' ? '✓' : '✗'}</span>
                  <div>
                    <p className="font-semibold text-sm">{lastRun.status === 'success' ? 'Job completed successfully' : 'Job failed'}</p>
                    <p className="text-sm text-gray-600 mt-1">{lastRun.aiInsight}</p>
                    <p className="text-xs text-gray-400 mt-1">{lastRun.itemsProcessed} items · {fmtDur(lastRun.durationSeconds)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tab 2: All Automations ── */}
        {activeTab === 'All Automations' && data && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="bg-white rounded-xl border p-4 flex flex-wrap gap-3">
              <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="text-sm border rounded-lg px-3 py-1.5">
                <option value="all">All Categories</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
              </select>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="text-sm border rounded-lg px-3 py-1.5">
                <option value="all">All Statuses</option>
                {['idle', 'active', 'running', 'paused', 'error', 'completed'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={filterTool} onChange={e => setFilterTool(e.target.value)} className="text-sm border rounded-lg px-3 py-1.5">
                <option value="all">All Tools</option>
                {TOOLS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={filterTrigger} onChange={e => setFilterTrigger(e.target.value)} className="text-sm border rounded-lg px-3 py-1.5">
                <option value="all">All Triggers</option>
                {TRIGGERS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <span className="text-sm text-gray-400 self-center ml-auto">{filteredJobs.length} jobs</span>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Tool</th>
                      <th className="px-4 py-3">Trigger</th>
                      <th className="px-4 py-3">Last Run</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-center">Runs</th>
                      <th className="px-4 py-3 text-center">Avg Dur</th>
                      <th className="px-4 py-3 text-center">ROI h/run</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredJobs.map(j => (
                      <tr key={j.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium max-w-xs">
                          <p className="truncate">{j.name}</p>
                          {j.description && <p className="text-xs text-gray-400 truncate">{j.description}</p>}
                        </td>
                        <td className="px-4 py-3"><Badge label={j.category.toUpperCase()} cls={CAT_COLORS[j.category] ?? 'bg-gray-100 text-gray-700'} /></td>
                        <td className="px-4 py-3"><Badge label={j.tool} cls={TOOL_COLORS[j.tool] ?? 'bg-gray-100 text-gray-600'} /></td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{j.trigger_type}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(j.last_run_at)}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <StatusDot status={j.status} />
                            <span className="text-xs capitalize">{j.status}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">{j.run_count}</td>
                        <td className="px-4 py-3 text-center">{fmtDur(j.avg_duration_seconds)}</td>
                        <td className="px-4 py-3 text-center font-semibold text-green-600">{j.roi_hours_saved_per_run?.toFixed(1) ?? '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5 flex-wrap">
                            <button onClick={() => void runJob(j.id)} disabled={runningId === j.id}
                              className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">
                              {runningId === j.id ? '...' : '▶ Run'}
                            </button>
                            <button className="px-2 py-1 text-xs border rounded hover:bg-gray-50 text-amber-600">Pause</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredJobs.length === 0 && (
                      <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">No automations match the selected filters</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab 3: Automation Builder ── */}
        {activeTab === 'Builder' && (
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Progress */}
            <div className="flex items-center gap-0">
              {[1, 2, 3, 4].map((s, i) => (
                <div key={s} className="flex items-center flex-1">
                  <button onClick={() => setBuilderStep(s)}
                    className={`w-8 h-8 rounded-full text-sm font-bold flex items-center justify-center transition-colors ${builderStep >= s ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                    {s}
                  </button>
                  {i < 3 && <div className={`h-1 flex-1 ${builderStep > s ? 'bg-blue-600' : 'bg-gray-200'}`} />}
                </div>
              ))}
            </div>
            <div className="flex justify-between text-xs text-gray-500 -mt-2">
              <span>Basics</span><span>Trigger</span><span>Steps</span><span>Test & Save</span>
            </div>

            <div className="bg-white rounded-xl border p-6">
              {builderStep === 1 && (
                <div className="space-y-4">
                  <h2 className="text-base font-semibold">Step 1 — Name & Description</h2>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Automation Name *</label>
                    <input value={builderForm.name} onChange={e => setBuilderForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Weekly Lead Report" className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea value={builderForm.description} onChange={e => setBuilderForm(f => ({ ...f, description: e.target.value }))}
                      rows={3} className="w-full border rounded-lg px-3 py-2 text-sm resize-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                      <select value={builderForm.category} onChange={e => setBuilderForm(f => ({ ...f, category: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                        {CATEGORIES.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tool</label>
                      <select value={builderForm.tool} onChange={e => setBuilderForm(f => ({ ...f, tool: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                        {TOOLS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                  <button onClick={() => setBuilderStep(2)} className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Next: Set Trigger →</button>
                </div>
              )}

              {builderStep === 2 && (
                <div className="space-y-4">
                  <h2 className="text-base font-semibold">Step 2 — Trigger Configuration</h2>
                  <div className="grid grid-cols-2 gap-3">
                    {TRIGGERS.map(t => (
                      <button key={t} onClick={() => setBuilderForm(f => ({ ...f, trigger_type: t }))}
                        className={`py-3 px-4 border-2 rounded-lg text-sm font-medium capitalize transition-colors ${builderForm.trigger_type === t ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 hover:border-gray-300'}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                  {builderForm.trigger_type === 'scheduled' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Cron Expression</label>
                      <input value={builderForm.trigger_cron} onChange={e => setBuilderForm(f => ({ ...f, trigger_cron: e.target.value }))}
                        placeholder="0 9 * * 1-5 (weekdays at 9am)" className="w-full border rounded-lg px-3 py-2 text-sm font-mono" />
                    </div>
                  )}
                  {builderForm.trigger_type === 'webhook' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Webhook Path</label>
                      <input value={builderForm.trigger_webhook} onChange={e => setBuilderForm(f => ({ ...f, trigger_webhook: e.target.value }))}
                        placeholder="/webhooks/my-trigger" className="w-full border rounded-lg px-3 py-2 text-sm font-mono" />
                    </div>
                  )}
                  {builderForm.trigger_type === 'event' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Event Name</label>
                      <select value={builderForm.trigger_event} onChange={e => setBuilderForm(f => ({ ...f, trigger_event: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                        <option value="">Select event...</option>
                        {['new_lead', 'new_order', 'meeting_ended', 'new_contact', 'order_completed', 'new_ticket', 'new_hire', 'new_comment'].map(ev => (
                          <option key={ev} value={ev}>{ev}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button onClick={() => setBuilderStep(1)} className="flex-1 py-2 border rounded-lg text-sm hover:bg-gray-50">← Back</button>
                    <button onClick={() => setBuilderStep(3)} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Next: Add Steps →</button>
                  </div>
                </div>
              )}

              {builderStep === 3 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold">Step 3 — Automation Steps</h2>
                    <button onClick={() => setBuilderSteps(s => [...s, { type: 'Fetch URL', action: '', config: '' }])}
                      className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100">+ Add Step</button>
                  </div>
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                    {builderSteps.map((step, i) => (
                      <div key={i} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full text-xs font-bold flex items-center justify-center">{i + 1}</span>
                          <select value={step.type} onChange={e => setBuilderSteps(s => s.map((x, j) => j === i ? { ...x, type: e.target.value } : x))} className="text-sm border rounded-lg px-2 py-1 flex-1">
                            {STEP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                          <button onClick={() => setBuilderSteps(s => s.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 text-xs">Remove</button>
                        </div>
                        <input value={step.action} onChange={e => setBuilderSteps(s => s.map((x, j) => j === i ? { ...x, action: e.target.value } : x))}
                          placeholder="Action description" className="w-full border rounded-lg px-2 py-1.5 text-sm" />
                        <input value={step.config} onChange={e => setBuilderSteps(s => s.map((x, j) => j === i ? { ...x, config: e.target.value } : x))}
                          placeholder='Config (JSON or key=value)' className="w-full border rounded-lg px-2 py-1.5 text-sm font-mono text-xs" />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setBuilderStep(2)} className="flex-1 py-2 border rounded-lg text-sm hover:bg-gray-50">← Back</button>
                    <button onClick={() => setBuilderStep(4)} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Next: Test & Save →</button>
                  </div>
                </div>
              )}

              {builderStep === 4 && (
                <div className="space-y-4">
                  <h2 className="text-base font-semibold">Step 4 — Review, Test & Save</h2>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                    <div className="flex gap-2"><span className="text-gray-500 w-28">Name:</span><span className="font-medium">{builderForm.name || 'Untitled'}</span></div>
                    <div className="flex gap-2"><span className="text-gray-500 w-28">Category:</span><Badge label={builderForm.category.toUpperCase()} cls={CAT_COLORS[builderForm.category] ?? 'bg-gray-100 text-gray-700'} /></div>
                    <div className="flex gap-2"><span className="text-gray-500 w-28">Tool:</span><Badge label={builderForm.tool} cls={TOOL_COLORS[builderForm.tool] ?? 'bg-gray-100 text-gray-600'} /></div>
                    <div className="flex gap-2"><span className="text-gray-500 w-28">Trigger:</span><span>{builderForm.trigger_type}</span></div>
                    <div className="flex gap-2"><span className="text-gray-500 w-28">Steps:</span><span>{builderSteps.length} steps defined</span></div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setBuilderStep(3)} className="py-2 px-4 border rounded-lg text-sm hover:bg-gray-50">← Back</button>
                    <button onClick={async () => {
                      setSaving(true);
                      await fetch('/api/admin/ai-automation', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          name: builderForm.name || 'Untitled Automation',
                          category: builderForm.category,
                          tool: builderForm.tool,
                          trigger_type: builderForm.trigger_type,
                          description: builderForm.description,
                          steps_json: builderSteps.map((s, i) => ({ step: i + 1, action: s.action, config: {} })),
                        }),
                      });
                      setSaving(false);
                      await load();
                      setActiveTab('All Automations');
                    }} disabled={saving} className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                      {saving ? 'Saving...' : 'Save & Activate'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Tab 4: Library ── */}
        {activeTab === 'Library' && data && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.templates.map(t => (
                <div key={t.id} className="bg-white rounded-xl border p-5 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm">{t.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{t.use_case}</p>
                    </div>
                    <Badge label={t.difficulty} cls={DIFF_COLORS[t.difficulty] ?? 'bg-gray-100 text-gray-700'} />
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">{t.description}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge label={t.category.toUpperCase()} cls={CAT_COLORS[t.category] ?? 'bg-gray-100 text-gray-700'} />
                    <Badge label={t.tool} cls={TOOL_COLORS[t.tool] ?? 'bg-gray-100 text-gray-600'} />
                    <span className="ml-auto text-xs font-semibold text-green-700">{t.estimated_hours_saved_per_month}h/mo saved</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => void cloneTemplate(t)} className="flex-1 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">Clone Template</button>
                    <button onClick={() => {
                      setDiscoverText(`I need to automate: ${t.description}`);
                      setActiveTab('Discovery');
                    }} className="px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-50 text-gray-600">Analyze</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-xl border p-5">
              <h2 className="text-base font-semibold mb-2">Request a Custom Automation</h2>
              <p className="text-sm text-gray-500 mb-3">Describe a manual process you'd like automated and we'll add it to the discovery queue.</p>
              <div className="flex gap-3">
                <input className="flex-1 border rounded-lg px-3 py-2 text-sm" placeholder="Describe the process..." />
                <button onClick={() => setActiveTab('Discovery')} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Discover →</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab 5: Opportunity Discovery ── */}
        {activeTab === 'Discovery' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-white rounded-xl border p-6 space-y-4">
              <h2 className="text-base font-semibold">Describe a Manual Process</h2>
              <textarea
                value={discoverText}
                onChange={e => setDiscoverText(e.target.value)}
                rows={4}
                placeholder="Describe a repetitive manual process you do regularly... e.g. 'Every week I manually export leads from our CRM, clean the data in Excel, and email the report to the sales team.'"
                className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
              />
              <div className="flex gap-3 flex-wrap">
                <button onClick={() => void discover()} disabled={discovering || !discoverText.trim()}
                  className="px-6 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {discovering ? 'Analyzing...' : 'Discover Automation'}
                </button>
                <button onClick={() => {
                  const [modal, setModalOpen] = ['', () => {}];
                  // Show examples inline
                  setDiscoverText(EXAMPLE_PROCESSES[Math.floor(Math.random() * EXAMPLE_PROCESSES.length)]);
                }} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Random Example</button>
              </div>

              {/* Example processes */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Example Processes</p>
                <div className="space-y-1.5">
                  {EXAMPLE_PROCESSES.map((ex, i) => (
                    <button key={i} onClick={() => setDiscoverText(ex)} className="w-full text-left text-xs text-blue-600 hover:underline truncate">{i + 1}. {ex}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Discovery Result */}
            {discoverResult && (
              <div className="bg-white rounded-xl border p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold">Automation Analysis</h2>
                  <span className="text-xs text-gray-400">{new Date(discoverResult.analyzedAt).toLocaleTimeString()}</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 rounded-lg p-3">
                    <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">What to Automate</p>
                    <p className="text-sm text-gray-700">{discoverResult.whatToAutomate}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3">
                    <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">Recommended Tool</p>
                    <p className="text-sm font-semibold text-gray-800">{discoverResult.bestTool}</p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-3">
                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Hours Saved/Month</p>
                    <p className="text-2xl font-bold text-gray-800">{discoverResult.estimatedHoursSavedMonth}h</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3">
                    <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-1">Difficulty</p>
                    <Badge label={discoverResult.difficulty} cls={DIFF_COLORS[discoverResult.difficulty] ?? 'bg-gray-100 text-gray-700'} />
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">ROI Score</p>
                    <span className="text-xl font-bold text-gray-800">{discoverResult.roiScore}/10</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full" style={{ width: `${discoverResult.roiScore * 10}%` }} />
                  </div>
                </div>
                {discoverResult.rawAnalysis && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Full AI Analysis</p>
                    <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{discoverResult.rawAnalysis}</p>
                  </div>
                )}
                <button onClick={() => useDiscoverAsBuilder(discoverResult)} className="w-full py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                  Create Automation from Discovery →
                </button>
              </div>
            )}

            {/* Discovery History */}
            {discoverHistory.length > 0 && (
              <div className="bg-white rounded-xl border p-5">
                <h2 className="text-sm font-semibold mb-3">Discovery History (this session)</h2>
                <div className="space-y-2">
                  {discoverHistory.map((h, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm border-b last:border-0 pb-2 last:pb-0">
                      <span className="text-gray-400 text-xs">{i + 1}</span>
                      <span className="flex-1 truncate text-gray-600">{h.description.substring(0, 60)}...</span>
                      <Badge label={`ROI: ${h.roiScore}/10`} cls="bg-green-50 text-green-700" />
                      <button onClick={() => setDiscoverResult(h)} className="text-xs text-blue-600 hover:underline">View</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tab 6: Run History ── */}
        {activeTab === 'Run History' && data && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="bg-white rounded-xl border p-4 flex gap-3 flex-wrap">
              <select value={runFilter.job} onChange={e => setRunFilter(f => ({ ...f, job: e.target.value }))} className="text-sm border rounded-lg px-3 py-1.5">
                <option value="all">All Jobs</option>
                {data.jobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
              </select>
              <select value={runFilter.status} onChange={e => setRunFilter(f => ({ ...f, status: e.target.value }))} className="text-sm border rounded-lg px-3 py-1.5">
                <option value="all">All Statuses</option>
                <option value="success">Success</option>
                <option value="error">Error</option>
                <option value="running">Running</option>
              </select>
              <span className="text-sm text-gray-400 self-center ml-auto">{filteredRuns.length} runs</span>
            </div>

            {/* Runs per day chart */}
            <div className="bg-white rounded-xl border p-5">
              <h2 className="text-sm font-semibold mb-4">Runs Per Day (Last 14 Days)</h2>
              <div className="flex items-end gap-1 overflow-x-auto pb-2">
                {Object.entries(runsByDay).map(([day, { success, error }]) => {
                  const total = success + error;
                  return (
                    <div key={day} className="flex flex-col items-center gap-1 min-w-0 flex-1">
                      <span className="text-xs text-gray-400 font-mono">{total || ''}</span>
                      <div className="w-full flex flex-col-reverse gap-0.5">
                        {success > 0 && <div className="bg-green-500 rounded-sm" style={{ height: `${success * 14}px` }} title={`${success} success`} />}
                        {error > 0 && <div className="bg-red-400 rounded-sm" style={{ height: `${error * 14}px` }} title={`${error} error`} />}
                        {total === 0 && <div className="bg-gray-100 rounded-sm h-2" />}
                      </div>
                      <span className="text-xs text-gray-400 rotate-45 origin-left whitespace-nowrap" style={{ fontSize: '9px' }}>{day.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-4 mt-3 text-xs">
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500 rounded-sm inline-block" /> Success</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-400 rounded-sm inline-block" /> Error</span>
              </div>
            </div>

            {/* Runs Table */}
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-3">Job</th>
                      <th className="px-4 py-3">Started</th>
                      <th className="px-4 py-3">Ended</th>
                      <th className="px-4 py-3 text-center">Duration</th>
                      <th className="px-4 py-3 text-center">Items</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3">Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRuns.map(r => (
                      <>
                        <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">{r.job_name}</td>
                          <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(r.started_at)}</td>
                          <td className="px-4 py-3 text-xs text-gray-500">{r.ended_at ? fmtDate(r.ended_at) : '—'}</td>
                          <td className="px-4 py-3 text-center">{fmtDur(r.duration_seconds)}</td>
                          <td className="px-4 py-3 text-center">{r.items_processed}</td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <StatusDot status={r.status} />
                              <span className="capitalize text-xs">{r.status}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {r.errors_json?.length > 0 ? (
                              <button onClick={() => setExpandedRunId(expandedRunId === r.id ? null : r.id)} className="text-xs text-red-600 hover:underline">
                                {expandedRunId === r.id ? 'Hide' : `${r.errors_json.length} error(s)`}
                              </button>
                            ) : <span className="text-xs text-gray-300">none</span>}
                          </td>
                        </tr>
                        {expandedRunId === r.id && r.errors_json?.length > 0 && (
                          <tr key={`${r.id}-err`} className="bg-red-50">
                            <td colSpan={7} className="px-4 py-3">
                              {r.errors_json.map((e, i) => (
                                <div key={i} className="text-xs text-red-700 font-mono">[{e.code}] {e.message}</div>
                              ))}
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                    {filteredRuns.length === 0 && (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No runs found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Per-job success rate */}
            <div className="bg-white rounded-xl border p-5">
              <h2 className="text-sm font-semibold mb-4">Success Rate by Job</h2>
              <div className="space-y-3">
                {data.jobs.filter(j => j.run_count > 0).sort((a, b) => b.run_count - a.run_count).slice(0, 10).map(j => {
                  const rate = j.run_count > 0 ? Math.round((j.success_count / j.run_count) * 100) : 0;
                  return (
                    <div key={j.id} className="flex items-center gap-3">
                      <span className="text-xs text-gray-600 w-48 truncate">{j.name}</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div className={`h-2 rounded-full ${rate >= 80 ? 'bg-green-500' : rate >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${rate}%` }} />
                      </div>
                      <span className="text-xs font-semibold w-10 text-right">{rate}%</span>
                      <span className="text-xs text-gray-400 w-16 text-right">{j.run_count} runs</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Tab 7: ROI Calculator ── */}
        {activeTab === 'ROI Calculator' && data && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Calculator */}
              <div className="bg-white rounded-xl border p-6 space-y-5">
                <h2 className="text-base font-semibold">ROI Calculator</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hours Saved Per Run</label>
                    <input type="number" value={roi.hoursPerRun} onChange={e => setRoi(r => ({ ...r, hoursPerRun: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" min="0" step="0.5" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Runs Per Month</label>
                    <input type="number" value={roi.runsPerMonth} onChange={e => setRoi(r => ({ ...r, runsPerMonth: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" min="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hourly Rate ($/hr)</label>
                    <input type="number" value={roi.hourlyRate} onChange={e => setRoi(r => ({ ...r, hourlyRate: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" min="0" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-green-50 rounded-lg p-4 text-center">
                    <p className="text-xs text-green-700 font-semibold uppercase tracking-wide">Monthly Savings</p>
                    <p className="text-3xl font-bold text-green-700 mt-1">${roiMonthly.toLocaleString()}</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <p className="text-xs text-blue-700 font-semibold uppercase tracking-wide">Annual Savings</p>
                    <p className="text-3xl font-bold text-blue-700 mt-1">${roiAnnual.toLocaleString()}</p>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
                  <strong>Hours saved/month:</strong> {(Number(roi.hoursPerRun) * Number(roi.runsPerMonth)).toFixed(0)}h
                  <br />
                  <strong>Estimated breakeven:</strong> ~{roiMonthly > 0 ? '1 month' : 'N/A'} (automation setup cost varies)
                </div>
                <button onClick={() => {
                  const w = window.open('', '_blank');
                  if (!w) return;
                  w.document.write(`<html><head><title>ROI Report</title></head><body style="font-family:sans-serif;padding:40px;max-width:600px"><h1>AI Automation ROI Report</h1><p>Generated: ${new Date().toLocaleDateString()}</p><hr/><h2>Inputs</h2><p>Hours per run: ${roi.hoursPerRun}</p><p>Runs per month: ${roi.runsPerMonth}</p><p>Hourly rate: $${roi.hourlyRate}</p><h2>Results</h2><p style="font-size:24px;color:green"><strong>Monthly Savings: $${roiMonthly.toLocaleString()}</strong></p><p style="font-size:24px;color:blue"><strong>Annual Savings: $${roiAnnual.toLocaleString()}</strong></p></body></html>`);
                  w.print();
                }} className="w-full py-2 border rounded-lg text-sm hover:bg-gray-50">Share ROI Report (Print/PDF)</button>
              </div>

              {/* Top 5 comparison */}
              <div className="bg-white rounded-xl border p-6">
                <h2 className="text-base font-semibold mb-4">Manual vs Automated — Top 5 by ROI</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs uppercase tracking-wide text-gray-500 border-b">
                        <th className="pb-2 text-left">Automation</th>
                        <th className="pb-2 text-right">Manual h/mo</th>
                        <th className="pb-2 text-right">Saved h/mo</th>
                        <th className="pb-2 text-right">$Saved/mo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topRoi.map(j => {
                        const savedHours = (j.roi_hours_saved_per_run ?? 0) * (j.run_count / Math.max(1, 1));
                        const manualHours = savedHours * 1.8;
                        const dollarSaved = savedHours * 75;
                        return (
                          <tr key={j.id} className="border-b last:border-0">
                            <td className="py-2 pr-2 font-medium max-w-[140px] truncate">{j.name}</td>
                            <td className="py-2 text-right text-red-500">{manualHours.toFixed(0)}h</td>
                            <td className="py-2 text-right text-green-600 font-semibold">{savedHours.toFixed(0)}h</td>
                            <td className="py-2 text-right text-green-700 font-bold">${dollarSaved.toFixed(0)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mini bar chart */}
                <div className="mt-6">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Hours Saved Comparison</p>
                  {topRoi.map(j => {
                    const savedHours = (j.roi_hours_saved_per_run ?? 0) * j.run_count;
                    const maxHours = Math.max(...topRoi.map(x => (x.roi_hours_saved_per_run ?? 0) * x.run_count), 1);
                    return (
                      <div key={j.id} className="flex items-center gap-2 mb-2">
                        <span className="text-xs text-gray-500 w-28 truncate">{j.name}</span>
                        <span className="font-mono text-xs text-green-600">{miniBar(savedHours, maxHours)}</span>
                        <span className="text-xs font-semibold text-gray-700">{savedHours.toFixed(0)}h</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── New Automation Modal ── */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">New Automation Job</h2>
                <button onClick={() => setShowNewModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input value={newJob.name} onChange={e => setNewJob(f => ({ ...f, name: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="My Automation" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select value={newJob.category} onChange={e => setNewJob(f => ({ ...f, category: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tool</label>
                  <select value={newJob.tool} onChange={e => setNewJob(f => ({ ...f, tool: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                    {TOOLS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Trigger Type</label>
                <select value={newJob.trigger_type} onChange={e => setNewJob(f => ({ ...f, trigger_type: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                  {TRIGGERS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={newJob.description} onChange={e => setNewJob(f => ({ ...f, description: e.target.value }))} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ROI Hours Saved Per Run</label>
                <input type="number" value={newJob.roi_hours_saved_per_run} onChange={e => setNewJob(f => ({ ...f, roi_hours_saved_per_run: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. 2.5" step="0.5" min="0" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowNewModal(false)} className="flex-1 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancel</button>
                <button onClick={() => void createJob()} disabled={saving || !newJob.name.trim()} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Creating...' : 'Create Automation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
