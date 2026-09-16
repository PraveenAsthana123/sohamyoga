'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Workflow {
  id: number;
  name: string;
  description: string;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  is_active: boolean;
  run_count: number;
  last_run_at: string | null;
  last_run_status: string | null;
  created_at: string;
  updated_at: string;
  step_count: string;
}

interface WorkflowStep {
  id: number;
  workflow_id: number;
  step_order: number;
  action_type: string;
  action_config: Record<string, unknown>;
  condition_field: string | null;
  condition_operator: string | null;
  condition_value: string | null;
  on_failure: string;
  created_at: string;
}

interface WorkflowRun {
  id: number;
  workflow_id: number;
  workflow_name: string;
  trigger_event: string;
  status: string;
  steps_total: number;
  steps_completed: number;
  steps_failed: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  step_runs?: StepRun[];
}

interface StepRun {
  id: number;
  step_order: number;
  action_type: string;
  status: string;
  output_data: Record<string, unknown>;
  error_message: string | null;
  duration_ms: number | null;
  started_at: string;
  completed_at: string | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TRIGGER_TYPES = [
  { value: 'schedule',         label: 'Schedule',               desc: 'Run at a set time/interval (cron)' },
  { value: 'new_order',        label: 'New Order Placed',        desc: 'Fires when a customer places an order' },
  { value: 'new_review',       label: 'New Review Received',     desc: 'Fires when a new review is submitted' },
  { value: 'new_follower',     label: 'New Follower',            desc: 'Fires when someone follows on a platform' },
  { value: 'content_published',label: 'Content Published',       desc: 'Fires when a post goes live' },
  { value: 'new_lead',         label: 'New Lead Captured',       desc: 'Fires when a lead form is submitted' },
  { value: 'campaign_launch',  label: 'Campaign Launched',       desc: 'Fires when a marketing campaign is activated' },
  { value: 'low_inventory',    label: 'Low Inventory',           desc: 'Fires when stock drops below threshold' },
  { value: 'manual',           label: 'Manual / On-Demand',      desc: 'Only runs when triggered manually' },
  { value: 'webhook',          label: 'Webhook',                 desc: 'Fires on an incoming webhook event' },
];

const ACTION_TYPES = [
  { value: 'post_to_platform',  label: 'Post to Platform',      icon: '📤' },
  { value: 'ai_adapt_content',  label: 'AI Adapt Content',      icon: '🤖' },
  { value: 'send_whatsapp',     label: 'Send WhatsApp',          icon: '💬' },
  { value: 'send_email',        label: 'Send Email',             icon: '📧' },
  { value: 'wait',              label: 'Wait / Delay',           icon: '⏳' },
  { value: 'condition',         label: 'Condition Branch',       icon: '🔀' },
  { value: 'webhook_call',      label: 'Webhook Call',           icon: '🔗' },
  { value: 'tag_customer',      label: 'Tag Customer',           icon: '🏷️' },
];

const ALL_PLATFORMS = [
  'twitter','linkedin','instagram','facebook','tiktok','pinterest','reddit','medium',
  'whatsapp','youtube','telegram','discord','mastodon','bluesky','threads',
  'snapchat','twitch','patreon','substack','tumblr','vimeo','google_business',
  'trustpilot','g2','capterra','github','dribbble','behance','producthunt',
  'yelp','tripadvisor','foursquare','etsy','amazon','shopify','woocommerce',
];

const STATUS_COLORS: Record<string, string> = {
  success: 'bg-green-100 text-green-800',
  failed:  'bg-red-100 text-red-800',
  partial: 'bg-yellow-100 text-yellow-800',
  running: 'bg-blue-100 text-blue-800',
  pending: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-gray-100 text-gray-600',
};

const TRIGGER_BADGE_COLORS: Record<string, string> = {
  schedule:          'bg-purple-100 text-purple-700',
  new_order:         'bg-green-100 text-green-700',
  new_review:        'bg-yellow-100 text-yellow-700',
  new_follower:      'bg-blue-100 text-blue-700',
  content_published: 'bg-indigo-100 text-indigo-700',
  new_lead:          'bg-pink-100 text-pink-700',
  campaign_launch:   'bg-orange-100 text-orange-700',
  low_inventory:     'bg-red-100 text-red-700',
  manual:            'bg-gray-100 text-gray-700',
  webhook:           'bg-cyan-100 text-cyan-700',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleString();
}

function fmtDuration(ms: number | null): string {
  if (!ms) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    success: 'bg-green-500',
    failed:  'bg-red-500',
    partial: 'bg-yellow-500',
    running: 'bg-blue-500',
    pending: 'bg-gray-400',
    skipped: 'bg-gray-300',
  };
  return (
    <span className={`inline-block w-2.5 h-2.5 rounded-full ${colors[status] ?? 'bg-gray-300'}`} title={status} />
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiBar({ workflows, runs }: { workflows: Workflow[]; runs: WorkflowRun[] }) {
  const total = workflows.length;
  const active = workflows.filter(w => w.is_active).length;
  const todayRuns = runs.filter(r => {
    const d = new Date(r.started_at);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;
  const successRuns = runs.filter(r => r.status === 'success').length;
  const successRate = runs.length > 0 ? Math.round((successRuns / runs.length) * 100) : 0;

  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      {[
        { label: 'Total Workflows', value: total, color: 'text-blue-600' },
        { label: 'Active', value: active, color: 'text-green-600' },
        { label: 'Runs Today', value: todayRuns, color: 'text-purple-600' },
        { label: 'Success Rate', value: `${successRate}%`, color: 'text-emerald-600' },
      ].map(kpi => (
        <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-4">
          <div className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</div>
          <div className="text-sm text-gray-500 mt-1">{kpi.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Step Form ────────────────────────────────────────────────────────────────

interface StepFormState {
  action_type: string;
  on_failure: string;
  // post_to_platform
  platform: string;
  content: string;
  // ai_adapt
  source_content: string;
  target_platforms: string[];
  job_type: string;
  // send_whatsapp
  wa_phone: string;
  wa_message: string;
  // send_email
  email_to: string;
  email_subject: string;
  email_body: string;
  // wait
  delay_amount: number;
  delay_unit: string;
  // condition
  cond_field: string;
  cond_operator: string;
  cond_value: string;
  // webhook
  wh_url: string;
  wh_method: string;
  // tag
  tag_name: string;
}

function buildActionConfig(s: StepFormState): Record<string, unknown> {
  switch (s.action_type) {
    case 'post_to_platform': return { platform: s.platform, content: s.content };
    case 'ai_adapt_content': return { source_platform: s.platform, target_platforms: s.target_platforms, job_type: s.job_type };
    case 'send_whatsapp': return { phone: s.wa_phone, message: s.wa_message };
    case 'send_email': return { to: s.email_to, subject: s.email_subject, body: s.email_body };
    case 'wait': {
      const mult = s.delay_unit === 'minutes' ? 60 : s.delay_unit === 'hours' ? 3600 : 1;
      return { delay_seconds: s.delay_amount * mult };
    }
    case 'condition': return { on_true_step: 'next', on_false_step: 'next' };
    case 'webhook_call': return { url: s.wh_url, method: s.wh_method, body: {} };
    case 'tag_customer': return { tag: s.tag_name };
    default: return {};
  }
}

function StepFormFields({ state, setState }: { state: StepFormState; setState: (s: StepFormState) => void }) {
  const set = (field: keyof StepFormState, value: unknown) => setState({ ...state, [field]: value });

  switch (state.action_type) {
    case 'post_to_platform':
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Platform</label>
            <select className="w-full border border-gray-300 rounded-lg p-2 text-sm" value={state.platform} onChange={e => set('platform', e.target.value)}>
              <option value="">Select platform</option>
              {ALL_PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Content</label>
            <textarea className="w-full border border-gray-300 rounded-lg p-2 text-sm h-24" value={state.content} onChange={e => set('content', e.target.value)} placeholder="Post content or {{template.variable}}" />
          </div>
        </div>
      );

    case 'ai_adapt_content':
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Source Platform</label>
            <select className="w-full border border-gray-300 rounded-lg p-2 text-sm" value={state.platform} onChange={e => set('platform', e.target.value)}>
              <option value="">Select source platform</option>
              {ALL_PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Source Content</label>
            <textarea className="w-full border border-gray-300 rounded-lg p-2 text-sm h-20" value={state.source_content} onChange={e => set('source_content', e.target.value)} placeholder="Content to adapt..." />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Target Platforms</label>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2">
              {ALL_PLATFORMS.map(p => (
                <label key={p} className="flex items-center gap-1 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={state.target_platforms.includes(p)}
                    onChange={e => {
                      const updated = e.target.checked
                        ? [...state.target_platforms, p]
                        : state.target_platforms.filter(x => x !== p);
                      set('target_platforms', updated);
                    }}
                  />
                  {p}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Job Type</label>
            <select className="w-full border border-gray-300 rounded-lg p-2 text-sm" value={state.job_type} onChange={e => set('job_type', e.target.value)}>
              <option value="adapt">Adapt</option>
              <option value="repurpose">Repurpose</option>
              <option value="hashtag">Generate Hashtags</option>
              <option value="caption">Generate Caption</option>
              <option value="best_time">Find Best Time</option>
            </select>
          </div>
        </div>
      );

    case 'send_whatsapp':
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Phone / Template Variable</label>
            <input className="w-full border border-gray-300 rounded-lg p-2 text-sm" value={state.wa_phone} onChange={e => set('wa_phone', e.target.value)} placeholder="e.g. {{customer.phone}}" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Message</label>
            <textarea className="w-full border border-gray-300 rounded-lg p-2 text-sm h-20" value={state.wa_message} onChange={e => set('wa_message', e.target.value)} placeholder="WhatsApp message text..." />
          </div>
        </div>
      );

    case 'send_email':
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
            <input className="w-full border border-gray-300 rounded-lg p-2 text-sm" value={state.email_to} onChange={e => set('email_to', e.target.value)} placeholder="e.g. {{lead.email}}" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Subject</label>
            <input className="w-full border border-gray-300 rounded-lg p-2 text-sm" value={state.email_subject} onChange={e => set('email_subject', e.target.value)} placeholder="Email subject" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Body</label>
            <textarea className="w-full border border-gray-300 rounded-lg p-2 text-sm h-20" value={state.email_body} onChange={e => set('email_body', e.target.value)} placeholder="Email body..." />
          </div>
        </div>
      );

    case 'wait':
      return (
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">Amount</label>
            <input type="number" min={1} className="w-full border border-gray-300 rounded-lg p-2 text-sm" value={state.delay_amount} onChange={e => set('delay_amount', parseInt(e.target.value, 10))} />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">Unit</label>
            <select className="w-full border border-gray-300 rounded-lg p-2 text-sm" value={state.delay_unit} onChange={e => set('delay_unit', e.target.value)}>
              <option value="seconds">Seconds</option>
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
            </select>
          </div>
        </div>
      );

    case 'condition':
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Field (e.g. review.rating)</label>
            <input className="w-full border border-gray-300 rounded-lg p-2 text-sm" value={state.cond_field} onChange={e => set('cond_field', e.target.value)} placeholder="review.rating" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Operator</label>
            <select className="w-full border border-gray-300 rounded-lg p-2 text-sm" value={state.cond_operator} onChange={e => set('cond_operator', e.target.value)}>
              <option value="equals">equals</option>
              <option value="not_equals">not equals</option>
              <option value="contains">contains</option>
              <option value="gt">greater than</option>
              <option value="gte">greater than or equal</option>
              <option value="lt">less than</option>
              <option value="lte">less than or equal</option>
              <option value="in">in (comma list)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Value</label>
            <input className="w-full border border-gray-300 rounded-lg p-2 text-sm" value={state.cond_value} onChange={e => set('cond_value', e.target.value)} placeholder="4" />
          </div>
        </div>
      );

    case 'webhook_call':
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">URL</label>
            <input className="w-full border border-gray-300 rounded-lg p-2 text-sm" value={state.wh_url} onChange={e => set('wh_url', e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Method</label>
            <select className="w-full border border-gray-300 rounded-lg p-2 text-sm" value={state.wh_method} onChange={e => set('wh_method', e.target.value)}>
              <option value="POST">POST</option>
              <option value="GET">GET</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
            </select>
          </div>
        </div>
      );

    case 'tag_customer':
      return (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Tag Name</label>
          <input className="w-full border border-gray-300 rounded-lg p-2 text-sm" value={state.tag_name} onChange={e => set('tag_name', e.target.value)} placeholder="e.g. new_lead, vip_customer" />
        </div>
      );

    default:
      return null;
  }
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type TabId = 'workflows' | 'step-builder' | 'run-history' | 'ai-lab' | 'library' | 'settings';

const TABS: { id: TabId; label: string }[] = [
  { id: 'workflows',    label: '⚡ Workflows' },
  { id: 'step-builder', label: '🔧 Step Builder' },
  { id: 'run-history',  label: '📋 Run History' },
  { id: 'ai-lab',       label: '🤖 AI Content Lab' },
  { id: 'library',      label: '📚 Automation Library' },
  { id: 'settings',     label: '⚙️ Settings' },
];

export default function PlatformWorkflowsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('workflows');
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Create workflow form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newWfName, setNewWfName] = useState('');
  const [newWfDesc, setNewWfDesc] = useState('');
  const [newWfTrigger, setNewWfTrigger] = useState('manual');
  const [newWfCron, setNewWfCron] = useState('0 9 * * *');

  // Step builder
  const [showStepForm, setShowStepForm] = useState(false);
  const [stepForm, setStepForm] = useState<StepFormState>({
    action_type: 'post_to_platform',
    on_failure: 'continue',
    platform: '', content: '', source_content: '', target_platforms: [], job_type: 'adapt',
    wa_phone: '', wa_message: '', email_to: '', email_subject: '', email_body: '',
    delay_amount: 5, delay_unit: 'minutes', cond_field: '', cond_operator: 'equals', cond_value: '',
    wh_url: '', wh_method: 'POST', tag_name: '',
  });

  // AI Lab
  const [aiSource, setAiSource] = useState('');
  const [aiSourcePlatform, setAiSourcePlatform] = useState('instagram');
  const [aiTargets, setAiTargets] = useState<string[]>(['twitter', 'linkedin', 'facebook']);
  const [aiJobType, setAiJobType] = useState('adapt');
  const [aiResults, setAiResults] = useState<Record<string, string>>({});
  const [aiLoading, setAiLoading] = useState(false);
  const [expandedRun, setExpandedRun] = useState<number | null>(null);

  // Settings
  const [settingsAiModel, setSettingsAiModel] = useState('llama3.2');

  const flash = (msg: string) => { setMessage(msg); setTimeout(() => setMessage(''), 3000); };

  const loadWorkflows = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/platform-workflows');
      const d = await r.json() as { workflows: Workflow[] };
      setWorkflows(d.workflows ?? []);
    } catch { /* ignore */ }
  }, []);

  const loadRuns = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/platform-workflows/runs');
      const d = await r.json() as { runs: WorkflowRun[] };
      setRuns(d.runs ?? []);
    } catch { /* ignore */ }
  }, []);

  const loadSteps = useCallback(async (workflowId: number) => {
    try {
      const r = await fetch(`/api/admin/platform-workflows/${workflowId}/steps`);
      const d = await r.json() as { steps: WorkflowStep[] };
      setSteps(d.steps ?? []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadWorkflows();
    loadRuns();
  }, [loadWorkflows, loadRuns]);

  async function handleSeedDatabase() {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/platform-workflows/seed');
      const d = await r.json() as { message: string; workflows_created: number };
      flash(`${d.message} (${d.workflows_created} new workflows)`);
      await loadWorkflows();
    } catch { flash('Seed failed'); }
    setLoading(false);
  }

  async function handleCreateWorkflow() {
    if (!newWfName.trim()) { flash('Name is required'); return; }
    try {
      const triggerConfig = newWfTrigger === 'schedule' ? { cron: newWfCron } : {};
      const r = await fetch('/api/admin/platform-workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newWfName, description: newWfDesc, trigger_type: newWfTrigger, trigger_config: triggerConfig }),
      });
      const d = await r.json() as { workflow: { id: number } };
      flash('Workflow created');
      setShowCreateForm(false);
      setNewWfName(''); setNewWfDesc(''); setNewWfTrigger('manual'); setNewWfCron('0 9 * * *');
      await loadWorkflows();
      const newWf = { id: d.workflow.id } as Workflow;
      setSelectedWorkflow(newWf);
      setActiveTab('step-builder');
    } catch { flash('Create failed'); }
  }

  async function handleToggleActive(wf: Workflow) {
    try {
      await fetch(`/api/admin/platform-workflows/${wf.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !wf.is_active }),
      });
      await loadWorkflows();
    } catch { flash('Toggle failed'); }
  }

  async function handleDeleteWorkflow(id: number) {
    if (!confirm('Delete this workflow and all its steps?')) return;
    try {
      await fetch(`/api/admin/platform-workflows/${id}`, { method: 'DELETE' });
      flash('Deleted');
      if (selectedWorkflow?.id === id) setSelectedWorkflow(null);
      await loadWorkflows();
    } catch { flash('Delete failed'); }
  }

  async function handleRunNow(id: number) {
    flash('Running workflow…');
    try {
      const r = await fetch(`/api/admin/platform-workflows/${id}/run`, { method: 'POST' });
      const d = await r.json() as { status: string; steps_completed: number; steps_total: number };
      flash(`Run complete: ${d.status} (${d.steps_completed}/${d.steps_total} steps)`);
      await loadWorkflows();
      await loadRuns();
    } catch { flash('Run failed'); }
  }

  async function handleAddStep() {
    if (!selectedWorkflow) return;
    const actionConfig = buildActionConfig(stepForm);
    try {
      await fetch(`/api/admin/platform-workflows/${selectedWorkflow.id}/steps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step_order: steps.length + 1,
          action_type: stepForm.action_type,
          action_config: actionConfig,
          condition_field: stepForm.action_type === 'condition' ? stepForm.cond_field : null,
          condition_operator: stepForm.action_type === 'condition' ? stepForm.cond_operator : null,
          condition_value: stepForm.action_type === 'condition' ? stepForm.cond_value : null,
          on_failure: stepForm.on_failure,
        }),
      });
      flash('Step added');
      setShowStepForm(false);
      await loadSteps(selectedWorkflow.id);
    } catch { flash('Add step failed'); }
  }

  async function handleDeleteStep(stepId: number) {
    if (!selectedWorkflow) return;
    try {
      await fetch(`/api/admin/platform-workflows/${selectedWorkflow.id}/steps/${stepId}`, { method: 'DELETE' });
      await loadSteps(selectedWorkflow.id);
    } catch { flash('Delete step failed'); }
  }

  async function handleRunAILab() {
    if (!aiSource.trim() || aiTargets.length === 0) { flash('Provide source content and select at least one target platform'); return; }
    setAiLoading(true);
    setAiResults({});
    try {
      const r = await fetch('/api/admin/platform-workflows/ai-adapt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_content: aiSource, source_platform: aiSourcePlatform, target_platforms: aiTargets, job_type: aiJobType }),
      });
      const d = await r.json() as { adapted: Record<string, string> };
      setAiResults(d.adapted ?? {});
    } catch { flash('AI adaptation failed'); }
    setAiLoading(false);
  }

  function selectWorkflowForEdit(wf: Workflow) {
    setSelectedWorkflow(wf);
    loadSteps(wf.id);
    setActiveTab('step-builder');
  }

  const actionIcon = (type: string) => ACTION_TYPES.find(a => a.value === type)?.icon ?? '⚙️';
  const actionLabel = (type: string) => ACTION_TYPES.find(a => a.value === type)?.label ?? type;

  // ── RENDER ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">⚡ Platform Workflow & AI Automation Engine</h1>
            <p className="text-gray-500 text-sm mt-1">Build, run, and monitor automated workflows across all platforms</p>
          </div>
          <button
            onClick={handleSeedDatabase}
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Seeding…' : '🌱 Seed Database'}
          </button>
        </div>

        {/* Flash message */}
        {message && (
          <div className="mb-4 px-4 py-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg text-sm">{message}</div>
        )}

        {/* KPI Bar */}
        <KpiBar workflows={workflows} runs={runs} />

        {/* Tab Nav */}
        <div className="flex gap-1 mb-6 bg-white border border-gray-200 rounded-xl p-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 px-3 py-2 text-sm rounded-lg transition-colors ${activeTab === t.id ? 'bg-indigo-600 text-white font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Tab: Workflows ── */}
        {activeTab === 'workflows' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-800">All Workflows</h2>
              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
              >
                + Create Workflow
              </button>
            </div>

            {/* Create form */}
            {showCreateForm && (
              <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 shadow-sm">
                <h3 className="font-semibold text-gray-800 mb-4">New Workflow</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
                    <input className="w-full border border-gray-300 rounded-lg p-2 text-sm" value={newWfName} onChange={e => setNewWfName(e.target.value)} placeholder="Workflow name" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Trigger Type</label>
                    <select className="w-full border border-gray-300 rounded-lg p-2 text-sm" value={newWfTrigger} onChange={e => setNewWfTrigger(e.target.value)}>
                      {TRIGGER_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                    <textarea className="w-full border border-gray-300 rounded-lg p-2 text-sm h-16" value={newWfDesc} onChange={e => setNewWfDesc(e.target.value)} placeholder="What does this workflow do?" />
                  </div>
                  {newWfTrigger === 'schedule' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Cron Expression</label>
                      <input className="w-full border border-gray-300 rounded-lg p-2 text-sm font-mono" value={newWfCron} onChange={e => setNewWfCron(e.target.value)} placeholder="0 9 * * *" />
                      <p className="text-xs text-gray-400 mt-1">e.g. "0 9 * * *" = daily at 9am UTC</p>
                    </div>
                  )}
                  <div className="col-span-2">
                    {TRIGGER_TYPES.find(t => t.value === newWfTrigger) && (
                      <p className="text-xs text-gray-500 bg-gray-50 rounded p-2">
                        {TRIGGER_TYPES.find(t => t.value === newWfTrigger)!.desc}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-3 mt-4">
                  <button onClick={handleCreateWorkflow} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">Save Workflow</button>
                  <button onClick={() => setShowCreateForm(false)} className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300">Cancel</button>
                </div>
              </div>
            )}

            {/* Workflow cards */}
            <div className="space-y-3">
              {workflows.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  No workflows yet. Click &quot;Seed Database&quot; to get started with 8 example workflows.
                </div>
              )}
              {workflows.map(wf => (
                <div key={wf.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-semibold text-gray-900 truncate">{wf.name}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TRIGGER_BADGE_COLORS[wf.trigger_type] ?? 'bg-gray-100 text-gray-700'}`}>
                          {wf.trigger_type.replace(/_/g, ' ')}
                        </span>
                        {wf.last_run_status && (
                          <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[wf.last_run_status] ?? 'bg-gray-100'}`}>
                            {wf.last_run_status}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate">{wf.description || 'No description'}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                        <span>{wf.step_count} steps</span>
                        <span>{wf.run_count} runs</span>
                        {wf.last_run_at && <span>Last: {fmtDate(wf.last_run_at)}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                      {/* Active toggle */}
                      <button
                        onClick={() => handleToggleActive(wf)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${wf.is_active ? 'bg-green-500' : 'bg-gray-300'}`}
                        title={wf.is_active ? 'Deactivate' : 'Activate'}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${wf.is_active ? 'translate-x-4' : 'translate-x-1'}`} />
                      </button>
                      <button
                        onClick={() => handleRunNow(wf.id)}
                        className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700"
                      >
                        ▶ Run Now
                      </button>
                      <button
                        onClick={() => selectWorkflowForEdit(wf)}
                        className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs rounded-lg hover:bg-gray-200"
                      >
                        Edit Steps
                      </button>
                      <button
                        onClick={() => handleDeleteWorkflow(wf.id)}
                        className="px-3 py-1.5 bg-red-100 text-red-700 text-xs rounded-lg hover:bg-red-200"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Tab: Step Builder ── */}
        {activeTab === 'step-builder' && (
          <div>
            {!selectedWorkflow ? (
              <div className="text-center py-16 text-gray-400">
                Select a workflow from the Workflows tab to edit its steps.
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-800">
                      Step Builder: {workflows.find(w => w.id === selectedWorkflow.id)?.name ?? 'Workflow'}
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">{steps.length} step{steps.length !== 1 ? 's' : ''}</p>
                  </div>
                  <button
                    onClick={() => { setShowStepForm(!showStepForm); }}
                    className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
                  >
                    + Add Step
                  </button>
                </div>

                {/* Add step form */}
                {showStepForm && (
                  <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5 shadow-sm">
                    <h3 className="font-semibold text-gray-800 mb-4">New Step</h3>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Action Type</label>
                        <select
                          className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                          value={stepForm.action_type}
                          onChange={e => setStepForm({ ...stepForm, action_type: e.target.value })}
                        >
                          {ACTION_TYPES.map(a => (
                            <option key={a.value} value={a.value}>{a.icon} {a.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">On Failure</label>
                        <select
                          className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                          value={stepForm.on_failure}
                          onChange={e => setStepForm({ ...stepForm, on_failure: e.target.value })}
                        >
                          <option value="continue">Continue</option>
                          <option value="stop">Stop</option>
                          <option value="retry">Retry</option>
                        </select>
                      </div>
                    </div>
                    <StepFormFields state={stepForm} setState={setStepForm} />
                    <div className="flex gap-3 mt-4">
                      <button onClick={handleAddStep} className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">Add Step</button>
                      <button onClick={() => setShowStepForm(false)} className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300">Cancel</button>
                    </div>
                  </div>
                )}

                {/* Step timeline */}
                <div className="relative">
                  {steps.length === 0 && (
                    <div className="text-center py-12 text-gray-400 bg-white border border-dashed border-gray-300 rounded-xl">
                      No steps yet. Click &quot;Add Step&quot; to build your workflow.
                    </div>
                  )}
                  {steps.map((step, idx) => (
                    <div key={step.id} className="flex gap-4 mb-3">
                      {/* Timeline line */}
                      <div className="flex flex-col items-center">
                        <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                          {idx + 1}
                        </div>
                        {idx < steps.length - 1 && <div className="w-0.5 flex-1 bg-indigo-100 mt-1" />}
                      </div>
                      {/* Step card */}
                      <div className="flex-1 bg-white border border-gray-200 rounded-xl p-4 mb-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{actionIcon(step.action_type)}</span>
                              <span className="font-medium text-gray-800 text-sm">{actionLabel(step.action_type)}</span>
                              <span className={`px-2 py-0.5 text-xs rounded-full ${step.on_failure === 'stop' ? 'bg-red-100 text-red-700' : step.on_failure === 'retry' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                                on fail: {step.on_failure}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              {JSON.stringify(step.action_config).slice(0, 120)}
                            </p>
                            {step.condition_field && (
                              <p className="text-xs text-purple-600 mt-1">
                                IF {step.condition_field} {step.condition_operator} {step.condition_value}
                              </p>
                            )}
                          </div>
                          <button onClick={() => handleDeleteStep(step.id)} className="text-red-400 hover:text-red-600 text-xs ml-3">Remove</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {steps.length > 0 && (
                  <div className="mt-4 flex gap-3">
                    <button onClick={() => handleRunNow(selectedWorkflow.id)} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">▶ Run Workflow Now</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Run History ── */}
        {activeTab === 'run-history' && (
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Run History</h2>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Workflow', 'Trigger', 'Status', 'Steps', 'Duration', 'Started At', 'Error'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {runs.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-8 text-gray-400">No runs yet. Run a workflow to see history here.</td></tr>
                  )}
                  {runs.map(run => (
                    <>
                      <tr
                        key={run.id}
                        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                        onClick={() => setExpandedRun(expandedRun === run.id ? null : run.id)}
                      >
                        <td className="px-4 py-3 font-medium">{run.workflow_name}</td>
                        <td className="px-4 py-3 text-gray-500">{run.trigger_event}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[run.status] ?? 'bg-gray-100'}`}>
                            {run.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {run.steps_completed}/{run.steps_total}
                          {run.steps_failed > 0 && <span className="text-red-500 ml-1">({run.steps_failed} failed)</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-500">{fmtDuration(run.duration_ms)}</td>
                        <td className="px-4 py-3 text-gray-500">{fmtDate(run.started_at)}</td>
                        <td className="px-4 py-3 text-red-500 text-xs max-w-xs truncate">{run.error_message ?? '—'}</td>
                      </tr>
                      {expandedRun === run.id && run.step_runs && (
                        <tr key={`${run.id}-steps`}>
                          <td colSpan={7} className="bg-gray-50 px-6 py-3">
                            <div className="space-y-1">
                              {run.step_runs.map(sr => (
                                <div key={sr.id} className="flex items-center gap-3 text-xs">
                                  <StatusDot status={sr.status} />
                                  <span className="text-gray-500 w-6 text-right">{sr.step_order}.</span>
                                  <span className="font-medium text-gray-700">{actionLabel(sr.action_type)}</span>
                                  <span className={`px-1.5 py-0.5 rounded text-xs ${STATUS_COLORS[sr.status] ?? 'bg-gray-100'}`}>{sr.status}</span>
                                  <span className="text-gray-400">{fmtDuration(sr.duration_ms)}</span>
                                  {sr.error_message && <span className="text-red-500 truncate max-w-xs">{sr.error_message}</span>}
                                </div>
                              ))}
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
        )}

        {/* ── Tab: AI Content Lab ── */}
        {activeTab === 'ai-lab' && (
          <div className="grid grid-cols-2 gap-6">
            {/* Input panel */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">🤖 AI Content Lab</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Source Content</label>
                  <textarea
                    className="w-full border border-gray-300 rounded-lg p-3 text-sm h-28 resize-none"
                    value={aiSource}
                    onChange={e => setAiSource(e.target.value)}
                    placeholder="Paste your original content here…"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Source Platform</label>
                    <select className="w-full border border-gray-300 rounded-lg p-2 text-sm" value={aiSourcePlatform} onChange={e => setAiSourcePlatform(e.target.value)}>
                      {ALL_PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Job Type</label>
                    <select className="w-full border border-gray-300 rounded-lg p-2 text-sm" value={aiJobType} onChange={e => setAiJobType(e.target.value)}>
                      <option value="adapt">Adapt</option>
                      <option value="repurpose">Repurpose</option>
                      <option value="hashtag">Generate Hashtags</option>
                      <option value="caption">Generate Caption</option>
                      <option value="best_time">Find Best Time</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Target Platforms</label>
                  <div className="flex flex-wrap gap-2 border border-gray-200 rounded-lg p-3 max-h-40 overflow-y-auto">
                    {ALL_PLATFORMS.map(p => (
                      <label key={p} className="flex items-center gap-1 text-xs cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={aiTargets.includes(p)}
                          onChange={e => {
                            setAiTargets(e.target.checked ? [...aiTargets, p] : aiTargets.filter(x => x !== p));
                          }}
                        />
                        {p}
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{aiTargets.length} platform(s) selected</p>
                </div>
                <button
                  onClick={handleRunAILab}
                  disabled={aiLoading}
                  className="w-full py-2.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
                >
                  {aiLoading ? '⏳ Adapting with Ollama llama3.2…' : '🚀 Run AI Adaptation'}
                </button>
              </div>
            </div>

            {/* Results panel */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Results</h3>
              {Object.keys(aiResults).length === 0 && (
                <div className="text-center py-16 text-gray-400">
                  Results will appear here after running AI adaptation.
                </div>
              )}
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {Object.entries(aiResults).map(([platform, content]) => (
                  <div key={platform} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm text-gray-800 capitalize">{platform}</span>
                      <span className="text-xs text-gray-400">{content.length} chars</span>
                    </div>
                    <p className="text-xs text-gray-700 whitespace-pre-wrap">{content}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: Automation Library ── */}
        {activeTab === 'library' && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-800">📚 Automation Library</h2>
              <button onClick={handleSeedDatabase} disabled={loading} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {loading ? 'Installing…' : '🌱 Install All Templates'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                {
                  name: 'New Order → WhatsApp Notification',
                  trigger: 'new_order',
                  desc: 'Fires when a customer places an order. Sends WhatsApp notification to customer + posts an Instagram story.',
                  steps: ['Send WhatsApp', 'Post to Instagram'],
                  color: 'border-green-200 bg-green-50',
                },
                {
                  name: 'Daily Content Recycler',
                  trigger: 'schedule',
                  desc: 'Every day at 9am, picks top post from last 30 days, AI-adapts for 5 platforms, posts all.',
                  steps: ['AI Adapt', 'Post Twitter', 'Post LinkedIn', 'Post Facebook', 'Wait 5min', 'Post Pinterest'],
                  color: 'border-purple-200 bg-purple-50',
                },
                {
                  name: 'Review Response Bot',
                  trigger: 'new_review',
                  desc: 'Evaluates review rating. Positive (≥4) → posts thank-you. Negative (≤2) → flags for follow-up.',
                  steps: ['Condition (rating ≥ 4)', 'Post Thank You', 'Tag Customer'],
                  color: 'border-yellow-200 bg-yellow-50',
                },
                {
                  name: 'Campaign Launch Blast',
                  trigger: 'campaign_launch',
                  desc: 'Posts to all major platforms in sequence with 5-minute delays between each.',
                  steps: ['Post Instagram', 'Wait 5min', 'Post Facebook', 'Wait 5min', 'Post Twitter', 'Wait 5min', 'Post LinkedIn'],
                  color: 'border-orange-200 bg-orange-50',
                },
                {
                  name: 'New Follower Welcome',
                  trigger: 'new_follower',
                  desc: 'Sends a personalized WhatsApp DM and tags the new follower for nurture campaigns.',
                  steps: ['Send WhatsApp', 'Tag Customer'],
                  color: 'border-blue-200 bg-blue-50',
                },
                {
                  name: 'Weekly Analytics Report',
                  trigger: 'schedule',
                  desc: 'Every Monday at 8am, AI summarizes analytics data and emails the report to admin.',
                  steps: ['AI Summarize', 'Send Email'],
                  color: 'border-indigo-200 bg-indigo-50',
                },
                {
                  name: 'Low Inventory Alert',
                  trigger: 'low_inventory',
                  desc: 'When inventory drops below threshold: pauses ad campaigns and sends WhatsApp alert to manager.',
                  steps: ['Webhook (pause ads)', 'Send WhatsApp'],
                  color: 'border-red-200 bg-red-50',
                },
                {
                  name: 'Lead Capture → Nurture',
                  trigger: 'new_lead',
                  desc: 'On new lead: sends welcome email, waits 1 minute, sends WhatsApp, tags lead for nurture sequence.',
                  steps: ['Send Email', 'Wait 1min', 'Send WhatsApp', 'Tag Customer'],
                  color: 'border-pink-200 bg-pink-50',
                },
              ].map(tmpl => (
                <div key={tmpl.name} className={`border-2 rounded-xl p-4 ${tmpl.color}`}>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-gray-800 text-sm">{tmpl.name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ml-2 ${TRIGGER_BADGE_COLORS[tmpl.trigger] ?? 'bg-gray-100'}`}>
                      {tmpl.trigger.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mb-3">{tmpl.desc}</p>
                  <div className="flex flex-wrap gap-1">
                    {tmpl.steps.map((s, i) => (
                      <span key={i} className="px-2 py-0.5 bg-white border border-gray-200 rounded text-xs text-gray-600">{s}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Tab: Settings ── */}
        {activeTab === 'settings' && (
          <div className="max-w-lg">
            <h2 className="text-lg font-semibold text-gray-800 mb-5">⚙️ Workflow Engine Settings</h2>
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">AI Model</label>
                <select
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                  value={settingsAiModel}
                  onChange={e => setSettingsAiModel(e.target.value)}
                >
                  <option value="llama3.2">llama3.2 (default)</option>
                  <option value="llama3.1">llama3.1</option>
                  <option value="mistral">mistral</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">Local Ollama model used for AI content adaptation</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Concurrent Runs</label>
                <input type="number" min={1} max={20} defaultValue={5} className="w-full border border-gray-300 rounded-lg p-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Default Retry Attempts</label>
                <input type="number" min={0} max={5} defaultValue={3} className="w-full border border-gray-300 rounded-lg p-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">Failure Notifications</label>
                <label className="flex items-center gap-2 text-sm text-gray-700 mb-2 cursor-pointer">
                  <input type="checkbox" defaultChecked className="rounded" />
                  Email on workflow failure
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" className="rounded" />
                  WhatsApp on workflow failure
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Import / Export</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      const json = JSON.stringify(workflows, null, 2);
                      const blob = new Blob([json], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'platform-workflows.json';
                      a.click();
                    }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200"
                  >
                    Export Workflows JSON
                  </button>
                </div>
              </div>
              <button
                onClick={() => flash('Settings saved (model: ' + settingsAiModel + ')')}
                className="w-full py-2.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 font-medium"
              >
                Save Settings
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
