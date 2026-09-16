'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard','clients','campaigns','deliverables','reports','ai','analytics'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = { dashboard: 'Dashboard', clients: 'Clients', campaigns: 'Campaigns', deliverables: 'Deliverables', reports: 'Reports', ai: 'AI Tools', analytics: 'Analytics' };

const CLIENT_TYPES = ['retainer','project','one_time','enterprise'];
const CLIENT_STATUSES = ['active','at_risk','churned','prospect','paused'];
const CAMPAIGN_TYPES = ['seo','google_ads','meta_ads','linkedin_ads','email','content','social_organic','video','pr','influencer','affiliate'];
const CAMPAIGN_STATUSES = ['draft','active','paused','completed','cancelled'];
const DELIVERABLE_TYPES = ['blog_post','social_post','ad_creative','landing_page','email_template','report','video_script','keyword_research','audit','strategy_deck','other'];
const DELIVERABLE_STATUSES = ['todo','in_progress','review','approved','published','revision_required'];
const SERVICES = ['seo','ppc','social_media','content','email','web_dev','video','pr'];

interface DacClient { id:number; company_name:string; industry:string; contact_name:string; contact_email:string; contact_phone:string; client_type:string; monthly_retainer:number; annual_value:number; services:string[]; account_manager:string; contract_start:string; contract_end:string; status:string; churn_risk_score:number; nps_score:number; notes:string; days_to_renewal:number; }
interface Campaign { id:number; client_id:number; company_name:string; campaign_name:string; campaign_type:string; platform:string; objective:string; budget_monthly:number; spend_mtd:number; status:string; impressions_mtd:number; clicks_mtd:number; conversions_mtd:number; leads_mtd:number; roas:number; cpc:number; ctr:number; cpa:number; }
interface Deliverable { id:number; client_id:number; campaign_id:number; company_name:string; campaign_name:string; deliverable_type:string; title:string; assigned_to:string; due_date:string; status:string; client_approved:boolean; notes:string; }
interface Report { id:number; client_id:number; company_name:string; report_month:string; total_impressions:number; total_clicks:number; total_conversions:number; total_spend:number; roas:number; top_performing_campaign:string; seo_keywords_top10:number; organic_traffic_growth_pct:number; sent_to_client:boolean; sent_date:string; }
interface Dashboard { active_clients:number; mrr_total:number; campaigns_active:number; deliverables_due_this_week:number; at_risk_clients:number; }

function fmtCad(n:number){return `$${Number(n??0).toLocaleString('en-CA',{minimumFractionDigits:0,maximumFractionDigits:0})}`;}
function fmtDate(d:string){return d?new Date(d).toLocaleDateString('en-CA'):'—';}
function fmtNum(n:number){return Number(n??0).toLocaleString();}

function Badge({label,color='gray'}:{label:string;color?:string}){
  const m:Record<string,string>={blue:'bg-blue-100 text-blue-700',green:'bg-green-100 text-green-700',amber:'bg-amber-100 text-amber-700',red:'bg-red-100 text-red-700',purple:'bg-purple-100 text-purple-700',gray:'bg-gray-100 text-gray-700',teal:'bg-teal-100 text-teal-700',orange:'bg-orange-100 text-orange-700'};
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${m[color]??m.gray}`}>{label}</span>;
}
function KpiCard({label,value,sub,color='blue'}:{label:string;value:string|number;sub?:string;color?:string}){
  const b:Record<string,string>={blue:'border-l-4 border-blue-500 bg-blue-50',green:'border-l-4 border-green-500 bg-green-50',amber:'border-l-4 border-amber-500 bg-amber-50',red:'border-l-4 border-red-500 bg-red-50',purple:'border-l-4 border-purple-500 bg-purple-50'};
  return <div className={`rounded-lg p-4 ${b[color]??b.blue}`}><p className="text-sm text-gray-500">{label}</p><p className="text-2xl font-bold mt-1">{value}</p>{sub&&<p className="text-xs text-gray-400 mt-1">{sub}</p>}</div>;
}
function churnColor(score:number){if(score>=70)return'red';if(score>=40)return'amber';return'green';}
function statusColor(s:string){const m:Record<string,string>={active:'green',at_risk:'red',churned:'gray',prospect:'blue',paused:'amber',draft:'gray',completed:'teal',cancelled:'red',todo:'gray',in_progress:'blue',review:'amber',approved:'green',published:'teal',revision_required:'red'};return m[s]??'gray';}
function campaignTypeColor(t:string){const m:Record<string,string>={seo:'green',google_ads:'blue',meta_ads:'purple',linkedin_ads:'teal',email:'amber',content:'orange',social_organic:'teal',video:'red',pr:'purple',influencer:'pink',affiliate:'green'};return m[t]??'gray';}

// ─── Add Client Modal ──────────────────────────────────────────────────────────
function AddClientModal({onClose,onSaved,clients}:{onClose:()=>void;onSaved:()=>void;clients:DacClient[]}){
  void clients;
  const [form,setForm]=useState({company_name:'',industry:'',contact_name:'',contact_email:'',contact_phone:'',client_type:'retainer',monthly_retainer:'',annual_value:'',account_manager:'',contract_start:'',contract_end:'',status:'active',notes:'',services:['seo']});
  const [saving,setSaving]=useState(false);
  const f=(k:string,v:string)=>setForm(p=>({...p,[k]:v}));
  const toggleSvc=(svc:string)=>setForm(p=>({...p,services:p.services.includes(svc)?p.services.filter(s=>s!==svc):[...p.services,svc]}));
  async function submit(){
    if(!form.company_name||!form.contact_name||!form.contact_email)return;
    setSaving(true);
    try{
      await fetch('/api/admin/digital-agency-crm/clients',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,monthly_retainer:form.monthly_retainer?parseFloat(form.monthly_retainer):null,annual_value:form.annual_value?parseFloat(form.annual_value):null})});
      onSaved();
    }finally{setSaving(false);}
  }
  return(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-4 text-slate-800">New Agency Client</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs text-gray-500">Company Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.company_name} onChange={e=>f('company_name',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Industry</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.industry} onChange={e=>f('industry',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Client Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.client_type} onChange={e=>f('client_type',e.target.value)}>{CLIENT_TYPES.map(t=><option key={t} value={t}>{t.replace('_',' ')}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Contact Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.contact_name} onChange={e=>f('contact_name',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Contact Email *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.contact_email} onChange={e=>f('contact_email',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Phone</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.contact_phone} onChange={e=>f('contact_phone',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Account Manager</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.account_manager} onChange={e=>f('account_manager',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Monthly Retainer (CAD)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.monthly_retainer} onChange={e=>f('monthly_retainer',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Annual Value (CAD)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.annual_value} onChange={e=>f('annual_value',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Contract Start</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.contract_start} onChange={e=>f('contract_start',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Contract End</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.contract_end} onChange={e=>f('contract_end',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Status</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.status} onChange={e=>f('status',e.target.value)}>{CLIENT_STATUSES.map(s=><option key={s} value={s}>{s.replace('_',' ')}</option>)}</select></div>
          <div className="col-span-2"><label className="text-xs text-gray-500 block mb-1">Services</label><div className="flex flex-wrap gap-1">{SERVICES.map(svc=><button key={svc} type="button" onClick={()=>toggleSvc(svc)} className={`px-2 py-0.5 rounded text-xs border ${form.services.includes(svc)?'bg-blue-600 text-white border-blue-600':'bg-white text-gray-600 border-gray-300'}`}>{svc}</button>)}</div></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.notes} onChange={e=>f('notes',e.target.value)}/></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded border text-sm">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 rounded bg-blue-600 text-white text-sm disabled:opacity-50">{saving?'Saving…':'Add Client'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Campaign Modal ────────────────────────────────────────────────────────
function AddCampaignModal({onClose,onSaved,clients}:{onClose:()=>void;onSaved:()=>void;clients:DacClient[]}){
  const [form,setForm]=useState({client_id:'',campaign_name:'',campaign_type:'seo',platform:'',objective:'',budget_monthly:'',start_date:'',end_date:'',status:'active'});
  const [saving,setSaving]=useState(false);
  const f=(k:string,v:string)=>setForm(p=>({...p,[k]:v}));
  async function submit(){
    if(!form.client_id||!form.campaign_name)return;
    setSaving(true);
    try{
      await fetch('/api/admin/digital-agency-crm/campaigns',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,client_id:parseInt(form.client_id),budget_monthly:form.budget_monthly?parseFloat(form.budget_monthly):null})});
      onSaved();
    }finally{setSaving(false);}
  }
  return(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-4 text-slate-800">New Campaign</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs text-gray-500">Client *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.client_id} onChange={e=>f('client_id',e.target.value)}><option value="">Select client…</option>{clients.map(c=><option key={c.id} value={c.id}>{c.company_name}</option>)}</select></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Campaign Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.campaign_name} onChange={e=>f('campaign_name',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.campaign_type} onChange={e=>f('campaign_type',e.target.value)}>{CAMPAIGN_TYPES.map(t=><option key={t} value={t}>{t.replace('_',' ')}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Platform</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.platform} onChange={e=>f('platform',e.target.value)}/></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Objective</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.objective} onChange={e=>f('objective',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Monthly Budget (CAD)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.budget_monthly} onChange={e=>f('budget_monthly',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Status</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.status} onChange={e=>f('status',e.target.value)}>{CAMPAIGN_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Start Date</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.start_date} onChange={e=>f('start_date',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">End Date</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.end_date} onChange={e=>f('end_date',e.target.value)}/></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded border text-sm">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 rounded bg-blue-600 text-white text-sm disabled:opacity-50">{saving?'Saving…':'Add Campaign'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Update KPIs Modal ─────────────────────────────────────────────────────────
function UpdateKpiModal({campaign,onClose,onSaved}:{campaign:Campaign;onClose:()=>void;onSaved:()=>void}){
  const [form,setForm]=useState({spend_mtd:String(campaign.spend_mtd??''),impressions_mtd:String(campaign.impressions_mtd??''),clicks_mtd:String(campaign.clicks_mtd??''),conversions_mtd:String(campaign.conversions_mtd??''),leads_mtd:String(campaign.leads_mtd??''),roas:String(campaign.roas??''),cpc:String(campaign.cpc??''),ctr:String(campaign.ctr??''),cpa:String(campaign.cpa??'')});
  const [saving,setSaving]=useState(false);
  const f=(k:string,v:string)=>setForm(p=>({...p,[k]:v}));
  async function submit(){
    setSaving(true);
    try{
      const body:Record<string,number>={};
      Object.entries(form).forEach(([k,v])=>{if(v!=='')body[k]=parseFloat(v);});
      await fetch(`/api/admin/digital-agency-crm/campaigns/${campaign.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      onSaved();
    }finally{setSaving(false);}
  }
  return(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold mb-4 text-slate-800">Update KPIs — {campaign.campaign_name}</h2>
        <div className="grid grid-cols-2 gap-3">
          {[['spend_mtd','Spend MTD ($)'],['impressions_mtd','Impressions MTD'],['clicks_mtd','Clicks MTD'],['conversions_mtd','Conversions MTD'],['leads_mtd','Leads MTD'],['roas','ROAS (x)'],['cpc','CPC ($)'],['ctr','CTR (%)'],['cpa','CPA ($)']].map(([k,label])=>(
            <div key={k}><label className="text-xs text-gray-500">{label}</label><input type="number" step="0.01" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form[k as keyof typeof form]} onChange={e=>f(k,e.target.value)}/></div>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded border text-sm">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 rounded bg-blue-600 text-white text-sm disabled:opacity-50">{saving?'Saving…':'Update KPIs'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Deliverable Modal ─────────────────────────────────────────────────────
function AddDeliverableModal({onClose,onSaved,clients,campaigns}:{onClose:()=>void;onSaved:()=>void;clients:DacClient[];campaigns:Campaign[]}){
  const [form,setForm]=useState({client_id:'',campaign_id:'',deliverable_type:'blog_post',title:'',assigned_to:'',due_date:'',status:'todo',notes:''});
  const [saving,setSaving]=useState(false);
  const f=(k:string,v:string)=>setForm(p=>({...p,[k]:v}));
  const filteredCampaigns=campaigns.filter(c=>!form.client_id||c.client_id===parseInt(form.client_id));
  async function submit(){
    if(!form.client_id||!form.title)return;
    setSaving(true);
    try{
      await fetch('/api/admin/digital-agency-crm/deliverables',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,client_id:parseInt(form.client_id),campaign_id:form.campaign_id?parseInt(form.campaign_id):null})});
      onSaved();
    }finally{setSaving(false);}
  }
  return(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-4 text-slate-800">New Deliverable</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs text-gray-500">Client *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.client_id} onChange={e=>f('client_id',e.target.value)}><option value="">Select client…</option>{clients.map(c=><option key={c.id} value={c.id}>{c.company_name}</option>)}</select></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Campaign (optional)</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.campaign_id} onChange={e=>f('campaign_id',e.target.value)}><option value="">None</option>{filteredCampaigns.map(c=><option key={c.id} value={c.id}>{c.campaign_name}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.deliverable_type} onChange={e=>f('deliverable_type',e.target.value)}>{DELIVERABLE_TYPES.map(t=><option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Status</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.status} onChange={e=>f('status',e.target.value)}>{DELIVERABLE_STATUSES.map(s=><option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}</select></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Title *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.title} onChange={e=>f('title',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Assigned To</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.assigned_to} onChange={e=>f('assigned_to',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Due Date</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.due_date} onChange={e=>f('due_date',e.target.value)}/></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.notes} onChange={e=>f('notes',e.target.value)}/></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded border text-sm">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 rounded bg-blue-600 text-white text-sm disabled:opacity-50">{saving?'Saving…':'Add Deliverable'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Generate Report Modal ─────────────────────────────────────────────────────
function GenerateReportModal({onClose,onSaved,clients}:{onClose:()=>void;onSaved:()=>void;clients:DacClient[]}){
  const now=new Date();
  const [form,setForm]=useState({client_id:'',report_month:`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`,total_impressions:'',total_clicks:'',total_conversions:'',total_spend:'',roas:'',top_performing_campaign:'',seo_keywords_top10:'',organic_traffic_growth_pct:'',social_followers_gained:'',email_open_rate:''});
  const [saving,setSaving]=useState(false);
  const f=(k:string,v:string)=>setForm(p=>({...p,[k]:v}));
  async function submit(){
    if(!form.client_id||!form.report_month)return;
    setSaving(true);
    try{
      const body:Record<string,unknown>={client_id:parseInt(form.client_id),report_month:form.report_month,top_performing_campaign:form.top_performing_campaign||null};
      ['total_impressions','total_clicks','total_conversions','seo_keywords_top10','social_followers_gained'].forEach(k=>{if(form[k as keyof typeof form])body[k]=parseInt(form[k as keyof typeof form]);});
      ['total_spend','roas','organic_traffic_growth_pct','email_open_rate'].forEach(k=>{if(form[k as keyof typeof form])body[k]=parseFloat(form[k as keyof typeof form]);});
      await fetch('/api/admin/digital-agency-crm/reports',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      onSaved();
    }finally{setSaving(false);}
  }
  return(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-4 text-slate-800">Generate Monthly Report</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs text-gray-500">Client *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.client_id} onChange={e=>f('client_id',e.target.value)}><option value="">Select…</option>{clients.map(c=><option key={c.id} value={c.id}>{c.company_name}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Report Month *</label><input type="month" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.report_month} onChange={e=>f('report_month',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Total Spend ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.total_spend} onChange={e=>f('total_spend',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Impressions</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.total_impressions} onChange={e=>f('total_impressions',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Clicks</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.total_clicks} onChange={e=>f('total_clicks',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Conversions</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.total_conversions} onChange={e=>f('total_conversions',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">ROAS (x)</label><input type="number" step="0.01" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.roas} onChange={e=>f('roas',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">SEO Keywords Top 10</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.seo_keywords_top10} onChange={e=>f('seo_keywords_top10',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Organic Growth %</label><input type="number" step="0.1" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.organic_traffic_growth_pct} onChange={e=>f('organic_traffic_growth_pct',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Social Followers Gained</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.social_followers_gained} onChange={e=>f('social_followers_gained',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Email Open Rate %</label><input type="number" step="0.1" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.email_open_rate} onChange={e=>f('email_open_rate',e.target.value)}/></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Top Performing Campaign</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.top_performing_campaign} onChange={e=>f('top_performing_campaign',e.target.value)}/></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded border text-sm">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 rounded bg-blue-600 text-white text-sm disabled:opacity-50">{saving?'Saving…':'Generate Report'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function DigitalAgencyCrmPage() {
  const [tab,setTab]=useState<Tab>('dashboard');
  const [dashboard,setDashboard]=useState<Dashboard|null>(null);
  const [clients,setClients]=useState<DacClient[]>([]);
  const [campaigns,setCampaigns]=useState<Campaign[]>([]);
  const [deliverables,setDeliverables]=useState<Deliverable[]>([]);
  const [reports,setReports]=useState<Report[]>([]);
  const [clientFilter,setClientFilter]=useState('');
  const [campaignClientFilter,setCampaignClientFilter]=useState('');
  const [deliverableFilter,setDeliverableFilter]=useState('');
  const [dueThisWeek,setDueThisWeek]=useState(false);
  const [showAddClient,setShowAddClient]=useState(false);
  const [showAddCampaign,setShowAddCampaign]=useState(false);
  const [showUpdateKpi,setShowUpdateKpi]=useState<Campaign|null>(null);
  const [showAddDeliverable,setShowAddDeliverable]=useState(false);
  const [showGenerateReport,setShowGenerateReport]=useState(false);
  const [aiReportInput,setAiReportInput]=useState({company_name:'',report_month:'',impressions:'',clicks:'',conversions:'',spend:'',roas:'',seo_keywords_top10:'',organic_growth:'',top_campaign:''});
  const [aiReportOutput,setAiReportOutput]=useState('');
  const [aiStrategyInput,setAiStrategyInput]=useState({company_name:'',industry:'',services:'seo, ppc, social_media',budget:'',objective:''});
  const [aiStrategyOutput,setAiStrategyOutput]=useState('');
  const [aiLoading,setAiLoading]=useState(false);

  const loadDashboard=useCallback(async()=>{const r=await fetch('/api/admin/digital-agency-crm');if(r.ok)setDashboard(await r.json());},[]);
  const loadClients=useCallback(async()=>{const r=await fetch('/api/admin/digital-agency-crm/clients');if(r.ok)setClients(await r.json());},[]);
  const loadCampaigns=useCallback(async()=>{const r=await fetch('/api/admin/digital-agency-crm/campaigns');if(r.ok)setCampaigns(await r.json());},[]);
  const loadDeliverables=useCallback(async()=>{const params=new URLSearchParams();if(dueThisWeek)params.set('due_this_week','true');if(deliverableFilter)params.set('client_id',deliverableFilter);const r=await fetch(`/api/admin/digital-agency-crm/deliverables?${params}`);if(r.ok)setDeliverables(await r.json());},[dueThisWeek,deliverableFilter]);
  const loadReports=useCallback(async()=>{const params=new URLSearchParams();if(clientFilter)params.set('client_id',clientFilter);const r=await fetch(`/api/admin/digital-agency-crm/reports?${params}`);if(r.ok)setReports(await r.json());},[clientFilter]);

  useEffect(()=>{loadDashboard();loadClients();},[loadDashboard,loadClients]);
  useEffect(()=>{if(tab==='campaigns')loadCampaigns();},[tab,loadCampaigns]);
  useEffect(()=>{if(tab==='deliverables')loadDeliverables();},[tab,loadDeliverables]);
  useEffect(()=>{if(tab==='reports')loadReports();},[tab,loadReports]);

  const filteredClients=clients.filter(c=>!clientFilter||(c.company_name+c.account_manager).toLowerCase().includes(clientFilter.toLowerCase()));
  const filteredCampaigns=campaigns.filter(c=>!campaignClientFilter||String(c.client_id)===campaignClientFilter);

  async function approveDeliverable(id:number){
    await fetch(`/api/admin/digital-agency-crm/deliverables/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'approved',client_approved:true})});
    loadDeliverables();
  }
  async function markReportSent(id:number){
    await fetch(`/api/admin/digital-agency-crm/reports/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({sent_to_client:true,sent_date:new Date().toISOString().split('T')[0]})});
    loadReports();
  }
  async function runAiReport(){
    setAiLoading(true);setAiReportOutput('');
    try{const r=await fetch('/api/admin/digital-agency-crm/ai-monthly-report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...aiReportInput,impressions:aiReportInput.impressions?parseInt(aiReportInput.impressions):null,clicks:aiReportInput.clicks?parseInt(aiReportInput.clicks):null,conversions:aiReportInput.conversions?parseInt(aiReportInput.conversions):null,spend:aiReportInput.spend?parseFloat(aiReportInput.spend):null,roas:aiReportInput.roas?parseFloat(aiReportInput.roas):null,seo_keywords_top10:aiReportInput.seo_keywords_top10?parseInt(aiReportInput.seo_keywords_top10):null,organic_growth:aiReportInput.organic_growth?parseFloat(aiReportInput.organic_growth):null})});if(r.ok){const d=await r.json();setAiReportOutput(d.report);}}
    finally{setAiLoading(false);}
  }
  async function runAiStrategy(){
    setAiLoading(true);setAiStrategyOutput('');
    try{const r=await fetch('/api/admin/digital-agency-crm/ai-strategy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...aiStrategyInput,services:aiStrategyInput.services.split(',').map(s=>s.trim()),budget:aiStrategyInput.budget?parseFloat(aiStrategyInput.budget):null})});if(r.ok){const d=await r.json();setAiStrategyOutput(d.strategy);}}
    finally{setAiLoading(false);}
  }

  const isOverdue=(due:string)=>due&&new Date(due)<new Date();

  return(
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-2xl font-bold text-slate-800">Digital Marketing Agency CRM</h1>
        <p className="text-sm text-gray-500 mt-0.5">Client management, campaigns, deliverables & reporting</p>
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
              <KpiCard label="Active Clients" value={dashboard?.active_clients??'—'} color="blue"/>
              <KpiCard label="Monthly Recurring Revenue" value={dashboard?fmtCad(dashboard.mrr_total):'—'} color="green"/>
              <KpiCard label="Active Campaigns" value={dashboard?.campaigns_active??'—'} color="purple"/>
              <KpiCard label="Deliverables Due This Week" value={dashboard?.deliverables_due_this_week??'—'} color="amber"/>
              <KpiCard label="At-Risk Clients" value={dashboard?.at_risk_clients??'—'} color="red"/>
            </div>
            {dashboard&&dashboard.at_risk_clients>0&&(
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="font-semibold text-red-700 mb-2">At-Risk Client Alert</h3>
                <div className="flex flex-wrap gap-2">
                  {clients.filter(c=>c.status==='at_risk').map(c=>(
                    <div key={c.id} className="bg-white border border-red-200 rounded px-3 py-2 text-sm">
                      <span className="font-medium">{c.company_name}</span>
                      <span className="ml-2 text-red-600">Churn Risk: {c.churn_risk_score}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white rounded-lg border p-4">
                <h3 className="font-semibold text-slate-700 mb-3">Deliverables Due This Week</h3>
                {deliverables.filter(d=>!['approved','published'].includes(d.status)&&d.due_date&&new Date(d.due_date)<=new Date(Date.now()+7*86400000)).slice(0,8).map(d=>(
                  <div key={d.id} className={`flex items-center justify-between py-1.5 border-b last:border-0 text-sm ${isOverdue(d.due_date)?'text-red-600':''}`}>
                    <span>{d.title}</span>
                    <div className="flex items-center gap-2"><span className="text-xs text-gray-400">{fmtDate(d.due_date)}</span><Badge label={d.status} color={statusColor(d.status)}/></div>
                  </div>
                ))}
                {deliverables.length===0&&<p className="text-sm text-gray-400">No deliverables loaded — visit Deliverables tab</p>}
              </div>
              <div className="bg-white rounded-lg border p-4">
                <h3 className="font-semibold text-slate-700 mb-3">Active Campaigns Summary</h3>
                {campaigns.filter(c=>c.status==='active').slice(0,8).map(c=>(
                  <div key={c.id} className="flex items-center justify-between py-1.5 border-b last:border-0 text-sm">
                    <div><span className="font-medium">{c.campaign_name}</span><span className="text-xs text-gray-400 ml-2">{c.company_name}</span></div>
                    <div className="flex gap-2"><Badge label={c.campaign_type} color={campaignTypeColor(c.campaign_type)}/>{c.roas&&<span className="text-xs text-green-600">{c.roas}x ROAS</span>}</div>
                  </div>
                ))}
                {campaigns.length===0&&<p className="text-sm text-gray-400">No campaigns loaded — visit Campaigns tab</p>}
              </div>
            </div>
          </div>
        )}

        {/* CLIENTS */}
        {tab==='clients'&&(
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <input className="border rounded px-3 py-1.5 text-sm w-64" placeholder="Search clients…" value={clientFilter} onChange={e=>setClientFilter(e.target.value)}/>
              <button onClick={()=>setShowAddClient(true)} className="px-4 py-2 bg-blue-600 text-white rounded text-sm">+ Add Client</button>
            </div>
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b"><tr>{['Company','Type','Account Manager','MRR','Contract End','Churn Risk','NPS','Status',''].map(h=><th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr></thead>
                <tbody>
                  {filteredClients.map(c=>(
                    <tr key={c.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2.5"><div className="font-medium">{c.company_name}</div><div className="text-xs text-gray-400">{c.industry}</div></td>
                      <td className="px-4 py-2.5"><Badge label={c.client_type} color="blue"/></td>
                      <td className="px-4 py-2.5 text-gray-600">{c.account_manager||'—'}</td>
                      <td className="px-4 py-2.5 font-medium">{c.monthly_retainer?fmtCad(c.monthly_retainer):'—'}</td>
                      <td className="px-4 py-2.5"><span className={c.days_to_renewal&&c.days_to_renewal<30?'text-amber-600 font-medium':'text-gray-600'}>{c.contract_end?`${fmtDate(c.contract_end)} (${Math.round(c.days_to_renewal??0)}d)`:'—'}</span></td>
                      <td className="px-4 py-2.5"><Badge label={`${c.churn_risk_score}%`} color={churnColor(c.churn_risk_score)}/></td>
                      <td className="px-4 py-2.5">{c.nps_score!==null&&c.nps_score!==undefined?<Badge label={`NPS ${c.nps_score}`} color={c.nps_score>=8?'green':c.nps_score>=6?'amber':'red'}/>:'—'}</td>
                      <td className="px-4 py-2.5"><Badge label={c.status} color={statusColor(c.status)}/></td>
                      <td className="px-4 py-2.5"><div className="flex gap-1">{(c.services||[]).slice(0,3).map(s=><Badge key={s} label={s} color="gray"/>)}{(c.services||[]).length>3&&<span className="text-xs text-gray-400">+{c.services.length-3}</span>}</div></td>
                    </tr>
                  ))}
                  {filteredClients.length===0&&<tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No clients found</td></tr>}
                </tbody>
              </table>
            </div>
            {showAddClient&&<AddClientModal clients={clients} onClose={()=>setShowAddClient(false)} onSaved={()=>{setShowAddClient(false);loadClients();}}/>}
          </div>
        )}

        {/* CAMPAIGNS */}
        {tab==='campaigns'&&(
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <select className="border rounded px-3 py-1.5 text-sm" value={campaignClientFilter} onChange={e=>setCampaignClientFilter(e.target.value)}>
                <option value="">All Clients</option>
                {clients.map(c=><option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
              <button onClick={()=>setShowAddCampaign(true)} className="px-4 py-2 bg-blue-600 text-white rounded text-sm">+ Add Campaign</button>
            </div>
            <div className="grid gap-4">
              {filteredCampaigns.map(c=>(
                <div key={c.id} className="bg-white rounded-lg border p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2"><h3 className="font-semibold">{c.campaign_name}</h3><Badge label={c.campaign_type} color={campaignTypeColor(c.campaign_type)}/><Badge label={c.status} color={statusColor(c.status)}/></div>
                      <p className="text-xs text-gray-400 mt-0.5">{c.company_name}{c.platform&&` · ${c.platform}`}</p>
                    </div>
                    <button onClick={()=>setShowUpdateKpi(c)} className="px-3 py-1.5 rounded border text-xs">Update KPIs</button>
                  </div>
                  <div className="grid grid-cols-7 gap-3 text-sm">
                    {c.budget_monthly&&(<div><p className="text-xs text-gray-500">Budget/mo</p><p className="font-medium">{fmtCad(c.budget_monthly)}</p></div>)}
                    {c.spend_mtd!==null&&(<div><p className="text-xs text-gray-500">Spend MTD</p><p className="font-medium">{fmtCad(c.spend_mtd)}</p>{c.budget_monthly&&<div className="w-full bg-gray-200 rounded h-1 mt-1"><div className="bg-blue-500 h-1 rounded" style={{width:`${Math.min(100,(c.spend_mtd/c.budget_monthly)*100)}%`}}/></div>}</div>)}
                    {c.impressions_mtd!==undefined&&(<div><p className="text-xs text-gray-500">Impressions</p><p className="font-medium">{fmtNum(c.impressions_mtd)}</p></div>)}
                    {c.clicks_mtd!==undefined&&(<div><p className="text-xs text-gray-500">Clicks</p><p className="font-medium">{fmtNum(c.clicks_mtd)}</p></div>)}
                    {c.conversions_mtd!==undefined&&(<div><p className="text-xs text-gray-500">Conversions</p><p className="font-medium">{c.conversions_mtd}</p></div>)}
                    {c.roas&&(<div><p className="text-xs text-gray-500">ROAS</p><p className="font-medium text-green-600">{c.roas}x</p></div>)}
                    {c.ctr&&(<div><p className="text-xs text-gray-500">CTR</p><p className="font-medium">{c.ctr}%</p></div>)}
                  </div>
                </div>
              ))}
              {filteredCampaigns.length===0&&<div className="bg-white rounded-lg border p-8 text-center text-gray-400">No campaigns found</div>}
            </div>
            {showAddCampaign&&<AddCampaignModal clients={clients} onClose={()=>setShowAddCampaign(false)} onSaved={()=>{setShowAddCampaign(false);loadCampaigns();}}/>}
            {showUpdateKpi&&<UpdateKpiModal campaign={showUpdateKpi} onClose={()=>setShowUpdateKpi(null)} onSaved={()=>{setShowUpdateKpi(null);loadCampaigns();}}/>}
          </div>
        )}

        {/* DELIVERABLES */}
        {tab==='deliverables'&&(
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex gap-2 items-center">
                <select className="border rounded px-3 py-1.5 text-sm" value={deliverableFilter} onChange={e=>{setDeliverableFilter(e.target.value);setTimeout(loadDeliverables,0);}}>
                  <option value="">All Clients</option>
                  {clients.map(c=><option key={c.id} value={c.id}>{c.company_name}</option>)}
                </select>
                <label className="flex items-center gap-1 text-sm cursor-pointer"><input type="checkbox" checked={dueThisWeek} onChange={e=>setDueThisWeek(e.target.checked)} className="rounded"/><span>Due This Week</span></label>
              </div>
              <button onClick={()=>setShowAddDeliverable(true)} className="px-4 py-2 bg-blue-600 text-white rounded text-sm">+ Add Deliverable</button>
            </div>
            {/* Kanban by status */}
            <div className="grid grid-cols-3 gap-4">
              {[['todo','To Do','gray'],['in_progress','In Progress','blue'],['review','In Review','amber'],['approved','Approved','green'],['published','Published','teal'],['revision_required','Needs Revision','red']].map(([status,label,color])=>(
                <div key={status} className="bg-white rounded-lg border">
                  <div className="px-3 py-2 border-b flex items-center gap-2"><Badge label={label} color={color}/><span className="text-xs text-gray-400">{deliverables.filter(d=>d.status===status).length}</span></div>
                  <div className="p-2 space-y-2 min-h-16">
                    {deliverables.filter(d=>d.status===status).map(d=>(
                      <div key={d.id} className={`rounded border p-2 text-xs ${isOverdue(d.due_date)&&!['approved','published'].includes(d.status)?'border-red-300 bg-red-50':''}`}>
                        <p className="font-medium">{d.title}</p>
                        <p className="text-gray-400 mt-0.5">{d.company_name} · {d.deliverable_type?.replace(/_/g,' ')}</p>
                        <div className="flex items-center justify-between mt-1">
                          <span className={isOverdue(d.due_date)&&!['approved','published'].includes(d.status)?'text-red-500':'text-gray-400'}>{fmtDate(d.due_date)}</span>
                          {status==='review'&&<button onClick={()=>approveDeliverable(d.id)} className="px-2 py-0.5 rounded bg-green-600 text-white text-xs">Approve</button>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {showAddDeliverable&&<AddDeliverableModal clients={clients} campaigns={campaigns} onClose={()=>setShowAddDeliverable(false)} onSaved={()=>{setShowAddDeliverable(false);loadDeliverables();}}/>}
          </div>
        )}

        {/* REPORTS */}
        {tab==='reports'&&(
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <select className="border rounded px-3 py-1.5 text-sm" value={clientFilter} onChange={e=>{setClientFilter(e.target.value);setTimeout(loadReports,0);}}>
                <option value="">All Clients</option>
                {clients.map(c=><option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
              <button onClick={()=>setShowGenerateReport(true)} className="px-4 py-2 bg-blue-600 text-white rounded text-sm">+ Generate Report</button>
            </div>
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b"><tr>{['Client','Month','Impressions','Clicks','Conversions','Spend','ROAS','SEO Top 10','Organic Growth','Sent'].map(h=><th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr></thead>
                <tbody>
                  {reports.map(r=>(
                    <tr key={r.id} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-2.5 font-medium">{r.company_name}</td>
                      <td className="px-3 py-2.5 font-mono">{r.report_month}</td>
                      <td className="px-3 py-2.5">{r.total_impressions?fmtNum(r.total_impressions):'—'}</td>
                      <td className="px-3 py-2.5">{r.total_clicks?fmtNum(r.total_clicks):'—'}</td>
                      <td className="px-3 py-2.5">{r.total_conversions??'—'}</td>
                      <td className="px-3 py-2.5">{r.total_spend?fmtCad(r.total_spend):'—'}</td>
                      <td className="px-3 py-2.5">{r.roas?`${r.roas}x`:'—'}</td>
                      <td className="px-3 py-2.5">{r.seo_keywords_top10??'—'}</td>
                      <td className="px-3 py-2.5">{r.organic_traffic_growth_pct!==null?`${r.organic_traffic_growth_pct}%`:'—'}</td>
                      <td className="px-3 py-2.5">{r.sent_to_client?<Badge label={`Sent ${fmtDate(r.sent_date)}`} color="green"/>:<button onClick={()=>markReportSent(r.id)} className="px-2 py-1 rounded border text-xs">Mark Sent</button>}</td>
                    </tr>
                  ))}
                  {reports.length===0&&<tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">No reports found</td></tr>}
                </tbody>
              </table>
            </div>
            {showGenerateReport&&<GenerateReportModal clients={clients} onClose={()=>setShowGenerateReport(false)} onSaved={()=>{setShowGenerateReport(false);loadReports();}}/>}
          </div>
        )}

        {/* AI TOOLS */}
        {tab==='ai'&&(
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border p-5">
              <h3 className="font-semibold text-slate-800 mb-3">Monthly Performance Report Writer</h3>
              <div className="space-y-2">
                {[['company_name','Client Company Name'],['report_month','Report Month (YYYY-MM)'],['impressions','Total Impressions'],['clicks','Total Clicks'],['conversions','Conversions'],['spend','Total Spend ($)'],['roas','ROAS (x)'],['seo_keywords_top10','SEO Keywords Top 10'],['organic_growth','Organic Growth %'],['top_campaign','Top Performing Campaign']].map(([k,label])=>(
                  <div key={k}><label className="text-xs text-gray-500">{label}</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiReportInput[k as keyof typeof aiReportInput]} onChange={e=>setAiReportInput(p=>({...p,[k]:e.target.value}))}/></div>
                ))}
                <button onClick={runAiReport} disabled={aiLoading} className="w-full py-2 bg-blue-600 text-white rounded text-sm mt-2 disabled:opacity-50">{aiLoading?'Generating…':'Generate Report'}</button>
              </div>
              {aiReportOutput&&<pre className="mt-4 p-3 bg-gray-50 border rounded text-xs whitespace-pre-wrap max-h-96 overflow-y-auto">{aiReportOutput}</pre>}
            </div>
            <div className="bg-white rounded-lg border p-5">
              <h3 className="font-semibold text-slate-800 mb-3">90-Day Strategy Builder</h3>
              <div className="space-y-2">
                {[['company_name','Client Company Name'],['industry','Industry'],['services','Services (comma-separated)'],['budget','Monthly Budget ($)'],['objective','Primary Goal / Objective']].map(([k,label])=>(
                  <div key={k}><label className="text-xs text-gray-500">{label}</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiStrategyInput[k as keyof typeof aiStrategyInput]} onChange={e=>setAiStrategyInput(p=>({...p,[k]:e.target.value}))}/></div>
                ))}
                <button onClick={runAiStrategy} disabled={aiLoading} className="w-full py-2 bg-purple-600 text-white rounded text-sm mt-2 disabled:opacity-50">{aiLoading?'Generating…':'Generate Strategy'}</button>
              </div>
              {aiStrategyOutput&&<pre className="mt-4 p-3 bg-gray-50 border rounded text-xs whitespace-pre-wrap max-h-96 overflow-y-auto">{aiStrategyOutput}</pre>}
            </div>
          </div>
        )}

        {/* ANALYTICS */}
        {tab==='analytics'&&(
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border p-5">
              <h3 className="font-semibold text-slate-800 mb-4">Client Status Breakdown</h3>
              <div className="space-y-3">
                {CLIENT_STATUSES.map(s=>{const count=clients.filter(c=>c.status===s).length;const pct=clients.length?Math.round((count/clients.length)*100):0;return(
                  <div key={s}><div className="flex justify-between text-sm mb-1"><span className="capitalize">{s.replace('_',' ')}</span><span className="font-medium">{count}</span></div><div className="w-full bg-gray-100 rounded h-2"><div className={`h-2 rounded ${s==='active'?'bg-green-500':s==='at_risk'?'bg-red-500':s==='churned'?'bg-gray-400':s==='prospect'?'bg-blue-500':'bg-amber-400'}`} style={{width:`${pct}%`}}/></div></div>
                );})}
              </div>
            </div>
            <div className="bg-white rounded-lg border p-5">
              <h3 className="font-semibold text-slate-800 mb-4">Campaign Type Distribution</h3>
              <div className="space-y-2">
                {CAMPAIGN_TYPES.map(t=>{const count=campaigns.filter(c=>c.campaign_type===t).length;return count>0&&(
                  <div key={t} className="flex items-center justify-between text-sm"><span>{t.replace(/_/g,' ')}</span><Badge label={String(count)} color={campaignTypeColor(t)}/></div>
                );})}
                {campaigns.length===0&&<p className="text-gray-400 text-sm">Load campaigns tab first</p>}
              </div>
            </div>
            <div className="bg-white rounded-lg border p-5">
              <h3 className="font-semibold text-slate-800 mb-4">MRR by Client Type</h3>
              <div className="space-y-3">
                {CLIENT_TYPES.map(t=>{const mrr=clients.filter(c=>c.client_type===t).reduce((a,c)=>a+(c.monthly_retainer||0),0);return mrr>0&&(
                  <div key={t} className="flex justify-between text-sm"><span className="capitalize">{t.replace('_',' ')}</span><span className="font-semibold text-green-700">{fmtCad(mrr)}</span></div>
                );})}
              </div>
            </div>
            <div className="bg-white rounded-lg border p-5">
              <h3 className="font-semibold text-slate-800 mb-4">Churn Risk Distribution</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-red-600">High Risk (70-100)</span><Badge label={String(clients.filter(c=>c.churn_risk_score>=70).length)} color="red"/></div>
                <div className="flex justify-between"><span className="text-amber-600">Medium Risk (40-69)</span><Badge label={String(clients.filter(c=>c.churn_risk_score>=40&&c.churn_risk_score<70).length)} color="amber"/></div>
                <div className="flex justify-between"><span className="text-green-600">Low Risk (0-39)</span><Badge label={String(clients.filter(c=>c.churn_risk_score<40).length)} color="green"/></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
