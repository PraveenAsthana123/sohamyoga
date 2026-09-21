'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard','patients','visits','treatment-plans','xrays','ai-soap','billing'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab,string> = { dashboard:'Dashboard', patients:'Patients', visits:'Visits', 'treatment-plans':'Treatment Plans', xrays:'X-Rays', 'ai-soap':'AI SOAP Generator', billing:'Billing' };

const CHIROPRACTORS = ['Dr. Sarah Kim DC','Dr. James Patel DC','Dr. Maria Santos DC'];
const ADJUSTMENTS = ['Diversified','Activator','Thompson Drop','Gonstead','Cox Flexion-Distraction','SOT','Toggle Recoil','NIMMO','ART','Graston'];
const MODALITIES = ['IFC','TENS','Ultrasound','Laser','Traction','Heat','Ice','EMS','Shockwave','Cupping'];
const REFERRAL_SOURCES = ['physician','self','mva','wca','extended_health','other'];
const ONSET_TYPES = ['sudden','gradual','mva','work_injury','sport','unknown'];
const VISIT_TYPES = ['initial_assessment','treatment','re_assessment','discharge','consultation'];
const PROGRESS_OPTIONS = ['improved','same','worse','resolved'];

interface Patient { id:number; first_name:string; last_name:string; phone:string; email:string; city:string; referral_source:string; primary_complaint:string; pain_level:number; chiropractor:string; status:string; mva_claim_number:string; wca_claim_number:string; extended_health_provider:string; coverage_per_visit:number; visit_count:number; created_at:string; }
interface Visit { id:number; patient_id:number; first_name:string; last_name:string; chiropractor:string; visit_date:string; visit_time:string; visit_type:string; status:string; primary_complaint:string; mva_claim_number:string; wca_claim_number:string; extended_health_provider:string; fee:number; pain_level_today:number; }
interface TreatmentPlan { id:number; patient_id:number; first_name:string; last_name:string; chiropractor:string; diagnosis:string; proposed_visits:number; completed_visits:number; duration_weeks:number; status:string; mva_pre_authorized:boolean; wca_pre_authorized:boolean; auth_visits:number; treatment_frequency?:string; }
interface Xray { id:number; patient_id:number; first_name:string; last_name:string; xray_date:string; views_taken:string[]; findings:string; subluxations:string[]; recommendations:string; chiropractor?:string; }
interface DashboardData { patients_active:number; visits_today:number; mva_wca_patients:number; coverage_claims_pending:number; revenue_mtd:number; today_schedule:Visit[]; }

function fmtCad(n:number) { return `$${Number(n??0).toLocaleString('en-CA',{minimumFractionDigits:0})}` }
function fmtDate(d:string) { return d?new Date(d).toLocaleDateString('en-CA'):'—' }
function fmtTime(t:string) { return t?t.slice(0,5):'—' }

function Badge({ label, color='gray' }:{ label:string; color?:string }) {
  const m:Record<string,string> = { blue:'bg-blue-100 text-blue-700', green:'bg-green-100 text-green-700', amber:'bg-amber-100 text-amber-700', red:'bg-red-100 text-red-700', purple:'bg-purple-100 text-purple-700', gray:'bg-gray-100 text-gray-700', teal:'bg-teal-100 text-teal-700', orange:'bg-orange-100 text-orange-700' };
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${m[color]??m.gray}`}>{label.replace(/_/g,' ')}</span>;
}
function KpiCard({ label, value, sub, color='blue' }:{ label:string; value:string|number; sub?:string; color?:string }) {
  const b:Record<string,string> = { blue:'border-l-4 border-blue-500 bg-blue-50', green:'border-l-4 border-green-500 bg-green-50', amber:'border-l-4 border-amber-500 bg-amber-50', red:'border-l-4 border-red-500 bg-red-50', purple:'border-l-4 border-purple-500 bg-purple-50' };
  return <div className={`rounded-lg p-4 ${b[color]??b.blue}`}><p className="text-sm text-gray-500">{label}</p><p className="text-2xl font-bold mt-1">{value}</p>{sub&&<p className="text-xs text-gray-400 mt-1">{sub}</p>}</div>;
}
function statusColor(s:string) { const m:Record<string,string>={scheduled:'blue',confirmed:'teal',in_progress:'amber',completed:'green',cancelled:'red',no_show:'gray',active:'green',discharged:'purple',on_hold:'amber'}; return m[s]??'gray'; }
function referralColor(s:string) { const m:Record<string,string>={physician:'blue',self:'green',mva:'red',wca:'orange',extended_health:'purple',other:'gray'}; return m[s]??'gray'; }

// ─── Add Patient Modal ────────────────────────────────────────────────────────
function AddPatientModal({ onClose, onSaved }:{ onClose:()=>void; onSaved:()=>void }) {
  const [form,setForm] = useState({ first_name:'',last_name:'',date_of_birth:'',phone:'',email:'',address:'',city:'Calgary',province:'AB',referral_source:'self',primary_complaint:'',pain_level:'5',duration_of_complaint:'',onset_type:'gradual',previous_chiro_care:false,chiropractor:CHIROPRACTORS[0],mva_claim_number:'',wca_claim_number:'',extended_health_provider:'',extended_health_id:'',coverage_per_visit:'',status:'active' });
  const [saving,setSaving] = useState(false);
  const f = (k:string,v:string|boolean) => setForm(p=>({...p,[k]:v}));
  async function submit() {
    if(!form.first_name||!form.last_name||!form.phone||!form.primary_complaint)return;
    setSaving(true);
    try { await fetch('/api/admin/chiropractic-clinic/patients',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,pain_level:parseInt(form.pain_level)||null,coverage_per_visit:form.coverage_per_visit?parseFloat(form.coverage_per_visit):null})}); onSaved(); } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-4 text-slate-800">New Patient Intake</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500">First Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.first_name} onChange={e=>f('first_name',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Last Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.last_name} onChange={e=>f('last_name',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Date of Birth</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.date_of_birth} onChange={e=>f('date_of_birth',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Phone *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.phone} onChange={e=>f('phone',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Email</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.email} onChange={e=>f('email',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Referral Source</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.referral_source} onChange={e=>f('referral_source',e.target.value)}>{REFERRAL_SOURCES.map(r=><option key={r} value={r}>{r.replace(/_/g,' ')}</option>)}</select></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Primary Complaint *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.primary_complaint} onChange={e=>f('primary_complaint',e.target.value)} placeholder="e.g. Low back pain, neck pain, headaches" /></div>
          <div><label className="text-xs text-gray-500">Pain Level (0-10)</label><input type="number" min={0} max={10} className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.pain_level} onChange={e=>f('pain_level',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Duration of Complaint</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.duration_of_complaint} onChange={e=>f('duration_of_complaint',e.target.value)} placeholder="e.g. 3 weeks, 6 months" /></div>
          <div><label className="text-xs text-gray-500">Onset Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.onset_type} onChange={e=>f('onset_type',e.target.value)}>{ONSET_TYPES.map(o=><option key={o} value={o}>{o.replace(/_/g,' ')}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Chiropractor</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.chiropractor} onChange={e=>f('chiropractor',e.target.value)}>{CHIROPRACTORS.map(c=><option key={c}>{c}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">MVA Claim #</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5 font-mono" value={form.mva_claim_number} onChange={e=>f('mva_claim_number',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">WCA Claim #</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5 font-mono" value={form.wca_claim_number} onChange={e=>f('wca_claim_number',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Extended Health Provider</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.extended_health_provider} onChange={e=>f('extended_health_provider',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Coverage Per Visit ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.coverage_per_visit} onChange={e=>f('coverage_per_visit',e.target.value)} /></div>
          <div className="flex items-center gap-2 mt-2"><input type="checkbox" id="prev_chiro" checked={form.previous_chiro_care} onChange={e=>f('previous_chiro_care',e.target.checked)} /><label htmlFor="prev_chiro" className="text-sm text-gray-700">Previous chiropractic care</label></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{saving?'Saving…':'Add Patient'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Schedule Visit Modal ─────────────────────────────────────────────────────
function ScheduleVisitModal({ patients, onClose, onSaved }:{ patients:Patient[]; onClose:()=>void; onSaved:()=>void }) {
  const [form,setForm] = useState({ patient_id:'', chiropractor:CHIROPRACTORS[0], visit_date:new Date().toISOString().split('T')[0], visit_time:'09:00', visit_type:'treatment', fee:'85' });
  const [saving,setSaving] = useState(false);
  const f = (k:string,v:string) => setForm(p=>({...p,[k]:v}));
  async function submit() {
    if(!form.patient_id||!form.visit_date||!form.visit_time)return;
    setSaving(true);
    try { await fetch('/api/admin/chiropractic-clinic/visits',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,patient_id:parseInt(form.patient_id),fee:parseFloat(form.fee)||null})}); onSaved(); } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold mb-4 text-slate-800">Schedule Visit</h2>
        <div className="space-y-3">
          <div><label className="text-xs text-gray-500">Patient *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.patient_id} onChange={e=>f('patient_id',e.target.value)}><option value="">Select patient…</option>{patients.map(p=><option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Chiropractor</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.chiropractor} onChange={e=>f('chiropractor',e.target.value)}>{CHIROPRACTORS.map(c=><option key={c}>{c}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs text-gray-500">Date</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.visit_date} onChange={e=>f('visit_date',e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Time</label><input type="time" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.visit_time} onChange={e=>f('visit_time',e.target.value)} /></div>
          </div>
          <div><label className="text-xs text-gray-500">Visit Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.visit_type} onChange={e=>f('visit_type',e.target.value)}>{VISIT_TYPES.map(t=><option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Fee ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.fee} onChange={e=>f('fee',e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{saving?'Saving…':'Schedule'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Complete Visit Modal ─────────────────────────────────────────────────────
function CompleteVisitModal({ visit, onClose, onSaved }:{ visit:Visit; onClose:()=>void; onSaved:()=>void }) {
  const [form,setForm] = useState({ subjective:'', pain_level_today:'', objective:'', range_of_motion:'', assessment:'', progress:'improved', plan:'', adjustments_performed:[] as string[], modalities_used:[] as string[], home_exercises_given:'', fee:visit.fee?.toString()||'85', extended_health_claimed:'', mva_claimed:'', wca_claimed:'', patient_paid:'', payment_method:'cash' });
  const [saving,setSaving] = useState(false);
  const f = (k:string,v:string) => setForm(p=>({...p,[k]:v}));
  const toggle = (arr:string[],k:'adjustments_performed'|'modalities_used',val:string) => setForm(p=>({...p,[k]:arr.includes(val)?arr.filter(x=>x!==val):[...arr,val]}));
  async function submit() {
    setSaving(true);
    try { await fetch(`/api/admin/chiropractic-clinic/visits/${visit.id}/complete`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,pain_level_today:parseInt(form.pain_level_today)||null,fee:parseFloat(form.fee)||null,extended_health_claimed:form.extended_health_claimed?parseFloat(form.extended_health_claimed):null,mva_claimed:form.mva_claimed?parseFloat(form.mva_claimed):null,wca_claimed:form.wca_claimed?parseFloat(form.wca_claimed):null,patient_paid:form.patient_paid?parseFloat(form.patient_paid):null})}); onSaved(); } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-1 text-slate-800">Complete Visit — SOAP</h2>
        <p className="text-sm text-gray-500 mb-4">{visit.first_name} {visit.last_name} · {fmtDate(visit.visit_date)} {fmtTime(visit.visit_time)}</p>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2"><label className="text-xs font-semibold text-blue-700">S — Subjective</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} placeholder="Patient's reported symptoms…" value={form.subjective} onChange={e=>f('subjective',e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Pain Level Today (0-10)</label><input type="number" min={0} max={10} className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.pain_level_today} onChange={e=>f('pain_level_today',e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Progress vs Last</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.progress} onChange={e=>f('progress',e.target.value)}>{PROGRESS_OPTIONS.map(p=><option key={p}>{p}</option>)}</select></div>
          </div>
          <div><label className="text-xs font-semibold text-green-700">O — Objective</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} placeholder="Postural analysis, palpation findings…" value={form.objective} onChange={e=>f('objective',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Range of Motion</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" placeholder="e.g. Cervical flexion 40°, rotation R 60° L 55°" value={form.range_of_motion} onChange={e=>f('range_of_motion',e.target.value)} /></div>
          <div><label className="text-xs font-semibold text-amber-700">A — Assessment</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} placeholder="Clinical impression, diagnosis…" value={form.assessment} onChange={e=>f('assessment',e.target.value)} /></div>
          <div><label className="text-xs font-semibold text-purple-700">P — Plan</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} placeholder="Treatment plan, follow-up…" value={form.plan} onChange={e=>f('plan',e.target.value)} /></div>
          <div>
            <label className="text-xs text-gray-500">Adjustments Performed</label>
            <div className="flex flex-wrap gap-1.5 mt-1">{ADJUSTMENTS.map(a=><button key={a} type="button" onClick={()=>toggle(form.adjustments_performed,'adjustments_performed',a)} className={`px-2 py-0.5 rounded text-xs border ${form.adjustments_performed.includes(a)?'bg-blue-600 text-white border-blue-600':'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>{a}</button>)}</div>
          </div>
          <div>
            <label className="text-xs text-gray-500">Modalities Used</label>
            <div className="flex flex-wrap gap-1.5 mt-1">{MODALITIES.map(m=><button key={m} type="button" onClick={()=>toggle(form.modalities_used,'modalities_used',m)} className={`px-2 py-0.5 rounded text-xs border ${form.modalities_used.includes(m)?'bg-green-600 text-white border-green-600':'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>{m}</button>)}</div>
          </div>
          <div><label className="text-xs text-gray-500">Home Exercises Given</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.home_exercises_given} onChange={e=>f('home_exercises_given',e.target.value)} /></div>
          <div className="border-t pt-3">
            <p className="text-xs font-semibold text-gray-600 mb-2">Billing Breakdown</p>
            <div className="grid grid-cols-3 gap-2">
              <div><label className="text-xs text-gray-500">Total Fee ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.fee} onChange={e=>f('fee',e.target.value)} /></div>
              <div><label className="text-xs text-gray-500">Extended Health ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.extended_health_claimed} onChange={e=>f('extended_health_claimed',e.target.value)} /></div>
              <div><label className="text-xs text-gray-500">MVA ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.mva_claimed} onChange={e=>f('mva_claimed',e.target.value)} /></div>
              <div><label className="text-xs text-gray-500">WCA ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.wca_claimed} onChange={e=>f('wca_claimed',e.target.value)} /></div>
              <div><label className="text-xs text-gray-500">Patient Paid ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.patient_paid} onChange={e=>f('patient_paid',e.target.value)} /></div>
              <div><label className="text-xs text-gray-500">Payment Method</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.payment_method} onChange={e=>f('payment_method',e.target.value)}>{['cash','debit','credit','insurance','tap'].map(m=><option key={m}>{m}</option>)}</select></div>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">{saving?'Saving…':'Complete Visit'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Treatment Plan Modal ─────────────────────────────────────────────────────
function TreatmentPlanModal({ patients, onClose, onSaved }:{ patients:Patient[]; onClose:()=>void; onSaved:()=>void }) {
  const [form,setForm] = useState({ patient_id:'', chiropractor:CHIROPRACTORS[0], diagnosis:'', treatment_frequency:'3x/week', proposed_visits:'12', duration_weeks:'6', goals:'', mva_pre_authorized:false, wca_pre_authorized:false, auth_visits:'' });
  const [saving,setSaving] = useState(false);
  const f = (k:string,v:string|boolean) => setForm(p=>({...p,[k]:v}));
  async function submit() {
    if(!form.patient_id||!form.diagnosis)return;
    setSaving(true);
    try { await fetch('/api/admin/chiropractic-clinic/treatment-plans',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,patient_id:parseInt(form.patient_id),proposed_visits:parseInt(form.proposed_visits)||null,duration_weeks:parseInt(form.duration_weeks)||null,auth_visits:form.auth_visits?parseInt(form.auth_visits):null})}); onSaved(); } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-4 text-slate-800">New Treatment Plan</h2>
        <div className="space-y-3">
          <div><label className="text-xs text-gray-500">Patient *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.patient_id} onChange={e=>f('patient_id',e.target.value)}><option value="">Select…</option>{patients.map(p=><option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Chiropractor</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.chiropractor} onChange={e=>f('chiropractor',e.target.value)}>{CHIROPRACTORS.map(c=><option key={c}>{c}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Diagnosis *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.diagnosis} onChange={e=>f('diagnosis',e.target.value)} /></div>
          <div className="grid grid-cols-3 gap-2">
            <div><label className="text-xs text-gray-500">Frequency</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.treatment_frequency} onChange={e=>f('treatment_frequency',e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Visits</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.proposed_visits} onChange={e=>f('proposed_visits',e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Weeks</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.duration_weeks} onChange={e=>f('duration_weeks',e.target.value)} /></div>
          </div>
          <div><label className="text-xs text-gray-500">Goals</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.goals} onChange={e=>f('goals',e.target.value)} /></div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.mva_pre_authorized} onChange={e=>f('mva_pre_authorized',e.target.checked)} />MVA Pre-authorized</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.wca_pre_authorized} onChange={e=>f('wca_pre_authorized',e.target.checked)} />WCA Pre-authorized</label>
          </div>
          {(form.mva_pre_authorized||form.wca_pre_authorized)&&<div><label className="text-xs text-gray-500">Authorized Visits</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.auth_visits} onChange={e=>f('auth_visits',e.target.value)} /></div>}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{saving?'Saving…':'Create Plan'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ChiropracticClinicPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [dashboard, setDashboard] = useState<DashboardData|null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [plans, setPlans] = useState<TreatmentPlan[]>([]);
  const [xrays, setXrays] = useState<Xray[]>([]);
  const [stats, setStats] = useState<Record<string,unknown>|null>(null);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterChiro, setFilterChiro] = useState('');
  const [search, setSearch] = useState('');
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [showScheduleVisit, setShowScheduleVisit] = useState(false);
  const [showCompleteVisit, setShowCompleteVisit] = useState<Visit|null>(null);
  const [showTreatmentPlan, setShowTreatmentPlan] = useState(false);
  const [aiVisitId, setAiVisitId] = useState('');
  const [aiPromptData, setAiPromptData] = useState({ primary_complaint:'', subjective:'', pain_level_today:'5', progress:'improved', adjustments_performed:[] as string[], modalities_used:[] as string[], visit_type:'treatment' });
  const [soapNote, setSoapNote] = useState('');
  const [soapLoading, setSoapLoading] = useState(false);

  const loadDashboard = useCallback(async()=>{ const r=await fetch('/api/admin/chiropractic-clinic'); const d=await r.json(); setDashboard(d); },[]);
  const loadPatients = useCallback(async()=>{ const p=new URLSearchParams(); if(search)p.set('search',search); const r=await fetch('/api/admin/chiropractic-clinic/patients?'+p); setPatients(await r.json()); },[search]);
  const loadVisits = useCallback(async()=>{ const p=new URLSearchParams(); if(filterDate)p.set('date',filterDate); if(filterChiro)p.set('chiropractor',filterChiro); const r=await fetch('/api/admin/chiropractic-clinic/visits?'+p); setVisits(await r.json()); },[filterDate,filterChiro]);
  const loadPlans = useCallback(async()=>{ const r=await fetch('/api/admin/chiropractic-clinic/treatment-plans'); setPlans(await r.json()); },[]);
  const loadXrays = useCallback(async()=>{ const r=await fetch('/api/admin/chiropractic-clinic/xrays'); setXrays(await r.json()); },[]);
  const loadStats = useCallback(async()=>{ const r=await fetch('/api/admin/chiropractic-clinic/stats'); setStats(await r.json()); },[]);

  useEffect(()=>{ loadDashboard(); },[loadDashboard]);
  useEffect(()=>{ if(tab==='patients')loadPatients(); },[tab,loadPatients]);
  useEffect(()=>{ if(tab==='visits')loadVisits(); },[tab,loadVisits]);
  useEffect(()=>{ if(tab==='treatment-plans')loadPlans(); },[tab,loadPlans]);
  useEffect(()=>{ if(tab==='xrays')loadXrays(); },[tab,loadXrays]);
  useEffect(()=>{ if(tab==='billing')loadStats(); },[tab,loadStats]);

  async function generateSoap() {
    setSoapLoading(true); setSoapNote('');
    try { const r=await fetch('/api/admin/chiropractic-clinic/ai-soap',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(aiPromptData)}); const d=await r.json(); setSoapNote(d.soap); } finally { setSoapLoading(false); }
  }
  async function patchVisitStatus(id:number, status:string) { await fetch(`/api/admin/chiropractic-clinic/visits/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})}); loadVisits(); }

  const toggleAiAdj = (a:string) => setAiPromptData(p=>({...p,adjustments_performed:p.adjustments_performed.includes(a)?p.adjustments_performed.filter(x=>x!==a):[...p.adjustments_performed,a]}));
  const toggleAiMod = (m:string) => setAiPromptData(p=>({...p,modalities_used:p.modalities_used.includes(m)?p.modalities_used.filter(x=>x!==m):[...p.modalities_used,m]}));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Chiropractic Clinic Hub</h1>
          <p className="text-sm text-gray-500">Alberta chiropractic patient & visit management</p>
        </div>
        <div className="flex gap-2">
          {tab==='patients'&&<button onClick={()=>setShowAddPatient(true)} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">+ New Patient</button>}
          {tab==='visits'&&<button onClick={()=>setShowScheduleVisit(true)} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">+ Schedule Visit</button>}
          {tab==='treatment-plans'&&<button onClick={()=>setShowTreatmentPlan(true)} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">+ New Plan</button>}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b px-6">
        <div className="flex gap-1 overflow-x-auto">{TABS.map(t=><button key={t} onClick={()=>setTab(t)} className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab===t?'border-blue-600 text-blue-600':'border-transparent text-gray-500 hover:text-gray-700'}`}>{TAB_LABELS[t]}</button>)}</div>
      </div>

      <div className="p-6">
        {/* Dashboard */}
        {tab==='dashboard'&&<div className="space-y-6">
          <div className="grid grid-cols-5 gap-4">
            <KpiCard label="Active Patients" value={dashboard?.patients_active??'—'} color="blue" />
            <KpiCard label="Visits Today" value={dashboard?.visits_today??'—'} color="green" />
            <KpiCard label="MVA/WCA Patients" value={dashboard?.mva_wca_patients??'—'} color="red" />
            <KpiCard label="Claims Pending" value={dashboard?.coverage_claims_pending??'—'} color="amber" />
            <KpiCard label="Revenue MTD" value={dashboard?.revenue_mtd!=null?fmtCad(dashboard.revenue_mtd):'—'} color="purple" />
          </div>
          <div className="bg-white rounded-xl border p-4">
            <h2 className="font-semibold text-slate-700 mb-3">Today's Schedule</h2>
            {!dashboard?.today_schedule?.length&&<p className="text-gray-400 text-sm">No visits scheduled for today.</p>}
            <div className="space-y-2">
              {dashboard?.today_schedule?.map((v)=>(
                <div key={v.id} className="flex items-center gap-4 p-3 rounded-lg bg-gray-50 border">
                  <span className="text-sm font-mono font-medium w-14 text-gray-700">{fmtTime(v.visit_time)}</span>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{v.first_name} {v.last_name}</p>
                    <p className="text-xs text-gray-500">{v.primary_complaint} · {v.chiropractor}</p>
                  </div>
                  <div className="flex gap-1">
                    {v.mva_claim_number&&<Badge label="MVA" color="red" />}
                    {v.wca_claim_number&&<Badge label="WCA" color="orange" />}
                    {v.extended_health_provider&&<Badge label={v.extended_health_provider} color="purple" />}
                  </div>
                  <Badge label={v.status} color={statusColor(v.status)} />
                </div>
              ))}
            </div>
          </div>
        </div>}

        {/* Patients */}
        {tab==='patients'&&<div className="space-y-4">
          <input className="w-full max-w-xs border rounded-lg px-3 py-2 text-sm" placeholder="Search patients…" value={search} onChange={e=>{setSearch(e.target.value);loadPatients();}} />
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b"><tr>{['Name','Phone','Complaint','Pain','Referral','Chiropractor','Coverage','Visits','Status'].map(h=><th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr></thead>
              <tbody>
                {patients.map(p=>(
                  <tr key={p.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{p.first_name} {p.last_name}</td>
                    <td className="px-4 py-3 text-gray-600">{p.phone}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[180px] truncate">{p.primary_complaint}</td>
                    <td className="px-4 py-3"><span className={`font-bold ${p.pain_level>=7?'text-red-600':p.pain_level>=4?'text-amber-600':'text-green-600'}`}>{p.pain_level??'—'}/10</span></td>
                    <td className="px-4 py-3"><Badge label={p.referral_source||'—'} color={referralColor(p.referral_source)} /></td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{p.chiropractor||'—'}</td>
                    <td className="px-4 py-3">
                      {p.mva_claim_number&&<Badge label="MVA" color="red" />}
                      {p.wca_claim_number&&<Badge label="WCA" color="orange" />}
                      {p.extended_health_provider&&<Badge label={p.extended_health_provider} color="purple" />}
                      {p.coverage_per_visit&&<span className="ml-1 text-xs text-gray-500">{fmtCad(p.coverage_per_visit)}/visit</span>}
                    </td>
                    <td className="px-4 py-3 text-center font-medium">{p.visit_count}</td>
                    <td className="px-4 py-3"><Badge label={p.status} color={statusColor(p.status)} /></td>
                  </tr>
                ))}
                {!patients.length&&<tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No patients found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>}

        {/* Visits */}
        {tab==='visits'&&<div className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <input type="date" className="border rounded-lg px-3 py-2 text-sm" value={filterDate} onChange={e=>{setFilterDate(e.target.value);setTimeout(loadVisits,100);}} />
            <select className="border rounded-lg px-3 py-2 text-sm" value={filterChiro} onChange={e=>{setFilterChiro(e.target.value);setTimeout(loadVisits,100);}}>
              <option value="">All chiropractors</option>{CHIROPRACTORS.map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b"><tr>{['Time','Patient','Type','Chiropractor','Pain','Billing','Status','Action'].map(h=><th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr></thead>
              <tbody>
                {visits.map(v=>(
                  <tr key={v.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-sm font-medium">{fmtTime(v.visit_time)}</td>
                    <td className="px-4 py-3 font-medium">{v.first_name} {v.last_name}</td>
                    <td className="px-4 py-3"><Badge label={v.visit_type} color="blue" /></td>
                    <td className="px-4 py-3 text-xs text-gray-600">{v.chiropractor}</td>
                    <td className="px-4 py-3"><span className={`font-bold ${(v.pain_level_today??10)>=7?'text-red-600':(v.pain_level_today??10)>=4?'text-amber-600':'text-green-600'}`}>{v.pain_level_today!=null?`${v.pain_level_today}/10`:'—'}</span></td>
                    <td className="px-4 py-3 text-xs text-gray-600">{v.fee?fmtCad(v.fee):'—'}</td>
                    <td className="px-4 py-3"><Badge label={v.status} color={statusColor(v.status)} /></td>
                    <td className="px-4 py-3">
                      {v.status==='scheduled'&&<div className="flex gap-1">
                        <button onClick={()=>patchVisitStatus(v.id,'confirmed')} className="px-2 py-1 text-xs bg-teal-50 text-teal-700 rounded border border-teal-200 hover:bg-teal-100">Confirm</button>
                        <button onClick={()=>setShowCompleteVisit(v)} className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded border border-green-200 hover:bg-green-100">Complete</button>
                        <button onClick={()=>patchVisitStatus(v.id,'no_show')} className="px-2 py-1 text-xs bg-gray-50 text-gray-600 rounded border hover:bg-gray-100">No Show</button>
                      </div>}
                      {v.status==='confirmed'&&<button onClick={()=>setShowCompleteVisit(v)} className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded border border-green-200 hover:bg-green-100">Complete</button>}
                    </td>
                  </tr>
                ))}
                {!visits.length&&<tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No visits for selected date/filter.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>}

        {/* Treatment Plans */}
        {tab==='treatment-plans'&&<div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.map(plan=>(
              <div key={plan.id} className="bg-white rounded-xl border p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-slate-800">{plan.first_name} {plan.last_name}</p>
                    <p className="text-xs text-gray-500">{plan.chiropractor}</p>
                  </div>
                  <Badge label={plan.status} color={statusColor(plan.status)} />
                </div>
                <p className="text-sm text-gray-700 font-medium">{plan.diagnosis}</p>
                <p className="text-xs text-gray-500">{plan.treatment_frequency} · {plan.duration_weeks} weeks</p>
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Visit Progress</span>
                    <span>{plan.completed_visits||0} / {plan.proposed_visits||'?'}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full" style={{width:`${Math.min(100,((plan.completed_visits||0)/(plan.proposed_visits||1))*100)}%`}} />
                  </div>
                </div>
                {(plan.mva_pre_authorized||plan.wca_pre_authorized)&&(
                  <div className="flex gap-1">
                    {plan.mva_pre_authorized&&<Badge label={`MVA auth: ${plan.auth_visits||'?'} visits`} color="red" />}
                    {plan.wca_pre_authorized&&<Badge label={`WCA auth: ${plan.auth_visits||'?'} visits`} color="orange" />}
                  </div>
                )}
              </div>
            ))}
            {!plans.length&&<p className="text-gray-400 text-sm col-span-3">No treatment plans found.</p>}
          </div>
        </div>}

        {/* X-Rays */}
        {tab==='xrays'&&<div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {xrays.map(x=>(
              <div key={x.id} className="bg-white rounded-xl border p-4 space-y-2">
                <div className="flex justify-between">
                  <div>
                    <p className="font-semibold">{x.first_name} {x.last_name}</p>
                    <p className="text-xs text-gray-500">{fmtDate(x.xray_date)} · {x.chiropractor}</p>
                  </div>
                  <div className="flex gap-1">{(x.views_taken||[]).map(v=><Badge key={v} label={v} color="gray" />)}</div>
                </div>
                {x.findings&&<p className="text-sm"><span className="font-medium">Findings:</span> {x.findings}</p>}
                {x.subluxations&&x.subluxations.length>0&&<p className="text-sm"><span className="font-medium">Subluxations:</span> {x.subluxations.join(', ')}</p>}
                {x.recommendations&&<p className="text-sm text-blue-700">{x.recommendations}</p>}
              </div>
            ))}
            {!xrays.length&&<p className="text-gray-400 text-sm">No x-ray records found.</p>}
          </div>
        </div>}

        {/* AI SOAP Generator */}
        {tab==='ai-soap'&&<div className="max-w-2xl space-y-4">
          <div className="bg-white rounded-xl border p-5 space-y-4">
            <h2 className="font-semibold text-slate-800">AI SOAP Note Generator</h2>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-gray-500">Visit Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiPromptData.visit_type} onChange={e=>setAiPromptData(p=>({...p,visit_type:e.target.value}))}>{VISIT_TYPES.map(t=><option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}</select></div>
              <div><label className="text-xs text-gray-500">Pain Level Today (0-10)</label><input type="number" min={0} max={10} className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiPromptData.pain_level_today} onChange={e=>setAiPromptData(p=>({...p,pain_level_today:e.target.value}))} /></div>
              <div className="col-span-2"><label className="text-xs text-gray-500">Primary Complaint</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiPromptData.primary_complaint} onChange={e=>setAiPromptData(p=>({...p,primary_complaint:e.target.value}))} /></div>
              <div className="col-span-2"><label className="text-xs text-gray-500">Subjective (patient's words)</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={aiPromptData.subjective} onChange={e=>setAiPromptData(p=>({...p,subjective:e.target.value}))} /></div>
              <div><label className="text-xs text-gray-500">Progress</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiPromptData.progress} onChange={e=>setAiPromptData(p=>({...p,progress:e.target.value}))}>{PROGRESS_OPTIONS.map(x=><option key={x}>{x}</option>)}</select></div>
            </div>
            <div>
              <label className="text-xs text-gray-500">Adjustments</label>
              <div className="flex flex-wrap gap-1.5 mt-1">{ADJUSTMENTS.map(a=><button key={a} type="button" onClick={()=>toggleAiAdj(a)} className={`px-2 py-0.5 rounded text-xs border ${aiPromptData.adjustments_performed.includes(a)?'bg-blue-600 text-white border-blue-600':'border-gray-300 text-gray-600'}`}>{a}</button>)}</div>
            </div>
            <div>
              <label className="text-xs text-gray-500">Modalities</label>
              <div className="flex flex-wrap gap-1.5 mt-1">{MODALITIES.map(m=><button key={m} type="button" onClick={()=>toggleAiMod(m)} className={`px-2 py-0.5 rounded text-xs border ${aiPromptData.modalities_used.includes(m)?'bg-green-600 text-white border-green-600':'border-gray-300 text-gray-600'}`}>{m}</button>)}</div>
            </div>
            <button onClick={generateSoap} disabled={soapLoading} className="w-full py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">{soapLoading?'Generating SOAP…':'Generate SOAP Note'}</button>
            {soapNote&&<div className="bg-gray-50 rounded-lg p-4 border"><pre className="text-sm whitespace-pre-wrap font-mono text-slate-700">{soapNote}</pre></div>}
          </div>
        </div>}

        {/* Billing */}
        {tab==='billing'&&<div className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            {!!stats?.payer_breakdown&&(() => {
              const pb = stats.payer_breakdown as Record<string,number>;
              return <>
                <KpiCard label="Cash/Patient" value={fmtCad(pb.cash_total||0)} color="green" />
                <KpiCard label="Extended Health" value={fmtCad(pb.extended_total||0)} color="blue" />
                <KpiCard label="MVA Claims" value={fmtCad(pb.mva_total||0)} color="red" />
                <KpiCard label="WCA Claims" value={fmtCad(pb.wca_total||0)} color="orange" />
              </>;
            })()}
          </div>
          {!!stats?.visit_trend&&<div className="bg-white rounded-xl border p-4">
            <h2 className="font-semibold text-slate-700 mb-3">Monthly Revenue Trend</h2>
            <div className="space-y-2">{(stats.visit_trend as Array<{month:string;visits:number;revenue:number}>).map(row=>(
              <div key={row.month} className="flex items-center gap-3">
                <span className="text-sm text-gray-500 w-20">{row.month}</span>
                <div className="flex-1 bg-gray-200 rounded-full h-3"><div className="bg-blue-500 h-3 rounded-full" style={{width:`${Math.min(100,(row.revenue/10000)*100)}%`}} /></div>
                <span className="text-sm font-medium w-20 text-right">{fmtCad(row.revenue)}</span>
                <span className="text-xs text-gray-400 w-16">{row.visits} visits</span>
              </div>
            ))}</div>
          </div>}
          {!!stats?.diagnosis_breakdown&&<div className="bg-white rounded-xl border p-4">
            <h2 className="font-semibold text-slate-700 mb-3">Top Diagnoses / Complaints</h2>
            <div className="space-y-1.5">{(stats.diagnosis_breakdown as Array<{primary_complaint:string;count:number}>).map(row=>(
              <div key={row.primary_complaint} className="flex items-center gap-3">
                <span className="text-sm text-gray-700 flex-1">{row.primary_complaint}</span>
                <span className="text-sm font-medium text-blue-700">{row.count} patients</span>
              </div>
            ))}</div>
          </div>}
        </div>}
      </div>

      {showAddPatient&&<AddPatientModal onClose={()=>setShowAddPatient(false)} onSaved={()=>{setShowAddPatient(false);loadPatients();}} />}
      {showScheduleVisit&&<ScheduleVisitModal patients={patients.length?patients:[]} onClose={()=>setShowScheduleVisit(false)} onSaved={()=>{setShowScheduleVisit(false);loadVisits();loadDashboard();}} />}
      {showCompleteVisit&&<CompleteVisitModal visit={showCompleteVisit} onClose={()=>setShowCompleteVisit(null)} onSaved={()=>{setShowCompleteVisit(null);loadVisits();loadDashboard();}} />}
      {showTreatmentPlan&&<TreatmentPlanModal patients={patients} onClose={()=>setShowTreatmentPlan(false)} onSaved={()=>{setShowTreatmentPlan(false);loadPlans();}} />}
    </div>
  );
}
