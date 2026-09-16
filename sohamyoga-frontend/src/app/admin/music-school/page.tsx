'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard','students','lessons','recitals','teachers','ai-tools','rcm'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab,string> = {
  dashboard: 'Dashboard', students: 'Students', lessons: 'Lessons',
  recitals: 'Recitals', teachers: 'Teachers', 'ai-tools': 'AI Music Tools', rcm: 'RCM Tracker',
};

const INSTRUMENTS = ['Piano','Guitar','Violin','Cello','Drums','Voice','Flute','Saxophone','Trumpet','Clarinet','Ukulele','Bass','Harp','Viola'];
const SKILL_LEVELS = ['beginner','elementary','intermediate','advanced','performance'];
const LESSON_TYPES = ['private','group','masterclass','online'];
const LESSON_STATUSES = ['scheduled','completed','student_absent','teacher_absent','cancelled','makeup'];
const RCM_LEVELS = ['Prep A','Prep B','1','2','3','4','5','6','7','8','9','10','ARCT'];

interface Student { id:number; first_name:string; last_name:string; email:string; phone:string; instrument:string; skill_level:string; lesson_type:string; lesson_duration:number; teacher:string; monthly_rate:number; status:string; rcm_level:string; next_exam_date:string; practice_goal_minutes:number; enrolled_date:string; }
interface Lesson { id:number; student_id:number; first_name:string; last_name:string; instrument:string; lesson_date:string; start_time:string; end_time:string; teacher:string; status:string; repertoire:string[]; technique_focus:string; homework_assigned:string; }
interface Recital { id:number; title:string; event_date:string; venue:string; status:string; ticket_price:number; performer_count:number; }
interface Teacher { teacher:string; student_count:number; total_lessons:number; lessons_today:number; completed_mtd:number; absences:number; instruments:string[]; }
interface DashData { active_students:number; lessons_today:number; teacher_absent_mtd:number; upcoming_recitals:Recital[]; rcm_exams_30d:Student[]; }

function fmtDate(d:string){ return d ? new Date(d).toLocaleDateString('en-CA') : '—'; }
function fmtTime(t:string){ if(!t) return '—'; const [h,m]=t.split(':'); const hr=parseInt(h); return `${hr%12||12}:${m} ${hr>=12?'PM':'AM'}`; }
function fmtCad(n:number){ return `$${Number(n??0).toLocaleString('en-CA',{minimumFractionDigits:0})}`; }
function daysUntil(d:string){ if(!d) return null; const diff=new Date(d).getTime()-Date.now(); return Math.ceil(diff/864e5); }

function Badge({ label, color='gray' }: { label:string; color?:string }) {
  const m:Record<string,string> = { blue:'bg-blue-100 text-blue-700', green:'bg-green-100 text-green-700', amber:'bg-amber-100 text-amber-700', red:'bg-red-100 text-red-700', purple:'bg-purple-100 text-purple-700', gray:'bg-gray-100 text-gray-700', teal:'bg-teal-100 text-teal-700', indigo:'bg-indigo-100 text-indigo-700' };
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${m[color]??m.gray}`}>{label}</span>;
}
function KpiCard({ label, value, sub, color='blue' }: { label:string; value:string|number; sub?:string; color?:string }) {
  const b:Record<string,string> = { blue:'border-l-4 border-blue-500 bg-blue-50', green:'border-l-4 border-green-500 bg-green-50', amber:'border-l-4 border-amber-500 bg-amber-50', red:'border-l-4 border-red-500 bg-red-50', purple:'border-l-4 border-purple-500 bg-purple-50' };
  return <div className={`rounded-lg p-4 ${b[color]??b.blue}`}><p className="text-sm text-gray-500">{label}</p><p className="text-2xl font-bold mt-1">{value}</p>{sub&&<p className="text-xs text-gray-400 mt-1">{sub}</p>}</div>;
}
function statusColor(s:string){ const m:Record<string,string>={scheduled:'blue',completed:'green',student_absent:'amber',teacher_absent:'red',cancelled:'gray',makeup:'purple',active:'green',on_hold:'amber',withdrawn:'red',planning:'gray',rehearsal:'blue',confirmed:'green',performance:'purple',advanced:'indigo',intermediate:'teal',elementary:'blue',beginner:'gray'}; return m[s]??'gray'; }
function levelColor(s:string){ const m:Record<string,string>={performance:'purple',advanced:'indigo',intermediate:'teal',elementary:'blue',beginner:'gray'}; return m[s]??'gray'; }

// ─── Add Student Modal ────────────────────────────────────────────────────────
function AddStudentModal({ onClose, onSaved }: { onClose:()=>void; onSaved:()=>void }) {
  const [form,setForm]=useState({ first_name:'',last_name:'',email:'',phone:'',parent_name:'',parent_phone:'',parent_email:'',date_of_birth:'',instrument:'Piano',skill_level:'beginner',lesson_type:'private',lesson_duration:'30',teacher:'',monthly_rate:'',rcm_level:'',next_exam_date:'',practice_goal_minutes:'30',notes:'' });
  const [saving,setSaving]=useState(false);
  const f=(k:string,v:string)=>setForm(p=>({...p,[k]:v}));
  async function submit(){
    if(!form.first_name||!form.last_name) return;
    setSaving(true);
    try{
      await fetch('/api/admin/music-school/students',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,lesson_duration:parseInt(form.lesson_duration),monthly_rate:form.monthly_rate?parseFloat(form.monthly_rate):null,practice_goal_minutes:parseInt(form.practice_goal_minutes)})});
      onSaved();
    }finally{setSaving(false);}
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b"><h2 className="text-xl font-bold">Add Student</h2></div>
        <div className="p-6 grid grid-cols-2 gap-4">
          <div><label className="text-xs text-gray-500">First Name *</label><input className="w-full border rounded p-2 mt-1" value={form.first_name} onChange={e=>f('first_name',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Last Name *</label><input className="w-full border rounded p-2 mt-1" value={form.last_name} onChange={e=>f('last_name',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Email</label><input className="w-full border rounded p-2 mt-1" value={form.email} onChange={e=>f('email',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Phone</label><input className="w-full border rounded p-2 mt-1" value={form.phone} onChange={e=>f('phone',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Parent Name</label><input className="w-full border rounded p-2 mt-1" value={form.parent_name} onChange={e=>f('parent_name',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Parent Phone</label><input className="w-full border rounded p-2 mt-1" value={form.parent_phone} onChange={e=>f('parent_phone',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Date of Birth</label><input type="date" className="w-full border rounded p-2 mt-1" value={form.date_of_birth} onChange={e=>f('date_of_birth',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Instrument *</label><select className="w-full border rounded p-2 mt-1" value={form.instrument} onChange={e=>f('instrument',e.target.value)}>{INSTRUMENTS.map(i=><option key={i}>{i}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Skill Level</label><select className="w-full border rounded p-2 mt-1" value={form.skill_level} onChange={e=>f('skill_level',e.target.value)}>{SKILL_LEVELS.map(s=><option key={s}>{s}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Lesson Type</label><select className="w-full border rounded p-2 mt-1" value={form.lesson_type} onChange={e=>f('lesson_type',e.target.value)}>{LESSON_TYPES.map(s=><option key={s}>{s}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Duration (min)</label><select className="w-full border rounded p-2 mt-1" value={form.lesson_duration} onChange={e=>f('lesson_duration',e.target.value)}>{['30','45','60','90'].map(d=><option key={d}>{d}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Teacher</label><input className="w-full border rounded p-2 mt-1" value={form.teacher} onChange={e=>f('teacher',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Monthly Rate ($)</label><input type="number" className="w-full border rounded p-2 mt-1" value={form.monthly_rate} onChange={e=>f('monthly_rate',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">RCM Level</label><select className="w-full border rounded p-2 mt-1" value={form.rcm_level} onChange={e=>f('rcm_level',e.target.value)}><option value="">None</option>{RCM_LEVELS.map(l=><option key={l}>{l}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Next Exam Date</label><input type="date" className="w-full border rounded p-2 mt-1" value={form.next_exam_date} onChange={e=>f('next_exam_date',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Practice Goal (min/day)</label><input type="number" className="w-full border rounded p-2 mt-1" value={form.practice_goal_minutes} onChange={e=>f('practice_goal_minutes',e.target.value)}/></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded p-2 mt-1 h-20" value={form.notes} onChange={e=>f('notes',e.target.value)}/></div>
        </div>
        <div className="p-6 border-t flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 border rounded">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50">{saving?'Saving...':'Add Student'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Lesson Modal ─────────────────────────────────────────────────────────
function AddLessonModal({ students, onClose, onSaved }: { students:Student[]; onClose:()=>void; onSaved:()=>void }) {
  const [form,setForm]=useState({ student_id:'',lesson_date:'',start_time:'',end_time:'',teacher:'',status:'scheduled' });
  const [saving,setSaving]=useState(false);
  const f=(k:string,v:string)=>setForm(p=>({...p,[k]:v}));
  async function submit(){
    if(!form.student_id||!form.lesson_date||!form.start_time) return;
    setSaving(true);
    try{
      await fetch('/api/admin/music-school/lessons',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,student_id:parseInt(form.student_id)})});
      onSaved();
    }finally{setSaving(false);}
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg">
        <div className="p-6 border-b"><h2 className="text-xl font-bold">Schedule Lesson</h2></div>
        <div className="p-6 grid grid-cols-2 gap-4">
          <div className="col-span-2"><label className="text-xs text-gray-500">Student *</label>
            <select className="w-full border rounded p-2 mt-1" value={form.student_id} onChange={e=>f('student_id',e.target.value)}>
              <option value="">Select student...</option>
              {students.map(s=><option key={s.id} value={s.id}>{s.last_name}, {s.first_name} — {s.instrument}</option>)}
            </select>
          </div>
          <div><label className="text-xs text-gray-500">Date *</label><input type="date" className="w-full border rounded p-2 mt-1" value={form.lesson_date} onChange={e=>f('lesson_date',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Teacher</label><input className="w-full border rounded p-2 mt-1" value={form.teacher} onChange={e=>f('teacher',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Start Time *</label><input type="time" className="w-full border rounded p-2 mt-1" value={form.start_time} onChange={e=>f('start_time',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">End Time</label><input type="time" className="w-full border rounded p-2 mt-1" value={form.end_time} onChange={e=>f('end_time',e.target.value)}/></div>
        </div>
        <div className="p-6 border-t flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 border rounded">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50">{saving?'Saving...':'Schedule'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Complete Lesson Modal ────────────────────────────────────────────────────
function CompleteLessonModal({ lesson, onClose, onSaved }: { lesson:Lesson; onClose:()=>void; onSaved:()=>void }) {
  const [repertoire,setRepertoire]=useState('');
  const [technique,setTechnique]=useState('');
  const [homework,setHomework]=useState('');
  const [saving,setSaving]=useState(false);
  async function submit(){
    setSaving(true);
    try{
      await fetch(`/api/admin/music-school/lessons/${lesson.id}/complete`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({repertoire:repertoire?repertoire.split(',').map(r=>r.trim()):[],technique_focus:technique,homework_assigned:homework})});
      onSaved();
    }finally{setSaving(false);}
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg">
        <div className="p-6 border-b"><h2 className="text-xl font-bold">Complete Lesson</h2><p className="text-sm text-gray-500 mt-1">{lesson.first_name} {lesson.last_name} — {fmtDate(lesson.lesson_date)}</p></div>
        <div className="p-6 space-y-4">
          <div><label className="text-xs text-gray-500">Repertoire (comma-separated)</label><input className="w-full border rounded p-2 mt-1" placeholder="Bach Invention, Clementi Sonatina..." value={repertoire} onChange={e=>setRepertoire(e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Technique Focus</label><input className="w-full border rounded p-2 mt-1" placeholder="Scales, arpeggios, legato touch..." value={technique} onChange={e=>setTechnique(e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Homework Assigned</label><textarea className="w-full border rounded p-2 mt-1 h-20" placeholder="Practice assignments for next week..." value={homework} onChange={e=>setHomework(e.target.value)}/></div>
        </div>
        <div className="p-6 border-t flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 border rounded">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50">{saving?'Saving...':'Mark Complete'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Recital Modal ────────────────────────────────────────────────────────
function AddRecitalModal({ onClose, onSaved }: { onClose:()=>void; onSaved:()=>void }) {
  const [form,setForm]=useState({ title:'',event_date:'',venue:'',description:'',ticket_price:'0' });
  const [saving,setSaving]=useState(false);
  const f=(k:string,v:string)=>setForm(p=>({...p,[k]:v}));
  async function submit(){
    if(!form.title||!form.event_date) return;
    setSaving(true);
    try{
      await fetch('/api/admin/music-school/recitals',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,ticket_price:parseFloat(form.ticket_price)||0})});
      onSaved();
    }finally{setSaving(false);}
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg">
        <div className="p-6 border-b"><h2 className="text-xl font-bold">Create Recital</h2></div>
        <div className="p-6 space-y-4">
          <div><label className="text-xs text-gray-500">Title *</label><input className="w-full border rounded p-2 mt-1" value={form.title} onChange={e=>f('title',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Event Date *</label><input type="datetime-local" className="w-full border rounded p-2 mt-1" value={form.event_date} onChange={e=>f('event_date',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Venue</label><input className="w-full border rounded p-2 mt-1" value={form.venue} onChange={e=>f('venue',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Ticket Price ($)</label><input type="number" className="w-full border rounded p-2 mt-1" value={form.ticket_price} onChange={e=>f('ticket_price',e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Description</label><textarea className="w-full border rounded p-2 mt-1 h-20" value={form.description} onChange={e=>f('description',e.target.value)}/></div>
        </div>
        <div className="p-6 border-t flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 border rounded">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50">{saving?'Saving...':'Create'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MusicSchoolPage() {
  const [tab,setTab]=useState<Tab>('dashboard');
  const [dash,setDash]=useState<DashData|null>(null);
  const [students,setStudents]=useState<Student[]>([]);
  const [lessons,setLessons]=useState<Lesson[]>([]);
  const [recitals,setRecitals]=useState<Recital[]>([]);
  const [teachers,setTeachers]=useState<Teacher[]>([]);
  const [loading,setLoading]=useState(false);

  // Filters
  const [instrFilter,setInstrFilter]=useState('');
  const [teacherFilter,setTeacherFilter]=useState('');
  const [statusFilter,setStatusFilter]=useState('');
  const [dateFilter,setDateFilter]=useState(new Date().toISOString().split('T')[0]);

  // Modals
  const [showAddStudent,setShowAddStudent]=useState(false);
  const [showAddLesson,setShowAddLesson]=useState(false);
  const [showAddRecital,setShowAddRecital]=useState(false);
  const [completeLesson,setCompleteLesson]=useState<Lesson|null>(null);

  // AI Tools
  const [aiLessonForm,setAiLessonForm]=useState({ instrument:'Piano',skill_level:'beginner',lesson_duration:'30',repertoire:'',goals:'' });
  const [aiProgressForm,setAiProgressForm]=useState({ student_name:'',instrument:'Piano',skill_level:'beginner',teacher:'',months:'6',recent_repertoire:'',strengths:'',areas:'',next_goals:'' });
  const [aiLessonResult,setAiLessonResult]=useState('');
  const [aiProgressResult,setAiProgressResult]=useState('');
  const [aiLoading,setAiLoading]=useState(false);

  const loadDash = useCallback(async()=>{ const r=await fetch('/api/admin/music-school'); if(r.ok){ const d=await r.json(); setDash(d); } },[]);
  const loadStudents = useCallback(async()=>{ setLoading(true); try{ const p=new URLSearchParams(); if(instrFilter)p.set('instrument',instrFilter); if(teacherFilter)p.set('teacher',teacherFilter); if(statusFilter)p.set('status',statusFilter); const r=await fetch('/api/admin/music-school/students?'+p); if(r.ok){const d=await r.json();setStudents(d.students);} }finally{setLoading(false);} },[instrFilter,teacherFilter,statusFilter]);
  const loadLessons = useCallback(async()=>{ setLoading(true); try{ const p=new URLSearchParams(); if(dateFilter)p.set('date',dateFilter); if(teacherFilter)p.set('teacher',teacherFilter); const r=await fetch('/api/admin/music-school/lessons?'+p); if(r.ok){const d=await r.json();setLessons(d.lessons);} }finally{setLoading(false);} },[dateFilter,teacherFilter]);
  const loadRecitals = useCallback(async()=>{ const r=await fetch('/api/admin/music-school/recitals'); if(r.ok){const d=await r.json();setRecitals(d.recitals);} },[]);
  const loadTeachers = useCallback(async()=>{ const r=await fetch('/api/admin/music-school/teachers'); if(r.ok){const d=await r.json();setTeachers(d.teachers);} },[]);

  useEffect(()=>{ loadDash(); },[loadDash]);
  useEffect(()=>{ if(tab==='students') loadStudents(); if(tab==='lessons') loadLessons(); if(tab==='recitals') loadRecitals(); if(tab==='teachers') loadTeachers(); if(tab==='rcm') loadStudents(); },[tab,loadStudents,loadLessons,loadRecitals,loadTeachers]);

  async function patchLesson(id:number, body:object){ await fetch(`/api/admin/music-school/lessons/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); loadLessons(); }

  async function genLessonPlan(){ setAiLoading(true); try{ const r=await fetch('/api/admin/music-school/ai-lesson-plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...aiLessonForm,lesson_duration:parseInt(aiLessonForm.lesson_duration)})}); if(r.ok){const d=await r.json();setAiLessonResult(d.plan);} }finally{setAiLoading(false);} }
  async function genProgressReport(){ setAiLoading(true); try{ const r=await fetch('/api/admin/music-school/ai-progress-report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(aiProgressForm)}); if(r.ok){const d=await r.json();setAiProgressResult(d.report);} }finally{setAiLoading(false);} }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">Music School & Performing Arts Hub</h1>
        <p className="text-sm text-gray-500 mt-1">Lesson scheduling, student progress, recitals, and RCM exam tracking</p>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b px-6">
        <div className="flex gap-1">
          {TABS.map(t=>(
            <button key={t} onClick={()=>setTab(t)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab===t?'border-blue-500 text-blue-600':'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {/* DASHBOARD */}
        {tab==='dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-4">
              <KpiCard label="Active Students" value={dash?.active_students??'—'} color="blue"/>
              <KpiCard label="Lessons Today" value={dash?.lessons_today??'—'} color="green"/>
              <KpiCard label="Teacher Absences (MTD)" value={dash?.teacher_absent_mtd??'—'} color="amber"/>
              <KpiCard label="Upcoming Recitals" value={dash?.upcoming_recitals?.length??'—'} color="purple"/>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border p-5">
                <h3 className="font-semibold text-gray-800 mb-3">Upcoming Recitals</h3>
                {!dash?.upcoming_recitals?.length && <p className="text-gray-400 text-sm">No upcoming recitals</p>}
                <div className="space-y-2">
                  {dash?.upcoming_recitals?.map(r=>(
                    <div key={r.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div><p className="font-medium text-sm">{r.title}</p><p className="text-xs text-gray-500">{r.venue} · {fmtDate(r.event_date)}</p></div>
                      <Badge label={r.status} color={statusColor(r.status)}/>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-xl border p-5">
                <h3 className="font-semibold text-gray-800 mb-3">RCM Exams in Next 30 Days</h3>
                {!dash?.rcm_exams_30d?.length && <p className="text-gray-400 text-sm">No exams scheduled in next 30 days</p>}
                <div className="space-y-2">
                  {dash?.rcm_exams_30d?.map(s=>{
                    const days=daysUntil(s.next_exam_date);
                    return (
                      <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div><p className="font-medium text-sm">{s.first_name} {s.last_name}</p><p className="text-xs text-gray-500">{s.instrument} · RCM {s.rcm_level}</p></div>
                        <span className={`text-xs font-bold px-2 py-1 rounded ${days!==null&&days<=7?'bg-red-100 text-red-700':'bg-amber-100 text-amber-700'}`}>{days}d</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STUDENTS */}
        {tab==='students' && (
          <div className="space-y-4">
            <div className="flex gap-3 items-center flex-wrap">
              <select className="border rounded p-2 text-sm" value={instrFilter} onChange={e=>{setInstrFilter(e.target.value);setTimeout(loadStudents,0);}}>
                <option value="">All Instruments</option>
                {INSTRUMENTS.map(i=><option key={i}>{i}</option>)}
              </select>
              <input className="border rounded p-2 text-sm w-40" placeholder="Teacher..." value={teacherFilter} onChange={e=>{setTeacherFilter(e.target.value);}}/>
              <select className="border rounded p-2 text-sm" value={statusFilter} onChange={e=>{setStatusFilter(e.target.value);}}>
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="on_hold">On Hold</option>
                <option value="withdrawn">Withdrawn</option>
              </select>
              <button onClick={loadStudents} className="px-3 py-2 bg-gray-100 rounded text-sm">Filter</button>
              <div className="flex-1"/>
              <button onClick={()=>setShowAddStudent(true)} className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium">+ Add Student</button>
            </div>

            {loading ? <p className="text-gray-400">Loading...</p> : (
              <div className="bg-white rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>{['Name','Instrument','Level','Teacher','Lesson','Monthly Rate','RCM','Next Exam','Status'].map(h=><th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y">
                    {students.map(s=>{
                      const days=daysUntil(s.next_exam_date);
                      return (
                        <tr key={s.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">{s.last_name}, {s.first_name}</td>
                          <td className="px-4 py-3">{s.instrument}</td>
                          <td className="px-4 py-3"><Badge label={s.skill_level} color={levelColor(s.skill_level)}/></td>
                          <td className="px-4 py-3">{s.teacher||'—'}</td>
                          <td className="px-4 py-3">{s.lesson_duration}min {s.lesson_type}</td>
                          <td className="px-4 py-3">{s.monthly_rate?fmtCad(s.monthly_rate):'—'}</td>
                          <td className="px-4 py-3">{s.rcm_level?<Badge label={`RCM ${s.rcm_level}`} color="indigo"/>:'—'}</td>
                          <td className="px-4 py-3">
                            {s.next_exam_date?(
                              <span className={`text-xs font-medium px-2 py-1 rounded ${days!==null&&days<=30?'bg-amber-100 text-amber-700':'bg-gray-100 text-gray-600'}`}>
                                {fmtDate(s.next_exam_date)}{days!==null&&` (${days}d)`}
                              </span>
                            ):'—'}
                          </td>
                          <td className="px-4 py-3"><Badge label={s.status} color={statusColor(s.status)}/></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!students.length&&<p className="text-center py-8 text-gray-400">No students found</p>}
              </div>
            )}
          </div>
        )}

        {/* LESSONS */}
        {tab==='lessons' && (
          <div className="space-y-4">
            <div className="flex gap-3 items-center flex-wrap">
              <input type="date" className="border rounded p-2 text-sm" value={dateFilter} onChange={e=>setDateFilter(e.target.value)}/>
              <input className="border rounded p-2 text-sm w-40" placeholder="Teacher..." value={teacherFilter} onChange={e=>setTeacherFilter(e.target.value)}/>
              <button onClick={loadLessons} className="px-3 py-2 bg-gray-100 rounded text-sm">Filter</button>
              <div className="flex-1"/>
              <button onClick={()=>setShowAddLesson(true)} className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium">+ Schedule Lesson</button>
            </div>

            {loading ? <p className="text-gray-400">Loading...</p> : (
              <div className="space-y-2">
                {lessons.map(l=>(
                  <div key={l.id} className="bg-white rounded-xl border p-4 flex items-center gap-4">
                    <div className="w-24 text-center bg-blue-50 rounded-lg p-2">
                      <p className="text-xs text-gray-500">{fmtDate(l.lesson_date)}</p>
                      <p className="font-bold text-sm text-blue-700">{fmtTime(l.start_time)}</p>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{l.first_name} {l.last_name} <span className="text-gray-400 text-sm">({l.instrument})</span></p>
                      <p className="text-sm text-gray-500">Teacher: {l.teacher} · {fmtTime(l.start_time)}–{fmtTime(l.end_time)}</p>
                      {l.technique_focus&&<p className="text-xs text-gray-400">Focus: {l.technique_focus}</p>}
                    </div>
                    <Badge label={l.status} color={statusColor(l.status)}/>
                    {l.status==='scheduled'&&(
                      <div className="flex gap-2">
                        <button onClick={()=>setCompleteLesson(l)} className="px-3 py-1.5 bg-green-600 text-white rounded text-xs">Complete</button>
                        <button onClick={()=>patchLesson(l.id,{status:'student_absent'})} className="px-3 py-1.5 bg-amber-500 text-white rounded text-xs">Absent</button>
                        <button onClick={()=>patchLesson(l.id,{status:'cancelled'})} className="px-3 py-1.5 bg-red-500 text-white rounded text-xs">Cancel</button>
                      </div>
                    )}
                  </div>
                ))}
                {!lessons.length&&<p className="text-center py-8 text-gray-400">No lessons for selected filters</p>}
              </div>
            )}
          </div>
        )}

        {/* RECITALS */}
        {tab==='recitals' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={()=>setShowAddRecital(true)} className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium">+ Create Recital</button>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {recitals.map(r=>(
                <div key={r.id} className="bg-white rounded-xl border p-5">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-gray-800">{r.title}</h3>
                    <Badge label={r.status} color={statusColor(r.status)}/>
                  </div>
                  <p className="text-sm text-gray-500">{r.venue||'Venue TBD'}</p>
                  <p className="text-sm text-gray-500">{fmtDate(r.event_date)}</p>
                  <p className="text-xs text-gray-400 mt-2">{r.performer_count} performers · {r.ticket_price>0?fmtCad(r.ticket_price)+'/ticket':'Free'}</p>
                </div>
              ))}
              {!recitals.length&&<p className="col-span-3 text-center py-8 text-gray-400">No recitals yet</p>}
            </div>
          </div>
        )}

        {/* TEACHERS */}
        {tab==='teachers' && (
          <div className="grid grid-cols-2 gap-4">
            {teachers.map(t=>(
              <div key={t.teacher} className="bg-white rounded-xl border p-5">
                <h3 className="font-semibold text-gray-800 text-lg">{t.teacher}</h3>
                <div className="flex flex-wrap gap-1 mt-2 mb-3">
                  {(t.instruments||[]).map(i=><Badge key={i} label={i} color="blue"/>)}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center bg-blue-50 rounded-lg p-2"><p className="text-2xl font-bold text-blue-700">{t.student_count}</p><p className="text-xs text-gray-500">Students</p></div>
                  <div className="text-center bg-green-50 rounded-lg p-2"><p className="text-2xl font-bold text-green-700">{t.lessons_today}</p><p className="text-xs text-gray-500">Today</p></div>
                  <div className="text-center bg-amber-50 rounded-lg p-2"><p className="text-2xl font-bold text-amber-700">{t.absences}</p><p className="text-xs text-gray-500">Absences</p></div>
                </div>
                <p className="text-xs text-gray-400 mt-3">{t.completed_mtd} lessons completed this month · {t.total_lessons} total</p>
              </div>
            ))}
            {!teachers.length&&<p className="col-span-2 text-center py-8 text-gray-400">No teachers found</p>}
          </div>
        )}

        {/* AI TOOLS */}
        {tab==='ai-tools' && (
          <div className="grid grid-cols-2 gap-6">
            {/* Lesson Plan */}
            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-semibold text-gray-800 mb-4">AI Lesson Plan Generator</h3>
              <div className="space-y-3">
                <div><label className="text-xs text-gray-500">Instrument</label><select className="w-full border rounded p-2 mt-1 text-sm" value={aiLessonForm.instrument} onChange={e=>setAiLessonForm(p=>({...p,instrument:e.target.value}))}>{INSTRUMENTS.map(i=><option key={i}>{i}</option>)}</select></div>
                <div><label className="text-xs text-gray-500">Skill Level</label><select className="w-full border rounded p-2 mt-1 text-sm" value={aiLessonForm.skill_level} onChange={e=>setAiLessonForm(p=>({...p,skill_level:e.target.value}))}>{SKILL_LEVELS.map(s=><option key={s}>{s}</option>)}</select></div>
                <div><label className="text-xs text-gray-500">Duration (min)</label><select className="w-full border rounded p-2 mt-1 text-sm" value={aiLessonForm.lesson_duration} onChange={e=>setAiLessonForm(p=>({...p,lesson_duration:e.target.value}))}>{['30','45','60','90'].map(d=><option key={d}>{d}</option>)}</select></div>
                <div><label className="text-xs text-gray-500">Current Repertoire</label><input className="w-full border rounded p-2 mt-1 text-sm" placeholder="e.g. Bach Invention No. 1" value={aiLessonForm.repertoire} onChange={e=>setAiLessonForm(p=>({...p,repertoire:e.target.value}))}/></div>
                <div><label className="text-xs text-gray-500">Goals</label><input className="w-full border rounded p-2 mt-1 text-sm" placeholder="e.g. Prepare for RCM Grade 5" value={aiLessonForm.goals} onChange={e=>setAiLessonForm(p=>({...p,goals:e.target.value}))}/></div>
                <button onClick={genLessonPlan} disabled={aiLoading} className="w-full py-2 bg-blue-600 text-white rounded text-sm font-medium disabled:opacity-50">{aiLoading?'Generating...':'Generate Lesson Plan'}</button>
              </div>
              {aiLessonResult&&<pre className="mt-4 p-3 bg-gray-50 rounded text-xs whitespace-pre-wrap font-sans">{aiLessonResult}</pre>}
            </div>

            {/* Progress Report */}
            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-semibold text-gray-800 mb-4">AI Progress Report Generator</h3>
              <div className="space-y-3">
                <div><label className="text-xs text-gray-500">Student Name</label><input className="w-full border rounded p-2 mt-1 text-sm" value={aiProgressForm.student_name} onChange={e=>setAiProgressForm(p=>({...p,student_name:e.target.value}))}/></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-gray-500">Instrument</label><select className="w-full border rounded p-2 mt-1 text-sm" value={aiProgressForm.instrument} onChange={e=>setAiProgressForm(p=>({...p,instrument:e.target.value}))}>{INSTRUMENTS.map(i=><option key={i}>{i}</option>)}</select></div>
                  <div><label className="text-xs text-gray-500">Level</label><select className="w-full border rounded p-2 mt-1 text-sm" value={aiProgressForm.skill_level} onChange={e=>setAiProgressForm(p=>({...p,skill_level:e.target.value}))}>{SKILL_LEVELS.map(s=><option key={s}>{s}</option>)}</select></div>
                </div>
                <div><label className="text-xs text-gray-500">Teacher</label><input className="w-full border rounded p-2 mt-1 text-sm" value={aiProgressForm.teacher} onChange={e=>setAiProgressForm(p=>({...p,teacher:e.target.value}))}/></div>
                <div><label className="text-xs text-gray-500">Months Studying</label><input type="number" className="w-full border rounded p-2 mt-1 text-sm" value={aiProgressForm.months} onChange={e=>setAiProgressForm(p=>({...p,months:e.target.value}))}/></div>
                <div><label className="text-xs text-gray-500">Strengths</label><input className="w-full border rounded p-2 mt-1 text-sm" value={aiProgressForm.strengths} onChange={e=>setAiProgressForm(p=>({...p,strengths:e.target.value}))}/></div>
                <div><label className="text-xs text-gray-500">Areas for Improvement</label><input className="w-full border rounded p-2 mt-1 text-sm" value={aiProgressForm.areas} onChange={e=>setAiProgressForm(p=>({...p,areas:e.target.value}))}/></div>
                <button onClick={genProgressReport} disabled={aiLoading} className="w-full py-2 bg-purple-600 text-white rounded text-sm font-medium disabled:opacity-50">{aiLoading?'Generating...':'Generate Progress Report'}</button>
              </div>
              {aiProgressResult&&<pre className="mt-4 p-3 bg-gray-50 rounded text-xs whitespace-pre-wrap font-sans">{aiProgressResult}</pre>}
            </div>
          </div>
        )}

        {/* RCM TRACKER */}
        {tab==='rcm' && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4 mb-6">
              {RCM_LEVELS.map(level=>{
                const levelStudents=students.filter(s=>s.rcm_level===level);
                if(!levelStudents.length) return null;
                return (
                  <div key={level} className="bg-white rounded-xl border p-4">
                    <p className="text-xs text-gray-500">RCM {level}</p>
                    <p className="text-3xl font-bold text-indigo-700 mt-1">{levelStudents.length}</p>
                    <p className="text-xs text-gray-400">students</p>
                  </div>
                );
              })}
            </div>
            <div className="bg-white rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>{['Student','Instrument','RCM Level','Next Exam','Days Until','Teacher'].map(h=><th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y">
                  {students.filter(s=>s.rcm_level).sort((a,b)=>{
                    if(!a.next_exam_date) return 1; if(!b.next_exam_date) return -1;
                    return new Date(a.next_exam_date).getTime()-new Date(b.next_exam_date).getTime();
                  }).map(s=>{
                    const days=daysUntil(s.next_exam_date);
                    return (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{s.last_name}, {s.first_name}</td>
                        <td className="px-4 py-3">{s.instrument}</td>
                        <td className="px-4 py-3"><Badge label={`RCM ${s.rcm_level}`} color="indigo"/></td>
                        <td className="px-4 py-3">{fmtDate(s.next_exam_date)}</td>
                        <td className="px-4 py-3">{days!==null?<span className={`font-medium ${days<=30?'text-red-600':days<=60?'text-amber-600':'text-gray-600'}`}>{days}d</span>:'—'}</td>
                        <td className="px-4 py-3">{s.teacher||'—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddStudent&&<AddStudentModal onClose={()=>setShowAddStudent(false)} onSaved={()=>{setShowAddStudent(false);loadStudents();}}/>}
      {showAddLesson&&<AddLessonModal students={students} onClose={()=>setShowAddLesson(false)} onSaved={()=>{setShowAddLesson(false);loadLessons();}}/>}
      {showAddRecital&&<AddRecitalModal onClose={()=>setShowAddRecital(false)} onSaved={()=>{setShowAddRecital(false);loadRecitals();}}/>}
      {completeLesson&&<CompleteLessonModal lesson={completeLesson} onClose={()=>setCompleteLesson(null)} onSaved={()=>{setCompleteLesson(null);loadLessons();}}/>}
    </div>
  );
}
