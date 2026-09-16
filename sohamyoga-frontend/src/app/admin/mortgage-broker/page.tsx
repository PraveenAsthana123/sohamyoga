'use client';
import { useEffect, useState, useCallback } from 'react';

// ─── Lender Data ─────────────────────────────────────────────────────────────
const LENDERS = {
  banks: ['RBC', 'TD', 'BMO', 'Scotiabank', 'CIBC', 'National Bank', 'ATB Financial', 'Servus CU'],
  monoline: ['First National', 'MCAP', 'Merix', 'Radius Financial', 'CMLS Financial', 'Community Trust', 'Lendwise'],
  alt_b: ['Home Trust', 'Equitable Bank', 'Haventree Bank', 'Bridgewater Bank', 'ICICI Bank Canada'],
  private: ['Private MIC', 'Private Investor', 'Other Private'],
};
const ALL_LENDERS = [...LENDERS.banks, ...LENDERS.monoline, ...LENDERS.alt_b, ...LENDERS.private];

// ─── Types ────────────────────────────────────────────────────────────────────
type Stats = {
  clients: { total: string; active: string; pre_approved: string };
  applications: { draft: string; submitted: string; approved: string; funded: string; pipeline_value: string; funded_this_month: string };
  avg_rate: string | null;
  top_lenders: { lender: string; count: string }[];
};

type MClient = {
  id: number; name: string; email: string | null; phone: string | null;
  city: string; province: string; employment_type: string | null;
  annual_income: string | null; credit_score: number | null; credit_tier: string | null;
  status: string; source: string | null; broker_notes: string | null;
  application_count: string; created_at: string;
};

type Application = {
  id: number; client_id: number; client_name: string; credit_tier: string | null;
  application_type: string; property_type: string | null; property_address: string | null;
  property_city: string; purchase_price: string | null; mortgage_amount: string | null;
  down_payment_pct: string | null; cmhc_insured: boolean; cmhc_premium: string | null;
  rate_type: string; lender: string | null; lender_rate: string | null;
  amortization_years: number; term_years: number; payment_frequency: string;
  status: string; closing_date: string | null; broker_fee: string | null;
  created_at: string; submissions: Submission[] | null;
};

type Submission = {
  id: number; application_id: number; lender: string; submitted_at: string | null;
  rate_offered: string | null; status: string; decision_date: string | null; notes: string | null;
};

type CalcResult = {
  mortgage_amount: number; cmhc_insured: boolean; cmhc_premium: number;
  payment: number; total_cost: number; total_interest: number;
  gds_ratio: number | null; tds_ratio: number | null;
  gds_pass: boolean | null; tds_pass: boolean | null;
  schedule_first_12: { period: number; payment: number; principal: number; interest: number; balance: number }[];
  inputs: { frequency: string; rate: number; amortization_years: number; down_pct: number };
};

// ─── Constants ────────────────────────────────────────────────────────────────
const TABS = ['dashboard', 'clients', 'applications', 'lender-comparison', 'calculator', 'pipeline'] as const;
type Tab = typeof TABS[number];

const STATUS_COLORS: Record<string, string> = {
  prospect: 'bg-gray-100 text-gray-700',
  pre_approved: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  funded: 'bg-emerald-100 text-emerald-700',
  declined: 'bg-red-100 text-red-700',
  closed: 'bg-gray-200 text-gray-500',
  draft: 'bg-gray-100 text-gray-600',
  submitted: 'bg-blue-100 text-blue-700',
  conditionally_approved: 'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-red-100 text-red-600',
};

const TIER_COLORS: Record<string, string> = {
  A: 'bg-green-100 text-green-700',
  B: 'bg-yellow-100 text-yellow-700',
  C: 'bg-orange-100 text-orange-700',
  private: 'bg-red-100 text-red-700',
};

function fmt$(v: string | number | null | undefined) {
  const n = Number(v ?? 0);
  return isNaN(n) ? '$0' : `$${n.toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
function fmt$2(v: string | number | null | undefined) {
  const n = Number(v ?? 0);
  return isNaN(n) ? '$0.00' : `$${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtRate(v: string | number | null | undefined) {
  const n = Number(v ?? 0);
  return isNaN(n) ? '—' : `${n.toFixed(2)}%`;
}
function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${colorClass}`}>{label}</span>;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MortgageBrokerPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [stats, setStats] = useState<Stats | null>(null);
  const [clients, setClients] = useState<MClient[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Modals
  const [showAddClient, setShowAddClient] = useState(false);
  const [showAddApp, setShowAddApp] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState<Application | null>(null);

  // Filters
  const [clientSearch, setClientSearch] = useState('');
  const [appStatusFilter, setAppStatusFilter] = useState('');
  const [appTypeFilter, setAppTypeFilter] = useState('');

  // Lender comparison
  const [compareApp, setCompareApp] = useState<Application | null>(null);
  const [compareAdvice, setCompareAdvice] = useState('');
  const [compareLoading, setCompareLoading] = useState(false);

  // Calculator state
  const [calc, setCalc] = useState({ price: '', down_payment: '', rate: '', amortization: '25', frequency: 'monthly', annual_income: '', monthly_obligations: '' });
  const [calcResult, setCalcResult] = useState<CalcResult | null>(null);
  const [calcLoading, setCalcLoading] = useState(false);

  // Add client form
  const [newClient, setNewClient] = useState({ name: '', email: '', phone: '', city: 'Calgary', province: 'AB', employment_type: 'employed', annual_income: '', credit_score: '', credit_tier: 'A', status: 'prospect', source: '', broker_notes: '' });

  // Add application form
  const [newApp, setNewApp] = useState({ client_id: '', application_type: 'purchase', property_type: 'detached', property_address: '', property_city: 'Calgary', property_province: 'AB', purchase_price: '', down_payment: '', rate_type: 'fixed', requested_rate: '', amortization_years: '25', term_years: '5', payment_frequency: 'monthly', lender: '', closing_date: '' });

  const loadStats = useCallback(async () => {
    const r = await fetch('/api/admin/mortgage-broker');
    if (r.ok) setStats(await r.json());
  }, []);

  const loadClients = useCallback(async () => {
    const params = new URLSearchParams();
    if (clientSearch) params.set('search', clientSearch);
    const r = await fetch(`/api/admin/mortgage-broker/clients?${params}`);
    if (r.ok) { const d = await r.json(); setClients(d.clients); }
  }, [clientSearch]);

  const loadApplications = useCallback(async () => {
    const params = new URLSearchParams();
    if (appStatusFilter) params.set('status', appStatusFilter);
    if (appTypeFilter) params.set('application_type', appTypeFilter);
    const r = await fetch(`/api/admin/mortgage-broker/applications?${params}`);
    if (r.ok) { const d = await r.json(); setApplications(d.applications); }
  }, [appStatusFilter, appTypeFilter]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { if (tab === 'clients') loadClients(); }, [tab, loadClients]);
  useEffect(() => { if (tab === 'applications' || tab === 'pipeline' || tab === 'lender-comparison') loadApplications(); }, [tab, loadApplications]);

  const saveClient = async () => {
    if (!newClient.name.trim()) { setError('Name required'); return; }
    setLoading(true);
    const r = await fetch('/api/admin/mortgage-broker/clients', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newClient),
    });
    setLoading(false);
    if (r.ok) { setShowAddClient(false); setNewClient({ name: '', email: '', phone: '', city: 'Calgary', province: 'AB', employment_type: 'employed', annual_income: '', credit_score: '', credit_tier: 'A', status: 'prospect', source: '', broker_notes: '' }); loadClients(); loadStats(); }
    else { const d = await r.json(); setError(d.error || 'Failed to save client'); }
  };

  const saveApp = async () => {
    if (!newApp.client_id || !newApp.application_type) { setError('Client and application type required'); return; }
    setLoading(true);
    const mortgage = newApp.purchase_price && newApp.down_payment
      ? String(Number(newApp.purchase_price) - Number(newApp.down_payment))
      : '';
    const r = await fetch('/api/admin/mortgage-broker/applications', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newApp, mortgage_amount: mortgage }),
    });
    setLoading(false);
    if (r.ok) { setShowAddApp(false); loadApplications(); loadStats(); }
    else { const d = await r.json(); setError(d.error || 'Failed to save application'); }
  };

  const submitToLender = async (app: Application, lender: string) => {
    const r = await fetch(`/api/admin/mortgage-broker/applications/${app.id}/submit`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lender }),
    });
    if (r.ok) { loadApplications(); setShowSubmitModal(null); }
  };

  const runLenderCompare = async () => {
    if (!compareApp) return;
    setCompareLoading(true);
    const r = await fetch('/api/admin/mortgage-broker/lender-compare', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mortgage_amount: compareApp.mortgage_amount,
        amortization: compareApp.amortization_years,
        credit_tier: compareApp.credit_tier || 'A',
        down_payment_pct: compareApp.down_payment_pct,
      }),
    });
    if (r.ok) { const d = await r.json(); setCompareAdvice(d.advice); }
    setCompareLoading(false);
  };

  const runCalculator = async () => {
    if (!calc.price || !calc.rate || !calc.amortization) { setError('Price, rate, and amortization required'); return; }
    setCalcLoading(true);
    const r = await fetch('/api/admin/mortgage-broker/calculator', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(calc),
    });
    if (r.ok) { const d = await r.json(); setCalcResult(d); }
    else { const d = await r.json(); setError(d.error || 'Calculation failed'); }
    setCalcLoading(false);
  };

  const freqLabel: Record<string, string> = { monthly: 'Monthly', bi_weekly: 'Bi-Weekly', accelerated_bi_weekly: 'Accel. Bi-Weekly', weekly: 'Weekly' };

  const kanbanStatuses = ['draft', 'submitted', 'conditionally_approved', 'approved', 'funded'];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-slate-800 text-white px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold">Mortgage Broker Hub</h1>
          <p className="text-slate-300 text-sm mt-1">Canadian Mortgage CRM — All Major Lenders</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="max-w-7xl mx-auto flex gap-1 overflow-x-auto">
          {TABS.map(t => (
            <button key={t} onClick={() => { setTab(t); setError(''); }}
              className={`px-4 py-3 text-sm font-medium capitalize whitespace-nowrap border-b-2 transition-colors ${tab === t ? 'border-slate-700 text-slate-800' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t.replace(/-/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="max-w-7xl mx-auto px-6 mt-4">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm flex justify-between">
            {error}<button onClick={() => setError('')} className="font-bold">×</button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-6">

        {/* ── Dashboard ── */}
        {tab === 'dashboard' && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="text-slate-500 text-xs font-medium uppercase tracking-wide">Pipeline Value</div>
                <div className="text-2xl font-bold text-slate-800 mt-1">{fmt$(stats.applications.pipeline_value)}</div>
                <div className="text-xs text-gray-400 mt-1">Active applications</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="text-slate-500 text-xs font-medium uppercase tracking-wide">Funded This Month</div>
                <div className="text-2xl font-bold text-emerald-700 mt-1">{fmt$(stats.applications.funded_this_month)}</div>
                <div className="text-xs text-gray-400 mt-1">{stats.applications.funded} total funded</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="text-slate-500 text-xs font-medium uppercase tracking-wide">Avg Rate Secured</div>
                <div className="text-2xl font-bold text-slate-800 mt-1">{stats.avg_rate ? fmtRate(stats.avg_rate) : '—'}</div>
                <div className="text-xs text-gray-400 mt-1">Across funded deals</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="text-slate-500 text-xs font-medium uppercase tracking-wide">Active Clients</div>
                <div className="text-2xl font-bold text-slate-800 mt-1">{stats.clients.active}</div>
                <div className="text-xs text-gray-400 mt-1">{stats.clients.pre_approved} pre-approved</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Application Pipeline */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="font-semibold text-slate-700 mb-3">Application Pipeline</h2>
                {[
                  { label: 'Draft', count: stats.applications.draft, color: 'bg-gray-400' },
                  { label: 'Submitted', count: stats.applications.submitted, color: 'bg-blue-500' },
                  { label: 'Approved', count: stats.applications.approved, color: 'bg-yellow-500' },
                  { label: 'Funded', count: stats.applications.funded, color: 'bg-emerald-500' },
                ].map(({ label, count, color }) => (
                  <div key={label} className="flex items-center gap-3 mb-2">
                    <div className="w-28 text-sm text-gray-600">{label}</div>
                    <div className="flex-1 bg-gray-100 rounded h-5 overflow-hidden">
                      <div className={`h-5 ${color} rounded`} style={{ width: `${Math.min(100, Number(count) * 15)}%` }} />
                    </div>
                    <div className="w-8 text-sm font-semibold text-gray-700 text-right">{count}</div>
                  </div>
                ))}
              </div>

              {/* Top Lenders */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="font-semibold text-slate-700 mb-3">Top Lenders (Approved/Funded)</h2>
                {stats.top_lenders.length === 0 ? (
                  <p className="text-gray-400 text-sm">No funded deals yet</p>
                ) : stats.top_lenders.map((l) => (
                  <div key={l.lender} className="flex items-center gap-3 mb-2">
                    <div className="flex-1 text-sm text-gray-700">{l.lender}</div>
                    <div className="w-8 text-sm font-semibold text-gray-700 text-right">{l.count}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Clients ── */}
        {tab === 'clients' && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <input value={clientSearch} onChange={e => setClientSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadClients()} placeholder="Search name, email, phone…" className="border border-gray-300 rounded px-3 py-2 text-sm flex-1 max-w-xs" />
              <button onClick={loadClients} className="px-4 py-2 bg-slate-700 text-white rounded text-sm">Search</button>
              <button onClick={() => setShowAddClient(true)} className="ml-auto px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium">+ Add Client</button>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['Name', 'Contact', 'Employment', 'Income', 'Credit', 'Score', 'Status', 'Apps', 'Added'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {clients.map(c => (
                    <tr key={c.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{c.name}</td>
                      <td className="px-4 py-3 text-gray-500">
                        <div>{c.email}</div>
                        <div>{c.phone}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{c.employment_type?.replace('_', ' ') ?? '—'}</td>
                      <td className="px-4 py-3">{c.annual_income ? fmt$(c.annual_income) : '—'}</td>
                      <td className="px-4 py-3">{c.credit_tier ? <Badge label={`Tier ${c.credit_tier}`} colorClass={TIER_COLORS[c.credit_tier] ?? 'bg-gray-100 text-gray-700'} /> : '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{c.credit_score ?? '—'}</td>
                      <td className="px-4 py-3"><Badge label={c.status} colorClass={STATUS_COLORS[c.status] ?? 'bg-gray-100 text-gray-600'} /></td>
                      <td className="px-4 py-3 text-center">{c.application_count}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{new Date(c.created_at).toLocaleDateString('en-CA')}</td>
                    </tr>
                  ))}
                  {clients.length === 0 && (
                    <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No clients yet — add your first client</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Applications ── */}
        {tab === 'applications' && (
          <div>
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <select value={appStatusFilter} onChange={e => setAppStatusFilter(e.target.value)} className="border border-gray-300 rounded px-3 py-2 text-sm">
                <option value="">All Statuses</option>
                {['draft','submitted','conditionally_approved','approved','funded','declined','cancelled'].map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
              </select>
              <select value={appTypeFilter} onChange={e => setAppTypeFilter(e.target.value)} className="border border-gray-300 rounded px-3 py-2 text-sm">
                <option value="">All Types</option>
                {['purchase','refinance','renewal','heloc','construction','bridge','reverse'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <button onClick={loadApplications} className="px-4 py-2 bg-slate-700 text-white rounded text-sm">Filter</button>
              <button onClick={() => setShowAddApp(true)} className="ml-auto px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium">+ Add Application</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {applications.map(app => (
                <div key={app.id} className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-semibold text-slate-800">{app.client_name}</div>
                      <div className="text-xs text-gray-400">{app.application_type} · {app.property_type ?? '—'}</div>
                    </div>
                    <Badge label={app.status.replace(/_/g,' ')} colorClass={STATUS_COLORS[app.status] ?? 'bg-gray-100 text-gray-600'} />
                  </div>
                  {app.property_address && <div className="text-xs text-gray-500 mb-2">{app.property_address}, {app.property_city}</div>}
                  <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                    <div><span className="text-gray-400">Mortgage</span><br /><span className="font-semibold">{fmt$(app.mortgage_amount)}</span></div>
                    <div><span className="text-gray-400">Lender</span><br /><span className="font-semibold">{app.lender ?? '—'}</span></div>
                    <div><span className="text-gray-400">Rate</span><br /><span className="font-semibold">{app.lender_rate ? fmtRate(app.lender_rate) : '—'} ({app.rate_type})</span></div>
                    <div><span className="text-gray-400">Credit</span><br /><span className="font-semibold">{app.credit_tier ? <Badge label={`Tier ${app.credit_tier}`} colorClass={TIER_COLORS[app.credit_tier] ?? ''} /> : '—'}</span></div>
                  </div>
                  {app.cmhc_insured && <div className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded mb-2">CMHC Insured — Premium: {fmt$(app.cmhc_premium)}</div>}
                  {app.submissions && app.submissions.length > 0 && (
                    <div className="text-xs text-gray-500 mb-2">{app.submissions.length} lender submission(s)</div>
                  )}
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => setShowSubmitModal(app)} className="px-3 py-1.5 bg-slate-700 text-white rounded text-xs">Submit to Lender</button>
                  </div>
                </div>
              ))}
              {applications.length === 0 && (
                <div className="col-span-3 text-center py-12 text-gray-400">No applications — add your first one</div>
              )}
            </div>
          </div>
        )}

        {/* ── Lender Comparison ── */}
        {tab === 'lender-comparison' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-slate-700 mb-3">Select Application for Lender Comparison</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Application</label>
                  <select value={compareApp?.id ?? ''} onChange={e => setCompareApp(applications.find(a => a.id === Number(e.target.value)) ?? null)} className="border border-gray-300 rounded px-3 py-2 text-sm w-full">
                    <option value="">Select application…</option>
                    {applications.map(a => <option key={a.id} value={a.id}>{a.client_name} — {fmt$(a.mortgage_amount)} ({a.application_type})</option>)}
                  </select>
                </div>
                <div className="md:col-span-2 flex items-end">
                  <button onClick={runLenderCompare} disabled={!compareApp || compareLoading} className="px-5 py-2 bg-slate-700 text-white rounded text-sm disabled:opacity-50">
                    {compareLoading ? 'Generating AI Advice…' : 'Get AI Lender Comparison'}
                  </button>
                </div>
              </div>
            </div>

            {compareApp && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="font-semibold text-slate-700 mb-3">Submitted Lenders — {compareApp.client_name}</h2>
                {compareApp.submissions && compareApp.submissions.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        {['Lender','Status','Rate Offered','Submitted','Decision','Notes'].map(h => (
                          <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {compareApp.submissions.map(s => (
                        <tr key={s.id} className="border-b hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium">{s.lender}</td>
                          <td className="px-3 py-2"><Badge label={s.status} colorClass={STATUS_COLORS[s.status] ?? 'bg-gray-100 text-gray-600'} /></td>
                          <td className="px-3 py-2">{s.rate_offered ? fmtRate(s.rate_offered) : '—'}</td>
                          <td className="px-3 py-2 text-gray-400 text-xs">{s.submitted_at ? new Date(s.submitted_at).toLocaleDateString('en-CA') : '—'}</td>
                          <td className="px-3 py-2 text-gray-400 text-xs">{s.decision_date ? new Date(s.decision_date).toLocaleDateString('en-CA') : '—'}</td>
                          <td className="px-3 py-2 text-gray-500">{s.notes ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : <p className="text-gray-400 text-sm">No lender submissions yet for this application.</p>}
              </div>
            )}

            {compareAdvice && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="font-semibold text-slate-700 mb-3">AI Lender Comparison Advice</h2>
                <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{compareAdvice}</div>
              </div>
            )}

            {/* Lender Category Reference */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-slate-700 mb-3">Canadian Lender Categories</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(LENDERS).map(([cat, list]) => (
                  <div key={cat} className="border border-gray-100 rounded-lg p-4">
                    <div className="font-medium text-slate-700 capitalize mb-2">{cat.replace('_', '-')} Lenders</div>
                    <div className="flex flex-wrap gap-1">
                      {list.map(l => <span key={l} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">{l}</span>)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Calculator ── */}
        {tab === 'calculator' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-slate-700 mb-4">Mortgage Calculator</h2>
              <div className="space-y-3">
                {[
                  { label: 'Purchase Price ($)', key: 'price', placeholder: '500000' },
                  { label: 'Down Payment ($)', key: 'down_payment', placeholder: '100000' },
                  { label: 'Annual Rate (%)', key: 'rate', placeholder: '5.25' },
                  { label: 'Amortization (years)', key: 'amortization', placeholder: '25' },
                  { label: 'Annual Income ($) — for GDS/TDS', key: 'annual_income', placeholder: '100000' },
                  { label: 'Monthly Obligations ($) — for TDS', key: 'monthly_obligations', placeholder: '500' },
                ].map(({ label, key, placeholder }) => (
                  <div key={key}>
                    <label className="text-xs text-gray-500 block mb-1">{label}</label>
                    <input value={calc[key as keyof typeof calc]} onChange={e => setCalc(p => ({ ...p, [key]: e.target.value }))}
                      placeholder={placeholder} className="border border-gray-300 rounded px-3 py-2 text-sm w-full" />
                  </div>
                ))}
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Payment Frequency</label>
                  <select value={calc.frequency} onChange={e => setCalc(p => ({ ...p, frequency: e.target.value }))} className="border border-gray-300 rounded px-3 py-2 text-sm w-full">
                    <option value="monthly">Monthly</option>
                    <option value="bi_weekly">Bi-Weekly</option>
                    <option value="accelerated_bi_weekly">Accelerated Bi-Weekly</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
                <button onClick={runCalculator} disabled={calcLoading} className="w-full py-2.5 bg-slate-700 text-white rounded text-sm font-medium mt-2">
                  {calcLoading ? 'Calculating…' : 'Calculate'}
                </button>
              </div>
            </div>

            {calcResult && (
              <div className="space-y-4">
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h2 className="font-semibold text-slate-700 mb-3">Results</h2>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm"><span className="text-gray-500">Mortgage Amount</span><span className="font-semibold">{fmt$2(calcResult.mortgage_amount)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-500">{freqLabel[calcResult.inputs.frequency]} Payment</span><span className="font-bold text-xl text-slate-800">{fmt$2(calcResult.payment)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-500">Total Interest</span><span className="font-semibold text-orange-600">{fmt$2(calcResult.total_interest)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-500">Total Cost</span><span className="font-semibold">{fmt$2(calcResult.total_cost)}</span></div>
                    {calcResult.cmhc_insured && (
                      <div className="bg-blue-50 rounded p-2 text-xs text-blue-700">CMHC Premium: {fmt$2(calcResult.cmhc_premium)} (added to mortgage)</div>
                    )}
                    {calcResult.gds_ratio !== null && (
                      <>
                        <div className="border-t pt-2 mt-2">
                          <div className="flex justify-between text-sm"><span className="text-gray-500">GDS Ratio</span>
                            <span className={`font-semibold ${calcResult.gds_pass ? 'text-green-600' : 'text-red-600'}`}>{calcResult.gds_ratio?.toFixed(1)}% {calcResult.gds_pass ? '✓' : '✗ (max 39%)'}</span>
                          </div>
                          <div className="flex justify-between text-sm mt-1"><span className="text-gray-500">TDS Ratio</span>
                            <span className={`font-semibold ${calcResult.tds_pass ? 'text-green-600' : 'text-red-600'}`}>{calcResult.tds_ratio?.toFixed(1)}% {calcResult.tds_pass ? '✓' : '✗ (max 44%)'}</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h2 className="font-semibold text-slate-700 mb-3">First 12 Payments</h2>
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50"><tr>
                      {['#','Payment','Principal','Interest','Balance'].map(h => <th key={h} className="px-2 py-1.5 text-left text-gray-500">{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {calcResult.schedule_first_12.map(r => (
                        <tr key={r.period} className="border-b">
                          <td className="px-2 py-1.5">{r.period}</td>
                          <td className="px-2 py-1.5">{fmt$2(r.payment)}</td>
                          <td className="px-2 py-1.5 text-green-700">{fmt$2(r.principal)}</td>
                          <td className="px-2 py-1.5 text-orange-600">{fmt$2(r.interest)}</td>
                          <td className="px-2 py-1.5 font-medium">{fmt$2(r.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Pipeline Kanban ── */}
        {tab === 'pipeline' && (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {kanbanStatuses.map(status => {
              const cols = applications.filter(a => a.status === status);
              const total = cols.reduce((s, a) => s + Number(a.mortgage_amount ?? 0), 0);
              return (
                <div key={status} className="flex-shrink-0 w-64">
                  <div className="bg-gray-100 rounded-t-lg px-3 py-2 flex justify-between items-center">
                    <span className="font-semibold text-sm text-slate-700 capitalize">{status.replace(/_/g,' ')}</span>
                    <Badge label={String(cols.length)} colorClass={STATUS_COLORS[status] ?? 'bg-gray-200 text-gray-700'} />
                  </div>
                  {total > 0 && <div className="bg-gray-50 px-3 py-1 text-xs text-gray-500 border-x border-gray-200">{fmt$(total)}</div>}
                  <div className="space-y-2 bg-gray-50 border border-gray-200 rounded-b-lg p-2 min-h-32">
                    {cols.map(app => (
                      <div key={app.id} className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
                        <div className="font-medium text-sm text-slate-800">{app.client_name}</div>
                        <div className="text-xs text-gray-500">{app.application_type}</div>
                        <div className="font-semibold text-sm text-slate-700 mt-1">{fmt$(app.mortgage_amount)}</div>
                        {app.lender && <div className="text-xs text-gray-400">{app.lender}</div>}
                        {app.lender_rate && <div className="text-xs text-blue-600">{fmtRate(app.lender_rate)} {app.rate_type}</div>}
                        {app.closing_date && <div className="text-xs text-gray-400 mt-1">Close: {new Date(app.closing_date).toLocaleDateString('en-CA')}</div>}
                      </div>
                    ))}
                    {cols.length === 0 && <p className="text-xs text-gray-300 text-center py-4">Empty</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Add Client Modal ── */}
      {showAddClient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-screen overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-slate-800">Add Mortgage Client</h2>
              <button onClick={() => setShowAddClient(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Full Name *', key: 'name', type: 'text' },
                { label: 'Email', key: 'email', type: 'email' },
                { label: 'Phone', key: 'phone', type: 'tel' },
                { label: 'City', key: 'city', type: 'text' },
                { label: 'Annual Income ($)', key: 'annual_income', type: 'number' },
                { label: 'Credit Score', key: 'credit_score', type: 'number' },
                { label: 'Source', key: 'source', type: 'text' },
              ].map(({ label, key, type }) => (
                <div key={key}>
                  <label className="text-xs text-gray-500 block mb-1">{label}</label>
                  <input type={type} value={newClient[key as keyof typeof newClient]} onChange={e => setNewClient(p => ({ ...p, [key]: e.target.value }))}
                    className="border border-gray-300 rounded px-3 py-2 text-sm w-full" />
                </div>
              ))}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Province</label>
                <select value={newClient.province} onChange={e => setNewClient(p => ({ ...p, province: e.target.value }))} className="border border-gray-300 rounded px-3 py-2 text-sm w-full">
                  {['AB','BC','ON','QC','SK','MB','NS','NB','NL','PE','NT','NU','YT'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Employment Type</label>
                <select value={newClient.employment_type} onChange={e => setNewClient(p => ({ ...p, employment_type: e.target.value }))} className="border border-gray-300 rounded px-3 py-2 text-sm w-full">
                  {['employed','self_employed','contract','retired','student'].map(v => <option key={v} value={v}>{v.replace('_',' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Credit Tier</label>
                <select value={newClient.credit_tier} onChange={e => setNewClient(p => ({ ...p, credit_tier: e.target.value }))} className="border border-gray-300 rounded px-3 py-2 text-sm w-full">
                  {['A','B','C','private'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Status</label>
                <select value={newClient.status} onChange={e => setNewClient(p => ({ ...p, status: e.target.value }))} className="border border-gray-300 rounded px-3 py-2 text-sm w-full">
                  {['prospect','pre_approved','approved','funded','declined','closed'].map(v => <option key={v} value={v}>{v.replace(/_/g,' ')}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-500 block mb-1">Broker Notes</label>
                <textarea value={newClient.broker_notes} onChange={e => setNewClient(p => ({ ...p, broker_notes: e.target.value }))} rows={3} className="border border-gray-300 rounded px-3 py-2 text-sm w-full" />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={saveClient} disabled={loading} className="px-5 py-2 bg-blue-600 text-white rounded text-sm font-medium disabled:opacity-50">
                {loading ? 'Saving…' : 'Save Client'}
              </button>
              <button onClick={() => setShowAddClient(false)} className="px-5 py-2 border border-gray-300 rounded text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Application Modal ── */}
      {showAddApp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-screen overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-slate-800">Add Mortgage Application</h2>
              <button onClick={() => setShowAddApp(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs text-gray-500 block mb-1">Client *</label>
                <select value={newApp.client_id} onChange={e => setNewApp(p => ({ ...p, client_id: e.target.value }))} className="border border-gray-300 rounded px-3 py-2 text-sm w-full">
                  <option value="">Select client…</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Application Type *</label>
                <select value={newApp.application_type} onChange={e => setNewApp(p => ({ ...p, application_type: e.target.value }))} className="border border-gray-300 rounded px-3 py-2 text-sm w-full">
                  {['purchase','refinance','renewal','heloc','construction','bridge','reverse'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Property Type</label>
                <select value={newApp.property_type} onChange={e => setNewApp(p => ({ ...p, property_type: e.target.value }))} className="border border-gray-300 rounded px-3 py-2 text-sm w-full">
                  {['detached','semi','townhouse','condo','multi_family','commercial'].map(v => <option key={v} value={v}>{v.replace('_',' ')}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-500 block mb-1">Property Address</label>
                <input value={newApp.property_address} onChange={e => setNewApp(p => ({ ...p, property_address: e.target.value }))} className="border border-gray-300 rounded px-3 py-2 text-sm w-full" />
              </div>
              {[
                { label: 'Purchase Price ($)', key: 'purchase_price' },
                { label: 'Down Payment ($)', key: 'down_payment' },
                { label: 'Requested Rate (%)', key: 'requested_rate' },
                { label: 'Amortization (years)', key: 'amortization_years' },
                { label: 'Term (years)', key: 'term_years' },
                { label: 'Preferred Lender', key: 'lender' },
              ].map(({ label, key }) => (
                <div key={key}>
                  <label className="text-xs text-gray-500 block mb-1">{label}</label>
                  <input value={newApp[key as keyof typeof newApp]} onChange={e => setNewApp(p => ({ ...p, [key]: e.target.value }))}
                    className="border border-gray-300 rounded px-3 py-2 text-sm w-full" />
                </div>
              ))}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Rate Type</label>
                <select value={newApp.rate_type} onChange={e => setNewApp(p => ({ ...p, rate_type: e.target.value }))} className="border border-gray-300 rounded px-3 py-2 text-sm w-full">
                  {['fixed','variable','adjustable','hybrid'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Payment Frequency</label>
                <select value={newApp.payment_frequency} onChange={e => setNewApp(p => ({ ...p, payment_frequency: e.target.value }))} className="border border-gray-300 rounded px-3 py-2 text-sm w-full">
                  {['monthly','bi_weekly','accelerated_bi_weekly','weekly'].map(v => <option key={v} value={v}>{v.replace(/_/g,' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Closing Date</label>
                <input type="date" value={newApp.closing_date} onChange={e => setNewApp(p => ({ ...p, closing_date: e.target.value }))} className="border border-gray-300 rounded px-3 py-2 text-sm w-full" />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={saveApp} disabled={loading} className="px-5 py-2 bg-blue-600 text-white rounded text-sm font-medium disabled:opacity-50">
                {loading ? 'Saving…' : 'Save Application'}
              </button>
              <button onClick={() => setShowAddApp(false)} className="px-5 py-2 border border-gray-300 rounded text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Submit to Lender Modal ── */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-slate-800">Submit to Lender</h2>
              <button onClick={() => setShowSubmitModal(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <p className="text-sm text-gray-600 mb-4">{showSubmitModal.client_name} — {fmt$(showSubmitModal.mortgage_amount)}</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Select Lender</label>
                <select id="submit-lender" className="border border-gray-300 rounded px-3 py-2 text-sm w-full">
                  <option value="">— select —</option>
                  {Object.entries(LENDERS).map(([cat, list]) => (
                    <optgroup key={cat} label={cat.replace('_','-').toUpperCase()}>
                      {list.map(l => <option key={l} value={l}>{l}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => {
                const sel = (document.getElementById('submit-lender') as HTMLSelectElement).value;
                if (sel) submitToLender(showSubmitModal, sel);
              }} className="px-5 py-2 bg-slate-700 text-white rounded text-sm font-medium">Submit</button>
              <button onClick={() => setShowSubmitModal(null)} className="px-5 py-2 border border-gray-300 rounded text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
