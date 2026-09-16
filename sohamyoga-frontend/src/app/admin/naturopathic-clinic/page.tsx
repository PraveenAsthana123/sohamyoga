'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard','patients','visits','labs','protocols','ai','analytics'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = { dashboard:'Dashboard', patients:'Patients', visits:'Visits', labs:'Lab Orders', protocols:'Supplement Protocols', ai:'AI ND Tools', analytics:'Analytics' };

const VISIT_TYPES = ['initial_intake','follow_up','acute_visit','lab_review','supplement_consult','IV_therapy','injection','discharge'];
const VISIT_TYPE_COLORS: Record<string,string> = { initial_intake:'purple',follow_up:'blue',acute_visit:'red',lab_review:'teal',supplement_consult:'green',IV_therapy:'amber',injection:'orange',discharge:'gray' };
const LAB_TYPES = ['blood_panel','hormone','food_sensitivity','heavy_metal','stool','urine','thyroid','adrenal','genetic','DUTCH','GI_Map','other'];
const DIET_TYPES = ['omnivore','vegetarian','vegan','keto','paleo','gluten_free','other'];
const THERAPIES = ['botanical_medicine','clinical_nutrition','homeopathy','acupuncture','physical_medicine','lifestyle_counselling','IV_therapy','B12_injection','mistletoe_therapy','prolotherapy'];

interface Dashboard { active_patients:number;visits_today:number;labs_pending_results:number;supplements_protocols_active:number;revenue_mtd:number; }
interface NdPatient { id:number;first_name:string;last_name:string;phone:string;email:string;chief_complaint:string;diet_type:string;stress_level:number;naturopath:string;extended_health_provider:string;status:string;visit_count:number;created_at:string; }
interface Visit { id:number;patient_id:number;first_name:string;last_name:string;naturopath:string;visit_date:string;visit_time:string;visit_type:string;status:string;fee:number;extended_health_claimed:number;extended_health_provider:string; }
interface LabOrder { id:number;patient_id:number;first_name:string;last_name:string;ordered_date:string;naturopath:string;lab_type:string;lab_company:string;tests_ordered:string[];results_received:boolean;results_date:string;results_summary:string; }
interface Protocol { id:number;patient_id:number;first_name:string;last_name:string;protocol_name:string;health_goals:string[];supplements:SupplementItem[];status:string;next_review_date:string;created_at:string; }
interface SupplementItem { name:string;brand?:string;dose:string;frequency:string;timing?:string;duration?:string;purpose?:string; }

function fmtCad(n:number){ return `$${Number(n??0).toLocaleString('en-CA',{minimumFractionDigits:0,maximumFractionDigits:0})}`; }
function fmtDate(d:string){ return d?new Date(d).toLocaleDateString('en-CA'):'—'; }
function daysUntil(d:string){ if(!d)return null; const diff=Math.ceil((new Date(d).getTime()-Date.now())/(1000*60*60*24)); return diff; }

function Badge({ label, color='gray' }:{ label:string;color?:string }) {
  const m:Record<string,string>={blue:'bg-blue-100 text-blue-700',green:'bg-green-100 text-green-700',amber:'bg-amber-100 text-amber-700',red:'bg-red-100 text-red-700',purple:'bg-purple-100 text-purple-700',gray:'bg-gray-100 text-gray-700',teal:'bg-teal-100 text-teal-700',orange:'bg-orange-100 text-orange-700'};
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${m[color]??m.gray}`}>{label.replace(/_/g,' ')}</span>;
}

function KpiCard({ label, value, sub, color='blue' }:{ label:string;value:string|number;sub?:string;color?:string }) {
  const borders:Record<string,string>={blue:'border-l-4 border-blue-500 bg-blue-50',green:'border-l-4 border-green-500 bg-green-50',amber:'border-l-4 border-amber-500 bg-amber-50',red:'border-l-4 border-red-500 bg-red-50',purple:'border-l-4 border-purple-500 bg-purple-50',teal:'border-l-4 border-teal-500 bg-teal-50'};
  return <div className={`rounded-lg p-4 ${borders[color]??borders.blue}`}><p className="text-sm text-gray-500">{label}</p><p className="text-2xl font-bold mt-1">{value}</p>{sub&&<p className="text-xs text-gray-400 mt-1">{sub}</p>}</div>;
}

function StressBar({ level }:{ level:number }) {
  const pct=(level||0)*10;
  const color=level<=3?'bg-green-500':level<=6?'bg-amber-500':'bg-red-500';
  return <div className="flex items-center gap-1"><div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden"><div className={`h-2 ${color} rounded-full`} style={{width:`${pct}%`}}/></div><span className="text-xs text-gray-500">{level||'—'}/10</span></div>;
}

// ─── Add Patient Modal ─────────────────────────────────────────────────────────
function AddPatientModal({ onClose, onSaved }:{ onClose:()=>void;onSaved:()=>void }) {
  const [f,setF]=useState({ first_name:'',last_name:'',date_of_birth:'',phone:'',email:'',address:'',city:'Calgary',province:'AB',referral_source:'',naturopath:'',chief_complaint:'',diet_type:'omnivore',sleep_hours:'',exercise_frequency:'',stress_level:'',extended_health_provider:'',extended_health_id:'',coverage_per_visit:'',status:'active',notes:'' });
  const [saving,setSaving]=useState(false);
  const upd=(k:string,v:string)=>setF(p=>({...p,[k]:v}));
  async function submit(){
    if(!f.first_name||!f.last_name||!f.date_of_birth||!f.phone||!f.chief_complaint)return;
    setSaving(true);
    try{
      await fetch('/api/admin/naturopathic-clinic/patients',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...f,sleep_hours:f.sleep_hours?parseFloat(f.sleep_hours):null,stress_level:f.stress_level?parseInt(f.stress_level):null,coverage_per_visit:f.coverage_per_visit?parseFloat(f.coverage_per_visit):null})});
      onSaved();
    }finally{setSaving(false);}
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-4 text-slate-800">New ND Patient</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><label className="text-xs text-gray-500">First Name *</label><input className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.first_name} onChange={e=>upd('first_name',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Last Name *</label><input className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.last_name} onChange={e=>upd('last_name',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Date of Birth *</label><input type="date" className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.date_of_birth} onChange={e=>upd('date_of_birth',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Phone *</label><input className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.phone} onChange={e=>upd('phone',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Email</label><input className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.email} onChange={e=>upd('email',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Naturopath</label><input className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.naturopath} onChange={e=>upd('naturopath',e.target.value)}/></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Chief Complaint *</label><textarea className="w-full border rounded px-2 py-1.5 mt-0.5" rows={2} value={f.chief_complaint} onChange={e=>upd('chief_complaint',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Diet Type</label><select className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.diet_type} onChange={e=>upd('diet_type',e.target.value)}>{DIET_TYPES.map(d=><option key={d} value={d}>{d}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Stress Level (1–10)</label><input type="number" min="1" max="10" className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.stress_level} onChange={e=>upd('stress_level',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Sleep Hours/Night</label><input type="number" step="0.5" className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.sleep_hours} onChange={e=>upd('sleep_hours',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Exercise Frequency</label><input className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.exercise_frequency} onChange={e=>upd('exercise_frequency',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Extended Health Provider</label><input className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.extended_health_provider} onChange={e=>upd('extended_health_provider',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Coverage/Visit ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.coverage_per_visit} onChange={e=>upd('coverage_per_visit',e.target.value)}/></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 mt-0.5" rows={2} value={f.notes} onChange={e=>upd('notes',e.target.value)}/></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-1.5 rounded border text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving||!f.first_name||!f.last_name||!f.date_of_birth||!f.phone||!f.chief_complaint} className="px-4 py-1.5 rounded bg-green-700 text-white text-sm font-medium hover:bg-green-800 disabled:opacity-50">{saving?'Saving…':'Create Patient'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Complete Visit Modal ──────────────────────────────────────────────────────
function CompleteVisitModal({ visit, onClose, onSaved }:{ visit:Visit;onClose:()=>void;onSaved:()=>void }) {
  const [f,setF]=useState({ subjective:'',objective:'',assessment:'',plan:'',therapies_used:[] as string[],labs_ordered:'',dietary_recommendations:'',lifestyle_recommendations:'',fee:'',extended_health_claimed:'',patient_paid:'',payment_method:'cash' });
  const [saving,setSaving]=useState(false);
  const upd=(k:string,v:string)=>setF(p=>({...p,[k]:v}));
  function toggleTherapy(t:string){ setF(p=>({...p,therapies_used:p.therapies_used.includes(t)?p.therapies_used.filter(x=>x!==t):[...p.therapies_used,t]})); }
  async function submit(){
    setSaving(true);
    try{
      await fetch(`/api/admin/naturopathic-clinic/visits/${visit.id}/complete`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...f,labs_ordered:f.labs_ordered?f.labs_ordered.split(',').map(s=>s.trim()):null,fee:f.fee?parseFloat(f.fee):null,extended_health_claimed:f.extended_health_claimed?parseFloat(f.extended_health_claimed):null,patient_paid:f.patient_paid?parseFloat(f.patient_paid):null})});
      onSaved();
    }finally{setSaving(false);}
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-1 text-slate-800">Complete Visit — SOAP Note</h2>
        <p className="text-sm text-gray-500 mb-4">{visit.first_name} {visit.last_name} — {visit.visit_type?.replace(/_/g,' ')} — {fmtDate(visit.visit_date)}</p>
        <div className="grid grid-cols-1 gap-3 text-sm">
          <div><label className="text-xs text-gray-500">S — Subjective</label><textarea className="w-full border rounded px-2 py-1.5 mt-0.5" rows={2} value={f.subjective} onChange={e=>upd('subjective',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">O — Objective</label><textarea className="w-full border rounded px-2 py-1.5 mt-0.5" rows={2} value={f.objective} onChange={e=>upd('objective',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">A — Assessment</label><textarea className="w-full border rounded px-2 py-1.5 mt-0.5" rows={2} value={f.assessment} onChange={e=>upd('assessment',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">P — Plan</label><textarea className="w-full border rounded px-2 py-1.5 mt-0.5" rows={2} value={f.plan} onChange={e=>upd('plan',e.target.value)}/></div>
          <div>
            <label className="text-xs text-gray-500">Therapies Used</label>
            <div className="flex flex-wrap gap-1 mt-1">
              {THERAPIES.map(t=>(
                <button key={t} onClick={()=>toggleTherapy(t)} className={`px-2 py-0.5 rounded text-xs border ${f.therapies_used.includes(t)?'bg-green-600 text-white border-green-600':'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>{t.replace(/_/g,' ')}</button>
              ))}
            </div>
          </div>
          <div><label className="text-xs text-gray-500">Labs Ordered (comma-separated)</label><input className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.labs_ordered} onChange={e=>upd('labs_ordered',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Dietary Recommendations</label><input className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.dietary_recommendations} onChange={e=>upd('dietary_recommendations',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Lifestyle Recommendations</label><input className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.lifestyle_recommendations} onChange={e=>upd('lifestyle_recommendations',e.target.value)}/></div>
          <div className="grid grid-cols-3 gap-3 border-t pt-3">
            <div><label className="text-xs text-gray-500">Fee ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.fee} onChange={e=>upd('fee',e.target.value)}/></div>
            <div><label className="text-xs text-gray-500">Extended Health ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.extended_health_claimed} onChange={e=>upd('extended_health_claimed',e.target.value)}/></div>
            <div><label className="text-xs text-gray-500">Patient Paid ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.patient_paid} onChange={e=>upd('patient_paid',e.target.value)}/></div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-1.5 rounded border text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-1.5 rounded bg-green-700 text-white text-sm font-medium hover:bg-green-800 disabled:opacity-50">{saving?'Saving…':'Complete Visit'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Mark Results Modal ────────────────────────────────────────────────────────
function MarkResultsModal({ lab, onClose, onSaved }:{ lab:LabOrder;onClose:()=>void;onSaved:()=>void }) {
  const [f,setF]=useState({ results_date:new Date().toISOString().slice(0,10), results_summary:'' });
  const [saving,setSaving]=useState(false);
  async function submit(){
    setSaving(true);
    try{
      await fetch(`/api/admin/naturopathic-clinic/lab-orders/${lab.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({results_received:true,...f})});
      onSaved();
    }finally{setSaving(false);}
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold mb-1 text-slate-800">Mark Results Received</h2>
        <p className="text-sm text-gray-500 mb-4">{lab.first_name} {lab.last_name} — {lab.lab_type?.replace(/_/g,' ')} — {lab.lab_company||'Lab'}</p>
        <div className="grid gap-3 text-sm">
          <div><label className="text-xs text-gray-500">Results Date</label><input type="date" className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.results_date} onChange={e=>setF(p=>({...p,results_date:e.target.value}))}/></div>
          <div><label className="text-xs text-gray-500">Results Summary</label><textarea className="w-full border rounded px-2 py-1.5 mt-0.5" rows={3} value={f.results_summary} onChange={e=>setF(p=>({...p,results_summary:e.target.value}))}/></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-1.5 rounded border text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-1.5 rounded bg-green-700 text-white text-sm font-medium hover:bg-green-800 disabled:opacity-50">{saving?'Saving…':'Mark Received'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function NaturopathicClinicPage() {
  const [tab,setTab]=useState<Tab>('dashboard');
  const [dash,setDash]=useState<Dashboard|null>(null);
  const [patients,setPatients]=useState<NdPatient[]>([]);
  const [visits,setVisits]=useState<Visit[]>([]);
  const [labs,setLabs]=useState<LabOrder[]>([]);
  const [protocols,setProtocols]=useState<Protocol[]>([]);
  const [showAddPatient,setShowAddPatient]=useState(false);
  const [completingVisit,setCompletingVisit]=useState<Visit|null>(null);
  const [markingLab,setMarkingLab]=useState<LabOrder|null>(null);
  const [labFilter,setLabFilter]=useState('false');
  const [aiMode,setAiMode]=useState<'wellness'|'soap'>('wellness');
  const [aiInput,setAiInput]=useState({ chief_complaint:'',health_goals:'',diet_type:'omnivore',stress_level:'5',sleep_hours:'7',exercise_frequency:'3x/week',visit_type:'follow_up',subjective:'',objective:'',assessment:'',plan:'',therapies_used:[] as string[],supplements_prescribed:'',labs_ordered:'' });
  const [aiResult,setAiResult]=useState('');
  const [aiLoading,setAiLoading]=useState(false);

  const loadDash=useCallback(async()=>{ const r=await fetch('/api/admin/naturopathic-clinic'); setDash(await r.json()); },[]);
  const loadPatients=useCallback(async()=>{ const r=await fetch('/api/admin/naturopathic-clinic/patients'); setPatients(await r.json()); },[]);
  const loadVisits=useCallback(async()=>{ const r=await fetch('/api/admin/naturopathic-clinic/visits'); setVisits(await r.json()); },[]);
  const loadLabs=useCallback(async()=>{ const r=await fetch(`/api/admin/naturopathic-clinic/lab-orders?results_received=${labFilter}`); setLabs(await r.json()); },[labFilter]);
  const loadProtocols=useCallback(async()=>{ const r=await fetch('/api/admin/naturopathic-clinic/supplement-protocols'); setProtocols(await r.json()); },[]);

  useEffect(()=>{ loadDash(); },[loadDash]);
  useEffect(()=>{ if(tab==='patients')loadPatients(); },[tab,loadPatients]);
  useEffect(()=>{ if(tab==='visits')loadVisits(); },[tab,loadVisits]);
  useEffect(()=>{ if(tab==='labs')loadLabs(); },[tab,loadLabs]);
  useEffect(()=>{ if(tab==='protocols')loadProtocols(); },[tab,loadProtocols]);

  async function runAI(){
    setAiLoading(true);setAiResult('');
    try{
      const endpoint=aiMode==='wellness'?'ai-wellness-plan':'ai-soap-note';
      const payload=aiMode==='wellness'?{chief_complaint:aiInput.chief_complaint,health_goals:aiInput.health_goals?aiInput.health_goals.split(','):[], diet_type:aiInput.diet_type,stress_level:aiInput.stress_level,sleep_hours:aiInput.sleep_hours,exercise_frequency:aiInput.exercise_frequency}:{visit_type:aiInput.visit_type,subjective:aiInput.subjective,objective:aiInput.objective,assessment:aiInput.assessment,plan:aiInput.plan,therapies_used:aiInput.therapies_used,supplements_prescribed:aiInput.supplements_prescribed?[{name:aiInput.supplements_prescribed}]:[],labs_ordered:aiInput.labs_ordered?aiInput.labs_ordered.split(','):[]};
      const r=await fetch(`/api/admin/naturopathic-clinic/${endpoint}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const d=await r.json();
      setAiResult(d.plan||d.note||'');
    }finally{setAiLoading(false);}
  }

  function toggleAiTherapy(t:string){ setAiInput(p=>({...p,therapies_used:p.therapies_used.includes(t)?p.therapies_used.filter(x=>x!==t):[...p.therapies_used,t]})); }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-green-800 text-white px-6 py-4">
        <h1 className="text-xl font-bold">Naturopathic Medicine Hub</h1>
        <p className="text-green-200 text-sm mt-0.5">Alberta Naturopathic Clinic Management</p>
      </div>
      <div className="bg-white border-b px-6 flex gap-1 overflow-x-auto">
        {TABS.map(t=>(
          <button key={t} onClick={()=>setTab(t)} className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${tab===t?'border-green-600 text-green-700':'border-transparent text-gray-500 hover:text-gray-700'}`}>{TAB_LABELS[t]}</button>
        ))}
      </div>

      <div className="p-6 max-w-7xl mx-auto">

        {/* DASHBOARD */}
        {tab==='dashboard'&&(
          <div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <KpiCard label="Active Patients" value={dash?.active_patients??'…'} color="green"/>
              <KpiCard label="Visits Today" value={dash?.visits_today??'…'} color="blue"/>
              <KpiCard label="Labs Pending Results" value={dash?.labs_pending_results??'…'} color="amber" sub={dash?.labs_pending_results?'Awaiting results':'All clear'}/>
              <KpiCard label="Active Protocols" value={dash?.supplements_protocols_active??'…'} color="teal"/>
              <KpiCard label="Revenue MTD" value={dash?fmtCad(dash.revenue_mtd):'…'} color="purple"/>
            </div>
            {dash&&dash.labs_pending_results>0&&(
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 flex items-center gap-3">
                <span className="text-amber-600 text-xl">⚠</span>
                <div>
                  <p className="font-semibold text-amber-800">{dash.labs_pending_results} Lab Orders Pending Results</p>
                  <button onClick={()=>setTab('labs')} className="text-sm text-amber-600 hover:underline">View lab orders →</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PATIENTS */}
        {tab==='patients'&&(
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-700">Patients ({patients.length})</h2>
              <button onClick={()=>setShowAddPatient(true)} className="px-4 py-2 bg-green-700 text-white rounded text-sm font-medium hover:bg-green-800">+ Add Patient</button>
            </div>
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>{['Patient','Diet','Stress','Chief Complaint','Naturopath','Insurance','Visits','Status'].map(h=><th key={h} className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {patients.map(p=>(
                    <tr key={p.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3"><p className="font-medium text-slate-800">{p.first_name} {p.last_name}</p><p className="text-xs text-gray-400">{p.phone}</p></td>
                      <td className="px-4 py-3"><Badge label={p.diet_type||'—'} color="green"/></td>
                      <td className="px-4 py-3"><StressBar level={p.stress_level}/></td>
                      <td className="px-4 py-3 max-w-xs"><p className="text-xs text-gray-600 truncate">{p.chief_complaint}</p></td>
                      <td className="px-4 py-3 text-xs text-gray-600">{p.naturopath||'—'}</td>
                      <td className="px-4 py-3">{p.extended_health_provider?<Badge label="Extended" color="blue"/>:<span className="text-xs text-gray-400">Cash</span>}</td>
                      <td className="px-4 py-3 text-center">{p.visit_count}</td>
                      <td className="px-4 py-3"><Badge label={p.status} color={p.status==='active'?'green':p.status==='discharged'?'gray':'amber'}/></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {showAddPatient&&<AddPatientModal onClose={()=>setShowAddPatient(false)} onSaved={()=>{setShowAddPatient(false);loadPatients();loadDash();}}/>}
          </div>
        )}

        {/* VISITS */}
        {tab==='visits'&&(
          <div>
            <h2 className="text-lg font-semibold text-slate-700 mb-4">Visits</h2>
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>{['Patient','Date/Time','Visit Type','Naturopath','Insurance','Fee','Status','Action'].map(h=><th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {visits.map(v=>(
                    <tr key={v.id} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-3"><p className="font-medium text-slate-800">{v.first_name} {v.last_name}</p></td>
                      <td className="px-3 py-3"><p className="text-xs">{fmtDate(v.visit_date)}</p><p className="text-xs text-gray-400">{v.visit_time?.slice(0,5)}</p></td>
                      <td className="px-3 py-3"><Badge label={v.visit_type} color={VISIT_TYPE_COLORS[v.visit_type]||'gray'}/></td>
                      <td className="px-3 py-3 text-xs">{v.naturopath}</td>
                      <td className="px-3 py-3">{v.extended_health_provider?<Badge label="Extended" color="blue"/>:<span className="text-xs text-gray-400">—</span>}</td>
                      <td className="px-3 py-3 text-xs">{v.fee?fmtCad(v.fee):'—'}</td>
                      <td className="px-3 py-3"><Badge label={v.status} color={v.status==='completed'?'green':v.status==='scheduled'?'blue':v.status==='cancelled'?'red':'amber'}/></td>
                      <td className="px-3 py-3">
                        {v.status==='scheduled'&&<button onClick={()=>setCompletingVisit(v)} className="text-xs text-green-700 hover:underline">Complete</button>}
                        {v.status==='scheduled'&&<button onClick={async()=>{await fetch(`/api/admin/naturopathic-clinic/visits/${v.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'cancelled'})});loadVisits();}} className="ml-2 text-xs text-red-500 hover:underline">Cancel</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {completingVisit&&<CompleteVisitModal visit={completingVisit} onClose={()=>setCompletingVisit(null)} onSaved={()=>{setCompletingVisit(null);loadVisits();loadDash();}}/>}
          </div>
        )}

        {/* LAB ORDERS */}
        {tab==='labs'&&(
          <div>
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
              <h2 className="text-lg font-semibold text-slate-700">Lab Orders</h2>
              <div className="flex gap-2">
                <select className="border rounded px-2 py-1.5 text-sm" value={labFilter} onChange={e=>{setLabFilter(e.target.value);}}>
                  <option value="false">Pending Results</option>
                  <option value="true">Results Received</option>
                </select>
              </div>
            </div>
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>{['Patient','Ordered','Type','Lab Company','Tests','Status','Action'].map(h=><th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {labs.map(l=>(
                    <tr key={l.id} className={`border-b hover:bg-gray-50 ${!l.results_received?'bg-amber-50':''}`}>
                      <td className="px-3 py-3"><p className="font-medium text-slate-800">{l.first_name} {l.last_name}</p></td>
                      <td className="px-3 py-3 text-xs">{fmtDate(l.ordered_date)}</td>
                      <td className="px-3 py-3"><Badge label={l.lab_type?.replace(/_/g,' ')} color="blue"/></td>
                      <td className="px-3 py-3 text-xs text-gray-600">{l.lab_company||'—'}</td>
                      <td className="px-3 py-3 max-w-48"><p className="text-xs text-gray-600 truncate">{l.tests_ordered?.join(', ')||'—'}</p></td>
                      <td className="px-3 py-3">{l.results_received?<Badge label="Received" color="green"/>:<Badge label="Pending" color="amber"/>}</td>
                      <td className="px-3 py-3">
                        {!l.results_received&&<button onClick={()=>setMarkingLab(l)} className="text-xs text-green-700 hover:underline">Mark Received</button>}
                        {l.results_received&&l.results_summary&&<span className="text-xs text-gray-500 truncate max-w-32 block">{l.results_summary.slice(0,50)}…</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {markingLab&&<MarkResultsModal lab={markingLab} onClose={()=>setMarkingLab(null)} onSaved={()=>{setMarkingLab(null);loadLabs();loadDash();}}/>}
          </div>
        )}

        {/* SUPPLEMENT PROTOCOLS */}
        {tab==='protocols'&&(
          <div>
            <h2 className="text-lg font-semibold text-slate-700 mb-4">Supplement Protocols ({protocols.length})</h2>
            <div className="grid gap-4">
              {protocols.map(p=>{
                const reviewDays=daysUntil(p.next_review_date);
                const supps:SupplementItem[]=Array.isArray(p.supplements)?p.supplements:[];
                return (
                  <div key={p.id} className="bg-white rounded-lg border p-4">
                    <div className="flex justify-between items-start flex-wrap gap-2 mb-3">
                      <div>
                        <p className="font-semibold text-slate-800">{p.first_name} {p.last_name}</p>
                        <p className="text-sm text-gray-500">{p.protocol_name||'Supplement Protocol'}</p>
                      </div>
                      <div className="flex gap-2 items-center">
                        <Badge label={p.status} color={p.status==='active'?'green':'gray'}/>
                        {reviewDays!==null&&<span className={`text-xs font-medium ${reviewDays<=7?'text-red-600':reviewDays<=30?'text-amber-600':'text-gray-500'}`}>Review in {reviewDays}d</span>}
                      </div>
                    </div>
                    {p.health_goals&&p.health_goals.length>0&&<p className="text-xs text-gray-500 mb-2">Goals: {p.health_goals.join(' · ')}</p>}
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-t">
                        <thead><tr className="bg-gray-50">{['Supplement','Brand','Dose','Frequency','Timing','Purpose'].map(h=><th key={h} className="text-left px-2 py-1 font-medium text-gray-500">{h}</th>)}</tr></thead>
                        <tbody>
                          {supps.map((s,i)=>(
                            <tr key={i} className="border-t">
                              <td className="px-2 py-1.5 font-medium text-slate-700">{s.name}</td>
                              <td className="px-2 py-1.5 text-gray-500">{s.brand||'—'}</td>
                              <td className="px-2 py-1.5">{s.dose}</td>
                              <td className="px-2 py-1.5">{s.frequency}</td>
                              <td className="px-2 py-1.5 text-gray-400">{s.timing||'—'}</td>
                              <td className="px-2 py-1.5 text-gray-500 max-w-32 truncate">{s.purpose||'—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
              {protocols.length===0&&<p className="text-sm text-gray-400">No supplement protocols yet.</p>}
            </div>
          </div>
        )}

        {/* AI ND TOOLS */}
        {tab==='ai'&&(
          <div className="max-w-3xl">
            <h2 className="text-lg font-semibold text-slate-700 mb-4">AI Naturopathic Tools</h2>
            <div className="bg-white rounded-lg border p-5">
              <div className="flex gap-2 mb-4">
                <button onClick={()=>setAiMode('wellness')} className={`px-4 py-2 rounded text-sm font-medium ${aiMode==='wellness'?'bg-green-700 text-white':'border text-gray-600 hover:bg-gray-50'}`}>Wellness Plan Generator</button>
                <button onClick={()=>setAiMode('soap')} className={`px-4 py-2 rounded text-sm font-medium ${aiMode==='soap'?'bg-green-700 text-white':'border text-gray-600 hover:bg-gray-50'}`}>SOAP Note Generator</button>
              </div>
              {aiMode==='wellness'&&(
                <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                  <div className="col-span-2"><label className="text-xs text-gray-500">Chief Complaint</label><input className="w-full border rounded px-2 py-1.5 mt-0.5" value={aiInput.chief_complaint} onChange={e=>setAiInput(p=>({...p,chief_complaint:e.target.value}))}/></div>
                  <div className="col-span-2"><label className="text-xs text-gray-500">Health Goals (comma-separated)</label><input className="w-full border rounded px-2 py-1.5 mt-0.5" value={aiInput.health_goals} onChange={e=>setAiInput(p=>({...p,health_goals:e.target.value}))}/></div>
                  <div><label className="text-xs text-gray-500">Diet Type</label><select className="w-full border rounded px-2 py-1.5 mt-0.5" value={aiInput.diet_type} onChange={e=>setAiInput(p=>({...p,diet_type:e.target.value}))}>{DIET_TYPES.map(d=><option key={d} value={d}>{d}</option>)}</select></div>
                  <div><label className="text-xs text-gray-500">Stress Level (1–10)</label><input type="number" min="1" max="10" className="w-full border rounded px-2 py-1.5 mt-0.5" value={aiInput.stress_level} onChange={e=>setAiInput(p=>({...p,stress_level:e.target.value}))}/></div>
                  <div><label className="text-xs text-gray-500">Sleep Hours/Night</label><input type="number" step="0.5" className="w-full border rounded px-2 py-1.5 mt-0.5" value={aiInput.sleep_hours} onChange={e=>setAiInput(p=>({...p,sleep_hours:e.target.value}))}/></div>
                  <div><label className="text-xs text-gray-500">Exercise Frequency</label><input className="w-full border rounded px-2 py-1.5 mt-0.5" value={aiInput.exercise_frequency} onChange={e=>setAiInput(p=>({...p,exercise_frequency:e.target.value}))}/></div>
                </div>
              )}
              {aiMode==='soap'&&(
                <div className="grid grid-cols-1 gap-3 text-sm mb-3">
                  <div><label className="text-xs text-gray-500">Visit Type</label><select className="w-full border rounded px-2 py-1.5 mt-0.5" value={aiInput.visit_type} onChange={e=>setAiInput(p=>({...p,visit_type:e.target.value}))}>{VISIT_TYPES.map(v=><option key={v} value={v}>{v.replace(/_/g,' ')}</option>)}</select></div>
                  <div><label className="text-xs text-gray-500">S — Subjective</label><textarea className="w-full border rounded px-2 py-1.5 mt-0.5" rows={2} value={aiInput.subjective} onChange={e=>setAiInput(p=>({...p,subjective:e.target.value}))}/></div>
                  <div><label className="text-xs text-gray-500">O — Objective</label><textarea className="w-full border rounded px-2 py-1.5 mt-0.5" rows={2} value={aiInput.objective} onChange={e=>setAiInput(p=>({...p,objective:e.target.value}))}/></div>
                  <div><label className="text-xs text-gray-500">A — Assessment</label><textarea className="w-full border rounded px-2 py-1.5 mt-0.5" rows={2} value={aiInput.assessment} onChange={e=>setAiInput(p=>({...p,assessment:e.target.value}))}/></div>
                  <div>
                    <label className="text-xs text-gray-500">Therapies Used</label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {THERAPIES.map(t=>(
                        <button key={t} onClick={()=>toggleAiTherapy(t)} className={`px-2 py-0.5 rounded text-xs border ${aiInput.therapies_used.includes(t)?'bg-green-600 text-white border-green-600':'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>{t.replace(/_/g,' ')}</button>
                      ))}
                    </div>
                  </div>
                  <div><label className="text-xs text-gray-500">Labs Ordered (comma-separated)</label><input className="w-full border rounded px-2 py-1.5 mt-0.5" value={aiInput.labs_ordered} onChange={e=>setAiInput(p=>({...p,labs_ordered:e.target.value}))}/></div>
                </div>
              )}
              <button onClick={runAI} disabled={aiLoading} className="px-5 py-2 bg-green-700 text-white rounded text-sm font-medium hover:bg-green-800 disabled:opacity-50">{aiLoading?'Generating…':'Generate with Ollama AI'}</button>
              {aiResult&&(
                <div className="mt-4 p-4 bg-gray-50 rounded border">
                  <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans">{aiResult}</pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ANALYTICS */}
        {tab==='analytics'&&(
          <div className="max-w-3xl">
            <h2 className="text-lg font-semibold text-slate-700 mb-4">Analytics</h2>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <KpiCard label="Active Patients" value={dash?.active_patients??'…'} color="green"/>
              <KpiCard label="Revenue MTD" value={dash?fmtCad(dash.revenue_mtd):'…'} color="purple"/>
              <KpiCard label="Labs Pending" value={dash?.labs_pending_results??'…'} color="amber"/>
              <KpiCard label="Active Protocols" value={dash?.supplements_protocols_active??'…'} color="teal"/>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <h3 className="font-semibold text-slate-700 mb-3">Visit Type Distribution</h3>
              {(() => {
                const counts:Record<string,number>={};
                visits.forEach(v=>{counts[v.visit_type]=(counts[v.visit_type]||0)+1;});
                return Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([type,count])=>(
                  <div key={type} className="flex items-center gap-2 mb-2">
                    <span className="text-xs w-36 text-gray-600">{type.replace(/_/g,' ')}</span>
                    <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
                      <div className="h-4 bg-green-500 rounded" style={{width:`${Math.round((count/visits.length)*100)}%`}}/>
                    </div>
                    <span className="text-xs text-gray-500 w-6 text-right">{count}</span>
                  </div>
                ));
              })()}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
