'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard','job-orders','candidates','submissions','companies','ai','financials'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab,string> = { dashboard:'Dashboard', 'job-orders':'Job Orders', candidates:'Candidates', submissions:'Submissions', companies:'Client Companies', ai:'AI Tools', financials:'Financials' };

const CONTRACT_TYPES = ['contingency','retained','hybrid','temp_to_perm','staffing'];
const JOB_TYPES = ['permanent','contract','temp','temp_to_perm','executive'];
const WORK_LOCS = ['onsite','remote','hybrid'];
const PRIORITIES = ['low','medium','high','exclusive'];
const WORK_AUTHS = ['canadian_citizen','permanent_resident','work_permit','open_work_permit','student_visa','requires_sponsorship'];
const AVAILABILITIES = ['immediately','2_weeks','1_month','2_months','negotiable'];
const SOURCES = ['job_board','linkedin','referral','direct','career_fair','university','other'];
const SUB_STATUSES = ['submitted','shortlisted','client_interview','second_interview','offer_extended','offer_accepted','offer_declined','not_selected','placed','withdrew'];

interface Company { id:number; company_name:string; industry:string; contact_name:string; contact_email:string; contract_type:string; active_job_orders:number; total_placements:number; total_fees_earned:number; status:string; active_orders_count:number; }
interface JobOrder { id:number; client_company_id:number; company_name:string; job_title:string; job_type:string; salary_min:number; salary_max:number; work_location:string; city:string; required_skills:string[]; priority:string; status:string; assigned_recruiter:string; fee_amount:number; opened_date:string; submission_count:number; }
interface Candidate { id:number; first_name:string; last_name:string; email:string; current_title:string; years_experience:number; work_authorization:string; availability:string; skills:string[]; desired_salary_min:number; desired_salary_max:number; status:string; source:string; }
interface Submission { id:number; job_order_id:number; candidate_id:number; first_name:string; last_name:string; email:string; current_title:string; job_title:string; company_name:string; status:string; submitted_at:string; interview_date:string; offer_amount:number; fee_invoiced:number; }

function fmtCad(n:number) { return `$${Number(n??0).toLocaleString('en-CA',{minimumFractionDigits:0})}`; }
function fmtDate(d:string) { return d?new Date(d).toLocaleDateString('en-CA'):'—'; }

function Badge({ label, color='gray' }: { label:string; color?:string }) {
  const m: Record<string,string> = { blue:'bg-blue-100 text-blue-700', green:'bg-green-100 text-green-700', amber:'bg-amber-100 text-amber-700', red:'bg-red-100 text-red-700', purple:'bg-purple-100 text-purple-700', gray:'bg-gray-100 text-gray-700', teal:'bg-teal-100 text-teal-700', orange:'bg-orange-100 text-orange-700' };
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${m[color]??m.gray}`}>{label.replace(/_/g,' ')}</span>;
}
function KpiCard({ label, value, sub, color='blue' }: { label:string; value:string|number; sub?:string; color?:string }) {
  const b: Record<string,string> = { blue:'border-l-4 border-blue-500 bg-blue-50', green:'border-l-4 border-green-500 bg-green-50', amber:'border-l-4 border-amber-500 bg-amber-50', red:'border-l-4 border-red-500 bg-red-50', purple:'border-l-4 border-purple-500 bg-purple-50' };
  return <div className={`rounded-lg p-4 ${b[color]??b.blue}`}><p className="text-sm text-gray-500">{label}</p><p className="text-2xl font-bold mt-1">{value}</p>{sub&&<p className="text-xs text-gray-400 mt-1">{sub}</p>}</div>;
}
function priorityColor(p:string) { return {exclusive:'purple',high:'red',medium:'amber',low:'gray'}[p]??'gray'; }
function statusColor(s:string) { return {active:'green',filled:'teal',on_hold:'amber',cancelled:'red',placed:'green',submitted:'blue',shortlisted:'purple',client_interview:'orange',offer_extended:'amber',offer_accepted:'green',not_selected:'gray',withdrew:'gray'}[s]??'gray'; }
function authColor(a:string) { return {canadian_citizen:'green',permanent_resident:'teal',open_work_permit:'blue',work_permit:'amber',requires_sponsorship:'red'}[a]??'gray'; }

// ─── Add Company Modal ─────────────────────────────────────────────────────────
function AddCompanyModal({ onClose, onSaved }: { onClose:()=>void; onSaved:()=>void }) {
  const [form,setForm] = useState({ company_name:'',industry:'',contact_name:'',contact_title:'',contact_email:'',contact_phone:'',city:'Calgary',province:'AB',contract_type:'contingency',fee_structure:'20% of first year salary',payment_terms:'net_30',notes:'' });
  const [saving,setSaving] = useState(false);
  const f = (k:string,v:string) => setForm(p=>({...p,[k]:v}));
  async function submit() {
    if (!form.company_name||!form.contact_name||!form.contact_email) return;
    setSaving(true);
    try { await fetch('/api/admin/staffing-agency/client-companies',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)}); onSaved(); }
    finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-4 text-slate-800">New Client Company</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs text-gray-500">Company Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.company_name} onChange={e=>f('company_name',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Industry</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.industry} onChange={e=>f('industry',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Contract Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.contract_type} onChange={e=>f('contract_type',e.target.value)}>{CONTRACT_TYPES.map(t=><option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Contact Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.contact_name} onChange={e=>f('contact_name',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Contact Title</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.contact_title} onChange={e=>f('contact_title',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Contact Email *</label><input type="email" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.contact_email} onChange={e=>f('contact_email',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Contact Phone</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.contact_phone} onChange={e=>f('contact_phone',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">City</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.city} onChange={e=>f('city',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Province</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.province} onChange={e=>f('province',e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Fee Structure</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.fee_structure} onChange={e=>f('fee_structure',e.target.value)} placeholder="e.g. 20% of first year salary" /></div>
          <div><label className="text-xs text-gray-500">Payment Terms</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.payment_terms} onChange={e=>f('payment_terms',e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.notes} onChange={e=>f('notes',e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border rounded hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{saving?'Saving…':'Save Company'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Job Order Modal ───────────────────────────────────────────────────────
function AddJobOrderModal({ companies, onClose, onSaved }: { companies:Company[]; onClose:()=>void; onSaved:()=>void }) {
  const [form,setForm] = useState({ client_company_id:'',job_title:'',department:'',job_type:'permanent',salary_min:'',salary_max:'',work_location:'hybrid',city:'Calgary',province:'AB',required_skills:'',years_experience_min:'0',education_requirement:'',job_description:'',priority:'medium',assigned_recruiter:'',fee_amount:'' });
  const [saving,setSaving] = useState(false);
  const f = (k:string,v:string) => setForm(p=>({...p,[k]:v}));
  async function submit() {
    if (!form.client_company_id||!form.job_title) return;
    setSaving(true);
    try {
      await fetch('/api/admin/staffing-agency/job-orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ ...form, client_company_id:parseInt(form.client_company_id), salary_min:parseFloat(form.salary_min)||null, salary_max:parseFloat(form.salary_max)||null, years_experience_min:parseInt(form.years_experience_min)||0, fee_amount:parseFloat(form.fee_amount)||null, required_skills:form.required_skills.split(',').map(s=>s.trim()).filter(Boolean) })});
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-4 text-slate-800">New Job Order</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs text-gray-500">Client Company *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.client_company_id} onChange={e=>f('client_company_id',e.target.value)}><option value="">Select company…</option>{companies.map(c=><option key={c.id} value={c.id}>{c.company_name}</option>)}</select></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Job Title *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.job_title} onChange={e=>f('job_title',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Job Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.job_type} onChange={e=>f('job_type',e.target.value)}>{JOB_TYPES.map(t=><option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Priority</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.priority} onChange={e=>f('priority',e.target.value)}>{PRIORITIES.map(p=><option key={p}>{p}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Salary Min (CAD)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.salary_min} onChange={e=>f('salary_min',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Salary Max (CAD)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.salary_max} onChange={e=>f('salary_max',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Work Location</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.work_location} onChange={e=>f('work_location',e.target.value)}>{WORK_LOCS.map(l=><option key={l}>{l}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">City</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.city} onChange={e=>f('city',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Min Years Exp</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.years_experience_min} onChange={e=>f('years_experience_min',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Fee Amount (CAD)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.fee_amount} onChange={e=>f('fee_amount',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Assigned Recruiter</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.assigned_recruiter} onChange={e=>f('assigned_recruiter',e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Required Skills (comma-separated)</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.required_skills} onChange={e=>f('required_skills',e.target.value)} placeholder="e.g. Python, SQL, AWS" /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Job Description</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={3} value={form.job_description} onChange={e=>f('job_description',e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border rounded hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{saving?'Saving…':'Save Job Order'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Candidate Modal ───────────────────────────────────────────────────────
function AddCandidateModal({ onClose, onSaved }: { onClose:()=>void; onSaved:()=>void }) {
  const [form,setForm] = useState({ first_name:'',last_name:'',email:'',phone:'',city:'Calgary',province:'AB',current_title:'',current_employer:'',years_experience:'0',highest_education:'',desired_salary_min:'',desired_salary_max:'',work_authorization:'canadian_citizen',availability:'immediately',skills:'',certifications:'',industries:'',source:'linkedin',notes:'' });
  const [saving,setSaving] = useState(false);
  const f = (k:string,v:string) => setForm(p=>({...p,[k]:v}));
  async function submit() {
    if (!form.first_name||!form.last_name||!form.email) return;
    setSaving(true);
    try {
      await fetch('/api/admin/staffing-agency/candidates',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ ...form, years_experience:parseInt(form.years_experience)||0, desired_salary_min:parseFloat(form.desired_salary_min)||null, desired_salary_max:parseFloat(form.desired_salary_max)||null, skills:form.skills.split(',').map(s=>s.trim()).filter(Boolean), certifications:form.certifications.split(',').map(s=>s.trim()).filter(Boolean), industries:form.industries.split(',').map(s=>s.trim()).filter(Boolean) })});
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-4 text-slate-800">New Candidate</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500">First Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.first_name} onChange={e=>f('first_name',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Last Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.last_name} onChange={e=>f('last_name',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Email *</label><input type="email" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.email} onChange={e=>f('email',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Phone</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.phone} onChange={e=>f('phone',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Current Title</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.current_title} onChange={e=>f('current_title',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Current Employer</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.current_employer} onChange={e=>f('current_employer',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Years Experience</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.years_experience} onChange={e=>f('years_experience',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Education</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.highest_education} onChange={e=>f('highest_education',e.target.value)} placeholder="Bachelor's, MBA, etc." /></div>
          <div><label className="text-xs text-gray-500">Desired Salary Min</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.desired_salary_min} onChange={e=>f('desired_salary_min',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Desired Salary Max</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.desired_salary_max} onChange={e=>f('desired_salary_max',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Work Authorization</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.work_authorization} onChange={e=>f('work_authorization',e.target.value)}>{WORK_AUTHS.map(a=><option key={a} value={a}>{a.replace(/_/g,' ')}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Availability</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.availability} onChange={e=>f('availability',e.target.value)}>{AVAILABILITIES.map(a=><option key={a} value={a}>{a.replace(/_/g,' ')}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Source</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.source} onChange={e=>f('source',e.target.value)}>{SOURCES.map(s=><option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}</select></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Skills (comma-separated)</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.skills} onChange={e=>f('skills',e.target.value)} placeholder="Python, SQL, Project Management" /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Certifications</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.certifications} onChange={e=>f('certifications',e.target.value)} placeholder="PMP, CPA, AWS Certified" /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Industries</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.industries} onChange={e=>f('industries',e.target.value)} placeholder="Technology, Finance, Energy" /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.notes} onChange={e=>f('notes',e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border rounded hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">{saving?'Saving…':'Save Candidate'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function StaffingAgencyPage() {
  const [tab,setTab] = useState<Tab>('dashboard');
  const [dashboard,setDashboard] = useState<any>(null);
  const [companies,setCompanies] = useState<Company[]>([]);
  const [jobOrders,setJobOrders] = useState<JobOrder[]>([]);
  const [candidates,setCandidates] = useState<Candidate[]>([]);
  const [submissions,setSubmissions] = useState<Submission[]>([]);
  const [selectedJob,setSelectedJob] = useState<string>('');
  const [showAddCompany,setShowAddCompany] = useState(false);
  const [showAddJob,setShowAddJob] = useState(false);
  const [showAddCandidate,setShowAddCandidate] = useState(false);
  const [aiMode,setAiMode] = useState<'summary'|'outreach'>('summary');
  const [aiOutput,setAiOutput] = useState('');
  const [aiLoading,setAiLoading] = useState(false);
  const [aiCandidate,setAiCandidate] = useState<string>('');
  const [aiJob,setAiJob] = useState<string>('');

  const load = useCallback(async () => {
    try {
      const [d,co,jo,ca] = await Promise.all([
        fetch('/api/admin/staffing-agency').then(r=>r.json()),
        fetch('/api/admin/staffing-agency/client-companies').then(r=>r.json()),
        fetch('/api/admin/staffing-agency/job-orders').then(r=>r.json()),
        fetch('/api/admin/staffing-agency/candidates').then(r=>r.json()),
      ]);
      setDashboard(d); setCompanies(Array.isArray(co)?co:[]); setJobOrders(Array.isArray(jo)?jo:[]); setCandidates(Array.isArray(ca)?ca:[]);
    } catch {}
  }, []);

  const loadSubmissions = useCallback(async () => {
    const qs = selectedJob ? `?job_order_id=${selectedJob}` : '';
    try { const r = await fetch(`/api/admin/staffing-agency/submissions${qs}`); setSubmissions(await r.json()); } catch {}
  }, [selectedJob]);

  useEffect(() => { load(); }, []);
  useEffect(() => { loadSubmissions(); }, [selectedJob]);

  async function generateAi() {
    const cand = candidates.find(c=>String(c.id)===aiCandidate);
    const job = jobOrders.find(j=>String(j.id)===aiJob);
    setAiLoading(true); setAiOutput('');
    try {
      const endpoint = aiMode==='summary' ? 'ai-candidate-summary' : 'ai-outreach';
      const payload = aiMode==='summary' ? { ...cand, job_title:job?.job_title } : { ...cand, job_title:job?.job_title, company_name:job?.company_name };
      const r = await fetch(`/api/admin/staffing-agency/${endpoint}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const data = await r.json();
      setAiOutput(data.summary||data.message||JSON.stringify(data));
    } finally { setAiLoading(false); }
  }

  async function advanceStatus(subId:number, status:string) {
    await fetch(`/api/admin/staffing-agency/submissions/${subId}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})});
    loadSubmissions();
  }

  async function placeCandidate(subId:number) {
    await fetch(`/api/admin/staffing-agency/submissions/${subId}/place`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({})});
    load(); loadSubmissions();
  }

  const kanbanStatuses = ['submitted','shortlisted','client_interview','offer_extended','placed'];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-2xl font-bold text-slate-800">Staffing & Recruitment Agency Hub</h1>
        <p className="text-sm text-gray-500 mt-0.5">External recruitment — placing candidates with client companies across Calgary & Alberta</p>
      </div>
      <div className="bg-white border-b px-6">
        <div className="flex gap-0 overflow-x-auto">
          {TABS.map(t=><button key={t} onClick={()=>setTab(t)} className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab===t?'border-blue-600 text-blue-600':'border-transparent text-gray-500 hover:text-gray-700'}`}>{TAB_LABELS[t]}</button>)}
        </div>
      </div>

      <div className="p-6">
        {/* DASHBOARD */}
        {tab==='dashboard' && (
          <div className="space-y-6">
            {dashboard ? (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <KpiCard label="Active Job Orders" value={dashboard.active_job_orders} color="blue" />
                <KpiCard label="Submissions (MTD)" value={dashboard.submissions_this_month} color="purple" />
                <KpiCard label="Placements (MTD)" value={dashboard.placements_mtd} color="green" />
                <KpiCard label="Pipeline Fee Value" value={fmtCad(dashboard.pipeline_fee_value)} color="amber" />
                <KpiCard label="Fill Rate" value={`${dashboard.fill_rate_pct}%`} color={dashboard.fill_rate_pct>=50?'green':'red'} />
              </div>
            ) : <div className="h-20 bg-gray-100 rounded animate-pulse" />}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-slate-700 mb-3">Active Job Orders</h3>
                <div className="space-y-2">
                  {jobOrders.filter(j=>j.status==='active').slice(0,5).map(j=>(
                    <div key={j.id} className="bg-white rounded-lg border p-3 flex justify-between items-center">
                      <div><p className="font-medium text-sm">{j.job_title}</p><p className="text-xs text-gray-400">{j.company_name} · {j.city}</p></div>
                      <div className="flex gap-1.5 items-center">
                        <Badge label={j.priority} color={priorityColor(j.priority)} />
                        <span className="text-xs text-gray-400">{j.submission_count} subs</span>
                      </div>
                    </div>
                  ))}
                  {!jobOrders.filter(j=>j.status==='active').length && <p className="text-gray-400 text-sm">No active orders.</p>}
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-slate-700 mb-3">Recent Candidates</h3>
                <div className="space-y-2">
                  {candidates.slice(0,5).map(c=>(
                    <div key={c.id} className="bg-white rounded-lg border p-3 flex justify-between items-center">
                      <div><p className="font-medium text-sm">{c.first_name} {c.last_name}</p><p className="text-xs text-gray-400">{c.current_title||'—'}</p></div>
                      <div className="flex gap-1"><Badge label={c.work_authorization} color={authColor(c.work_authorization)} /><Badge label={c.availability} color="blue" /></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* JOB ORDERS */}
        {tab==='job-orders' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-800">Job Orders ({jobOrders.length})</h2>
              <button onClick={()=>setShowAddJob(true)} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">+ Add Job Order</button>
            </div>
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b"><tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Role</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Company</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Salary Range</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Priority</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Submissions</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Fee</th>
                </tr></thead>
                <tbody>
                  {jobOrders.map(j=>(
                    <tr key={j.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3"><p className="font-medium">{j.job_title}</p><p className="text-xs text-gray-400">{j.city} · {j.work_location}</p></td>
                      <td className="px-4 py-3">{j.company_name}</td>
                      <td className="px-4 py-3"><Badge label={j.job_type} color="blue" /></td>
                      <td className="px-4 py-3 text-xs">{j.salary_min?`${fmtCad(j.salary_min)}–${fmtCad(j.salary_max)}`:'Open'}</td>
                      <td className="px-4 py-3"><Badge label={j.priority} color={priorityColor(j.priority)} /></td>
                      <td className="px-4 py-3"><Badge label={j.status} color={statusColor(j.status)} /></td>
                      <td className="px-4 py-3 text-center">{j.submission_count}</td>
                      <td className="px-4 py-3">{j.fee_amount?fmtCad(j.fee_amount):'—'}</td>
                    </tr>
                  ))}
                  {!jobOrders.length && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No job orders yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CANDIDATES */}
        {tab==='candidates' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-800">Candidates ({candidates.length})</h2>
              <button onClick={()=>setShowAddCandidate(true)} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">+ Add Candidate</button>
            </div>
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b"><tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Candidate</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Title</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Experience</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Work Auth</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Availability</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Salary Range</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Skills</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                </tr></thead>
                <tbody>
                  {candidates.map(c=>(
                    <tr key={c.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3"><p className="font-medium">{c.first_name} {c.last_name}</p><p className="text-xs text-gray-400">{c.email}</p></td>
                      <td className="px-4 py-3 text-xs">{c.current_title||'—'}</td>
                      <td className="px-4 py-3 text-center">{c.years_experience}yr</td>
                      <td className="px-4 py-3"><Badge label={c.work_authorization} color={authColor(c.work_authorization)} /></td>
                      <td className="px-4 py-3"><Badge label={c.availability} color="blue" /></td>
                      <td className="px-4 py-3 text-xs">{c.desired_salary_min?`${fmtCad(c.desired_salary_min)}–${fmtCad(c.desired_salary_max)}`:'Open'}</td>
                      <td className="px-4 py-3"><div className="flex flex-wrap gap-1">{(c.skills||[]).slice(0,3).map((s,i)=><Badge key={i} label={s} color="gray" />)}</div></td>
                      <td className="px-4 py-3"><Badge label={c.status} color={statusColor(c.status)} /></td>
                    </tr>
                  ))}
                  {!candidates.length && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No candidates yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SUBMISSIONS KANBAN */}
        {tab==='submissions' && (
          <div>
            <div className="flex items-center gap-4 mb-4">
              <h2 className="text-lg font-semibold text-slate-800">Submissions</h2>
              <select className="border rounded px-2 py-1.5 text-sm" value={selectedJob} onChange={e=>setSelectedJob(e.target.value)}>
                <option value="">All job orders</option>
                {jobOrders.map(j=><option key={j.id} value={j.id}>{j.job_title} — {j.company_name}</option>)}
              </select>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-4">
              {kanbanStatuses.map(status=>{
                const cols = submissions.filter(s=>s.status===status);
                return (
                  <div key={status} className="min-w-[240px] flex-shrink-0">
                    <div className="flex justify-between items-center mb-2"><h3 className="text-xs font-semibold text-gray-500 uppercase">{status.replace(/_/g,' ')}</h3><span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2">{cols.length}</span></div>
                    <div className="space-y-2">
                      {cols.map(s=>(
                        <div key={s.id} className="bg-white rounded-lg border p-3">
                          <p className="font-medium text-sm">{s.first_name} {s.last_name}</p>
                          <p className="text-xs text-gray-400 mb-2">{s.current_title||'—'}</p>
                          <p className="text-xs text-gray-500 mb-2">{s.job_title}</p>
                          {s.offer_amount && <p className="text-xs text-green-700 mb-1">Offer: {fmtCad(s.offer_amount)}</p>}
                          <div className="flex flex-col gap-1 mt-2">
                            {status==='submitted' && <button onClick={()=>advanceStatus(s.id,'shortlisted')} className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200">Shortlist</button>}
                            {status==='shortlisted' && <button onClick={()=>advanceStatus(s.id,'client_interview')} className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded hover:bg-orange-200">Set Interview</button>}
                            {status==='client_interview' && <button onClick={()=>advanceStatus(s.id,'offer_extended')} className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded hover:bg-amber-200">Extend Offer</button>}
                            {status==='offer_extended' && <button onClick={()=>placeCandidate(s.id)} className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700">Place Candidate</button>}
                          </div>
                        </div>
                      ))}
                      {!cols.length && <div className="text-center py-4 text-gray-300 text-xs border-2 border-dashed rounded-lg">Empty</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* CLIENT COMPANIES */}
        {tab==='companies' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-800">Client Companies ({companies.length})</h2>
              <button onClick={()=>setShowAddCompany(true)} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">+ Add Company</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {companies.map(c=>(
                <div key={c.id} className="bg-white rounded-lg border p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div><p className="font-semibold text-slate-800">{c.company_name}</p><p className="text-xs text-gray-400">{c.industry}</p></div>
                    <Badge label={c.status} color={c.status==='active'?'green':c.status==='prospect'?'amber':'gray'} />
                  </div>
                  <p className="text-xs text-gray-500 mb-2">{c.contact_name} · {c.contact_email}</p>
                  <Badge label={c.contract_type} color="blue" />
                  <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                    <div className="bg-blue-50 rounded p-1.5"><p className="text-xs text-gray-400">Active</p><p className="font-bold text-blue-700">{c.active_orders_count}</p></div>
                    <div className="bg-green-50 rounded p-1.5"><p className="text-xs text-gray-400">Placed</p><p className="font-bold text-green-700">{c.total_placements}</p></div>
                    <div className="bg-amber-50 rounded p-1.5"><p className="text-xs text-gray-400">Fees</p><p className="font-bold text-amber-700 text-xs">{fmtCad(c.total_fees_earned)}</p></div>
                  </div>
                </div>
              ))}
              {!companies.length && <div className="col-span-3 text-center py-12 text-gray-400">No companies yet.</div>}
            </div>
          </div>
        )}

        {/* AI TOOLS */}
        {tab==='ai' && (
          <div className="max-w-3xl">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">AI Recruiter Tools</h2>
            <div className="bg-white rounded-lg border p-4 mb-4">
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Tool</label>
                  <select className="w-full border rounded px-2 py-1.5 text-sm" value={aiMode} onChange={e=>setAiMode(e.target.value as any)}>
                    <option value="summary">Candidate Summary (for client)</option>
                    <option value="outreach">Outreach Message (LinkedIn)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Candidate</label>
                  <select className="w-full border rounded px-2 py-1.5 text-sm" value={aiCandidate} onChange={e=>setAiCandidate(e.target.value)}>
                    <option value="">Select…</option>
                    {candidates.map(c=><option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Job Order (optional)</label>
                  <select className="w-full border rounded px-2 py-1.5 text-sm" value={aiJob} onChange={e=>setAiJob(e.target.value)}>
                    <option value="">Select…</option>
                    {jobOrders.map(j=><option key={j.id} value={j.id}>{j.job_title}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={generateAi} disabled={aiLoading||!aiCandidate} className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium">{aiLoading?'Generating…':'Generate'}</button>
            </div>
            {aiOutput && (
              <div className="bg-white rounded-lg border p-4">
                <h3 className="font-semibold text-slate-800 mb-3">{aiMode==='summary'?'Candidate Summary':'Outreach Message'}</h3>
                <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">{aiOutput}</pre>
                <button onClick={()=>navigator.clipboard.writeText(aiOutput)} className="mt-3 text-xs text-blue-600 hover:underline">Copy to clipboard</button>
              </div>
            )}
          </div>
        )}

        {/* FINANCIALS */}
        {tab==='financials' && (
          <div>
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Fee Pipeline</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {['submitted','shortlisted','offer_extended','placed'].map(status=>{
                const subs = submissions.filter(s=>s.status===status);
                const total = subs.reduce((sum,s)=>sum+(s.fee_invoiced||0),0);
                return <KpiCard key={status} label={status.replace(/_/g,' ')} value={fmtCad(total)} sub={`${subs.length} candidates`} color={status==='placed'?'green':status==='offer_extended'?'amber':'blue'} />;
              })}
            </div>
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b"><tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Candidate</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Company</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Role</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Fee Invoiced</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Collected</th>
                </tr></thead>
                <tbody>
                  {submissions.filter(s=>s.fee_invoiced>0||s.status==='placed').map(s=>(
                    <tr key={s.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{s.first_name} {s.last_name}</td>
                      <td className="px-4 py-3">{s.company_name}</td>
                      <td className="px-4 py-3">{s.job_title}</td>
                      <td className="px-4 py-3"><Badge label={s.status} color={statusColor(s.status)} /></td>
                      <td className="px-4 py-3 font-medium">{s.fee_invoiced?fmtCad(s.fee_invoiced):'—'}</td>
                      <td className="px-4 py-3">{(s as any).fee_collected?<span className="text-green-600">Yes</span>:<span className="text-gray-400">No</span>}</td>
                    </tr>
                  ))}
                  {!submissions.filter(s=>s.fee_invoiced>0||s.status==='placed').length && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No financial data yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showAddCompany && <AddCompanyModal onClose={()=>setShowAddCompany(false)} onSaved={()=>{setShowAddCompany(false);load();}} />}
      {showAddJob && <AddJobOrderModal companies={companies} onClose={()=>setShowAddJob(false)} onSaved={()=>{setShowAddJob(false);load();}} />}
      {showAddCandidate && <AddCandidateModal onClose={()=>setShowAddCandidate(false)} onSaved={()=>{setShowAddCandidate(false);load();}} />}
    </div>
  );
}
