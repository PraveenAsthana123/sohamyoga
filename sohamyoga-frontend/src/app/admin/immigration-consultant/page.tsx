'use client';
import { useEffect, useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
type ImmClient = {
  id: number; name: string; email: string; phone: string; nationality: string;
  current_status: string; crs_score: number; clb_english: number; clb_french: number;
  education_level: string; work_experience_years: number; status: string;
  application_count: number; created_at: string; marital_status: string;
  num_dependants: number; noc_code: string; occupation: string; source: string;
  date_of_birth: string; passport_number: string; passport_expiry: string;
  canadian_work_experience_years: number; provincial_nomination: boolean;
  province_nominated: string; referral_name: string; notes: string;
};
type ImmApplication = {
  id: number; client_id: number; client_name: string; program_type: string;
  program_subtype: string; application_number: string; uci_number: string;
  submission_date: string; decision_date: string; status: string;
  biometrics_required: boolean; biometrics_date: string;
  medical_exam_required: boolean; medical_exam_date: string;
  ircc_fee: string; consultant_fee: string; notes: string; timeline_notes: string;
  created_at: string; nationality: string;
  documents?: ImmDocument[]; tasks?: ImmTask[];
};
type ImmDocument = {
  id: number; application_id: number; document_name: string; document_type: string;
  status: string; expiry_date: string; notes: string; created_at: string;
};
type ImmTask = {
  id: number; application_id: number; title: string; description: string;
  due_date: string; completed_at: string; priority: string;
  assigned_to: string; status: string; created_at: string;
  client_name?: string; program_type?: string;
};
type Stats = {
  clients: { total: string; active: string; by_status: Record<string,string> };
  applications: { preparing: string; submitted: string; approved: string; refused: string; in_review: string };
  upcoming_deadlines: (ImmTask & { client_name: string; program_type: string })[];
  processing_times_note: Record<string,string>;
};

// ─── Constants ────────────────────────────────────────────────────────────────
const TABS = ['dashboard','clients','applications','documents','tasks','ai-advisor','fee-tracker'] as const;
type Tab = typeof TABS[number];

const PROG_TYPES = [
  'express_entry','pnp','family_sponsorship','study_permit','work_permit',
  'visitor_visa','eta','business_immigration','refugee','citizenship',
  'trp','criminal_rehabilitation','record_suspension','other'
];
const PROG_SUBTYPES: Record<string,string[]> = {
  express_entry: ['FSW','FST','CEC'],
  pnp: ['AAIP','BC PNP','OINP','Saskatchewan','Manitoba','Nova Scotia','New Brunswick','PEI','Newfoundland','Yukon','Northwest Territories','Nunavut'],
  family_sponsorship: ['Spouse/Partner','Parents & Grandparents (PGP)','Children','Other relatives'],
  work_permit: ['LMIA-based','LMIA-exempt','Open Work Permit','PGWP','IEC'],
  business_immigration: ['Start-Up Visa','Self-Employed','ICT'],
  refugee: ['Convention Refugee','H&C'],
  citizenship: ['Citizenship Application','Renunciation','Search of Records'],
};
const STATUS_COLORS: Record<string,string> = {
  prospect: 'bg-gray-100 text-gray-700',
  active: 'bg-blue-100 text-blue-800',
  submitted: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  refused: 'bg-red-100 text-red-800',
  closed: 'bg-slate-100 text-slate-600',
  preparing: 'bg-gray-100 text-gray-700',
  additional_docs_requested: 'bg-orange-100 text-orange-800',
  in_review: 'bg-purple-100 text-purple-800',
  withdrawn: 'bg-slate-100 text-slate-600',
  abandoned: 'bg-slate-100 text-slate-600',
  pending: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-800',
  in_progress: 'bg-blue-100 text-blue-700',
  blocked: 'bg-red-100 text-red-700',
};
const PROG_COLORS: Record<string,string> = {
  express_entry: 'bg-blue-600 text-white',
  pnp: 'bg-purple-600 text-white',
  family_sponsorship: 'bg-pink-600 text-white',
  study_permit: 'bg-green-600 text-white',
  work_permit: 'bg-orange-500 text-white',
  visitor_visa: 'bg-sky-500 text-white',
  citizenship: 'bg-red-600 text-white',
  other: 'bg-gray-500 text-white',
};
const PRIORITY_COLORS: Record<string,string> = {
  high: 'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  low: 'bg-green-50 text-green-700 border-green-200',
};
const API = '/api/admin/immigration-consultant';

function badge(val: string, map: Record<string,string>, fallback = 'bg-gray-100 text-gray-700') {
  return `inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[val] ?? fallback}`;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ImmigrationConsultantPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [stats, setStats] = useState<Stats | null>(null);
  const [clients, setClients] = useState<ImmClient[]>([]);
  const [applications, setApplications] = useState<ImmApplication[]>([]);
  const [selectedApp, setSelectedApp] = useState<ImmApplication | null>(null);
  const [appDocs, setAppDocs] = useState<ImmDocument[]>([]);
  const [appTasks, setAppTasks] = useState<ImmTask[]>([]);
  const [allTasks, setAllTasks] = useState<ImmTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  // Modal states
  const [showClientModal, setShowClientModal] = useState(false);
  const [showAppModal, setShowAppModal] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [clientStep, setClientStep] = useState(1);

  // AI states
  const [aiForm, setAiForm] = useState({ crs_score:'', program_type:'', clb_english:'', work_experience_years:'', education_level:'' });
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [checklistResult, setChecklistResult] = useState('');
  const [checklistProg, setChecklistProg] = useState('express_entry');
  const [checklistSub, setChecklistSub] = useState('');

  // Forms
  const [clientForm, setClientForm] = useState({
    name:'', email:'', phone:'', nationality:'', country_of_birth:'', date_of_birth:'',
    passport_number:'', passport_expiry:'', current_country:'Canada', current_status:'',
    marital_status:'', num_dependants:'0', education_level:'', noc_code:'', occupation:'',
    clb_english:'', clb_french:'', work_experience_years:'', canadian_work_experience_years:'0',
    provincial_nomination:false, province_nominated:'', crs_score:'', source:'', referral_name:'',
    status:'prospect', notes:'',
  });
  const [appForm, setAppForm] = useState({
    client_id:'', program_type:'express_entry', program_subtype:'', application_number:'',
    uci_number:'', submission_date:'', ircc_fee:'', consultant_fee:'', notes:'',
  });
  const [docForm, setDocForm] = useState({ document_name:'', document_type:'', notes:'' });
  const [taskForm, setTaskForm] = useState({ title:'', description:'', due_date:'', priority:'medium', assigned_to:'consultant' });

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const [s, c, a] = await Promise.all([
        fetch(API).then(r => r.json()),
        fetch(`${API}/clients`).then(r => r.json()),
        fetch(`${API}/applications`).then(r => r.json()),
      ]);
      setStats(s); setClients(c.clients ?? []); setApplications(a.applications ?? []);
      // gather tasks from applications for task tab
      const tasks: ImmTask[] = a.applications?.flatMap((ap: ImmApplication) => []) ?? [];
      setAllTasks(tasks);
    } catch { setErr('Failed to load data.'); }
    finally { setLoading(false); }
  }, []);

  const loadAppDetail = useCallback(async (app: ImmApplication) => {
    setSelectedApp(app);
    const [docs, tasks] = await Promise.all([
      fetch(`${API}/applications/${app.id}/documents`).then(r => r.json()),
      fetch(`${API}/applications/${app.id}/tasks`).then(r => r.json()),
    ]);
    setAppDocs(docs.documents ?? []);
    setAppTasks(tasks.tasks ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Submissions ─────────────────────────────────────────────────────────────
  async function submitClient() {
    const r = await fetch(`${API}/clients`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(clientForm) });
    if (r.ok) { setShowClientModal(false); setClientStep(1); load(); }
    else { const e = await r.json(); setErr(e.error || 'Failed to save client.'); }
  }
  async function submitApp() {
    const r = await fetch(`${API}/applications`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(appForm) });
    if (r.ok) { setShowAppModal(false); load(); }
    else { const e = await r.json(); setErr(e.error || 'Failed to save application.'); }
  }
  async function submitDoc() {
    if (!selectedApp) return;
    const r = await fetch(`${API}/applications/${selectedApp.id}/documents`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(docForm) });
    if (r.ok) { setShowDocModal(false); loadAppDetail(selectedApp); }
    else { const e = await r.json(); setErr(e.error || 'Failed to save document.'); }
  }
  async function submitTask() {
    if (!selectedApp) return;
    const r = await fetch(`${API}/applications/${selectedApp.id}/tasks`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(taskForm) });
    if (r.ok) { setShowTaskModal(false); loadAppDetail(selectedApp); }
    else { const e = await r.json(); setErr(e.error || 'Failed to save task.'); }
  }
  async function updateDocStatus(docId: number, status: string) {
    if (!selectedApp) return;
    await fetch(`${API}/applications/${selectedApp.id}/documents`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ document_name: appDocs.find(d=>d.id===docId)?.document_name, status }) });
    loadAppDetail(selectedApp);
  }
  async function completeTask(taskId: number) {
    await fetch(`${API}/tasks/${taskId}/complete`, { method:'POST' });
    if (selectedApp) loadAppDetail(selectedApp);
    load();
  }
  async function updateAppStatus(appId: number, status: string) {
    await fetch(`${API}/applications/${appId}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status }) });
    load();
    if (selectedApp?.id === appId) setSelectedApp(prev => prev ? { ...prev, status } : null);
  }
  async function runAiAssess() {
    setAiLoading(true); setAiResult('');
    const r = await fetch(`${API}/ai-assess`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(aiForm) });
    const d = await r.json(); setAiResult(d.assessment ?? d.error ?? ''); setAiLoading(false);
  }
  async function runChecklist() {
    setAiLoading(true); setChecklistResult('');
    const r = await fetch(`${API}/document-checklist`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ program_type: checklistProg, program_subtype: checklistSub }) });
    const d = await r.json(); setChecklistResult(d.checklist ?? d.error ?? ''); setAiLoading(false);
  }

  const isOverdue = (d: string) => d && new Date(d) < new Date();

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-slate-800 text-white px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Immigration Consultant Hub</h1>
          <p className="text-slate-400 text-sm">RCIC CRM — IRCC Applications &amp; Client Management</p>
        </div>
        <button onClick={load} className="text-slate-300 hover:text-white text-sm border border-slate-600 px-3 py-1 rounded">↻ Refresh</button>
      </div>

      {err && <div className="mx-6 mt-3 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">{err} <button onClick={()=>setErr('')} className="ml-2 text-red-400">✕</button></div>}

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200 px-6 flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              tab === t ? 'border-slate-700 text-slate-800' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}
          </button>
        ))}
      </div>

      <div className="p-6">
        {loading && <div className="text-center py-12 text-gray-400">Loading…</div>}

        {/* ── TAB 1: Dashboard ── */}
        {!loading && tab === 'dashboard' && stats && (
          <div className="space-y-6">
            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label:'Total Clients', val: stats.clients.total, color:'bg-blue-50 border-blue-200' },
                { label:'Active Clients', val: stats.clients.active, color:'bg-green-50 border-green-200' },
                { label:'Submitted', val: stats.applications.submitted, color:'bg-yellow-50 border-yellow-200' },
                { label:'Approved', val: stats.applications.approved, color:'bg-emerald-50 border-emerald-200' },
              ].map(k => (
                <div key={k.label} className={`border rounded-lg p-4 ${k.color}`}>
                  <div className="text-2xl font-bold text-gray-800">{k.val ?? 0}</div>
                  <div className="text-sm text-gray-500 mt-1">{k.label}</div>
                </div>
              ))}
            </div>

            {/* Applications pipeline */}
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Applications Pipeline</h3>
              <div className="space-y-3">
                {[
                  { label:'Preparing', val: stats.applications.preparing, color:'bg-gray-400' },
                  { label:'Submitted', val: stats.applications.submitted, color:'bg-yellow-400' },
                  { label:'In Review', val: stats.applications.in_review, color:'bg-purple-500' },
                  { label:'Approved', val: stats.applications.approved, color:'bg-green-500' },
                  { label:'Refused', val: stats.applications.refused, color:'bg-red-500' },
                ].map(s => {
                  const total = Object.values(stats.applications).reduce((a,v)=>a+parseInt(v||'0'),0) || 1;
                  const pct = Math.round(parseInt(s.val||'0')/total*100);
                  return (
                    <div key={s.label} className="flex items-center gap-3">
                      <div className="w-28 text-sm text-gray-600">{s.label}</div>
                      <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                        <div className={`h-full rounded-full ${s.color}`} style={{width:`${pct}%`}}/>
                      </div>
                      <div className="w-8 text-sm font-medium text-gray-700">{s.val ?? 0}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Upcoming deadlines */}
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Upcoming Deadlines (14 days)</h3>
              {stats.upcoming_deadlines.length === 0
                ? <p className="text-gray-400 text-sm">No upcoming deadlines.</p>
                : <div className="space-y-2">
                    {stats.upcoming_deadlines.map(d => (
                      <div key={d.id} className={`flex items-center justify-between p-3 rounded-lg border ${isOverdue(d.due_date) ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                        <div>
                          <div className="font-medium text-sm text-gray-800">{d.title}</div>
                          <div className="text-xs text-gray-500">{d.client_name} — {d.program_type?.replace(/_/g,' ')}</div>
                        </div>
                        <div className={`text-sm font-medium ${isOverdue(d.due_date) ? 'text-red-600' : 'text-gray-700'}`}>
                          {d.due_date ? new Date(d.due_date).toLocaleDateString('en-CA') : '—'}
                        </div>
                      </div>
                    ))}
                  </div>
              }
            </div>

            {/* Processing times note */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-5">
              <h3 className="font-semibold text-amber-800 mb-2">IRCC Processing Time Reference (General Estimates Only)</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(stats.processing_times_note).filter(([k])=>k!=='note').map(([k,v])=>(
                  <div key={k} className="bg-white border border-amber-100 rounded p-3">
                    <div className="text-xs text-amber-700 font-medium uppercase">{k.replace(/_/g,' ')}</div>
                    <div className="text-sm text-gray-700 mt-1">{v}</div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-amber-600 mt-3">{stats.processing_times_note.note}</p>
            </div>
          </div>
        )}

        {/* ── TAB 2: Clients ── */}
        {!loading && tab === 'clients' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800">Clients ({clients.length})</h2>
              <button onClick={() => { setClientStep(1); setShowClientModal(true); }}
                className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-700">
                + Add Client
              </button>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>{['Name','Nationality','CRS','CLB','Current Status','Applications','Status'].map(h=>(
                    <th key={h} className="px-4 py-3 text-left font-medium text-gray-600">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {clients.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{c.name}</div>
                        <div className="text-xs text-gray-400">{c.email}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{c.nationality || '—'}</td>
                      <td className="px-4 py-3 font-medium text-gray-700">{c.crs_score ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{c.clb_english ? `EN: ${c.clb_english}` : '—'}{c.clb_french ? ` FR: ${c.clb_french}` : ''}</td>
                      <td className="px-4 py-3 text-gray-600">{c.current_status || '—'}</td>
                      <td className="px-4 py-3 text-center text-gray-700">{c.application_count ?? 0}</td>
                      <td className="px-4 py-3"><span className={badge(c.status, STATUS_COLORS)}>{c.status}</span></td>
                    </tr>
                  ))}
                  {clients.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No clients yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB 3: Applications ── */}
        {!loading && tab === 'applications' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800">Applications ({applications.length})</h2>
              <button onClick={() => setShowAppModal(true)}
                className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-700">
                + New Application
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {applications.map(a => (
                <div key={a.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-medium text-gray-800">{a.client_name}</div>
                      <div className="text-xs text-gray-400">{a.nationality}</div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded font-medium ${PROG_COLORS[a.program_type] ?? 'bg-gray-500 text-white'}`}>
                      {a.program_type.replace(/_/g,' ').toUpperCase()}
                    </span>
                  </div>
                  {a.program_subtype && <div className="text-xs text-gray-500 mb-2">Subtype: {a.program_subtype}</div>}
                  {a.application_number && <div className="text-xs text-gray-500 mb-1">App#: {a.application_number}</div>}
                  <div className="flex items-center gap-2 mb-3">
                    <span className={badge(a.status, STATUS_COLORS)}>{a.status.replace(/_/g,' ')}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mb-3">
                    {a.submission_date && <div>Submitted: {new Date(a.submission_date).toLocaleDateString('en-CA')}</div>}
                    {a.consultant_fee && <div>Fee: ${parseFloat(a.consultant_fee).toLocaleString()}</div>}
                  </div>
                  <div className="flex gap-2">
                    <select className="flex-1 text-xs border border-gray-200 rounded px-2 py-1"
                      value={a.status} onChange={e => updateAppStatus(a.id, e.target.value)}>
                      {['preparing','submitted','additional_docs_requested','in_review','approved','refused','withdrawn','abandoned'].map(s=>(
                        <option key={s} value={s}>{s.replace(/_/g,' ')}</option>
                      ))}
                    </select>
                    <button onClick={() => { loadAppDetail(a); setTab('documents'); }}
                      className="text-xs border border-gray-200 px-2 py-1 rounded hover:bg-gray-50">Docs</button>
                    <button onClick={() => { loadAppDetail(a); setTab('tasks'); }}
                      className="text-xs border border-gray-200 px-2 py-1 rounded hover:bg-gray-50">Tasks</button>
                  </div>
                </div>
              ))}
              {applications.length === 0 && (
                <div className="col-span-3 text-center py-12 text-gray-400">No applications yet.</div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 4: Documents & Checklist ── */}
        {!loading && tab === 'documents' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800">Documents &amp; Checklist</h2>
              <div className="flex gap-2">
                <button onClick={() => setShowDocModal(true)} disabled={!selectedApp}
                  className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-700 disabled:opacity-40">
                  + Add Document
                </button>
              </div>
            </div>
            {/* Application selector */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Application</label>
              <select className="border border-gray-200 rounded px-3 py-2 text-sm w-full md:w-96"
                value={selectedApp?.id ?? ''}
                onChange={e => { const a=applications.find(x=>x.id===parseInt(e.target.value)); if(a) loadAppDetail(a); }}>
                <option value=''>— Choose an application —</option>
                {applications.map(a=>(
                  <option key={a.id} value={a.id}>{a.client_name} — {a.program_type.replace(/_/g,' ')} ({a.status})</option>
                ))}
              </select>
            </div>
            {selectedApp && (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h3 className="font-medium text-gray-800 mb-3">Documents ({appDocs.length})</h3>
                  <div className="space-y-2">
                    {appDocs.map(d => (
                      <div key={d.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                        <div>
                          <div className="text-sm font-medium text-gray-800">{d.document_name}</div>
                          {d.document_type && <div className="text-xs text-gray-400">{d.document_type}</div>}
                          {d.expiry_date && <div className="text-xs text-gray-400">Exp: {new Date(d.expiry_date).toLocaleDateString('en-CA')}</div>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={badge(d.status, STATUS_COLORS)}>{d.status}</span>
                          <select className="text-xs border border-gray-200 rounded px-1 py-0.5"
                            value={d.status} onChange={e => updateDocStatus(d.id, e.target.value)}>
                            {['pending','received','verified','submitted','approved','rejected'].map(s=>(
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                    {appDocs.length === 0 && <p className="text-gray-400 text-sm">No documents added.</p>}
                  </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h3 className="font-medium text-gray-800 mb-3">AI Document Checklist</h3>
                  <div className="flex gap-2 mb-3">
                    <select className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-sm"
                      value={checklistProg} onChange={e => setChecklistProg(e.target.value)}>
                      {PROG_TYPES.map(p=><option key={p} value={p}>{p.replace(/_/g,' ')}</option>)}
                    </select>
                    <input className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-sm" placeholder="Subtype (optional)"
                      value={checklistSub} onChange={e => setChecklistSub(e.target.value)}/>
                  </div>
                  <button onClick={runChecklist} disabled={aiLoading}
                    className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                    {aiLoading ? 'Generating…' : 'Generate AI Checklist'}
                  </button>
                  {checklistResult && (
                    <div className="mt-3 bg-gray-50 border border-gray-200 rounded p-3 text-sm text-gray-700 whitespace-pre-wrap max-h-64 overflow-y-auto">{checklistResult}</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 5: Tasks & Deadlines ── */}
        {!loading && tab === 'tasks' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800">Tasks &amp; Deadlines</h2>
              <div className="flex gap-2">
                <select className="border border-gray-200 rounded px-3 py-2 text-sm"
                  value={selectedApp?.id ?? ''}
                  onChange={e => { const a=applications.find(x=>x.id===parseInt(e.target.value)); if(a) loadAppDetail(a); }}>
                  <option value=''>— Select application —</option>
                  {applications.map(a=>(
                    <option key={a.id} value={a.id}>{a.client_name} — {a.program_type.replace(/_/g,' ')}</option>
                  ))}
                </select>
                <button onClick={() => setShowTaskModal(true)} disabled={!selectedApp}
                  className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-700 disabled:opacity-40">
                  + Add Task
                </button>
              </div>
            </div>
            {/* Weekly calendar header */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="font-medium text-gray-700 mb-3 text-sm">Task List{selectedApp ? ` — ${selectedApp.client_name}` : ' (select an application)'}</h3>
              <div className="space-y-2">
                {appTasks.map(t => (
                  <div key={t.id} className={`flex items-center justify-between p-3 rounded-lg border ${PRIORITY_COLORS[t.priority]} ${t.status==='completed'?'opacity-60':''} ${isOverdue(t.due_date)&&t.status!=='completed'?'bg-red-50 border-red-300':''}`}>
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="text-sm font-medium">{t.title}</div>
                        {t.description && <div className="text-xs text-gray-400">{t.description}</div>}
                        <div className="flex gap-2 mt-1">
                          <span className={badge(t.priority, { high:'bg-red-100 text-red-700', medium:'bg-yellow-100 text-yellow-700', low:'bg-green-100 text-green-700' })}>{t.priority}</span>
                          <span className={badge(t.status, STATUS_COLORS)}>{t.status}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {t.due_date && (
                        <div className={`text-sm font-medium ${isOverdue(t.due_date)&&t.status!=='completed'?'text-red-600':'text-gray-700'}`}>
                          {new Date(t.due_date).toLocaleDateString('en-CA')}
                        </div>
                      )}
                      {t.status !== 'completed' && (
                        <button onClick={() => completeTask(t.id)}
                          className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700">
                          Complete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {appTasks.length === 0 && <p className="text-gray-400 text-sm">No tasks for selected application.</p>}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 6: AI Eligibility Advisor ── */}
        {!loading && tab === 'ai-advisor' && (
          <div className="max-w-2xl space-y-5">
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">AI Eligibility Advisor</h2>
              <div className="grid grid-cols-2 gap-4 mb-4">
                {[
                  { label:'CRS Score', field:'crs_score', type:'number', placeholder:'e.g. 450' },
                  { label:'CLB English', field:'clb_english', type:'number', placeholder:'e.g. 9' },
                  { label:'Work Experience (years)', field:'work_experience_years', type:'number', placeholder:'e.g. 5' },
                ].map(f => (
                  <div key={f.field}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                    <input type={f.type} placeholder={f.placeholder}
                      className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                      value={(aiForm as Record<string,string>)[f.field]}
                      onChange={e => setAiForm(prev=>({...prev,[f.field]:e.target.value}))}/>
                  </div>
                ))}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Education Level</label>
                  <select className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                    value={aiForm.education_level} onChange={e=>setAiForm(prev=>({...prev,education_level:e.target.value}))}>
                    <option value=''>— Select —</option>
                    {['high_school','diploma','bachelor','master','phd','trade'].map(e=>(
                      <option key={e} value={e}>{e.replace(/_/g,' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Program Interest</label>
                  <select className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                    value={aiForm.program_type} onChange={e=>setAiForm(prev=>({...prev,program_type:e.target.value}))}>
                    <option value=''>— All programs —</option>
                    {PROG_TYPES.map(p=><option key={p} value={p}>{p.replace(/_/g,' ')}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={runAiAssess} disabled={aiLoading}
                className="w-full bg-slate-800 text-white py-2.5 rounded-lg text-sm hover:bg-slate-700 disabled:opacity-50">
                {aiLoading ? 'Analysing…' : 'Assess Eligibility'}
              </button>
              {aiResult && (
                <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap max-h-96 overflow-y-auto">
                  {aiResult}
                </div>
              )}
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-xs text-amber-700">
              AI guidance is for educational purposes only. Always verify eligibility with official IRCC resources and consult a licensed RCIC for individual advice.
            </div>
          </div>
        )}

        {/* ── TAB 7: Fee Tracker ── */}
        {!loading && tab === 'fee-tracker' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">Fee Tracker</h2>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label:'Total Billed', val: applications.reduce((s,a)=>s+parseFloat(a.consultant_fee||'0'),0) },
                { label:'Applications with Fees', val: applications.filter(a=>a.consultant_fee).length },
                { label:'Avg Fee', val: (() => { const withFee=applications.filter(a=>a.consultant_fee); return withFee.length ? withFee.reduce((s,a)=>s+parseFloat(a.consultant_fee),0)/withFee.length : 0; })() },
              ].map(k=>(
                <div key={k.label} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="text-2xl font-bold text-gray-800">${(typeof k.val==='number'?k.val:0).toLocaleString('en-CA',{minimumFractionDigits:0,maximumFractionDigits:0})}</div>
                  <div className="text-sm text-gray-500 mt-1">{k.label}</div>
                </div>
              ))}
            </div>
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>{['Client','Program','IRCC Fee','Consultant Fee','Status'].map(h=>(
                    <th key={h} className="px-4 py-3 text-left font-medium text-gray-600">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {applications.filter(a=>a.consultant_fee||a.ircc_fee).map(a=>(
                    <tr key={a.id}>
                      <td className="px-4 py-3 font-medium text-gray-800">{a.client_name}</td>
                      <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded font-medium ${PROG_COLORS[a.program_type]??'bg-gray-400 text-white'}`}>{a.program_type.replace(/_/g,' ')}</span></td>
                      <td className="px-4 py-3 text-gray-700">{a.ircc_fee ? `$${parseFloat(a.ircc_fee).toLocaleString('en-CA')}` : '—'}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{a.consultant_fee ? `$${parseFloat(a.consultant_fee).toLocaleString('en-CA')}` : '—'}</td>
                      <td className="px-4 py-3"><span className={badge(a.status,STATUS_COLORS)}>{a.status.replace(/_/g,' ')}</span></td>
                    </tr>
                  ))}
                  {applications.filter(a=>a.consultant_fee||a.ircc_fee).length===0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No fee data yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Add Client Modal ── */}
      {showClientModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-800">Add Client — Step {clientStep} of 4</h3>
              <button onClick={()=>{setShowClientModal(false);setClientStep(1);}} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-6 space-y-4">
              {clientStep === 1 && (
                <>
                  <h4 className="font-medium text-gray-700">Personal Information</h4>
                  {[{f:'name',l:'Full Name *'},{f:'email',l:'Email'},{f:'phone',l:'Phone'},{f:'nationality',l:'Nationality'},{f:'country_of_birth',l:'Country of Birth'}].map(({f,l})=>(
                    <div key={f}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{l}</label>
                      <input className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                        value={(clientForm as unknown as Record<string,string>)[f]}
                        onChange={e=>setClientForm(prev=>({...prev,[f]:e.target.value}))}/>
                    </div>
                  ))}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                      <input type="date" className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                        value={clientForm.date_of_birth} onChange={e=>setClientForm(prev=>({...prev,date_of_birth:e.target.value}))}/>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Passport Expiry</label>
                      <input type="date" className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                        value={clientForm.passport_expiry} onChange={e=>setClientForm(prev=>({...prev,passport_expiry:e.target.value}))}/>
                    </div>
                  </div>
                </>
              )}
              {clientStep === 2 && (
                <>
                  <h4 className="font-medium text-gray-700">Immigration Status</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Current Country</label>
                      <input className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                        value={clientForm.current_country} onChange={e=>setClientForm(prev=>({...prev,current_country:e.target.value}))}/>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Current Status</label>
                      <select className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                        value={clientForm.current_status} onChange={e=>setClientForm(prev=>({...prev,current_status:e.target.value}))}>
                        <option value=''>— Select —</option>
                        {['visitor','student','worker','PR','citizen','none'].map(s=><option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Marital Status</label>
                      <select className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                        value={clientForm.marital_status} onChange={e=>setClientForm(prev=>({...prev,marital_status:e.target.value}))}>
                        <option value=''>— Select —</option>
                        {['single','married','common_law','separated','divorced','widowed'].map(s=><option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Dependants</label>
                      <input type="number" min="0" className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                        value={clientForm.num_dependants} onChange={e=>setClientForm(prev=>({...prev,num_dependants:e.target.value}))}/>
                    </div>
                  </div>
                </>
              )}
              {clientStep === 3 && (
                <>
                  <h4 className="font-medium text-gray-700">Qualifications</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Education Level</label>
                      <select className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                        value={clientForm.education_level} onChange={e=>setClientForm(prev=>({...prev,education_level:e.target.value}))}>
                        <option value=''>— Select —</option>
                        {['high_school','diploma','bachelor','master','phd','trade'].map(e=><option key={e} value={e}>{e.replace(/_/g,' ')}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">NOC Code</label>
                      <input className="w-full border border-gray-200 rounded px-3 py-2 text-sm" placeholder="e.g. 21232"
                        value={clientForm.noc_code} onChange={e=>setClientForm(prev=>({...prev,noc_code:e.target.value}))}/>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">CLB English</label>
                      <input type="number" min="0" max="12" className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                        value={clientForm.clb_english} onChange={e=>setClientForm(prev=>({...prev,clb_english:e.target.value}))}/>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">CLB French</label>
                      <input type="number" min="0" max="12" className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                        value={clientForm.clb_french} onChange={e=>setClientForm(prev=>({...prev,clb_french:e.target.value}))}/>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Work Experience (years)</label>
                      <input type="number" min="0" className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                        value={clientForm.work_experience_years} onChange={e=>setClientForm(prev=>({...prev,work_experience_years:e.target.value}))}/>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Canadian Work Experience (years)</label>
                      <input type="number" min="0" className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                        value={clientForm.canadian_work_experience_years} onChange={e=>setClientForm(prev=>({...prev,canadian_work_experience_years:e.target.value}))}/>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Occupation</label>
                    <input className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                      value={clientForm.occupation} onChange={e=>setClientForm(prev=>({...prev,occupation:e.target.value}))}/>
                  </div>
                </>
              )}
              {clientStep === 4 && (
                <>
                  <h4 className="font-medium text-gray-700">Program Match &amp; Source</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">CRS Score (if known)</label>
                      <input type="number" className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                        value={clientForm.crs_score} onChange={e=>setClientForm(prev=>({...prev,crs_score:e.target.value}))}/>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <select className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                        value={clientForm.status} onChange={e=>setClientForm(prev=>({...prev,status:e.target.value}))}>
                        {['prospect','active','submitted','approved','refused','closed'].map(s=><option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="flex items-center gap-2 pt-5">
                      <input type="checkbox" id="prov_nom" checked={clientForm.provincial_nomination}
                        onChange={e=>setClientForm(prev=>({...prev,provincial_nomination:e.target.checked}))}/>
                      <label htmlFor="prov_nom" className="text-sm text-gray-700">Provincial Nomination</label>
                    </div>
                    {clientForm.provincial_nomination && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Province Nominated</label>
                        <input className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                          value={clientForm.province_nominated} onChange={e=>setClientForm(prev=>({...prev,province_nominated:e.target.value}))}/>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                      <input className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                        value={clientForm.source} onChange={e=>setClientForm(prev=>({...prev,source:e.target.value}))}/>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Referral Name</label>
                      <input className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                        value={clientForm.referral_name} onChange={e=>setClientForm(prev=>({...prev,referral_name:e.target.value}))}/>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea rows={3} className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                      value={clientForm.notes} onChange={e=>setClientForm(prev=>({...prev,notes:e.target.value}))}/>
                  </div>
                </>
              )}
            </div>
            <div className="flex justify-between px-6 py-4 border-t border-gray-200">
              <button onClick={()=>setClientStep(s=>Math.max(1,s-1))} disabled={clientStep===1}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm disabled:opacity-40">Back</button>
              {clientStep < 4
                ? <button onClick={()=>setClientStep(s=>s+1)} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-700">Next</button>
                : <button onClick={submitClient} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700">Save Client</button>
              }
            </div>
          </div>
        </div>
      )}

      {/* ── New Application Modal ── */}
      {showAppModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-800">New Application</h3>
              <button onClick={()=>setShowAppModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client *</label>
                <select className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                  value={appForm.client_id} onChange={e=>setAppForm(prev=>({...prev,client_id:e.target.value}))}>
                  <option value=''>— Select client —</option>
                  {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Program Type *</label>
                  <select className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                    value={appForm.program_type} onChange={e=>setAppForm(prev=>({...prev,program_type:e.target.value,program_subtype:''}))}>
                    {PROG_TYPES.map(p=><option key={p} value={p}>{p.replace(/_/g,' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subtype</label>
                  <select className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                    value={appForm.program_subtype} onChange={e=>setAppForm(prev=>({...prev,program_subtype:e.target.value}))}>
                    <option value=''>— None —</option>
                    {(PROG_SUBTYPES[appForm.program_type]||[]).map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Application #</label>
                  <input className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                    value={appForm.application_number} onChange={e=>setAppForm(prev=>({...prev,application_number:e.target.value}))}/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">UCI Number</label>
                  <input className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                    value={appForm.uci_number} onChange={e=>setAppForm(prev=>({...prev,uci_number:e.target.value}))}/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">IRCC Fee ($)</label>
                  <input type="number" step="0.01" className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                    value={appForm.ircc_fee} onChange={e=>setAppForm(prev=>({...prev,ircc_fee:e.target.value}))}/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Consultant Fee ($)</label>
                  <input type="number" step="0.01" className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                    value={appForm.consultant_fee} onChange={e=>setAppForm(prev=>({...prev,consultant_fee:e.target.value}))}/>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Submission Date</label>
                <input type="date" className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                  value={appForm.submission_date} onChange={e=>setAppForm(prev=>({...prev,submission_date:e.target.value}))}/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea rows={2} className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                  value={appForm.notes} onChange={e=>setAppForm(prev=>({...prev,notes:e.target.value}))}/>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
              <button onClick={()=>setShowAppModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm">Cancel</button>
              <button onClick={submitApp} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-700">Save Application</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Document Modal ── */}
      {showDocModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-800">Add Document</h3>
              <button onClick={()=>setShowDocModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Document Name *</label>
                <input className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                  value={docForm.document_name} onChange={e=>setDocForm(prev=>({...prev,document_name:e.target.value}))}/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Document Type</label>
                <select className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                  value={docForm.document_type} onChange={e=>setDocForm(prev=>({...prev,document_type:e.target.value}))}>
                  <option value=''>— Select —</option>
                  {['passport','photo','language_test','education','employment','financial','police_cert','medical','other'].map(t=>(
                    <option key={t} value={t}>{t.replace(/_/g,' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <input className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                  value={docForm.notes} onChange={e=>setDocForm(prev=>({...prev,notes:e.target.value}))}/>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
              <button onClick={()=>setShowDocModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm">Cancel</button>
              <button onClick={submitDoc} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-700">Add Document</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Task Modal ── */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-800">Add Task</h3>
              <button onClick={()=>setShowTaskModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Task Title *</label>
                <input className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                  value={taskForm.title} onChange={e=>setTaskForm(prev=>({...prev,title:e.target.value}))}/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea rows={2} className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                  value={taskForm.description} onChange={e=>setTaskForm(prev=>({...prev,description:e.target.value}))}/>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                  <input type="date" className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                    value={taskForm.due_date} onChange={e=>setTaskForm(prev=>({...prev,due_date:e.target.value}))}/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                    value={taskForm.priority} onChange={e=>setTaskForm(prev=>({...prev,priority:e.target.value}))}>
                    {['high','medium','low'].map(p=><option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assigned To</label>
                <input className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                  value={taskForm.assigned_to} onChange={e=>setTaskForm(prev=>({...prev,assigned_to:e.target.value}))}/>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
              <button onClick={()=>setShowTaskModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm">Cancel</button>
              <button onClick={submitTask} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-700">Add Task</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
