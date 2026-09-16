'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard', 'clients', 'snapshot', 'goals', 'insurance', 'ai', 'calendar'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = {
  dashboard: 'Dashboard', clients: 'Clients', snapshot: 'Financial Snapshot',
  goals: 'Goals', insurance: 'Insurance Review', ai: 'AI Financial Planner', calendar: 'Review Calendar',
};

const EMPLOYMENT = ['employed','self_employed','retired','student','unemployed','disability'];
const MARITAL = ['single','married','common_law','divorced','widowed'];
const CLIENT_TYPES = ['individual','couple','family','business_owner'];
const RISK = ['conservative','moderate','aggressive'];
const REVIEW_FREQ = ['monthly','quarterly','semi_annual','annual'];
const GOAL_TYPES = ['emergency_fund','home_purchase','retirement','education','debt_payoff','vacation','business','vehicle','other'];
const PRIORITIES = ['low','medium','high','critical'];
const STATUSES = ['active','on_hold','closed'];

interface WmClient { id: number; first_name: string; last_name: string; email: string; phone: string; client_type: string; employment_status: string; annual_income: number; marital_status: string; dependents: number; current_planner: string; review_frequency: string; last_review_date: string; next_review_date: string; status: string; risk_tolerance: string; financial_goals: string[]; latest_net_worth: number; }
interface WmGoal { id: number; client_id: number; first_name: string; last_name: string; goal_name: string; goal_type: string; target_amount: number; current_amount: number; target_date: string; monthly_contribution: number; priority: string; status: string; notes: string; }
interface WmSnapshot { id: number; client_id: number; snapshot_date: string; cash_savings: number; rrsp_balance: number; tfsa_balance: number; fhsa_balance: number; mortgage_balance: number; credit_card_balance: number; net_worth: number; monthly_income: number; monthly_expenses: number; monthly_savings: number; }
interface WmInsurance { id: number; client_id: number; review_date: string; life_insurance_provider: string; life_coverage: number; life_premium: number; gaps_identified: string[]; recommendations: string; }

function fmtCad(n: number | string) { return `$${Number(n ?? 0).toLocaleString('en-CA', { minimumFractionDigits: 0 })}`; }
function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString('en-CA') : '—'; }
function initials(fn: string, ln: string) { return `${fn?.[0]||''}${ln?.[0]||''}`.toUpperCase(); }

function Badge({ label, color = 'gray' }: { label: string; color?: string }) {
  const m: Record<string,string> = { blue:'bg-blue-100 text-blue-700', green:'bg-green-100 text-green-700', amber:'bg-amber-100 text-amber-700', red:'bg-red-100 text-red-700', purple:'bg-purple-100 text-purple-700', gray:'bg-gray-100 text-gray-700', teal:'bg-teal-100 text-teal-700', orange:'bg-orange-100 text-orange-700' };
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${m[color]??m.gray}`}>{label.replace(/_/g,' ')}</span>;
}
function KpiCard({ label, value, sub, color='blue' }: { label:string; value:string|number; sub?:string; color?:string }) {
  const b: Record<string,string> = { blue:'border-l-4 border-blue-500 bg-blue-50', green:'border-l-4 border-green-500 bg-green-50', amber:'border-l-4 border-amber-500 bg-amber-50', red:'border-l-4 border-red-500 bg-red-50', purple:'border-l-4 border-purple-500 bg-purple-50' };
  return <div className={`rounded-lg p-4 ${b[color]??b.blue}`}><p className="text-sm text-gray-500">{label}</p><p className="text-2xl font-bold mt-1">{value}</p>{sub&&<p className="text-xs text-gray-400 mt-1">{sub}</p>}</div>;
}
function priorityColor(p: string) { return { critical:'red', high:'orange', medium:'amber', low:'gray' }[p]??'gray'; }
function statusColor(s: string) { return { active:'green', on_hold:'amber', closed:'gray', on_track:'blue', behind:'red', completed:'teal', paused:'gray' }[s]??'gray'; }

function ProgressBar({ pct }: { pct: number }) {
  const c = pct >= 100 ? 'bg-green-500' : pct >= 60 ? 'bg-blue-500' : pct >= 30 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="w-full bg-gray-200 rounded-full h-3">
      <div className={`h-3 rounded-full transition-all ${c}`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

// ─── Add Client Modal ─────────────────────────────────────────────────────────
function AddClientModal({ onClose, onSaved }: { onClose:()=>void; onSaved:()=>void }) {
  const [form, setForm] = useState({ first_name:'', last_name:'', email:'', phone:'', date_of_birth:'', province:'AB', marital_status:'single', dependents:'0', employment_status:'employed', employer:'', annual_income:'', spouse_income:'', client_type:'individual', risk_tolerance:'moderate', current_planner:'', review_frequency:'annual', next_review_date:'', notes:'' });
  const [saving, setSaving] = useState(false);
  const f = (k:string,v:string) => setForm(p=>({...p,[k]:v}));
  async function submit() {
    if (!form.first_name || !form.last_name || !form.email) return;
    setSaving(true);
    try {
      await fetch('/api/admin/wealth-management/clients', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ...form, dependents: parseInt(form.dependents)||0, annual_income: form.annual_income?parseFloat(form.annual_income):null, spouse_income: form.spouse_income?parseFloat(form.spouse_income):null }) });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-4 text-slate-800">New Financial Planning Client</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500">First Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.first_name} onChange={e=>f('first_name',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Last Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.last_name} onChange={e=>f('last_name',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Email *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" type="email" value={form.email} onChange={e=>f('email',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Phone</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.phone} onChange={e=>f('phone',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Date of Birth</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.date_of_birth} onChange={e=>f('date_of_birth',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Province</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.province} onChange={e=>f('province',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Client Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.client_type} onChange={e=>f('client_type',e.target.value)}>{CLIENT_TYPES.map(t=><option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Marital Status</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.marital_status} onChange={e=>f('marital_status',e.target.value)}>{MARITAL.map(m=><option key={m} value={m}>{m.replace(/_/g,' ')}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Dependents</label><input type="number" min="0" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.dependents} onChange={e=>f('dependents',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Employment Status</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.employment_status} onChange={e=>f('employment_status',e.target.value)}>{EMPLOYMENT.map(s=><option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Employer</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.employer} onChange={e=>f('employer',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Annual Income (CAD)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.annual_income} onChange={e=>f('annual_income',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Spouse Income (CAD)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.spouse_income} onChange={e=>f('spouse_income',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Risk Tolerance</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.risk_tolerance} onChange={e=>f('risk_tolerance',e.target.value)}>{RISK.map(r=><option key={r}>{r}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Review Frequency</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.review_frequency} onChange={e=>f('review_frequency',e.target.value)}>{REVIEW_FREQ.map(r=><option key={r} value={r}>{r.replace(/_/g,' ')}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Next Review Date</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.next_review_date} onChange={e=>f('next_review_date',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Assigned Planner</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.current_planner} onChange={e=>f('current_planner',e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.notes} onChange={e=>f('notes',e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border rounded hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{saving?'Saving…':'Save Client'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Goal Modal ────────────────────────────────────────────────────────────
function AddGoalModal({ clients, onClose, onSaved }: { clients:WmClient[]; onClose:()=>void; onSaved:()=>void }) {
  const [form, setForm] = useState({ client_id:'', goal_name:'', goal_type:'retirement', target_amount:'', current_amount:'0', target_date:'', monthly_contribution:'', priority:'medium', notes:'' });
  const [saving, setSaving] = useState(false);
  const f = (k:string,v:string) => setForm(p=>({...p,[k]:v}));
  async function submit() {
    if (!form.client_id || !form.goal_name) return;
    setSaving(true);
    try {
      await fetch('/api/admin/wealth-management/goals', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ...form, client_id:parseInt(form.client_id), target_amount:parseFloat(form.target_amount)||null, current_amount:parseFloat(form.current_amount)||0, monthly_contribution:parseFloat(form.monthly_contribution)||null }) });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
        <h2 className="text-lg font-bold mb-4 text-slate-800">Add Financial Goal</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs text-gray-500">Client *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.client_id} onChange={e=>f('client_id',e.target.value)}><option value="">Select client…</option>{clients.map(c=><option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}</select></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Goal Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.goal_name} onChange={e=>f('goal_name',e.target.value)} placeholder="e.g. Buy first home" /></div>
          <div><label className="text-xs text-gray-500">Goal Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.goal_type} onChange={e=>f('goal_type',e.target.value)}>{GOAL_TYPES.map(t=><option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Priority</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.priority} onChange={e=>f('priority',e.target.value)}>{PRIORITIES.map(p=><option key={p}>{p}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Target Amount (CAD)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.target_amount} onChange={e=>f('target_amount',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Current Amount (CAD)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.current_amount} onChange={e=>f('current_amount',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Target Date</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.target_date} onChange={e=>f('target_date',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Monthly Contribution</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.monthly_contribution} onChange={e=>f('monthly_contribution',e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.notes} onChange={e=>f('notes',e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border rounded hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50">{saving?'Saving…':'Save Goal'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Snapshot Modal ────────────────────────────────────────────────────────
function AddSnapshotModal({ clients, onClose, onSaved }: { clients:WmClient[]; onClose:()=>void; onSaved:()=>void }) {
  const [form, setForm] = useState({ client_id:'', snapshot_date:new Date().toISOString().split('T')[0], cash_savings:'', rrsp_balance:'', tfsa_balance:'', fhsa_balance:'', resp_balance:'', pension_value:'', investment_non_reg:'', real_estate_value:'', other_assets:'', mortgage_balance:'', heloc_balance:'', car_loan_balance:'', student_loan_balance:'', credit_card_balance:'', other_debt:'', monthly_income:'', monthly_expenses:'' });
  const [saving, setSaving] = useState(false);
  const f = (k:string,v:string) => setForm(p=>({...p,[k]:v}));
  const n = (v:string) => parseFloat(v)||0;
  const totalAssets = n(form.cash_savings)+n(form.rrsp_balance)+n(form.tfsa_balance)+n(form.fhsa_balance)+n(form.resp_balance)+n(form.pension_value)+n(form.investment_non_reg)+n(form.real_estate_value)+n(form.other_assets);
  const totalLiab = n(form.mortgage_balance)+n(form.heloc_balance)+n(form.car_loan_balance)+n(form.student_loan_balance)+n(form.credit_card_balance)+n(form.other_debt);
  const netWorth = totalAssets - totalLiab;
  async function submit() {
    if (!form.client_id) return;
    setSaving(true);
    try {
      await fetch('/api/admin/wealth-management/snapshots', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ...form, client_id:parseInt(form.client_id) }) });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-1 text-slate-800">New Financial Snapshot</h2>
        <div className="mb-3 p-2 bg-gray-50 rounded text-sm flex gap-6">
          <span>Assets: <strong className="text-green-700">{fmtCad(totalAssets)}</strong></span>
          <span>Liabilities: <strong className="text-red-700">{fmtCad(totalLiab)}</strong></span>
          <span>Net Worth: <strong className={netWorth>=0?'text-blue-700':'text-red-700'}>{fmtCad(netWorth)}</strong></span>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div className="col-span-2 flex gap-2">
            <div className="flex-1"><label className="text-xs text-gray-500">Client *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.client_id} onChange={e=>f('client_id',e.target.value)}><option value="">Select…</option>{clients.map(c=><option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}</select></div>
            <div><label className="text-xs text-gray-500">Snapshot Date</label><input type="date" className="border rounded px-2 py-1.5 text-sm mt-0.5" value={form.snapshot_date} onChange={e=>f('snapshot_date',e.target.value)} /></div>
          </div>
        </div>
        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Assets</p>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[['cash_savings','Cash/Savings'],['rrsp_balance','RRSP'],['tfsa_balance','TFSA'],['fhsa_balance','FHSA'],['resp_balance','RESP'],['pension_value','Pension'],['investment_non_reg','Non-Reg Investments'],['real_estate_value','Real Estate'],['other_assets','Other Assets']].map(([k,lbl])=>(
            <div key={k}><label className="text-xs text-gray-500">{lbl}</label><input type="number" className="w-full border rounded px-2 py-1 text-sm mt-0.5" value={(form as any)[k]} onChange={e=>f(k,e.target.value)} placeholder="0" /></div>
          ))}
        </div>
        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Liabilities</p>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[['mortgage_balance','Mortgage'],['heloc_balance','HELOC'],['car_loan_balance','Car Loan'],['student_loan_balance','Student Loan'],['credit_card_balance','Credit Cards'],['other_debt','Other Debt']].map(([k,lbl])=>(
            <div key={k}><label className="text-xs text-gray-500">{lbl}</label><input type="number" className="w-full border rounded px-2 py-1 text-sm mt-0.5" value={(form as any)[k]} onChange={e=>f(k,e.target.value)} placeholder="0" /></div>
          ))}
        </div>
        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Monthly Cash Flow</p>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div><label className="text-xs text-gray-500">Monthly Income</label><input type="number" className="w-full border rounded px-2 py-1 text-sm mt-0.5" value={form.monthly_income} onChange={e=>f('monthly_income',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Monthly Expenses</label><input type="number" className="w-full border rounded px-2 py-1 text-sm mt-0.5" value={form.monthly_expenses} onChange={e=>f('monthly_expenses',e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border rounded hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">{saving?'Saving…':'Save Snapshot'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Insurance Modal ───────────────────────────────────────────────────────
function AddInsuranceModal({ clients, onClose, onSaved }: { clients:WmClient[]; onClose:()=>void; onSaved:()=>void }) {
  const [form, setForm] = useState({ client_id:'', review_date:new Date().toISOString().split('T')[0], life_insurance_provider:'', life_coverage:'', life_premium:'', disability_provider:'', disability_benefit:'', disability_premium:'', critical_illness_provider:'', ci_coverage:'', ci_premium:'', health_dental_provider:'', health_dental_premium:'', home_insurance_provider:'', home_premium:'', auto_insurance_provider:'', auto_premium:'', gaps_identified:'', recommendations:'' });
  const [saving, setSaving] = useState(false);
  const f = (k:string,v:string) => setForm(p=>({...p,[k]:v}));
  async function submit() {
    if (!form.client_id) return;
    setSaving(true);
    try {
      await fetch('/api/admin/wealth-management/insurance-reviews', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ...form, client_id:parseInt(form.client_id), life_coverage:parseFloat(form.life_coverage)||null, life_premium:parseFloat(form.life_premium)||null, disability_benefit:parseFloat(form.disability_benefit)||null, disability_premium:parseFloat(form.disability_premium)||null, ci_coverage:parseFloat(form.ci_coverage)||null, ci_premium:parseFloat(form.ci_premium)||null, health_dental_premium:parseFloat(form.health_dental_premium)||null, home_premium:parseFloat(form.home_premium)||null, auto_premium:parseFloat(form.auto_premium)||null, gaps_identified:form.gaps_identified.split(',').map(s=>s.trim()).filter(Boolean) }) });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-4 text-slate-800">New Insurance Review</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500">Client *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.client_id} onChange={e=>f('client_id',e.target.value)}><option value="">Select…</option>{clients.map(c=><option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Review Date</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.review_date} onChange={e=>f('review_date',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Life Insurance Provider</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.life_insurance_provider} onChange={e=>f('life_insurance_provider',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Life Coverage</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.life_coverage} onChange={e=>f('life_coverage',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Disability Provider</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.disability_provider} onChange={e=>f('disability_provider',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Disability Monthly Benefit</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.disability_benefit} onChange={e=>f('disability_benefit',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Critical Illness Provider</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.critical_illness_provider} onChange={e=>f('critical_illness_provider',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">CI Coverage</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.ci_coverage} onChange={e=>f('ci_coverage',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Health & Dental Provider</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.health_dental_provider} onChange={e=>f('health_dental_provider',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">H&D Monthly Premium</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.health_dental_premium} onChange={e=>f('health_dental_premium',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Home Insurance Provider</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.home_insurance_provider} onChange={e=>f('home_insurance_provider',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Auto Insurance Provider</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.auto_insurance_provider} onChange={e=>f('auto_insurance_provider',e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Gaps Identified (comma-separated)</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.gaps_identified} onChange={e=>f('gaps_identified',e.target.value)} placeholder="e.g. No disability coverage, Under-insured life" /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Recommendations</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={3} value={form.recommendations} onChange={e=>f('recommendations',e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border rounded hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50">{saving?'Saving…':'Save Review'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function WealthManagementPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [dashboard, setDashboard] = useState<any>(null);
  const [clients, setClients] = useState<WmClient[]>([]);
  const [goals, setGoals] = useState<WmGoal[]>([]);
  const [snapshots, setSnapshots] = useState<WmSnapshot[]>([]);
  const [insurance, setInsurance] = useState<WmInsurance[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [showAddClient, setShowAddClient] = useState(false);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [showAddSnapshot, setShowAddSnapshot] = useState(false);
  const [showAddInsurance, setShowAddInsurance] = useState(false);
  const [aiOutput, setAiOutput] = useState('');
  const [aiMode, setAiMode] = useState<'plan'|'debt'>('plan');
  const [aiLoading, setAiLoading] = useState(false);
  const [updateGoalId, setUpdateGoalId] = useState<number|null>(null);
  const [updateGoalAmt, setUpdateGoalAmt] = useState('');

  const loadDashboard = useCallback(async () => {
    try { const r = await fetch('/api/admin/wealth-management'); setDashboard(await r.json()); } catch {}
  }, []);
  const loadClients = useCallback(async () => {
    try { const r = await fetch('/api/admin/wealth-management/clients'); setClients(await r.json()); } catch {}
  }, []);
  const loadGoals = useCallback(async () => {
    const qs = selectedClient ? `?client_id=${selectedClient}` : '';
    try { const r = await fetch(`/api/admin/wealth-management/goals${qs}`); setGoals(await r.json()); } catch {}
  }, [selectedClient]);
  const loadSnapshots = useCallback(async () => {
    const qs = selectedClient ? `?client_id=${selectedClient}` : '';
    try { const r = await fetch(`/api/admin/wealth-management/snapshots${qs}`); setSnapshots(await r.json()); } catch {}
  }, [selectedClient]);
  const loadInsurance = useCallback(async () => {
    const qs = selectedClient ? `?client_id=${selectedClient}` : '';
    try { const r = await fetch(`/api/admin/wealth-management/insurance-reviews${qs}`); setInsurance(await r.json()); } catch {}
  }, [selectedClient]);

  useEffect(() => { loadDashboard(); loadClients(); }, []);
  useEffect(() => { loadGoals(); loadSnapshots(); loadInsurance(); }, [selectedClient]);

  async function generatePlan() {
    const c = clients.find(x=>String(x.id)===selectedClient);
    if (!c) { setAiOutput('Please select a client first.'); return; }
    setAiLoading(true); setAiOutput('');
    try {
      const endpoint = aiMode === 'plan' ? 'ai-financial-plan' : 'ai-debt-strategy';
      const snap = snapshots.find(s=>s.client_id===c.id);
      const r = await fetch(`/api/admin/wealth-management/${endpoint}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ ...c, ...snap }) });
      const data = await r.json();
      setAiOutput(data.plan || data.strategy || JSON.stringify(data));
    } finally { setAiLoading(false); }
  }

  async function updateGoalProgress() {
    if (!updateGoalId) return;
    await fetch(`/api/admin/wealth-management/goals/${updateGoalId}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ current_amount:parseFloat(updateGoalAmt) }) });
    setUpdateGoalId(null); setUpdateGoalAmt(''); loadGoals();
  }

  const reviewsDueSoon = clients.filter(c => {
    if (!c.next_review_date) return false;
    const days = Math.floor((new Date(c.next_review_date).getTime() - Date.now())/(86400000));
    return days >= 0 && days <= 30;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-2xl font-bold text-slate-800">Financial Planning & Wealth Management</h1>
        <p className="text-sm text-gray-500 mt-0.5">Retail financial planning for everyday Canadians — budgeting, goals, debt, insurance & wellness</p>
      </div>
      {/* Tabs */}
      <div className="bg-white border-b px-6">
        <div className="flex gap-0 overflow-x-auto">
          {TABS.map(t=>(
            <button key={t} onClick={()=>setTab(t)} className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab===t?'border-blue-600 text-blue-600':'border-transparent text-gray-500 hover:text-gray-700'}`}>{TAB_LABELS[t]}</button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {/* DASHBOARD */}
        {tab==='dashboard' && (
          <div className="space-y-6">
            {dashboard ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <KpiCard label="Active Clients" value={dashboard.active_clients} color="blue" />
                <KpiCard label="Reviews Due (30d)" value={dashboard.reviews_due_30d} color={dashboard.reviews_due_30d>0?'amber':'green'} />
                <KpiCard label="Goals Behind" value={dashboard.goals_behind_schedule} color={dashboard.goals_behind_schedule>0?'red':'green'} />
                <KpiCard label="Total AUM Snapshot" value={fmtCad(dashboard.total_aum_snapshot)} color="purple" />
                <KpiCard label="Avg Net Worth" value={fmtCad(dashboard.net_worth_avg)} color="teal" />
                <KpiCard label="Total Clients" value={dashboard.total_clients} color="gray" />
              </div>
            ) : <div className="h-24 bg-gray-100 rounded-lg animate-pulse" />}

            {reviewsDueSoon.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h3 className="font-semibold text-amber-800 mb-2">Reviews Due in 30 Days</h3>
                <div className="space-y-1">
                  {reviewsDueSoon.map(c=>{
                    const days = Math.floor((new Date(c.next_review_date).getTime()-Date.now())/86400000);
                    return <div key={c.id} className="flex items-center justify-between text-sm"><span>{c.first_name} {c.last_name}</span><span className="text-amber-700 font-medium">{days===0?'Today':`${days}d`}</span></div>;
                  })}
                </div>
              </div>
            )}

            <div>
              <h3 className="font-semibold text-slate-700 mb-3">Recent Clients</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {clients.slice(0,6).map(c=>(
                  <div key={c.id} className="bg-white rounded-lg border p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">{initials(c.first_name,c.last_name)}</div>
                      <div><p className="font-semibold text-sm text-slate-800">{c.first_name} {c.last_name}</p><p className="text-xs text-gray-400">{c.employment_status?.replace(/_/g,' ')}</p></div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Badge label={c.client_type} color="blue" />
                      <Badge label={c.risk_tolerance} color={c.risk_tolerance==='conservative'?'green':c.risk_tolerance==='aggressive'?'red':'amber'} />
                      <Badge label={c.status} color={statusColor(c.status)} />
                    </div>
                    <p className="text-sm text-gray-600 mt-2">Net Worth: <strong>{fmtCad(c.latest_net_worth||0)}</strong></p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* CLIENTS */}
        {tab==='clients' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-800">Clients ({clients.length})</h2>
              <button onClick={()=>setShowAddClient(true)} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">+ Add Client</button>
            </div>
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b"><tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Client</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Income</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Net Worth</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Review Freq</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Next Review</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                </tr></thead>
                <tbody>
                  {clients.map(c=>(
                    <tr key={c.id} className="border-b hover:bg-gray-50 cursor-pointer" onClick={()=>setSelectedClient(String(c.id))}>
                      <td className="px-4 py-3"><div className="font-medium">{c.first_name} {c.last_name}</div><div className="text-xs text-gray-400">{c.email}</div></td>
                      <td className="px-4 py-3"><Badge label={c.client_type} color="blue" /></td>
                      <td className="px-4 py-3">{c.annual_income ? fmtCad(c.annual_income) : '—'}</td>
                      <td className="px-4 py-3 font-medium">{fmtCad(c.latest_net_worth||0)}</td>
                      <td className="px-4 py-3">{c.review_frequency?.replace(/_/g,' ')}</td>
                      <td className="px-4 py-3">{c.next_review_date ? <span className={new Date(c.next_review_date)<new Date()?'text-red-600 font-medium':''}>{fmtDate(c.next_review_date)}</span> : '—'}</td>
                      <td className="px-4 py-3"><Badge label={c.status} color={statusColor(c.status)} /></td>
                    </tr>
                  ))}
                  {!clients.length && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No clients yet. Add your first client.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* FINANCIAL SNAPSHOT */}
        {tab==='snapshot' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-slate-800">Financial Snapshots</h2>
                <select className="border rounded px-2 py-1.5 text-sm" value={selectedClient} onChange={e=>setSelectedClient(e.target.value)}>
                  <option value="">All clients</option>
                  {clients.map(c=><option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                </select>
              </div>
              <button onClick={()=>setShowAddSnapshot(true)} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">+ New Snapshot</button>
            </div>
            <div className="space-y-3">
              {snapshots.map(s=>(
                <div key={s.id} className="bg-white rounded-lg border p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div><p className="font-semibold text-slate-800">{(s as any).first_name} {(s as any).last_name}</p><p className="text-xs text-gray-400">{fmtDate(s.snapshot_date)}</p></div>
                    <div className={`text-xl font-bold ${s.net_worth>=0?'text-blue-700':'text-red-700'}`}>{fmtCad(s.net_worth)}</div>
                  </div>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-3 text-sm">
                    <div className="text-center p-2 bg-green-50 rounded"><p className="text-xs text-gray-400">RRSP</p><p className="font-semibold text-green-700">{fmtCad(s.rrsp_balance)}</p></div>
                    <div className="text-center p-2 bg-teal-50 rounded"><p className="text-xs text-gray-400">TFSA</p><p className="font-semibold text-teal-700">{fmtCad(s.tfsa_balance)}</p></div>
                    <div className="text-center p-2 bg-blue-50 rounded"><p className="text-xs text-gray-400">FHSA</p><p className="font-semibold text-blue-700">{fmtCad(s.fhsa_balance)}</p></div>
                    <div className="text-center p-2 bg-red-50 rounded"><p className="text-xs text-gray-400">Mortgage</p><p className="font-semibold text-red-700">{fmtCad(s.mortgage_balance)}</p></div>
                    <div className="text-center p-2 bg-orange-50 rounded"><p className="text-xs text-gray-400">Credit Cards</p><p className="font-semibold text-orange-700">{fmtCad(s.credit_card_balance)}</p></div>
                    <div className="text-center p-2 bg-purple-50 rounded"><p className="text-xs text-gray-400">Mo. Savings</p><p className="font-semibold text-purple-700">{fmtCad(s.monthly_savings)}</p></div>
                  </div>
                </div>
              ))}
              {!snapshots.length && <div className="text-center py-12 text-gray-400">No snapshots yet. Record a client's financial snapshot to track net worth over time.</div>}
            </div>
          </div>
        )}

        {/* GOALS */}
        {tab==='goals' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-slate-800">Financial Goals</h2>
                <select className="border rounded px-2 py-1.5 text-sm" value={selectedClient} onChange={e=>setSelectedClient(e.target.value)}>
                  <option value="">All clients</option>
                  {clients.map(c=><option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                </select>
              </div>
              <button onClick={()=>setShowAddGoal(true)} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">+ Add Goal</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {goals.map(g=>{
                const pct = g.target_amount>0 ? Math.min(100, Math.round(g.current_amount/g.target_amount*100)) : 0;
                return (
                  <div key={g.id} className="bg-white rounded-lg border p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div><p className="font-semibold text-slate-800 text-sm">{g.goal_name}</p><p className="text-xs text-gray-400">{g.first_name} {g.last_name}</p></div>
                      <Badge label={g.priority} color={priorityColor(g.priority)} />
                    </div>
                    <div className="flex gap-1.5 mb-3">
                      <Badge label={g.goal_type.replace(/_/g,' ')} color="blue" />
                      <Badge label={g.status} color={statusColor(g.status)} />
                    </div>
                    <div className="mb-2">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>{fmtCad(g.current_amount)} of {fmtCad(g.target_amount)}</span>
                        <span className="font-semibold">{pct}%</span>
                      </div>
                      <ProgressBar pct={pct} />
                    </div>
                    {g.target_date && <p className="text-xs text-gray-400 mb-2">Target: {fmtDate(g.target_date)}</p>}
                    {g.monthly_contribution && <p className="text-xs text-gray-500">Monthly: {fmtCad(g.monthly_contribution)}</p>}
                    {updateGoalId===g.id ? (
                      <div className="mt-2 flex gap-1">
                        <input type="number" className="flex-1 border rounded px-2 py-1 text-sm" value={updateGoalAmt} onChange={e=>setUpdateGoalAmt(e.target.value)} placeholder="New amount" />
                        <button onClick={updateGoalProgress} className="px-2 py-1 text-xs bg-blue-600 text-white rounded">Save</button>
                        <button onClick={()=>setUpdateGoalId(null)} className="px-2 py-1 text-xs border rounded">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={()=>{setUpdateGoalId(g.id);setUpdateGoalAmt(String(g.current_amount));}} className="mt-2 text-xs text-blue-600 hover:underline">Update Progress</button>
                    )}
                  </div>
                );
              })}
              {!goals.length && <div className="col-span-3 text-center py-12 text-gray-400">No goals found. Add a financial goal to track progress.</div>}
            </div>
          </div>
        )}

        {/* INSURANCE */}
        {tab==='insurance' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-slate-800">Insurance Reviews</h2>
                <select className="border rounded px-2 py-1.5 text-sm" value={selectedClient} onChange={e=>setSelectedClient(e.target.value)}>
                  <option value="">All clients</option>
                  {clients.map(c=><option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                </select>
              </div>
              <button onClick={()=>setShowAddInsurance(true)} className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700">+ Add Review</button>
            </div>
            <div className="space-y-4">
              {insurance.map(ins=>(
                <div key={ins.id} className="bg-white rounded-lg border p-4">
                  <div className="flex justify-between items-center mb-3">
                    <div><p className="font-semibold text-slate-800">{(ins as any).first_name} {(ins as any).last_name}</p><p className="text-xs text-gray-400">Review: {fmtDate(ins.review_date)}</p></div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm mb-3">
                    {ins.life_insurance_provider && <div className="p-2 bg-gray-50 rounded"><p className="text-xs text-gray-400">Life Insurance</p><p className="font-medium">{ins.life_insurance_provider}</p>{ins.life_coverage&&<p className="text-xs text-gray-500">Coverage: {fmtCad(ins.life_coverage)}</p>}</div>}
                    {(ins as any).disability_provider && <div className="p-2 bg-gray-50 rounded"><p className="text-xs text-gray-400">Disability</p><p className="font-medium">{(ins as any).disability_provider}</p></div>}
                    {(ins as any).critical_illness_provider && <div className="p-2 bg-gray-50 rounded"><p className="text-xs text-gray-400">Critical Illness</p><p className="font-medium">{(ins as any).critical_illness_provider}</p></div>}
                  </div>
                  {ins.gaps_identified && ins.gaps_identified.length>0 && (
                    <div className="bg-red-50 rounded p-2 mb-2">
                      <p className="text-xs font-semibold text-red-700 mb-1">Gaps Identified:</p>
                      <div className="flex flex-wrap gap-1">{ins.gaps_identified.map((g,i)=><Badge key={i} label={g} color="red" />)}</div>
                    </div>
                  )}
                  {ins.recommendations && <p className="text-xs text-gray-600 mt-2">{ins.recommendations}</p>}
                </div>
              ))}
              {!insurance.length && <div className="text-center py-12 text-gray-400">No insurance reviews found.</div>}
            </div>
          </div>
        )}

        {/* AI FINANCIAL PLANNER */}
        {tab==='ai' && (
          <div className="max-w-3xl">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">AI Financial Planner</h2>
            <div className="bg-white rounded-lg border p-4 mb-4">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Select Client</label>
                  <select className="w-full border rounded px-2 py-1.5 text-sm" value={selectedClient} onChange={e=>setSelectedClient(e.target.value)}>
                    <option value="">Select a client…</option>
                    {clients.map(c=><option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Analysis Type</label>
                  <select className="w-full border rounded px-2 py-1.5 text-sm" value={aiMode} onChange={e=>setAiMode(e.target.value as any)}>
                    <option value="plan">Comprehensive Financial Plan</option>
                    <option value="debt">Debt Elimination Strategy</option>
                  </select>
                </div>
              </div>
              {selectedClient && clients.find(c=>String(c.id)===selectedClient) && (() => {
                const c = clients.find(x=>String(x.id)===selectedClient)!;
                return <div className="bg-gray-50 rounded p-3 text-sm mb-4"><p className="text-gray-600"><strong>{c.first_name} {c.last_name}</strong> — {c.employment_status?.replace(/_/g,' ')}, Income: {fmtCad(c.annual_income||0)}, Risk: {c.risk_tolerance}</p></div>;
              })()}
              <button onClick={generatePlan} disabled={aiLoading||!selectedClient} className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium">{aiLoading?'Generating plan…':'Generate AI Analysis'}</button>
            </div>
            {aiOutput && (
              <div className="bg-white rounded-lg border p-4">
                <h3 className="font-semibold text-slate-800 mb-3">{aiMode==='plan'?'Financial Plan':'Debt Strategy'}</h3>
                <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">{aiOutput}</pre>
              </div>
            )}
          </div>
        )}

        {/* CALENDAR */}
        {tab==='calendar' && (
          <div>
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Review Calendar</h2>
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b"><tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Client</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Review Frequency</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Last Review</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Next Review</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Planner</th>
                </tr></thead>
                <tbody>
                  {clients.filter(c=>c.status==='active').sort((a,b)=>{
                    if (!a.next_review_date) return 1;
                    if (!b.next_review_date) return -1;
                    return new Date(a.next_review_date).getTime()-new Date(b.next_review_date).getTime();
                  }).map(c=>{
                    const daysToReview = c.next_review_date ? Math.floor((new Date(c.next_review_date).getTime()-Date.now())/86400000) : null;
                    const urgency = daysToReview===null?'gray':daysToReview<0?'red':daysToReview<=7?'orange':daysToReview<=30?'amber':'green';
                    return (
                      <tr key={c.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{c.first_name} {c.last_name}</td>
                        <td className="px-4 py-3"><Badge label={c.review_frequency?.replace(/_/g,' ')||'annual'} color="blue" /></td>
                        <td className="px-4 py-3">{fmtDate(c.last_review_date)}</td>
                        <td className="px-4 py-3">{fmtDate(c.next_review_date)}</td>
                        <td className="px-4 py-3">
                          {daysToReview===null?<Badge label="Not scheduled" />:daysToReview<0?<Badge label="Overdue" color="red" />:<Badge label={`${daysToReview}d`} color={urgency as any} />}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{c.current_planner||'—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showAddClient && <AddClientModal onClose={()=>setShowAddClient(false)} onSaved={()=>{setShowAddClient(false);loadClients();loadDashboard();}} />}
      {showAddGoal && <AddGoalModal clients={clients} onClose={()=>setShowAddGoal(false)} onSaved={()=>{setShowAddGoal(false);loadGoals();}} />}
      {showAddSnapshot && <AddSnapshotModal clients={clients} onClose={()=>setShowAddSnapshot(false)} onSaved={()=>{setShowAddSnapshot(false);loadSnapshots();loadDashboard();}} />}
      {showAddInsurance && <AddInsuranceModal clients={clients} onClose={()=>setShowAddInsurance(false)} onSaved={()=>{setShowAddInsurance(false);loadInsurance();}} />}
    </div>
  );
}
