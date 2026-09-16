'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard','patients','treatments','plans','herbal','ai','billing'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = { dashboard: 'Dashboard', patients: 'Patients', treatments: 'Treatments', plans: 'Treatment Plans', herbal: 'Herbal Formulas', ai: 'AI TCM Tools', billing: 'Billing' };

const CONSTITUTIONS = ['wood','fire','earth','metal','water','mixed'];
const CONSTITUTION_COLORS: Record<string,string> = { wood: 'green', fire: 'red', earth: 'amber', metal: 'gray', water: 'blue', mixed: 'purple' };
const TREATMENT_TYPES = ['acupuncture','cupping','moxibustion','tui_na','gua_sha','herbal_consult','combination','TCM_assessment'];
const REFERRAL_SOURCES = ['physician','self','mva','extended_health','friend','other'];
const HERBAL_CATS = ['classical','modified','custom','patent'];
const PREPARATIONS = ['decoction','granules','pills','tincture','capsules'];
const COMMON_POINTS = ['LU1','LU7','LI4','LI11','ST25','ST36','ST40','SP6','SP9','HT7','SI3','BL13','BL23','BL40','BL60','KD1','KD3','PC6','TW5','GB20','GB34','LV3','LV8','GV4','GV14','GV20','CV4','CV6','CV12','CV17','Yintang','Taiyang'];
const PATIENT_RESPONSES = ['excellent','good','moderate','minimal','worse'];
const RESPONSE_COLORS: Record<string,string> = { excellent:'green',good:'teal',moderate:'blue',minimal:'amber',worse:'red' };

interface Dashboard { patients_active:number;treatments_today:number;mva_patients:number;herbal_formulas_count:number;revenue_mtd:number; }
interface TcmPatient { id:number;first_name:string;last_name:string;phone:string;email:string;chief_complaint:string;tcm_constitution:string;referral_source:string;mva_claim_number:string;extended_health_provider:string;practitioner:string;status:string;treatment_count:number;created_at:string; }
interface Treatment { id:number;patient_id:number;first_name:string;last_name:string;practitioner:string;treatment_date:string;treatment_time:string;treatment_type:string;status:string;chief_complaint:string;mva_claim_number:string;extended_health_provider:string;fee:number;points_needled:string[];patient_response:string; }
interface HerbalFormula { id:number;formula_name:string;formula_name_chinese:string;category:string;indications:string[];contraindications:string[];ingredients:Record<string,unknown>;preparation:string;dosage:string;notes:string; }
interface TreatmentPlan { id:number;patient_id:number;first_name:string;last_name:string;tcm_constitution:string;tcm_diagnosis:string;pattern:string;treatment_principle:string;proposed_sessions:number;session_frequency:string;status:string;created_at:string; }

function fmtCad(n:number){ return `$${Number(n??0).toLocaleString('en-CA',{minimumFractionDigits:0,maximumFractionDigits:0})}`; }
function fmtDate(d:string){ return d?new Date(d).toLocaleDateString('en-CA'):'—'; }

function Badge({ label, color='gray' }:{ label:string;color?:string }) {
  const m:Record<string,string>={blue:'bg-blue-100 text-blue-700',green:'bg-green-100 text-green-700',amber:'bg-amber-100 text-amber-700',red:'bg-red-100 text-red-700',purple:'bg-purple-100 text-purple-700',gray:'bg-gray-100 text-gray-700',teal:'bg-teal-100 text-teal-700'};
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${m[color]??m.gray}`}>{label}</span>;
}

function KpiCard({ label, value, sub, color='blue' }:{ label:string;value:string|number;sub?:string;color?:string }) {
  const borders:Record<string,string>={blue:'border-l-4 border-blue-500 bg-blue-50',green:'border-l-4 border-green-500 bg-green-50',amber:'border-l-4 border-amber-500 bg-amber-50',red:'border-l-4 border-red-500 bg-red-50',purple:'border-l-4 border-purple-500 bg-purple-50'};
  return <div className={`rounded-lg p-4 ${borders[color]??borders.blue}`}><p className="text-sm text-gray-500">{label}</p><p className="text-2xl font-bold mt-1">{value}</p>{sub&&<p className="text-xs text-gray-400 mt-1">{sub}</p>}</div>;
}

// ─── Add Patient Modal ─────────────────────────────────────────────────────────
function AddPatientModal({ onClose, onSaved }:{ onClose:()=>void;onSaved:()=>void }) {
  const [f, setF] = useState({ first_name:'',last_name:'',date_of_birth:'',phone:'',email:'',address:'',city:'Calgary',province:'AB',referral_source:'self',chief_complaint:'',tcm_constitution:'',tongue_diagnosis:'',pulse_diagnosis:'',mva_claim_number:'',extended_health_provider:'',extended_health_id:'',coverage_per_visit:'',sessions_remaining:'',practitioner:'',notes:'' });
  const [saving,setSaving]=useState(false);
  const upd=(k:string,v:string)=>setF(p=>({...p,[k]:v}));
  async function submit(){
    if(!f.first_name||!f.last_name||!f.phone||!f.chief_complaint){return;}
    setSaving(true);
    try{
      await fetch('/api/admin/acupuncture-tcm/patients',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...f,coverage_per_visit:f.coverage_per_visit?parseFloat(f.coverage_per_visit):null,sessions_remaining:f.sessions_remaining?parseInt(f.sessions_remaining):null})});
      onSaved();
    }finally{setSaving(false);}
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-4 text-slate-800">New TCM Patient</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><label className="text-xs text-gray-500">First Name *</label><input className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.first_name} onChange={e=>upd('first_name',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Last Name *</label><input className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.last_name} onChange={e=>upd('last_name',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Date of Birth</label><input type="date" className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.date_of_birth} onChange={e=>upd('date_of_birth',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Phone *</label><input className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.phone} onChange={e=>upd('phone',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Email</label><input className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.email} onChange={e=>upd('email',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Referral Source</label><select className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.referral_source} onChange={e=>upd('referral_source',e.target.value)}>{REFERRAL_SOURCES.map(r=><option key={r} value={r}>{r}</option>)}</select></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Chief Complaint *</label><textarea className="w-full border rounded px-2 py-1.5 mt-0.5" rows={2} value={f.chief_complaint} onChange={e=>upd('chief_complaint',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">TCM Constitution</label><select className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.tcm_constitution} onChange={e=>upd('tcm_constitution',e.target.value)}><option value="">—</option>{CONSTITUTIONS.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Practitioner</label><input className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.practitioner} onChange={e=>upd('practitioner',e.target.value)}/></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Tongue Diagnosis</label><input className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.tongue_diagnosis} onChange={e=>upd('tongue_diagnosis',e.target.value)}/></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Pulse Diagnosis</label><input className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.pulse_diagnosis} onChange={e=>upd('pulse_diagnosis',e.target.value)}/></div>
          <div className="col-span-2 border-t pt-2 mt-1"><p className="text-xs font-semibold text-gray-600 mb-2">Insurance / MVA</p></div>
          <div><label className="text-xs text-gray-500">MVA Claim #</label><input className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.mva_claim_number} onChange={e=>upd('mva_claim_number',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Extended Health Provider</label><input className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.extended_health_provider} onChange={e=>upd('extended_health_provider',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Coverage/Visit ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.coverage_per_visit} onChange={e=>upd('coverage_per_visit',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Sessions Remaining</label><input type="number" className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.sessions_remaining} onChange={e=>upd('sessions_remaining',e.target.value)}/></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 mt-0.5" rows={2} value={f.notes} onChange={e=>upd('notes',e.target.value)}/></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-1.5 rounded border text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving||!f.first_name||!f.last_name||!f.phone||!f.chief_complaint} className="px-4 py-1.5 rounded bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-50">{saving?'Saving…':'Create Patient'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Complete Treatment Modal ──────────────────────────────────────────────────
function CompleteTreatmentModal({ treatment, onClose, onSaved }:{ treatment:Treatment;onClose:()=>void;onSaved:()=>void }) {
  const [f, setF] = useState({ tongue_findings:'',pulse_findings:'',tcm_diagnosis:'',pattern_differentiation:'',points_needled:[] as string[],needle_retention_minutes:'25',cupping_areas:'',moxa_points:'',herbal_formula:'',patient_response:'good',post_treatment_advice:'',fee:'',extended_health_claimed:'',mva_claimed:'',patient_paid:'',payment_method:'cash' });
  const [saving,setSaving]=useState(false);
  const upd=(k:string,v:string)=>setF(p=>({...p,[k]:v}));
  function togglePoint(pt:string){ setF(p=>({...p,points_needled:p.points_needled.includes(pt)?p.points_needled.filter(x=>x!==pt):[...p.points_needled,pt]})); }
  async function submit(){
    setSaving(true);
    try{
      await fetch(`/api/admin/acupuncture-tcm/treatments/${treatment.id}/complete`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...f,needle_retention_minutes:parseInt(f.needle_retention_minutes)||25,cupping_areas:f.cupping_areas?f.cupping_areas.split(',').map(s=>s.trim()):null,moxa_points:f.moxa_points?f.moxa_points.split(',').map(s=>s.trim()):null,fee:f.fee?parseFloat(f.fee):null,extended_health_claimed:f.extended_health_claimed?parseFloat(f.extended_health_claimed):null,mva_claimed:f.mva_claimed?parseFloat(f.mva_claimed):null,patient_paid:f.patient_paid?parseFloat(f.patient_paid):null})});
      onSaved();
    }finally{setSaving(false);}
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-1 text-slate-800">Complete Treatment</h2>
        <p className="text-sm text-gray-500 mb-4">{treatment.first_name} {treatment.last_name} — {treatment.treatment_type} — {fmtDate(treatment.treatment_date)}</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="col-span-2"><label className="text-xs text-gray-500">Tongue Findings</label><input className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.tongue_findings} onChange={e=>upd('tongue_findings',e.target.value)}/></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Pulse Findings</label><input className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.pulse_findings} onChange={e=>upd('pulse_findings',e.target.value)}/></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">TCM Diagnosis</label><input className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.tcm_diagnosis} onChange={e=>upd('tcm_diagnosis',e.target.value)}/></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Pattern Differentiation</label><input className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.pattern_differentiation} onChange={e=>upd('pattern_differentiation',e.target.value)}/></div>
          <div className="col-span-2">
            <label className="text-xs text-gray-500">Points Needled (click to select)</label>
            <div className="flex flex-wrap gap-1 mt-1 p-2 border rounded bg-gray-50 max-h-32 overflow-y-auto">
              {COMMON_POINTS.map(pt=>(
                <button key={pt} onClick={()=>togglePoint(pt)} className={`px-2 py-0.5 rounded text-xs font-mono border ${f.points_needled.includes(pt)?'bg-teal-600 text-white border-teal-600':'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'}`}>{pt}</button>
              ))}
            </div>
            {f.points_needled.length>0&&<p className="text-xs text-teal-700 mt-1">Selected: {f.points_needled.join(', ')}</p>}
          </div>
          <div><label className="text-xs text-gray-500">Retention (min)</label><input type="number" className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.needle_retention_minutes} onChange={e=>upd('needle_retention_minutes',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Patient Response</label><select className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.patient_response} onChange={e=>upd('patient_response',e.target.value)}>{PATIENT_RESPONSES.map(r=><option key={r} value={r}>{r}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Herbal Formula</label><input className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.herbal_formula} onChange={e=>upd('herbal_formula',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Cupping Areas (comma-sep)</label><input className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.cupping_areas} onChange={e=>upd('cupping_areas',e.target.value)}/></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Post-Treatment Advice</label><textarea className="w-full border rounded px-2 py-1.5 mt-0.5" rows={2} value={f.post_treatment_advice} onChange={e=>upd('post_treatment_advice',e.target.value)}/></div>
          <div className="col-span-2 border-t pt-2 mt-1"><p className="text-xs font-semibold text-gray-600 mb-2">Billing</p></div>
          <div><label className="text-xs text-gray-500">Fee ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.fee} onChange={e=>upd('fee',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Extended Health Claim ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.extended_health_claimed} onChange={e=>upd('extended_health_claimed',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">MVA Claim ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.mva_claimed} onChange={e=>upd('mva_claimed',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Patient Paid ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.patient_paid} onChange={e=>upd('patient_paid',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Payment Method</label><select className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.payment_method} onChange={e=>upd('payment_method',e.target.value)}>{['cash','debit','credit','etransfer','insurance_direct'].map(m=><option key={m} value={m}>{m}</option>)}</select></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-1.5 rounded border text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-1.5 rounded bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-50">{saving?'Saving…':'Complete Treatment'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Herbal Formula Modal ──────────────────────────────────────────────────
function AddFormulaModal({ onClose, onSaved }:{ onClose:()=>void;onSaved:()=>void }) {
  const [f,setF]=useState({formula_name:'',formula_name_chinese:'',category:'classical',indications:'',contraindications:'',preparation:'decoction',dosage:'',notes:''});
  const [saving,setSaving]=useState(false);
  const upd=(k:string,v:string)=>setF(p=>({...p,[k]:v}));
  async function submit(){
    if(!f.formula_name)return;
    setSaving(true);
    try{
      await fetch('/api/admin/acupuncture-tcm/herbal-formulas',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...f,indications:f.indications?f.indications.split(',').map(s=>s.trim()):null,contraindications:f.contraindications?f.contraindications.split(',').map(s=>s.trim()):null})});
      onSaved();
    }finally{setSaving(false);}
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-4 text-slate-800">Add Herbal Formula</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="col-span-2"><label className="text-xs text-gray-500">Formula Name (Pinyin) *</label><input className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.formula_name} onChange={e=>upd('formula_name',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Chinese Name</label><input className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.formula_name_chinese} onChange={e=>upd('formula_name_chinese',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Category</label><select className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.category} onChange={e=>upd('category',e.target.value)}>{HERBAL_CATS.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Preparation</label><select className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.preparation} onChange={e=>upd('preparation',e.target.value)}>{PREPARATIONS.map(p=><option key={p} value={p}>{p}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Dosage</label><input className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.dosage} onChange={e=>upd('dosage',e.target.value)}/></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Indications (comma-separated)</label><input className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.indications} onChange={e=>upd('indications',e.target.value)}/></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Contraindications (comma-separated)</label><input className="w-full border rounded px-2 py-1.5 mt-0.5" value={f.contraindications} onChange={e=>upd('contraindications',e.target.value)}/></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 mt-0.5" rows={2} value={f.notes} onChange={e=>upd('notes',e.target.value)}/></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-1.5 rounded border text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving||!f.formula_name} className="px-4 py-1.5 rounded bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-50">{saving?'Saving…':'Add Formula'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function AcupunctureTCMPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [dash, setDash] = useState<Dashboard|null>(null);
  const [patients, setPatients] = useState<TcmPatient[]>([]);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [plans, setPlans] = useState<TreatmentPlan[]>([]);
  const [formulas, setFormulas] = useState<HerbalFormula[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [showAddFormula, setShowAddFormula] = useState(false);
  const [completingTx, setCompletingTx] = useState<Treatment|null>(null);
  const [txDateFilter, setTxDateFilter] = useState('');
  const [herbalCatFilter, setHerbalCatFilter] = useState('');
  const [aiPrompt, setAiPrompt] = useState({ chief_complaint:'', tcm_constitution:'', tcm_diagnosis:'', pattern_differentiation:'', points_needled:[] as string[], tongue_findings:'', pulse_findings:'', patient_response:'good', treatment_type:'acupuncture' });
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMode, setAiMode] = useState<'note'|'prescription'>('note');

  const loadDash = useCallback(async()=>{ const r=await fetch('/api/admin/acupuncture-tcm'); setDash(await r.json()); },[]);
  const loadPatients = useCallback(async()=>{ const r=await fetch('/api/admin/acupuncture-tcm/patients'); setPatients(await r.json()); },[]);
  const loadTreatments = useCallback(async()=>{
    const params=new URLSearchParams();
    if(txDateFilter)params.set('date',txDateFilter);
    const r=await fetch(`/api/admin/acupuncture-tcm/treatments?${params}`);
    setTreatments(await r.json());
  },[txDateFilter]);
  const loadPlans = useCallback(async()=>{ const r=await fetch('/api/admin/acupuncture-tcm/treatment-plans'); setPlans(await r.json()); },[]);
  const loadFormulas = useCallback(async()=>{
    const params=new URLSearchParams();
    if(herbalCatFilter)params.set('category',herbalCatFilter);
    const r=await fetch(`/api/admin/acupuncture-tcm/herbal-formulas?${params}`);
    setFormulas(await r.json());
  },[herbalCatFilter]);

  useEffect(()=>{ loadDash(); },[loadDash]);
  useEffect(()=>{ if(tab==='patients')loadPatients(); },[tab,loadPatients]);
  useEffect(()=>{ if(tab==='treatments')loadTreatments(); },[tab,loadTreatments]);
  useEffect(()=>{ if(tab==='plans')loadPlans(); },[tab,loadPlans]);
  useEffect(()=>{ if(tab==='herbal')loadFormulas(); },[tab,loadFormulas]);

  async function runAI(){
    setAiLoading(true);setAiResult('');
    try{
      const endpoint=aiMode==='note'?'ai-treatment-note':'ai-point-prescription';
      const r=await fetch(`/api/admin/acupuncture-tcm/${endpoint}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(aiPrompt)});
      const d=await r.json();
      setAiResult(d.note||d.prescription||'');
    }finally{setAiLoading(false);}
  }

  function toggleAiPoint(pt:string){ setAiPrompt(p=>({...p,points_needled:p.points_needled.includes(pt)?p.points_needled.filter(x=>x!==pt):[...p.points_needled,pt]})); }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-teal-800 text-white px-6 py-4">
        <h1 className="text-xl font-bold">Acupuncture & Traditional Chinese Medicine Hub</h1>
        <p className="text-teal-200 text-sm mt-0.5">Alberta TCM/Acupuncture Practice Management</p>
      </div>
      {/* Tabs */}
      <div className="bg-white border-b px-6 flex gap-1 overflow-x-auto">
        {TABS.map(t=>(
          <button key={t} onClick={()=>setTab(t)} className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${tab===t?'border-teal-600 text-teal-700':'border-transparent text-gray-500 hover:text-gray-700'}`}>{TAB_LABELS[t]}</button>
        ))}
      </div>

      <div className="p-6 max-w-7xl mx-auto">

        {/* DASHBOARD */}
        {tab==='dashboard'&&(
          <div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <KpiCard label="Active Patients" value={dash?.patients_active??'…'} color="teal"/>
              <KpiCard label="Treatments Today" value={dash?.treatments_today??'…'} color="blue"/>
              <KpiCard label="MVA Patients" value={dash?.mva_patients??'…'} color="amber"/>
              <KpiCard label="Herbal Formulas" value={dash?.herbal_formulas_count??'…'} color="green"/>
              <KpiCard label="Revenue MTD" value={dash?fmtCad(dash.revenue_mtd):'…'} color="purple"/>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <h2 className="font-semibold text-slate-700 mb-3">Today&apos;s Schedule</h2>
              <button onClick={()=>{setTab('treatments');setTxDateFilter(new Date().toISOString().slice(0,10));}} className="text-sm text-teal-600 hover:underline">View today&apos;s treatments →</button>
            </div>
          </div>
        )}

        {/* PATIENTS */}
        {tab==='patients'&&(
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-700">Patients ({patients.length})</h2>
              <button onClick={()=>setShowAddPatient(true)} className="px-4 py-2 bg-teal-600 text-white rounded text-sm font-medium hover:bg-teal-700">+ Add Patient</button>
            </div>
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>{['Patient','Constitution','Chief Complaint','Referral','Payer','Visits','Status'].map(h=><th key={h} className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {patients.map(p=>(
                    <tr key={p.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3"><p className="font-medium text-slate-800">{p.first_name} {p.last_name}</p><p className="text-xs text-gray-400">{p.phone}</p></td>
                      <td className="px-4 py-3">{p.tcm_constitution?<Badge label={p.tcm_constitution} color={CONSTITUTION_COLORS[p.tcm_constitution]||'gray'}/>:'—'}</td>
                      <td className="px-4 py-3 max-w-xs"><p className="text-xs text-gray-600 truncate">{p.chief_complaint}</p></td>
                      <td className="px-4 py-3"><span className="text-xs text-gray-500">{p.referral_source||'—'}</span></td>
                      <td className="px-4 py-3">
                        {p.mva_claim_number&&<Badge label="MVA" color="amber"/>}
                        {p.extended_health_provider&&<Badge label="Extended" color="blue"/>}
                        {!p.mva_claim_number&&!p.extended_health_provider&&<span className="text-xs text-gray-400">Cash</span>}
                      </td>
                      <td className="px-4 py-3 text-center">{p.treatment_count}</td>
                      <td className="px-4 py-3"><Badge label={p.status} color={p.status==='active'?'green':p.status==='discharged'?'gray':'amber'}/></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {showAddPatient&&<AddPatientModal onClose={()=>setShowAddPatient(false)} onSaved={()=>{setShowAddPatient(false);loadPatients();loadDash();}}/>}
          </div>
        )}

        {/* TREATMENTS */}
        {tab==='treatments'&&(
          <div>
            <div className="flex justify-between items-center mb-4 gap-3 flex-wrap">
              <h2 className="text-lg font-semibold text-slate-700">Treatments</h2>
              <div className="flex gap-2">
                <input type="date" className="border rounded px-2 py-1.5 text-sm" value={txDateFilter} onChange={e=>{setTxDateFilter(e.target.value);}} placeholder="Filter by date"/>
                <button onClick={()=>setTxDateFilter('')} className="px-3 py-1.5 border rounded text-sm text-gray-600 hover:bg-gray-50">Clear</button>
              </div>
            </div>
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>{['Patient','Date/Time','Type','Practitioner','Points','Response','Fee','Status','Action'].map(h=><th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {treatments.map(t=>(
                    <tr key={t.id} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-3"><p className="font-medium text-slate-800">{t.first_name} {t.last_name}</p></td>
                      <td className="px-3 py-3"><p className="text-xs">{fmtDate(t.treatment_date)}</p><p className="text-xs text-gray-400">{t.treatment_time?.slice(0,5)}</p></td>
                      <td className="px-3 py-3"><Badge label={t.treatment_type} color="teal"/></td>
                      <td className="px-3 py-3 text-xs">{t.practitioner||'—'}</td>
                      <td className="px-3 py-3 max-w-32"><p className="text-xs text-gray-600 truncate">{t.points_needled?.join(', ')||'—'}</p></td>
                      <td className="px-3 py-3">{t.patient_response?<Badge label={t.patient_response} color={RESPONSE_COLORS[t.patient_response]||'gray'}/>:'—'}</td>
                      <td className="px-3 py-3 text-xs">{t.fee?fmtCad(t.fee):'—'}</td>
                      <td className="px-3 py-3"><Badge label={t.status} color={t.status==='completed'?'green':t.status==='scheduled'?'blue':t.status==='cancelled'?'red':'amber'}/></td>
                      <td className="px-3 py-3">
                        {t.status==='scheduled'&&<button onClick={()=>setCompletingTx(t)} className="text-xs text-teal-600 hover:underline">Complete</button>}
                        {t.status==='scheduled'&&<button onClick={async()=>{await fetch(`/api/admin/acupuncture-tcm/treatments/${t.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'cancelled'})});loadTreatments();}} className="ml-2 text-xs text-red-500 hover:underline">Cancel</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {completingTx&&<CompleteTreatmentModal treatment={completingTx} onClose={()=>setCompletingTx(null)} onSaved={()=>{setCompletingTx(null);loadTreatments();loadDash();}}/>}
          </div>
        )}

        {/* TREATMENT PLANS */}
        {tab==='plans'&&(
          <div>
            <h2 className="text-lg font-semibold text-slate-700 mb-4">Treatment Plans ({plans.length})</h2>
            <div className="grid gap-4">
              {plans.map(p=>(
                <div key={p.id} className="bg-white rounded-lg border p-4">
                  <div className="flex justify-between items-start flex-wrap gap-2">
                    <div>
                      <p className="font-semibold text-slate-800">{p.first_name} {p.last_name}</p>
                      {p.tcm_constitution&&<Badge label={p.tcm_constitution} color={CONSTITUTION_COLORS[p.tcm_constitution]||'gray'}/>}
                    </div>
                    <Badge label={p.status} color={p.status==='active'?'green':p.status==='completed'?'gray':'amber'}/>
                  </div>
                  <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                    <div><span className="text-xs text-gray-400">TCM Diagnosis</span><p className="font-medium text-slate-700">{p.tcm_diagnosis}</p></div>
                    <div><span className="text-xs text-gray-400">Pattern</span><p className="font-medium text-slate-700">{p.pattern}</p></div>
                    <div><span className="text-xs text-gray-400">Treatment Principle</span><p className="text-slate-600">{p.treatment_principle||'—'}</p></div>
                    <div><span className="text-xs text-gray-400">Proposed Sessions</span><p className="font-medium">{p.proposed_sessions||'—'}</p></div>
                    <div><span className="text-xs text-gray-400">Frequency</span><p className="text-slate-600">{p.session_frequency||'—'}</p></div>
                    <div><span className="text-xs text-gray-400">Created</span><p className="text-slate-600">{fmtDate(p.created_at)}</p></div>
                  </div>
                </div>
              ))}
              {plans.length===0&&<p className="text-sm text-gray-400">No treatment plans yet.</p>}
            </div>
          </div>
        )}

        {/* HERBAL FORMULAS */}
        {tab==='herbal'&&(
          <div>
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
              <h2 className="text-lg font-semibold text-slate-700">Herbal Formula Library ({formulas.length})</h2>
              <div className="flex gap-2">
                <select className="border rounded px-2 py-1.5 text-sm" value={herbalCatFilter} onChange={e=>{setHerbalCatFilter(e.target.value);}}><option value="">All Categories</option>{HERBAL_CATS.map(c=><option key={c} value={c}>{c}</option>)}</select>
                <button onClick={()=>setShowAddFormula(true)} className="px-4 py-1.5 bg-teal-600 text-white rounded text-sm font-medium hover:bg-teal-700">+ Add Formula</button>
              </div>
            </div>
            <div className="grid gap-4">
              {formulas.map(f=>(
                <div key={f.id} className="bg-white rounded-lg border p-4">
                  <div className="flex justify-between items-start flex-wrap gap-2">
                    <div>
                      <p className="font-semibold text-slate-800">{f.formula_name} {f.formula_name_chinese&&<span className="text-gray-500 font-normal ml-2">{f.formula_name_chinese}</span>}</p>
                    </div>
                    <div className="flex gap-2">
                      <Badge label={f.category||'—'} color="teal"/>
                      <Badge label={f.preparation||'decoction'} color="blue"/>
                    </div>
                  </div>
                  {f.indications&&f.indications.length>0&&<p className="text-xs text-gray-500 mt-2">Indications: {f.indications.join(', ')}</p>}
                  {f.contraindications&&f.contraindications.length>0&&<p className="text-xs text-red-500 mt-1">Contraindications: {f.contraindications.join(', ')}</p>}
                  {f.dosage&&<p className="text-xs text-gray-500 mt-1">Dosage: {f.dosage}</p>}
                  {f.notes&&<p className="text-xs text-gray-400 mt-1">{f.notes}</p>}
                </div>
              ))}
              {formulas.length===0&&<p className="text-sm text-gray-400">No herbal formulas in library yet.</p>}
            </div>
            {showAddFormula&&<AddFormulaModal onClose={()=>setShowAddFormula(false)} onSaved={()=>{setShowAddFormula(false);loadFormulas();}}/>}
          </div>
        )}

        {/* AI TCM TOOLS */}
        {tab==='ai'&&(
          <div className="max-w-3xl">
            <h2 className="text-lg font-semibold text-slate-700 mb-4">AI TCM Tools</h2>
            <div className="bg-white rounded-lg border p-5">
              <div className="flex gap-2 mb-4">
                <button onClick={()=>setAiMode('note')} className={`px-4 py-2 rounded text-sm font-medium ${aiMode==='note'?'bg-teal-600 text-white':'border text-gray-600 hover:bg-gray-50'}`}>Treatment Note Generator</button>
                <button onClick={()=>setAiMode('prescription')} className={`px-4 py-2 rounded text-sm font-medium ${aiMode==='prescription'?'bg-teal-600 text-white':'border text-gray-600 hover:bg-gray-50'}`}>Point Prescription Generator</button>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                <div className="col-span-2"><label className="text-xs text-gray-500">Chief Complaint</label><input className="w-full border rounded px-2 py-1.5 mt-0.5" value={aiPrompt.chief_complaint} onChange={e=>setAiPrompt(p=>({...p,chief_complaint:e.target.value}))}/></div>
                <div><label className="text-xs text-gray-500">TCM Constitution</label><select className="w-full border rounded px-2 py-1.5 mt-0.5" value={aiPrompt.tcm_constitution} onChange={e=>setAiPrompt(p=>({...p,tcm_constitution:e.target.value}))}><option value="">—</option>{CONSTITUTIONS.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
                <div><label className="text-xs text-gray-500">Treatment Type</label><select className="w-full border rounded px-2 py-1.5 mt-0.5" value={aiPrompt.treatment_type} onChange={e=>setAiPrompt(p=>({...p,treatment_type:e.target.value}))}>{TREATMENT_TYPES.map(t=><option key={t} value={t}>{t}</option>)}</select></div>
                <div><label className="text-xs text-gray-500">Tongue Findings</label><input className="w-full border rounded px-2 py-1.5 mt-0.5" value={aiPrompt.tongue_findings} onChange={e=>setAiPrompt(p=>({...p,tongue_findings:e.target.value}))}/></div>
                <div><label className="text-xs text-gray-500">Pulse Findings</label><input className="w-full border rounded px-2 py-1.5 mt-0.5" value={aiPrompt.pulse_findings} onChange={e=>setAiPrompt(p=>({...p,pulse_findings:e.target.value}))}/></div>
                <div className="col-span-2"><label className="text-xs text-gray-500">TCM Diagnosis</label><input className="w-full border rounded px-2 py-1.5 mt-0.5" value={aiPrompt.tcm_diagnosis} onChange={e=>setAiPrompt(p=>({...p,tcm_diagnosis:e.target.value}))}/></div>
                <div className="col-span-2"><label className="text-xs text-gray-500">Pattern Differentiation</label><input className="w-full border rounded px-2 py-1.5 mt-0.5" value={aiPrompt.pattern_differentiation} onChange={e=>setAiPrompt(p=>({...p,pattern_differentiation:e.target.value}))}/></div>
                {aiMode==='note'&&(
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500">Points Needled</label>
                    <div className="flex flex-wrap gap-1 mt-1 p-2 border rounded bg-gray-50 max-h-28 overflow-y-auto">
                      {COMMON_POINTS.map(pt=>(
                        <button key={pt} onClick={()=>toggleAiPoint(pt)} className={`px-2 py-0.5 rounded text-xs font-mono border ${aiPrompt.points_needled.includes(pt)?'bg-teal-600 text-white border-teal-600':'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'}`}>{pt}</button>
                      ))}
                    </div>
                  </div>
                )}
                {aiMode==='note'&&<div><label className="text-xs text-gray-500">Patient Response</label><select className="w-full border rounded px-2 py-1.5 mt-0.5" value={aiPrompt.patient_response} onChange={e=>setAiPrompt(p=>({...p,patient_response:e.target.value}))}>{PATIENT_RESPONSES.map(r=><option key={r} value={r}>{r}</option>)}</select></div>}
              </div>
              <button onClick={runAI} disabled={aiLoading||!aiPrompt.chief_complaint} className="px-5 py-2 bg-teal-600 text-white rounded text-sm font-medium hover:bg-teal-700 disabled:opacity-50">{aiLoading?'Generating…':'Generate with Ollama AI'}</button>
              {aiResult&&(
                <div className="mt-4 p-4 bg-gray-50 rounded border">
                  <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans">{aiResult}</pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* BILLING */}
        {tab==='billing'&&(
          <div className="max-w-3xl">
            <h2 className="text-lg font-semibold text-slate-700 mb-4">Billing Overview</h2>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <KpiCard label="Revenue MTD" value={dash?fmtCad(dash.revenue_mtd):'…'} color="green"/>
              <KpiCard label="MVA Patients" value={dash?.mva_patients??'…'} color="amber"/>
              <KpiCard label="Active Patients" value={dash?.patients_active??'…'} color="blue"/>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <h3 className="font-semibold text-slate-700 mb-3">Payer Breakdown</h3>
              <p className="text-sm text-gray-500">Payer analysis is calculated from completed treatments. Use the Treatments tab to view individual billing records and filter by date.</p>
              <div className="mt-3 flex gap-3">
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-500 inline-block"></span><span className="text-sm">Cash/Debit/Credit</span></div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block"></span><span className="text-sm">Extended Health</span></div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-amber-500 inline-block"></span><span className="text-sm">MVA</span></div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
