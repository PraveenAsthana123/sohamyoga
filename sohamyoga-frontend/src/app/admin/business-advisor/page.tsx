'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = 'Dashboard' | 'Clients' | 'Engagements' | 'Sessions' | 'AI Strategy Studio' | 'Revenue & Pipeline';
const TABS: Tab[] = ['Dashboard', 'Clients', 'Engagements', 'Sessions', 'AI Strategy Studio', 'Revenue & Pipeline'];

const ENGAGEMENT_TYPES = [
  { value: 'strategy', label: 'Strategy' },
  { value: 'operations', label: 'Operations' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'finance', label: 'Finance' },
  { value: 'hr', label: 'HR & People' },
  { value: 'technology', label: 'Technology' },
  { value: 'startup', label: 'Startup' },
  { value: 'franchise', label: 'Franchise' },
  { value: 'risk', label: 'Risk & Compliance' },
];

const BUSINESS_STAGES = ['startup', 'growth', 'mature', 'turnaround', 'exit'];
const COMPANY_SIZES = ['solo', '1-10', '11-50', '51-200', '200+'];
const CLIENT_STATUSES = ['prospect', 'active', 'retainer', 'project', 'inactive', 'alumni'];
const ENGAGEMENT_STATUSES = ['proposal', 'active', 'on_hold', 'completed', 'cancelled'];
const FEE_TYPES = ['project', 'retainer', 'hourly', 'success_fee'];
const SESSION_TYPES = ['meeting', 'workshop', 'review', 'presentation', 'call'];
const DELIVERABLE_STATUSES = ['pending', 'in_progress', 'delivered', 'approved', 'revision_needed'];

interface AdvisoryClient {
  id: number;
  name: string;
  company_name?: string;
  industry?: string;
  company_size?: string;
  email?: string;
  phone?: string;
  city: string;
  province: string;
  business_stage?: string;
  annual_revenue?: number;
  primary_challenge?: string;
  advisory_type?: string[];
  status: string;
  retainer_amount?: number;
  retainer_frequency?: string;
  hourly_rate?: number;
  source?: string;
  notes?: string;
  active_engagements?: number;
  total_billed?: number;
  created_at: string;
}

interface Advisory {
  id: number;
  client_id?: number;
  client_name?: string;
  company_name?: string;
  title: string;
  engagement_type: string;
  scope?: string;
  objectives?: string;
  expected_outcomes?: string;
  start_date?: string;
  end_date?: string;
  status: string;
  fee_type: string;
  fee_amount?: number;
  hours_estimated?: number;
  hours_logged: number;
  deliverables?: string[];
  priority: string;
  notes?: string;
  session_count?: number;
  deliverable_count?: number;
  delivered_count?: number;
  overdue_deliverables?: number;
  created_at: string;
}

interface Session {
  id: number;
  engagement_id: number;
  engagement_title?: string;
  client_name?: string;
  session_date: string;
  duration_minutes?: number;
  session_type: string;
  agenda?: string;
  notes?: string;
  action_items?: string[];
  next_session_date?: string;
  created_at: string;
}

interface Deliverable {
  id: number;
  engagement_id: number;
  engagement_title?: string;
  client_name?: string;
  title: string;
  description?: string;
  due_date?: string;
  delivered_at?: string;
  status: string;
  notes?: string;
}

interface DashboardStats {
  active_engagements: number;
  proposals: number;
  mrr: number;
  pipeline_value: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function etLabel(type: string) {
  return ENGAGEMENT_TYPES.find(t => t.value === type)?.label ?? type;
}
function fmtCurrency(n?: number | null) {
  if (!n) return '$0';
  return `$${Number(n).toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
function fmtCurrencyFull(n?: number | null) {
  if (!n) return '$0.00';
  return `$${Number(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function engStatusColor(s: string) {
  return s === 'active' ? 'bg-green-100 text-green-700' :
    s === 'proposal' ? 'bg-blue-100 text-blue-700' :
    s === 'completed' ? 'bg-purple-100 text-purple-700' :
    s === 'on_hold' ? 'bg-yellow-100 text-yellow-700' :
    'bg-gray-100 text-gray-500';
}
function clientStatusColor(s: string) {
  return s === 'active' || s === 'retainer' ? 'bg-green-100 text-green-700' :
    s === 'prospect' ? 'bg-blue-100 text-blue-700' :
    s === 'alumni' ? 'bg-purple-100 text-purple-700' :
    'bg-gray-100 text-gray-500';
}
function delivStatusColor(s: string) {
  return s === 'delivered' || s === 'approved' ? 'bg-green-100 text-green-700' :
    s === 'in_progress' ? 'bg-blue-100 text-blue-700' :
    s === 'revision_needed' ? 'bg-yellow-100 text-yellow-700' :
    'bg-gray-100 text-gray-500';
}
function progressPct(eng: Advisory) {
  if (!eng.start_date || !eng.end_date) return 0;
  const start = new Date(eng.start_date).getTime();
  const end = new Date(eng.end_date).getTime();
  const now = Date.now();
  if (now <= start) return 0;
  if (now >= end) return 100;
  return Math.round(((now - start) / (end - start)) * 100);
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function BusinessAdvisorPage() {
  const [tab, setTab] = useState<Tab>('Dashboard');
  const [clients, setClients] = useState<AdvisoryClient[]>([]);
  const [engagements, setEngagements] = useState<Advisory[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [allActionSessions, setAllActionSessions] = useState<Session[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [upcomingSessions, setUpcomingSessions] = useState<Session[]>([]);
  const [overdueDeliverables, setOverdueDeliverables] = useState<Deliverable[]>([]);
  const [revenueData, setRevenueData] = useState<{ by_type: { engagement_type: string; engagements: number; earned: number; total_hours: number }[]; retainers: AdvisoryClient[]; uninvoiced: Advisory[] }>({ by_type: [], retainers: [], uninvoiced: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  // filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterClientId, setFilterClientId] = useState('');
  const [filterCStatus, setFilterCStatus] = useState('');
  const [filterCStage, setFilterCStage] = useState('');
  const [selectedEngId, setSelectedEngId] = useState('');

  // modals
  const [showNewClient, setShowNewClient] = useState(false);
  const [showNewEng, setShowNewEng] = useState(false);
  const [showLogSession, setShowLogSession] = useState(false);
  const [showNewDeliverable, setShowNewDeliverable] = useState(false);
  const [expandedClient, setExpandedClient] = useState<number | null>(null);

  // AI Studio
  const [aiSubTab, setAiSubTab] = useState<'framework' | 'proposal' | 'agenda' | 'swot'>('framework');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState('');
  const [aiForm, setAiForm] = useState({
    engagement_type: 'strategy', challenge: '', company_size: '11-50', industry: '',
    client_name: '', company: '', duration_weeks: 8, fee: '',
    session_goals: '', company_name: '', situation: '',
  });

  // Client form
  const [cForm, setCForm] = useState({
    name: '', company_name: '', industry: '', company_size: '', email: '', phone: '',
    city: 'Calgary', province: 'AB', business_stage: '', annual_revenue: '',
    primary_challenge: '', advisory_type: [] as string[], status: 'prospect',
    retainer_amount: '', retainer_frequency: 'monthly', hourly_rate: '', source: '', notes: '',
  });

  // Engagement form
  const [eForm, setEForm] = useState({
    client_id: '', title: '', engagement_type: 'strategy', scope: '', objectives: '',
    expected_outcomes: '', start_date: '', end_date: '', status: 'proposal',
    fee_type: 'project', fee_amount: '', hours_estimated: '', priority: 'normal',
    deliverables: '' as string, notes: '',
  });

  // Session form
  const [sForm, setSForm] = useState({
    session_date: '', duration_minutes: '60', session_type: 'meeting',
    agenda: '', notes: '', action_items: '', next_session_date: '',
  });

  // Deliverable form
  const [dForm, setDForm] = useState({ title: '', description: '', due_date: '', notes: '' });

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 4000); };

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/business-advisor?sub=');
      const d = await res.json();
      setStats(d.stats);
      setUpcomingSessions(d.upcoming_sessions ?? []);
      setOverdueDeliverables(d.overdue_deliverables ?? []);
    } catch { setError('Failed to load dashboard.'); }
    setLoading(false);
  }, []);

  const loadClients = useCallback(async () => {
    const sp = new URLSearchParams({ sub: 'clients' });
    if (filterCStatus) sp.set('status', filterCStatus);
    if (filterCStage) sp.set('stage', filterCStage);
    const res = await fetch(`/api/admin/business-advisor?${sp}`);
    const d = await res.json();
    setClients(d.clients ?? []);
  }, [filterCStatus, filterCStage]);

  const loadEngagements = useCallback(async () => {
    const sp = new URLSearchParams({ sub: 'engagements' });
    if (filterStatus) sp.set('status', filterStatus);
    if (filterType) sp.set('type', filterType);
    if (filterClientId) sp.set('client_id', filterClientId);
    const res = await fetch(`/api/admin/business-advisor?${sp}`);
    const d = await res.json();
    setEngagements(d.engagements ?? []);
  }, [filterStatus, filterType, filterClientId]);

  const loadSessions = useCallback(async (engId?: string) => {
    const eid = engId ?? selectedEngId;
    if (!eid) {
      const res = await fetch('/api/admin/business-advisor?sub=all-action-items');
      const d = await res.json();
      setAllActionSessions(d.sessions_with_actions ?? []);
      setSessions([]);
    } else {
      const res = await fetch(`/api/admin/business-advisor?sub=sessions&engagement_id=${eid}`);
      const d = await res.json();
      setSessions(d.sessions ?? []);
    }
  }, [selectedEngId]);

  const loadDeliverables = useCallback(async (engId: string) => {
    const res = await fetch(`/api/admin/business-advisor?sub=deliverables&engagement_id=${engId}`);
    const d = await res.json();
    setDeliverables(d.deliverables ?? []);
  }, []);

  const loadRevenue = useCallback(async () => {
    const res = await fetch('/api/admin/business-advisor?sub=revenue');
    const d = await res.json();
    setRevenueData({ by_type: d.by_type ?? [], retainers: d.retainers ?? [], uninvoiced: d.uninvoiced ?? [] });
  }, []);

  useEffect(() => {
    if (tab === 'Dashboard') loadDashboard();
    if (tab === 'Clients') { loadClients(); }
    if (tab === 'Engagements') { loadClients(); loadEngagements(); }
    if (tab === 'Sessions') { loadClients(); loadEngagements(); loadSessions(); }
    if (tab === 'Revenue & Pipeline') loadRevenue();
  }, [tab, loadDashboard, loadClients, loadEngagements, loadSessions, loadRevenue]);

  useEffect(() => { if (tab === 'Clients') loadClients(); }, [filterCStatus, filterCStage, tab, loadClients]);
  useEffect(() => { if (tab === 'Engagements') loadEngagements(); }, [filterStatus, filterType, filterClientId, tab, loadEngagements]);

  // ── Submit handlers ────────────────────────────────────────────────────────
  async function submitClient(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/business-advisor?sub=clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...cForm,
        annual_revenue: cForm.annual_revenue ? parseFloat(cForm.annual_revenue) : null,
        retainer_amount: cForm.retainer_amount ? parseFloat(cForm.retainer_amount) : null,
        hourly_rate: cForm.hourly_rate ? parseFloat(cForm.hourly_rate) : null,
        advisory_type: cForm.advisory_type.length ? cForm.advisory_type : null,
      }),
    });
    if (res.ok) {
      setShowNewClient(false);
      setCForm({ name: '', company_name: '', industry: '', company_size: '', email: '', phone: '', city: 'Calgary', province: 'AB', business_stage: '', annual_revenue: '', primary_challenge: '', advisory_type: [], status: 'prospect', retainer_amount: '', retainer_frequency: 'monthly', hourly_rate: '', source: '', notes: '' });
      loadClients();
      flash('Client added.');
    } else {
      const d = await res.json();
      setError(d.error ?? 'Failed.');
    }
  }

  async function submitEngagement(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/business-advisor?sub=engagements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...eForm,
        client_id: eForm.client_id ? parseInt(eForm.client_id) : null,
        fee_amount: eForm.fee_amount ? parseFloat(eForm.fee_amount) : null,
        hours_estimated: eForm.hours_estimated ? parseInt(eForm.hours_estimated) : null,
        deliverables: eForm.deliverables ? eForm.deliverables.split('\n').map(s => s.trim()).filter(Boolean) : null,
      }),
    });
    if (res.ok) {
      setShowNewEng(false);
      setEForm({ client_id: '', title: '', engagement_type: 'strategy', scope: '', objectives: '', expected_outcomes: '', start_date: '', end_date: '', status: 'proposal', fee_type: 'project', fee_amount: '', hours_estimated: '', priority: 'normal', deliverables: '', notes: '' });
      loadEngagements();
      flash('Engagement created.');
    } else {
      const d = await res.json();
      setError(d.error ?? 'Failed.');
    }
  }

  async function advanceEngStatus(eng: Advisory) {
    const pipeline = ['proposal', 'active', 'completed'];
    const idx = pipeline.indexOf(eng.status);
    if (idx < 0 || idx >= pipeline.length - 1) return;
    const next = pipeline[idx + 1];
    await fetch(`/api/admin/business-advisor?sub=engagements&id=${eng.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    });
    loadEngagements();
    flash(`Status updated to ${next}.`);
  }

  async function submitSession(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEngId) return;
    const res = await fetch(`/api/admin/business-advisor?sub=sessions&engagement_id=${selectedEngId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...sForm,
        duration_minutes: sForm.duration_minutes ? parseInt(sForm.duration_minutes) : null,
        action_items: sForm.action_items ? sForm.action_items.split('\n').map(s => s.trim()).filter(Boolean) : null,
        next_session_date: sForm.next_session_date || null,
      }),
    });
    if (res.ok) {
      setShowLogSession(false);
      setSForm({ session_date: '', duration_minutes: '60', session_type: 'meeting', agenda: '', notes: '', action_items: '', next_session_date: '' });
      loadSessions(selectedEngId);
      flash('Session logged.');
    } else {
      const d = await res.json();
      setError(d.error ?? 'Failed.');
    }
  }

  async function submitDeliverable(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEngId) return;
    const res = await fetch(`/api/admin/business-advisor?sub=deliverables&engagement_id=${selectedEngId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dForm),
    });
    if (res.ok) {
      setShowNewDeliverable(false);
      setDForm({ title: '', description: '', due_date: '', notes: '' });
      loadDeliverables(selectedEngId);
      flash('Deliverable added.');
    }
  }

  async function markDelivered(delivId: number) {
    await fetch(`/api/admin/business-advisor?sub=deliver-deliverable&id=${delivId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (selectedEngId) loadDeliverables(selectedEngId);
    flash('Marked as delivered.');
  }

  // ── AI Studio ──────────────────────────────────────────────────────────────
  async function runAI() {
    setAiLoading(true);
    setAiResult('');
    const subMap = { framework: 'ai-framework', proposal: 'ai-proposal', agenda: 'ai-agenda', swot: 'ai-swot' };
    const sub = subMap[aiSubTab];
    const body = aiSubTab === 'framework'
      ? { engagement_type: aiForm.engagement_type, challenge: aiForm.challenge, company_size: aiForm.company_size, industry: aiForm.industry }
      : aiSubTab === 'proposal'
      ? { client_name: aiForm.client_name, company: aiForm.company, challenge: aiForm.challenge, engagement_type: aiForm.engagement_type, duration_weeks: aiForm.duration_weeks, fee: aiForm.fee }
      : aiSubTab === 'agenda'
      ? { engagement_type: aiForm.engagement_type, session_goals: aiForm.session_goals }
      : { company_name: aiForm.company_name, industry: aiForm.industry, situation: aiForm.situation };
    const res = await fetch(`/api/admin/business-advisor?sub=${sub}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const d = await res.json();
    setAiResult(d.frameworks ?? d.proposal ?? d.agenda ?? d.swot ?? '');
    setAiLoading(false);
  }

  const toggleAdvisoryType = (type: string) => {
    setCForm(f => ({
      ...f,
      advisory_type: f.advisory_type.includes(type)
        ? f.advisory_type.filter(t => t !== type)
        : [...f.advisory_type, type],
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-slate-800 text-white px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Business Advisor Hub</h1>
          <p className="text-slate-300 text-sm">Management Consulting & Strategic Advisory CRM</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowNewClient(true)} className="px-3 py-1.5 bg-slate-600 rounded text-sm hover:bg-slate-500">+ Client</button>
          <button onClick={() => { setShowNewEng(true); loadClients(); }} className="px-3 py-1.5 bg-blue-600 rounded text-sm hover:bg-blue-500">+ Engagement</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b px-6 flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg border p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Active Engagements</p>
                  <p className="text-3xl font-bold text-slate-800">{stats.active_engagements}</p>
                </div>
                <div className="bg-white rounded-lg border p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Proposals</p>
                  <p className="text-3xl font-bold text-blue-600">{stats.proposals}</p>
                </div>
                <div className="bg-white rounded-lg border p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Retainer MRR</p>
                  <p className="text-2xl font-bold text-green-600">{fmtCurrencyFull(stats.mrr)}</p>
                </div>
                <div className="bg-white rounded-lg border p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Pipeline Value</p>
                  <p className="text-2xl font-bold text-orange-600">{fmtCurrencyFull(stats.pipeline_value)}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Upcoming sessions */}
              <div className="bg-white rounded-lg border p-4">
                <h2 className="font-semibold text-slate-700 mb-3">Upcoming Sessions (7 days)</h2>
                {upcomingSessions.length === 0 ? <p className="text-gray-400 text-sm">No sessions scheduled this week.</p> : (
                  <div className="space-y-2">
                    {upcomingSessions.map(s => (
                      <div key={s.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div>
                          <p className="text-sm font-medium">{s.client_name}</p>
                          <p className="text-xs text-gray-500">{s.engagement_title} · {s.session_type}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-blue-600 font-medium">{new Date(s.session_date).toLocaleDateString()}</p>
                          {s.duration_minutes && <p className="text-xs text-gray-400">{s.duration_minutes}min</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Overdue deliverables */}
              <div className={`rounded-lg border p-4 ${overdueDeliverables.length > 0 ? 'bg-red-50 border-red-200' : 'bg-white'}`}>
                <h2 className={`font-semibold mb-3 ${overdueDeliverables.length > 0 ? 'text-red-700' : 'text-slate-700'}`}>
                  Overdue Deliverables {overdueDeliverables.length > 0 && `(${overdueDeliverables.length})`}
                </h2>
                {overdueDeliverables.length === 0 ? <p className="text-gray-400 text-sm">No overdue deliverables.</p> : (
                  <div className="space-y-2">
                    {overdueDeliverables.map(d => (
                      <div key={d.id} className="flex items-center justify-between p-2 bg-white rounded border border-red-100">
                        <div>
                          <p className="text-sm font-medium">{d.title}</p>
                          <p className="text-xs text-gray-500">{d.client_name} · {d.engagement_title}</p>
                        </div>
                        <p className="text-xs text-red-600 font-medium">{d.due_date}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: Clients ── */}
        {tab === 'Clients' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="bg-white rounded-lg border p-3 flex flex-wrap gap-3">
              <select value={filterCStatus} onChange={e => setFilterCStatus(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
                <option value="">All Statuses</option>
                {CLIENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={filterCStage} onChange={e => setFilterCStage(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
                <option value="">All Stages</option>
                {BUSINESS_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="overflow-x-auto bg-white rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['Company', 'Contact', 'Industry', 'Stage', 'Services', 'Status', 'Retainer', 'Active Eng.', 'Billed', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {clients.length === 0 && (
                    <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">No clients yet.</td></tr>
                  )}
                  {clients.map(c => (
                    <>
                      <tr key={c.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setExpandedClient(expandedClient === c.id ? null : c.id)}>
                        <td className="px-4 py-3 font-medium">{c.company_name ?? '—'}</td>
                        <td className="px-4 py-3">
                          <p>{c.name}</p>
                          {c.email && <p className="text-xs text-gray-400">{c.email}</p>}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{c.industry ?? '—'}</td>
                        <td className="px-4 py-3 capitalize text-gray-600">{c.business_stage ?? '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {(c.advisory_type ?? []).slice(0, 2).map(t => (
                              <span key={t} className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{etLabel(t)}</span>
                            ))}
                            {(c.advisory_type ?? []).length > 2 && <span className="text-xs text-gray-400">+{(c.advisory_type ?? []).length - 2}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${clientStatusColor(c.status)}`}>{c.status}</span>
                        </td>
                        <td className="px-4 py-3">
                          {c.retainer_amount ? <span className="text-green-700 font-medium">{fmtCurrency(c.retainer_amount)}/{c.retainer_frequency ?? 'mo'}</span> : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">{c.active_engagements ?? 0}</td>
                        <td className="px-4 py-3 text-gray-700">{fmtCurrencyFull(c.total_billed)}</td>
                        <td className="px-4 py-3 text-blue-500 text-xs">{expandedClient === c.id ? '▲' : '▼'}</td>
                      </tr>
                      {expandedClient === c.id && (
                        <tr key={`${c.id}-expand`}><td colSpan={10} className="px-4 py-3 bg-blue-50">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              {c.primary_challenge && <p><span className="font-medium">Challenge:</span> {c.primary_challenge}</p>}
                              {c.annual_revenue && <p><span className="font-medium">Revenue:</span> {fmtCurrencyFull(c.annual_revenue)}</p>}
                              {c.company_size && <p><span className="font-medium">Size:</span> {c.company_size} employees</p>}
                              {c.phone && <p><span className="font-medium">Phone:</span> {c.phone}</p>}
                            </div>
                            <div>
                              {c.hourly_rate && <p><span className="font-medium">Hourly Rate:</span> {fmtCurrencyFull(c.hourly_rate)}</p>}
                              {c.source && <p><span className="font-medium">Source:</span> {c.source}</p>}
                              {c.notes && <p><span className="font-medium">Notes:</span> {c.notes}</p>}
                            </div>
                          </div>
                        </td></tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB 3: Engagements ── */}
        {tab === 'Engagements' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="bg-white rounded-lg border p-3 flex flex-wrap gap-3">
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
                <option value="">All Statuses</option>
                {ENGAGEMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={filterType} onChange={e => setFilterType(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
                <option value="">All Types</option>
                {ENGAGEMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <select value={filterClientId} onChange={e => setFilterClientId(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
                <option value="">All Clients</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.company_name ?? c.name}</option>)}
              </select>
            </div>

            <div className="space-y-4">
              {engagements.length === 0 && <div className="bg-white rounded-lg border p-8 text-center text-gray-400">No engagements yet.</div>}
              {engagements.map(eng => {
                const pct = progressPct(eng);
                return (
                  <div key={eng.id} className="bg-white rounded-lg border p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${engStatusColor(eng.status)}`}>{eng.status}</span>
                          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{etLabel(eng.engagement_type)}</span>
                          {Number(eng.overdue_deliverables) > 0 && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">⚠️ {eng.overdue_deliverables} overdue</span>}
                        </div>
                        <h3 className="font-semibold text-slate-800">{eng.title}</h3>
                        <p className="text-sm text-gray-500">{eng.company_name ?? eng.client_name}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-800">{fmtCurrencyFull(eng.fee_amount)}</p>
                        <p className="text-xs text-gray-400">{eng.fee_type}</p>
                      </div>
                    </div>

                    {eng.objectives && <p className="text-sm text-gray-600 mb-3">{eng.objectives}</p>}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                      <div className="text-center p-2 bg-gray-50 rounded">
                        <p className="text-xs text-gray-400">Hours</p>
                        <p className="font-semibold">{Number(eng.hours_logged).toFixed(1)}/{eng.hours_estimated ?? '?'}</p>
                      </div>
                      <div className="text-center p-2 bg-gray-50 rounded">
                        <p className="text-xs text-gray-400">Sessions</p>
                        <p className="font-semibold">{eng.session_count ?? 0}</p>
                      </div>
                      <div className="text-center p-2 bg-gray-50 rounded">
                        <p className="text-xs text-gray-400">Deliverables</p>
                        <p className="font-semibold">{eng.delivered_count ?? 0}/{eng.deliverable_count ?? 0}</p>
                      </div>
                      <div className="text-center p-2 bg-gray-50 rounded">
                        <p className="text-xs text-gray-400">Timeline</p>
                        <p className="font-semibold text-sm">{pct}%</p>
                      </div>
                    </div>

                    {/* Progress bar */}
                    {eng.start_date && eng.end_date && (
                      <div className="mb-3">
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-400 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="flex justify-between text-xs text-gray-400 mt-1">
                          <span>{eng.start_date}</span>
                          <span>{eng.end_date}</span>
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-2 flex-wrap">
                      {eng.status !== 'completed' && eng.status !== 'cancelled' && (
                        <button onClick={() => advanceEngStatus(eng)} className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100">
                          {eng.status === 'proposal' ? '→ Activate' : '→ Complete'}
                        </button>
                      )}
                      <button onClick={() => { setSelectedEngId(String(eng.id)); setTab('Sessions'); loadSessions(String(eng.id)); }}
                        className="text-xs px-2 py-1 bg-gray-50 text-gray-600 rounded hover:bg-gray-100">Sessions</button>
                      <button onClick={() => { setSelectedEngId(String(eng.id)); loadDeliverables(String(eng.id)); }}
                        className="text-xs px-2 py-1 bg-gray-50 text-gray-600 rounded hover:bg-gray-100">Deliverables</button>
                    </div>

                    {/* Deliverables inline if selected */}
                    {selectedEngId === String(eng.id) && deliverables.length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-gray-600 uppercase">Deliverables</p>
                          <button onClick={() => setShowNewDeliverable(true)} className="text-xs px-2 py-0.5 bg-slate-100 rounded hover:bg-slate-200">+ Add</button>
                        </div>
                        <div className="space-y-1">
                          {deliverables.map(d => (
                            <div key={d.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                              <div>
                                <p className="font-medium">{d.title}</p>
                                {d.due_date && <p className="text-xs text-gray-400">Due: {d.due_date}</p>}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs px-1.5 py-0.5 rounded ${delivStatusColor(d.status)}`}>{d.status}</span>
                                {d.status !== 'delivered' && d.status !== 'approved' && (
                                  <button onClick={() => markDelivered(d.id)} className="text-xs px-2 py-0.5 bg-green-50 text-green-600 rounded hover:bg-green-100">Deliver</button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── TAB 4: Sessions ── */}
        {tab === 'Sessions' && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg border p-4">
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <select value={selectedEngId} onChange={e => { setSelectedEngId(e.target.value); loadSessions(e.target.value); }}
                  className="border rounded px-3 py-1.5 text-sm min-w-[280px]">
                  <option value="">— All Engagements (action items) —</option>
                  {engagements.map(e => <option key={e.id} value={e.id}>{e.title} ({e.company_name ?? e.client_name})</option>)}
                </select>
                <button onClick={() => setShowLogSession(true)} disabled={!selectedEngId}
                  className="px-3 py-1.5 bg-slate-800 text-white rounded text-sm hover:bg-slate-700 disabled:opacity-40">
                  + Log Session
                </button>
              </div>

              {/* Action items tracker when no engagement selected */}
              {!selectedEngId && (
                <>
                  <h3 className="font-semibold text-slate-700 mb-3">All Action Items Tracker</h3>
                  {allActionSessions.length === 0 ? <p className="text-gray-400 text-sm">No action items yet.</p> : (
                    <div className="space-y-3">
                      {allActionSessions.map(s => (
                        <div key={s.id} className="border rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium">{s.client_name} — {s.engagement_title}</p>
                            <p className="text-xs text-gray-400">{new Date(s.session_date).toLocaleDateString()}</p>
                          </div>
                          <div className="space-y-1">
                            {(s.action_items ?? []).map((item, i) => (
                              <div key={i} className="flex items-start gap-2 text-sm">
                                <span className="text-gray-400 mt-0.5">•</span>
                                <span>{item}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Session timeline */}
              {selectedEngId && sessions.length === 0 && <p className="text-gray-400 text-sm text-center py-6">No sessions logged yet.</p>}
              {selectedEngId && sessions.length > 0 && (
                <div className="space-y-4">
                  {sessions.map(s => (
                    <div key={s.id} className="border-l-4 border-blue-400 pl-4">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{new Date(s.session_date).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded capitalize">{s.session_type}</span>
                          {s.duration_minutes && <span className="text-xs text-gray-400">{s.duration_minutes}min</span>}
                        </div>
                        {s.next_session_date && <p className="text-xs text-gray-400">Next: {new Date(s.next_session_date).toLocaleDateString()}</p>}
                      </div>
                      {s.agenda && <p className="text-sm text-gray-600 mb-1"><span className="font-medium">Agenda:</span> {s.agenda}</p>}
                      {s.notes && <p className="text-sm text-gray-600 mb-1"><span className="font-medium">Notes:</span> {s.notes}</p>}
                      {s.action_items && s.action_items.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Action Items</p>
                          <ul className="space-y-1">
                            {s.action_items.map((item, i) => <li key={i} className="text-sm flex gap-2"><span className="text-orange-500">→</span>{item}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 5: AI Strategy Studio ── */}
        {tab === 'AI Strategy Studio' && (
          <div className="max-w-3xl">
            <div className="bg-white rounded-lg border">
              <div className="flex border-b overflow-x-auto">
                {([['framework', 'Framework Recommender'], ['proposal', 'Proposal Generator'], ['agenda', 'Agenda Generator'], ['swot', 'SWOT Analysis']] as const).map(([k, label]) => (
                  <button key={k} onClick={() => { setAiSubTab(k); setAiResult(''); }}
                    className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 -mb-px ${aiSubTab === k ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>
                    {label}
                  </button>
                ))}
              </div>

              <div className="p-5 space-y-4">
                {aiSubTab === 'framework' && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="text-xs text-gray-500 block mb-1">Engagement Type</label>
                        <select value={aiForm.engagement_type} onChange={e => setAiForm(f => ({ ...f, engagement_type: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm">
                          {ENGAGEMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select></div>
                      <div><label className="text-xs text-gray-500 block mb-1">Company Size</label>
                        <select value={aiForm.company_size} onChange={e => setAiForm(f => ({ ...f, company_size: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm">
                          {COMPANY_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select></div>
                    </div>
                    <div><label className="text-xs text-gray-500 block mb-1">Industry</label>
                      <input value={aiForm.industry} onChange={e => setAiForm(f => ({ ...f, industry: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" placeholder="e.g. retail, manufacturing, SaaS..." /></div>
                    <div><label className="text-xs text-gray-500 block mb-1">Primary Challenge</label>
                      <textarea value={aiForm.challenge} onChange={e => setAiForm(f => ({ ...f, challenge: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" rows={3} placeholder="Describe the client's main challenge..." /></div>
                  </>
                )}

                {aiSubTab === 'proposal' && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="text-xs text-gray-500 block mb-1">Client Name</label>
                        <input value={aiForm.client_name} onChange={e => setAiForm(f => ({ ...f, client_name: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" /></div>
                      <div><label className="text-xs text-gray-500 block mb-1">Company</label>
                        <input value={aiForm.company} onChange={e => setAiForm(f => ({ ...f, company: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" /></div>
                      <div><label className="text-xs text-gray-500 block mb-1">Engagement Type</label>
                        <select value={aiForm.engagement_type} onChange={e => setAiForm(f => ({ ...f, engagement_type: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm">
                          {ENGAGEMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select></div>
                      <div><label className="text-xs text-gray-500 block mb-1">Duration (weeks)</label>
                        <input type="number" value={aiForm.duration_weeks} onChange={e => setAiForm(f => ({ ...f, duration_weeks: parseInt(e.target.value) || 8 }))} className="w-full border rounded px-3 py-1.5 text-sm" /></div>
                      <div className="col-span-2"><label className="text-xs text-gray-500 block mb-1">Investment / Fee</label>
                        <input value={aiForm.fee} onChange={e => setAiForm(f => ({ ...f, fee: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" placeholder="e.g. $12,500 CAD" /></div>
                    </div>
                    <div><label className="text-xs text-gray-500 block mb-1">Primary Challenge</label>
                      <textarea value={aiForm.challenge} onChange={e => setAiForm(f => ({ ...f, challenge: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" rows={3} /></div>
                  </>
                )}

                {aiSubTab === 'agenda' && (
                  <>
                    <div><label className="text-xs text-gray-500 block mb-1">Engagement Type</label>
                      <select value={aiForm.engagement_type} onChange={e => setAiForm(f => ({ ...f, engagement_type: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm">
                        {ENGAGEMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select></div>
                    <div><label className="text-xs text-gray-500 block mb-1">Session Goals</label>
                      <textarea value={aiForm.session_goals} onChange={e => setAiForm(f => ({ ...f, session_goals: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" rows={3} placeholder="What should this session accomplish?" /></div>
                  </>
                )}

                {aiSubTab === 'swot' && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="text-xs text-gray-500 block mb-1">Company Name</label>
                        <input value={aiForm.company_name} onChange={e => setAiForm(f => ({ ...f, company_name: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" /></div>
                      <div><label className="text-xs text-gray-500 block mb-1">Industry</label>
                        <input value={aiForm.industry} onChange={e => setAiForm(f => ({ ...f, industry: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" /></div>
                    </div>
                    <div><label className="text-xs text-gray-500 block mb-1">Current Situation</label>
                      <textarea value={aiForm.situation} onChange={e => setAiForm(f => ({ ...f, situation: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" rows={3} placeholder="Brief description of the company's current situation, challenges, and context..." /></div>
                  </>
                )}

                <button onClick={runAI} disabled={aiLoading} className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
                  {aiLoading ? '⏳ Analyzing...' : '✨ Generate'}
                </button>

                {aiResult && (
                  <div className="relative">
                    <textarea value={aiResult} onChange={e => setAiResult(e.target.value)} className="w-full border rounded px-3 py-2 text-sm font-mono" rows={24} />
                    <button onClick={() => navigator.clipboard.writeText(aiResult)} className="absolute top-2 right-2 text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200">Copy</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 6: Revenue & Pipeline ── */}
        {tab === 'Revenue & Pipeline' && (
          <div className="space-y-6">
            {/* By engagement type */}
            <div className="bg-white rounded-lg border p-4">
              <h2 className="font-semibold text-slate-700 mb-3">Revenue by Engagement Type</h2>
              <table className="w-full text-sm">
                <thead className="bg-gray-50"><tr>{['Type', 'Engagements', 'Earned', 'Hours', 'Effective $/hr'].map(h => <th key={h} className="px-3 py-2 text-left text-xs text-gray-500">{h}</th>)}</tr></thead>
                <tbody className="divide-y">
                  {revenueData.by_type.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">No data.</td></tr>}
                  {revenueData.by_type.map(t => (
                    <tr key={t.engagement_type} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium">{etLabel(t.engagement_type)}</td>
                      <td className="px-3 py-2">{t.engagements}</td>
                      <td className="px-3 py-2 text-green-700">{fmtCurrencyFull(t.earned)}</td>
                      <td className="px-3 py-2">{Number(t.total_hours).toFixed(1)}</td>
                      <td className="px-3 py-2 text-gray-600">{t.total_hours > 0 && t.earned > 0 ? fmtCurrencyFull(t.earned / t.total_hours) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Retainer MRR */}
            <div className="bg-white rounded-lg border p-4">
              <h2 className="font-semibold text-slate-700 mb-3">Retainer Clients</h2>
              {revenueData.retainers.length === 0 ? <p className="text-gray-400 text-sm">No retainer clients.</p> : (
                <div className="space-y-2">
                  {revenueData.retainers.map(c => (
                    <div key={c.id} className="flex items-center justify-between p-3 bg-green-50 border border-green-100 rounded">
                      <div>
                        <p className="font-medium">{c.company_name ?? c.name}</p>
                        <p className="text-sm text-gray-500">{c.name} · {c.retainer_frequency}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-green-700">{fmtCurrencyFull(c.retainer_amount)}/{c.retainer_frequency === 'quarterly' ? 'qtr' : 'mo'}</p>
                        <p className="text-xs text-gray-500">MRR: {fmtCurrencyFull(Number((c as unknown as { monthly_value: number }).monthly_value))}</p>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 border-t font-semibold">
                    <span>Total MRR</span>
                    <span className="text-green-700">{fmtCurrencyFull(revenueData.retainers.reduce((sum, c) => sum + Number((c as unknown as { monthly_value: number }).monthly_value ?? 0), 0))}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Completed but uninvoiced */}
            <div className="bg-white rounded-lg border p-4">
              <h2 className="font-semibold text-slate-700 mb-3">Completed Engagements</h2>
              {revenueData.uninvoiced.length === 0 ? <p className="text-gray-400 text-sm">No completed engagements.</p> : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50"><tr>{['Client', 'Engagement', 'Type', 'Fee'].map(h => <th key={h} className="px-3 py-2 text-left text-xs text-gray-500">{h}</th>)}</tr></thead>
                  <tbody className="divide-y">
                    {revenueData.uninvoiced.map(e => (
                      <tr key={e.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2">{e.client_name}</td>
                        <td className="px-3 py-2 font-medium">{e.title}</td>
                        <td className="px-3 py-2">{etLabel(e.engagement_type)}</td>
                        <td className="px-3 py-2 text-green-700 font-medium">{fmtCurrencyFull(e.fee_amount)}</td>
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-bold text-lg">Add New Client</h2>
              <button onClick={() => setShowNewClient(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={submitClient} className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-gray-500 block mb-1">Contact Name *</label>
                  <input required value={cForm.name} onChange={e => setCForm(f => ({ ...f, name: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" /></div>
                <div><label className="text-xs text-gray-500 block mb-1">Company Name</label>
                  <input value={cForm.company_name} onChange={e => setCForm(f => ({ ...f, company_name: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" /></div>
                <div><label className="text-xs text-gray-500 block mb-1">Email</label>
                  <input type="email" value={cForm.email} onChange={e => setCForm(f => ({ ...f, email: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" /></div>
                <div><label className="text-xs text-gray-500 block mb-1">Phone</label>
                  <input value={cForm.phone} onChange={e => setCForm(f => ({ ...f, phone: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" /></div>
                <div><label className="text-xs text-gray-500 block mb-1">Industry</label>
                  <input value={cForm.industry} onChange={e => setCForm(f => ({ ...f, industry: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" /></div>
                <div><label className="text-xs text-gray-500 block mb-1">Company Size</label>
                  <select value={cForm.company_size} onChange={e => setCForm(f => ({ ...f, company_size: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm">
                    <option value="">— Select —</option>
                    {COMPANY_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select></div>
                <div><label className="text-xs text-gray-500 block mb-1">Business Stage</label>
                  <select value={cForm.business_stage} onChange={e => setCForm(f => ({ ...f, business_stage: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm">
                    <option value="">— Select —</option>
                    {BUSINESS_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select></div>
                <div><label className="text-xs text-gray-500 block mb-1">Status</label>
                  <select value={cForm.status} onChange={e => setCForm(f => ({ ...f, status: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm">
                    {CLIENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select></div>
                <div><label className="text-xs text-gray-500 block mb-1">Annual Revenue (CAD)</label>
                  <input type="number" step="1000" value={cForm.annual_revenue} onChange={e => setCForm(f => ({ ...f, annual_revenue: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" /></div>
                <div><label className="text-xs text-gray-500 block mb-1">Hourly Rate (CAD)</label>
                  <input type="number" step="0.01" value={cForm.hourly_rate} onChange={e => setCForm(f => ({ ...f, hourly_rate: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" /></div>
                <div><label className="text-xs text-gray-500 block mb-1">Retainer Amount (CAD)</label>
                  <input type="number" step="0.01" value={cForm.retainer_amount} onChange={e => setCForm(f => ({ ...f, retainer_amount: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" /></div>
                <div><label className="text-xs text-gray-500 block mb-1">Retainer Frequency</label>
                  <select value={cForm.retainer_frequency} onChange={e => setCForm(f => ({ ...f, retainer_frequency: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm">
                    <option value="monthly">monthly</option>
                    <option value="quarterly">quarterly</option>
                  </select></div>
                <div><label className="text-xs text-gray-500 block mb-1">City</label>
                  <input value={cForm.city} onChange={e => setCForm(f => ({ ...f, city: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" /></div>
                <div><label className="text-xs text-gray-500 block mb-1">Province</label>
                  <input value={cForm.province} onChange={e => setCForm(f => ({ ...f, province: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" /></div>
                <div><label className="text-xs text-gray-500 block mb-1">Source</label>
                  <input value={cForm.source} onChange={e => setCForm(f => ({ ...f, source: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" /></div>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-2">Advisory Services Needed</label>
                <div className="flex flex-wrap gap-2">
                  {ENGAGEMENT_TYPES.map(t => (
                    <button key={t.value} type="button" onClick={() => toggleAdvisoryType(t.value)}
                      className={`text-xs px-3 py-1 rounded-full border ${cForm.advisory_type.includes(t.value) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div><label className="text-xs text-gray-500 block mb-1">Primary Challenge</label>
                <textarea value={cForm.primary_challenge} onChange={e => setCForm(f => ({ ...f, primary_challenge: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" rows={2} /></div>
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

      {/* ── Modal: New Engagement ── */}
      {showNewEng && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-bold text-lg">New Engagement</h2>
              <button onClick={() => setShowNewEng(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={submitEngagement} className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><label className="text-xs text-gray-500 block mb-1">Title *</label>
                  <input required value={eForm.title} onChange={e => setEForm(f => ({ ...f, title: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" placeholder="Engagement title" /></div>
                <div><label className="text-xs text-gray-500 block mb-1">Client</label>
                  <select value={eForm.client_id} onChange={e => setEForm(f => ({ ...f, client_id: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm">
                    <option value="">— No client —</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.company_name ?? c.name}</option>)}
                  </select></div>
                <div><label className="text-xs text-gray-500 block mb-1">Type *</label>
                  <select required value={eForm.engagement_type} onChange={e => setEForm(f => ({ ...f, engagement_type: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm">
                    {ENGAGEMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select></div>
                <div><label className="text-xs text-gray-500 block mb-1">Status</label>
                  <select value={eForm.status} onChange={e => setEForm(f => ({ ...f, status: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm">
                    {ENGAGEMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select></div>
                <div><label className="text-xs text-gray-500 block mb-1">Fee Type</label>
                  <select value={eForm.fee_type} onChange={e => setEForm(f => ({ ...f, fee_type: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm">
                    {FEE_TYPES.map(f => <option key={f} value={f}>{f.replace('_',' ')}</option>)}
                  </select></div>
                <div><label className="text-xs text-gray-500 block mb-1">Fee Amount (CAD)</label>
                  <input type="number" step="0.01" value={eForm.fee_amount} onChange={e => setEForm(f => ({ ...f, fee_amount: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" /></div>
                <div><label className="text-xs text-gray-500 block mb-1">Hours Estimated</label>
                  <input type="number" value={eForm.hours_estimated} onChange={e => setEForm(f => ({ ...f, hours_estimated: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" /></div>
                <div><label className="text-xs text-gray-500 block mb-1">Start Date</label>
                  <input type="date" value={eForm.start_date} onChange={e => setEForm(f => ({ ...f, start_date: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" /></div>
                <div><label className="text-xs text-gray-500 block mb-1">End Date</label>
                  <input type="date" value={eForm.end_date} onChange={e => setEForm(f => ({ ...f, end_date: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" /></div>
              </div>
              <div><label className="text-xs text-gray-500 block mb-1">Objectives</label>
                <textarea value={eForm.objectives} onChange={e => setEForm(f => ({ ...f, objectives: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" rows={2} /></div>
              <div><label className="text-xs text-gray-500 block mb-1">Expected Outcomes</label>
                <textarea value={eForm.expected_outcomes} onChange={e => setEForm(f => ({ ...f, expected_outcomes: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" rows={2} /></div>
              <div><label className="text-xs text-gray-500 block mb-1">Deliverables (one per line)</label>
                <textarea value={eForm.deliverables} onChange={e => setEForm(f => ({ ...f, deliverables: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm font-mono" rows={4} placeholder="Current state assessment&#10;Gap analysis report&#10;Recommendations deck&#10;Implementation roadmap" /></div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 py-2 bg-slate-800 text-white rounded hover:bg-slate-700 text-sm font-medium">Create Engagement</button>
                <button type="button" onClick={() => setShowNewEng(false)} className="px-4 py-2 border rounded text-sm">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Log Session ── */}
      {showLogSession && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-bold">Log Session</h2>
              <button onClick={() => setShowLogSession(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={submitSession} className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-gray-500 block mb-1">Session Date *</label>
                  <input required type="datetime-local" value={sForm.session_date} onChange={e => setSForm(f => ({ ...f, session_date: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" /></div>
                <div><label className="text-xs text-gray-500 block mb-1">Duration (min)</label>
                  <input type="number" value={sForm.duration_minutes} onChange={e => setSForm(f => ({ ...f, duration_minutes: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" /></div>
                <div><label className="text-xs text-gray-500 block mb-1">Session Type</label>
                  <select value={sForm.session_type} onChange={e => setSForm(f => ({ ...f, session_type: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm">
                    {SESSION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select></div>
                <div><label className="text-xs text-gray-500 block mb-1">Next Session</label>
                  <input type="datetime-local" value={sForm.next_session_date} onChange={e => setSForm(f => ({ ...f, next_session_date: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" /></div>
              </div>
              <div><label className="text-xs text-gray-500 block mb-1">Agenda</label>
                <textarea value={sForm.agenda} onChange={e => setSForm(f => ({ ...f, agenda: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" rows={2} /></div>
              <div><label className="text-xs text-gray-500 block mb-1">Notes</label>
                <textarea value={sForm.notes} onChange={e => setSForm(f => ({ ...f, notes: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" rows={3} /></div>
              <div><label className="text-xs text-gray-500 block mb-1">Action Items (one per line)</label>
                <textarea value={sForm.action_items} onChange={e => setSForm(f => ({ ...f, action_items: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm font-mono" rows={4} placeholder="Schedule follow-up call with CFO&#10;Send revised financial model by Friday&#10;Review competitor pricing strategy" /></div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 py-2 bg-slate-800 text-white rounded hover:bg-slate-700 text-sm font-medium">Log Session</button>
                <button type="button" onClick={() => setShowLogSession(false)} className="px-4 py-2 border rounded text-sm">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: New Deliverable ── */}
      {showNewDeliverable && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-bold">Add Deliverable</h2>
              <button onClick={() => setShowNewDeliverable(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={submitDeliverable} className="p-5 space-y-3">
              <div><label className="text-xs text-gray-500 block mb-1">Title *</label>
                <input required value={dForm.title} onChange={e => setDForm(f => ({ ...f, title: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" /></div>
              <div><label className="text-xs text-gray-500 block mb-1">Description</label>
                <textarea value={dForm.description} onChange={e => setDForm(f => ({ ...f, description: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" rows={2} /></div>
              <div><label className="text-xs text-gray-500 block mb-1">Due Date</label>
                <input type="date" value={dForm.due_date} onChange={e => setDForm(f => ({ ...f, due_date: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" /></div>
              <div><label className="text-xs text-gray-500 block mb-1">Notes</label>
                <textarea value={dForm.notes} onChange={e => setDForm(f => ({ ...f, notes: e.target.value }))} className="w-full border rounded px-3 py-1.5 text-sm" rows={2} /></div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 py-2 bg-slate-800 text-white rounded hover:bg-slate-700 text-sm font-medium">Add Deliverable</button>
                <button type="button" onClick={() => setShowNewDeliverable(false)} className="px-4 py-2 border rounded text-sm">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
