'use client';
import { useEffect, useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
type TaxClient = {
  id: number; client_type: string; name: string; sin: string; bn: string;
  email: string; phone: string; city: string; province: string;
  corporation_name: string; employment_type: string;
  does_t1: boolean; does_t2: boolean; does_gst: boolean; does_payroll: boolean; does_bookkeeping: boolean;
  gst_filing_frequency: string; status: string; referral_source: string;
  num_dependants: number; marital_status: string; notes: string;
  fiscal_year_end: string; num_employees: number; industry: string;
  created_at: string;
};
type TaxReturn = {
  id: number; client_id: number; client_name: string; return_type: string;
  tax_year: number; period_start: string; period_end: string;
  status: string; documents_received: boolean; assigned_to: string;
  revenue: string; expenses: string; net_income: string; taxable_income: string;
  federal_tax: string; provincial_tax: string; total_tax_owing: string; refund_amount: string;
  gst_collected: string; gst_paid: string; gst_net: string;
  service_fee: string; invoiced_at: string; paid_at: string;
  filed_date: string; confirmation_number: string; due_date: string;
  notes: string; created_at: string; client_type: string;
};
type TaxDocument = {
  id: number; return_id: number; document_name: string; document_type: string;
  status: string; notes: string; created_at: string;
};
type TaxDeadline = {
  id: number; name: string; deadline_date: string; return_type: string;
  description: string; is_recurring: boolean; recurring_pattern: string;
};
type Stats = {
  return_stats: { return_type: string; status: string; cnt: string }[];
  client_stats: { t1_clients: string; t2_clients: string; gst_clients: string; payroll_clients: string; bookkeeping_clients: string; total: string };
  revenue: { revenue_this_month: string; outstanding: string };
  overdue_returns: TaxReturn[];
};

// ─── Constants ────────────────────────────────────────────────────────────────
const TABS = ['dashboard','clients','returns','documents','deadlines','ai-advisor','billing'] as const;
type Tab = typeof TABS[number];

const RETURN_STATUSES = ['not_started','docs_requested','docs_received','in_progress','review','filed'];
const RETURN_TYPES = ['T1','T2','GST_HST','T4','T4A','T5','T3','payroll','bookkeeping'];

const RETURN_COLORS: Record<string,string> = {
  T1: 'bg-blue-600 text-white', T2: 'bg-green-600 text-white',
  GST_HST: 'bg-orange-500 text-white', T4: 'bg-purple-600 text-white',
  T4A: 'bg-pink-600 text-white', T5: 'bg-teal-600 text-white',
  payroll: 'bg-violet-600 text-white', bookkeeping: 'bg-slate-600 text-white',
  T3: 'bg-amber-600 text-white',
};
const STATUS_COLORS: Record<string,string> = {
  not_started: 'bg-gray-100 text-gray-600', docs_requested: 'bg-yellow-100 text-yellow-700',
  docs_received: 'bg-blue-100 text-blue-700', in_progress: 'bg-indigo-100 text-indigo-700',
  review: 'bg-purple-100 text-purple-700', filed: 'bg-green-100 text-green-800',
  active: 'bg-green-100 text-green-700', inactive: 'bg-gray-100 text-gray-500',
  new: 'bg-blue-100 text-blue-700', vip: 'bg-amber-100 text-amber-700',
  pending: 'bg-yellow-100 text-yellow-600', received: 'bg-blue-100 text-blue-700',
  processed: 'bg-green-100 text-green-700',
};
const DEADLINE_COLORS: Record<string,string> = {
  T1: 'bg-blue-100 border-blue-300 text-blue-800',
  T2: 'bg-green-100 border-green-300 text-green-800',
  GST_HST: 'bg-orange-100 border-orange-300 text-orange-800',
  payroll: 'bg-purple-100 border-purple-300 text-purple-800',
  T4: 'bg-pink-100 border-pink-300 text-pink-800',
  T5: 'bg-teal-100 border-teal-300 text-teal-800',
};

const T1_DOCS = ['T4 Employment Income','T5 Investment Income','T5008 Securities','RRSP Receipts','TFSA Contributions','Charitable Donation Receipts','Medical Expense Receipts','Tuition (T2202)','Union/Professional Dues','Moving Expenses','Home Office Expenses','Childcare Receipts','Disability Certificate (T2201)','Rental Income/Expenses','Business Income/Expenses (T2125)','Prior Year NOA'];
const T2_DOCS = ['Bank Statements (all accounts)','All Invoices/Receipts','Payroll Summaries (T4 Summary)','Asset Additions/Disposals Schedule','Prior Year T2 Return','HST/GST Returns Filed','Shareholder Loan Details','Dividends Paid Records','Corporate Bank Reconciliation','Accounts Receivable/Payable Aging'];
const GST_DOCS = ['Sales Summary by Period','Purchase/Input Tax Credit Receipts','Prior Period GST Return','Business Bank Statements','HST Collected Ledger','ITCs Claimed Ledger'];
const PAYROLL_DOCS = ['Employee List with SINs','Payroll Register by Pay Period','TD1 Federal & Provincial Forms','Record of Employment (ROEs)','PD7A Remittance Summaries','Year-End Payroll Summary'];

const DOC_CHECKLISTS: Record<string,string[]> = { T1: T1_DOCS, T2: T2_DOCS, GST_HST: GST_DOCS, payroll: PAYROLL_DOCS };

const QUICK_PROMPTS = [
  { label:'Self-employed deductions', prompt:'What deductions can a self-employed client claim on their T1 return in Canada?' },
  { label:'T2 Small Business Deduction', prompt:'Explain T2 small business deduction eligibility and how to calculate it for a Canadian controlled private corporation (CCPC).' },
  { label:'GST Quick Method', prompt:'Is my client eligible for the GST/HST Quick Method of accounting? What are the benefits and how is it calculated?' },
  { label:'Home Office Methods', prompt:'What are the two methods for calculating home office expenses in Canada (T777 detailed vs flat rate)? Which is better?' },
];

const API = '/api/admin/tax-services';

function badge(val: string, map: Record<string,string>, fallback = 'bg-gray-100 text-gray-600') {
  return `inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[val] ?? fallback}`;
}
const fmt$ = (v?: string | number) => v ? `$${parseFloat(String(v)).toLocaleString('en-CA',{minimumFractionDigits:0,maximumFractionDigits:0})}` : '—';

// ─── Component ────────────────────────────────────────────────────────────────
export default function TaxServicesPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [stats, setStats] = useState<Stats | null>(null);
  const [clients, setClients] = useState<TaxClient[]>([]);
  const [returns, setReturns] = useState<TaxReturn[]>([]);
  const [deadlines, setDeadlines] = useState<TaxDeadline[]>([]);
  const [selectedReturn, setSelectedReturn] = useState<TaxReturn | null>(null);
  const [returnDocs, setReturnDocs] = useState<TaxDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  // Modal states
  const [showClientModal, setShowClientModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showFileModal, setShowFileModal] = useState<TaxReturn | null>(null);
  const [showDocModal, setShowDocModal] = useState(false);

  // AI
  const [aiReturnType, setAiReturnType] = useState('T1');
  const [aiSituation, setAiSituation] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Forms
  const [clientForm, setClientForm] = useState({
    client_type:'personal', name:'', sin:'', bn:'', email:'', phone:'',
    address:'', city:'Calgary', province:'AB', postal_code:'',
    employment_type:'', corporation_name:'', industry:'', num_employees:'0',
    does_t1:false, does_t2:false, does_gst:false, gst_filing_frequency:'',
    does_payroll:false, payroll_frequency:'', does_bookkeeping:false,
    status:'active', referral_source:'', notes:'',
  });
  const [returnForm, setReturnForm] = useState({
    client_id:'', return_type:'T1', tax_year: String(new Date().getFullYear()-1),
    period_start:'', period_end:'', assigned_to:'preparer', service_fee:'', due_date:'', notes:'',
  });
  const [docForm, setDocForm] = useState({ document_name:'', document_type:'', notes:'' });
  const [fileForm, setFileForm] = useState({ confirmation_number:'', netfile_access_code:'' });

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const [s, c, r, d] = await Promise.all([
        fetch(`${API}/stats`).then(x=>x.json()),
        fetch(`${API}/clients`).then(x=>x.json()),
        fetch(`${API}/returns`).then(x=>x.json()),
        fetch(`${API}/deadlines?days=90`).then(x=>x.json()),
      ]);
      setStats(s); setClients(c.clients ?? []); setReturns(r.returns ?? []); setDeadlines(d.deadlines ?? []);
    } catch { setErr('Failed to load data.'); }
    finally { setLoading(false); }
  }, []);

  const loadReturnDetail = useCallback(async (ret: TaxReturn) => {
    setSelectedReturn(ret);
    const docs = await fetch(`${API}/returns/${ret.id}/documents`).then(r=>r.json());
    setReturnDocs(docs.documents ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Submissions ─────────────────────────────────────────────────────────────
  async function submitClient() {
    const r = await fetch(`${API}/clients`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(clientForm) });
    if (r.ok) { setShowClientModal(false); load(); }
    else { const e = await r.json(); setErr(e.error || 'Failed to save.'); }
  }
  async function submitReturn() {
    const r = await fetch(`${API}/returns`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(returnForm) });
    if (r.ok) { setShowReturnModal(false); load(); }
    else { const e = await r.json(); setErr(e.error || 'Failed to save.'); }
  }
  async function submitFile() {
    if (!showFileModal) return;
    const r = await fetch(`${API}/returns/${showFileModal.id}/file`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(fileForm) });
    if (r.ok) { setShowFileModal(null); load(); }
    else { const e = await r.json(); setErr(e.error || 'Failed to file.'); }
  }
  async function submitDoc() {
    if (!selectedReturn) return;
    const r = await fetch(`${API}/returns/${selectedReturn.id}/documents`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(docForm) });
    if (r.ok) { setShowDocModal(false); loadReturnDetail(selectedReturn); }
    else { const e = await r.json(); setErr(e.error || 'Failed to save.'); }
  }
  async function updateStatus(retId: number, status: string) {
    await fetch(`${API}/returns/${retId}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status }) });
    load();
    if (selectedReturn?.id === retId) setSelectedReturn(prev => prev ? { ...prev, status } : null);
  }
  async function markPaid(retId: number) {
    await fetch(`${API}/returns/${retId}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ mark_paid: true }) });
    load();
  }
  async function updateDocStatus(docId: number, status: string) {
    if (!selectedReturn) return;
    const doc = returnDocs.find(d=>d.id===docId);
    if (!doc) return;
    await fetch(`${API}/returns/${selectedReturn.id}/documents`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ document_name: doc.document_name, document_type: doc.document_type, status }) });
    loadReturnDetail(selectedReturn);
  }
  async function runAi() {
    setAiLoading(true); setAiResult('');
    const r = await fetch(`${API}/ai-advisor`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ return_type: aiReturnType, situation_description: aiSituation }) });
    const d = await r.json(); setAiResult(d.advice ?? d.error ?? ''); setAiLoading(false);
  }

  const isOverdue = (d: string, status: string) => d && status !== 'filed' && new Date(d) < new Date();

  // ── Kanban columns ───────────────────────────────────────────────────────────
  const kanbanCols = RETURN_STATUSES;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-slate-800 text-white px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Tax Services Portal</h1>
          <p className="text-slate-400 text-sm">Canadian Tax CRM — T1 / T2 / GST / Payroll / Bookkeeping</p>
        </div>
        <button onClick={load} className="text-slate-300 hover:text-white text-sm border border-slate-600 px-3 py-1 rounded">↻ Refresh</button>
      </div>

      {err && <div className="mx-6 mt-3 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">{err} <button onClick={()=>setErr('')} className="ml-2 text-red-400">✕</button></div>}

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200 px-6 flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              tab === t ? 'border-slate-700 text-slate-800' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}
          </button>
        ))}
      </div>

      <div className="p-6">
        {loading && <div className="text-center py-12 text-gray-400">Loading…</div>}

        {/* ── TAB 1: Dashboard ── */}
        {!loading && tab === 'dashboard' && stats && (
          <div className="space-y-6">
            {/* Upcoming deadlines alert strip */}
            {deadlines.slice(0,5).length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="font-semibold text-amber-800 mb-2 text-sm">Upcoming CRA Deadlines (next 90 days)</div>
                <div className="flex flex-wrap gap-2">
                  {deadlines.slice(0,5).map(d=>(
                    <div key={d.id} className={`border rounded px-3 py-1.5 text-xs font-medium ${DEADLINE_COLORS[d.return_type]??'bg-gray-100 border-gray-200 text-gray-700'}`}>
                      {d.name} — {new Date(d.deadline_date).toLocaleDateString('en-CA')}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label:'Active Clients', val: stats.client_stats.total },
                { label:'T1 Clients', val: stats.client_stats.t1_clients },
                { label:'Revenue This Month', val: fmt$(stats.revenue.revenue_this_month) },
                { label:'Outstanding Invoices', val: fmt$(stats.revenue.outstanding) },
              ].map(k=>(
                <div key={k.label} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="text-2xl font-bold text-gray-800">{k.val ?? 0}</div>
                  <div className="text-sm text-gray-500 mt-1">{k.label}</div>
                </div>
              ))}
            </div>

            {/* Active returns by type */}
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Active Returns by Type</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {RETURN_TYPES.map(rt => {
                  const rtRows = stats.return_stats.filter(r=>r.return_type===rt);
                  const total = rtRows.reduce((s,r)=>s+parseInt(r.cnt),0);
                  const filed = parseInt(rtRows.find(r=>r.status==='filed')?.cnt??'0');
                  const pct = total ? Math.round(filed/total*100) : 0;
                  return (
                    <div key={rt} className="border border-gray-100 rounded-lg p-3">
                      <div className="flex justify-between items-center mb-2">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${RETURN_COLORS[rt]??'bg-gray-500 text-white'}`}>{rt}</span>
                        <span className="text-sm font-bold text-gray-800">{total}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="h-full bg-green-500 rounded-full" style={{width:`${pct}%`}}/>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">{filed}/{total} filed</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Clients by service */}
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Client Services Overview</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { label:'T1 Personal', val: stats.client_stats.t1_clients },
                  { label:'T2 Corporate', val: stats.client_stats.t2_clients },
                  { label:'GST/HST', val: stats.client_stats.gst_clients },
                  { label:'Payroll', val: stats.client_stats.payroll_clients },
                  { label:'Bookkeeping', val: stats.client_stats.bookkeeping_clients },
                ].map(s=>(
                  <div key={s.label} className="text-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="text-xl font-bold text-gray-800">{s.val ?? 0}</div>
                    <div className="text-xs text-gray-500 mt-1">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Overdue returns */}
            {stats.overdue_returns.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-5">
                <h3 className="font-semibold text-red-800 mb-3">Overdue Returns ({stats.overdue_returns.length})</h3>
                <div className="space-y-2">
                  {stats.overdue_returns.map(r=>(
                    <div key={r.id} className="flex items-center justify-between bg-white border border-red-100 rounded p-3">
                      <div>
                        <span className="font-medium text-gray-800 text-sm">{r.client_name}</span>
                        <span className={`ml-2 text-xs px-1.5 py-0.5 rounded font-medium ${RETURN_COLORS[r.return_type]??'bg-gray-500 text-white'}`}>{r.return_type}</span>
                        {r.tax_year && <span className="ml-1 text-xs text-gray-400">({r.tax_year})</span>}
                      </div>
                      <div className="text-sm font-medium text-red-600">Due: {new Date(r.due_date).toLocaleDateString('en-CA')}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: Clients ── */}
        {!loading && tab === 'clients' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800">Clients ({clients.length})</h2>
              <button onClick={()=>setShowClientModal(true)}
                className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-700">
                + Add Client
              </button>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>{['Name','Type','SIN / BN','Services','Status','City'].map(h=>(
                    <th key={h} className="px-4 py-3 text-left font-medium text-gray-600">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {clients.map(c=>(
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{c.name}</div>
                        {c.corporation_name && <div className="text-xs text-gray-400">{c.corporation_name}</div>}
                        <div className="text-xs text-gray-400">{c.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${c.client_type==='personal'?'bg-blue-100 text-blue-700':c.client_type==='corporate'?'bg-green-100 text-green-700':'bg-purple-100 text-purple-700'}`}>
                          {c.client_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                        {c.sin ? `SIN: ••••${c.sin}` : ''}{c.bn ? <span className="block">BN: {c.bn}</span> : null}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {c.does_t1 && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">T1</span>}
                          {c.does_t2 && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">T2</span>}
                          {c.does_gst && <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">GST</span>}
                          {c.does_payroll && <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Payroll</span>}
                          {c.does_bookkeeping && <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">Books</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className={badge(c.status,STATUS_COLORS)}>{c.status}</span></td>
                      <td className="px-4 py-3 text-gray-500">{c.city}, {c.province}</td>
                    </tr>
                  ))}
                  {clients.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No clients yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB 3: Returns (Work Queue) Kanban ── */}
        {!loading && tab === 'returns' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800">Returns — Work Queue ({returns.length})</h2>
              <button onClick={()=>setShowReturnModal(true)}
                className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-700">
                + New Return
              </button>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4">
              {kanbanCols.map(col => {
                const colReturns = returns.filter(r=>r.status===col);
                return (
                  <div key={col} className="flex-shrink-0 w-56">
                    <div className="bg-gray-100 rounded-t-lg px-3 py-2 flex justify-between items-center">
                      <span className="text-xs font-semibold text-gray-600 uppercase">{col.replace(/_/g,' ')}</span>
                      <span className="text-xs bg-white text-gray-600 rounded-full px-1.5 py-0.5 font-medium">{colReturns.length}</span>
                    </div>
                    <div className="space-y-2 p-2 bg-gray-50 rounded-b-lg min-h-32">
                      {colReturns.map(r=>(
                        <div key={r.id} className={`bg-white border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow ${isOverdue(r.due_date,r.status)?'border-red-300':'border-gray-200'}`}>
                          <div className="font-medium text-xs text-gray-800 mb-1">{r.client_name}</div>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${RETURN_COLORS[r.return_type]??'bg-gray-400 text-white'}`}>{r.return_type}</span>
                          {r.tax_year && <span className="ml-1 text-xs text-gray-400">{r.tax_year}</span>}
                          {r.due_date && (
                            <div className={`text-xs mt-1 ${isOverdue(r.due_date,r.status)?'text-red-600 font-medium':'text-gray-400'}`}>
                              Due: {new Date(r.due_date).toLocaleDateString('en-CA')}
                            </div>
                          )}
                          {r.service_fee && <div className="text-xs text-gray-500">{fmt$(r.service_fee)}</div>}
                          <div className="flex gap-1 mt-2">
                            <select className="flex-1 text-xs border border-gray-200 rounded px-1 py-0.5"
                              value={r.status} onChange={e=>updateStatus(r.id,e.target.value)}>
                              {RETURN_STATUSES.map(s=><option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
                            </select>
                            {r.status !== 'filed' && (
                              <button onClick={()=>{setShowFileModal(r);setFileForm({confirmation_number:'',netfile_access_code:''}); }}
                                className="text-xs bg-green-600 text-white px-1.5 py-0.5 rounded hover:bg-green-700 whitespace-nowrap">
                                File
                              </button>
                            )}
                          </div>
                          <button onClick={() => { loadReturnDetail(r); setTab('documents'); }}
                            className="mt-1 text-xs text-blue-600 hover:underline">
                            Docs
                          </button>
                        </div>
                      ))}
                      {colReturns.length === 0 && <div className="text-center py-4 text-xs text-gray-300">Empty</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── TAB 4: Documents ── */}
        {!loading && tab === 'documents' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800">Documents</h2>
              <button onClick={()=>setShowDocModal(true)} disabled={!selectedReturn}
                className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-700 disabled:opacity-40">
                + Add Document
              </button>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Return</label>
              <select className="border border-gray-200 rounded px-3 py-2 text-sm w-full md:w-96"
                value={selectedReturn?.id ?? ''}
                onChange={e => { const r=returns.find(x=>x.id===parseInt(e.target.value)); if(r) loadReturnDetail(r); }}>
                <option value=''>— Choose a return —</option>
                {returns.map(r=>(
                  <option key={r.id} value={r.id}>{r.client_name} — {r.return_type} {r.tax_year||''} ({r.status.replace(/_/g,' ')})</option>
                ))}
              </select>
            </div>
            {selectedReturn && (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h3 className="font-medium text-gray-800 mb-3">Documents Added ({returnDocs.length})</h3>
                  <div className="space-y-2">
                    {returnDocs.map(d=>(
                      <div key={d.id} className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-100">
                        <div>
                          <div className="text-sm font-medium text-gray-800">{d.document_name}</div>
                          {d.document_type && <div className="text-xs text-gray-400">{d.document_type}</div>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={badge(d.status,STATUS_COLORS)}>{d.status}</span>
                          <select className="text-xs border border-gray-200 rounded px-1 py-0.5"
                            value={d.status} onChange={e=>updateDocStatus(d.id,e.target.value)}>
                            {['pending','received','processed'].map(s=><option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                      </div>
                    ))}
                    {returnDocs.length === 0 && <p className="text-gray-400 text-sm">No documents added yet.</p>}
                  </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h3 className="font-medium text-gray-800 mb-3">Standard Checklist — {selectedReturn.return_type}</h3>
                  <div className="space-y-1">
                    {(DOC_CHECKLISTS[selectedReturn.return_type] ?? []).map(item => {
                      const received = returnDocs.some(d=>d.document_name===item&&['received','processed'].includes(d.status));
                      return (
                        <div key={item} className={`flex items-center gap-2 p-2 rounded text-sm ${received?'bg-green-50':'bg-gray-50'}`}>
                          <span className={`text-base ${received?'text-green-500':'text-gray-300'}`}>{received?'✓':'○'}</span>
                          <span className={received?'text-green-700':'text-gray-600'}>{item}</span>
                        </div>
                      );
                    })}
                    {!(DOC_CHECKLISTS[selectedReturn.return_type]) && (
                      <p className="text-gray-400 text-sm">No standard checklist for this return type. Add documents manually.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 5: Deadlines Calendar ── */}
        {!loading && tab === 'deadlines' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">CRA Deadlines — Next 90 Days</h2>
            <div className="grid grid-cols-4 gap-2 mb-4 text-xs">
              {[['T1','bg-blue-600'],['T2','bg-green-600'],['GST_HST','bg-orange-500'],['payroll','bg-purple-600'],['T4/T5','bg-pink-600']].map(([label,color])=>(
                <div key={label} className="flex items-center gap-1.5">
                  <div className={`w-3 h-3 rounded-sm ${color}`}/>
                  <span className="text-gray-600">{label}</span>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {deadlines.map(d=>{
                const isPast = new Date(d.deadline_date) < new Date();
                return (
                  <div key={d.id} className={`flex items-start justify-between p-4 rounded-lg border ${isPast?'bg-red-50 border-red-200':DEADLINE_COLORS[d.return_type]??'bg-gray-50 border-gray-200'}`}>
                    <div>
                      <div className="font-medium text-sm">{d.name}</div>
                      {d.description && <div className="text-xs text-gray-500 mt-1 max-w-xl">{d.description}</div>}
                      <div className="flex gap-2 mt-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${RETURN_COLORS[d.return_type]??'bg-gray-400 text-white'}`}>{d.return_type}</span>
                        {d.recurring_pattern && <span className="text-xs text-gray-400">{d.recurring_pattern}</span>}
                      </div>
                    </div>
                    <div className={`text-sm font-semibold whitespace-nowrap ml-4 ${isPast?'text-red-600':'text-gray-700'}`}>
                      {new Date(d.deadline_date).toLocaleDateString('en-CA',{month:'short',day:'numeric',year:'numeric'})}
                      {isPast && <div className="text-xs text-red-500">PAST DUE</div>}
                    </div>
                  </div>
                );
              })}
              {deadlines.length === 0 && <p className="text-gray-400 text-center py-8">No deadlines in the next 90 days.</p>}
            </div>
          </div>
        )}

        {/* ── TAB 6: AI Tax Advisor ── */}
        {!loading && tab === 'ai-advisor' && (
          <div className="max-w-2xl space-y-5">
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">AI Tax Advisor</h2>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Return Type</label>
                  <select className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                    value={aiReturnType} onChange={e=>setAiReturnType(e.target.value)}>
                    {RETURN_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Situation Description</label>
                <textarea rows={3} placeholder="Describe the client's situation or the specific tax question…"
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                  value={aiSituation} onChange={e=>setAiSituation(e.target.value)}/>
              </div>
              {/* Quick prompts */}
              <div className="mb-4">
                <div className="text-xs text-gray-500 mb-2">Quick access prompts:</div>
                <div className="flex flex-wrap gap-2">
                  {QUICK_PROMPTS.map(qp=>(
                    <button key={qp.label} onClick={()=>setAiSituation(qp.prompt)}
                      className="text-xs border border-gray-200 bg-gray-50 hover:bg-gray-100 rounded px-2 py-1 text-gray-600">
                      {qp.label}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={runAi} disabled={aiLoading}
                className="w-full bg-slate-800 text-white py-2.5 rounded-lg text-sm hover:bg-slate-700 disabled:opacity-50">
                {aiLoading ? 'Getting advice…' : 'Get AI Tax Advice'}
              </button>
              {aiResult && (
                <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap max-h-96 overflow-y-auto">
                  {aiResult}
                </div>
              )}
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-xs text-amber-800">
              AI guidance is educational only and does not constitute professional tax advice. Always verify with the CRA website (canada.ca/en/revenue-agency) or a licensed CPA/CGA before advising clients.
            </div>
          </div>
        )}

        {/* ── TAB 7: Billing & Revenue ── */}
        {!loading && tab === 'billing' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">Billing &amp; Revenue</h2>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label:'Total Invoiced', val: returns.reduce((s,r)=>s+parseFloat(r.service_fee||'0'),0) },
                { label:'Collected', val: returns.filter(r=>r.paid_at).reduce((s,r)=>s+parseFloat(r.service_fee||'0'),0) },
                { label:'Outstanding', val: returns.filter(r=>r.status==='filed'&&!r.paid_at).reduce((s,r)=>s+parseFloat(r.service_fee||'0'),0) },
              ].map(k=>(
                <div key={k.label} className={`border rounded-lg p-4 ${k.label==='Outstanding'?'bg-red-50 border-red-200':'bg-white border-gray-200'}`}>
                  <div className="text-2xl font-bold text-gray-800">{fmt$(k.val)}</div>
                  <div className="text-sm text-gray-500 mt-1">{k.label}</div>
                </div>
              ))}
            </div>
            {/* By return type */}
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Revenue by Return Type</h3>
              <div className="space-y-2">
                {RETURN_TYPES.map(rt => {
                  const total = returns.filter(r=>r.return_type===rt).reduce((s,r)=>s+parseFloat(r.service_fee||'0'),0);
                  if (!total) return null;
                  return (
                    <div key={rt} className="flex items-center gap-3">
                      <span className={`w-20 text-xs px-2 py-0.5 rounded font-medium text-center ${RETURN_COLORS[rt]??'bg-gray-400 text-white'}`}>{rt}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                        <div className={`h-full rounded-full ${rt==='T1'?'bg-blue-500':rt==='T2'?'bg-green-500':rt==='GST_HST'?'bg-orange-400':'bg-purple-500'}`}
                          style={{width:`${Math.min(100,total/50)}%`}}/>
                      </div>
                      <div className="w-24 text-sm font-medium text-gray-700 text-right">{fmt$(total)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Outstanding invoices */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 font-medium text-gray-700">Outstanding Invoices (filed but not paid)</div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>{['Client','Return Type','Year','Fee','Filed','Action'].map(h=>(
                    <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-600">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {returns.filter(r=>r.status==='filed'&&!r.paid_at&&r.service_fee).map(r=>(
                    <tr key={r.id}>
                      <td className="px-4 py-3 font-medium text-gray-800">{r.client_name}</td>
                      <td className="px-4 py-3"><span className={`text-xs px-1.5 py-0.5 rounded font-medium ${RETURN_COLORS[r.return_type]??'bg-gray-400 text-white'}`}>{r.return_type}</span></td>
                      <td className="px-4 py-3 text-gray-600">{r.tax_year || '—'}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{fmt$(r.service_fee)}</td>
                      <td className="px-4 py-3 text-gray-500">{r.filed_date ? new Date(r.filed_date).toLocaleDateString('en-CA') : '—'}</td>
                      <td className="px-4 py-3">
                        <button onClick={()=>markPaid(r.id)}
                          className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700">
                          Mark Paid
                        </button>
                      </td>
                    </tr>
                  ))}
                  {returns.filter(r=>r.status==='filed'&&!r.paid_at&&r.service_fee).length===0 && (
                    <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">No outstanding invoices.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Add Client Modal ── */}
      {showClientModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-800">Add Tax Client</h3>
              <button onClick={()=>setShowClientModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex gap-3">
                {['personal','corporate','both'].map(t=>(
                  <button key={t} onClick={()=>setClientForm(prev=>({...prev,client_type:t}))}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border ${clientForm.client_type===t?'bg-slate-800 text-white border-slate-800':'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    {t.charAt(0).toUpperCase()+t.slice(1)}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name / Corporation Name *</label>
                  <input className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                    value={clientForm.name} onChange={e=>setClientForm(prev=>({...prev,name:e.target.value}))}/>
                </div>
                {(clientForm.client_type==='personal'||clientForm.client_type==='both') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">SIN (last 4 digits)</label>
                    <input maxLength={4} className="w-full border border-gray-200 rounded px-3 py-2 text-sm font-mono"
                      value={clientForm.sin} onChange={e=>setClientForm(prev=>({...prev,sin:e.target.value}))}/>
                  </div>
                )}
                {(clientForm.client_type==='corporate'||clientForm.client_type==='both') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Business Number (BN)</label>
                    <input className="w-full border border-gray-200 rounded px-3 py-2 text-sm font-mono"
                      value={clientForm.bn} onChange={e=>setClientForm(prev=>({...prev,bn:e.target.value}))}/>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                    value={clientForm.email} onChange={e=>setClientForm(prev=>({...prev,email:e.target.value}))}/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                    value={clientForm.phone} onChange={e=>setClientForm(prev=>({...prev,phone:e.target.value}))}/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                    value={clientForm.city} onChange={e=>setClientForm(prev=>({...prev,city:e.target.value}))}/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Province</label>
                  <select className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                    value={clientForm.province} onChange={e=>setClientForm(prev=>({...prev,province:e.target.value}))}>
                    {['AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT'].map(p=><option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              {/* Services */}
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">Services</div>
                <div className="flex flex-wrap gap-3">
                  {[
                    {f:'does_t1',l:'T1 Personal'},{f:'does_t2',l:'T2 Corporate'},
                    {f:'does_gst',l:'GST/HST'},{f:'does_payroll',l:'Payroll'},
                    {f:'does_bookkeeping',l:'Bookkeeping'},
                  ].map(({f,l})=>(
                    <label key={f} className="flex items-center gap-1.5 text-sm text-gray-700">
                      <input type="checkbox" checked={(clientForm as Record<string,boolean|string>)[f] as boolean}
                        onChange={e=>setClientForm(prev=>({...prev,[f]:e.target.checked}))}/>
                      {l}
                    </label>
                  ))}
                </div>
              </div>
              {clientForm.does_gst && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">GST Filing Frequency</label>
                  <select className="border border-gray-200 rounded px-3 py-2 text-sm"
                    value={clientForm.gst_filing_frequency} onChange={e=>setClientForm(prev=>({...prev,gst_filing_frequency:e.target.value}))}>
                    <option value=''>— Select —</option>
                    {['monthly','quarterly','annual'].map(f=><option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea rows={2} className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                  value={clientForm.notes} onChange={e=>setClientForm(prev=>({...prev,notes:e.target.value}))}/>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
              <button onClick={()=>setShowClientModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm">Cancel</button>
              <button onClick={submitClient} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-700">Save Client</button>
            </div>
          </div>
        </div>
      )}

      {/* ── New Return Modal ── */}
      {showReturnModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-800">New Return</h3>
              <button onClick={()=>setShowReturnModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client *</label>
                <select className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                  value={returnForm.client_id} onChange={e=>setReturnForm(prev=>({...prev,client_id:e.target.value}))}>
                  <option value=''>— Select client —</option>
                  {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Return Type *</label>
                  <select className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                    value={returnForm.return_type} onChange={e=>setReturnForm(prev=>({...prev,return_type:e.target.value}))}>
                    {RETURN_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tax Year</label>
                  <input type="number" className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                    value={returnForm.tax_year} onChange={e=>setReturnForm(prev=>({...prev,tax_year:e.target.value}))}/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                  <input type="date" className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                    value={returnForm.due_date} onChange={e=>setReturnForm(prev=>({...prev,due_date:e.target.value}))}/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Service Fee ($)</label>
                  <input type="number" step="0.01" className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                    value={returnForm.service_fee} onChange={e=>setReturnForm(prev=>({...prev,service_fee:e.target.value}))}/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assigned To</label>
                  <input className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                    value={returnForm.assigned_to} onChange={e=>setReturnForm(prev=>({...prev,assigned_to:e.target.value}))}/>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea rows={2} className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                  value={returnForm.notes} onChange={e=>setReturnForm(prev=>({...prev,notes:e.target.value}))}/>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
              <button onClick={()=>setShowReturnModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm">Cancel</button>
              <button onClick={submitReturn} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-700">Create Return</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mark Filed Modal ── */}
      {showFileModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-800">Mark as Filed — {showFileModal.client_name} ({showFileModal.return_type})</h3>
              <button onClick={()=>setShowFileModal(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CRA Confirmation Number</label>
                <input className="w-full border border-gray-200 rounded px-3 py-2 text-sm font-mono"
                  placeholder="e.g. A12345678" value={fileForm.confirmation_number}
                  onChange={e=>setFileForm(prev=>({...prev,confirmation_number:e.target.value}))}/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">NETFILE Access Code (optional)</label>
                <input className="w-full border border-gray-200 rounded px-3 py-2 text-sm font-mono"
                  value={fileForm.netfile_access_code}
                  onChange={e=>setFileForm(prev=>({...prev,netfile_access_code:e.target.value}))}/>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
              <button onClick={()=>setShowFileModal(null)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm">Cancel</button>
              <button onClick={submitFile} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700">Confirm Filed</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Document Modal ── */}
      {showDocModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-800">Add Document</h3>
              <button onClick={()=>setShowDocModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Document Name *</label>
                <input className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                  value={docForm.document_name} onChange={e=>setDocForm(prev=>({...prev,document_name:e.target.value}))}/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Document Type</label>
                <select className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                  value={docForm.document_type} onChange={e=>setDocForm(prev=>({...prev,document_type:e.target.value}))}>
                  <option value=''>— Select —</option>
                  {['T4','T5','RRSP_receipt','donation','medical','rental','business_expense','bank_statement','invoice','other'].map(t=>(
                    <option key={t} value={t}>{t.replace(/_/g,' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <input className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                  value={docForm.notes} onChange={e=>setDocForm(prev=>({...prev,notes:e.target.value}))}/>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
              <button onClick={()=>setShowDocModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm">Cancel</button>
              <button onClick={submitDoc} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-700">Add Document</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
