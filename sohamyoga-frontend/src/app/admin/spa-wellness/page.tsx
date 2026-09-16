'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard','appointments','clients','services','gift-cards','ai-notes'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = {
  dashboard: 'Dashboard', appointments: 'Appointments', clients: 'Clients',
  services: 'Services', 'gift-cards': 'Gift Cards', 'ai-notes': 'AI Treatment Notes',
};

const SERVICE_CATEGORIES = ['massage','facial','body_treatment','hot_stone','reflexology','reiki','cupping','prenatal','sports','couples','other'];
const PRESSURE_OPTIONS = ['light','medium','firm','deep_tissue'];
const PAYMENT_METHODS = ['cash','credit','debit','etransfer','gift_card','insurance'];
const APPT_STATUSES = ['scheduled','confirmed','intake_complete','in_progress','completed','cancelled','no_show'];

interface DashData { appointments_today:number; revenue_today:number; tips_today:number; revenue_today_with_tips:number; avg_rating_mtd:number; gift_cards_outstanding_value:number; }
interface SpaClient { id:number; first_name:string; last_name:string; email:string; phone:string; pressure_preference:string; preferred_therapist:string; health_conditions:string[]; medications:string[]; allergies:string[]; contraindications:string; intake_form_signed:boolean; loyalty_points:number; total_visits:number; total_spent:number; last_visit:string; notes:string; }
interface SpaService { id:number; name:string; category:string; description:string; duration_minutes:number; price:number; room_required:string; is_active:boolean; }
interface SpaAppointment { id:number; client_id:number; service_id:number; therapist:string; room:string; scheduled_at:string; status:string; first_name:string; last_name:string; phone:string; service_name:string; duration_minutes:number; amount:number; tip:number; client_rating:number; health_conditions:string[]; contraindications:string; pressure_preference:string; }
interface GiftCard { id:number; code:string; purchaser_name:string; recipient_name:string; recipient_email:string; initial_amount:number; remaining_balance:number; expiry_date:string; is_active:boolean; }

function fmtCad(n:number){return `$${Number(n??0).toLocaleString('en-CA',{minimumFractionDigits:2,maximumFractionDigits:2})}`;}
function fmtDt(d:string){return d?new Date(d).toLocaleString('en-CA',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'—';}
function fmtDate(d:string){return d?new Date(d).toLocaleDateString('en-CA'):'—';}

function Badge({label,color='gray'}:{label:string;color?:string}){
  const m:Record<string,string>={blue:'bg-blue-100 text-blue-700',green:'bg-green-100 text-green-700',amber:'bg-amber-100 text-amber-700',red:'bg-red-100 text-red-700',purple:'bg-purple-100 text-purple-700',gray:'bg-gray-100 text-gray-700',teal:'bg-teal-100 text-teal-700',rose:'bg-rose-100 text-rose-700'};
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${m[color]??m.gray}`}>{label.replace(/_/g,' ')}</span>;
}
function KpiCard({label,value,sub,color='blue'}:{label:string;value:string|number;sub?:string;color?:string}){
  const b:Record<string,string>={blue:'border-l-4 border-blue-500 bg-blue-50',green:'border-l-4 border-green-500 bg-green-50',amber:'border-l-4 border-amber-500 bg-amber-50',purple:'border-l-4 border-purple-500 bg-purple-50',rose:'border-l-4 border-rose-500 bg-rose-50'};
  return <div className={`rounded-lg p-4 ${b[color]??b.blue}`}><p className="text-sm text-gray-500">{label}</p><p className="text-2xl font-bold mt-1">{value}</p>{sub&&<p className="text-xs text-gray-400 mt-1">{sub}</p>}</div>;
}
function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:React.ReactNode}){
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"><div className="bg-white rounded-xl shadow-2xl w-full max-w-xl p-6 overflow-y-auto max-h-[90vh]"><div className="flex justify-between items-center mb-4"><h2 className="text-lg font-bold text-slate-800">{title}</h2><button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button></div>{children}</div></div>;
}
function statusColor(s:string){const m:Record<string,string>={scheduled:'blue',confirmed:'teal',intake_complete:'purple',in_progress:'amber',completed:'green',cancelled:'gray',no_show:'red'};return m[s]??'gray';}
function pressureColor(p:string){const m:Record<string,string>={light:'blue',medium:'green',firm:'amber',deep_tissue:'rose'};return m[p]??'gray';}

// ─── Add Client Modal ─────────────────────────────────────────────────────────
function AddClientModal({onClose,onSaved}:{onClose:()=>void;onSaved:()=>void}){
  const [form,setForm]=useState({first_name:'',last_name:'',email:'',phone:'',pressure_preference:'medium',preferred_therapist:'',referral_source:'',health_conditions:'',medications:'',allergies:'',contraindications:'',intake_form_signed:false,notes:''});
  const [saving,setSaving]=useState(false);
  const f=(k:string,v:string|boolean)=>setForm(p=>({...p,[k]:v}));
  async function submit(){
    if(!form.first_name||!form.phone)return;
    setSaving(true);
    try{
      await fetch('/api/admin/spa-wellness/clients',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        ...form,
        health_conditions:form.health_conditions?form.health_conditions.split(',').map(s=>s.trim()).filter(Boolean):[],
        medications:form.medications?form.medications.split(',').map(s=>s.trim()).filter(Boolean):[],
        allergies:form.allergies?form.allergies.split(',').map(s=>s.trim()).filter(Boolean):[],
      })});
      onSaved();
    }finally{setSaving(false);}
  }
  return <Modal title="Add New Client" onClose={onClose}>
    <div className="grid grid-cols-2 gap-3">
      <div><label className="text-xs text-gray-500">First Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.first_name} onChange={e=>f('first_name',e.target.value)}/></div>
      <div><label className="text-xs text-gray-500">Last Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.last_name} onChange={e=>f('last_name',e.target.value)}/></div>
      <div><label className="text-xs text-gray-500">Phone *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.phone} onChange={e=>f('phone',e.target.value)}/></div>
      <div><label className="text-xs text-gray-500">Email</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.email} onChange={e=>f('email',e.target.value)}/></div>
      <div><label className="text-xs text-gray-500">Pressure Preference</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.pressure_preference} onChange={e=>f('pressure_preference',e.target.value)}>{PRESSURE_OPTIONS.map(p=><option key={p} value={p}>{p.replace('_',' ')}</option>)}</select></div>
      <div><label className="text-xs text-gray-500">Preferred Therapist</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.preferred_therapist} onChange={e=>f('preferred_therapist',e.target.value)}/></div>
      <div><label className="text-xs text-gray-500">Referral Source</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.referral_source} onChange={e=>f('referral_source',e.target.value)}/></div>
      <div className="flex items-center gap-2 pt-4"><input type="checkbox" checked={form.intake_form_signed} onChange={e=>f('intake_form_signed',e.target.checked)}/><label className="text-sm">Intake Form Signed</label></div>
      <div className="col-span-2"><label className="text-xs text-gray-500">Health Conditions (comma-separated)</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.health_conditions} onChange={e=>f('health_conditions',e.target.value)} placeholder="e.g. hypertension, pregnancy"/></div>
      <div className="col-span-2"><label className="text-xs text-gray-500">Medications (comma-separated)</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.medications} onChange={e=>f('medications',e.target.value)}/></div>
      <div className="col-span-2"><label className="text-xs text-gray-500">Allergies (comma-separated)</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.allergies} onChange={e=>f('allergies',e.target.value)}/></div>
      <div className="col-span-2"><label className="text-xs text-gray-500">Contraindications</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.contraindications} onChange={e=>f('contraindications',e.target.value)}/></div>
      <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.notes} onChange={e=>f('notes',e.target.value)}/></div>
    </div>
    <div className="flex justify-end gap-2 mt-4"><button onClick={onClose} className="px-4 py-2 border rounded text-sm">Cancel</button><button onClick={submit} disabled={saving||!form.first_name||!form.phone} className="px-4 py-2 bg-teal-600 text-white rounded text-sm hover:bg-teal-700 disabled:opacity-50">{saving?'Saving…':'Add Client'}</button></div>
  </Modal>;
}

// ─── Add Appointment Modal ─────────────────────────────────────────────────────
function AddApptModal({clients,services,onClose,onSaved}:{clients:SpaClient[];services:SpaService[];onClose:()=>void;onSaved:()=>void}){
  const [form,setForm]=useState({client_id:'',service_id:'',therapist:'',room:'',scheduled_at:'',intake_notes:'',massage_benefit_claimed:false});
  const [saving,setSaving]=useState(false);
  const f=(k:string,v:string|boolean)=>setForm(p=>({...p,[k]:v}));
  async function submit(){
    if(!form.client_id||!form.service_id||!form.therapist||!form.scheduled_at)return;
    setSaving(true);
    try{
      await fetch('/api/admin/spa-wellness/appointments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,client_id:parseInt(form.client_id),service_id:parseInt(form.service_id)})});
      onSaved();
    }finally{setSaving(false);}
  }
  return <Modal title="Add Appointment" onClose={onClose}>
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2"><label className="text-xs text-gray-500">Client *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.client_id} onChange={e=>f('client_id',e.target.value)}><option value="">— Select client —</option>{clients.map(c=><option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}</select></div>
      <div className="col-span-2"><label className="text-xs text-gray-500">Service *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.service_id} onChange={e=>f('service_id',e.target.value)}><option value="">— Select service —</option>{services.map(s=><option key={s.id} value={s.id}>{s.name} ({s.duration_minutes}min — ${s.price})</option>)}</select></div>
      <div><label className="text-xs text-gray-500">Therapist *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.therapist} onChange={e=>f('therapist',e.target.value)}/></div>
      <div><label className="text-xs text-gray-500">Room</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.room} onChange={e=>f('room',e.target.value)} placeholder="Room A"/></div>
      <div className="col-span-2"><label className="text-xs text-gray-500">Date & Time *</label><input type="datetime-local" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.scheduled_at} onChange={e=>f('scheduled_at',e.target.value)}/></div>
      <div className="col-span-2"><label className="text-xs text-gray-500">Intake Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.intake_notes} onChange={e=>f('intake_notes',e.target.value)}/></div>
      <div className="flex items-center gap-2"><input type="checkbox" checked={form.massage_benefit_claimed} onChange={e=>f('massage_benefit_claimed',e.target.checked)}/><label className="text-sm">Insurance Benefit Claim</label></div>
    </div>
    <div className="flex justify-end gap-2 mt-4"><button onClick={onClose} className="px-4 py-2 border rounded text-sm">Cancel</button><button onClick={submit} disabled={saving||!form.client_id||!form.service_id||!form.therapist||!form.scheduled_at} className="px-4 py-2 bg-teal-600 text-white rounded text-sm hover:bg-teal-700 disabled:opacity-50">{saving?'Saving…':'Book Appointment'}</button></div>
  </Modal>;
}

// ─── Complete Appointment Modal ────────────────────────────────────────────────
function CompleteApptModal({appt,onClose,onSaved}:{appt:SpaAppointment;onClose:()=>void;onSaved:()=>void}){
  const [form,setForm]=useState({pressure_used:appt.pressure_preference||'medium',areas_focused:'',aftercare_given:'',client_feedback:'',client_rating:'5',amount:String(appt.amount||0),tip:'0',payment_method:'credit',massage_benefit_claimed:false});
  const [saving,setSaving]=useState(false);
  const f=(k:string,v:string|boolean)=>setForm(p=>({...p,[k]:v}));
  async function submit(){
    setSaving(true);
    try{
      await fetch(`/api/admin/spa-wellness/appointments/${appt.id}/complete`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        ...form,
        areas_focused:form.areas_focused?form.areas_focused.split(',').map(s=>s.trim()).filter(Boolean):[],
        client_rating:form.client_rating?parseInt(form.client_rating):null,
        amount:parseFloat(form.amount)||0,
        tip:parseFloat(form.tip)||0,
      })});
      onSaved();
    }finally{setSaving(false);}
  }
  return <Modal title={`Complete: ${appt.first_name} ${appt.last_name}`} onClose={onClose}>
    <div className="grid grid-cols-2 gap-3">
      <div><label className="text-xs text-gray-500">Pressure Used</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.pressure_used} onChange={e=>f('pressure_used',e.target.value)}>{PRESSURE_OPTIONS.map(p=><option key={p} value={p}>{p.replace('_',' ')}</option>)}</select></div>
      <div><label className="text-xs text-gray-500">Client Rating</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.client_rating} onChange={e=>f('client_rating',e.target.value)}><option value="">—</option>{[5,4,3,2,1].map(n=><option key={n} value={n}>{'★'.repeat(n)}</option>)}</select></div>
      <div className="col-span-2"><label className="text-xs text-gray-500">Areas Focused (comma-separated)</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.areas_focused} onChange={e=>f('areas_focused',e.target.value)} placeholder="neck, shoulders, lower back"/></div>
      <div className="col-span-2"><label className="text-xs text-gray-500">Aftercare Given</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.aftercare_given} onChange={e=>f('aftercare_given',e.target.value)} placeholder="Heat/ice, stretches, hydration..."/></div>
      <div className="col-span-2"><label className="text-xs text-gray-500">Client Feedback</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.client_feedback} onChange={e=>f('client_feedback',e.target.value)}/></div>
      <div><label className="text-xs text-gray-500">Amount ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.amount} onChange={e=>f('amount',e.target.value)}/></div>
      <div><label className="text-xs text-gray-500">Tip ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.tip} onChange={e=>f('tip',e.target.value)}/></div>
      <div><label className="text-xs text-gray-500">Payment Method</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.payment_method} onChange={e=>f('payment_method',e.target.value)}>{PAYMENT_METHODS.map(p=><option key={p} value={p}>{p.replace('_',' ')}</option>)}</select></div>
      <div className="flex items-center gap-2 pt-4"><input type="checkbox" checked={form.massage_benefit_claimed} onChange={e=>f('massage_benefit_claimed',e.target.checked)}/><label className="text-sm">Insurance Claim</label></div>
    </div>
    <div className="flex justify-end gap-2 mt-4"><button onClick={onClose} className="px-4 py-2 border rounded text-sm">Cancel</button><button onClick={submit} disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50">{saving?'Completing…':'Complete Session'}</button></div>
  </Modal>;
}

// ─── Add Service Modal ─────────────────────────────────────────────────────────
function AddServiceModal({onClose,onSaved}:{onClose:()=>void;onSaved:()=>void}){
  const [form,setForm]=useState({name:'',category:'massage',description:'',duration_minutes:'60',price:'',therapist_requirements:'RMT',room_required:'',supplies_needed:''});
  const [saving,setSaving]=useState(false);
  const f=(k:string,v:string)=>setForm(p=>({...p,[k]:v}));
  async function submit(){
    if(!form.name||!form.price)return;
    setSaving(true);
    try{
      await fetch('/api/admin/spa-wellness/services',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        ...form,duration_minutes:parseInt(form.duration_minutes),price:parseFloat(form.price),
        supplies_needed:form.supplies_needed?form.supplies_needed.split(',').map(s=>s.trim()).filter(Boolean):[],
      })});
      onSaved();
    }finally{setSaving(false);}
  }
  return <Modal title="Add Service" onClose={onClose}>
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2"><label className="text-xs text-gray-500">Service Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.name} onChange={e=>f('name',e.target.value)}/></div>
      <div><label className="text-xs text-gray-500">Category</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.category} onChange={e=>f('category',e.target.value)}>{SERVICE_CATEGORIES.map(c=><option key={c} value={c}>{c.replace('_',' ')}</option>)}</select></div>
      <div><label className="text-xs text-gray-500">Duration (min) *</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.duration_minutes} onChange={e=>f('duration_minutes',e.target.value)}/></div>
      <div><label className="text-xs text-gray-500">Price (CAD) *</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.price} onChange={e=>f('price',e.target.value)}/></div>
      <div><label className="text-xs text-gray-500">Room Required</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.room_required} onChange={e=>f('room_required',e.target.value)} placeholder="Room A"/></div>
      <div className="col-span-2"><label className="text-xs text-gray-500">Therapist Requirements</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.therapist_requirements} onChange={e=>f('therapist_requirements',e.target.value)}/></div>
      <div className="col-span-2"><label className="text-xs text-gray-500">Description</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.description} onChange={e=>f('description',e.target.value)}/></div>
      <div className="col-span-2"><label className="text-xs text-gray-500">Supplies Needed (comma-separated)</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.supplies_needed} onChange={e=>f('supplies_needed',e.target.value)}/></div>
    </div>
    <div className="flex justify-end gap-2 mt-4"><button onClick={onClose} className="px-4 py-2 border rounded text-sm">Cancel</button><button onClick={submit} disabled={saving||!form.name||!form.price} className="px-4 py-2 bg-teal-600 text-white rounded text-sm hover:bg-teal-700 disabled:opacity-50">{saving?'Saving…':'Add Service'}</button></div>
  </Modal>;
}

// ─── Create Gift Card Modal ────────────────────────────────────────────────────
function CreateGiftCardModal({onClose,onSaved}:{onClose:()=>void;onSaved:()=>void}){
  const [form,setForm]=useState({purchaser_name:'',purchaser_email:'',recipient_name:'',recipient_email:'',amount:'',expiry_date:''});
  const [saving,setSaving]=useState(false);
  const f=(k:string,v:string)=>setForm(p=>({...p,[k]:v}));
  async function submit(){
    if(!form.amount)return;
    setSaving(true);
    try{
      await fetch('/api/admin/spa-wellness/gift-cards',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,amount:parseFloat(form.amount)})});
      onSaved();
    }finally{setSaving(false);}
  }
  return <Modal title="Create Gift Card" onClose={onClose}>
    <div className="grid grid-cols-2 gap-3">
      <div><label className="text-xs text-gray-500">Purchaser Name</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.purchaser_name} onChange={e=>f('purchaser_name',e.target.value)}/></div>
      <div><label className="text-xs text-gray-500">Purchaser Email</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.purchaser_email} onChange={e=>f('purchaser_email',e.target.value)}/></div>
      <div><label className="text-xs text-gray-500">Recipient Name</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.recipient_name} onChange={e=>f('recipient_name',e.target.value)}/></div>
      <div><label className="text-xs text-gray-500">Recipient Email</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.recipient_email} onChange={e=>f('recipient_email',e.target.value)}/></div>
      <div><label className="text-xs text-gray-500">Amount (CAD) *</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.amount} onChange={e=>f('amount',e.target.value)}/></div>
      <div><label className="text-xs text-gray-500">Expiry Date</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.expiry_date} onChange={e=>f('expiry_date',e.target.value)}/></div>
    </div>
    <div className="flex justify-end gap-2 mt-4"><button onClick={onClose} className="px-4 py-2 border rounded text-sm">Cancel</button><button onClick={submit} disabled={saving||!form.amount} className="px-4 py-2 bg-teal-600 text-white rounded text-sm hover:bg-teal-700 disabled:opacity-50">{saving?'Creating…':'Create Gift Card'}</button></div>
  </Modal>;
}

export default function SpaWellnessPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [dash, setDash] = useState<DashData|null>(null);
  const [clients, setClients] = useState<SpaClient[]>([]);
  const [services, setServices] = useState<SpaService[]>([]);
  const [appointments, setAppointments] = useState<SpaAppointment[]>([]);
  const [giftCards, setGiftCards] = useState<GiftCard[]>([]);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [showAddClient, setShowAddClient] = useState(false);
  const [showAddAppt, setShowAddAppt] = useState(false);
  const [showAddService, setShowAddService] = useState(false);
  const [showGiftCard, setShowGiftCard] = useState(false);
  const [completeAppt, setCompleteAppt] = useState<SpaAppointment|null>(null);
  const [validateCode, setValidateCode] = useState('');
  const [validateResult, setValidateResult] = useState<{valid?:boolean;error?:string;remaining_balance?:number;recipient_name?:string}|null>(null);
  const [aiApptId, setAiApptId] = useState('');
  const [aiNotes, setAiNotes] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const loadDash = useCallback(async()=>{ const r=await fetch('/api/admin/spa-wellness'); if(r.ok) setDash(await r.json()); },[]);
  const loadClients = useCallback(async()=>{ const r=await fetch(`/api/admin/spa-wellness/clients?search=${encodeURIComponent(search)}`); if(r.ok) setClients(await r.json()); },[search]);
  const loadServices = useCallback(async()=>{ const r=await fetch(`/api/admin/spa-wellness/services?category=${catFilter}`); if(r.ok) setServices(await r.json()); },[catFilter]);
  const loadAppts = useCallback(async()=>{ const r=await fetch(`/api/admin/spa-wellness/appointments?date=${dateFilter}&status=${statusFilter}`); if(r.ok) setAppointments(await r.json()); },[dateFilter,statusFilter]);
  const loadGiftCards = useCallback(async()=>{ const r=await fetch('/api/admin/spa-wellness/gift-cards'); if(r.ok) setGiftCards(await r.json()); },[]);

  useEffect(()=>{ loadDash(); loadServices(); },[loadDash,loadServices]);
  useEffect(()=>{ if(tab==='clients') loadClients(); },[tab,loadClients]);
  useEffect(()=>{ if(tab==='appointments') loadAppts(); },[tab,loadAppts]);
  useEffect(()=>{ if(tab==='gift-cards') loadGiftCards(); },[tab,loadGiftCards]);

  async function changeApptStatus(id:number, status:string){
    await fetch(`/api/admin/spa-wellness/appointments/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})});
    loadAppts();
  }

  async function validateGiftCode(){
    const r=await fetch('/api/admin/spa-wellness/gift-cards/validate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:validateCode})});
    setValidateResult(await r.json());
  }

  async function generateAiNotes(){
    setAiLoading(true);
    setAiNotes('');
    try{
      const appt=appointments.find(a=>String(a.id)===aiApptId);
      const r=await fetch('/api/admin/spa-wellness/ai-treatment-notes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        service_name:appt?.service_name,duration_minutes:appt?.duration_minutes,
        pressure_used:appt?.pressure_preference,health_conditions:appt?.health_conditions,
        client_name:appt?`${appt.first_name} ${appt.last_name}`:undefined,therapist:appt?.therapist,
      })});
      const d=await r.json() as {notes?:string};
      setAiNotes(d.notes||'No notes generated');
    }finally{setAiLoading(false);}
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-2xl font-bold text-slate-800">Spa & Wellness / Massage Therapy Hub</h1>
        <p className="text-sm text-gray-500 mt-1">Appointments · Clients · Services · Gift Cards · AI Treatment Notes</p>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b px-6">
        <nav className="flex gap-1">
          {TABS.map(t=><button key={t} onClick={()=>setTab(t)} className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab===t?'border-teal-600 text-teal-700':'border-transparent text-gray-500 hover:text-gray-700'}`}>{TAB_LABELS[t]}</button>)}
        </nav>
      </div>

      <div className="p-6">
        {/* ── DASHBOARD ── */}
        {tab==='dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <KpiCard label="Appointments Today" value={dash?.appointments_today??'…'} color="blue"/>
              <KpiCard label="Revenue Today" value={dash?fmtCad(dash.revenue_today):'…'} color="green"/>
              <KpiCard label="Tips Today" value={dash?fmtCad(dash.tips_today):'…'} color="purple"/>
              <KpiCard label="Avg Rating (MTD)" value={dash?`${dash.avg_rating_mtd}/5.0`:'…'} color="amber"/>
              <KpiCard label="Gift Cards Outstanding" value={dash?fmtCad(dash.gift_cards_outstanding_value):'…'} color="rose"/>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <div className="flex justify-between items-center mb-3">
                <h2 className="font-semibold text-slate-700">Today&apos;s Appointment Timeline</h2>
                <input type="date" className="border rounded px-2 py-1 text-sm" value={dateFilter} onChange={e=>{setDateFilter(e.target.value);loadAppts();}}/>
              </div>
              <div className="space-y-2">
                {appointments.slice(0,20).map(a=>(
                  <div key={a.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50">
                    <div className="w-20 text-sm font-mono text-gray-500">{new Date(a.scheduled_at).toLocaleTimeString('en-CA',{hour:'2-digit',minute:'2-digit'})}</div>
                    <div className="flex-1">
                      <span className="font-medium text-sm">{a.first_name} {a.last_name}</span>
                      <span className="text-gray-400 text-xs ml-2">— {a.service_name} ({a.duration_minutes}min) w/ {a.therapist}</span>
                      {a.room&&<span className="text-xs text-gray-400 ml-2">| {a.room}</span>}
                      {a.health_conditions?.length>0&&<span className="ml-2 text-amber-600 text-xs" title={a.health_conditions.join(', ')}>⚠ conditions</span>}
                    </div>
                    <Badge label={a.status} color={statusColor(a.status)}/>
                    {a.status==='completed'&&a.tip>0&&<span className="text-xs text-green-600 font-medium">+{fmtCad(a.tip)} tip</span>}
                  </div>
                ))}
                {appointments.length===0&&<p className="text-sm text-gray-400 text-center py-4">No appointments for selected date</p>}
              </div>
            </div>
          </div>
        )}

        {/* ── APPOINTMENTS ── */}
        {tab==='appointments' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 items-center">
              <input type="date" className="border rounded px-2 py-1.5 text-sm" value={dateFilter} onChange={e=>setDateFilter(e.target.value)}/>
              <select className="border rounded px-2 py-1.5 text-sm" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
                <option value="">All Statuses</option>{APPT_STATUSES.map(s=><option key={s} value={s}>{s.replace('_',' ')}</option>)}
              </select>
              <button onClick={loadAppts} className="px-3 py-1.5 bg-gray-100 border rounded text-sm hover:bg-gray-200">Filter</button>
              <button onClick={()=>{loadClients();setShowAddAppt(true);}} className="ml-auto px-4 py-1.5 bg-teal-600 text-white rounded text-sm hover:bg-teal-700">+ Add Appointment</button>
            </div>
            <div className="grid gap-3">
              {appointments.map(a=>(
                <div key={a.id} className="bg-white border rounded-xl p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{a.first_name} {a.last_name}</span>
                        <Badge label={a.pressure_preference} color={pressureColor(a.pressure_preference)}/>
                        {a.health_conditions?.length>0&&<Badge label={`⚠ ${a.health_conditions.length} conditions`} color="amber"/>}
                        {a.contraindications&&<Badge label="contraindication" color="red"/>}
                        <Badge label={a.status} color={statusColor(a.status)}/>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{fmtDt(a.scheduled_at)} · {a.service_name} · {a.therapist} {a.room&&`· ${a.room}`}</p>
                      {a.status==='completed'&&<p className="text-sm text-green-600 mt-1">Paid: {fmtCad(a.amount)} + {fmtCad(a.tip)} tip {'★'.repeat(a.client_rating||0)}</p>}
                    </div>
                    <div className="flex gap-2 flex-wrap ml-4">
                      {a.status==='scheduled'&&<button onClick={()=>changeApptStatus(a.id,'confirmed')} className="px-2 py-1 bg-teal-50 text-teal-700 border border-teal-200 rounded text-xs hover:bg-teal-100">Confirm</button>}
                      {a.status==='confirmed'&&<button onClick={()=>changeApptStatus(a.id,'intake_complete')} className="px-2 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded text-xs hover:bg-purple-100">Intake Done</button>}
                      {a.status==='intake_complete'&&<button onClick={()=>changeApptStatus(a.id,'in_progress')} className="px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded text-xs hover:bg-amber-100">Start Session</button>}
                      {a.status==='in_progress'&&<button onClick={()=>setCompleteAppt(a)} className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700">Complete</button>}
                      {['scheduled','confirmed'].includes(a.status)&&<button onClick={()=>changeApptStatus(a.id,'cancelled')} className="px-2 py-1 bg-red-50 text-red-700 border border-red-200 rounded text-xs hover:bg-red-100">Cancel</button>}
                      {a.status==='scheduled'&&<button onClick={()=>changeApptStatus(a.id,'no_show')} className="px-2 py-1 bg-gray-100 text-gray-700 border rounded text-xs hover:bg-gray-200">No Show</button>}
                    </div>
                  </div>
                </div>
              ))}
              {appointments.length===0&&<div className="bg-white border rounded-xl p-8 text-center text-gray-400">No appointments found</div>}
            </div>
          </div>
        )}

        {/* ── CLIENTS ── */}
        {tab==='clients' && (
          <div className="space-y-4">
            <div className="flex gap-3 items-center">
              <input className="border rounded px-3 py-1.5 text-sm flex-1 max-w-xs" placeholder="Search clients…" value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==='Enter'&&loadClients()}/>
              <button onClick={loadClients} className="px-3 py-1.5 bg-gray-100 border rounded text-sm hover:bg-gray-200">Search</button>
              <button onClick={()=>setShowAddClient(true)} className="ml-auto px-4 py-1.5 bg-teal-600 text-white rounded text-sm hover:bg-teal-700">+ Add Client</button>
            </div>
            <div className="grid gap-3">
              {clients.map(c=>(
                <div key={c.id} className="bg-white border rounded-xl p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{c.first_name} {c.last_name}</span>
                        <Badge label={c.pressure_preference} color={pressureColor(c.pressure_preference)}/>
                        {c.health_conditions?.length>0&&<Badge label={`⚠ ${c.health_conditions.join(', ')}`} color="amber"/>}
                        {c.contraindications&&<Badge label="contraindication ⚠" color="red"/>}
                        {!c.intake_form_signed&&<Badge label="intake pending" color="red"/>}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{c.phone} {c.email&&`· ${c.email}`}</p>
                      {c.preferred_therapist&&<p className="text-xs text-gray-400">Prefers: {c.preferred_therapist}</p>}
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-medium text-teal-700">{c.loyalty_points} pts</p>
                      <p className="text-gray-400">{c.total_visits} visits · {fmtCad(c.total_spent)}</p>
                      {c.last_visit&&<p className="text-gray-400 text-xs">Last: {fmtDate(c.last_visit)}</p>}
                    </div>
                  </div>
                </div>
              ))}
              {clients.length===0&&<div className="bg-white border rounded-xl p-8 text-center text-gray-400">No clients found</div>}
            </div>
          </div>
        )}

        {/* ── SERVICES ── */}
        {tab==='services' && (
          <div className="space-y-4">
            <div className="flex gap-3 items-center flex-wrap">
              <select className="border rounded px-2 py-1.5 text-sm" value={catFilter} onChange={e=>setCatFilter(e.target.value)}>
                <option value="">All Categories</option>{SERVICE_CATEGORIES.map(c=><option key={c} value={c}>{c.replace('_',' ')}</option>)}
              </select>
              <button onClick={loadServices} className="px-3 py-1.5 bg-gray-100 border rounded text-sm hover:bg-gray-200">Filter</button>
              <button onClick={()=>setShowAddService(true)} className="ml-auto px-4 py-1.5 bg-teal-600 text-white rounded text-sm hover:bg-teal-700">+ Add Service</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {services.map(s=>(
                <div key={s.id} className="bg-white border rounded-xl p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-slate-800">{s.name}</h3>
                      <Badge label={s.category} color="teal"/>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-teal-700">{fmtCad(s.price)}</p>
                      <p className="text-xs text-gray-400">{s.duration_minutes} min</p>
                    </div>
                  </div>
                  {s.description&&<p className="text-sm text-gray-500 mt-2">{s.description}</p>}
                  {s.room_required&&<p className="text-xs text-gray-400 mt-1">Room: {s.room_required}</p>}
                  <div className="mt-3 flex justify-end">
                    <button onClick={async()=>{await fetch(`/api/admin/spa-wellness/services/${s.id}`,{method:'DELETE'});loadServices();}} className="text-xs text-red-500 hover:text-red-700">Deactivate</button>
                  </div>
                </div>
              ))}
              {services.length===0&&<div className="col-span-3 bg-white border rounded-xl p-8 text-center text-gray-400">No active services</div>}
            </div>
          </div>
        )}

        {/* ── GIFT CARDS ── */}
        {tab==='gift-cards' && (
          <div className="space-y-4">
            <div className="flex gap-3 items-center">
              <button onClick={()=>setShowGiftCard(true)} className="ml-auto px-4 py-1.5 bg-teal-600 text-white rounded text-sm hover:bg-teal-700">+ Create Gift Card</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white border rounded-xl p-4">
                <h3 className="font-semibold text-slate-700 mb-3">Validate Gift Card Code</h3>
                <div className="flex gap-2">
                  <input className="border rounded px-3 py-1.5 text-sm flex-1 font-mono uppercase" placeholder="Enter code…" value={validateCode} onChange={e=>setValidateCode(e.target.value.toUpperCase())}/>
                  <button onClick={validateGiftCode} className="px-3 py-1.5 bg-teal-600 text-white rounded text-sm hover:bg-teal-700">Validate</button>
                </div>
                {validateResult&&<div className={`mt-3 p-3 rounded-lg text-sm ${validateResult.valid?'bg-green-50 text-green-800':'bg-red-50 text-red-800'}`}>
                  {validateResult.valid?<><p className="font-semibold">Valid — Balance: {fmtCad(validateResult.remaining_balance||0)}</p>{validateResult.recipient_name&&<p>Recipient: {validateResult.recipient_name}</p>}</>:<p>{validateResult.error}</p>}
                </div>}
              </div>
              <div className="bg-white border rounded-xl p-4">
                <h3 className="font-semibold text-slate-700 mb-2">Summary</h3>
                <p className="text-sm text-gray-500">Active cards: {giftCards.filter(g=>g.is_active).length}</p>
                <p className="text-sm text-gray-500">Outstanding value: {fmtCad(giftCards.filter(g=>g.is_active).reduce((s,g)=>s+parseFloat(String(g.remaining_balance)),0))}</p>
              </div>
            </div>
            <div className="bg-white border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b"><tr>{['Code','Purchaser','Recipient','Initial','Balance','Expiry','Status'].map(h=><th key={h} className="text-left px-4 py-2 text-xs font-semibold text-gray-500">{h}</th>)}</tr></thead>
                <tbody>{giftCards.map(g=><tr key={g.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono font-bold text-teal-700">{g.code}</td>
                  <td className="px-4 py-2">{g.purchaser_name||'—'}</td>
                  <td className="px-4 py-2">{g.recipient_name||'—'}</td>
                  <td className="px-4 py-2">{fmtCad(g.initial_amount)}</td>
                  <td className="px-4 py-2 font-medium">{fmtCad(g.remaining_balance)}</td>
                  <td className="px-4 py-2">{fmtDate(g.expiry_date)}</td>
                  <td className="px-4 py-2"><Badge label={g.is_active?'active':'used'} color={g.is_active?'green':'gray'}/></td>
                </tr>)}</tbody>
              </table>
              {giftCards.length===0&&<p className="text-center text-gray-400 py-4 text-sm">No gift cards</p>}
            </div>
          </div>
        )}

        {/* ── AI TREATMENT NOTES ── */}
        {tab==='ai-notes' && (
          <div className="max-w-2xl space-y-4">
            <div className="bg-white border rounded-xl p-5">
              <h2 className="font-semibold text-slate-700 mb-4">Generate Clinical Treatment Notes (Insurance-Ready)</h2>
              <div className="space-y-3">
                <div><label className="text-xs text-gray-500">Select Appointment</label>
                  <select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiApptId} onChange={e=>setAiApptId(e.target.value)}>
                    <option value="">— Load appointments first (switch to Appointments tab) —</option>
                    {appointments.map(a=><option key={a.id} value={a.id}>{a.first_name} {a.last_name} — {fmtDt(a.scheduled_at)} — {a.service_name}</option>)}
                  </select>
                </div>
                <button onClick={generateAiNotes} disabled={!aiApptId||aiLoading} className="w-full py-2 bg-teal-600 text-white rounded text-sm hover:bg-teal-700 disabled:opacity-50">{aiLoading?'Generating with AI…':'Generate Treatment Notes'}</button>
              </div>
              {aiNotes&&<div className="mt-4 p-4 bg-slate-50 border rounded-lg"><pre className="text-xs whitespace-pre-wrap font-mono text-slate-700">{aiNotes}</pre></div>}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddClient&&<AddClientModal onClose={()=>setShowAddClient(false)} onSaved={()=>{setShowAddClient(false);loadClients();}}/>}
      {showAddAppt&&<AddApptModal clients={clients} services={services} onClose={()=>setShowAddAppt(false)} onSaved={()=>{setShowAddAppt(false);loadAppts();}}/>}
      {showAddService&&<AddServiceModal onClose={()=>setShowAddService(false)} onSaved={()=>{setShowAddService(false);loadServices();}}/>}
      {showGiftCard&&<CreateGiftCardModal onClose={()=>setShowGiftCard(false)} onSaved={()=>{setShowGiftCard(false);loadGiftCards();}}/>}
      {completeAppt&&<CompleteApptModal appt={completeAppt} onClose={()=>setCompleteAppt(null)} onSaved={()=>{setCompleteAppt(null);loadAppts();loadDash();}}/>}
    </div>
  );
}
