'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard','clients','sessions','goals','assessments','ai-tools','waitlist'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab,string> = { dashboard:'Dashboard', clients:'Clients', sessions:'Sessions', goals:'Goals', assessments:'Assessments', 'ai-tools':'AI Tools', waitlist:'Waitlist' };

const SLPS = ['Dr. Emily Chen SLP','Ms. Sarah Kumar R.SLP','Mr. David Park M.Sc.(S-LP)'];
const AREAS_OF_FOCUS = ['articulation','phonology','language','fluency','voice','AAC','pragmatics','literacy','feeding_swallowing','social_communication'];
const ASSESSMENT_TOOLS = ['GFTA-3','CELF-5','PLS-5','EVT-3','PPVT-5','Goldman-Fristoe 3','CAST','TAPS-4','OWLS-II','CASL-2'];
const SESSION_TYPES_CLIENT = ['individual','group','parent_coaching','school_consultation','telepractice'];
const SESSION_TYPES_SESSION = ['individual','group','parent_coaching','consultation','assessment','discharge'];
const FUNDING_SOURCES = ['private_pay','extended_health','aish','cbs','school_division','other'];
const PERFORMANCE_LEVELS = ['excellent','good','moderate','minimal','refused'];
const REFERRAL_SOURCES = ['physician','school','self','aish','cbs','other'];

interface STClient { id:number; first_name:string; last_name:string; date_of_birth:string; primary_diagnosis:string; areas_of_focus:string[]; session_type:string; slp:string; status:string; referral_source:string; aish_funded:boolean; cbs_funded:boolean; extended_health_provider:string; session_count:number; active_goals:number; mastered_goals:number; parent_phone:string; frequency:string; created_at:string; parent_name?:string; }
interface STSession { id:number; client_id:number; first_name:string; last_name:string; slp:string; session_date:string; start_time:string; end_time:string; session_type:string; status:string; primary_diagnosis:string; areas_of_focus:string[]; aish_funded:boolean; cbs_funded:boolean; fee:number; funding_source:string; client_performance:string; }
interface STGoal { id:number; client_id:number; first_name:string; last_name:string; goal_area:string; goal_description:string; baseline:string; target_accuracy:string; status:string; mastered_date:string; progress_notes:string; created_at:string; }
interface STAssessment { id:number; client_id:number; first_name:string; last_name:string; assessment_date:string; assessment_tools:string[]; areas_assessed:string[]; clinical_impressions:string; recommendations:string; report_completed:boolean; slp:string; }
interface DashData { active_clients:number; waitlist_count:number; sessions_today:number; goals_mastered_mtd:number; revenue_mtd:number; today_sessions:STSession[]; }

function fmtCad(n:number) { return `$${Number(n??0).toLocaleString('en-CA',{minimumFractionDigits:0})}` }
function fmtDate(d:string) { return d?new Date(d).toLocaleDateString('en-CA'):'—' }
function fmtTime(t:string) { return t?t.slice(0,5):'—' }
function clientAge(dob:string) { if(!dob)return '?'; const b=new Date(dob); const a=new Date(); return `${Math.floor((a.getTime()-b.getTime())/31557600000)} yrs`; }

function Badge({ label, color='gray' }:{ label:string; color?:string }) {
  const m:Record<string,string> = { blue:'bg-blue-100 text-blue-700', green:'bg-green-100 text-green-700', amber:'bg-amber-100 text-amber-700', red:'bg-red-100 text-red-700', purple:'bg-purple-100 text-purple-700', gray:'bg-gray-100 text-gray-700', teal:'bg-teal-100 text-teal-700', orange:'bg-orange-100 text-orange-700', rose:'bg-rose-100 text-rose-700' };
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${m[color]??m.gray}`}>{label.replace(/_/g,' ')}</span>;
}
function KpiCard({ label, value, sub, color='blue' }:{ label:string; value:string|number; sub?:string; color?:string }) {
  const b:Record<string,string> = { blue:'border-l-4 border-blue-500 bg-blue-50', green:'border-l-4 border-green-500 bg-green-50', amber:'border-l-4 border-amber-500 bg-amber-50', red:'border-l-4 border-red-500 bg-red-50', purple:'border-l-4 border-purple-500 bg-purple-50' };
  return <div className={`rounded-lg p-4 ${b[color]??b.blue}`}><p className="text-sm text-gray-500">{label}</p><p className="text-2xl font-bold mt-1">{value}</p>{sub&&<p className="text-xs text-gray-400 mt-1">{sub}</p>}</div>;
}
function statusColor(s:string) { const m:Record<string,string>={scheduled:'blue',completed:'green',client_absent:'amber',clinician_absent:'gray',cancelled:'red',active:'green',waitlist:'amber',discharged:'purple',on_hold:'gray',mastered:'green',modified:'amber',discontinued:'red'}; return m[s]??'gray'; }
function fundingColor(s:string) { const m:Record<string,string>={private_pay:'gray',extended_health:'purple',aish:'blue',cbs:'teal',school_division:'green',other:'gray'}; return m[s]??'gray'; }
function areaColor(a:string) { const m:Record<string,string>={articulation:'blue',phonology:'purple',language:'green',fluency:'amber',voice:'teal',AAC:'red',pragmatics:'orange',literacy:'indigo',feeding_swallowing:'rose',social_communication:'violet'}; return m[a]??'gray'; }

// ─── Add Client Modal ─────────────────────────────────────────────────────────
function AddClientModal({ onClose, onSaved }:{ onClose:()=>void; onSaved:()=>void }) {
  const [form,setForm] = useState({ first_name:'', last_name:'', date_of_birth:'', parent_name:'', parent_phone:'', parent_email:'', phone:'', referral_source:'physician', primary_diagnosis:'', areas_of_focus:[] as string[], session_type:'individual', frequency:'weekly', slp:SLPS[0], aish_funded:false, cbs_funded:false, extended_health_provider:'', status:'active', notes:'' });
  const [saving,setSaving] = useState(false);
  const f = (k:string,v:string|boolean) => setForm(p=>({...p,[k]:v}));
  const toggleArea = (a:string) => setForm(p=>({...p,areas_of_focus:p.areas_of_focus.includes(a)?p.areas_of_focus.filter(x=>x!==a):[...p.areas_of_focus,a]}));
  async function submit() {
    if(!form.first_name||!form.last_name||!form.date_of_birth||!form.parent_phone)return;
    setSaving(true);
    try { await fetch('/api/admin/speech-therapy/clients',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)}); onSaved(); } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-4 text-slate-800">New SLP Client</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500">First Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.first_name} onChange={e=>f('first_name',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Last Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.last_name} onChange={e=>f('last_name',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Date of Birth *</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.date_of_birth} onChange={e=>f('date_of_birth',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Referral Source</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.referral_source} onChange={e=>f('referral_source',e.target.value)}>{REFERRAL_SOURCES.map(r=><option key={r} value={r}>{r.replace(/_/g,' ')}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Parent/Guardian Name</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.parent_name} onChange={e=>f('parent_name',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Parent Phone *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.parent_phone} onChange={e=>f('parent_phone',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Parent Email</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.parent_email} onChange={e=>f('parent_email',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Client Phone</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.phone} onChange={e=>f('phone',e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Primary Diagnosis</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.primary_diagnosis} onChange={e=>f('primary_diagnosis',e.target.value)} placeholder="e.g. Childhood apraxia of speech, language delay" /></div>
          <div className="col-span-2">
            <label className="text-xs text-gray-500">Areas of Focus</label>
            <div className="flex flex-wrap gap-1.5 mt-1">{AREAS_OF_FOCUS.map(a=><button key={a} type="button" onClick={()=>toggleArea(a)} className={`px-2 py-0.5 rounded text-xs border ${form.areas_of_focus.includes(a)?'bg-blue-600 text-white border-blue-600':'border-gray-300 text-gray-600'}`}>{a.replace(/_/g,' ')}</button>)}</div>
          </div>
          <div><label className="text-xs text-gray-500">Session Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.session_type} onChange={e=>f('session_type',e.target.value)}>{SESSION_TYPES_CLIENT.map(t=><option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Frequency</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.frequency} onChange={e=>f('frequency',e.target.value)}>{['weekly','bi-weekly','monthly','intensive'].map(f=><option key={f}>{f}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Assigned SLP</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.slp} onChange={e=>f('slp',e.target.value)}>{SLPS.map(s=><option key={s}>{s}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Status</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.status} onChange={e=>f('status',e.target.value)}>{['active','waitlist','on_hold'].map(s=><option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Extended Health Provider</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.extended_health_provider} onChange={e=>f('extended_health_provider',e.target.value)} /></div>
          <div className="flex flex-col gap-1 justify-center">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.aish_funded} onChange={e=>f('aish_funded',e.target.checked)} />AISH Funded</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.cbs_funded} onChange={e=>f('cbs_funded',e.target.checked)} />CBS Funded</label>
          </div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.notes} onChange={e=>f('notes',e.target.value)} /></div>
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
function CompleteSessionModal({ session, onClose, onSaved }:{ session:STSession; onClose:()=>void; onSaved:()=>void }) {
  const [form,setForm] = useState({ goals_addressed:[] as string[], activities_used:[] as string[], client_performance:'good', parent_communication_provided:false, session_notes:'', homework_assigned:'', fee:session.fee?.toString()||'120', funding_source:session.funding_source||'private_pay', insurance_claimed:'', patient_paid:'' });
  const [saving,setSaving] = useState(false);
  const f = (k:string,v:string|boolean) => setForm(p=>({...p,[k]:v}));
  async function submit() {
    setSaving(true);
    try { await fetch(`/api/admin/speech-therapy/sessions/${session.id}/complete`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,fee:parseFloat(form.fee)||null,insurance_claimed:form.insurance_claimed?parseFloat(form.insurance_claimed):null,patient_paid:form.patient_paid?parseFloat(form.patient_paid):null})}); onSaved(); } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-1 text-slate-800">Complete Session</h2>
        <p className="text-sm text-gray-500 mb-4">{session.first_name} {session.last_name} · {fmtDate(session.session_date)} {fmtTime(session.start_time)}</p>
        <div className="space-y-3">
          <div><label className="text-xs text-gray-500">Goals Addressed (comma-separated)</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" placeholder="Goal 1, Goal 2…" onChange={e=>setForm(p=>({...p,goals_addressed:e.target.value.split(',').map(s=>s.trim()).filter(Boolean)}))} /></div>
          <div><label className="text-xs text-gray-500">Activities Used</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" placeholder="e.g. Flashcards, narrative retell, play-based articulation" onChange={e=>setForm(p=>({...p,activities_used:e.target.value.split(',').map(s=>s.trim()).filter(Boolean)}))} /></div>
          <div><label className="text-xs text-gray-500">Client Performance</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.client_performance} onChange={e=>f('client_performance',e.target.value)}>{PERFORMANCE_LEVELS.map(p=><option key={p}>{p}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Session Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={3} value={form.session_notes} onChange={e=>f('session_notes',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Homework Assigned</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.homework_assigned} onChange={e=>f('homework_assigned',e.target.value)} /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.parent_communication_provided} onChange={e=>f('parent_communication_provided',e.target.checked)} />Parent communication provided</label>
          <div className="grid grid-cols-3 gap-2 border-t pt-3">
            <div><label className="text-xs text-gray-500">Fee ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.fee} onChange={e=>f('fee',e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Funding</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.funding_source} onChange={e=>f('funding_source',e.target.value)}>{FUNDING_SOURCES.map(s=><option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}</select></div>
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

// ─── Add Goal Modal ───────────────────────────────────────────────────────────
function AddGoalModal({ clients, onClose, onSaved }:{ clients:STClient[]; onClose:()=>void; onSaved:()=>void }) {
  const [form,setForm] = useState({ client_id:'', slp:SLPS[0], goal_area:'articulation', goal_description:'', baseline:'', target_accuracy:'80%', target_date:'' });
  const [saving,setSaving] = useState(false);
  const f = (k:string,v:string) => setForm(p=>({...p,[k]:v}));
  async function submit() {
    if(!form.client_id||!form.goal_description)return;
    setSaving(true);
    try { await fetch('/api/admin/speech-therapy/goals',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,client_id:parseInt(form.client_id)})}); onSaved(); } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold mb-4 text-slate-800">Add Goal</h2>
        <div className="space-y-3">
          <div><label className="text-xs text-gray-500">Client *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.client_id} onChange={e=>f('client_id',e.target.value)}><option value="">Select…</option>{clients.map(c=><option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Goal Area</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.goal_area} onChange={e=>f('goal_area',e.target.value)}>{AREAS_OF_FOCUS.map(a=><option key={a} value={a}>{a.replace(/_/g,' ')}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Goal Description *</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={3} value={form.goal_description} onChange={e=>f('goal_description',e.target.value)} placeholder="e.g. Client will produce /s/ in initial position with 80% accuracy in structured activities." /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs text-gray-500">Baseline</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.baseline} onChange={e=>f('baseline',e.target.value)} placeholder="e.g. 20%" /></div>
            <div><label className="text-xs text-gray-500">Target Accuracy</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.target_accuracy} onChange={e=>f('target_accuracy',e.target.value)} /></div>
          </div>
          <div><label className="text-xs text-gray-500">Target Date</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.target_date} onChange={e=>f('target_date',e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{saving?'Saving…':'Add Goal'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function SpeechTherapyPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [dashboard, setDashboard] = useState<DashData|null>(null);
  const [clients, setClients] = useState<STClient[]>([]);
  const [sessions, setSessions] = useState<STSession[]>([]);
  const [goals, setGoals] = useState<STGoal[]>([]);
  const [assessments, setAssessments] = useState<STAssessment[]>([]);
  const [waitlist, setWaitlist] = useState<STClient[]>([]);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterSlp, setFilterSlp] = useState('');
  const [showAddClient, setShowAddClient] = useState(false);
  const [showCompleteSession, setShowCompleteSession] = useState<STSession|null>(null);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [aiPlan, setAiPlan] = useState({ primary_diagnosis:'', areas_of_focus:[] as string[], goals:[] as string[], session_type:'individual', duration:'45', age:'7' });
  const [planOutput, setPlanOutput] = useState('');
  const [planLoading, setPlanLoading] = useState(false);
  const [aiReport, setAiReport] = useState({ client_name:'', age:'', primary_diagnosis:'', slp:SLPS[0], period:'', sessions_count:'', goals:[] as string[], progress_notes:'' });
  const [reportOutput, setReportOutput] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [aiTool, setAiTool] = useState<'plan'|'report'>('plan');

  const loadDashboard = useCallback(async()=>{ const r=await fetch('/api/admin/speech-therapy'); setDashboard(await r.json()); },[]);
  const loadClients = useCallback(async()=>{ const r=await fetch('/api/admin/speech-therapy/clients?status=active'); setClients(await r.json()); },[]);
  const loadSessions = useCallback(async()=>{ const p=new URLSearchParams(); if(filterDate)p.set('date',filterDate); if(filterSlp)p.set('slp',filterSlp); const r=await fetch('/api/admin/speech-therapy/sessions?'+p); setSessions(await r.json()); },[filterDate,filterSlp]);
  const loadGoals = useCallback(async()=>{ const r=await fetch('/api/admin/speech-therapy/goals'); setGoals(await r.json()); },[]);
  const loadAssessments = useCallback(async()=>{ const r=await fetch('/api/admin/speech-therapy/assessments'); setAssessments(await r.json()); },[]);
  const loadWaitlist = useCallback(async()=>{ const r=await fetch('/api/admin/speech-therapy/waitlist'); setWaitlist(await r.json()); },[]);

  useEffect(()=>{ loadDashboard(); },[loadDashboard]);
  useEffect(()=>{ if(tab==='clients')loadClients(); },[tab,loadClients]);
  useEffect(()=>{ if(tab==='sessions')loadSessions(); },[tab,loadSessions]);
  useEffect(()=>{ if(tab==='goals')loadGoals(); },[tab,loadGoals]);
  useEffect(()=>{ if(tab==='assessments')loadAssessments(); },[tab,loadAssessments]);
  useEffect(()=>{ if(tab==='waitlist')loadWaitlist(); },[tab,loadWaitlist]);

  async function generatePlan() {
    setPlanLoading(true); setPlanOutput('');
    try { const r=await fetch('/api/admin/speech-therapy/ai-session-plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(aiPlan)}); const d=await r.json(); setPlanOutput(d.plan); } finally { setPlanLoading(false); }
  }
  async function generateReport() {
    setReportLoading(true); setReportOutput('');
    try { const r=await fetch('/api/admin/speech-therapy/ai-progress-report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(aiReport)}); const d=await r.json(); setReportOutput(d.report); } finally { setReportLoading(false); }
  }
  async function markMastered(goalId:number) { await fetch(`/api/admin/speech-therapy/goals/${goalId}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'mastered'})}); loadGoals(); }
  async function patchSessionStatus(id:number, status:string) { await fetch(`/api/admin/speech-therapy/sessions/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})}); loadSessions(); }
  async function moveToActive(clientId:number) { await fetch('/api/admin/speech-therapy/waitlist',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:clientId})}); loadWaitlist(); loadDashboard(); }
  const togglePlanArea = (a:string) => setAiPlan(p=>({...p,areas_of_focus:p.areas_of_focus.includes(a)?p.areas_of_focus.filter(x=>x!==a):[...p.areas_of_focus,a]}));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Speech Therapy & Communication Hub</h1>
          <p className="text-sm text-gray-500">Alberta SLP client, session & goal management</p>
        </div>
        <div className="flex gap-2">
          {tab==='clients'&&<button onClick={()=>setShowAddClient(true)} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">+ New Client</button>}
          {tab==='goals'&&<button onClick={()=>setShowAddGoal(true)} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">+ Add Goal</button>}
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
            <KpiCard label="On Waitlist" value={dashboard?.waitlist_count??'—'} color="amber" />
            <KpiCard label="Sessions Today" value={dashboard?.sessions_today??'—'} color="green" />
            <KpiCard label="Goals Mastered MTD" value={dashboard?.goals_mastered_mtd??'—'} color="purple" />
            <KpiCard label="Revenue MTD" value={dashboard?.revenue_mtd!=null?fmtCad(dashboard.revenue_mtd):'—'} color="green" />
          </div>
          <div className="bg-white rounded-xl border p-4">
            <h2 className="font-semibold text-slate-700 mb-3">Today's Sessions by SLP</h2>
            {!dashboard?.today_sessions?.length&&<p className="text-gray-400 text-sm">No sessions today.</p>}
            {SLPS.map(slpName=>{
              const slpSessions = dashboard?.today_sessions?.filter(s=>s.slp===slpName)||[];
              if(!slpSessions.length)return null;
              return <div key={slpName} className="mb-4">
                <p className="text-xs font-semibold text-gray-500 mb-2">{slpName}</p>
                <div className="space-y-1.5">
                  {slpSessions.map(s=>(
                    <div key={s.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg border">
                      <span className="text-xs font-mono w-10">{fmtTime(s.start_time)}</span>
                      <span className="text-sm font-medium flex-1">{s.first_name} {s.last_name}</span>
                      <span className="text-xs text-gray-500">{s.primary_diagnosis}</span>
                      <Badge label={s.session_type} color="blue" />
                      <Badge label={s.status} color={statusColor(s.status)} />
                    </div>
                  ))}
                </div>
              </div>;
            })}
          </div>
        </div>}

        {/* Clients */}
        {tab==='clients'&&<div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b"><tr>{['Name','Age','Diagnosis','Focus Areas','SLP','Funding','Goals','Status'].map(h=><th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr></thead>
            <tbody>
              {clients.map(c=>(
                <tr key={c.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3"><p className="font-medium">{c.first_name} {c.last_name}</p><p className="text-xs text-gray-400">{c.parent_name&&`Parent: ${c.parent_name}`}</p></td>
                  <td className="px-4 py-3 text-gray-600">{clientAge(c.date_of_birth)}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-[160px] truncate">{c.primary_diagnosis||'—'}</td>
                  <td className="px-4 py-3"><div className="flex flex-wrap gap-0.5">{(c.areas_of_focus||[]).slice(0,3).map(a=><Badge key={a} label={a} color="blue" />)}{(c.areas_of_focus||[]).length>3&&<span className="text-xs text-gray-400">+{c.areas_of_focus.length-3}</span>}</div></td>
                  <td className="px-4 py-3 text-xs text-gray-600">{c.slp||'—'}</td>
                  <td className="px-4 py-3">
                    {c.aish_funded&&<Badge label="AISH" color="blue" />}
                    {c.cbs_funded&&<Badge label="CBS" color="teal" />}
                    {c.extended_health_provider&&<Badge label={c.extended_health_provider} color="purple" />}
                    {!c.aish_funded&&!c.cbs_funded&&!c.extended_health_provider&&<Badge label="Private Pay" color="gray" />}
                  </td>
                  <td className="px-4 py-3 text-xs"><span className="text-green-700 font-medium">{c.mastered_goals} mastered</span> · <span className="text-blue-700">{c.active_goals} active</span></td>
                  <td className="px-4 py-3"><Badge label={c.status} color={statusColor(c.status)} /></td>
                </tr>
              ))}
              {!clients.length&&<tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No active clients.</td></tr>}
            </tbody>
          </table>
        </div>}

        {/* Sessions */}
        {tab==='sessions'&&<div className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <input type="date" className="border rounded-lg px-3 py-2 text-sm" value={filterDate} onChange={e=>{setFilterDate(e.target.value);setTimeout(loadSessions,100);}} />
            <select className="border rounded-lg px-3 py-2 text-sm" value={filterSlp} onChange={e=>{setFilterSlp(e.target.value);setTimeout(loadSessions,100);}}>
              <option value="">All SLPs</option>{SLPS.map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b"><tr>{['Time','Client','Type','SLP','Funding','Performance','Status','Action'].map(h=><th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr></thead>
              <tbody>
                {sessions.map(s=>(
                  <tr key={s.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-sm font-medium">{fmtTime(s.start_time)}</td>
                    <td className="px-4 py-3 font-medium">{s.first_name} {s.last_name}</td>
                    <td className="px-4 py-3"><Badge label={s.session_type} color="blue" /></td>
                    <td className="px-4 py-3 text-xs text-gray-600">{s.slp}</td>
                    <td className="px-4 py-3">{s.aish_funded?<Badge label="AISH" color="blue" />:s.cbs_funded?<Badge label="CBS" color="teal" />:<Badge label={s.funding_source||'private'} color={fundingColor(s.funding_source)} />}</td>
                    <td className="px-4 py-3">{s.client_performance?<Badge label={s.client_performance} color={s.client_performance==='excellent'?'green':s.client_performance==='refused'?'red':'amber'} />:<span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3"><Badge label={s.status} color={statusColor(s.status)} /></td>
                    <td className="px-4 py-3">
                      {s.status==='scheduled'&&<div className="flex gap-1">
                        <button onClick={()=>setShowCompleteSession(s)} className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded border border-green-200 hover:bg-green-100">Complete</button>
                        <button onClick={()=>patchSessionStatus(s.id,'client_absent')} className="px-2 py-1 text-xs bg-amber-50 text-amber-700 rounded border border-amber-200 hover:bg-amber-100">Absent</button>
                        <button onClick={()=>patchSessionStatus(s.id,'cancelled')} className="px-2 py-1 text-xs bg-red-50 text-red-700 rounded border border-red-200 hover:bg-red-100">Cancel</button>
                      </div>}
                    </td>
                  </tr>
                ))}
                {!sessions.length&&<tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No sessions for selected date/filter.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>}

        {/* Goals */}
        {tab==='goals'&&<div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {goals.map(g=>(
              <div key={g.id} className={`bg-white rounded-xl border p-4 space-y-2 ${g.status==='mastered'?'border-green-300':''}`}>
                <div className="flex justify-between items-start">
                  <div className="flex gap-2 items-center">
                    <Badge label={g.goal_area} color="blue" />
                    <Badge label={g.status} color={statusColor(g.status)} />
                  </div>
                  <span className="text-xs text-gray-400">{g.first_name} {g.last_name}</span>
                </div>
                <p className="text-sm text-slate-800">{g.goal_description}</p>
                <div className="flex gap-4 text-xs text-gray-500">
                  {g.baseline&&<span>Baseline: <span className="font-medium text-gray-700">{g.baseline}</span></span>}
                  <span>Target: <span className="font-medium text-gray-700">{g.target_accuracy}</span></span>
                  {g.mastered_date&&<span className="text-green-600 font-medium">Mastered: {fmtDate(g.mastered_date)}</span>}
                </div>
                {g.progress_notes&&<p className="text-xs text-gray-600 italic">{g.progress_notes}</p>}
                {g.status==='active'&&<button onClick={()=>markMastered(g.id)} className="px-3 py-1 text-xs bg-green-50 text-green-700 rounded border border-green-200 hover:bg-green-100">Mark Mastered</button>}
              </div>
            ))}
            {!goals.length&&<p className="text-gray-400 text-sm col-span-2">No goals found.</p>}
          </div>
        </div>}

        {/* Assessments */}
        {tab==='assessments'&&<div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {assessments.map(a=>(
              <div key={a.id} className="bg-white rounded-xl border p-4 space-y-2">
                <div className="flex justify-between">
                  <div>
                    <p className="font-semibold">{a.first_name} {a.last_name}</p>
                    <p className="text-xs text-gray-500">{fmtDate(a.assessment_date)} · {a.slp}</p>
                  </div>
                  {a.report_completed?<Badge label="Report Complete" color="green" />:<Badge label="Report Pending" color="amber" />}
                </div>
                {(a.assessment_tools||[]).length>0&&<div className="flex flex-wrap gap-1">{a.assessment_tools.map(t=><Badge key={t} label={t} color="gray" />)}</div>}
                {a.clinical_impressions&&<p className="text-sm text-gray-700"><span className="font-medium">Impressions:</span> {a.clinical_impressions}</p>}
                {a.recommendations&&<p className="text-sm text-blue-700">{a.recommendations}</p>}
                {!a.report_completed&&<button onClick={async()=>{ await fetch(`/api/admin/speech-therapy/assessments/${a.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({report_completed:true})}); loadAssessments(); }} className="px-3 py-1 text-xs bg-blue-50 text-blue-700 rounded border border-blue-200 hover:bg-blue-100">Mark Report Complete</button>}
              </div>
            ))}
            {!assessments.length&&<p className="text-gray-400 text-sm">No assessments found.</p>}
          </div>
        </div>}

        {/* AI Tools */}
        {tab==='ai-tools'&&<div className="max-w-2xl space-y-4">
          <div className="flex gap-2 mb-4">
            <button onClick={()=>setAiTool('plan')} className={`px-4 py-2 text-sm rounded-lg ${aiTool==='plan'?'bg-blue-600 text-white':'border text-gray-600 hover:bg-gray-50'}`}>Session Plan Generator</button>
            <button onClick={()=>setAiTool('report')} className={`px-4 py-2 text-sm rounded-lg ${aiTool==='report'?'bg-blue-600 text-white':'border text-gray-600 hover:bg-gray-50'}`}>Progress Report Generator</button>
          </div>
          {aiTool==='plan'&&<div className="bg-white rounded-xl border p-5 space-y-4">
            <h2 className="font-semibold text-slate-800">AI Session Plan Generator</h2>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-gray-500">Client Age (years)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiPlan.age} onChange={e=>setAiPlan(p=>({...p,age:e.target.value}))} /></div>
              <div><label className="text-xs text-gray-500">Duration (min)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiPlan.duration} onChange={e=>setAiPlan(p=>({...p,duration:e.target.value}))} /></div>
              <div className="col-span-2"><label className="text-xs text-gray-500">Primary Diagnosis</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiPlan.primary_diagnosis} onChange={e=>setAiPlan(p=>({...p,primary_diagnosis:e.target.value}))} /></div>
              <div className="col-span-2">
                <label className="text-xs text-gray-500">Focus Areas</label>
                <div className="flex flex-wrap gap-1.5 mt-1">{AREAS_OF_FOCUS.map(a=><button key={a} type="button" onClick={()=>togglePlanArea(a)} className={`px-2 py-0.5 rounded text-xs border ${aiPlan.areas_of_focus.includes(a)?'bg-blue-600 text-white border-blue-600':'border-gray-300 text-gray-600'}`}>{a.replace(/_/g,' ')}</button>)}</div>
              </div>
              <div><label className="text-xs text-gray-500">Session Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiPlan.session_type} onChange={e=>setAiPlan(p=>({...p,session_type:e.target.value}))}>{SESSION_TYPES_CLIENT.map(t=><option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}</select></div>
            </div>
            <button onClick={generatePlan} disabled={planLoading} className="w-full py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">{planLoading?'Generating…':'Generate Session Plan'}</button>
            {planOutput&&<div className="bg-gray-50 rounded-lg p-4 border"><pre className="text-sm whitespace-pre-wrap font-mono text-slate-700">{planOutput}</pre></div>}
          </div>}
          {aiTool==='report'&&<div className="bg-white rounded-xl border p-5 space-y-4">
            <h2 className="font-semibold text-slate-800">AI Progress Report Generator</h2>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-gray-500">Client Name</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiReport.client_name} onChange={e=>setAiReport(p=>({...p,client_name:e.target.value}))} /></div>
              <div><label className="text-xs text-gray-500">Age</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiReport.age} onChange={e=>setAiReport(p=>({...p,age:e.target.value}))} /></div>
              <div className="col-span-2"><label className="text-xs text-gray-500">Primary Diagnosis</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiReport.primary_diagnosis} onChange={e=>setAiReport(p=>({...p,primary_diagnosis:e.target.value}))} /></div>
              <div><label className="text-xs text-gray-500">SLP</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiReport.slp} onChange={e=>setAiReport(p=>({...p,slp:e.target.value}))}>{SLPS.map(s=><option key={s}>{s}</option>)}</select></div>
              <div><label className="text-xs text-gray-500">Reporting Period</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" placeholder="e.g. Sept–Dec 2026" value={aiReport.period} onChange={e=>setAiReport(p=>({...p,period:e.target.value}))} /></div>
              <div><label className="text-xs text-gray-500">Sessions Completed</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiReport.sessions_count} onChange={e=>setAiReport(p=>({...p,sessions_count:e.target.value}))} /></div>
              <div className="col-span-2"><label className="text-xs text-gray-500">Progress Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={3} value={aiReport.progress_notes} onChange={e=>setAiReport(p=>({...p,progress_notes:e.target.value}))} /></div>
            </div>
            <button onClick={generateReport} disabled={reportLoading} className="w-full py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">{reportLoading?'Generating…':'Generate Progress Report'}</button>
            {reportOutput&&<div className="bg-gray-50 rounded-lg p-4 border"><pre className="text-sm whitespace-pre-wrap font-mono text-slate-700">{reportOutput}</pre></div>}
          </div>}
        </div>}

        {/* Waitlist */}
        {tab==='waitlist'&&<div className="space-y-4">
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b"><tr>{['Name','Age','Diagnosis','Referral','Focus Areas','Wait Time','Action'].map(h=><th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr></thead>
              <tbody>
                {waitlist.map(c=>(
                  <tr key={c.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{c.first_name} {c.last_name}</td>
                    <td className="px-4 py-3 text-gray-600">{clientAge(c.date_of_birth)}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[150px] truncate">{c.primary_diagnosis||'—'}</td>
                    <td className="px-4 py-3"><Badge label={c.referral_source||'self'} color="gray" /></td>
                    <td className="px-4 py-3"><div className="flex flex-wrap gap-0.5">{(c.areas_of_focus||[]).slice(0,2).map(a=><Badge key={a} label={a} color="blue" />)}</div></td>
                    <td className="px-4 py-3 text-amber-600 font-medium">{Math.floor((Date.now()-new Date(c.created_at).getTime())/86400000)} days</td>
                    <td className="px-4 py-3"><button onClick={()=>moveToActive(c.id)} className="px-3 py-1 text-xs bg-green-50 text-green-700 rounded border border-green-200 hover:bg-green-100">Move to Active</button></td>
                  </tr>
                ))}
                {!waitlist.length&&<tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No clients on waitlist.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>}
      </div>

      {showAddClient&&<AddClientModal onClose={()=>setShowAddClient(false)} onSaved={()=>{setShowAddClient(false);loadClients();loadDashboard();}} />}
      {showCompleteSession&&<CompleteSessionModal session={showCompleteSession} onClose={()=>setShowCompleteSession(null)} onSaved={()=>{setShowCompleteSession(null);loadSessions();loadDashboard();}} />}
      {showAddGoal&&<AddGoalModal clients={clients} onClose={()=>setShowAddGoal(false)} onSaved={()=>{setShowAddGoal(false);loadGoals();}} />}
    </div>
  );
}
