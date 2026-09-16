'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard','students','sessions','assessments','invoices','ai-tools','reports'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab,string> = {
  dashboard:'Dashboard', students:'Students', sessions:'Sessions',
  assessments:'Assessments', invoices:'Invoices', 'ai-tools':'AI Tutor Tools', reports:'Reports',
};

const GRADE_LEVELS=['Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6','Grade 7','Grade 8','Grade 9','Grade 10','Grade 11','Grade 12','College Prep'];
const SCHOOL_BOARDS=['CBE','CCSD','CSSD','FHSD','Rocky_View','Other'];
const SESSION_TYPES=['in_person','online','hybrid'];
const SESSION_FREQUENCIES=['twice_weekly','weekly','bi_weekly','as_needed'];
const PROGRESS_LEVELS=['excellent','good','steady','needs_support','struggling'];
const SESSION_STATUSES=['scheduled','completed','student_absent','tutor_absent','cancelled'];
const COMMON_SUBJECTS=['Math','English','Science','Physics','Chemistry','Biology','Social Studies','French','Calculus','Pre-Calculus','Reading','Writing'];

interface DashData{active_students:number;sessions_today:number;sessions_this_week:number;revenue_mtd:number;unpaid_invoices:number;unpaid_total:number;}
interface Student{id:number;first_name:string;last_name:string;email:string;phone:string;parent_name:string;parent_phone:string;parent_email:string;grade_level:string;school:string;school_board:string;subjects_needed:string[];learning_goals:string;learning_challenges:string;iep_student:boolean;preferred_tutor:string;session_type:string;session_frequency:string;hourly_rate:number;status:string;}
interface Session{id:number;student_id:number;tutor:string;session_date:string;start_time:string;end_time:string;subject:string;topics_covered:string[];student_progress:string;status:string;session_notes:string;parent_communication_sent:boolean;amount_billed:number;first_name:string;last_name:string;grade_level:string;}
interface Assessment{id:number;student_id:number;assessment_date:string;assessed_by:string;subject:string;strengths:string[];weaknesses:string[];current_grade_estimate:string;target_grade:string;recommended_sessions_per_week:number;first_name:string;last_name:string;}
interface Invoice{id:number;student_id:number;invoice_date:string;period_start:string;period_end:string;sessions_count:number;amount:number;status:string;paid_date:string;payment_method:string;first_name:string;last_name:string;}

function fmtCad(n:number){return `$${Number(n??0).toLocaleString('en-CA',{minimumFractionDigits:2,maximumFractionDigits:2})}`;}
function fmtDate(d:string){return d?new Date(d).toLocaleDateString('en-CA'):'—';}
function Badge({label,color='gray'}:{label:string;color?:string}){
  const m:Record<string,string>={blue:'bg-blue-100 text-blue-700',green:'bg-green-100 text-green-700',amber:'bg-amber-100 text-amber-700',red:'bg-red-100 text-red-700',purple:'bg-purple-100 text-purple-700',gray:'bg-gray-100 text-gray-700',teal:'bg-teal-100 text-teal-700',rose:'bg-rose-100 text-rose-700',indigo:'bg-indigo-100 text-indigo-700'};
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${m[color]??m.gray}`}>{label.replace(/_/g,' ')}</span>;
}
function KpiCard({label,value,sub,color='blue'}:{label:string;value:string|number;sub?:string;color?:string}){
  const b:Record<string,string>={blue:'border-l-4 border-blue-500 bg-blue-50',green:'border-l-4 border-green-500 bg-green-50',amber:'border-l-4 border-amber-500 bg-amber-50',purple:'border-l-4 border-purple-500 bg-purple-50',red:'border-l-4 border-red-500 bg-red-50'};
  return <div className={`rounded-lg p-4 ${b[color]??b.blue}`}><p className="text-sm text-gray-500">{label}</p><p className="text-2xl font-bold mt-1">{value}</p>{sub&&<p className="text-xs text-gray-400 mt-1">{sub}</p>}</div>;
}
function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:React.ReactNode}){
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"><div className="bg-white rounded-xl shadow-2xl w-full max-w-xl p-6 overflow-y-auto max-h-[90vh]"><div className="flex justify-between items-center mb-4"><h2 className="text-lg font-bold text-slate-800">{title}</h2><button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button></div>{children}</div></div>;
}
function progressColor(p:string){const m:Record<string,string>={excellent:'green',good:'teal',steady:'blue',needs_support:'amber',struggling:'red'};return m[p]??'gray';}
function statusColor(s:string){const m:Record<string,string>={unpaid:'amber',paid:'green',partial:'blue',overdue:'red',scheduled:'blue',completed:'green',student_absent:'amber',tutor_absent:'rose',cancelled:'gray'};return m[s]??'gray';}

function AddStudentModal({onClose,onSaved}:{onClose:()=>void;onSaved:()=>void}){
  const [form,setForm]=useState({first_name:'',last_name:'',email:'',phone:'',parent_name:'',parent_phone:'',parent_email:'',grade_level:'Grade 9',school:'',school_board:'CBE',subjects_needed:'',learning_goals:'',learning_challenges:'',iep_student:false,preferred_tutor:'',session_type:'in_person',session_frequency:'weekly',hourly_rate:'',monthly_package_rate:'',notes:''});
  const [saving,setSaving]=useState(false);
  const f=(k:string,v:string|boolean)=>setForm(p=>({...p,[k]:v}));
  async function submit(){
    if(!form.first_name||!form.last_name||!form.subjects_needed)return;
    setSaving(true);
    try{
      await fetch('/api/admin/tutoring-center/students',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        ...form,
        subjects_needed:form.subjects_needed.split(',').map(s=>s.trim()).filter(Boolean),
        hourly_rate:form.hourly_rate?parseFloat(form.hourly_rate):null,
        monthly_package_rate:form.monthly_package_rate?parseFloat(form.monthly_package_rate):null,
      })});
      onSaved();
    }finally{setSaving(false);}
  }
  return <Modal title="Add New Student" onClose={onClose}>
    <div className="grid grid-cols-2 gap-3">
      <div><label className="text-xs text-gray-500">First Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.first_name} onChange={e=>f('first_name',e.target.value)}/></div>
      <div><label className="text-xs text-gray-500">Last Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.last_name} onChange={e=>f('last_name',e.target.value)}/></div>
      <div><label className="text-xs text-gray-500">Grade Level *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.grade_level} onChange={e=>f('grade_level',e.target.value)}>{GRADE_LEVELS.map(g=><option key={g}>{g}</option>)}</select></div>
      <div><label className="text-xs text-gray-500">School Board</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.school_board} onChange={e=>f('school_board',e.target.value)}>{SCHOOL_BOARDS.map(b=><option key={b}>{b}</option>)}</select></div>
      <div className="col-span-2"><label className="text-xs text-gray-500">School</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.school} onChange={e=>f('school',e.target.value)}/></div>
      <div className="col-span-2"><label className="text-xs text-gray-500">Subjects Needed * (comma-separated)</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.subjects_needed} onChange={e=>f('subjects_needed',e.target.value)} placeholder="Math, English"/></div>
      <div><label className="text-xs text-gray-500">Student Phone</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.phone} onChange={e=>f('phone',e.target.value)}/></div>
      <div><label className="text-xs text-gray-500">Student Email</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.email} onChange={e=>f('email',e.target.value)}/></div>
      <div><label className="text-xs text-gray-500">Parent/Guardian Name</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.parent_name} onChange={e=>f('parent_name',e.target.value)}/></div>
      <div><label className="text-xs text-gray-500">Parent Phone</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.parent_phone} onChange={e=>f('parent_phone',e.target.value)}/></div>
      <div><label className="text-xs text-gray-500">Parent Email</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.parent_email} onChange={e=>f('parent_email',e.target.value)}/></div>
      <div><label className="text-xs text-gray-500">Preferred Tutor</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.preferred_tutor} onChange={e=>f('preferred_tutor',e.target.value)}/></div>
      <div><label className="text-xs text-gray-500">Session Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.session_type} onChange={e=>f('session_type',e.target.value)}>{SESSION_TYPES.map(t=><option key={t} value={t}>{t.replace('_',' ')}</option>)}</select></div>
      <div><label className="text-xs text-gray-500">Frequency</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.session_frequency} onChange={e=>f('session_frequency',e.target.value)}>{SESSION_FREQUENCIES.map(f=><option key={f} value={f}>{f.replace('_',' ')}</option>)}</select></div>
      <div><label className="text-xs text-gray-500">Hourly Rate ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.hourly_rate} onChange={e=>f('hourly_rate',e.target.value)}/></div>
      <div><label className="text-xs text-gray-500">Monthly Package ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.monthly_package_rate} onChange={e=>f('monthly_package_rate',e.target.value)}/></div>
      <div className="flex items-center gap-2"><input type="checkbox" checked={form.iep_student} onChange={e=>f('iep_student',e.target.checked)}/><label className="text-sm">IEP Student</label></div>
      <div className="col-span-2"><label className="text-xs text-gray-500">Learning Goals</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.learning_goals} onChange={e=>f('learning_goals',e.target.value)}/></div>
      <div className="col-span-2"><label className="text-xs text-gray-500">Learning Challenges</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.learning_challenges} onChange={e=>f('learning_challenges',e.target.value)}/></div>
    </div>
    <div className="flex justify-end gap-2 mt-4"><button onClick={onClose} className="px-4 py-2 border rounded text-sm">Cancel</button><button onClick={submit} disabled={saving||!form.first_name||!form.last_name||!form.subjects_needed} className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50">{saving?'Saving…':'Add Student'}</button></div>
  </Modal>;
}

function AddSessionModal({students,onClose,onSaved}:{students:Student[];onClose:()=>void;onSaved:()=>void}){
  const [form,setForm]=useState({student_id:'',tutor:'',session_date:'',start_time:'',end_time:'',subject:'',amount_billed:''});
  const [saving,setSaving]=useState(false);
  const f=(k:string,v:string)=>setForm(p=>({...p,[k]:v}));
  const sel=students.find(s=>String(s.id)===form.student_id);
  async function submit(){
    if(!form.student_id||!form.tutor||!form.session_date||!form.start_time||!form.subject)return;
    setSaving(true);
    try{
      await fetch('/api/admin/tutoring-center/sessions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,student_id:parseInt(form.student_id),amount_billed:form.amount_billed?parseFloat(form.amount_billed):null})});
      onSaved();
    }finally{setSaving(false);}
  }
  return <Modal title="Add Session" onClose={onClose}>
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2"><label className="text-xs text-gray-500">Student *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.student_id} onChange={e=>f('student_id',e.target.value)}><option value="">— Select student —</option>{students.map(s=><option key={s.id} value={s.id}>{s.first_name} {s.last_name} — {s.grade_level}</option>)}</select></div>
      <div className="col-span-2"><label className="text-xs text-gray-500">Subject *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.subject} onChange={e=>f('subject',e.target.value)}><option value="">—</option>{[...(sel?.subjects_needed||[]),...COMMON_SUBJECTS.filter(s=>!sel?.subjects_needed?.includes(s))].map(s=><option key={s}>{s}</option>)}</select></div>
      <div><label className="text-xs text-gray-500">Tutor *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.tutor} onChange={e=>f('tutor',e.target.value)} placeholder={sel?.preferred_tutor||''}/></div>
      <div><label className="text-xs text-gray-500">Date *</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.session_date} onChange={e=>f('session_date',e.target.value)}/></div>
      <div><label className="text-xs text-gray-500">Start Time *</label><input type="time" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.start_time} onChange={e=>f('start_time',e.target.value)}/></div>
      <div><label className="text-xs text-gray-500">End Time</label><input type="time" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.end_time} onChange={e=>f('end_time',e.target.value)}/></div>
      <div><label className="text-xs text-gray-500">Amount Billed ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.amount_billed} onChange={e=>f('amount_billed',e.target.value)} placeholder={sel?String(sel.hourly_rate||''):''}/></div>
    </div>
    <div className="flex justify-end gap-2 mt-4"><button onClick={onClose} className="px-4 py-2 border rounded text-sm">Cancel</button><button onClick={submit} disabled={saving||!form.student_id||!form.tutor||!form.session_date||!form.start_time||!form.subject} className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50">{saving?'Saving…':'Add Session'}</button></div>
  </Modal>;
}

function CompleteSessionModal({session,onClose,onSaved}:{session:Session;onClose:()=>void;onSaved:()=>void}){
  const [form,setForm]=useState({topics_covered:'',homework_assigned:'',student_progress:'good',session_notes:'',parent_communication_sent:false});
  const [saving,setSaving]=useState(false);
  const f=(k:string,v:string|boolean)=>setForm(p=>({...p,[k]:v}));
  async function submit(){
    setSaving(true);
    try{
      await fetch(`/api/admin/tutoring-center/sessions/${session.id}/complete`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        ...form,
        topics_covered:form.topics_covered?form.topics_covered.split(',').map(s=>s.trim()).filter(Boolean):[],
      })});
      onSaved();
    }finally{setSaving(false);}
  }
  return <Modal title={`Complete Session: ${session.first_name} ${session.last_name} — ${session.subject}`} onClose={onClose}>
    <div className="space-y-3">
      <div><label className="text-xs text-gray-500">Topics Covered (comma-separated)</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.topics_covered} onChange={e=>f('topics_covered',e.target.value)}/></div>
      <div><label className="text-xs text-gray-500">Homework Assigned</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.homework_assigned} onChange={e=>f('homework_assigned',e.target.value)}/></div>
      <div><label className="text-xs text-gray-500">Student Progress</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.student_progress} onChange={e=>f('student_progress',e.target.value)}>{PROGRESS_LEVELS.map(p=><option key={p} value={p}>{p.replace('_',' ')}</option>)}</select></div>
      <div><label className="text-xs text-gray-500">Session Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={3} value={form.session_notes} onChange={e=>f('session_notes',e.target.value)}/></div>
      <div className="flex items-center gap-2"><input type="checkbox" checked={form.parent_communication_sent} onChange={e=>f('parent_communication_sent',e.target.checked)}/><label className="text-sm">Parent communication sent</label></div>
    </div>
    <div className="flex justify-end gap-2 mt-4"><button onClick={onClose} className="px-4 py-2 border rounded text-sm">Cancel</button><button onClick={submit} disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50">{saving?'Saving…':'Complete Session'}</button></div>
  </Modal>;
}

function MarkPaidModal({invoice,onClose,onSaved}:{invoice:Invoice;onClose:()=>void;onSaved:()=>void}){
  const [form,setForm]=useState({paid_date:new Date().toISOString().split('T')[0],payment_method:'etransfer'});
  const [saving,setSaving]=useState(false);
  async function submit(){
    setSaving(true);
    try{
      await fetch(`/api/admin/tutoring-center/invoices/${invoice.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({mark_paid:true,...form})});
      onSaved();
    }finally{setSaving(false);}
  }
  return <Modal title={`Mark Paid: ${invoice.first_name} ${invoice.last_name}`} onClose={onClose}>
    <p className="text-sm text-gray-600 mb-3">Amount: <strong>{fmtCad(invoice.amount)}</strong></p>
    <div className="grid grid-cols-2 gap-3">
      <div><label className="text-xs text-gray-500">Paid Date</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.paid_date} onChange={e=>setForm(p=>({...p,paid_date:e.target.value}))}/></div>
      <div><label className="text-xs text-gray-500">Payment Method</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.payment_method} onChange={e=>setForm(p=>({...p,payment_method:e.target.value}))}>
        {['cash','cheque','etransfer','credit','debit'].map(m=><option key={m}>{m}</option>)}
      </select></div>
    </div>
    <div className="flex justify-end gap-2 mt-4"><button onClick={onClose} className="px-4 py-2 border rounded text-sm">Cancel</button><button onClick={submit} disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50">{saving?'Saving…':'Mark Paid'}</button></div>
  </Modal>;
}

export default function TutoringCenterPage() {
  const [tab, setTab]=useState<Tab>('dashboard');
  const [dash, setDash]=useState<DashData|null>(null);
  const [students, setStudents]=useState<Student[]>([]);
  const [sessions, setSessions]=useState<Session[]>([]);
  const [assessments, setAssessments]=useState<Assessment[]>([]);
  const [invoices, setInvoices]=useState<Invoice[]>([]);
  const [gradeFilter, setGradeFilter]=useState('');
  const [subjectFilter, setSubjectFilter]=useState('');
  const [statusFilter, setStatusFilter]=useState('');
  const [sessionDate, setSessionDate]=useState(new Date().toISOString().split('T')[0]);
  const [showAddStudent, setShowAddStudent]=useState(false);
  const [showAddSession, setShowAddSession]=useState(false);
  const [completeSession, setCompleteSession]=useState<Session|null>(null);
  const [markPaidInvoice, setMarkPaidInvoice]=useState<Invoice|null>(null);
  // AI tools
  const [aiTool, setAiTool]=useState<'lesson'|'report'>('lesson');
  const [lessonForm, setLessonForm]=useState({subject:'Math',grade_level:'Grade 9',topics:'',learning_challenges:'',duration:'60'});
  const [reportForm, setReportForm]=useState({student_name:'',grade_level:'Grade 9',subject:'Math',sessions_count:'',student_progress_trend:'steady',strengths:'',weaknesses:'',learning_goals:''});
  const [aiOutput, setAiOutput]=useState('');
  const [aiLoading, setAiLoading]=useState(false);

  const loadDash=useCallback(async()=>{const r=await fetch('/api/admin/tutoring-center');if(r.ok)setDash(await r.json());},[]);
  const loadStudents=useCallback(async()=>{const r=await fetch(`/api/admin/tutoring-center/students?subject=${subjectFilter}&grade=${gradeFilter}&status=${statusFilter}`);if(r.ok)setStudents(await r.json());},[subjectFilter,gradeFilter,statusFilter]);
  const loadSessions=useCallback(async()=>{const r=await fetch(`/api/admin/tutoring-center/sessions?date=${sessionDate}&status=${statusFilter}`);if(r.ok)setSessions(await r.json());},[sessionDate,statusFilter]);
  const loadAssessments=useCallback(async()=>{const r=await fetch('/api/admin/tutoring-center/assessments');if(r.ok)setAssessments(await r.json());},[]);
  const loadInvoices=useCallback(async()=>{const r=await fetch(`/api/admin/tutoring-center/invoices?status=${statusFilter}`);if(r.ok)setInvoices(await r.json());},[statusFilter]);

  useEffect(()=>{loadDash();},[loadDash]);
  useEffect(()=>{if(tab==='students')loadStudents();},[tab,loadStudents]);
  useEffect(()=>{if(tab==='sessions')loadSessions();},[tab,loadSessions]);
  useEffect(()=>{if(tab==='assessments')loadAssessments();},[tab,loadAssessments]);
  useEffect(()=>{if(tab==='invoices')loadInvoices();},[tab,loadInvoices]);

  async function changeSessionStatus(id:number, status:string){
    await fetch(`/api/admin/tutoring-center/sessions/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})});
    loadSessions();
  }

  async function generateAI(){
    setAiLoading(true);setAiOutput('');
    try{
      const url=aiTool==='lesson'?'/api/admin/tutoring-center/ai-lesson-plan':'/api/admin/tutoring-center/ai-progress-report';
      const body=aiTool==='lesson'?{...lessonForm,topics:lessonForm.topics.split(',').map(s=>s.trim()).filter(Boolean)}:{...reportForm,strengths:reportForm.strengths.split(',').map(s=>s.trim()).filter(Boolean),weaknesses:reportForm.weaknesses.split(',').map(s=>s.trim()).filter(Boolean)};
      const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      const d=await r.json() as {plan?:string;report?:string};
      setAiOutput(d.plan||d.report||'No output');
    }finally{setAiLoading(false);}
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-2xl font-bold text-slate-800">Tutoring Center & Academic Services Hub</h1>
        <p className="text-sm text-gray-500 mt-1">Students · Sessions · Assessments · Invoices · AI Tools · Reports — Alberta Curriculum</p>
      </div>
      <div className="bg-white border-b px-6">
        <nav className="flex gap-1">
          {TABS.map(t=><button key={t} onClick={()=>setTab(t)} className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab===t?'border-blue-600 text-blue-700':'border-transparent text-gray-500 hover:text-gray-700'}`}>{TAB_LABELS[t]}</button>)}
        </nav>
      </div>
      <div className="p-6">

        {/* ── DASHBOARD ── */}
        {tab==='dashboard'&&(
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <KpiCard label="Active Students" value={dash?.active_students??'…'} color="blue"/>
              <KpiCard label="Sessions Today" value={dash?.sessions_today??'…'} color="green"/>
              <KpiCard label="Sessions This Week" value={dash?.sessions_this_week??'…'} color="purple"/>
              <KpiCard label="Revenue MTD" value={dash?fmtCad(dash.revenue_mtd):'…'} color="green"/>
              <KpiCard label="Unpaid Invoices" value={dash?.unpaid_invoices??'…'} sub={dash?fmtCad(dash.unpaid_total):undefined} color="red"/>
            </div>
            {dash&&dash.unpaid_invoices>0&&<div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
              <span className="text-amber-600 font-bold text-lg">!</span>
              <div><p className="font-medium text-amber-800">{dash.unpaid_invoices} unpaid invoice{dash.unpaid_invoices>1?'s':''} totalling {fmtCad(dash.unpaid_total)}</p><p className="text-xs text-amber-600">Review in the Invoices tab</p></div>
            </div>}
          </div>
        )}

        {/* ── STUDENTS ── */}
        {tab==='students'&&(
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 items-center">
              <select className="border rounded px-2 py-1.5 text-sm" value={gradeFilter} onChange={e=>setGradeFilter(e.target.value)}><option value="">All Grades</option>{GRADE_LEVELS.map(g=><option key={g}>{g}</option>)}</select>
              <select className="border rounded px-2 py-1.5 text-sm" value={subjectFilter} onChange={e=>setSubjectFilter(e.target.value)}><option value="">All Subjects</option>{COMMON_SUBJECTS.map(s=><option key={s}>{s}</option>)}</select>
              <select className="border rounded px-2 py-1.5 text-sm" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="">All Statuses</option><option value="active">Active</option><option value="on_hold">On Hold</option><option value="completed">Completed</option></select>
              <button onClick={loadStudents} className="px-3 py-1.5 bg-gray-100 border rounded text-sm hover:bg-gray-200">Filter</button>
              <button onClick={()=>setShowAddStudent(true)} className="ml-auto px-4 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">+ Add Student</button>
            </div>
            <div className="grid gap-3">
              {students.map(s=>(
                <div key={s.id} className="bg-white border rounded-xl p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{s.first_name} {s.last_name}</span>
                        <Badge label={s.grade_level} color="blue"/>
                        {s.iep_student&&<Badge label="IEP" color="purple"/>}
                        <Badge label={s.session_frequency} color="gray"/>
                        <Badge label={s.session_type} color="teal"/>
                        <Badge label={s.status} color={s.status==='active'?'green':s.status==='on_hold'?'amber':'gray'}/>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">Subjects: {s.subjects_needed?.join(', ')}</p>
                      {s.preferred_tutor&&<p className="text-xs text-gray-400">Tutor: {s.preferred_tutor}</p>}
                      {s.parent_name&&<p className="text-xs text-gray-400">Parent: {s.parent_name} · {s.parent_phone}</p>}
                      {s.learning_challenges&&<p className="text-xs text-amber-600 mt-1">Challenges: {s.learning_challenges}</p>}
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-sm">{s.hourly_rate?`${fmtCad(s.hourly_rate)}/hr`:''}</p>
                      {s.monthly_package_rate&&<p className="text-xs text-gray-400">{fmtCad(s.monthly_package_rate)}/mo</p>}
                      <p className="text-xs text-gray-400">{s.school_board}</p>
                    </div>
                  </div>
                </div>
              ))}
              {students.length===0&&<div className="bg-white border rounded-xl p-8 text-center text-gray-400">No students found</div>}
            </div>
          </div>
        )}

        {/* ── SESSIONS ── */}
        {tab==='sessions'&&(
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 items-center">
              <input type="date" className="border rounded px-2 py-1.5 text-sm" value={sessionDate} onChange={e=>setSessionDate(e.target.value)}/>
              <select className="border rounded px-2 py-1.5 text-sm" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="">All Statuses</option>{SESSION_STATUSES.map(s=><option key={s} value={s}>{s.replace('_',' ')}</option>)}</select>
              <button onClick={loadSessions} className="px-3 py-1.5 bg-gray-100 border rounded text-sm hover:bg-gray-200">Filter</button>
              <button onClick={()=>{loadStudents();setShowAddSession(true);}} className="ml-auto px-4 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">+ Add Session</button>
            </div>
            <div className="grid gap-3">
              {sessions.map(s=>(
                <div key={s.id} className="bg-white border rounded-xl p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{s.first_name} {s.last_name}</span>
                        <Badge label={s.grade_level} color="blue"/>
                        <Badge label={s.subject} color="indigo"/>
                        <Badge label={s.status} color={statusColor(s.status)}/>
                        {s.student_progress&&<Badge label={s.student_progress} color={progressColor(s.student_progress)}/>}
                        {s.parent_communication_sent&&<Badge label="parent notified" color="teal"/>}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{fmtDate(s.session_date)} · {s.start_time}–{s.end_time} · Tutor: {s.tutor}</p>
                      {s.topics_covered?.length>0&&<p className="text-xs text-gray-400">Topics: {s.topics_covered.join(', ')}</p>}
                      {s.session_notes&&<p className="text-xs text-gray-500 mt-1 italic">&ldquo;{s.session_notes}&rdquo;</p>}
                    </div>
                    <div className="flex flex-col gap-1 ml-4 items-end">
                      {s.amount_billed&&<span className="text-sm font-medium text-green-700">{fmtCad(s.amount_billed)}</span>}
                      {s.status==='scheduled'&&<>
                        <button onClick={()=>setCompleteSession(s)} className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700">Complete</button>
                        <button onClick={()=>changeSessionStatus(s.id,'student_absent')} className="px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded text-xs">Student Absent</button>
                        <button onClick={()=>changeSessionStatus(s.id,'cancelled')} className="px-2 py-1 bg-gray-100 text-gray-700 border rounded text-xs">Cancel</button>
                      </>}
                    </div>
                  </div>
                </div>
              ))}
              {sessions.length===0&&<div className="bg-white border rounded-xl p-8 text-center text-gray-400">No sessions found</div>}
            </div>
          </div>
        )}

        {/* ── ASSESSMENTS ── */}
        {tab==='assessments'&&(
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold text-slate-700">Student Assessments</h2>
              <button onClick={loadAssessments} className="px-3 py-1.5 bg-gray-100 border rounded text-sm hover:bg-gray-200">Refresh</button>
            </div>
            <div className="grid gap-3">
              {assessments.map(a=>(
                <div key={a.id} className="bg-white border rounded-xl p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{a.first_name} {a.last_name}</span>
                        <Badge label={a.subject} color="indigo"/>
                        {a.current_grade_estimate&&<Badge label={`Current: ${a.current_grade_estimate}`} color="amber"/>}
                        {a.target_grade&&<Badge label={`Target: ${a.target_grade}`} color="green"/>}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{fmtDate(a.assessment_date)} · Assessed by: {a.assessed_by}</p>
                      {a.strengths?.length>0&&<p className="text-xs text-green-600 mt-1">Strengths: {a.strengths.join(', ')}</p>}
                      {a.weaknesses?.length>0&&<p className="text-xs text-amber-600">Needs work: {a.weaknesses.join(', ')}</p>}
                    </div>
                    <div className="text-right"><p className="text-sm font-medium">{a.recommended_sessions_per_week}x/week</p><p className="text-xs text-gray-400">recommended</p></div>
                  </div>
                </div>
              ))}
              {assessments.length===0&&<div className="bg-white border rounded-xl p-8 text-center text-gray-400">No assessments yet</div>}
            </div>
          </div>
        )}

        {/* ── INVOICES ── */}
        {tab==='invoices'&&(
          <div className="space-y-4">
            <div className="flex gap-3 items-center flex-wrap">
              <select className="border rounded px-2 py-1.5 text-sm" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="">All Statuses</option>{['unpaid','paid','partial','overdue'].map(s=><option key={s} value={s}>{s}</option>)}</select>
              <button onClick={loadInvoices} className="px-3 py-1.5 bg-gray-100 border rounded text-sm hover:bg-gray-200">Filter</button>
            </div>
            <div className="bg-white border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b"><tr>{['Student','Period','Sessions','Amount','Status','Paid Date','Actions'].map(h=><th key={h} className="text-left px-4 py-2 text-xs font-semibold text-gray-500">{h}</th>)}</tr></thead>
                <tbody>
                  {invoices.map(inv=>(
                    <tr key={inv.id} className={`border-b hover:bg-gray-50 ${inv.status==='overdue'?'bg-red-50':''}`}>
                      <td className="px-4 py-2 font-medium">{inv.first_name} {inv.last_name}</td>
                      <td className="px-4 py-2 text-xs text-gray-500">{fmtDate(inv.period_start)}–{fmtDate(inv.period_end)}</td>
                      <td className="px-4 py-2">{inv.sessions_count||'—'}</td>
                      <td className="px-4 py-2 font-medium">{fmtCad(inv.amount)}</td>
                      <td className="px-4 py-2"><Badge label={inv.status} color={statusColor(inv.status)}/></td>
                      <td className="px-4 py-2 text-xs">{fmtDate(inv.paid_date)}</td>
                      <td className="px-4 py-2">{inv.status!=='paid'&&<button onClick={()=>setMarkPaidInvoice(inv)} className="px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded text-xs hover:bg-green-100">Mark Paid</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {invoices.length===0&&<p className="text-center text-gray-400 py-6 text-sm">No invoices found</p>}
            </div>
          </div>
        )}

        {/* ── AI TUTOR TOOLS ── */}
        {tab==='ai-tools'&&(
          <div className="max-w-3xl space-y-4">
            <div className="flex gap-2 mb-4">
              <button onClick={()=>{setAiTool('lesson');setAiOutput('');}} className={`px-4 py-2 rounded text-sm font-medium ${aiTool==='lesson'?'bg-blue-600 text-white':'bg-white border hover:bg-gray-50'}`}>Lesson Plan Generator</button>
              <button onClick={()=>{setAiTool('report');setAiOutput('');}} className={`px-4 py-2 rounded text-sm font-medium ${aiTool==='report'?'bg-blue-600 text-white':'bg-white border hover:bg-gray-50'}`}>Progress Report Writer</button>
            </div>
            <div className="bg-white border rounded-xl p-5">
              {aiTool==='lesson'&&(
                <div className="space-y-3">
                  <h3 className="font-semibold text-slate-700">Lesson Plan Generator (Alberta Curriculum)</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-xs text-gray-500">Subject</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={lessonForm.subject} onChange={e=>setLessonForm(p=>({...p,subject:e.target.value}))}>{COMMON_SUBJECTS.map(s=><option key={s}>{s}</option>)}</select></div>
                    <div><label className="text-xs text-gray-500">Grade Level</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={lessonForm.grade_level} onChange={e=>setLessonForm(p=>({...p,grade_level:e.target.value}))}>{GRADE_LEVELS.map(g=><option key={g}>{g}</option>)}</select></div>
                    <div><label className="text-xs text-gray-500">Duration (min)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={lessonForm.duration} onChange={e=>setLessonForm(p=>({...p,duration:e.target.value}))}/></div>
                    <div><label className="text-xs text-gray-500">Topics (comma-separated)</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={lessonForm.topics} onChange={e=>setLessonForm(p=>({...p,topics:e.target.value}))}/></div>
                    <div className="col-span-2"><label className="text-xs text-gray-500">Student Challenges</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={lessonForm.learning_challenges} onChange={e=>setLessonForm(p=>({...p,learning_challenges:e.target.value}))}/></div>
                  </div>
                </div>
              )}
              {aiTool==='report'&&(
                <div className="space-y-3">
                  <h3 className="font-semibold text-slate-700">Progress Report Writer (Parent-Friendly)</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-xs text-gray-500">Student Name</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={reportForm.student_name} onChange={e=>setReportForm(p=>({...p,student_name:e.target.value}))}/></div>
                    <div><label className="text-xs text-gray-500">Grade Level</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={reportForm.grade_level} onChange={e=>setReportForm(p=>({...p,grade_level:e.target.value}))}>{GRADE_LEVELS.map(g=><option key={g}>{g}</option>)}</select></div>
                    <div><label className="text-xs text-gray-500">Subject</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={reportForm.subject} onChange={e=>setReportForm(p=>({...p,subject:e.target.value}))}>{COMMON_SUBJECTS.map(s=><option key={s}>{s}</option>)}</select></div>
                    <div><label className="text-xs text-gray-500">Sessions Completed</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={reportForm.sessions_count} onChange={e=>setReportForm(p=>({...p,sessions_count:e.target.value}))}/></div>
                    <div><label className="text-xs text-gray-500">Overall Progress</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={reportForm.student_progress_trend} onChange={e=>setReportForm(p=>({...p,student_progress_trend:e.target.value}))}>{PROGRESS_LEVELS.map(p=><option key={p} value={p}>{p.replace('_',' ')}</option>)}</select></div>
                    <div><label className="text-xs text-gray-500">Strengths (comma-separated)</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={reportForm.strengths} onChange={e=>setReportForm(p=>({...p,strengths:e.target.value}))}/></div>
                    <div><label className="text-xs text-gray-500">Areas to Improve (comma-separated)</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={reportForm.weaknesses} onChange={e=>setReportForm(p=>({...p,weaknesses:e.target.value}))}/></div>
                    <div className="col-span-2"><label className="text-xs text-gray-500">Learning Goals</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={reportForm.learning_goals} onChange={e=>setReportForm(p=>({...p,learning_goals:e.target.value}))}/></div>
                  </div>
                </div>
              )}
              <button onClick={generateAI} disabled={aiLoading} className="mt-4 w-full py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50">{aiLoading?'Generating with AI…':`Generate ${aiTool==='lesson'?'Lesson Plan':'Progress Report'}`}</button>
              {aiOutput&&<div className="mt-4 p-4 bg-slate-50 border rounded-lg"><pre className="text-xs whitespace-pre-wrap font-mono text-slate-700">{aiOutput}</pre></div>}
            </div>
          </div>
        )}

        {/* ── REPORTS ── */}
        {tab==='reports'&&(
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border rounded-xl p-4">
              <h3 className="font-semibold text-slate-700 mb-3">Subject Distribution</h3>
              {Array.from(new Set(students.flatMap(s=>s.subjects_needed||[]))).slice(0,10).map(sub=>{
                const count=students.filter(s=>s.subjects_needed?.includes(sub)).length;
                return <div key={sub} className="flex items-center gap-2 mb-2"><span className="text-sm w-28 truncate">{sub}</span><div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden"><div className="bg-blue-500 h-3 rounded-full" style={{width:`${students.length?count/students.length*100:0}%`}}/></div><span className="text-xs text-gray-500 w-6">{count}</span></div>;
              })}
              {students.length===0&&<p className="text-xs text-gray-400">Load Students tab first</p>}
            </div>
            <div className="bg-white border rounded-xl p-4">
              <h3 className="font-semibold text-slate-700 mb-3">Grade Level Breakdown</h3>
              {Array.from(new Set(students.map(s=>s.grade_level))).map(g=>{
                const count=students.filter(s=>s.grade_level===g).length;
                return <div key={g} className="flex items-center gap-2 mb-2"><span className="text-sm w-28 truncate">{g}</span><div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden"><div className="bg-purple-500 h-3 rounded-full" style={{width:`${students.length?count/students.length*100:0}%`}}/></div><span className="text-xs text-gray-500 w-6">{count}</span></div>;
              })}
              {students.length===0&&<p className="text-xs text-gray-400">Load Students tab first</p>}
            </div>
            <div className="bg-white border rounded-xl p-4">
              <h3 className="font-semibold text-slate-700 mb-3">Session Progress Distribution</h3>
              {PROGRESS_LEVELS.map(p=>{
                const count=sessions.filter(s=>s.student_progress===p).length;
                return <div key={p} className="flex items-center gap-2 mb-2"><span className="text-sm w-32 truncate">{p.replace('_',' ')}</span><div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden"><div className={`h-3 rounded-full ${p==='excellent'?'bg-green-500':p==='good'?'bg-teal-500':p==='steady'?'bg-blue-500':p==='needs_support'?'bg-amber-500':'bg-red-500'}`} style={{width:`${sessions.length?count/sessions.length*100:0}%`}}/></div><span className="text-xs text-gray-500 w-6">{count}</span></div>;
              })}
              {sessions.length===0&&<p className="text-xs text-gray-400">Load Sessions tab first</p>}
            </div>
            <div className="bg-white border rounded-xl p-4">
              <h3 className="font-semibold text-slate-700 mb-2">Invoice Summary</h3>
              {['unpaid','paid','overdue','partial'].map(s=>{
                const filtered=invoices.filter(i=>i.status===s);
                const total=filtered.reduce((sum,i)=>sum+parseFloat(String(i.amount)),0);
                return <div key={s} className="flex justify-between items-center py-1 border-b last:border-0"><span className="text-sm">{s}</span><span className="font-medium text-sm">{fmtCad(total)} ({filtered.length})</span></div>;
              })}
              {invoices.length===0&&<p className="text-xs text-gray-400">Load Invoices tab first</p>}
            </div>
          </div>
        )}
      </div>

      {showAddStudent&&<AddStudentModal onClose={()=>setShowAddStudent(false)} onSaved={()=>{setShowAddStudent(false);loadStudents();}}/>}
      {showAddSession&&<AddSessionModal students={students} onClose={()=>setShowAddSession(false)} onSaved={()=>{setShowAddSession(false);loadSessions();}}/>}
      {completeSession&&<CompleteSessionModal session={completeSession} onClose={()=>setCompleteSession(null)} onSaved={()=>{setCompleteSession(null);loadSessions();loadDash();}}/>}
      {markPaidInvoice&&<MarkPaidModal invoice={markPaidInvoice} onClose={()=>setMarkPaidInvoice(null)} onSaved={()=>{setMarkPaidInvoice(null);loadInvoices();loadDash();}}/>}
    </div>
  );
}
