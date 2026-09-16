'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard','clients','sessions','goals','home-modifications','ai-tools','funding'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab,string> = { dashboard:'Dashboard', clients:'Clients', sessions:'Sessions', goals:'Goals', 'home-modifications':'Home Modifications', 'ai-tools':'AI OT Tools', funding:'Funding Tracker' };

const OTS = ['Ms. Linda Park OT Reg.(AB)','Mr. James Nguyen OT Reg.(AB)','Dr. Priya Sharma OT Reg.(AB)'];
const OT_AREAS = ['self_care','productivity','leisure','fine_motor','gross_motor','sensory_processing','cognitive','home_modification','assistive_technology','community_integration','return_to_work','pediatric_development'];
const SETTINGS = ['clinic','home','school','community','work','telehealth'];
const SESSION_TYPES = ['initial_assessment','treatment','home_visit','school_consultation','assistive_device_training','discharge_planning','re_assessment'];
const FUNDING_SOURCES = ['private_pay','extended_health','aish','wca','ahs','school','other'];
const ROOMS = ['bathroom','bedroom','kitchen','entrance','living_room','stairs','outdoor','other'];
const RISK_LEVELS = ['low','medium','high','immediate'];
const MOD_STATUSES = ['recommended','quoted','approved','installed','declined'];
const REFERRAL_SOURCES = ['physician','school','aish','wca','ahs_home_care','self','other'];

interface OTClient { id:number; first_name:string; last_name:string; date_of_birth:string; diagnosis:string[]; areas_of_focus:string[]; setting:string; ot:string; funding_source:string; wca_claim:string; aish_file_number:string; extended_health_provider:string; home_assessment_required:boolean; status:string; session_count:number; active_goals:number; achieved_goals:number; pending_modifications:number; referral_source:string; created_at:string; }
interface OTSession { id:number; client_id:number; first_name:string; last_name:string; ot:string; session_date:string; start_time:string; end_time:string; session_setting:string; session_type:string; status:string; funding_source:string; wca_claim:string; diagnosis:string[]; fee:number; client_participation:string; }
interface OTGoal { id:number; client_id:number; first_name:string; last_name:string; occupational_area:string; goal_description:string; baseline:string; target:string; measurement_method:string; status:string; achieved_date:string; progress:string; created_at:string; }
interface HomeModification { id:number; client_id:number; first_name:string; last_name:string; room:string; modification_type:string; risk_level:string; recommended_equipment:string; estimated_cost:number; funded_by:string; installation_required:boolean; status:string; notes:string; assessment_date:string; }
interface DashData { active_clients:number; home_visits_today:number; home_assessments_pending:number; wca_caseload:number; revenue_mtd:number; today_schedule:OTSession[]; modifications_pending:HomeModification[]; }

function fmtCad(n:number) { return `$${Number(n??0).toLocaleString('en-CA',{minimumFractionDigits:0})}` }
function fmtDate(d:string) { return d?new Date(d).toLocaleDateString('en-CA'):'—' }
function fmtTime(t:string) { return t?t.slice(0,5):'—' }
function clientAge(dob:string) { if(!dob)return '?'; const b=new Date(dob); const a=new Date(); return `${Math.floor((a.getTime()-b.getTime())/31557600000)} yrs`; }

function Badge({ label, color='gray' }:{ label:string; color?:string }) {
  const m:Record<string,string> = { blue:'bg-blue-100 text-blue-700', green:'bg-green-100 text-green-700', amber:'bg-amber-100 text-amber-700', red:'bg-red-100 text-red-700', purple:'bg-purple-100 text-purple-700', gray:'bg-gray-100 text-gray-700', teal:'bg-teal-100 text-teal-700', orange:'bg-orange-100 text-orange-700', rose:'bg-rose-100 text-rose-700' };
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${m[color]??m.gray}`}>{label.replace(/_/g,' ')}</span>;
}
function KpiCard({ label, value, sub, color='blue' }:{ label:string; value:string|number; sub?:string; color?:string }) {
  const b:Record<string,string> = { blue:'border-l-4 border-blue-500 bg-blue-50', green:'border-l-4 border-green-500 bg-green-50', amber:'border-l-4 border-amber-500 bg-amber-50', red:'border-l-4 border-red-500 bg-red-50', purple:'border-l-4 border-purple-500 bg-purple-50', orange:'border-l-4 border-orange-500 bg-orange-50' };
  return <div className={`rounded-lg p-4 ${b[color]??b.blue}`}><p className="text-sm text-gray-500">{label}</p><p className="text-2xl font-bold mt-1">{value}</p>{sub&&<p className="text-xs text-gray-400 mt-1">{sub}</p>}</div>;
}
function settingColor(s:string) { const m:Record<string,string>={clinic:'blue',home:'green',school:'orange',community:'teal',work:'purple',telehealth:'gray',hospital:'red'}; return m[s]??'gray'; }
function riskColor(r:string) { const m:Record<string,string>={low:'green',medium:'amber',high:'orange',immediate:'red'}; return m[r]??'gray'; }
function statusColor(s:string) { const m:Record<string,string>={scheduled:'blue',completed:'green',cancelled:'red',no_show:'gray',active:'green',waitlist:'amber',discharged:'purple',on_hold:'gray',achieved:'green',modified:'amber',discontinued:'red',recommended:'blue',quoted:'amber',approved:'purple',installed:'green',declined:'red'}; return m[s]??'gray'; }
function fundingColor(s:string) { const m:Record<string,string>={private_pay:'gray',extended_health:'purple',aish:'blue',wca:'orange',ahs:'teal',school:'green',other:'gray'}; return m[s]??'gray'; }

// ─── Add Client Modal ─────────────────────────────────────────────────────────
function AddClientModal({ onClose, onSaved }:{ onClose:()=>void; onSaved:()=>void }) {
  const [form,setForm] = useState({ first_name:'', last_name:'', date_of_birth:'', email:'', phone:'', parent_name:'', parent_phone:'', referral_source:'physician', diagnosis:[] as string[], areas_of_focus:[] as string[], setting:'clinic', ot:OTS[0], funding_source:'private_pay', wca_claim:'', aish_file_number:'', extended_health_provider:'', home_assessment_required:false, status:'active' });
  const [saving,setSaving] = useState(false);
  const f = (k:string,v:string|boolean) => setForm(p=>({...p,[k]:v}));
  const toggleArea = (a:string) => setForm(p=>({...p,areas_of_focus:p.areas_of_focus.includes(a)?p.areas_of_focus.filter(x=>x!==a):[...p.areas_of_focus,a]}));
  async function submit() {
    if(!form.first_name||!form.last_name||!form.date_of_birth)return;
    setSaving(true);
    try {
      const diagArr = typeof form.diagnosis==='string'?(form.diagnosis as string).split(',').map((s:string)=>s.trim()).filter(Boolean):form.diagnosis;
      await fetch('/api/admin/occupational-therapy/clients',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,diagnosis:diagArr})});
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-4 text-slate-800">New OT Client</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500">First Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.first_name} onChange={e=>f('first_name',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Last Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.last_name} onChange={e=>f('last_name',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Date of Birth *</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.date_of_birth} onChange={e=>f('date_of_birth',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Referral Source</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.referral_source} onChange={e=>f('referral_source',e.target.value)}>{REFERRAL_SOURCES.map(r=><option key={r} value={r}>{r.replace(/_/g,' ')}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Email</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.email} onChange={e=>f('email',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Phone</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.phone} onChange={e=>f('phone',e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Diagnoses (comma-separated)</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" placeholder="e.g. Stroke, OA, TBI" onChange={e=>setForm(p=>({...p,diagnosis:e.target.value.split(',').map(s=>s.trim()).filter(Boolean)}))} /></div>
          <div className="col-span-2">
            <label className="text-xs text-gray-500">Areas of Focus</label>
            <div className="flex flex-wrap gap-1.5 mt-1">{OT_AREAS.map(a=><button key={a} type="button" onClick={()=>toggleArea(a)} className={`px-2 py-0.5 rounded text-xs border ${form.areas_of_focus.includes(a)?'bg-blue-600 text-white border-blue-600':'border-gray-300 text-gray-600'}`}>{a.replace(/_/g,' ')}</button>)}</div>
          </div>
          <div><label className="text-xs text-gray-500">Primary Setting</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.setting} onChange={e=>f('setting',e.target.value)}>{SETTINGS.map(s=><option key={s}>{s}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Assigned OT</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.ot} onChange={e=>f('ot',e.target.value)}>{OTS.map(o=><option key={o}>{o}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Funding Source</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.funding_source} onChange={e=>f('funding_source',e.target.value)}>{FUNDING_SOURCES.map(s=><option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Status</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.status} onChange={e=>f('status',e.target.value)}>{['active','waitlist','on_hold'].map(s=><option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}</select></div>
          {form.funding_source==='wca'&&<div><label className="text-xs text-gray-500">WCA Claim #</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5 font-mono" value={form.wca_claim} onChange={e=>f('wca_claim',e.target.value)} /></div>}
          {form.funding_source==='aish'&&<div><label className="text-xs text-gray-500">AISH File #</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5 font-mono" value={form.aish_file_number} onChange={e=>f('aish_file_number',e.target.value)} /></div>}
          {form.funding_source==='extended_health'&&<div><label className="text-xs text-gray-500">Extended Health Provider</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.extended_health_provider} onChange={e=>f('extended_health_provider',e.target.value)} /></div>}
          <div className="flex items-center gap-2 mt-1"><input type="checkbox" id="home_assess" checked={form.home_assessment_required} onChange={e=>f('home_assessment_required',e.target.checked)} /><label htmlFor="home_assess" className="text-sm text-gray-700">Home assessment required</label></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{saving?'Saving…':'Add Client'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Complete Session Modal ───────────────────────────────────────────────────
function CompleteSessionModal({ session, onClose, onSaved }:{ session:OTSession; onClose:()=>void; onSaved:()=>void }) {
  const [form,setForm] = useState({ goals_addressed:[] as string[], interventions:[] as string[], client_participation:'full', session_notes:'', caregiver_education:'', recommendations:'', fee:session.fee?.toString()||'150', insurance_claimed:'', patient_paid:'' });
  const [saving,setSaving] = useState(false);
  const f = (k:string,v:string) => setForm(p=>({...p,[k]:v}));
  async function submit() {
    setSaving(true);
    try { await fetch(`/api/admin/occupational-therapy/sessions/${session.id}/complete`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,fee:parseFloat(form.fee)||null,insurance_claimed:form.insurance_claimed?parseFloat(form.insurance_claimed):null,patient_paid:form.patient_paid?parseFloat(form.patient_paid):null})}); onSaved(); } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-1 text-slate-800">Complete OT Session</h2>
        <p className="text-sm text-gray-500 mb-4">{session.first_name} {session.last_name} · {fmtDate(session.session_date)} · {session.session_setting}</p>
        <div className="space-y-3">
          <div><label className="text-xs text-gray-500">Goals Addressed (comma-separated)</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" onChange={e=>setForm(p=>({...p,goals_addressed:e.target.value.split(',').map(s=>s.trim()).filter(Boolean)}))} /></div>
          <div><label className="text-xs text-gray-500">Interventions Used</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" placeholder="e.g. Task analysis, adaptive equipment training, COPM" onChange={e=>setForm(p=>({...p,interventions:e.target.value.split(',').map(s=>s.trim()).filter(Boolean)}))} /></div>
          <div><label className="text-xs text-gray-500">Client Participation</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.client_participation} onChange={e=>f('client_participation',e.target.value)}>{['full','partial','minimal','refused'].map(p=><option key={p}>{p}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Session Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={3} value={form.session_notes} onChange={e=>f('session_notes',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Caregiver Education</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.caregiver_education} onChange={e=>f('caregiver_education',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Recommendations</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.recommendations} onChange={e=>f('recommendations',e.target.value)} /></div>
          <div className="grid grid-cols-3 gap-2 border-t pt-3">
            <div><label className="text-xs text-gray-500">Fee ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.fee} onChange={e=>f('fee',e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Insurance Claimed ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.insurance_claimed} onChange={e=>f('insurance_claimed',e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Patient Paid ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.patient_paid} onChange={e=>f('patient_paid',e.target.value)} /></div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">{saving?'Saving…':'Complete Session'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Modification Modal ───────────────────────────────────────────────────
function AddModificationModal({ clients, onClose, onSaved }:{ clients:OTClient[]; onClose:()=>void; onSaved:()=>void }) {
  const [form,setForm] = useState({ client_id:'', ot:OTS[0], room:'bathroom', modification_type:'', risk_level:'high', recommended_equipment:'', estimated_cost:'', funded_by:'', installation_required:false, notes:'' });
  const [saving,setSaving] = useState(false);
  const f = (k:string,v:string|boolean) => setForm(p=>({...p,[k]:v}));
  async function submit() {
    if(!form.client_id||!form.modification_type)return;
    setSaving(true);
    try { await fetch('/api/admin/occupational-therapy/home-modifications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,client_id:parseInt(form.client_id),estimated_cost:form.estimated_cost?parseFloat(form.estimated_cost):null})}); onSaved(); } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-4 text-slate-800">Add Home Modification</h2>
        <div className="space-y-3">
          <div><label className="text-xs text-gray-500">Client *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.client_id} onChange={e=>f('client_id',e.target.value)}><option value="">Select…</option>{clients.map(c=><option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs text-gray-500">Room</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.room} onChange={e=>f('room',e.target.value)}>{ROOMS.map(r=><option key={r}>{r.replace(/_/g,' ')}</option>)}</select></div>
            <div><label className="text-xs text-gray-500">Risk Level</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.risk_level} onChange={e=>f('risk_level',e.target.value)}>{RISK_LEVELS.map(r=><option key={r}>{r}</option>)}</select></div>
          </div>
          <div><label className="text-xs text-gray-500">Modification Type *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.modification_type} onChange={e=>f('modification_type',e.target.value)} placeholder="e.g. Install grab bars at toilet" /></div>
          <div><label className="text-xs text-gray-500">Recommended Equipment</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.recommended_equipment} onChange={e=>f('recommended_equipment',e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs text-gray-500">Estimated Cost (CAD $)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.estimated_cost} onChange={e=>f('estimated_cost',e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Funded By</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.funded_by} onChange={e=>f('funded_by',e.target.value)} placeholder="AISH, AHS, Private" /></div>
          </div>
          <div><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.notes} onChange={e=>f('notes',e.target.value)} /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.installation_required} onChange={e=>f('installation_required',e.target.checked)} />Professional installation required</label>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{saving?'Saving…':'Add Modification'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function OccupationalTherapyPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [dashboard, setDashboard] = useState<DashData|null>(null);
  const [clients, setClients] = useState<OTClient[]>([]);
  const [sessions, setSessions] = useState<OTSession[]>([]);
  const [goals, setGoals] = useState<OTGoal[]>([]);
  const [modifications, setModifications] = useState<HomeModification[]>([]);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterSetting, setFilterSetting] = useState('');
  const [filterOt, setFilterOt] = useState('');
  const [showAddClient, setShowAddClient] = useState(false);
  const [showCompleteSession, setShowCompleteSession] = useState<OTSession|null>(null);
  const [showAddMod, setShowAddMod] = useState(false);
  const [aiTool, setAiTool] = useState<'plan'|'assessment'>('plan');
  const [aiPlan, setAiPlan] = useState({ age:'', diagnosis:[] as string[], areas_of_focus:[] as string[], goals:[] as string[], session_setting:'clinic', duration:'60' });
  const [planOutput, setPlanOutput] = useState('');
  const [planLoading, setPlanLoading] = useState(false);
  const [aiAssessment, setAiAssessment] = useState({ client_name:'', age:'', diagnosis:[] as string[], setting_type:'single family home', areas:ROOMS });
  const [assessmentOutput, setAssessmentOutput] = useState('');
  const [assessmentLoading, setAssessmentLoading] = useState(false);

  const loadDashboard = useCallback(async()=>{ const r=await fetch('/api/admin/occupational-therapy'); setDashboard(await r.json()); },[]);
  const loadClients = useCallback(async()=>{ const r=await fetch('/api/admin/occupational-therapy/clients?status=active'); setClients(await r.json()); },[]);
  const loadSessions = useCallback(async()=>{ const p=new URLSearchParams(); if(filterDate)p.set('date',filterDate); if(filterSetting)p.set('setting',filterSetting); if(filterOt)p.set('ot',filterOt); const r=await fetch('/api/admin/occupational-therapy/sessions?'+p); setSessions(await r.json()); },[filterDate,filterSetting,filterOt]);
  const loadGoals = useCallback(async()=>{ const r=await fetch('/api/admin/occupational-therapy/goals'); setGoals(await r.json()); },[]);
  const loadModifications = useCallback(async()=>{ const r=await fetch('/api/admin/occupational-therapy/home-modifications'); setModifications(await r.json()); },[]);

  useEffect(()=>{ loadDashboard(); },[loadDashboard]);
  useEffect(()=>{ if(tab==='clients')loadClients(); },[tab,loadClients]);
  useEffect(()=>{ if(tab==='sessions')loadSessions(); },[tab,loadSessions]);
  useEffect(()=>{ if(tab==='goals')loadGoals(); },[tab,loadGoals]);
  useEffect(()=>{ if(tab==='home-modifications')loadModifications(); },[tab,loadModifications]);
  useEffect(()=>{ if(tab==='funding')loadClients(); },[tab,loadClients]);

  async function generatePlan() {
    setPlanLoading(true); setPlanOutput('');
    try { const r=await fetch('/api/admin/occupational-therapy/ai-session-plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(aiPlan)}); const d=await r.json(); setPlanOutput(d.plan); } finally { setPlanLoading(false); }
  }
  async function generateAssessment() {
    setAssessmentLoading(true); setAssessmentOutput('');
    try { const r=await fetch('/api/admin/occupational-therapy/ai-home-assessment',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(aiAssessment)}); const d=await r.json(); setAssessmentOutput(d.report); } finally { setAssessmentLoading(false); }
  }
  async function advanceModStatus(mod:HomeModification) {
    const order = MOD_STATUSES;
    const idx = order.indexOf(mod.status);
    if(idx<0||idx>=order.length-2)return;
    const next = order[idx+1];
    await fetch(`/api/admin/occupational-therapy/home-modifications/${mod.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:next})});
    loadModifications();
  }
  async function achieveGoal(id:number) { await fetch(`/api/admin/occupational-therapy/goals/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'achieved'})}); loadGoals(); }
  async function patchSessionStatus(id:number, status:string) { await fetch(`/api/admin/occupational-therapy/sessions/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})}); loadSessions(); }
  const togglePlanArea = (a:string) => setAiPlan(p=>({...p,areas_of_focus:p.areas_of_focus.includes(a)?p.areas_of_focus.filter(x=>x!==a):[...p.areas_of_focus,a]}));
  const toggleAssessRoom = (r:string) => setAiAssessment(p=>({...p,areas:p.areas.includes(r)?p.areas.filter(x=>x!==r):[...p.areas,r]}));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Occupational Therapy Hub</h1>
          <p className="text-sm text-gray-500">Alberta OT client, session, goal & home modification management</p>
        </div>
        <div className="flex gap-2">
          {tab==='clients'&&<button onClick={()=>setShowAddClient(true)} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">+ New Client</button>}
          {tab==='home-modifications'&&<button onClick={()=>setShowAddMod(true)} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">+ Add Modification</button>}
        </div>
      </div>
      <div className="bg-white border-b px-6">
        <div className="flex gap-1 overflow-x-auto">{TABS.map(t=><button key={t} onClick={()=>setTab(t)} className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab===t?'border-blue-600 text-blue-600':'border-transparent text-gray-500 hover:text-gray-700'}`}>{TAB_LABELS[t]}</button>)}</div>
      </div>

      <div className="p-6">
        {/* Dashboard */}
        {tab==='dashboard'&&<div className="space-y-6">
          <div className="grid grid-cols-5 gap-4">
            <KpiCard label="Active Clients" value={dashboard?.active_clients??'—'} color="blue" />
            <KpiCard label="Home Visits Today" value={dashboard?.home_visits_today??'—'} color="green" />
            <KpiCard label="Home Assessments Pending" value={dashboard?.home_assessments_pending??'—'} color="amber" />
            <KpiCard label="WCA Caseload" value={dashboard?.wca_caseload??'—'} color="orange" />
            <KpiCard label="Revenue MTD" value={dashboard?.revenue_mtd!=null?fmtCad(dashboard.revenue_mtd):'—'} color="purple" />
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border p-4">
              <h2 className="font-semibold text-slate-700 mb-3">Today's Schedule</h2>
              {!dashboard?.today_schedule?.length&&<p className="text-gray-400 text-sm">No sessions today.</p>}
              <div className="space-y-2">
                {dashboard?.today_schedule?.map((s)=>(
                  <div key={s.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg border">
                    <span className="text-xs font-mono w-10">{fmtTime(s.start_time)}</span>
                    <div className={`w-2 h-2 rounded-full ${s.session_setting==='home'?'bg-green-500':s.session_setting==='school'?'bg-orange-500':'bg-blue-500'}`} />
                    <span className="text-sm font-medium flex-1">{s.first_name} {s.last_name}</span>
                    <Badge label={s.session_setting} color={settingColor(s.session_setting)} />
                    {s.home_assessment_required&&<Badge label="Home Assess" color="amber" />}
                    {s.wca_claim&&<Badge label="WCA" color="orange" />}
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <h2 className="font-semibold text-slate-700 mb-3">Modifications Pending</h2>
              {!dashboard?.modifications_pending?.length&&<p className="text-gray-400 text-sm">No pending modifications.</p>}
              <div className="space-y-2">
                {dashboard?.modifications_pending?.map((m)=>(
                  <div key={m.id} className={`p-2 rounded-lg border-l-4 ${m.risk_level==='immediate'?'border-red-500 bg-red-50':m.risk_level==='high'?'border-orange-500 bg-orange-50':'border-amber-500 bg-amber-50'}`}>
                    <p className="text-sm font-medium">{m.first_name} {m.last_name}</p>
                    <p className="text-xs text-gray-600">{m.modification_type} — {m.room}</p>
                    <div className="flex gap-1 mt-1">
                      <Badge label={m.risk_level} color={riskColor(m.risk_level)} />
                      <Badge label={m.status} color={statusColor(m.status)} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>}

        {/* Clients */}
        {tab==='clients'&&<div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b"><tr>{['Name','Age','Diagnosis','Focus Areas','OT','Setting','Funding','Flags','Status'].map(h=><th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr></thead>
            <tbody>
              {clients.map(c=>(
                <tr key={c.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{c.first_name} {c.last_name}</td>
                  <td className="px-4 py-3 text-gray-600">{clientAge(c.date_of_birth)}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-[140px] truncate">{(c.diagnosis||[]).join(', ')||'—'}</td>
                  <td className="px-4 py-3"><div className="flex flex-wrap gap-0.5">{(c.areas_of_focus||[]).slice(0,2).map(a=><Badge key={a} label={a} color="blue" />)}{(c.areas_of_focus||[]).length>2&&<span className="text-xs text-gray-400">+{c.areas_of_focus.length-2}</span>}</div></td>
                  <td className="px-4 py-3 text-xs text-gray-600">{c.ot||'—'}</td>
                  <td className="px-4 py-3"><Badge label={c.setting} color={settingColor(c.setting)} /></td>
                  <td className="px-4 py-3"><Badge label={c.funding_source||'private'} color={fundingColor(c.funding_source)} /></td>
                  <td className="px-4 py-3 flex gap-1 flex-wrap">
                    {c.home_assessment_required&&<Badge label="Home Assess" color="amber" />}
                    {c.wca_claim&&<Badge label="WCA" color="orange" />}
                    {c.aish_file_number&&<Badge label="AISH" color="blue" />}
                    {c.pending_modifications>0&&<Badge label={`${c.pending_modifications} mods`} color="purple" />}
                  </td>
                  <td className="px-4 py-3"><Badge label={c.status} color={statusColor(c.status)} /></td>
                </tr>
              ))}
              {!clients.length&&<tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No active clients.</td></tr>}
            </tbody>
          </table>
        </div>}

        {/* Sessions */}
        {tab==='sessions'&&<div className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <input type="date" className="border rounded-lg px-3 py-2 text-sm" value={filterDate} onChange={e=>{setFilterDate(e.target.value);setTimeout(loadSessions,100);}} />
            <select className="border rounded-lg px-3 py-2 text-sm" value={filterSetting} onChange={e=>{setFilterSetting(e.target.value);setTimeout(loadSessions,100);}}>
              <option value="">All settings</option>{SETTINGS.map(s=><option key={s}>{s}</option>)}
            </select>
            <select className="border rounded-lg px-3 py-2 text-sm" value={filterOt} onChange={e=>{setFilterOt(e.target.value);setTimeout(loadSessions,100);}}>
              <option value="">All OTs</option>{OTS.map(o=><option key={o}>{o}</option>)}
            </select>
          </div>
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b"><tr>{['Time','Client','Type','Setting','OT','Funding','Participation','Status','Action'].map(h=><th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr></thead>
              <tbody>
                {sessions.map(s=>(
                  <tr key={s.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-sm font-medium">{fmtTime(s.start_time)}</td>
                    <td className="px-4 py-3 font-medium">{s.first_name} {s.last_name}</td>
                    <td className="px-4 py-3"><Badge label={s.session_type} color="blue" /></td>
                    <td className="px-4 py-3"><Badge label={s.session_setting||'clinic'} color={settingColor(s.session_setting||'clinic')} /></td>
                    <td className="px-4 py-3 text-xs text-gray-600">{s.ot}</td>
                    <td className="px-4 py-3">{s.wca_claim?<Badge label="WCA" color="orange" />:<Badge label={s.funding_source||'private'} color={fundingColor(s.funding_source)} />}</td>
                    <td className="px-4 py-3">{s.client_participation?<Badge label={s.client_participation} color={s.client_participation==='full'?'green':s.client_participation==='refused'?'red':'amber'} />:<span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3"><Badge label={s.status} color={statusColor(s.status)} /></td>
                    <td className="px-4 py-3">
                      {s.status==='scheduled'&&<div className="flex gap-1">
                        <button onClick={()=>setShowCompleteSession(s)} className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded border border-green-200 hover:bg-green-100">Complete</button>
                        <button onClick={()=>patchSessionStatus(s.id,'no_show')} className="px-2 py-1 text-xs bg-gray-50 text-gray-600 rounded border hover:bg-gray-100">No Show</button>
                        <button onClick={()=>patchSessionStatus(s.id,'cancelled')} className="px-2 py-1 text-xs bg-red-50 text-red-700 rounded border border-red-200 hover:bg-red-100">Cancel</button>
                      </div>}
                    </td>
                  </tr>
                ))}
                {!sessions.length&&<tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No sessions for selected filter.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>}

        {/* Goals */}
        {tab==='goals'&&<div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {goals.map(g=>(
              <div key={g.id} className={`bg-white rounded-xl border p-4 space-y-2 ${g.status==='achieved'?'border-green-300':''}`}>
                <div className="flex justify-between items-start">
                  <div className="flex gap-1">
                    <Badge label={g.occupational_area} color="blue" />
                    <Badge label={g.status} color={statusColor(g.status)} />
                  </div>
                  <span className="text-xs text-gray-400">{g.first_name} {g.last_name}</span>
                </div>
                <p className="text-sm text-slate-800">{g.goal_description}</p>
                <div className="flex gap-4 text-xs text-gray-500">
                  {g.baseline&&<span>Baseline: <span className="font-medium text-gray-700">{g.baseline}</span></span>}
                  {g.target&&<span>Target: <span className="font-medium text-gray-700">{g.target}</span></span>}
                  {g.measurement_method&&<span>Measure: {g.measurement_method}</span>}
                  {g.achieved_date&&<span className="text-green-600 font-medium">Achieved: {fmtDate(g.achieved_date)}</span>}
                </div>
                {g.progress&&<p className="text-xs text-gray-600 italic">{g.progress}</p>}
                {g.status==='active'&&<button onClick={()=>achieveGoal(g.id)} className="px-3 py-1 text-xs bg-green-50 text-green-700 rounded border border-green-200 hover:bg-green-100">Mark Achieved</button>}
              </div>
            ))}
            {!goals.length&&<p className="text-gray-400 text-sm col-span-2">No goals found.</p>}
          </div>
        </div>}

        {/* Home Modifications */}
        {tab==='home-modifications'&&<div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {modifications.map(m=>(
              <div key={m.id} className={`bg-white rounded-xl border-l-4 p-4 space-y-2 ${m.risk_level==='immediate'?'border-red-500':m.risk_level==='high'?'border-orange-500':m.risk_level==='medium'?'border-amber-500':'border-gray-300'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-slate-800">{m.first_name} {m.last_name}</p>
                    <p className="text-xs text-gray-500 capitalize">{m.room?.replace(/_/g,' ')} · {fmtDate(m.assessment_date)}</p>
                  </div>
                  <div className="flex gap-1 flex-col items-end">
                    <Badge label={m.risk_level} color={riskColor(m.risk_level)} />
                    <Badge label={m.status} color={statusColor(m.status)} />
                  </div>
                </div>
                <p className="text-sm font-medium text-slate-700">{m.modification_type}</p>
                {m.recommended_equipment&&<p className="text-xs text-gray-600">Equipment: {m.recommended_equipment}</p>}
                <div className="flex gap-4 text-xs text-gray-500">
                  {m.estimated_cost&&<span>Est. Cost: <span className="font-medium text-gray-800">{fmtCad(m.estimated_cost)}</span></span>}
                  {m.funded_by&&<span>Funded by: <span className="font-medium text-gray-800">{m.funded_by}</span></span>}
                  {m.installation_required&&<span className="text-amber-600 font-medium">Professional install required</span>}
                </div>
                {m.notes&&<p className="text-xs text-gray-600 italic">{m.notes}</p>}
                {/* Status pipeline */}
                <div className="flex items-center gap-1 text-xs text-gray-400 flex-wrap">
                  {MOD_STATUSES.slice(0,-1).map((s,i)=>(
                    <span key={s} className={`flex items-center gap-1 ${s===m.status?'text-blue-600 font-semibold':MOD_STATUSES.indexOf(m.status)>i?'text-green-600':''}`}>
                      {i>0&&<span className="text-gray-300">→</span>}
                      {s}
                    </span>
                  ))}
                </div>
                {!['installed','declined'].includes(m.status)&&<button onClick={()=>advanceModStatus(m)} className="px-3 py-1 text-xs bg-blue-50 text-blue-700 rounded border border-blue-200 hover:bg-blue-100">Advance → {MOD_STATUSES[MOD_STATUSES.indexOf(m.status)+1]||'installed'}</button>}
              </div>
            ))}
            {!modifications.length&&<p className="text-gray-400 text-sm col-span-2">No home modifications found.</p>}
          </div>
        </div>}

        {/* AI Tools */}
        {tab==='ai-tools'&&<div className="max-w-2xl space-y-4">
          <div className="flex gap-2 mb-4">
            <button onClick={()=>setAiTool('plan')} className={`px-4 py-2 text-sm rounded-lg ${aiTool==='plan'?'bg-blue-600 text-white':'border text-gray-600 hover:bg-gray-50'}`}>Session Plan Generator</button>
            <button onClick={()=>setAiTool('assessment')} className={`px-4 py-2 text-sm rounded-lg ${aiTool==='assessment'?'bg-blue-600 text-white':'border text-gray-600 hover:bg-gray-50'}`}>Home Assessment Report</button>
          </div>
          {aiTool==='plan'&&<div className="bg-white rounded-xl border p-5 space-y-4">
            <h2 className="font-semibold text-slate-800">AI OT Session Plan Generator</h2>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-gray-500">Client Age (years)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiPlan.age} onChange={e=>setAiPlan(p=>({...p,age:e.target.value}))} /></div>
              <div><label className="text-xs text-gray-500">Duration (min)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiPlan.duration} onChange={e=>setAiPlan(p=>({...p,duration:e.target.value}))} /></div>
              <div><label className="text-xs text-gray-500">Setting</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiPlan.session_setting} onChange={e=>setAiPlan(p=>({...p,session_setting:e.target.value}))}>{SETTINGS.map(s=><option key={s}>{s}</option>)}</select></div>
              <div className="col-span-2"><label className="text-xs text-gray-500">Diagnoses (comma-separated)</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" onChange={e=>setAiPlan(p=>({...p,diagnosis:e.target.value.split(',').map(s=>s.trim()).filter(Boolean)}))} /></div>
              <div className="col-span-2">
                <label className="text-xs text-gray-500">Focus Areas</label>
                <div className="flex flex-wrap gap-1.5 mt-1">{OT_AREAS.map(a=><button key={a} type="button" onClick={()=>togglePlanArea(a)} className={`px-2 py-0.5 rounded text-xs border ${aiPlan.areas_of_focus.includes(a)?'bg-blue-600 text-white border-blue-600':'border-gray-300 text-gray-600'}`}>{a.replace(/_/g,' ')}</button>)}</div>
              </div>
            </div>
            <button onClick={generatePlan} disabled={planLoading} className="w-full py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">{planLoading?'Generating…':'Generate OT Session Plan'}</button>
            {planOutput&&<div className="bg-gray-50 rounded-lg p-4 border"><pre className="text-sm whitespace-pre-wrap font-mono text-slate-700">{planOutput}</pre></div>}
          </div>}
          {aiTool==='assessment'&&<div className="bg-white rounded-xl border p-5 space-y-4">
            <h2 className="font-semibold text-slate-800">AI Home Assessment Report</h2>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-gray-500">Client Name</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiAssessment.client_name} onChange={e=>setAiAssessment(p=>({...p,client_name:e.target.value}))} /></div>
              <div><label className="text-xs text-gray-500">Age</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiAssessment.age} onChange={e=>setAiAssessment(p=>({...p,age:e.target.value}))} /></div>
              <div className="col-span-2"><label className="text-xs text-gray-500">Diagnoses (comma-separated)</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" onChange={e=>setAiAssessment(p=>({...p,diagnosis:e.target.value.split(',').map(s=>s.trim()).filter(Boolean)}))} /></div>
              <div><label className="text-xs text-gray-500">Home Setting</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiAssessment.setting_type} onChange={e=>setAiAssessment(p=>({...p,setting_type:e.target.value}))} placeholder="e.g. condo, single-family home" /></div>
              <div className="col-span-2">
                <label className="text-xs text-gray-500">Areas to Assess</label>
                <div className="flex flex-wrap gap-1.5 mt-1">{ROOMS.map(r=><button key={r} type="button" onClick={()=>toggleAssessRoom(r)} className={`px-2 py-0.5 rounded text-xs border ${aiAssessment.areas.includes(r)?'bg-blue-600 text-white border-blue-600':'border-gray-300 text-gray-600'}`}>{r.replace(/_/g,' ')}</button>)}</div>
              </div>
            </div>
            <button onClick={generateAssessment} disabled={assessmentLoading} className="w-full py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">{assessmentLoading?'Generating…':'Generate Home Assessment Report'}</button>
            {assessmentOutput&&<div className="bg-gray-50 rounded-lg p-4 border"><pre className="text-sm whitespace-pre-wrap font-mono text-slate-700">{assessmentOutput}</pre></div>}
          </div>}
        </div>}

        {/* Funding Tracker */}
        {tab==='funding'&&<div className="space-y-4">
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b"><tr>{['Client','Funding Source','WCA Claim','AISH File','Extended Health','Sessions','Goals','Status'].map(h=><th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr></thead>
              <tbody>
                {clients.map(c=>(
                  <tr key={c.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{c.first_name} {c.last_name}</td>
                    <td className="px-4 py-3"><Badge label={c.funding_source||'private'} color={fundingColor(c.funding_source)} /></td>
                    <td className="px-4 py-3 font-mono text-xs text-orange-700">{c.wca_claim||'—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-blue-700">{c.aish_file_number||'—'}</td>
                    <td className="px-4 py-3 text-xs text-purple-700">{c.extended_health_provider||'—'}</td>
                    <td className="px-4 py-3 text-center font-medium text-gray-700">{c.session_count}</td>
                    <td className="px-4 py-3 text-xs"><span className="text-green-700 font-medium">{c.achieved_goals} achieved</span> · <span className="text-blue-700">{c.active_goals} active</span></td>
                    <td className="px-4 py-3"><Badge label={c.status} color={statusColor(c.status)} /></td>
                  </tr>
                ))}
                {!clients.length&&<tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No clients found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>}
      </div>

      {showAddClient&&<AddClientModal onClose={()=>setShowAddClient(false)} onSaved={()=>{setShowAddClient(false);loadClients();loadDashboard();}} />}
      {showCompleteSession&&<CompleteSessionModal session={showCompleteSession} onClose={()=>setShowCompleteSession(null)} onSaved={()=>{setShowCompleteSession(null);loadSessions();loadDashboard();}} />}
      {showAddMod&&<AddModificationModal clients={clients} onClose={()=>setShowAddMod(false)} onSaved={()=>{setShowAddMod(false);loadModifications();}} />}
    </div>
  );
}
