'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard','clients','sessions','plans','risk','crisis','ai'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = { dashboard:'Dashboard', clients:'Clients', sessions:'Sessions', plans:'Treatment Plans', risk:'Risk Management', crisis:'Crisis Resources', ai:'AI Clinical Tools' };

const SESSION_TYPES = ['individual','couples','family','group','intake','crisis','discharge'];
const MODALITIES = ['CBT','DBT','ACT','EMDR','somatic','psychodynamic','narrative','solution_focused','gottman','family_systems','play_therapy','MBCT'];
const RISK_LEVELS = ['low','moderate','high','crisis'] as const;
const RISK_COLORS: Record<string,string> = { low:'green', moderate:'yellow', high:'orange', crisis:'red' };
const RISK_BG: Record<string,string> = { low:'bg-green-100 text-green-800', moderate:'bg-yellow-100 text-yellow-800', high:'bg-orange-100 text-orange-800', crisis:'bg-red-100 text-red-800' };
const RISK_ASSESSMENT_OPTS = ['no_risk','low_risk','moderate_risk','high_risk','crisis'];
const REFERRAL_SOURCES = ['self','physician','eap','school','court','other'];
const INTERVENTIONS = ['psychoeducation','cognitive_restructuring','behavioural_activation','grounding','mindfulness','emotion_regulation','exposure','EMDR_processing','somatic_tracking','DBT_skills','problem_solving','communication_skills','safety_planning','motivational_interviewing'];

interface Dashboard { active_clients:number;sessions_today:number;crisis_clients_count:number;eap_sessions_expiring:number;revenue_mtd:number; }
interface MhClient { id:number;first_name:string;last_name:string;therapist:string;risk_level:string;status:string;presenting_concerns:string[];eap_provider:string;eap_sessions_approved:number;safety_plan_in_place:boolean;extended_health_provider:string;aish_funded:boolean;therapy_modality:string[];referral_source:string;session_count:number;created_at:string; }
interface Session { id:number;client_id:number;first_name:string;last_name:string;therapist:string;session_date:string;start_time:string;end_time:string;session_type:string;status:string;fee:number;extended_health_claimed:number;eap_claimed:number;risk_level:string;eap_provider:string; }
interface TreatmentPlan { id:number;client_id:number;first_name:string;last_name:string;risk_level:string;therapist:string;created_date:string;diagnoses:string[];treatment_goals:string[];modalities_planned:string[];session_frequency:string;proposed_sessions:number;crisis_plan:string;review_date:string;status:string; }
interface RiskClient { id:number;first_name:string;last_name:string;risk_level:string;therapist:string;safety_plan_in_place:boolean;emergency_contact_name:string;emergency_contact_phone:string;last_session_date:string;next_scheduled:string; }

function fmtCad(n:number){ return `$${Number(n??0).toLocaleString('en-CA',{minimumFractionDigits:0,maximumFractionDigits:0})}`; }
function fmtDate(d:string){ return d?new Date(d).toLocaleDateString('en-CA'):'—'; }
function fmtDateTime(d:string,t:string){ return `${fmtDate(d)} ${t?.slice(0,5)||''}`; }

function RiskBadge({ level }:{ level:string }) {
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold uppercase ${RISK_BG[level]??'bg-gray-100 text-gray-700'}`}>{level}</span>;
}

function Badge({ label, color='gray' }:{ label:string;color?:string }) {
  const m:Record<string,string>={blue:'bg-blue-100 text-blue-700',green:'bg-green-100 text-green-700',amber:'bg-amber-100 text-amber-700',red:'bg-red-100 text-red-700',purple:'bg-purple-100 text-purple-700',gray:'bg-gray-100 text-gray-700',teal:'bg-teal-100 text-teal-700'};
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${m[color]??m.gray}`}>{label.replace(/_/g,' ')}</span>;
}

function KpiCard({ label, value, sub, color='blue', alert=false }:{ label:string;value:string|number;sub?:string;color?:string;alert?:boolean }) {
  const borders:Record<string,string>={blue:'border-l-4 border-blue-500 bg-blue-50',green:'border-l-4 border-green-500 bg-green-50',amber:'border-l-4 border-amber-500 bg-amber-50',red:'border-l-4 border-red-500 bg-red-50',purple:'border-l-4 border-purple-500 bg-purple-50'};
  return <div className={`rounded-lg p-4 ${borders[color]??borders.blue} ${alert?'ring-2 ring-red-400':''}`}><p className="text-sm text-gray-500">{label}</p><p className={`text-2xl font-bold mt-1 ${alert&&Number(value)>0?'text-red-700':''}`}>{value}</p>{sub&&<p className="text-xs text-gray-400 mt-1">{sub}</p>}</div>;
}

// ─── Add Client Modal ──────────────────────────────────────────────────────────
function AddClientModal({ onClose, onSaved }:{ onClose:()=>void;onSaved:()=>void }) {
  const [f,setF]=useState({ first_name:'',last_name:'',date_of_birth:'',phone:'',email:'',address:'',city:'Calgary',province:'AB',referral_source:'self',eap_provider:'',eap_authorization_code:'',eap_sessions_approved:'',therapist:'',presenting_concerns:'',risk_level:'low',safety_plan_in_place:false,emergency_contact_name:'',emergency_contact_phone:'',extended_health_provider:'',extended_health_id:'',coverage_per_session:'',aish_funded:false,status:'active',notes:'' });
  const [selectedModalities,setSelectedModalities]=useState<string[]>([]);
  const [saving,setSaving]=useState(false);
  const upd=(k:string,v:string|boolean)=>setF(p=>({...p,[k]:v}));
  function toggleModality(m:string){ setSelectedModalities(p=>p.includes(m)?p.filter(x=>x!==m):[...p,m]); }
  async function submit(){
    if(!f.first_name||!f.last_name||!f.phone||!f.presenting_concerns)return;
    setSaving(true);
    try{
      await fetch('/api/admin/mental-health-clinic/clients',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...f,presenting_concerns:f.presenting_concerns.split(',').map(s=>s.trim()),therapy_modality:selectedModalities,eap_sessions_approved:f.eap_sessions_approved?parseInt(f.eap_sessions_approved):null,coverage_per_session:f.coverage_per_session?parseFloat(f.coverage_per_session):null})});
      onSaved();
    }finally{setSaving(false);}
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-4 text-slate-800">New Client Intake</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><label className="text-xs text-gray-500">First Name *</label><input className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.first_name} onChange={e=>upd('first_name',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Last Name *</label><input className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.last_name} onChange={e=>upd('last_name',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Date of Birth</label><input type="date" className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.date_of_birth} onChange={e=>upd('date_of_birth',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Phone *</label><input className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.phone} onChange={e=>upd('phone',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Email</label><input className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.email} onChange={e=>upd('email',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Referral Source</label><select className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.referral_source} onChange={e=>upd('referral_source',e.target.value)}>{REFERRAL_SOURCES.map(r=><option key={r} value={r}>{r}</option>)}</select></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Presenting Concerns * (comma-separated)</label><input className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.presenting_concerns} onChange={e=>upd('presenting_concerns',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Risk Level</label><select className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.risk_level} onChange={e=>upd('risk_level',e.target.value)}>{RISK_LEVELS.map(r=><option key={r} value={r}>{r}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Therapist</label><input className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.therapist} onChange={e=>upd('therapist',e.target.value)}/></div>
          <div className="col-span-2">
            <label className="text-xs text-gray-500">Therapy Modalities</label>
            <div className="flex flex-wrap gap-1 mt-1">
              {MODALITIES.map(m=>(
                <button key={m} onClick={()=>toggleModality(m)} className={`px-2 py-0.5 rounded text-xs border ${selectedModalities.includes(m)?'bg-indigo-600 text-white border-indigo-600':'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>{m}</button>
              ))}
            </div>
          </div>
          <div className="col-span-2 border-t pt-2 mt-1"><p className="text-xs font-semibold text-gray-600 mb-2">EAP / Insurance</p></div>
          <div><label className="text-xs text-gray-500">EAP Provider</label><input className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.eap_provider} onChange={e=>upd('eap_provider',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">EAP Sessions Approved</label><input type="number" className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.eap_sessions_approved} onChange={e=>upd('eap_sessions_approved',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Extended Health Provider</label><input className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.extended_health_provider} onChange={e=>upd('extended_health_provider',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Coverage/Session ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.coverage_per_session} onChange={e=>upd('coverage_per_session',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Emergency Contact Name</label><input className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.emergency_contact_name} onChange={e=>upd('emergency_contact_name',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Emergency Contact Phone</label><input className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.emergency_contact_phone} onChange={e=>upd('emergency_contact_phone',e.target.value)}/></div>
          <div className="flex items-center gap-2 col-span-2">
            <input type="checkbox" id="aish" checked={f.aish_funded} onChange={e=>upd('aish_funded',e.target.checked)}/>
            <label htmlFor="aish" className="text-xs text-gray-600">AISH Funded</label>
            <input type="checkbox" id="splan" className="ml-4" checked={f.safety_plan_in_place} onChange={e=>upd('safety_plan_in_place',e.target.checked)}/>
            <label htmlFor="splan" className="text-xs text-gray-600">Safety Plan in Place</label>
          </div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 mt-0.5" rows={2} value={f.notes} onChange={e=>upd('notes',e.target.value)}/></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-1.5 rounded border text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving||!f.first_name||!f.last_name||!f.phone||!f.presenting_concerns} className="px-4 py-1.5 rounded bg-indigo-700 text-white text-sm font-medium hover:bg-indigo-800 disabled:opacity-50">{saving?'Saving…':'Create Client'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Complete Session Modal ────────────────────────────────────────────────────
function CompleteSessionModal({ session, onClose, onSaved }:{ session:Session;onClose:()=>void;onSaved:()=>void }) {
  const [f,setF]=useState({ presenting_issues:'',interventions:[] as string[],client_response:'',progress:'',risk_assessment:'no_risk',safety_planning_done:false,homework_assigned:'',fee:'',extended_health_claimed:'',eap_claimed:'',patient_paid:'',payment_method:'cash' });
  const [saving,setSaving]=useState(false);
  const upd=(k:string,v:string|boolean)=>setF(p=>({...p,[k]:v as string}));
  function toggleIntervention(i:string){ setF(p=>({...p,interventions:p.interventions.includes(i)?p.interventions.filter(x=>x!==i):[...p.interventions,i]})); }
  async function submit(){
    setSaving(true);
    try{
      await fetch(`/api/admin/mental-health-clinic/sessions/${session.id}/complete`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...f,client_id:session.client_id,fee:f.fee?parseFloat(f.fee):null,extended_health_claimed:f.extended_health_claimed?parseFloat(f.extended_health_claimed):null,eap_claimed:f.eap_claimed?parseFloat(f.eap_claimed):null,patient_paid:f.patient_paid?parseFloat(f.patient_paid):null})});
      onSaved();
    }finally{setSaving(false);}
  }
  const riskColor=f.risk_assessment.includes('crisis')?'red':f.risk_assessment.includes('high')?'orange':f.risk_assessment.includes('moderate')?'amber':'gray';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-1 text-slate-800">Complete Session — Clinical Notes</h2>
        <div className="bg-blue-50 border border-blue-200 rounded px-3 py-2 mb-3 text-xs text-blue-700">Confidential clinical notes — therapist access only</div>
        <p className="text-sm text-gray-500 mb-4">{session.first_name} {session.last_name} — {session.session_type} — {fmtDate(session.session_date)}</p>
        <div className="grid grid-cols-1 gap-3 text-sm">
          <div><label className="text-xs text-gray-500">Presenting Issues</label><textarea className="w-full border rounded px-2 py-1.5 mt-0.5" rows={2} value={f.presenting_issues} onChange={e=>upd('presenting_issues',e.target.value)}/></div>
          <div>
            <label className="text-xs text-gray-500">Interventions Used</label>
            <div className="flex flex-wrap gap-1 mt-1">
              {INTERVENTIONS.map(i=>(
                <button key={i} onClick={()=>toggleIntervention(i)} className={`px-2 py-0.5 rounded text-xs border ${f.interventions.includes(i)?'bg-indigo-600 text-white border-indigo-600':'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>{i.replace(/_/g,' ')}</button>
              ))}
            </div>
          </div>
          <div><label className="text-xs text-gray-500">Client Response</label><textarea className="w-full border rounded px-2 py-1.5 mt-0.5" rows={2} value={f.client_response} onChange={e=>upd('client_response',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Progress Note</label><textarea className="w-full border rounded px-2 py-1.5 mt-0.5" rows={2} value={f.progress} onChange={e=>upd('progress',e.target.value)}/></div>
          <div>
            <label className="text-xs text-gray-500">Risk Assessment</label>
            <select className={`w-full border-2 rounded px-2 py-1.5 mt-0.5 font-medium ${riskColor==='red'?'border-red-400 text-red-700':riskColor==='orange'?'border-orange-400 text-orange-700':riskColor==='amber'?'border-amber-400 text-amber-700':'border-gray-200'}`} value={f.risk_assessment} onChange={e=>upd('risk_assessment',e.target.value)}>
              {RISK_ASSESSMENT_OPTS.map(r=><option key={r} value={r}>{r.replace(/_/g,' ')}</option>)}
            </select>
            {(f.risk_assessment==='high_risk'||f.risk_assessment==='crisis')&&(
              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">High/crisis risk — ensure safety plan is completed and emergency contacts are notified per CCPA duty-to-protect guidelines.</div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="spdone" checked={f.safety_planning_done} onChange={e=>setF(p=>({...p,safety_planning_done:e.target.checked}))}/>
            <label htmlFor="spdone" className="text-xs text-gray-700">Safety planning completed this session</label>
          </div>
          <div><label className="text-xs text-gray-500">Homework / Between-Session Practice</label><textarea className="w-full border rounded px-2 py-1.5 mt-0.5" rows={2} value={f.homework_assigned} onChange={e=>upd('homework_assigned',e.target.value)}/></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 border-t pt-3">
            <div><label className="text-xs text-gray-500">Fee ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.fee} onChange={e=>upd('fee',e.target.value)}/></div>
            <div><label className="text-xs text-gray-500">Extended Health ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.extended_health_claimed} onChange={e=>upd('extended_health_claimed',e.target.value)}/></div>
            <div><label className="text-xs text-gray-500">EAP Claim ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.eap_claimed} onChange={e=>upd('eap_claimed',e.target.value)}/></div>
            <div><label className="text-xs text-gray-500">Patient Paid ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.patient_paid} onChange={e=>upd('patient_paid',e.target.value)}/></div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-1.5 rounded border text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-1.5 rounded bg-indigo-700 text-white text-sm font-medium hover:bg-indigo-800 disabled:opacity-50">{saving?'Saving…':'Complete Session'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function MentalHealthClinicPage() {
  const [tab,setTab]=useState<Tab>('dashboard');
  const [dash,setDash]=useState<Dashboard|null>(null);
  const [clients,setClients]=useState<MhClient[]>([]);
  const [sessions,setSessions]=useState<Session[]>([]);
  const [plans,setPlans]=useState<TreatmentPlan[]>([]);
  const [riskClients,setRiskClients]=useState<RiskClient[]>([]);
  const [showAddClient,setShowAddClient]=useState(false);
  const [completingSession,setCompletingSession]=useState<Session|null>(null);
  const [aiMode,setAiMode]=useState<'session'|'plan'>('session');
  const [aiInput,setAiInput]=useState({ session_type:'individual',modality:[] as string[],presenting_concerns:'',goals:'',previous_session_summary:'' });
  const [aiResult,setAiResult]=useState('');
  const [aiLoading,setAiLoading]=useState(false);

  const loadDash=useCallback(async()=>{ const r=await fetch('/api/admin/mental-health-clinic'); setDash(await r.json()); },[]);
  const loadClients=useCallback(async()=>{ const r=await fetch('/api/admin/mental-health-clinic/clients'); setClients(await r.json()); },[]);
  const loadSessions=useCallback(async()=>{ const r=await fetch('/api/admin/mental-health-clinic/sessions'); setSessions(await r.json()); },[]);
  const loadPlans=useCallback(async()=>{ const r=await fetch('/api/admin/mental-health-clinic/treatment-plans'); setPlans(await r.json()); },[]);
  const loadRisk=useCallback(async()=>{ const r=await fetch('/api/admin/mental-health-clinic/risk-dashboard'); setRiskClients(await r.json()); },[]);

  useEffect(()=>{ loadDash(); },[loadDash]);
  useEffect(()=>{ if(tab==='clients')loadClients(); },[tab,loadClients]);
  useEffect(()=>{ if(tab==='sessions')loadSessions(); },[tab,loadSessions]);
  useEffect(()=>{ if(tab==='plans')loadPlans(); },[tab,loadPlans]);
  useEffect(()=>{ if(tab==='risk')loadRisk(); },[tab,loadRisk]);

  async function runAI(){
    setAiLoading(true);setAiResult('');
    try{
      const endpoint=aiMode==='session'?'ai-session-plan':'ai-treatment-plan';
      const payload=aiMode==='session'?{session_type:aiInput.session_type,modality:aiInput.modality,presenting_concerns:aiInput.presenting_concerns.split(',').map(s=>s.trim()),goals:aiInput.goals.split(',').map(s=>s.trim()),previous_session_summary:aiInput.previous_session_summary}:{presenting_concerns:aiInput.presenting_concerns.split(',').map(s=>s.trim()),modality:aiInput.modality};
      const r=await fetch(`/api/admin/mental-health-clinic/${endpoint}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const d=await r.json();
      setAiResult(d.plan||'');
    }finally{setAiLoading(false);}
  }

  function toggleAiModality(m:string){ setAiInput(p=>({...p,modality:p.modality.includes(m)?p.modality.filter(x=>x!==m):[...p.modality,m]})); }

  const crisisCount=(riskClients.filter(c=>c.risk_level==='crisis')||[]).length;
  const highCount=(riskClients.filter(c=>c.risk_level==='high')||[]).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-indigo-900 text-white px-6 py-4">
        <h1 className="text-xl font-bold">Mental Health Counselling & Therapy Hub</h1>
        <p className="text-indigo-300 text-sm mt-0.5">Alberta CCPA/RPCA Clinical Practice Management</p>
      </div>
      <div className="bg-white border-b px-6 flex gap-1 overflow-x-auto">
        {TABS.map(t=>(
          <button key={t} onClick={()=>setTab(t)} className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap relative ${tab===t?'border-indigo-600 text-indigo-700':'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {TAB_LABELS[t]}
            {t==='risk'&&riskClients.length>0&&<span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{riskClients.length}</span>}
          </button>
        ))}
      </div>

      <div className="p-6 max-w-7xl mx-auto">

        {/* DASHBOARD */}
        {tab==='dashboard'&&(
          <div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <KpiCard label="Active Clients" value={dash?.active_clients??'…'} color="blue"/>
              <KpiCard label="Sessions Today" value={dash?.sessions_today??'…'} color="green"/>
              <KpiCard label="High/Crisis Clients" value={dash?.crisis_clients_count??'…'} color="red" alert={(dash?.crisis_clients_count||0)>0}/>
              <KpiCard label="EAP Active" value={dash?.eap_sessions_expiring??'…'} color="amber"/>
              <KpiCard label="Revenue MTD" value={dash?fmtCad(dash.revenue_mtd):'…'} color="purple"/>
            </div>
            {dash&&dash.crisis_clients_count>0&&(
              <div className="bg-red-50 border-2 border-red-400 rounded-lg p-4 mb-4">
                <p className="font-bold text-red-700 text-sm">CLINICAL ALERT: {dash.crisis_clients_count} client{dash.crisis_clients_count>1?'s':''} at high or crisis risk level</p>
                <button onClick={()=>setTab('risk')} className="text-sm text-red-600 hover:underline mt-1">View Risk Management dashboard →</button>
              </div>
            )}
            <div className="bg-white rounded-lg border p-4">
              <h2 className="font-semibold text-slate-700 mb-2">Today&apos;s Sessions</h2>
              <button onClick={()=>setTab('sessions')} className="text-sm text-indigo-600 hover:underline">View all sessions →</button>
            </div>
          </div>
        )}

        {/* CLIENTS */}
        {tab==='clients'&&(
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-700">Clients ({clients.length})</h2>
              <button onClick={()=>setShowAddClient(true)} className="px-4 py-2 bg-indigo-700 text-white rounded text-sm font-medium hover:bg-indigo-800">+ Add Client</button>
            </div>
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>{['Client','Risk','Concerns','Therapist','Payer','Modality','Sessions','Status'].map(h=><th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {clients.map(c=>(
                    <tr key={c.id} className={`border-b hover:bg-gray-50 ${c.risk_level==='crisis'?'bg-red-50':c.risk_level==='high'?'bg-orange-50':''}`}>
                      <td className="px-3 py-3">
                        <p className="font-medium text-slate-800">{c.first_name} {c.last_name}</p>
                        <p className="text-xs text-gray-400">{c.referral_source}</p>
                      </td>
                      <td className="px-3 py-3">
                        <RiskBadge level={c.risk_level}/>
                        {c.safety_plan_in_place&&<span className="ml-1 text-xs text-green-600 font-medium">SP✓</span>}
                      </td>
                      <td className="px-3 py-3 max-w-36"><p className="text-xs text-gray-600 truncate">{c.presenting_concerns?.join(', ')}</p></td>
                      <td className="px-3 py-3 text-xs text-gray-600">{c.therapist||'—'}</td>
                      <td className="px-3 py-3">
                        {c.eap_provider&&<Badge label={`EAP (${c.eap_sessions_approved||0})`} color="purple"/>}
                        {c.extended_health_provider&&<Badge label="Extended" color="blue"/>}
                        {c.aish_funded&&<Badge label="AISH" color="amber"/>}
                        {!c.eap_provider&&!c.extended_health_provider&&!c.aish_funded&&<span className="text-xs text-gray-400">Private</span>}
                      </td>
                      <td className="px-3 py-3 max-w-32"><p className="text-xs text-gray-500 truncate">{c.therapy_modality?.join(', ')||'—'}</p></td>
                      <td className="px-3 py-3 text-center text-sm">{c.session_count}</td>
                      <td className="px-3 py-3"><Badge label={c.status} color={c.status==='active'?'green':c.status==='waitlist'?'amber':c.status==='completed'?'gray':'blue'}/></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {showAddClient&&<AddClientModal onClose={()=>setShowAddClient(false)} onSaved={()=>{setShowAddClient(false);loadClients();loadDash();}}/>}
          </div>
        )}

        {/* SESSIONS */}
        {tab==='sessions'&&(
          <div>
            <h2 className="text-lg font-semibold text-slate-700 mb-4">Sessions</h2>
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>{['Client','Date/Time','Type','Therapist','Risk','Payer','Fee','Status','Action'].map(h=><th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {sessions.map(s=>(
                    <tr key={s.id} className={`border-b hover:bg-gray-50 ${s.risk_level==='crisis'?'bg-red-50':s.risk_level==='high'?'bg-orange-50':''}`}>
                      <td className="px-3 py-3"><p className="font-medium text-slate-800">{s.first_name} {s.last_name}</p></td>
                      <td className="px-3 py-3"><p className="text-xs">{fmtDate(s.session_date)}</p><p className="text-xs text-gray-400">{s.start_time?.slice(0,5)}–{s.end_time?.slice(0,5)}</p></td>
                      <td className="px-3 py-3"><Badge label={s.session_type} color="indigo"/></td>
                      <td className="px-3 py-3 text-xs">{s.therapist}</td>
                      <td className="px-3 py-3"><RiskBadge level={s.risk_level}/></td>
                      <td className="px-3 py-3">
                        {s.eap_provider?<Badge label="EAP" color="purple"/>:s.extended_health_claimed?<Badge label="Extended" color="blue"/>:<span className="text-xs text-gray-400">Private</span>}
                      </td>
                      <td className="px-3 py-3 text-xs">{s.fee?fmtCad(s.fee):'—'}</td>
                      <td className="px-3 py-3"><Badge label={s.status} color={s.status==='completed'?'green':s.status==='scheduled'?'blue':s.status==='cancelled'?'red':'amber'}/></td>
                      <td className="px-3 py-3">
                        {s.status==='scheduled'&&<button onClick={()=>setCompletingSession(s)} className="text-xs text-indigo-600 hover:underline">Complete</button>}
                        {s.status==='scheduled'&&(
                          <button onClick={async()=>{await fetch(`/api/admin/mental-health-clinic/sessions/${s.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'cancelled'})});loadSessions();}} className="ml-2 text-xs text-red-500 hover:underline">Cancel</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {completingSession&&<CompleteSessionModal session={completingSession} onClose={()=>setCompletingSession(null)} onSaved={()=>{setCompletingSession(null);loadSessions();loadDash();loadRisk();}}/>}
          </div>
        )}

        {/* TREATMENT PLANS */}
        {tab==='plans'&&(
          <div>
            <h2 className="text-lg font-semibold text-slate-700 mb-4">Treatment Plans ({plans.length})</h2>
            <div className="grid gap-4">
              {plans.map(p=>(
                <div key={p.id} className="bg-white rounded-lg border p-4">
                  <div className="flex justify-between items-start flex-wrap gap-2 mb-3">
                    <div>
                      <p className="font-semibold text-slate-800">{p.first_name} {p.last_name}</p>
                      <p className="text-xs text-gray-500">Therapist: {p.therapist} · {fmtDate(p.created_date)}</p>
                    </div>
                    <div className="flex gap-2"><RiskBadge level={p.risk_level}/><Badge label={p.status} color={p.status==='active'?'green':'gray'}/></div>
                  </div>
                  {p.diagnoses&&p.diagnoses.length>0&&<div className="mb-2"><span className="text-xs text-gray-400">DSM-5 Diagnoses: </span><span className="text-xs text-slate-700">{p.diagnoses.join(', ')}</span></div>}
                  {p.treatment_goals&&p.treatment_goals.length>0&&(
                    <div className="mb-2">
                      <p className="text-xs text-gray-400 mb-1">SMART Treatment Goals:</p>
                      <ul className="list-disc list-inside">
                        {p.treatment_goals.map((g,i)=><li key={i} className="text-xs text-slate-700">{g}</li>)}
                      </ul>
                    </div>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mt-2">
                    <div><span className="text-gray-400">Frequency</span><p className="font-medium">{p.session_frequency||'—'}</p></div>
                    <div><span className="text-gray-400">Proposed Sessions</span><p className="font-medium">{p.proposed_sessions||'—'}</p></div>
                    <div><span className="text-gray-400">Review Date</span><p className={`font-medium ${p.review_date&&new Date(p.review_date)<new Date()?'text-red-600':''}`}>{fmtDate(p.review_date)}</p></div>
                    <div><span className="text-gray-400">Modalities</span><p className="text-slate-600">{p.modalities_planned?.join(', ')||'—'}</p></div>
                  </div>
                  {p.crisis_plan&&<div className="mt-2 p-2 bg-red-50 border border-red-200 rounded"><p className="text-xs text-red-700"><strong>Crisis Plan:</strong> {p.crisis_plan}</p></div>}
                </div>
              ))}
              {plans.length===0&&<p className="text-sm text-gray-400">No treatment plans yet.</p>}
            </div>
          </div>
        )}

        {/* RISK MANAGEMENT */}
        {tab==='risk'&&(
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-700">Risk Management Dashboard</h2>
              <button onClick={loadRisk} className="px-3 py-1.5 border rounded text-sm text-gray-600 hover:bg-gray-50">Refresh</button>
            </div>
            {crisisCount>0&&(
              <div className="bg-red-50 border-2 border-red-500 rounded-lg p-4 mb-4">
                <p className="font-bold text-red-700">{crisisCount} CLIENT{crisisCount>1?'S':''} AT CRISIS LEVEL</p>
                <p className="text-sm text-red-600">Immediate clinical review and safety planning required. Contact supervisor if needed.</p>
              </div>
            )}
            {highCount>0&&(
              <div className="bg-orange-50 border border-orange-400 rounded-lg p-3 mb-4">
                <p className="font-semibold text-orange-700">{highCount} client{highCount>1?'s':''} at HIGH risk — ensure next session is scheduled within 1 week</p>
              </div>
            )}
            <div className="grid gap-4">
              {riskClients.map(c=>(
                <div key={c.id} className={`bg-white rounded-lg border-2 p-4 ${c.risk_level==='crisis'?'border-red-400':c.risk_level==='high'?'border-orange-400':'border-yellow-300'}`}>
                  <div className="flex justify-between items-start flex-wrap gap-2">
                    <div>
                      <p className="font-semibold text-slate-800">{c.first_name} {c.last_name}</p>
                      <p className="text-xs text-gray-500">Therapist: {c.therapist||'unassigned'}</p>
                    </div>
                    <RiskBadge level={c.risk_level}/>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-xs">
                    <div><span className="text-gray-400">Last Session</span><p className="font-medium">{fmtDate(c.last_session_date)}</p></div>
                    <div><span className="text-gray-400">Next Scheduled</span><p className={`font-medium ${!c.next_scheduled?'text-red-600':''}`}>{c.next_scheduled?fmtDate(c.next_scheduled):'NOT SCHEDULED'}</p></div>
                    <div><span className="text-gray-400">Safety Plan</span><p className={`font-bold ${c.safety_plan_in_place?'text-green-600':'text-red-600'}`}>{c.safety_plan_in_place?'In Place':'MISSING'}</p></div>
                    <div><span className="text-gray-400">Emergency Contact</span><p className="font-medium">{c.emergency_contact_name||'Not recorded'}</p>{c.emergency_contact_phone&&<p className="text-gray-500">{c.emergency_contact_phone}</p>}</div>
                  </div>
                </div>
              ))}
              {riskClients.length===0&&<div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center"><p className="text-green-700 font-medium">No clients currently at moderate, high, or crisis risk.</p></div>}
            </div>
          </div>
        )}

        {/* CRISIS RESOURCES */}
        {tab==='crisis'&&(
          <div className="max-w-2xl">
            <h2 className="text-lg font-semibold text-slate-700 mb-4">Calgary Crisis Resources</h2>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="font-bold text-red-700 text-sm">For immediate life-threatening emergencies, call 911</p>
            </div>
            <div className="grid gap-3">
              {[
                { name:'AHS Addiction & Mental Health', phone:'403-297-2477', desc:'24/7 Mental health crisis line — Alberta Health Services', urgent:true },
                { name:'Distress Centre Calgary', phone:'403-266-4357', desc:'24/7 distress and crisis line for Calgary and area', urgent:true },
                { name:'Suicide Crisis Helpline', phone:'9-8-8', desc:'National 24/7 suicide crisis and prevention line (call or text)', urgent:true },
                { name:'AHS Mobile Crisis Team', phone:'403-266-4357', desc:'Connects with distress centre — mobile crisis team dispatched as needed', urgent:false },
                { name:'Alberta 211', phone:'2-1-1', desc:'Community social services, mental health resources directory', urgent:false },
                { name:'Kids Help Phone', phone:'1-800-668-6868', desc:'24/7 for youth — call or text 686868', urgent:false },
                { name:'Calgary Sexual Health Centre', phone:'403-283-5580', desc:'Counselling, crisis support, sexual health resources', urgent:false },
                { name:'CCPA Crisis Protocol', phone:'', desc:'Canadian Counselling and Psychotherapy Association duty-to-warn/protect guidelines — consult supervisor for high/crisis risk cases', urgent:false },
              ].map(r=>(
                <div key={r.name} className={`bg-white rounded-lg border p-4 ${r.urgent?'border-red-300':''}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-slate-800">{r.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{r.desc}</p>
                    </div>
                    {r.phone&&<a href={`tel:${r.phone.replace(/[^0-9]/g,'')}`} className={`text-lg font-bold ${r.urgent?'text-red-600':'text-indigo-700'} hover:underline`}>{r.phone}</a>}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 bg-gray-50 border rounded-lg p-4 text-xs text-gray-500">
              <p className="font-semibold text-gray-700 mb-1">Documentation Reminder</p>
              <p>When a duty-to-protect situation arises, document the risk assessment, interventions taken, contacts notified, and clinical reasoning in the session notes. Consult supervisor immediately for high/crisis risk clients.</p>
            </div>
          </div>
        )}

        {/* AI CLINICAL TOOLS */}
        {tab==='ai'&&(
          <div className="max-w-3xl">
            <h2 className="text-lg font-semibold text-slate-700 mb-2">AI Clinical Tools</h2>
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 mb-4">
              <p className="text-sm font-bold text-amber-800">IMPORTANT: Clinical Planning Tool Only</p>
              <p className="text-xs text-amber-700 mt-1">All AI outputs require review, modification, and approval by the licensed therapist using their professional clinical judgment and direct knowledge of the client. Never use AI output directly without therapist oversight. AI cannot replace clinical assessment.</p>
            </div>
            <div className="bg-white rounded-lg border p-5">
              <div className="flex gap-2 mb-4">
                <button onClick={()=>setAiMode('session')} className={`px-4 py-2 rounded text-sm font-medium ${aiMode==='session'?'bg-indigo-700 text-white':'border text-gray-600 hover:bg-gray-50'}`}>Session Plan Generator</button>
                <button onClick={()=>setAiMode('plan')} className={`px-4 py-2 rounded text-sm font-medium ${aiMode==='plan'?'bg-indigo-700 text-white':'border text-gray-600 hover:bg-gray-50'}`}>Treatment Plan Framework</button>
              </div>
              <div className="grid grid-cols-1 gap-3 text-sm mb-3">
                <div><label className="text-xs text-gray-500">Presenting Concerns (comma-separated)</label><input className="w-full border rounded px-2 py-1.5 mt-0.5" value={aiInput.presenting_concerns} onChange={e=>setAiInput(p=>({...p,presenting_concerns:e.target.value}))}/></div>
                <div>
                  <label className="text-xs text-gray-500">Therapy Modalities</label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {MODALITIES.map(m=>(
                      <button key={m} onClick={()=>toggleAiModality(m)} className={`px-2 py-0.5 rounded text-xs border ${aiInput.modality.includes(m)?'bg-indigo-600 text-white border-indigo-600':'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>{m}</button>
                    ))}
                  </div>
                </div>
                {aiMode==='session'&&(
                  <>
                    <div><label className="text-xs text-gray-500">Session Type</label><select className="w-full border rounded px-2 py-1.5 mt-0.5" value={aiInput.session_type} onChange={e=>setAiInput(p=>({...p,session_type:e.target.value}))}>{SESSION_TYPES.map(t=><option key={t} value={t}>{t}</option>)}</select></div>
                    <div><label className="text-xs text-gray-500">Treatment Goals (comma-separated)</label><input className="w-full border rounded px-2 py-1.5 mt-0.5" value={aiInput.goals} onChange={e=>setAiInput(p=>({...p,goals:e.target.value}))}/></div>
                    <div><label className="text-xs text-gray-500">Previous Session Summary</label><textarea className="w-full border rounded px-2 py-1.5 mt-0.5" rows={2} value={aiInput.previous_session_summary} onChange={e=>setAiInput(p=>({...p,previous_session_summary:e.target.value}))}/></div>
                  </>
                )}
              </div>
              <button onClick={runAI} disabled={aiLoading||!aiInput.presenting_concerns} className="px-5 py-2 bg-indigo-700 text-white rounded text-sm font-medium hover:bg-indigo-800 disabled:opacity-50">{aiLoading?'Generating…':'Generate with Ollama AI'}</button>
              {aiResult&&(
                <div className="mt-4">
                  <div className="bg-amber-50 border border-amber-200 rounded p-2 mb-2">
                    <p className="text-xs text-amber-700 font-medium">AI-generated draft — requires therapist review before use</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded border">
                    <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans">{aiResult}</pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
