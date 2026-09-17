'use client';
import { useEffect, useState } from 'react';

const TABS = ['dashboard','claims','inspections','payments','adjusters','ai'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab,string> = {
  dashboard: 'Dashboard',
  claims: 'Claims',
  inspections: 'Inspections',
  payments: 'Payments',
  adjusters: 'Adjusters',
  ai: 'AI Tools',
};

interface DashData {
  open_claims: number;
  claims_closed_mtd: number;
  avg_days_to_close: number;
  total_reserves: number;
  total_payments_mtd: number;
  adjuster_count: number;
}
interface Claim {
  id: number;
  claim_number: string;
  insurer_name: string;
  insured_name: string;
  claim_type: string;
  cause_of_loss: string;
  status: string;
  priority: string;
  reserve_amount: number;
  total_payments: number;
  loss_date: string;
  adjuster_name: string | null;
  loss_address: string;
}
interface Inspection {
  id: number;
  claim_number: string;
  insured_name: string;
  inspection_type: string;
  scheduled_date: string;
  completed_date: string | null;
  adjuster_name: string | null;
  actual_cash_value: number | null;
  replacement_cost_value: number | null;
  contractor_estimates: unknown[];
  report_submitted_at: string | null;
}
interface Payment {
  id: number;
  claim_id: number;
  claim_number?: string;
  payment_type: string;
  payee_name: string;
  payee_type: string;
  cheque_number: string | null;
  payment_date: string;
  amount: number;
}
interface Adjuster {
  id: number;
  name: string;
  aic_license_number: string | null;
  license_class: string;
  license_expiry: string | null;
  eando_insurer: string | null;
  eando_expiry: string | null;
  specializations: string[];
  status: string;
  live_claim_count: number;
}

function fmtCad(n: number) { return `$${Number(n ?? 0).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function fmtDate(d: string | null) { return d ? new Date(d).toLocaleDateString('en-CA') : '—'; }
function daysUntil(d: string) { return Math.round((new Date(d).getTime() - Date.now()) / 86400000); }

function Badge({ label, color = 'gray' }: { label: string; color?: string }) {
  const m: Record<string,string> = {
    blue: 'bg-blue-100 text-blue-700', green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700',
    purple: 'bg-purple-100 text-purple-700', gray: 'bg-gray-100 text-gray-700',
    teal: 'bg-teal-100 text-teal-700', orange: 'bg-orange-100 text-orange-700',
  };
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${m[color] ?? m.gray}`}>{label.replace(/_/g, ' ')}</span>;
}

function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const b: Record<string,string> = {
    blue: 'border-l-4 border-blue-500 bg-blue-50', green: 'border-l-4 border-green-500 bg-green-50',
    amber: 'border-l-4 border-amber-500 bg-amber-50', red: 'border-l-4 border-red-500 bg-red-50',
    purple: 'border-l-4 border-purple-500 bg-purple-50', orange: 'border-l-4 border-orange-500 bg-orange-50',
  };
  return (
    <div className={`rounded-lg p-4 ${b[color] ?? b.blue}`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function claimTypeColor(t: string): string {
  const m: Record<string,string> = { property: 'blue', auto: 'teal', hail: 'amber', fire: 'red', flood: 'purple', commercial: 'orange', liability: 'gray' };
  return m[t] ?? 'gray';
}
function priorityColor(p: string): string {
  const m: Record<string,string> = { catastrophe: 'red', urgent: 'amber', standard: 'green' };
  return m[p] ?? 'gray';
}
function statusColor(s: string): string {
  const m: Record<string,string> = { new: 'blue', assigned: 'purple', inspection_scheduled: 'amber', in_review: 'teal', negotiating: 'orange', closed: 'green', denied: 'red', settled: 'gray' };
  return m[s] ?? 'gray';
}
function licenseClassColor(c: string): string {
  const m: Record<string,string> = { independent: 'blue', staff: 'green', public: 'purple', catastrophe: 'red' };
  return m[c] ?? 'gray';
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────
function DashboardTab({ dash }: { dash: DashData | null }) {
  if (!dash) return <div className="p-8 text-center text-gray-400">Loading…</div>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard label="Open Claims" value={dash.open_claims} color="blue" />
        <KpiCard label="Claims Closed MTD" value={dash.claims_closed_mtd} color="green" />
        <KpiCard label="Avg Days to Close" value={dash.avg_days_to_close || '—'} color="amber" />
        <KpiCard label="Total Reserves" value={fmtCad(dash.total_reserves)} color="red" />
        <KpiCard label="Payments MTD" value={fmtCad(dash.total_payments_mtd)} color="purple" />
        <KpiCard label="Active Adjusters" value={dash.adjuster_count} color="teal" />
      </div>
    </div>
  );
}

// ─── Claims ────────────────────────────────────────────────────────────────────
function ClaimsTab() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/insurance-adjusting/claims')
      .then(r => r.json())
      .then(d => setClaims(d.claims ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center text-gray-400">Loading…</div>;
  return (
    <div className="space-y-3">
      {claims.map(c => (
        <div key={c.id} className={`bg-white border rounded-lg p-4 ${c.priority === 'catastrophe' ? 'border-red-400' : c.priority === 'urgent' ? 'border-amber-400' : 'border-gray-200'}`}>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-mono text-sm font-semibold text-gray-900">{c.claim_number}</span>
            <Badge label={c.claim_type} color={claimTypeColor(c.claim_type)} />
            <Badge label={c.priority} color={priorityColor(c.priority)} />
            <Badge label={c.status} color={statusColor(c.status)} />
          </div>
          <div className="text-sm font-medium text-gray-800">{c.insured_name}</div>
          <div className="text-xs text-gray-500 mt-1">{c.insurer_name} · {c.cause_of_loss}</div>
          <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500">
            {c.loss_date && <span>Loss: {fmtDate(c.loss_date)}</span>}
            {c.adjuster_name && <span>Adjuster: {c.adjuster_name}</span>}
            <span>Reserve: <span className="font-medium text-gray-800">{fmtCad(c.reserve_amount)}</span></span>
            <span>Paid: <span className="font-medium text-gray-800">{fmtCad(c.total_payments)}</span></span>
          </div>
          {c.loss_address && <div className="text-xs text-gray-400 mt-1">{c.loss_address}</div>}
        </div>
      ))}
      {claims.length === 0 && <div className="text-gray-400 text-center py-8">No claims found.</div>}
    </div>
  );
}

// ─── Inspections ───────────────────────────────────────────────────────────────
function InspectionsTab() {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/insurance-adjusting/inspections')
      .then(r => r.json())
      .then(d => setInspections(d.inspections ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center text-gray-400">Loading…</div>;
  return (
    <div className="space-y-3">
      {inspections.map(i => (
        <div key={i.id} className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-mono text-sm font-semibold text-gray-900">{i.claim_number}</span>
            <Badge label={i.inspection_type} color="blue" />
            <Badge label={i.report_submitted_at ? 'Report Submitted' : i.completed_date ? 'Pending Report' : 'Scheduled'} color={i.report_submitted_at ? 'green' : i.completed_date ? 'amber' : 'blue'} />
          </div>
          <div className="text-sm text-gray-700">{i.insured_name}</div>
          <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500">
            {i.scheduled_date && <span>Scheduled: {fmtDate(i.scheduled_date)}</span>}
            {i.completed_date && <span>Completed: {fmtDate(i.completed_date)}</span>}
            {i.adjuster_name && <span>Adjuster: {i.adjuster_name}</span>}
            {i.actual_cash_value != null && <span>ACV: <span className="font-medium text-gray-800">{fmtCad(i.actual_cash_value)}</span></span>}
            {i.replacement_cost_value != null && <span>RCV: <span className="font-medium text-gray-800">{fmtCad(i.replacement_cost_value)}</span></span>}
            {Array.isArray(i.contractor_estimates) && i.contractor_estimates.length > 0 && (
              <span>{i.contractor_estimates.length} contractor estimate{i.contractor_estimates.length > 1 ? 's' : ''}</span>
            )}
          </div>
        </div>
      ))}
      {inspections.length === 0 && <div className="text-gray-400 text-center py-8">No inspections found.</div>}
    </div>
  );
}

// ─── Payments ──────────────────────────────────────────────────────────────────
function PaymentsTab() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/insurance-adjusting/payments')
      .then(r => r.json())
      .then(d => setPayments(d.payments ?? []))
      .finally(() => setLoading(false));
  }, []);

  const payTypeColor = (t: string) => {
    const m: Record<string,string> = { structural: 'blue', contents: 'purple', ae: 'teal', bodily_injury: 'red', deductible: 'gray', partial: 'amber' };
    return m[t] ?? 'gray';
  };

  if (loading) return <div className="p-8 text-center text-gray-400">Loading…</div>;
  return (
    <div className="space-y-3">
      {payments.map(p => (
        <div key={p.id} className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge label={p.payment_type} color={payTypeColor(p.payment_type)} />
              <Badge label={p.payee_type} color="gray" />
              {p.claim_number && <span className="font-mono text-xs text-gray-500">{p.claim_number}</span>}
            </div>
            <span className="text-base font-bold text-gray-900">{fmtCad(p.amount)}</span>
          </div>
          <div className="mt-2 text-sm font-medium text-gray-700">{p.payee_name}</div>
          <div className="flex flex-wrap gap-4 mt-1 text-xs text-gray-500">
            <span>{fmtDate(p.payment_date)}</span>
            {p.cheque_number && <span>Cheque: {p.cheque_number}</span>}
          </div>
        </div>
      ))}
      {payments.length === 0 && <div className="text-gray-400 text-center py-8">No payments found.</div>}
    </div>
  );
}

// ─── Adjusters ─────────────────────────────────────────────────────────────────
function AdjustersTab() {
  const [adjusters, setAdjusters] = useState<Adjuster[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/insurance-adjusting/adjusters')
      .then(r => r.json())
      .then(d => setAdjusters(d.adjusters ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center text-gray-400">Loading…</div>;
  return (
    <div className="space-y-3">
      {adjusters.map(a => {
        const licDays = a.license_expiry ? daysUntil(a.license_expiry) : null;
        const eandoDays = a.eando_expiry ? daysUntil(a.eando_expiry) : null;
        const licAlert = licDays !== null && licDays < 90;
        const eandoAlert = eandoDays !== null && eandoDays < 90;
        const maxClaims = 15;
        const pct = Math.min(100, Math.round((a.live_claim_count / maxClaims) * 100));
        return (
          <div key={a.id} className={`bg-white border rounded-lg p-4 ${licAlert || eandoAlert ? 'border-amber-400' : 'border-gray-200'}`}>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-semibold text-gray-900">{a.name}</span>
              <Badge label={a.license_class} color={licenseClassColor(a.license_class)} />
              <Badge label={a.status} color={a.status === 'available' ? 'green' : a.status === 'busy' ? 'amber' : 'gray'} />
            </div>
            <div className="flex flex-wrap gap-4 mt-1 text-xs text-gray-500">
              {a.aic_license_number && <span>AIC: {a.aic_license_number}</span>}
              {a.license_expiry && (
                <span className={licAlert ? 'text-red-600 font-medium' : ''}>
                  License expires: {fmtDate(a.license_expiry)}{licAlert && licDays !== null ? ` (${licDays}d)` : ''}
                </span>
              )}
              {a.eando_expiry && (
                <span className={eandoAlert ? 'text-red-600 font-medium' : ''}>
                  E&amp;O expires: {fmtDate(a.eando_expiry)}{eandoAlert && eandoDays !== null ? ` (${eandoDays}d)` : ''}{a.eando_insurer ? ` · ${a.eando_insurer}` : ''}
                </span>
              )}
            </div>
            {a.specializations?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {a.specializations.map(s => <Badge key={s} label={s} color="teal" />)}
              </div>
            )}
            <div className="mt-3">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Active Claims: {a.live_claim_count}</span>
                <span>{pct}% capacity</span>
              </div>
              <div className="w-full bg-gray-200 rounded h-2">
                <div className={`h-2 rounded ${pct >= 90 ? 'bg-red-500' : pct >= 60 ? 'bg-amber-400' : 'bg-green-500'}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>
        );
      })}
      {adjusters.length === 0 && <div className="text-gray-400 text-center py-8">No adjusters found.</div>}
    </div>
  );
}

// ─── AI Tools ──────────────────────────────────────────────────────────────────
function AIToolsTab() {
  const [covPolicyType, setCovPolicyType] = useState('');
  const [covCause, setCovCause] = useState('');
  const [covResult, setCovResult] = useState('');
  const [covLoading, setCovLoading] = useState(false);

  const [rptClaim, setRptClaim] = useState('');
  const [rptFindings, setRptFindings] = useState('');
  const [rptResult, setRptResult] = useState('');
  const [rptLoading, setRptLoading] = useState(false);

  async function analyzeCoverage() {
    if (!covPolicyType || !covCause) return;
    setCovLoading(true);
    setCovResult('');
    try {
      const res = await fetch('/api/admin/insurance-adjusting/ai-coverage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policy_type: covPolicyType, cause_of_loss: covCause }),
      });
      const d = await res.json();
      setCovResult(d.analysis ?? d.error ?? 'No result returned.');
    } catch {
      setCovResult('Error analyzing coverage.');
    } finally {
      setCovLoading(false);
    }
  }

  async function draftReport() {
    if (!rptClaim || !rptFindings) return;
    setRptLoading(true);
    setRptResult('');
    try {
      const res = await fetch('/api/admin/insurance-adjusting/ai-field-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claim_number: rptClaim, findings: rptFindings }),
      });
      const d = await res.json();
      setRptResult(d.report ?? d.error ?? 'No result returned.');
    } catch {
      setRptResult('Error drafting report.');
    } finally {
      setRptLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Coverage Analysis */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Coverage Analysis</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Policy Type *</label>
            <input value={covPolicyType} onChange={e => setCovPolicyType(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Homeowners, Commercial Property, Auto" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cause of Loss *</label>
            <input value={covCause} onChange={e => setCovCause(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Hailstorm, Basement flooding, Rear-end collision" />
          </div>
          <button onClick={analyzeCoverage} disabled={covLoading || !covPolicyType || !covCause}
            className="px-4 py-2 bg-slate-800 text-white rounded-md text-sm hover:bg-slate-700 disabled:opacity-50">
            {covLoading ? 'Analyzing…' : 'Analyze Coverage'}
          </button>
          {covResult && (
            <div className="mt-4 bg-gray-50 border border-gray-200 rounded-md p-4 text-sm text-gray-800 whitespace-pre-wrap">{covResult}</div>
          )}
        </div>
      </div>

      {/* Field Report Drafter */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Field Report Drafter</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Claim Number *</label>
            <input value={rptClaim} onChange={e => setRptClaim(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. ADJ-2026-0001" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Field Findings *</label>
            <textarea value={rptFindings} onChange={e => setRptFindings(e.target.value)} rows={4}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Describe what was observed on site: damage extent, photos taken, measurements, contractor estimates reviewed…" />
          </div>
          <button onClick={draftReport} disabled={rptLoading || !rptClaim || !rptFindings}
            className="px-4 py-2 bg-slate-800 text-white rounded-md text-sm hover:bg-slate-700 disabled:opacity-50">
            {rptLoading ? 'Drafting…' : 'Draft Field Report'}
          </button>
          {rptResult && (
            <div className="mt-4 bg-gray-50 border border-gray-200 rounded-md p-4 text-sm text-gray-800 whitespace-pre-wrap">{rptResult}</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function InsuranceAdjustingPage() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [dash, setDash] = useState<DashData | null>(null);

  useEffect(() => {
    fetch('/api/admin/insurance-adjusting')
      .then(r => r.json())
      .then(d => setDash(d));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">Insurance Adjusting Firm</h1>
        <p className="text-sm text-gray-500 mt-1">Claims, inspections, payments, adjuster workload, and AI tools</p>
      </div>

      <div className="bg-white border-b border-gray-200 px-6">
        <nav className="flex gap-1 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </nav>
      </div>

      <div className="p-6">
        {activeTab === 'dashboard' && <DashboardTab dash={dash} />}
        {activeTab === 'claims' && <ClaimsTab />}
        {activeTab === 'inspections' && <InspectionsTab />}
        {activeTab === 'payments' && <PaymentsTab />}
        {activeTab === 'adjusters' && <AdjustersTab />}
        {activeTab === 'ai' && <AIToolsTab />}
      </div>
    </div>
  );
}
