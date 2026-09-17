'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard','cases','invoices','prearrangements','staff','ai'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab,string> = {
  dashboard: 'Dashboard',
  cases: 'Cases',
  invoices: 'Invoices',
  prearrangements: 'Pre-Arrangements',
  staff: 'Staff',
  ai: 'AI Tools',
};

interface DashData {
  active_files: number;
  prearrangements_on_file: number;
  services_this_month: number;
  revenue_mtd: number;
  cremations_mtd: number;
  burials_mtd: number;
}
interface FhCase {
  id: number;
  case_number: string;
  deceased_first_name: string;
  deceased_last_name: string;
  service_type: string;
  status: string;
  date_of_death: string;
  service_date: string | null;
  medical_examiner_referral: boolean;
  cremation_authorization_status: string | null;
  primary_contact_name: string;
}
interface FhInvoice {
  id: number;
  case_number: string;
  deceased_last_name: string;
  service_items_total: number;
  merchandise_total: number;
  cash_advance_total: number;
  preneed_credit: number;
  balance_due: number;
  payment_status: string;
}
interface PreArrangement {
  id: number;
  client_name: string;
  plan_value: number;
  trust_fund_status: string;
  is_funded: boolean;
  plan_date: string;
  expiry_date: string | null;
}
interface StaffMember {
  id: number;
  name: string;
  role: string;
  afsrb_license_number: string | null;
  license_expiry: string | null;
  on_call: boolean;
  is_active: boolean;
}

function fmtCad(n: number) { return `$${Number(n ?? 0).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function fmtDate(d: string | null) { return d ? new Date(d).toLocaleDateString('en-CA') : '—'; }
function daysUntil(d: string) { return Math.round((new Date(d).getTime() - Date.now()) / 86400000); }

function Badge({ label, color = 'gray' }: { label: string; color?: string }) {
  const m: Record<string,string> = {
    blue: 'bg-blue-100 text-blue-700', green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700',
    purple: 'bg-purple-100 text-purple-700', gray: 'bg-gray-100 text-gray-700',
    teal: 'bg-teal-100 text-teal-700', slate: 'bg-slate-100 text-slate-700',
  };
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${m[color] ?? m.gray}`}>{label.replace(/_/g, ' ')}</span>;
}

function KpiCard({ label, value, color = 'blue' }: { label: string; value: string | number; color?: string }) {
  const b: Record<string,string> = {
    blue: 'border-l-4 border-blue-500 bg-blue-50', green: 'border-l-4 border-green-500 bg-green-50',
    amber: 'border-l-4 border-amber-500 bg-amber-50', purple: 'border-l-4 border-purple-500 bg-purple-50',
    slate: 'border-l-4 border-slate-500 bg-slate-50',
  };
  return (
    <div className={`rounded-lg p-4 ${b[color] ?? b.blue}`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

const STATUS_FLOW = ['first_call','in_care','arrangements','pending_documents','service_scheduled','completed'];
function statusColor(s: string): string {
  const m: Record<string,string> = {
    first_call: 'purple', in_care: 'blue', arrangements: 'amber',
    pending_documents: 'red', service_scheduled: 'teal', completed: 'green',
  };
  return m[s] ?? 'gray';
}
function serviceTypeColor(t: string): string {
  const m: Record<string,string> = { burial: 'blue', cremation: 'amber', celebration_of_life: 'purple', graveside: 'teal', direct_cremation: 'gray' };
  return m[t] ?? 'gray';
}
function roleColor(r: string): string {
  const m: Record<string,string> = { licensed_funeral_director: 'blue', embalmer: 'purple', celebrant: 'teal', administrative: 'gray', apprentice: 'amber' };
  return m[r] ?? 'gray';
}
function payStatusColor(s: string): string {
  const m: Record<string,string> = { paid: 'green', partial: 'amber', outstanding: 'red', waived: 'gray' };
  return m[s] ?? 'gray';
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────
function DashboardTab({ dash }: { dash: DashData | null }) {
  if (!dash) return <div className="p-8 text-center text-gray-400">Loading…</div>;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      <KpiCard label="Active Files" value={dash.active_files} color="blue" />
      <KpiCard label="Pre-Arrangements on File" value={dash.prearrangements_on_file} color="purple" />
      <KpiCard label="Services This Month" value={dash.services_this_month} color="slate" />
      <KpiCard label="Revenue MTD" value={fmtCad(dash.revenue_mtd)} color="green" />
      <KpiCard label="Cremations MTD" value={dash.cremations_mtd} color="amber" />
      <KpiCard label="Burials MTD" value={dash.burials_mtd} color="teal" />
    </div>
  );
}

// ─── Cases ─────────────────────────────────────────────────────────────────────
function CasesTab() {
  const [cases, setCases] = useState<FhCase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/funeral-home/cases')
      .then(r => r.json())
      .then(d => setCases(d.cases ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center text-gray-400">Loading…</div>;
  return (
    <div className="space-y-3">
      {cases.map(c => (
        <div key={c.id} className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-semibold text-gray-900 font-mono text-sm">{c.case_number}</span>
            <Badge label={c.service_type} color={serviceTypeColor(c.service_type)} />
            <Badge label={c.status} color={statusColor(c.status)} />
            {c.medical_examiner_referral && <Badge label="Medical Examiner Referral" color="red" />}
          </div>
          <div className="text-base font-medium text-gray-800">{c.deceased_last_name}, {c.deceased_first_name}</div>
          <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500">
            {c.date_of_death && <span>Date of Death: {fmtDate(c.date_of_death)}</span>}
            {c.service_date && <span>Service: {fmtDate(c.service_date)}</span>}
            <span>Contact: {c.primary_contact_name}</span>
            {c.cremation_authorization_status && (
              <span>Cremation Auth: <span className={c.cremation_authorization_status === 'received' ? 'text-green-600' : 'text-amber-600'}>{c.cremation_authorization_status}</span></span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-1">
            {STATUS_FLOW.map((s, i) => (
              <span key={s} className={`px-2 py-0.5 rounded text-xs ${s === c.status ? 'bg-slate-800 text-white font-medium' : STATUS_FLOW.indexOf(c.status) > i ? 'bg-gray-200 text-gray-500' : 'bg-gray-100 text-gray-400'}`}>
                {s.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      ))}
      {cases.length === 0 && <div className="text-gray-400 text-center py-8">No active cases.</div>}
    </div>
  );
}

// ─── Invoices ──────────────────────────────────────────────────────────────────
function InvoicesTab() {
  const [invoices, setInvoices] = useState<FhInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/funeral-home/invoices')
      .then(r => r.json())
      .then(d => setInvoices(d.invoices ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center text-gray-400">Loading…</div>;
  return (
    <div className="space-y-3">
      {invoices.map(inv => (
        <div key={inv.id} className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="font-semibold text-gray-900 font-mono text-sm">{inv.case_number}</span>
            <span className="text-gray-700 font-medium">{inv.deceased_last_name}</span>
            <Badge label={inv.payment_status} color={payStatusColor(inv.payment_status)} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <p className="text-gray-400">Professional Services</p>
              <p className="font-medium text-gray-800">{fmtCad(inv.service_items_total ?? 0)}</p>
            </div>
            <div>
              <p className="text-gray-400">Merchandise</p>
              <p className="font-medium text-gray-800">{fmtCad(inv.merchandise_total ?? 0)}</p>
            </div>
            <div>
              <p className="text-gray-400">Cash Advances</p>
              <p className="font-medium text-gray-800">{fmtCad(inv.cash_advance_total ?? 0)}</p>
            </div>
            {inv.preneed_credit > 0 && (
              <div>
                <p className="text-gray-400">Pre-need Credit</p>
                <p className="font-medium text-green-700">−{fmtCad(inv.preneed_credit)}</p>
              </div>
            )}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
            <span className="text-sm text-gray-500">Balance Due</span>
            <span className={`text-lg font-bold ${inv.balance_due > 0 ? 'text-red-600' : 'text-green-600'}`}>{fmtCad(inv.balance_due)}</span>
          </div>
        </div>
      ))}
      {invoices.length === 0 && <div className="text-gray-400 text-center py-8">No invoices found.</div>}
    </div>
  );
}

// ─── Pre-Arrangements ──────────────────────────────────────────────────────────
function PreArrangementsTab() {
  const [plans, setPlans] = useState<PreArrangement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/funeral-home/pre-arrangements')
      .then(r => r.json())
      .then(d => setPlans(d.prearrangements ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center text-gray-400">Loading…</div>;
  return (
    <div className="space-y-3">
      {plans.map(p => {
        const expDays = p.expiry_date ? daysUntil(p.expiry_date) : null;
        return (
          <div key={p.id} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-semibold text-gray-900">{p.client_name}</span>
              <Badge label={p.is_funded ? 'Funded' : 'Unfunded'} color={p.is_funded ? 'green' : 'amber'} />
              <Badge label={p.trust_fund_status} color={p.trust_fund_status === 'active' ? 'blue' : 'gray'} />
            </div>
            <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500">
              <span>Plan Value: <span className="font-medium text-gray-800">{fmtCad(p.plan_value)}</span></span>
              <span>Plan Date: {fmtDate(p.plan_date)}</span>
              {p.expiry_date && (
                <span className={expDays !== null && expDays < 90 ? 'text-amber-600 font-medium' : ''}>
                  Expires: {fmtDate(p.expiry_date)}{expDays !== null && expDays < 90 ? ` (${expDays}d)` : ''}
                </span>
              )}
            </div>
          </div>
        );
      })}
      {plans.length === 0 && <div className="text-gray-400 text-center py-8">No pre-arrangements on file.</div>}
    </div>
  );
}

// ─── Staff ─────────────────────────────────────────────────────────────────────
function StaffTab() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/funeral-home/staff')
      .then(r => r.json())
      .then(d => setStaff(d.staff ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center text-gray-400">Loading…</div>;
  return (
    <div className="space-y-3">
      {staff.map(s => {
        const licExpDays = s.license_expiry ? daysUntil(s.license_expiry) : null;
        const licAlert = licExpDays !== null && licExpDays < 90;
        return (
          <div key={s.id} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-semibold text-gray-900">{s.name}</span>
              <Badge label={s.role} color={roleColor(s.role)} />
              {s.on_call && <Badge label="On Call" color="amber" />}
            </div>
            <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500">
              {s.afsrb_license_number && <span>AFSRB: {s.afsrb_license_number}</span>}
              {s.license_expiry && (
                <span className={licAlert ? 'text-red-600 font-medium' : ''}>
                  License expires: {fmtDate(s.license_expiry)}{licAlert && licExpDays !== null ? ` — ${licExpDays}d remaining` : ''}
                </span>
              )}
            </div>
          </div>
        );
      })}
      {staff.length === 0 && <div className="text-gray-400 text-center py-8">No staff found.</div>}
    </div>
  );
}

// ─── AI Tools ──────────────────────────────────────────────────────────────────
function AIToolsTab() {
  const [obitName, setObitName] = useState('');
  const [obitMoments, setObitMoments] = useState('');
  const [obitFamily, setObitFamily] = useState('');
  const [obitResult, setObitResult] = useState('');
  const [obitLoading, setObitLoading] = useState(false);

  const [scriptName, setScriptName] = useState('');
  const [scriptTheme, setScriptTheme] = useState('');
  const [scriptResult, setScriptResult] = useState('');
  const [scriptLoading, setScriptLoading] = useState(false);

  async function generateObit() {
    if (!obitName) return;
    setObitLoading(true);
    setObitResult('');
    try {
      const res = await fetch('/api/admin/funeral-home/ai-obituary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: obitName, key_life_moments: obitMoments, surviving_family: obitFamily }),
      });
      const d = await res.json();
      setObitResult(d.obituary ?? d.error ?? 'No result returned.');
    } catch {
      setObitResult('Error generating obituary.');
    } finally {
      setObitLoading(false);
    }
  }

  async function generateScript() {
    if (!scriptName) return;
    setScriptLoading(true);
    setScriptResult('');
    try {
      const res = await fetch('/api/admin/funeral-home/ai-celebrant-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: scriptName, theme: scriptTheme }),
      });
      const d = await res.json();
      setScriptResult(d.script ?? d.error ?? 'No result returned.');
    } catch {
      setScriptResult('Error generating script.');
    } finally {
      setScriptLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Obituary Writer */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Obituary Writer</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
            <input value={obitName} onChange={e => setObitName(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Margaret Eleanor Thompson" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Key Life Moments</label>
            <textarea value={obitMoments} onChange={e => setObitMoments(e.target.value)} rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Career, hobbies, achievements, community involvement…" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Surviving Family</label>
            <input value={obitFamily} onChange={e => setObitFamily(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. spouse John, children Sarah and David, grandchildren…" />
          </div>
          <button onClick={generateObit} disabled={obitLoading || !obitName}
            className="px-4 py-2 bg-slate-800 text-white rounded-md text-sm hover:bg-slate-700 disabled:opacity-50">
            {obitLoading ? 'Generating…' : 'Generate Obituary'}
          </button>
          {obitResult && (
            <div className="mt-4 bg-gray-50 border border-gray-200 rounded-md p-4 text-sm text-gray-800 whitespace-pre-wrap">{obitResult}</div>
          )}
        </div>
      </div>

      {/* Celebration of Life Script */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Celebration of Life Script Generator</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name of Deceased *</label>
            <input value={scriptName} onChange={e => setScriptName(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Full name" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Theme / Tone</label>
            <input value={scriptTheme} onChange={e => setScriptTheme(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. faith-based, celebration of a life well lived, outdoor lover…" />
          </div>
          <button onClick={generateScript} disabled={scriptLoading || !scriptName}
            className="px-4 py-2 bg-slate-800 text-white rounded-md text-sm hover:bg-slate-700 disabled:opacity-50">
            {scriptLoading ? 'Generating…' : 'Generate Script'}
          </button>
          {scriptResult && (
            <div className="mt-4 bg-gray-50 border border-gray-200 rounded-md p-4 text-sm text-gray-800 whitespace-pre-wrap">{scriptResult}</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function FuneralHomePage() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [dash, setDash] = useState<DashData | null>(null);

  const loadDash = useCallback(() => {
    fetch('/api/admin/funeral-home/cases')
      .then(r => r.json())
      .then(d => {
        const cases: FhCase[] = d.cases ?? [];
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const active = cases.filter(c => !['completed','cancelled'].includes(c.status));
        const thisMonth = cases.filter(c => c.service_date && new Date(c.service_date) >= monthStart);
        setDash({
          active_files: active.length,
          prearrangements_on_file: 0,
          services_this_month: thisMonth.length,
          revenue_mtd: 0,
          cremations_mtd: thisMonth.filter(c => c.service_type === 'cremation' || c.service_type === 'direct_cremation').length,
          burials_mtd: thisMonth.filter(c => c.service_type === 'burial' || c.service_type === 'graveside').length,
        });
      })
      .catch(() => setDash({ active_files: 0, prearrangements_on_file: 0, services_this_month: 0, revenue_mtd: 0, cremations_mtd: 0, burials_mtd: 0 }));
  }, []);

  useEffect(() => { loadDash(); }, [loadDash]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">Funeral Home &amp; Memorial Services</h1>
        <p className="text-sm text-gray-500 mt-1">Case management, invoicing, pre-arrangements, and AI tools</p>
      </div>

      <div className="bg-white border-b border-gray-200 px-6">
        <nav className="flex gap-1 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab
                  ? 'border-slate-700 text-slate-800'
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
        {activeTab === 'cases' && <CasesTab />}
        {activeTab === 'invoices' && <InvoicesTab />}
        {activeTab === 'prearrangements' && <PreArrangementsTab />}
        {activeTab === 'staff' && <StaffTab />}
        {activeTab === 'ai' && <AIToolsTab />}
      </div>
    </div>
  );
}
