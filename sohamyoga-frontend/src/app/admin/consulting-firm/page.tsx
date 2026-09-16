'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard','clients','engagements','time','deliverables','utilization','ai'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab,string> = { dashboard:'Dashboard', clients:'Clients', engagements:'Engagements', time:'Time Tracking', deliverables:'Deliverables', utilization:'Utilization', ai:'AI Consulting Tools' };

const ENGAGEMENT_TYPES = ['strategy','operations','finance','hr','technology','change_management','market_entry','m_and_a','restructuring','other'];
const ENGAGEMENT_STATUSES = ['proposal','active','on_hold','completed','cancelled'];
const CONTRACT_TYPES = ['fixed','time_and_materials','retainer','success_fee'];
const CLIENT_ENGAGEMENT_TYPES = ['project','retainer','advisory','fractional_cxo','due_diligence','other'];
const DELIVERABLE_TYPES = ['strategy_report','financial_model','process_map','org_design','market_analysis','presentation','implementation_plan','other'];

interface CfClient { id:number; company_name:string; industry:string; contact_name:string; contact_title:string; contact_email:string; engagement_type:string; relationship_manager:string; status:string; total_fees:number; annual_revenue_estimate:number; employee_count:number; }
interface Engagement { id:number; client_id:number; company_name:string; industry:string; engagement_name:string; engagement_number:string; engagement_type:string; lead_consultant:string; status:string; total_fee:number; billed_to_date:number; contract_type:string; budgeted_hours:number; actual_hours:number; start_date:string; end_date:string; description:string; }
interface TimeEntry { id:number; engagement_id:number; consultant:string; entry_date:string; hours:number; activity:string; billable:boolean; billed:boolean; hourly_rate:number; }
interface CfDeliverable { id:number; engagement_id:number; deliverable_name:string; deliverable_type:string; due_date:string; submitted_date:string; status:string; assigned_to:string; version:string; notes:string; }
interface Dashboard { active_engagements:number; wip_value:number; total_billed_ytd:number; utilization_rate:number; deliverables_overdue:number; }
interface UtilizationRow { consultant:string; total_hours:number; billable_hours:number; non_billable_hours:number; utilization_rate:number; }

function fmtCad(n:number){return `$${Number(n??0).toLocaleString('en-CA',{minimumFractionDigits:0,maximumFractionDigits:0})}`;}
function fmtDate(d:string){return d?new Date(d).toLocaleDateString('en-CA'):'—';}

function Badge({label,color='gray'}:{label:string;color?:string}){
  const m:Record<string,string>={blue:'bg-blue-100 text-blue-700',green:'bg-green-100 text-green-700',amber:'bg-amber-100 text-amber-700',red:'bg-red-100 text-red-700',purple:'bg-purple-100 text-purple-700',gray:'bg-gray-100 text-gray-700',teal:'bg-teal-100 text-teal-700',orange:'bg-orange-100 text-orange-700'};
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${m[color]??m.gray}`}>{label}</span>;
}
function KpiCard({label,value,sub,color='blue'}:{label:string;value:string|number;sub?:string;color?:string}){
  const b:Record<string,string>={blue:'border-l-4 border-blue-500 bg-blue-50',green:'border-l-4 border-green-500 bg-green-50',amber:'border-l-4 border-amber-500 bg-amber-50',red:'border-l-4 border-red-500 bg-red-50',purple:'border-l-4 border-purple-500 bg-purple-50'};
  return <div className={`rounded-lg p-4 ${b[color]??b.blue}`}><p className="text-sm text-gray-500">{label}</p><p className="text-2xl font-bold mt-1">{value}</p>{sub&&<p className="text-xs text-gray-400 mt-1">{sub}</p>}</div>;
}
function statusColor(s:string){const m:Record<string,string>={active:'green',proposal:'blue',on_hold:'amber',completed:'teal',cancelled:'red',in_progress:'blue',submitted:'amber',client_review:'purple',accepted:'green',revision_required:'red'};return m[s]??'gray';}
function engTypeColor(t:string){const m:Record<string,string>={strategy:'purple',operations:'blue',finance:'green',hr:'amber',technology:'teal',change_management:'orange',market_entry:'blue',m_and_a:'red',restructuring:'amber'};return m[t]??'gray';}

// ─── Add Client Modal ──────────────────────────────────────────────────────────
function AddClientModal({onClose,onSaved}:{onClose:()=>void;onSaved:()=>void}){
  const [form,setForm]=useState({company_name:'',industry:'',contact_name:'',contact_title:'',contact_email:'',contact_phone:'',city:'Calgary',province:'AB',annual_revenue_estimate:'',employee_count:'',engagement_type:'project',relationship_manager:'',source:'',status:'prospect'});
  const [saving,setSaving]=useState(false);
  const f=(k:string,v:string)=>setForm(p=>({...p,[k]:v}));
  async function submit(){
    if(!form.company_name||!form.contact_name||!form.contact_email)return;
    setSaving(true);
    try{
      await fetch('/api/admin/consulting-firm/clients',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,annual_revenue_estimate:form.annual_revenue_estimate?parseFloat(form.annual_revenue_estimate):null,employee_count:form.employee_count?parseInt(form.employee_count):null})});
      onSaved();
    }finally{setSaving(false);}
  }
  return(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-4 text-slate-800">New Consulting Client</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs text-gray-500">Company Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.company_name} onChange={e=>f('company_name',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Industry</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.industry} onChange={e=>f('industry',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Engagement Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.engagement_type} onChange={e=>f('engagement_type',e.target.value)}>{CLIENT_ENGAGEMENT_TYPES.map(t=><option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Contact Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.contact_name} onChange={e=>f('contact_name',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Title</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.contact_title} onChange={e=>f('contact_title',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Email *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.contact_email} onChange={e=>f('contact_email',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Phone</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.contact_phone} onChange={e=>f('contact_phone',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Annual Revenue Est. ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.annual_revenue_estimate} onChange={e=>f('annual_revenue_estimate',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Employee Count</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.employee_count} onChange={e=>f('employee_count',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Relationship Manager</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.relationship_manager} onChange={e=>f('relationship_manager',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Source</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.source} onChange={e=>f('source',e.target.value)} placeholder="referral, linkedin, etc."/></div>
          <div><label className="text-xs text-gray-500">Status</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.status} onChange={e=>f('status',e.target.value)}>{['active','prospect','completed','on_hold'].map(s=><option key={s} value={s}>{s.replace('_',' ')}</option>)}</select></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded border text-sm">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 rounded bg-blue-600 text-white text-sm disabled:opacity-50">{saving?'Saving…':'Add Client'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Engagement Modal ──────────────────────────────────────────────────────
function AddEngagementModal({onClose,onSaved,clients}:{onClose:()=>void;onSaved:()=>void;clients:CfClient[]}){
  const [form,setForm]=useState({client_id:'',engagement_name:'',engagement_type:'strategy',lead_consultant:'',start_date:'',end_date:'',status:'proposal',total_fee:'',contract_type:'fixed',hourly_rate:'',budgeted_hours:'',description:''});
  const [saving,setSaving]=useState(false);
  const f=(k:string,v:string)=>setForm(p=>({...p,[k]:v}));
  async function submit(){
    if(!form.client_id||!form.engagement_name)return;
    setSaving(true);
    try{
      await fetch('/api/admin/consulting-firm/engagements',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,client_id:parseInt(form.client_id),total_fee:form.total_fee?parseFloat(form.total_fee):null,hourly_rate:form.hourly_rate?parseFloat(form.hourly_rate):null,budgeted_hours:form.budgeted_hours?parseFloat(form.budgeted_hours):null})});
      onSaved();
    }finally{setSaving(false);}
  }
  return(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-4 text-slate-800">New Engagement</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs text-gray-500">Client *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.client_id} onChange={e=>f('client_id',e.target.value)}><option value="">Select…</option>{clients.map(c=><option key={c.id} value={c.id}>{c.company_name}</option>)}</select></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Engagement Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.engagement_name} onChange={e=>f('engagement_name',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.engagement_type} onChange={e=>f('engagement_type',e.target.value)}>{ENGAGEMENT_TYPES.map(t=><option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Status</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.status} onChange={e=>f('status',e.target.value)}>{ENGAGEMENT_STATUSES.map(s=><option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Lead Consultant</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.lead_consultant} onChange={e=>f('lead_consultant',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Contract Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.contract_type} onChange={e=>f('contract_type',e.target.value)}>{CONTRACT_TYPES.map(t=><option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Total Fee ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.total_fee} onChange={e=>f('total_fee',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Hourly Rate ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.hourly_rate} onChange={e=>f('hourly_rate',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Budgeted Hours</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.budgeted_hours} onChange={e=>f('budgeted_hours',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Start Date</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.start_date} onChange={e=>f('start_date',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">End Date</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.end_date} onChange={e=>f('end_date',e.target.value)}/></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Description / Client Challenge</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={3} value={form.description} onChange={e=>f('description',e.target.value)}/></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded border text-sm">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 rounded bg-blue-600 text-white text-sm disabled:opacity-50">{saving?'Saving…':'Add Engagement'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Log Time Modal ────────────────────────────────────────────────────────────
function LogTimeModal({engagements,onClose,onSaved}:{engagements:Engagement[];onClose:()=>void;onSaved:()=>void}){
  const [form,setForm]=useState({engagement_id:'',consultant:'',entry_date:new Date().toISOString().split('T')[0],hours:'',activity:'',billable:true,hourly_rate:''});
  const [saving,setSaving]=useState(false);
  const f=(k:string,v:string|boolean)=>setForm(p=>({...p,[k]:v}));
  async function submit(){
    if(!form.engagement_id||!form.consultant||!form.hours||!form.activity)return;
    setSaving(true);
    try{
      await fetch(`/api/admin/consulting-firm/engagements/${form.engagement_id}/time`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,hours:parseFloat(form.hours),hourly_rate:form.hourly_rate?parseFloat(form.hourly_rate):null})});
      onSaved();
    }finally{setSaving(false);}
  }
  return(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold mb-4 text-slate-800">Log Time Entry</h2>
        <div className="space-y-3">
          <div><label className="text-xs text-gray-500">Engagement *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.engagement_id} onChange={e=>f('engagement_id',e.target.value)}><option value="">Select…</option>{engagements.filter(e=>e.status==='active').map(e=><option key={e.id} value={e.id}>{e.engagement_number} — {e.engagement_name}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Consultant *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.consultant} onChange={e=>f('consultant',e.target.value)}/></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500">Date</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.entry_date} onChange={e=>f('entry_date',e.target.value)}/></div>
            <div><label className="text-xs text-gray-500">Hours *</label><input type="number" step="0.25" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.hours} onChange={e=>f('hours',e.target.value)}/></div>
          </div>
          <div><label className="text-xs text-gray-500">Activity *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.activity} onChange={e=>f('activity',e.target.value)} placeholder="e.g. Client interview, Analysis, Deliverable prep"/></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500">Hourly Rate ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.hourly_rate} onChange={e=>f('hourly_rate',e.target.value)}/></div>
            <div className="flex items-center gap-2 mt-5"><input type="checkbox" id="billable" checked={form.billable} onChange={e=>f('billable',e.target.checked)} className="rounded"/><label htmlFor="billable" className="text-sm">Billable</label></div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded border text-sm">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 rounded bg-blue-600 text-white text-sm disabled:opacity-50">{saving?'Saving…':'Log Time'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ConsultingFirmPage() {
  const [tab,setTab]=useState<Tab>('dashboard');
  const [dashboard,setDashboard]=useState<Dashboard|null>(null);
  const [clients,setClients]=useState<CfClient[]>([]);
  const [engagements,setEngagements]=useState<Engagement[]>([]);
  const [timeEntries,setTimeEntries]=useState<TimeEntry[]>([]);
  const [deliverables,setDeliverables]=useState<CfDeliverable[]>([]);
  const [utilization,setUtilization]=useState<UtilizationRow[]>([]);
  const [showAddClient,setShowAddClient]=useState(false);
  const [showAddEngagement,setShowAddEngagement]=useState(false);
  const [showLogTime,setShowLogTime]=useState(false);
  const [aiProposalInput,setAiProposalInput]=useState({engagement_type:'strategy',company_name:'',industry:'',description:'',lead_consultant:'',total_fee:'',contract_type:'fixed'});
  const [aiProposalOutput,setAiProposalOutput]=useState('');
  const [aiFrameworkInput,setAiFrameworkInput]=useState({engagement_type:'strategy',industry:'',description:''});
  const [aiFrameworkOutput,setAiFrameworkOutput]=useState('');
  const [aiLoading,setAiLoading]=useState(false);

  const loadDashboard=useCallback(async()=>{const r=await fetch('/api/admin/consulting-firm');if(r.ok)setDashboard(await r.json());},[]);
  const loadClients=useCallback(async()=>{const r=await fetch('/api/admin/consulting-firm/clients');if(r.ok)setClients(await r.json());},[]);
  const loadEngagements=useCallback(async()=>{const r=await fetch('/api/admin/consulting-firm/engagements');if(r.ok)setEngagements(await r.json());},[]);
  const loadUtilization=useCallback(async()=>{const r=await fetch('/api/admin/consulting-firm/utilization');if(r.ok)setUtilization(await r.json());},[]);

  useEffect(()=>{loadDashboard();loadClients();},[loadDashboard,loadClients]);
  useEffect(()=>{if(tab==='engagements'||tab==='time'||tab==='deliverables')loadEngagements();},[tab,loadEngagements]);
  useEffect(()=>{if(tab==='utilization')loadUtilization();},[tab,loadUtilization]);

  async function generateInvoice(engId:number){
    const r=await fetch(`/api/admin/consulting-firm/engagements/${engId}/invoice`,{method:'POST'});
    if(r.ok){const d=await r.json();alert(`Invoice generated: ${fmtCad(d.invoice_amount)} for ${d.time_entries_billed} time entries`);loadEngagements();}
    else{const e=await r.json();alert(e.error||'No unbilled entries');}
  }
  async function runAiProposal(){
    setAiLoading(true);setAiProposalOutput('');
    try{const r=await fetch('/api/admin/consulting-firm/ai-proposal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(aiProposalInput)});if(r.ok){const d=await r.json();setAiProposalOutput(d.proposal);}}
    finally{setAiLoading(false);}
  }
  async function runAiFramework(){
    setAiLoading(true);setAiFrameworkOutput('');
    try{const r=await fetch('/api/admin/consulting-firm/ai-framework',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(aiFrameworkInput)});if(r.ok){const d=await r.json();setAiFrameworkOutput(d.framework);}}
    finally{setAiLoading(false);}
  }

  const billableHoursTotal=(eng:Engagement)=>eng.budgeted_hours?Math.min(100,Math.round((eng.actual_hours/eng.budgeted_hours)*100)):0;

  return(
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-2xl font-bold text-slate-800">Management Consulting Firm Hub</h1>
        <p className="text-sm text-gray-500 mt-0.5">Engagements, time tracking, deliverables & billing</p>
      </div>
      <div className="bg-white border-b px-6">
        <div className="flex gap-1">
          {TABS.map(t=>(
            <button key={t} onClick={()=>setTab(t)} className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab===t?'border-blue-600 text-blue-700':'border-transparent text-gray-500 hover:text-gray-700'}`}>{TAB_LABELS[t]}</button>
          ))}
        </div>
      </div>
      <div className="p-6 max-w-7xl mx-auto">

        {/* DASHBOARD */}
        {tab==='dashboard'&&(
          <div className="space-y-6">
            <div className="grid grid-cols-5 gap-4">
              <KpiCard label="Active Engagements" value={dashboard?.active_engagements??'—'} color="blue"/>
              <KpiCard label="WIP Value" value={dashboard?fmtCad(dashboard.wip_value):'—'} color="amber"/>
              <KpiCard label="Total Billed YTD" value={dashboard?fmtCad(dashboard.total_billed_ytd):'—'} color="green"/>
              <KpiCard label="Hours Utilization" value={dashboard?`${dashboard.utilization_rate}%`:'—'} color="purple"/>
              <KpiCard label="Deliverables Overdue" value={dashboard?.deliverables_overdue??'—'} color="red"/>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white rounded-lg border p-4">
                <h3 className="font-semibold text-slate-700 mb-3">Active Engagements Pipeline</h3>
                {engagements.filter(e=>e.status==='active').slice(0,8).map(e=>(
                  <div key={e.id} className="py-2 border-b last:border-0">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{e.engagement_number}</span>
                      <span>{e.total_fee?fmtCad(e.total_fee):'—'}</span>
                    </div>
                    <p className="text-xs text-gray-500">{e.engagement_name} · {e.company_name}</p>
                    {e.budgeted_hours>0&&<div className="mt-1 w-full bg-gray-100 h-1.5 rounded"><div className="bg-blue-500 h-1.5 rounded" style={{width:`${billableHoursTotal(e)}%`}}/></div>}
                  </div>
                ))}
                {engagements.length===0&&<p className="text-sm text-gray-400">Load Engagements tab first</p>}
              </div>
              <div className="bg-white rounded-lg border p-4">
                <h3 className="font-semibold text-slate-700 mb-3">Billing Snapshot</h3>
                {engagements.filter(e=>e.status==='active'&&e.total_fee).slice(0,8).map(e=>(
                  <div key={e.id} className="flex items-center justify-between py-1.5 border-b last:border-0 text-sm">
                    <span>{e.engagement_name}</span>
                    <div className="text-right">
                      <p className="font-medium">{fmtCad(e.billed_to_date||0)}<span className="text-gray-400 font-normal"> / {fmtCad(e.total_fee)}</span></p>
                      <p className="text-xs text-gray-400">{e.total_fee?Math.round((e.billed_to_date/e.total_fee)*100):0}% billed</p>
                    </div>
                  </div>
                ))}
                {engagements.length===0&&<p className="text-sm text-gray-400">Load Engagements tab first</p>}
              </div>
            </div>
          </div>
        )}

        {/* CLIENTS */}
        {tab==='clients'&&(
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={()=>setShowAddClient(true)} className="px-4 py-2 bg-blue-600 text-white rounded text-sm">+ Add Client</button>
            </div>
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b"><tr>{['Company','Industry','Contact','Engagement Type','Relationship Manager','Total Fees','Status'].map(h=><th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr></thead>
                <tbody>
                  {clients.map(c=>(
                    <tr key={c.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium">{c.company_name}</td>
                      <td className="px-4 py-2.5 text-gray-500">{c.industry||'—'}</td>
                      <td className="px-4 py-2.5"><p>{c.contact_name}</p><p className="text-xs text-gray-400">{c.contact_email}</p></td>
                      <td className="px-4 py-2.5"><Badge label={c.engagement_type?.replace(/_/g,' ')} color="blue"/></td>
                      <td className="px-4 py-2.5 text-gray-500">{c.relationship_manager||'—'}</td>
                      <td className="px-4 py-2.5 font-medium">{c.total_fees?fmtCad(c.total_fees):'—'}</td>
                      <td className="px-4 py-2.5"><Badge label={c.status} color={statusColor(c.status)}/></td>
                    </tr>
                  ))}
                  {clients.length===0&&<tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No clients yet</td></tr>}
                </tbody>
              </table>
            </div>
            {showAddClient&&<AddClientModal onClose={()=>setShowAddClient(false)} onSaved={()=>{setShowAddClient(false);loadClients();}}/>}
          </div>
        )}

        {/* ENGAGEMENTS */}
        {tab==='engagements'&&(
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={()=>setShowAddEngagement(true)} className="px-4 py-2 bg-blue-600 text-white rounded text-sm">+ Add Engagement</button>
            </div>
            <div className="grid gap-4">
              {engagements.map(e=>(
                <div key={e.id} className="bg-white rounded-lg border p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-gray-400">{e.engagement_number}</span>
                        <h3 className="font-semibold">{e.engagement_name}</h3>
                        <Badge label={e.engagement_type?.replace(/_/g,' ')} color={engTypeColor(e.engagement_type)}/>
                        <Badge label={e.status} color={statusColor(e.status)}/>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{e.company_name} · {e.industry} · {e.lead_consultant||'No lead'}</p>
                    </div>
                    <button onClick={()=>generateInvoice(e.id)} className="px-3 py-1.5 rounded border text-xs text-green-700 border-green-200 hover:bg-green-50">Generate Invoice</button>
                  </div>
                  <div className="grid grid-cols-5 gap-4 text-sm mt-3">
                    <div><p className="text-xs text-gray-400">Contract</p><p className="font-medium">{e.contract_type?.replace(/_/g,' ')}</p></div>
                    <div><p className="text-xs text-gray-400">Total Fee</p><p className="font-medium">{e.total_fee?fmtCad(e.total_fee):'—'}</p></div>
                    <div><p className="text-xs text-gray-400">Billed</p><p className="font-medium">{fmtCad(e.billed_to_date||0)}{e.total_fee&&<span className="text-xs text-gray-400 ml-1">({Math.round(((e.billed_to_date||0)/e.total_fee)*100)}%)</span>}</p></div>
                    <div><p className="text-xs text-gray-400">Hours</p><p className="font-medium">{e.actual_hours||0}<span className="text-gray-400">/{e.budgeted_hours||'—'}</span></p>{e.budgeted_hours&&<div className="w-full bg-gray-100 h-1.5 rounded mt-1"><div className={`h-1.5 rounded ${billableHoursTotal(e)>100?'bg-red-500':'bg-blue-500'}`} style={{width:`${Math.min(100,billableHoursTotal(e))}%`}}/></div>}</div>
                    <div><p className="text-xs text-gray-400">Timeline</p><p className="font-medium text-xs">{fmtDate(e.start_date)} → {fmtDate(e.end_date)}</p></div>
                  </div>
                </div>
              ))}
              {engagements.length===0&&<div className="bg-white rounded-lg border p-8 text-center text-gray-400">No engagements yet</div>}
            </div>
            {showAddEngagement&&<AddEngagementModal clients={clients} onClose={()=>setShowAddEngagement(false)} onSaved={()=>{setShowAddEngagement(false);loadEngagements();}}/>}
          </div>
        )}

        {/* TIME TRACKING */}
        {tab==='time'&&(
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={()=>setShowLogTime(true)} className="px-4 py-2 bg-blue-600 text-white rounded text-sm">+ Log Time</button>
            </div>
            {engagements.filter(e=>e.status==='active').map(e=>(
              <div key={e.id} className="bg-white rounded-lg border p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono text-xs text-gray-400">{e.engagement_number}</span>
                  <span className="font-semibold text-sm">{e.engagement_name}</span>
                  <span className="text-xs text-gray-400">· {e.company_name}</span>
                </div>
                <div className="flex gap-4 text-sm text-gray-600 mb-2">
                  <span>Actual: <strong>{e.actual_hours||0}h</strong></span>
                  <span>Budget: <strong>{e.budgeted_hours||'—'}h</strong></span>
                  {e.budgeted_hours&&<span className={e.actual_hours>e.budgeted_hours?'text-red-600':'text-green-600'}>{billableHoursTotal(e)}% utilized</span>}
                </div>
              </div>
            ))}
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b"><tr>{['Date','Consultant','Engagement','Activity','Hours','Rate','Billable','Billed'].map(h=><th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr></thead>
                <tbody>
                  {timeEntries.map(t=>(
                    <tr key={t.id} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-2">{fmtDate(t.entry_date)}</td>
                      <td className="px-3 py-2 font-medium">{t.consultant}</td>
                      <td className="px-3 py-2">{engagements.find(e=>e.id===t.engagement_id)?.engagement_number||'—'}</td>
                      <td className="px-3 py-2 text-gray-600">{t.activity}</td>
                      <td className="px-3 py-2 font-medium">{t.hours}h</td>
                      <td className="px-3 py-2">{t.hourly_rate?fmtCad(t.hourly_rate):'-'}/h</td>
                      <td className="px-3 py-2"><Badge label={t.billable?'Billable':'Non-Bill.'} color={t.billable?'green':'gray'}/></td>
                      <td className="px-3 py-2"><Badge label={t.billed?'Billed':'Pending'} color={t.billed?'teal':'amber'}/></td>
                    </tr>
                  ))}
                  {timeEntries.length===0&&<tr><td colSpan={8} className="px-4 py-6 text-center text-gray-400">No time entries — use Log Time to add</td></tr>}
                </tbody>
              </table>
            </div>
            {showLogTime&&<LogTimeModal engagements={engagements} onClose={()=>setShowLogTime(false)} onSaved={()=>{setShowLogTime(false);setTimeEntries([]);}}/>}
          </div>
        )}

        {/* DELIVERABLES */}
        {tab==='deliverables'&&(
          <div className="space-y-4">
            {engagements.filter(e=>e.status==='active').map(async()=>{return null;})}
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b"><tr>{['Deliverable','Type','Engagement','Assigned To','Due Date','Version','Status'].map(h=><th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr></thead>
                <tbody>
                  {deliverables.map(d=>(
                    <tr key={d.id} className={`border-b hover:bg-gray-50 ${d.due_date&&new Date(d.due_date)<new Date()&&!['accepted'].includes(d.status)?'bg-red-50':''}`}>
                      <td className="px-3 py-2.5 font-medium">{d.deliverable_name}</td>
                      <td className="px-3 py-2.5"><Badge label={d.deliverable_type?.replace(/_/g,' ')} color="blue"/></td>
                      <td className="px-3 py-2.5 text-gray-500">{engagements.find(e=>e.id===d.engagement_id)?.engagement_number||'—'}</td>
                      <td className="px-3 py-2.5">{d.assigned_to||'—'}</td>
                      <td className="px-3 py-2.5">{fmtDate(d.due_date)}</td>
                      <td className="px-3 py-2.5 font-mono text-xs">v{d.version}</td>
                      <td className="px-3 py-2.5"><Badge label={d.status?.replace(/_/g,' ')} color={statusColor(d.status)}/></td>
                    </tr>
                  ))}
                  {deliverables.length===0&&<tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No deliverables — add via engagement detail</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* UTILIZATION */}
        {tab==='utilization'&&(
          <div className="space-y-4">
            <div className="bg-white rounded-lg border p-4">
              <h3 className="font-semibold mb-3 text-slate-700">Consultant Utilization — This Month</h3>
              {utilization.length===0&&<p className="text-gray-400 text-sm">No time logged this month</p>}
              {utilization.map(u=>(
                <div key={u.consultant} className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{u.consultant}</span>
                    <span>{u.utilization_rate??0}% utilization</span>
                  </div>
                  <div className="w-full bg-gray-100 h-3 rounded">
                    <div className={`h-3 rounded ${parseFloat(String(u.utilization_rate))>=80?'bg-green-500':parseFloat(String(u.utilization_rate))>=60?'bg-amber-400':'bg-red-400'}`} style={{width:`${Math.min(100,u.utilization_rate??0)}%`}}/>
                  </div>
                  <div className="flex gap-4 text-xs text-gray-400 mt-1">
                    <span>Total: {u.total_hours}h</span>
                    <span>Billable: {u.billable_hours}h</span>
                    <span>Non-billable: {u.non_billable_hours}h</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI TOOLS */}
        {tab==='ai'&&(
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border p-5">
              <h3 className="font-semibold text-slate-800 mb-3">Engagement Proposal Writer</h3>
              <div className="space-y-2">
                {[['engagement_type','Engagement Type'],['company_name','Client Company'],['industry','Industry'],['description','Client Challenge / Context'],['lead_consultant','Lead Consultant'],['total_fee','Total Fee ($)'],['contract_type','Contract Type']].map(([k,label])=>(
                  k==='engagement_type'||k==='contract_type'?(
                    <div key={k}><label className="text-xs text-gray-500">{label}</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiProposalInput[k as keyof typeof aiProposalInput]} onChange={e=>setAiProposalInput(p=>({...p,[k]:e.target.value}))}>{(k==='engagement_type'?ENGAGEMENT_TYPES:CONTRACT_TYPES).map(t=><option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}</select></div>
                  ):(
                    <div key={k}><label className="text-xs text-gray-500">{label}</label>{k==='description'?<textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={aiProposalInput[k as keyof typeof aiProposalInput]} onChange={e=>setAiProposalInput(p=>({...p,[k]:e.target.value}))}/>:<input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiProposalInput[k as keyof typeof aiProposalInput]} onChange={e=>setAiProposalInput(p=>({...p,[k]:e.target.value}))}/>}</div>
                  )
                ))}
                <button onClick={runAiProposal} disabled={aiLoading} className="w-full py-2 bg-blue-600 text-white rounded text-sm mt-2 disabled:opacity-50">{aiLoading?'Generating…':'Generate Proposal'}</button>
              </div>
              {aiProposalOutput&&<pre className="mt-4 p-3 bg-gray-50 border rounded text-xs whitespace-pre-wrap max-h-96 overflow-y-auto">{aiProposalOutput}</pre>}
            </div>
            <div className="bg-white rounded-lg border p-5">
              <h3 className="font-semibold text-slate-800 mb-3">Framework Application Generator</h3>
              <div className="space-y-2">
                <div><label className="text-xs text-gray-500">Engagement Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiFrameworkInput.engagement_type} onChange={e=>setAiFrameworkInput(p=>({...p,engagement_type:e.target.value}))}>{ENGAGEMENT_TYPES.map(t=><option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}</select></div>
                <div><label className="text-xs text-gray-500">Industry</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiFrameworkInput.industry} onChange={e=>setAiFrameworkInput(p=>({...p,industry:e.target.value}))}/></div>
                <div><label className="text-xs text-gray-500">Context / Challenge</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={4} value={aiFrameworkInput.description} onChange={e=>setAiFrameworkInput(p=>({...p,description:e.target.value}))}/></div>
                <button onClick={runAiFramework} disabled={aiLoading} className="w-full py-2 bg-purple-600 text-white rounded text-sm mt-2 disabled:opacity-50">{aiLoading?'Generating…':'Apply Framework'}</button>
              </div>
              {aiFrameworkOutput&&<pre className="mt-4 p-3 bg-gray-50 border rounded text-xs whitespace-pre-wrap max-h-96 overflow-y-auto">{aiFrameworkOutput}</pre>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
