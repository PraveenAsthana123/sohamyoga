'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = 'Dashboard' | 'Projects' | 'Clients' | 'AI Writing Studio' | 'Revisions' | 'Revenue';
const TABS: Tab[] = ['Dashboard', 'Projects', 'Clients', 'AI Writing Studio', 'Revisions', 'Revenue'];

const PROJECT_TYPES = [
  { value: 'blog_post', label: 'Blog Post' },
  { value: 'article', label: 'Article' },
  { value: 'website_copy', label: 'Website Copy' },
  { value: 'landing_page', label: 'Landing Page' },
  { value: 'product_desc', label: 'Product Description' },
  { value: 'ad_copy', label: 'Ad Copy' },
  { value: 'email_campaign', label: 'Email Campaign' },
  { value: 'technical_doc', label: 'Technical Doc' },
  { value: 'whitepaper', label: 'White Paper' },
  { value: 'case_study', label: 'Case Study' },
  { value: 'press_release', label: 'Press Release' },
  { value: 'social_posts', label: 'Social Posts' },
  { value: 'seo_content', label: 'SEO Content' },
  { value: 'ghostwriting', label: 'Ghostwriting' },
  { value: 'translation', label: 'Translation' },
  { value: 'editing', label: 'Editing' },
  { value: 'other', label: 'Other' },
];
const STATUS_PIPELINE = ['briefing', 'research', 'drafting', 'review', 'revision', 'approved', 'delivered', 'invoiced', 'paid'];
const TONES = ['professional', 'casual', 'technical', 'creative', 'persuasive'];
const RATE_TYPES = ['per_word', 'per_hour', 'flat_fee', 'per_page'];
const PRIORITIES = ['urgent', 'high', 'normal', 'low'];
const STYLE_GUIDES = ['AP', 'Chicago', 'APA', 'custom', 'none'];

interface WritingClient {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  industry?: string;
  preferred_tone: string;
  preferred_style_guide?: string;
  brand_voice_notes?: string;
  target_audience?: string;
  status: string;
  hourly_rate?: number;
  source?: string;
  notes?: string;
  active_projects?: number;
  total_earned?: number;
  created_at: string;
}

interface WritingProject {
  id: number;
  client_id?: number;
  client_name?: string;
  client_company?: string;
  title: string;
  project_type: string;
  description?: string;
  word_count_target?: number;
  word_count_delivered: number;
  keywords?: string[];
  deadline?: string;
  status: string;
  priority: string;
  rate_type: string;
  rate?: number;
  estimated_fee?: number;
  actual_fee?: number;
  draft_due?: string;
  final_due?: string;
  revisions_allowed: number;
  revisions_used: number;
  delivered_at?: string;
  paid_at?: string;
  brief_notes?: string;
  platform?: string;
  assigned_writer: string;
  created_at: string;
}

interface WritingRevision {
  id: number;
  project_id: number;
  revision_number: number;
  feedback?: string;
  changes_requested?: string;
  completed_at?: string;
  created_at: string;
}

interface DashboardStats {
  active_projects: number;
  drafting: number;
  overdue: number;
  delivered_this_month: number;
  revenue_this_month: number;
  words_this_month: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function api(sub: string, params: Record<string, string> = {}) {
  const sp = new URLSearchParams({ sub, ...params });
  return `/api/admin/writer-portal?${sp}`;
}

function ptLabel(type: string) {
  return PROJECT_TYPES.find(t => t.value === type)?.label ?? type;
}

function priorityColor(p: string) {
  return p === 'urgent' ? 'bg-red-100 text-red-700' :
    p === 'high' ? 'bg-orange-100 text-orange-700' :
    p === 'low' ? 'bg-gray-100 text-gray-500' : 'bg-blue-100 text-blue-700';
}

function statusColor(s: string) {
  return s === 'delivered' || s === 'paid' ? 'bg-green-100 text-green-700' :
    s === 'review' || s === 'revision' ? 'bg-yellow-100 text-yellow-700' :
    s === 'drafting' ? 'bg-blue-100 text-blue-700' :
    s === 'approved' ? 'bg-purple-100 text-purple-700' :
    'bg-gray-100 text-gray-600';
}

function fmtCurrency(n?: number | null) {
  if (!n) return '$0.00';
  return `$${Number(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtNum(n?: number | null) {
  return Number(n ?? 0).toLocaleString();
}

function overdue(p: WritingProject) {
  return p.deadline && new Date(p.deadline) < new Date() && !['delivered','invoiced','paid'].includes(p.status);
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function WriterPortalPage() {
  const [tab, setTab] = useState<Tab>('Dashboard');
  const [clients, setClients] = useState<WritingClient[]>([]);
  const [projects, setProjects] = useState<WritingProject[]>([]);
  const [revisions, setRevisions] = useState<WritingRevision[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [upcoming, setUpcoming] = useState<WritingProject[]>([]);
  const [recent, setRecent] = useState<WritingProject[]>([]);
  const [monthly, setMonthly] = useState<{ month: string; revenue: number; projects_paid: number }[]>([]);
  const [byType, setByType] = useState<{ project_type: string; cnt: number; earned: number; avg_rate: number }[]>([]);
  const [outstanding, setOutstanding] = useState<WritingProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  // filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterOverdue, setFilterOverdue] = useState(false);
  const [revisionProjectId, setRevisionProjectId] = useState('');

  // modals
  const [showNewProject, setShowNewProject] = useState(false);
  const [showNewClient, setShowNewClient] = useState(false);
  const [showRevModal, setShowRevModal] = useState(false);
  const [showDeliverModal, setShowDeliverModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<WritingProject | null>(null);

  // AI Studio
  const [aiSubTab, setAiSubTab] = useState<'draft' | 'outline' | 'headline' | 'research'>('draft');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState('');
  const [aiForm, setAiForm] = useState({
    project_type: 'blog_post', title: '', keywords: '', tone: 'professional',
    word_count: 500, brief: '', target_audience: '', topic: '', count: 5,
  });

  // New project form
  const [pForm, setPForm] = useState({
    client_id: '', title: '', project_type: 'blog_post', description: '',
    word_count_target: '', keywords: '', deadline: '', priority: 'normal',
    rate_type: 'per_word', rate: '', estimated_fee: '', draft_due: '', final_due: '',
    revisions_allowed: '2', brief_notes: '', platform: '', assigned_writer: 'self',
  });

  // New client form
  const [cForm, setCForm] = useState({
    name: '', email: '', phone: '', company: '', industry: '',
    preferred_tone: 'professional', preferred_style_guide: '', brand_voice_notes: '',
    target_audience: '', status: 'active', hourly_rate: '', source: '', notes: '',
  });

  // Revision form
  const [revForm, setRevForm] = useState({ feedback: '', changes_requested: '' });

  // Deliver form
  const [deliverForm, setDeliverForm] = useState({ word_count_delivered: '', actual_fee: '' });

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 4000); };

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(api(''));
      const d = await res.json();
      setStats(d.stats);
      setUpcoming(d.upcoming ?? []);
      setRecent(d.recent ?? []);
    } catch { setError('Failed to load dashboard.'); }
    setLoading(false);
  }, []);

  const loadClients = useCallback(async () => {
    const res = await fetch(api('clients'));
    const d = await res.json();
    setClients(d.clients ?? []);
  }, []);

  const loadProjects = useCallback(async () => {
    const params: Record<string, string> = {};
    if (filterStatus) params.status = filterStatus;
    if (filterType) params.project_type = filterType;
    if (filterOverdue) params.overdue = 'true';
    const res = await fetch(api('projects', params));
    const d = await res.json();
    setProjects(d.projects ?? []);
  }, [filterStatus, filterType, filterOverdue]);

  const loadRevisions = useCallback(async () => {
    if (!revisionProjectId) {
      const res = await fetch(api('projects'));
      const d = await res.json();
      setProjects(d.projects ?? []);
      const allRevs: WritingRevision[] = [];
      for (const p of (d.projects ?? []).slice(0, 10)) {
        const r = await fetch(api('revisions', { project_id: String(p.id) }));
        const rd = await r.json();
        allRevs.push(...(rd.revisions ?? []));
      }
      setRevisions(allRevs);
    } else {
      const res = await fetch(api('revisions', { project_id: revisionProjectId }));
      const d = await res.json();
      setRevisions(d.revisions ?? []);
    }
  }, [revisionProjectId]);

  const loadRevisionsByProject = useCallback(async (pid: number) => {
    const res = await fetch(api('revisions', { project_id: String(pid) }));
    const d = await res.json();
    setRevisions(d.revisions ?? []);
  }, []);

  const loadRevenue = useCallback(async () => {
    const res = await fetch(api('revenue'));
    const d = await res.json();
    setMonthly(d.monthly ?? []);
    setByType(d.by_type ?? []);
    setOutstanding(d.outstanding ?? []);
  }, []);

  useEffect(() => {
    if (tab === 'Dashboard') loadDashboard();
    if (tab === 'Clients') loadClients();
    if (tab === 'Projects') { loadClients(); loadProjects(); }
    if (tab === 'Revisions') { loadClients(); loadProjects(); }
    if (tab === 'Revenue') loadRevenue();
  }, [tab, loadDashboard, loadClients, loadProjects, loadRevisions, loadRevenue]);

  useEffect(() => {
    if (tab === 'Projects') loadProjects();
  }, [filterStatus, filterType, filterOverdue, tab, loadProjects]);

  // ── Submit handlers ────────────────────────────────────────────────────────
  async function submitClient(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(api('clients'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...cForm, hourly_rate: cForm.hourly_rate ? parseFloat(cForm.hourly_rate) : null }),
    });
    if (res.ok) {
      setShowNewClient(false);
      setCForm({ name: '', email: '', phone: '', company: '', industry: '', preferred_tone: 'professional', preferred_style_guide: '', brand_voice_notes: '', target_audience: '', status: 'active', hourly_rate: '', source: '', notes: '' });
      loadClients();
      flash('Client added.');
    } else {
      const d = await res.json();
      setError(d.error ?? 'Failed to add client.');
    }
  }

  async function submitProject(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(api('projects'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...pForm,
        client_id: pForm.client_id ? parseInt(pForm.client_id) : null,
        word_count_target: pForm.word_count_target ? parseInt(pForm.word_count_target) : null,
        keywords: pForm.keywords ? pForm.keywords.split(',').map(k => k.trim()).filter(Boolean) : null,
        rate: pForm.rate ? parseFloat(pForm.rate) : null,
        estimated_fee: pForm.estimated_fee ? parseFloat(pForm.estimated_fee) : null,
        revisions_allowed: parseInt(pForm.revisions_allowed) || 2,
      }),
    });
    if (res.ok) {
      setShowNewProject(false);
      setPForm({ client_id: '', title: '', project_type: 'blog_post', description: '', word_count_target: '', keywords: '', deadline: '', priority: 'normal', rate_type: 'per_word', rate: '', estimated_fee: '', draft_due: '', final_due: '', revisions_allowed: '2', brief_notes: '', platform: '', assigned_writer: 'self' });
      loadProjects();
      flash('Project created.');
    } else {
      const d = await res.json();
      setError(d.error ?? 'Failed to create project.');
    }
  }

  async function advanceStatus(project: WritingProject) {
    const idx = STATUS_PIPELINE.indexOf(project.status);
    if (idx < 0 || idx >= STATUS_PIPELINE.length - 1) return;
    const next = STATUS_PIPELINE[idx + 1];
    await fetch(api('projects') + `&sub=projects&id=${project.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    });
    // use PUT with id
    await fetch(`/api/admin/writer-portal?sub=projects&id=${project.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    });
    loadProjects();
    flash(`Moved to ${next}.`);
  }

  async function markDeliver(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProject) return;
    await fetch(`/api/admin/writer-portal?sub=deliver&project_id=${selectedProject.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        word_count_delivered: deliverForm.word_count_delivered ? parseInt(deliverForm.word_count_delivered) : null,
        actual_fee: deliverForm.actual_fee ? parseFloat(deliverForm.actual_fee) : null,
      }),
    });
    setShowDeliverModal(false);
    loadProjects();
    flash('Marked as delivered.');
  }

  async function submitRevision(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProject) return;
    const res = await fetch(`/api/admin/writer-portal?sub=revisions&project_id=${selectedProject.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(revForm),
    });
    if (res.ok) {
      setShowRevModal(false);
      setRevForm({ feedback: '', changes_requested: '' });
      loadRevisionsByProject(selectedProject.id);
      flash('Revision request logged.');
    }
  }

  async function markPaid(projectId: number) {
    await fetch(`/api/admin/writer-portal?sub=mark-paid&project_id=${projectId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    loadRevenue();
    flash('Marked as paid.');
  }

  // ── AI Studio ──────────────────────────────────────────────────────────────
  async function runAI() {
    setAiLoading(true);
    setAiResult('');
    const subMap = { draft: 'ai-write', outline: 'ai-outline', headline: 'ai-headline', research: 'ai-research' };
    const sub = subMap[aiSubTab];
    const body = aiSubTab === 'draft'
      ? { project_type: aiForm.project_type, title: aiForm.title, keywords: aiForm.keywords.split(',').map(k => k.trim()), tone: aiForm.tone, word_count: aiForm.word_count, brief: aiForm.brief }
      : aiSubTab === 'outline'
      ? { project_type: aiForm.project_type, title: aiForm.title, keywords: aiForm.keywords.split(',').map(k => k.trim()), target_audience: aiForm.target_audience }
      : aiSubTab === 'headline'
      ? { topic: aiForm.topic, tone: aiForm.tone, count: aiForm.count }
      : { topic: aiForm.topic };
    const res = await fetch(`/api/admin/writer-portal?sub=${sub}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const d = await res.json();
    setAiResult(d.content ?? d.outline ?? d.headlines ?? d.research ?? '');
    setAiLoading(false);
  }

  // ── Kanban grouping ────────────────────────────────────────────────────────
  const kanbanCols = ['briefing', 'research', 'drafting', 'review', 'revision', 'delivered'];
  const kanban = kanbanCols.map(s => ({ status: s, items: projects.filter(p => p.status === s) }));

  // ── Revenue chart max ──────────────────────────────────────────────────────
  const revMax = Math.max(...monthly.map(m => Number(m.revenue)), 1);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-slate-800 text-white px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Writer Portal</h1>
          <p className="text-slate-300 text-sm">Content, Copywriting & Editorial Project Management</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowNewClient(true); }} className="px-3 py-1.5 bg-slate-600 rounded text-sm hover:bg-slate-500">+ Client</button>
          <button onClick={() => { setShowNewProject(true); loadClients(); }} className="px-3 py-1.5 bg-blue-600 rounded text-sm hover:bg-blue-500">+ Project</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b px-6 flex gap-1">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Messages */}
      {error && <div className="mx-6 mt-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm flex justify-between"><span>{error}</span><button onClick={() => setError('')}>✕</button></div>}
      {msg && <div className="mx-6 mt-3 p-3 bg-green-50 border border-green-200 text-green-700 rounded text-sm">{msg}</div>}

      <div className="p-6">
        {/* ── TAB 1: Dashboard ── */}
        {tab === 'Dashboard' && (
          <div className="space-y-6">
            {loading && <p className="text-gray-400">Loading...</p>}
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-white rounded-lg p-4 border">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Active Projects</p>
                  <p className="text-3xl font-bold text-slate-800">{stats.active_projects}</p>
                </div>
                <div className="bg-white rounded-lg p-4 border">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Drafting</p>
                  <p className="text-3xl font-bold text-blue-600">{stats.drafting}</p>
                </div>
                <div className={`rounded-lg p-4 border ${Number(stats.overdue) > 0 ? 'bg-red-50 border-red-200' : 'bg-white'}`}>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Overdue</p>
                  <p className={`text-3xl font-bold ${Number(stats.overdue) > 0 ? 'text-red-600' : 'text-gray-400'}`}>{stats.overdue}</p>
                </div>
                <div className="bg-white rounded-lg p-4 border">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Revenue (Mo)</p>
                  <p className="text-2xl font-bold text-green-600">{fmtCurrency(stats.revenue_this_month)}</p>
                </div>
                <div className="bg-white rounded-lg p-4 border">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Words (Mo)</p>
                  <p className="text-2xl font-bold text-slate-700">{fmtNum(stats.words_this_month)}</p>
                </div>
              </div>
            )}

            {/* Pipeline funnel */}
            <div className="bg-white rounded-lg border p-4">
              <h2 className="font-semibold text-slate-700 mb-3">Project Pipeline</h2>
              <div className="flex gap-2 overflow-x-auto">
                {STATUS_PIPELINE.filter(s => !['invoiced','paid'].includes(s)).map(s => {
                  const cnt = projects.filter(p => p.status === s).length;
                  return (
                    <div key={s} className="flex-1 min-w-[80px] text-center">
                      <div className="bg-blue-50 border border-blue-100 rounded p-2">
                        <p className="text-xs text-gray-500 capitalize">{s}</p>
                        <p className="text-lg font-bold text-blue-700">{cnt}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Upcoming deadlines */}
              <div className="bg-white rounded-lg border p-4">
                <h2 className="font-semibold text-slate-700 mb-3">Upcoming Deadlines (7 days)</h2>
                {upcoming.length === 0 ? <p className="text-gray-400 text-sm">No deadlines this week.</p> : (
                  <div className="space-y-2">
                    {upcoming.map(p => (
                      <div key={p.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div>
                          <p className="text-sm font-medium">{p.title}</p>
                          <p className="text-xs text-gray-500">{p.client_name} · {ptLabel(p.project_type)}</p>
                        </div>
                        <span className="text-xs text-orange-600 font-medium">{p.deadline}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent */}
              <div className="bg-white rounded-lg border p-4">
                <h2 className="font-semibold text-slate-700 mb-3">Recent Projects</h2>
                {recent.length === 0 ? <p className="text-gray-400 text-sm">No projects yet.</p> : (
                  <div className="space-y-2">
                    {recent.slice(0, 8).map(p => (
                      <div key={p.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div>
                          <p className="text-sm font-medium">{p.title}</p>
                          <p className="text-xs text-gray-500">{ptLabel(p.project_type)}</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${statusColor(p.status)}`}>{p.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: Projects ── */}
        {tab === 'Projects' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="bg-white rounded-lg border p-3 flex flex-wrap gap-3 items-center">
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
                <option value="">All Statuses</option>
                {STATUS_PIPELINE.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={filterType} onChange={e => setFilterType(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
                <option value="">All Types</option>
                {PROJECT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <label className="flex items-center gap-1 text-sm">
                <input type="checkbox" checked={filterOverdue} onChange={e => setFilterOverdue(e.target.checked)} />
                Overdue only
              </label>
            </div>

            {/* Kanban */}
            <div className="flex gap-4 overflow-x-auto pb-2">
              {kanban.map(col => (
                <div key={col.status} className="flex-shrink-0 w-72">
                  <div className="bg-slate-100 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-sm text-slate-700 capitalize">{col.status}</h3>
                      <span className="text-xs bg-slate-200 text-slate-600 rounded-full px-2 py-0.5">{col.items.length}</span>
                    </div>
                    <div className="space-y-2">
                      {col.items.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Empty</p>}
                      {col.items.map(p => (
                        <div key={p.id} className={`bg-white rounded-lg p-3 border shadow-sm ${overdue(p) ? 'border-red-300' : ''}`}>
                          <div className="flex items-start justify-between mb-1">
                            <span className={`text-xs px-1.5 py-0.5 rounded ${priorityColor(p.priority)}`}>{p.priority}</span>
                            {overdue(p) && <span className="text-xs text-red-600 font-semibold">OVERDUE</span>}
                          </div>
                          <p className="text-sm font-semibold text-slate-800 mt-1">{p.title}</p>
                          <p className="text-xs text-gray-500">{p.client_name}</p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-gray-400">{ptLabel(p.project_type)}</span>
                            <span className="text-xs text-gray-500">{fmtNum(p.word_count_delivered)}/{fmtNum(p.word_count_target)} words</span>
                          </div>
                          {p.deadline && <p className="text-xs text-gray-400 mt-1">Due: {p.deadline}</p>}
                          {p.rate_type === 'per_word' && p.rate && <p className="text-xs text-gray-400">${Number(p.rate).toFixed(4)}/word</p>}
                          {(p.rate_type === 'flat_fee' || p.rate_type === 'per_hour') && p.rate && <p className="text-xs text-gray-400">{fmtCurrency(p.rate)}/{p.rate_type === 'per_hour' ? 'hr' : 'flat'}</p>}
                          <div className="mt-2 flex gap-1 flex-wrap">
                            {col.status !== 'delivered' && (
                              <button onClick={() => advanceStatus(p)} className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100">
                                → {STATUS_PIPELINE[Math.min(STATUS_PIPELINE.indexOf(p.status) + 1, STATUS_PIPELINE.length - 1)]}
                              </button>
                            )}
                            {!['delivered','invoiced','paid'].includes(p.status) && (
                              <button onClick={() => { setSelectedProject(p); setDeliverForm({ word_count_delivered: '', actual_fee: '' }); setShowDeliverModal(true); }}
                                className="text-xs px-2 py-1 bg-green-50 text-green-600 rounded hover:bg-green-100">Deliver</button>
                            )}
                            <button onClick={() => { setSelectedProject(p); setRevForm({ feedback: '', changes_requested: '' }); setShowRevModal(true); }}
                              className="text-xs px-2 py-1 bg-yellow-50 text-yellow-600 rounded hover:bg-yellow-100">Revision</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB 3: Clients ── */}
        {tab === 'Clients' && (
          <div className="space-y-4">
            <div className="overflow-x-auto bg-white rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['Name', 'Company', 'Industry', 'Tone', 'Active', 'Earned', 'Status', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {clients.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No clients yet. Add one to get started.</td></tr>
                  )}
                  {clients.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{c.name}</td>
                      <td className="px-4 py-3 text-gray-600">{c.company ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{c.industry ?? '—'}</td>
                      <td className="px-4 py-3 capitalize text-gray-600">{c.preferred_tone}</td>
                      <td className="px-4 py-3">{c.active_projects ?? 0}</td>
                      <td className="px-4 py-3 text-green-700">{fmtCurrency(c.total_earned)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${c.status === 'active' || c.status === 'vip' ? 'bg-green-100 text-green-700' : c.status === 'prospect' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>{c.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        {c.brand_voice_notes && <span className="text-xs text-gray-400" title={c.brand_voice_notes}>📝 Voice notes</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB 4: AI Writing Studio ── */}
        {tab === 'AI Writing Studio' && (
          <div className="max-w-3xl">
            <div className="bg-white rounded-lg border">
              <div className="flex border-b">
                {(['draft', 'outline', 'headline', 'research'] as const).map(st => (
                  <button key={st} onClick={() => { setAiSubTab(st); setAiResult(''); }}
                    className={`px-4 py-3 text-sm font-medium capitalize border-b-2 -mb-px ${aiSubTab === st ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>
                    {st === 'draft' ? 'Draft Content' : st === 'outline' ? 'Generate Outline' : st === 'headline' ? 'Headlines' : 'Research Prompt'}
                  </button>
                ))}
              </div>
              <div className="p-5 space-y-4">
                {(aiSubTab === 'draft' || aiSubTab === 'outline') && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Project Type</label>
                        <select value={aiForm.project_type} onChange={e => setAiForm(f => ({ ...f, project_type: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm">
                          {PROJECT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Tone</label>
                        <select value={aiForm.tone} onChange={e => setAiForm(f => ({ ...f, tone: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm">
                          {TONES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Title</label>
                      <input value={aiForm.title} onChange={e => setAiForm(f => ({ ...f, title: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" placeholder="Content title or topic" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Keywords (comma-separated)</label>
                      <input value={aiForm.keywords} onChange={e => setAiForm(f => ({ ...f, keywords: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" placeholder="keyword1, keyword2, keyword3" />
                    </div>
                    {aiSubTab === 'draft' && (
                      <>
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">Word Count Target</label>
                          <input type="number" value={aiForm.word_count} onChange={e => setAiForm(f => ({ ...f, word_count: parseInt(e.target.value) || 500 }))} className="w-full border rounded px-3 py-1.5 text-sm" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">Brief / Instructions</label>
                          <textarea value={aiForm.brief} onChange={e => setAiForm(f => ({ ...f, brief: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" rows={3} placeholder="Describe what to cover, key messages, style notes..." />
                        </div>
                      </>
                    )}
                    {aiSubTab === 'outline' && (
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Target Audience</label>
                        <input value={aiForm.target_audience} onChange={e => setAiForm(f => ({ ...f, target_audience: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" placeholder="e.g. small business owners, HR managers..." />
                      </div>
                    )}
                  </>
                )}
                {(aiSubTab === 'headline' || aiSubTab === 'research') && (
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Topic</label>
                    <input value={aiForm.topic} onChange={e => setAiForm(f => ({ ...f, topic: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" placeholder="Enter the topic or subject..." />
                  </div>
                )}
                {aiSubTab === 'headline' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Tone</label>
                      <select value={aiForm.tone} onChange={e => setAiForm(f => ({ ...f, tone: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm">
                        {TONES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Number of Headlines</label>
                      <input type="number" value={aiForm.count} onChange={e => setAiForm(f => ({ ...f, count: parseInt(e.target.value) || 5 }))} min={1} max={10} className="w-full border rounded px-3 py-1.5 text-sm" />
                    </div>
                  </div>
                )}
                <button onClick={runAI} disabled={aiLoading} className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
                  {aiLoading ? '⏳ Generating...' : '✨ Generate'}
                </button>
                {aiResult && (
                  <div className="relative">
                    <textarea value={aiResult} onChange={e => setAiResult(e.target.value)} className="w-full border rounded px-3 py-2 text-sm font-mono" rows={20} />
                    <button onClick={() => navigator.clipboard.writeText(aiResult)} className="absolute top-2 right-2 text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200">Copy</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 5: Revisions ── */}
        {tab === 'Revisions' && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg border p-4">
              <div className="flex items-center gap-3 mb-4">
                <select value={revisionProjectId} onChange={e => { setRevisionProjectId(e.target.value); if (e.target.value) loadRevisionsByProject(parseInt(e.target.value)); }}
                  className="border rounded px-3 py-1.5 text-sm min-w-[250px]">
                  <option value="">— All Projects —</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({p.revisions_used}/{p.revisions_allowed} revisions)
                    </option>
                  ))}
                </select>
                <button onClick={() => { if (revisionProjectId) { setSelectedProject(projects.find(p => p.id === parseInt(revisionProjectId)) ?? null); setShowRevModal(true); } }}
                  disabled={!revisionProjectId} className="px-3 py-1.5 bg-yellow-500 text-white rounded text-sm hover:bg-yellow-600 disabled:opacity-40">
                  + Add Revision Request
                </button>
              </div>

              {/* Project revision status */}
              {revisionProjectId && projects.filter(p => p.id === parseInt(revisionProjectId)).map(p => (
                <div key={p.id} className="mb-4 p-3 bg-gray-50 rounded flex items-center gap-4">
                  <div>
                    <p className="font-medium">{p.title}</p>
                    <p className="text-sm text-gray-500">{p.client_name}</p>
                  </div>
                  <div className={`px-3 py-1 rounded text-sm font-medium ${
                    p.revisions_used > p.revisions_allowed ? 'bg-red-100 text-red-700' :
                    p.revisions_used === p.revisions_allowed ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {p.revisions_used}/{p.revisions_allowed} revisions used
                    {p.revisions_used > p.revisions_allowed ? ' ⚠️ OVER LIMIT' :
                     p.revisions_used === p.revisions_allowed ? ' ⚠️ AT LIMIT' : ' ✓ Within'}
                  </div>
                </div>
              ))}

              {revisions.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">No revision requests yet.</p>
              ) : (
                <div className="space-y-3">
                  {revisions.map(r => (
                    <div key={r.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-orange-600">Revision #{r.revision_number}</span>
                        <span className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString()}</span>
                      </div>
                      {r.feedback && <p className="text-sm text-gray-700"><span className="font-medium">Feedback:</span> {r.feedback}</p>}
                      {r.changes_requested && <p className="text-sm text-gray-700 mt-1"><span className="font-medium">Changes:</span> {r.changes_requested}</p>}
                      {r.completed_at && <p className="text-xs text-green-600 mt-1">Completed: {new Date(r.completed_at).toLocaleDateString()}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 6: Revenue ── */}
        {tab === 'Revenue' && (
          <div className="space-y-6">
            {/* Monthly chart */}
            <div className="bg-white rounded-lg border p-4">
              <h2 className="font-semibold text-slate-700 mb-4">Monthly Revenue (Last 6 Months)</h2>
              {monthly.length === 0 ? <p className="text-gray-400 text-sm">No paid projects yet.</p> : (
                <div className="flex items-end gap-4 h-32">
                  {monthly.map(m => (
                    <div key={m.month} className="flex-1 flex flex-col items-center">
                      <p className="text-xs text-gray-600 mb-1">{fmtCurrency(m.revenue)}</p>
                      <div className="w-full bg-blue-400 rounded-t" style={{ height: `${Math.round((Number(m.revenue) / revMax) * 96)}px` }} />
                      <p className="text-xs text-gray-400 mt-1">{m.month}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* By type */}
            <div className="bg-white rounded-lg border p-4">
              <h2 className="font-semibold text-slate-700 mb-3">Revenue by Project Type</h2>
              <table className="w-full text-sm">
                <thead className="bg-gray-50"><tr>{['Type','Projects','Earned','Avg $/word'].map(h => <th key={h} className="px-3 py-2 text-left text-xs text-gray-500">{h}</th>)}</tr></thead>
                <tbody className="divide-y">
                  {byType.map(t => (
                    <tr key={t.project_type} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium">{ptLabel(t.project_type)}</td>
                      <td className="px-3 py-2">{t.cnt}</td>
                      <td className="px-3 py-2 text-green-700">{fmtCurrency(t.earned)}</td>
                      <td className="px-3 py-2 text-gray-600">{t.avg_rate ? `$${Number(t.avg_rate).toFixed(4)}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Outstanding */}
            <div className="bg-white rounded-lg border p-4">
              <h2 className="font-semibold text-slate-700 mb-3">Outstanding Invoices (Delivered, Not Paid)</h2>
              {outstanding.length === 0 ? <p className="text-gray-400 text-sm">No outstanding invoices.</p> : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50"><tr>{['Project','Client','Delivered','Fee',''].map(h => <th key={h} className="px-3 py-2 text-left text-xs text-gray-500">{h}</th>)}</tr></thead>
                  <tbody className="divide-y">
                    {outstanding.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium">{p.title}</td>
                        <td className="px-3 py-2 text-gray-600">{p.client_name}</td>
                        <td className="px-3 py-2 text-gray-500">{p.delivered_at ? new Date(p.delivered_at).toLocaleDateString() : '—'}</td>
                        <td className="px-3 py-2 text-orange-700 font-medium">{fmtCurrency(p.actual_fee ?? p.estimated_fee)}</td>
                        <td className="px-3 py-2">
                          <button onClick={() => markPaid(p.id)} className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded hover:bg-green-100">Mark Paid</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Modal: New Client ── */}
      {showNewClient && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-bold text-lg">Add New Client</h2>
              <button onClick={() => setShowNewClient(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={submitClient} className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-gray-500 block mb-1">Name *</label>
                  <input required value={cForm.name} onChange={e => setCForm(f => ({ ...f, name: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" /></div>
                <div><label className="text-xs text-gray-500 block mb-1">Company</label>
                  <input value={cForm.company} onChange={e => setCForm(f => ({ ...f, company: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" /></div>
                <div><label className="text-xs text-gray-500 block mb-1">Email</label>
                  <input type="email" value={cForm.email} onChange={e => setCForm(f => ({ ...f, email: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" /></div>
                <div><label className="text-xs text-gray-500 block mb-1">Phone</label>
                  <input value={cForm.phone} onChange={e => setCForm(f => ({ ...f, phone: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" /></div>
                <div><label className="text-xs text-gray-500 block mb-1">Industry</label>
                  <input value={cForm.industry} onChange={e => setCForm(f => ({ ...f, industry: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" /></div>
                <div><label className="text-xs text-gray-500 block mb-1">Status</label>
                  <select value={cForm.status} onChange={e => setCForm(f => ({ ...f, status: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm">
                    {['active','inactive','prospect','vip'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select></div>
                <div><label className="text-xs text-gray-500 block mb-1">Preferred Tone</label>
                  <select value={cForm.preferred_tone} onChange={e => setCForm(f => ({ ...f, preferred_tone: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm">
                    {TONES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select></div>
                <div><label className="text-xs text-gray-500 block mb-1">Style Guide</label>
                  <select value={cForm.preferred_style_guide} onChange={e => setCForm(f => ({ ...f, preferred_style_guide: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm">
                    <option value="">— Select —</option>
                    {STYLE_GUIDES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select></div>
                <div><label className="text-xs text-gray-500 block mb-1">Hourly Rate (CAD)</label>
                  <input type="number" step="0.01" value={cForm.hourly_rate} onChange={e => setCForm(f => ({ ...f, hourly_rate: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" /></div>
                <div><label className="text-xs text-gray-500 block mb-1">Source</label>
                  <input value={cForm.source} onChange={e => setCForm(f => ({ ...f, source: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" /></div>
              </div>
              <div><label className="text-xs text-gray-500 block mb-1">Target Audience</label>
                <input value={cForm.target_audience} onChange={e => setCForm(f => ({ ...f, target_audience: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" /></div>
              <div><label className="text-xs text-gray-500 block mb-1">Brand Voice Notes</label>
                <textarea value={cForm.brand_voice_notes} onChange={e => setCForm(f => ({ ...f, brand_voice_notes: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" rows={2} /></div>
              <div><label className="text-xs text-gray-500 block mb-1">Notes</label>
                <textarea value={cForm.notes} onChange={e => setCForm(f => ({ ...f, notes: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" rows={2} /></div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 py-2 bg-slate-800 text-white rounded hover:bg-slate-700 text-sm font-medium">Add Client</button>
                <button type="button" onClick={() => setShowNewClient(false)} className="px-4 py-2 border rounded text-sm">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: New Project ── */}
      {showNewProject && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-bold text-lg">New Writing Project</h2>
              <button onClick={() => setShowNewProject(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={submitProject} className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><label className="text-xs text-gray-500 block mb-1">Title *</label>
                  <input required value={pForm.title} onChange={e => setPForm(f => ({ ...f, title: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" placeholder="Project title" /></div>
                <div><label className="text-xs text-gray-500 block mb-1">Client</label>
                  <select value={pForm.client_id} onChange={e => setPForm(f => ({ ...f, client_id: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm">
                    <option value="">— No client —</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ''}</option>)}
                  </select></div>
                <div><label className="text-xs text-gray-500 block mb-1">Project Type *</label>
                  <select required value={pForm.project_type} onChange={e => setPForm(f => ({ ...f, project_type: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm">
                    {PROJECT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select></div>
                <div><label className="text-xs text-gray-500 block mb-1">Priority</label>
                  <select value={pForm.priority} onChange={e => setPForm(f => ({ ...f, priority: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm">
                    {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select></div>
                <div><label className="text-xs text-gray-500 block mb-1">Deadline</label>
                  <input type="date" value={pForm.deadline} onChange={e => setPForm(f => ({ ...f, deadline: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" /></div>
                <div><label className="text-xs text-gray-500 block mb-1">Word Count Target</label>
                  <input type="number" value={pForm.word_count_target} onChange={e => setPForm(f => ({ ...f, word_count_target: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" /></div>
                <div><label className="text-xs text-gray-500 block mb-1">Rate Type</label>
                  <select value={pForm.rate_type} onChange={e => setPForm(f => ({ ...f, rate_type: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm">
                    {RATE_TYPES.map(r => <option key={r} value={r}>{r.replace('_',' ')}</option>)}
                  </select></div>
                <div><label className="text-xs text-gray-500 block mb-1">Rate</label>
                  <input type="number" step="0.0001" value={pForm.rate} onChange={e => setPForm(f => ({ ...f, rate: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" placeholder={pForm.rate_type === 'per_word' ? '0.10' : '500'} /></div>
                <div><label className="text-xs text-gray-500 block mb-1">Estimated Fee (CAD)</label>
                  <input type="number" step="0.01" value={pForm.estimated_fee} onChange={e => setPForm(f => ({ ...f, estimated_fee: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" /></div>
                <div><label className="text-xs text-gray-500 block mb-1">Draft Due</label>
                  <input type="date" value={pForm.draft_due} onChange={e => setPForm(f => ({ ...f, draft_due: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" /></div>
                <div><label className="text-xs text-gray-500 block mb-1">Final Due</label>
                  <input type="date" value={pForm.final_due} onChange={e => setPForm(f => ({ ...f, final_due: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" /></div>
                <div><label className="text-xs text-gray-500 block mb-1">Revisions Allowed</label>
                  <input type="number" value={pForm.revisions_allowed} onChange={e => setPForm(f => ({ ...f, revisions_allowed: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" /></div>
                <div><label className="text-xs text-gray-500 block mb-1">Platform</label>
                  <input value={pForm.platform} onChange={e => setPForm(f => ({ ...f, platform: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" placeholder="e.g. WordPress, HubSpot, client CMS" /></div>
              </div>
              <div><label className="text-xs text-gray-500 block mb-1">Keywords (comma-separated)</label>
                <input value={pForm.keywords} onChange={e => setPForm(f => ({ ...f, keywords: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" placeholder="SEO keyword1, keyword2" /></div>
              <div><label className="text-xs text-gray-500 block mb-1">Brief / Notes</label>
                <textarea value={pForm.brief_notes} onChange={e => setPForm(f => ({ ...f, brief_notes: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" rows={3} /></div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 py-2 bg-slate-800 text-white rounded hover:bg-slate-700 text-sm font-medium">Create Project</button>
                <button type="button" onClick={() => setShowNewProject(false)} className="px-4 py-2 border rounded text-sm">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Revision Request ── */}
      {showRevModal && selectedProject && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-bold">Revision Request — {selectedProject.title}</h2>
              <button onClick={() => setShowRevModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={submitRevision} className="p-5 space-y-3">
              <div className={`text-sm px-3 py-2 rounded ${selectedProject.revisions_used >= selectedProject.revisions_allowed ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {selectedProject.revisions_used}/{selectedProject.revisions_allowed} revisions used
              </div>
              <div><label className="text-xs text-gray-500 block mb-1">Client Feedback</label>
                <textarea value={revForm.feedback} onChange={e => setRevForm(f => ({ ...f, feedback: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" rows={3} /></div>
              <div><label className="text-xs text-gray-500 block mb-1">Changes Requested</label>
                <textarea value={revForm.changes_requested} onChange={e => setRevForm(f => ({ ...f, changes_requested: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" rows={3} /></div>
              <div className="flex gap-2">
                <button type="submit" className="flex-1 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-sm font-medium">Log Revision</button>
                <button type="button" onClick={() => setShowRevModal(false)} className="px-4 py-2 border rounded text-sm">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Deliver ── */}
      {showDeliverModal && selectedProject && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-bold">Mark Delivered</h2>
              <button onClick={() => setShowDeliverModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={markDeliver} className="p-5 space-y-3">
              <p className="text-sm text-gray-600">{selectedProject.title}</p>
              <div><label className="text-xs text-gray-500 block mb-1">Words Delivered</label>
                <input type="number" value={deliverForm.word_count_delivered} onChange={e => setDeliverForm(f => ({ ...f, word_count_delivered: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" placeholder={String(selectedProject.word_count_target ?? '')} /></div>
              <div><label className="text-xs text-gray-500 block mb-1">Actual Fee (CAD)</label>
                <input type="number" step="0.01" value={deliverForm.actual_fee} onChange={e => setDeliverForm(f => ({ ...f, actual_fee: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" placeholder={String(selectedProject.estimated_fee ?? '')} /></div>
              <div className="flex gap-2">
                <button type="submit" className="flex-1 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-medium">Confirm Delivery</button>
                <button type="button" onClick={() => setShowDeliverModal(false)} className="px-4 py-2 border rounded text-sm">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
