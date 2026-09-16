'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard','projects','tasks','rfis','schedule','ai'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = { dashboard: 'Dashboard', projects: 'Projects', tasks: 'Tasks', rfis: 'RFIs', schedule: 'Schedule', ai: 'AI Construction Tools' };

const PROJECT_STATUSES = ['bidding','awarded','pre_construction','active','substantial_completion','closeout','completed','on_hold','cancelled'];
const PROJECT_TYPES = ['new_build','renovation','addition','tenant_improvement','infrastructure','site_development','industrial','other'];
const TASK_STATUSES = ['not_started','in_progress','completed','blocked','on_hold'];
const TRADES = ['general','civil','concrete','framing','electrical','plumbing','hvac','drywalling','insulation','roofing','windows','flooring','painting','landscaping','other'];
const CLIENT_TYPES = ['residential','commercial','industrial','municipal','institutional'];

interface DashStats { active_projects: number; total_contract_value_active: number; projects_behind_schedule: number; open_rfis: number; safety_incidents_ytd: number; }
interface CpmClient { id: number; company_name: string; contact_name: string; contact_email: string; contact_phone: string; city: string; client_type: string; status: string; total_projects: number; total_contract_value: number; }
interface CpmProject { id: number; client_id: number; client_name: string; project_name: string; project_number: string; project_type: string; city: string; status: string; contract_value: number; change_orders_total: number; percent_complete: number; original_start_date: string; original_completion_date: string; revised_completion_date: string; project_manager: string; superintendent: string; safety_incidents: number; safety_hours_worked: number; }
interface CpmTask { id: number; project_id: number; task_name: string; trade: string; assigned_to: string; start_date: string; end_date: string; status: string; priority: string; completion_pct: number; }
interface CpmRfi { id: number; project_id: number; rfi_number: string; subject: string; trade: string; submitted_by: string; submitted_date: string; directed_to: string; response_required_by: string; description: string; response: string; status: string; cost_impact: number; schedule_impact_days: number; }

function fmtCad(n: number) { return `$${Number(n ?? 0).toLocaleString('en-CA', { minimumFractionDigits: 0 })}`; }
function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString('en-CA') : '—'; }
function daysUntil(d: string) { if (!d) return null; const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000); return diff; }

function Badge({ label, color = 'gray' }: { label: string; color?: string }) {
  const map: Record<string, string> = { blue: 'bg-blue-100 text-blue-700', green: 'bg-green-100 text-green-700', amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700', purple: 'bg-purple-100 text-purple-700', gray: 'bg-gray-100 text-gray-700', teal: 'bg-teal-100 text-teal-700', orange: 'bg-orange-100 text-orange-700', yellow: 'bg-yellow-100 text-yellow-700' };
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${map[color] ?? map.gray}`}>{label.replace(/_/g, ' ')}</span>;
}
function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const borders: Record<string, string> = { blue: 'border-l-4 border-blue-500 bg-blue-50', green: 'border-l-4 border-green-500 bg-green-50', amber: 'border-l-4 border-amber-500 bg-amber-50', red: 'border-l-4 border-red-500 bg-red-50', purple: 'border-l-4 border-purple-500 bg-purple-50', orange: 'border-l-4 border-orange-500 bg-orange-50' };
  return <div className={`rounded-lg p-4 ${borders[color] ?? borders.blue}`}><p className="text-sm text-gray-500">{label}</p><p className="text-2xl font-bold mt-1">{value}</p>{sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}</div>;
}

function statusColor(s: string) {
  const m: Record<string, string> = { bidding: 'gray', awarded: 'blue', pre_construction: 'purple', active: 'green', substantial_completion: 'teal', closeout: 'amber', completed: 'teal', on_hold: 'yellow', cancelled: 'red', not_started: 'gray', in_progress: 'blue', blocked: 'red', completed_task: 'green' };
  return m[s] ?? 'gray';
}
function priorityColor(p: string) { const m: Record<string,string> = { low: 'gray', medium: 'blue', high: 'amber', critical: 'red' }; return m[p] ?? 'gray'; }
function tradeColor(t: string) { const m: Record<string,string> = { electrical: 'yellow', plumbing: 'blue', hvac: 'teal', concrete: 'gray', framing: 'amber', roofing: 'purple', electrical_: 'yellow' }; return m[t] ?? 'gray'; }

// ─── Add Client Modal ─────────────────────────────────────────────────────────
function AddClientModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ company_name: '', contact_name: '', contact_email: '', contact_phone: '', city: 'Calgary', province: 'AB', client_type: 'commercial', status: 'active', notes: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.company_name || !form.contact_name || !form.contact_email || !form.contact_phone) return;
    setSaving(true);
    try { await fetch('/api/admin/construction-pm/clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }); onSaved(); }
    finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-4 text-slate-800">New Construction Client</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs text-gray-500">Company Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.company_name} onChange={e => f('company_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Contact Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.contact_name} onChange={e => f('contact_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Client Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.client_type} onChange={e => f('client_type', e.target.value)}>{CLIENT_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Email *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.contact_email} onChange={e => f('contact_email', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Phone *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.contact_phone} onChange={e => f('contact_phone', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">City</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.city} onChange={e => f('city', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Status</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.status} onChange={e => f('status', e.target.value)}>{['active','prospect','inactive'].map(s => <option key={s}>{s}</option>)}</select></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.notes} onChange={e => f('notes', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-1.5 rounded border text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-1.5 rounded bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 disabled:opacity-50">{saving ? 'Saving…' : 'Create Client'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Project Modal ────────────────────────────────────────────────────────
function AddProjectModal({ clients, onClose, onSaved }: { clients: CpmClient[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ client_id: clients[0]?.id?.toString() ?? '', project_name: '', project_type: 'new_build', city: 'Calgary', province: 'AB', site_address: '', project_manager: '', superintendent: '', status: 'bidding', contract_value: '', original_start_date: '', original_completion_date: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.project_name || !form.client_id) return;
    setSaving(true);
    try { await fetch('/api/admin/construction-pm/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, contract_value: parseFloat(form.contract_value) || null }) }); onSaved(); }
    finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-4 text-slate-800">New Construction Project</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs text-gray-500">Client *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.client_id} onChange={e => f('client_id', e.target.value)}>{clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}</select></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Project Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.project_name} onChange={e => f('project_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Project Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.project_type} onChange={e => f('project_type', e.target.value)}>{PROJECT_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Status</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.status} onChange={e => f('status', e.target.value)}>{PROJECT_STATUSES.map(s => <option key={s}>{s}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Project Manager</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.project_manager} onChange={e => f('project_manager', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Superintendent</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.superintendent} onChange={e => f('superintendent', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Contract Value (CAD)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.contract_value} onChange={e => f('contract_value', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">City</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.city} onChange={e => f('city', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Start Date</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.original_start_date} onChange={e => f('original_start_date', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Completion Date</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.original_completion_date} onChange={e => f('original_completion_date', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Site Address</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.site_address} onChange={e => f('site_address', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.notes} onChange={e => f('notes', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-1.5 rounded border text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-1.5 rounded bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 disabled:opacity-50">{saving ? 'Saving…' : 'Create Project'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Task Modal ───────────────────────────────────────────────────────────
function AddTaskModal({ projects, onClose, onSaved }: { projects: CpmProject[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ project_id: projects[0]?.id?.toString() ?? '', task_name: '', trade: 'general', assigned_to: '', start_date: '', end_date: '', status: 'not_started', priority: 'medium', notes: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.task_name || !form.project_id) return;
    setSaving(true);
    try { await fetch(`/api/admin/construction-pm/projects/${form.project_id}/tasks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }); onSaved(); }
    finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-4 text-slate-800">Add Task</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs text-gray-500">Project *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.project_id} onChange={e => f('project_id', e.target.value)}>{projects.map(p => <option key={p.id} value={p.id}>{p.project_number} — {p.project_name}</option>)}</select></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Task Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.task_name} onChange={e => f('task_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Trade</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.trade} onChange={e => f('trade', e.target.value)}>{TRADES.map(t => <option key={t}>{t}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Assigned To</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.assigned_to} onChange={e => f('assigned_to', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Start Date</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.start_date} onChange={e => f('start_date', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">End Date</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.end_date} onChange={e => f('end_date', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Priority</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.priority} onChange={e => f('priority', e.target.value)}>{['low','medium','high','critical'].map(p => <option key={p}>{p}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Status</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.status} onChange={e => f('status', e.target.value)}>{TASK_STATUSES.map(s => <option key={s}>{s}</option>)}</select></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-1.5 rounded border text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-1.5 rounded bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 disabled:opacity-50">{saving ? 'Saving…' : 'Add Task'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add RFI Modal ────────────────────────────────────────────────────────────
function AddRfiModal({ projects, onClose, onSaved }: { projects: CpmProject[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ project_id: projects[0]?.id?.toString() ?? '', subject: '', trade: 'general', submitted_by: '', directed_to: '', response_required_by: '', description: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.subject || !form.project_id) return;
    setSaving(true);
    try { await fetch(`/api/admin/construction-pm/projects/${form.project_id}/rfis`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }); onSaved(); }
    finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-4 text-slate-800">New RFI</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs text-gray-500">Project *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.project_id} onChange={e => f('project_id', e.target.value)}>{projects.map(p => <option key={p.id} value={p.id}>{p.project_number} — {p.project_name}</option>)}</select></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Subject *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.subject} onChange={e => f('subject', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Trade</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.trade} onChange={e => f('trade', e.target.value)}>{TRADES.map(t => <option key={t}>{t}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Submitted By</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.submitted_by} onChange={e => f('submitted_by', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Directed To</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.directed_to} onChange={e => f('directed_to', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Response Required By</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.response_required_by} onChange={e => f('response_required_by', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Description</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={3} value={form.description} onChange={e => f('description', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-1.5 rounded border text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-1.5 rounded bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 disabled:opacity-50">{saving ? 'Saving…' : 'Submit RFI'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Respond RFI Modal ────────────────────────────────────────────────────────
function RespondRfiModal({ rfi, onClose, onSaved }: { rfi: CpmRfi; onClose: () => void; onSaved: () => void }) {
  const [response, setResponse] = useState('');
  const [status, setStatus] = useState('answered');
  const [saving, setSaving] = useState(false);
  async function submit() {
    setSaving(true);
    try {
      await fetch(`/api/admin/construction-pm/projects/${rfi.project_id}/rfis/${rfi.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ response, status, response_date: new Date().toISOString().split('T')[0] }) });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
        <h2 className="text-lg font-bold mb-2 text-slate-800">Respond to {rfi.rfi_number}</h2>
        <p className="text-sm text-gray-600 mb-3">{rfi.subject}</p>
        <textarea className="w-full border rounded px-2 py-2 text-sm" rows={6} placeholder="Enter response..." value={response} onChange={e => setResponse(e.target.value)} />
        <div className="mt-2"><label className="text-xs text-gray-500">Status</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={status} onChange={e => setStatus(e.target.value)}><option value="answered">Answered</option><option value="closed">Closed</option></select></div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-1.5 rounded border text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving || !response} className="px-4 py-1.5 rounded bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 disabled:opacity-50">{saving ? 'Saving…' : 'Submit Response'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ConstructionPMPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [stats, setStats] = useState<DashStats | null>(null);
  const [clients, setClients] = useState<CpmClient[]>([]);
  const [projects, setProjects] = useState<CpmProject[]>([]);
  const [tasks, setTasks] = useState<CpmTask[]>([]);
  const [rfis, setRfis] = useState<CpmRfi[]>([]);
  const [schedule, setSchedule] = useState<CpmProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddClient, setShowAddClient] = useState(false);
  const [showAddProject, setShowAddProject] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddRfi, setShowAddRfi] = useState(false);
  const [respondRfi, setRespondRfi] = useState<CpmRfi | null>(null);
  const [selectedProject, setSelectedProject] = useState<(CpmProject & { tasks?: CpmTask[]; rfis?: CpmRfi[] }) | null>(null);
  // AI
  const [aiScope, setAiScope] = useState({ project_name: '', project_type: 'new_build', contract_value: '', client_type: 'commercial', result: '', loading: false });
  const [aiRfi, setAiRfi] = useState({ project_name: '', subject: '', trade: 'general', description: '', result: '', loading: false });
  // Filters
  const [projStatusFilter, setProjStatusFilter] = useState('');
  const [taskStatusFilter, setTaskStatusFilter] = useState('');

  const loadStats = useCallback(async () => { const r = await fetch('/api/admin/construction-pm'); setStats(await r.json()); }, []);
  const loadClients = useCallback(async () => { const r = await fetch('/api/admin/construction-pm/clients'); setClients(await r.json()); }, []);
  const loadProjects = useCallback(async () => {
    const qs = projStatusFilter ? `?status=${projStatusFilter}` : '';
    const r = await fetch(`/api/admin/construction-pm/projects${qs}`); setProjects(await r.json());
  }, [projStatusFilter]);
  const loadTasks = useCallback(async () => {
    // Load tasks for active projects
    const active = projects.filter(p => ['active','pre_construction','awarded'].includes(p.status));
    const allTasks: CpmTask[] = [];
    await Promise.all(active.map(async p => { const r = await fetch(`/api/admin/construction-pm/projects/${p.id}/tasks`); const t = await r.json() as CpmTask[]; allTasks.push(...t); }));
    setTasks(allTasks);
  }, [projects]);
  const loadRfis = useCallback(async () => {
    const active = projects.filter(p => ['active','pre_construction','awarded','substantial_completion'].includes(p.status));
    const allRfis: CpmRfi[] = [];
    await Promise.all(active.map(async p => { const r = await fetch(`/api/admin/construction-pm/projects/${p.id}/rfis`); const t = await r.json() as CpmRfi[]; allRfis.push(...t); }));
    setRfis(allRfis);
  }, [projects]);
  const loadSchedule = useCallback(async () => { const r = await fetch('/api/admin/construction-pm/projects/schedule'); setSchedule(await r.json()); }, []);
  const loadProjectDetail = useCallback(async (id: number) => {
    const r = await fetch(`/api/admin/construction-pm/projects/${id}`);
    setSelectedProject(await r.json());
  }, []);

  useEffect(() => { setLoading(true); loadStats().then(() => loadClients()).then(() => loadProjects()).finally(() => setLoading(false)); }, []);
  useEffect(() => { if (tab === 'tasks') loadTasks(); else if (tab === 'rfis') loadRfis(); else if (tab === 'schedule') loadSchedule(); }, [tab, projects]);
  useEffect(() => { loadProjects(); }, [projStatusFilter]);

  const refresh = () => { loadStats(); loadClients(); loadProjects(); };

  const filteredTasks = taskStatusFilter ? tasks.filter(t => t.status === taskStatusFilter) : tasks;
  const filteredProjects = projStatusFilter ? projects.filter(p => p.status === projStatusFilter) : projects;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-slate-800 text-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div><h1 className="text-xl font-bold">Construction Project Management Hub</h1><p className="text-slate-300 text-sm mt-0.5">Calgary, Alberta — Project portfolio, tasks, RFIs &amp; schedule</p></div>
          <div className="flex gap-2">
            <button onClick={() => setShowAddClient(true)} className="px-3 py-1.5 bg-orange-600 rounded text-sm font-medium hover:bg-orange-700">+ Client</button>
            <button onClick={() => { if (clients.length) setShowAddProject(true); }} className="px-3 py-1.5 bg-orange-600 rounded text-sm font-medium hover:bg-orange-700">+ Project</button>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="bg-white border-b px-6">
        <div className="flex gap-0 overflow-x-auto">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab === t ? 'border-orange-600 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{TAB_LABELS[t]}</button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {loading && <p className="text-gray-400 text-sm">Loading…</p>}

        {/* DASHBOARD */}
        {tab === 'dashboard' && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <KpiCard label="Active Projects" value={stats.active_projects} color="blue" />
              <KpiCard label="Active Portfolio Value" value={fmtCad(stats.total_contract_value_active)} color="green" />
              <KpiCard label="Behind Schedule" value={stats.projects_behind_schedule} sub="projects with revised dates" color="red" />
              <KpiCard label="Open RFIs" value={stats.open_rfis} sub="open + pending response" color="amber" />
              <KpiCard label="Safety Incidents YTD" value={stats.safety_incidents_ytd} color={stats.safety_incidents_ytd > 0 ? 'red' : 'green'} />
            </div>
            <div className="bg-white rounded-xl border p-5">
              <h2 className="font-semibold text-gray-800 mb-3">Active Project Health Matrix</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-gray-500 text-left"><th className="pb-2 pr-4">Project</th><th className="pb-2 pr-4">PM</th><th className="pb-2 pr-4">Status</th><th className="pb-2 pr-4">Contract Value</th><th className="pb-2 pr-4">Progress</th><th className="pb-2">Completion</th></tr></thead>
                  <tbody>
                    {projects.filter(p => ['active','pre_construction','awarded'].includes(p.status)).map(p => (
                      <tr key={p.id} className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => { setSelectedProject(null); setTab('projects'); loadProjectDetail(p.id); }}>
                        <td className="py-2 pr-4 font-medium text-blue-700">{p.project_number}<br /><span className="text-gray-600 font-normal text-xs">{p.project_name}</span></td>
                        <td className="py-2 pr-4 text-gray-600">{p.project_manager || '—'}</td>
                        <td className="py-2 pr-4"><Badge label={p.status} color={statusColor(p.status)} /></td>
                        <td className="py-2 pr-4">{fmtCad(p.contract_value)}</td>
                        <td className="py-2 pr-4 min-w-[120px]"><div className="flex items-center gap-2"><div className="flex-1 bg-gray-200 rounded-full h-2"><div className="bg-orange-500 h-2 rounded-full" style={{ width: `${p.percent_complete}%` }} /></div><span className="text-xs text-gray-500">{p.percent_complete}%</span></div></td>
                        <td className="py-2 text-xs text-gray-600">{fmtDate(p.revised_completion_date || p.original_completion_date)}{p.revised_completion_date && p.revised_completion_date > p.original_completion_date && <span className="ml-1 text-red-600 font-medium">(behind)</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* PROJECTS */}
        {tab === 'projects' && !selectedProject && (
          <div className="space-y-4">
            <div className="flex gap-3 items-center">
              <select className="border rounded px-3 py-1.5 text-sm" value={projStatusFilter} onChange={e => setProjStatusFilter(e.target.value)}>
                <option value="">All Statuses</option>{PROJECT_STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
              <span className="text-sm text-gray-500">{filteredProjects.length} projects</span>
              <button onClick={() => setShowAddProject(true)} className="ml-auto px-3 py-1.5 bg-orange-600 text-white rounded text-sm font-medium hover:bg-orange-700">+ Add Project</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredProjects.map(p => (
                <div key={p.id} className="bg-white rounded-xl border p-4 hover:shadow-md cursor-pointer transition-shadow" onClick={() => loadProjectDetail(p.id)}>
                  <div className="flex items-start justify-between mb-2">
                    <div><p className="font-semibold text-gray-800">{p.project_name}</p><p className="text-xs text-gray-500 font-mono">{p.project_number} · {p.client_name}</p></div>
                    <Badge label={p.status} color={statusColor(p.status)} />
                  </div>
                  <div className="flex items-center gap-3 mb-3">
                    <Badge label={p.project_type} color="gray" />
                    <span className="text-xs text-gray-500">{p.city}, {p.province}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2"><div className="bg-orange-500 h-2 rounded-full" style={{ width: `${p.percent_complete}%` }} /></div>
                    <span className="text-xs text-gray-500 w-8">{p.percent_complete}%</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{fmtCad(p.contract_value)} contract{p.change_orders_total > 0 && <span className="text-amber-600"> + {fmtCad(p.change_orders_total)} CO</span>}</span>
                    <span>Due: {fmtDate(p.revised_completion_date || p.original_completion_date)}{p.revised_completion_date && p.revised_completion_date > p.original_completion_date && <span className="text-red-600 ml-1">▲ Behind</span>}</span>
                  </div>
                  {p.project_manager && <p className="text-xs text-gray-400 mt-1">PM: {p.project_manager}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PROJECT DETAIL */}
        {tab === 'projects' && selectedProject && (
          <div className="space-y-4">
            <button onClick={() => setSelectedProject(null)} className="text-sm text-orange-600 hover:underline">← Back to Projects</button>
            <div className="bg-white rounded-xl border p-5">
              <div className="flex items-start justify-between">
                <div><h2 className="text-lg font-bold text-gray-800">{selectedProject.project_name}</h2><p className="text-sm text-gray-500 font-mono">{selectedProject.project_number} · {selectedProject.client_name}</p></div>
                <Badge label={selectedProject.status} color={statusColor(selectedProject.status)} />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <div><p className="text-xs text-gray-500">Contract Value</p><p className="font-semibold">{fmtCad(selectedProject.contract_value)}</p></div>
                <div><p className="text-xs text-gray-500">Change Orders</p><p className="font-semibold text-amber-600">{fmtCad(selectedProject.change_orders_total)}</p></div>
                <div><p className="text-xs text-gray-500">Safety Hours</p><p className="font-semibold">{selectedProject.safety_hours_worked?.toLocaleString()}</p></div>
                <div><p className="text-xs text-gray-500">Safety Incidents</p><p className={`font-semibold ${selectedProject.safety_incidents > 0 ? 'text-red-600' : 'text-green-600'}`}>{selectedProject.safety_incidents}</p></div>
              </div>
              <div className="mt-3">
                <p className="text-xs text-gray-500 mb-1">Progress: {selectedProject.percent_complete}%</p>
                <div className="bg-gray-200 rounded-full h-3"><div className="bg-orange-500 h-3 rounded-full" style={{ width: `${selectedProject.percent_complete}%` }} /></div>
              </div>
            </div>
            {/* Tasks */}
            <div className="bg-white rounded-xl border p-5">
              <h3 className="font-semibold text-gray-800 mb-3">Tasks</h3>
              {(selectedProject.tasks ?? []).map(t => (
                <div key={t.id} className={`flex items-center gap-3 py-2 border-b last:border-0 ${t.status === 'blocked' ? 'bg-red-50 rounded px-2' : ''}`}>
                  <Badge label={t.priority} color={priorityColor(t.priority)} />
                  <Badge label={t.trade} color={tradeColor(t.trade)} />
                  <span className="flex-1 text-sm text-gray-800">{t.task_name}</span>
                  <span className="text-xs text-gray-500">{t.assigned_to}</span>
                  <div className="w-20 bg-gray-200 rounded-full h-1.5"><div className="bg-orange-500 h-1.5 rounded-full" style={{ width: `${t.completion_pct}%` }} /></div>
                  <Badge label={t.status} color={t.status === 'blocked' ? 'red' : statusColor(t.status)} />
                </div>
              ))}
              {!(selectedProject.tasks ?? []).length && <p className="text-sm text-gray-400">No tasks yet.</p>}
            </div>
            {/* RFIs */}
            <div className="bg-white rounded-xl border p-5">
              <h3 className="font-semibold text-gray-800 mb-3">RFIs</h3>
              {(selectedProject.rfis ?? []).map(r => (
                <div key={r.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                  <span className="text-xs font-mono text-gray-500">{r.rfi_number}</span>
                  <span className="flex-1 text-sm text-gray-800">{r.subject}</span>
                  <Badge label={r.trade ?? ''} color={tradeColor(r.trade ?? '')} />
                  <Badge label={r.status} color={r.status === 'open' ? 'red' : r.status === 'answered' ? 'green' : 'amber'} />
                  {r.response_required_by && <span className={`text-xs ${(daysUntil(r.response_required_by) ?? 999) < 3 ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>Due: {fmtDate(r.response_required_by)}</span>}
                </div>
              ))}
              {!(selectedProject.rfis ?? []).length && <p className="text-sm text-gray-400">No RFIs yet.</p>}
            </div>
          </div>
        )}

        {/* TASKS */}
        {tab === 'tasks' && (
          <div className="space-y-4">
            <div className="flex gap-3 items-center">
              <select className="border rounded px-3 py-1.5 text-sm" value={taskStatusFilter} onChange={e => setTaskStatusFilter(e.target.value)}>
                <option value="">All Statuses</option>{TASK_STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
              <span className="text-sm text-gray-500">{filteredTasks.length} tasks</span>
              <button onClick={() => setShowAddTask(true)} className="ml-auto px-3 py-1.5 bg-orange-600 text-white rounded text-sm font-medium hover:bg-orange-700">+ Add Task</button>
            </div>
            <div className="bg-white rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b"><tr><th className="text-left px-4 py-2 text-gray-500 font-medium">Task</th><th className="text-left px-4 py-2 text-gray-500 font-medium">Trade</th><th className="text-left px-4 py-2 text-gray-500 font-medium">Assigned</th><th className="text-left px-4 py-2 text-gray-500 font-medium">Dates</th><th className="text-left px-4 py-2 text-gray-500 font-medium">Progress</th><th className="text-left px-4 py-2 text-gray-500 font-medium">Priority</th><th className="text-left px-4 py-2 text-gray-500 font-medium">Status</th></tr></thead>
                <tbody>
                  {filteredTasks.map(t => (
                    <tr key={t.id} className={`border-b hover:bg-gray-50 ${t.status === 'blocked' ? 'bg-red-50' : ''}`}>
                      <td className="px-4 py-2 font-medium text-gray-800">{t.task_name}</td>
                      <td className="px-4 py-2"><Badge label={t.trade} color={tradeColor(t.trade)} /></td>
                      <td className="px-4 py-2 text-gray-500 text-xs">{t.assigned_to || '—'}</td>
                      <td className="px-4 py-2 text-xs text-gray-500">{fmtDate(t.start_date)} → {fmtDate(t.end_date)}</td>
                      <td className="px-4 py-2"><div className="flex items-center gap-2"><div className="w-16 bg-gray-200 rounded-full h-1.5"><div className="bg-orange-500 h-1.5 rounded-full" style={{ width: `${t.completion_pct}%` }} /></div><span className="text-xs text-gray-400">{t.completion_pct}%</span></div></td>
                      <td className="px-4 py-2"><Badge label={t.priority} color={priorityColor(t.priority)} /></td>
                      <td className="px-4 py-2"><Badge label={t.status} color={t.status === 'blocked' ? 'red' : statusColor(t.status)} /></td>
                    </tr>
                  ))}
                  {!filteredTasks.length && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No tasks found.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* RFIs */}
        {tab === 'rfis' && (
          <div className="space-y-4">
            <div className="flex gap-3 items-center">
              <span className="text-sm text-gray-500">{rfis.length} RFIs across active projects</span>
              <button onClick={() => setShowAddRfi(true)} className="ml-auto px-3 py-1.5 bg-orange-600 text-white rounded text-sm font-medium hover:bg-orange-700">+ New RFI</button>
            </div>
            <div className="space-y-3">
              {rfis.map(r => {
                const days = daysUntil(r.response_required_by);
                const overdue = days !== null && days < 0;
                const urgent = days !== null && days >= 0 && days < 3;
                return (
                  <div key={r.id} className={`bg-white rounded-xl border p-4 ${overdue ? 'border-red-300 bg-red-50' : urgent ? 'border-amber-300 bg-amber-50' : ''}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div><span className="font-mono text-xs text-gray-500">{r.rfi_number}</span><p className="font-medium text-gray-800">{r.subject}</p></div>
                      <div className="flex gap-2">
                        <Badge label={r.status} color={r.status === 'open' ? 'red' : r.status === 'answered' ? 'green' : r.status === 'closed' ? 'gray' : 'amber'} />
                        {r.status === 'open' || r.status === 'pending_response' ? <button onClick={() => setRespondRfi(r)} className="px-2 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-700">Respond</button> : null}
                      </div>
                    </div>
                    <div className="flex gap-4 text-xs text-gray-500">
                      <span>Trade: <Badge label={r.trade ?? '—'} color={tradeColor(r.trade ?? '')} /></span>
                      <span>From: {r.submitted_by || '—'}</span>
                      <span>To: {r.directed_to || '—'}</span>
                      {r.response_required_by && <span className={overdue ? 'text-red-600 font-semibold' : urgent ? 'text-amber-600 font-semibold' : ''}>Due: {fmtDate(r.response_required_by)}{overdue && ` (${Math.abs(days!)}d overdue)`}{urgent && ` (${days}d left)`}</span>}
                    </div>
                    {r.description && <p className="text-xs text-gray-600 mt-2 line-clamp-2">{r.description}</p>}
                    {r.response && <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-800"><strong>Response:</strong> {r.response}</div>}
                  </div>
                );
              })}
              {!rfis.length && <p className="text-sm text-gray-400">No RFIs found.</p>}
            </div>
          </div>
        )}

        {/* SCHEDULE */}
        {tab === 'schedule' && (
          <div className="space-y-4">
            <h2 className="font-semibold text-gray-800">Project Schedule Timeline</h2>
            <div className="space-y-3">
              {schedule.map(p => {
                const start = p.original_start_date ? new Date(p.original_start_date) : null;
                const end = p.revised_completion_date ? new Date(p.revised_completion_date) : p.original_completion_date ? new Date(p.original_completion_date) : null;
                const behind = p.revised_completion_date && p.original_completion_date && p.revised_completion_date > p.original_completion_date;
                return (
                  <div key={p.id} className={`bg-white rounded-xl border p-4 ${behind ? 'border-red-300' : ''}`}>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-mono text-xs text-gray-500">{p.project_number}</span>
                      <span className="font-medium text-gray-800">{p.project_name}</span>
                      <Badge label={p.status} color={statusColor(p.status)} />
                      {behind && <span className="text-xs text-red-600 font-semibold">BEHIND SCHEDULE</span>}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
                      <span>Start: {start ? fmtDate(start.toISOString()) : '—'}</span>
                      <span>End: {end ? fmtDate(end.toISOString()) : '—'}</span>
                      <span>PM: {p.project_manager || '—'}</span>
                      <span>{fmtCad(p.contract_value)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-3">
                        <div className={`h-3 rounded-full ${behind ? 'bg-red-500' : 'bg-orange-500'}`} style={{ width: `${p.percent_complete}%` }} />
                      </div>
                      <span className="text-xs text-gray-500 w-8">{p.percent_complete}%</span>
                    </div>
                  </div>
                );
              })}
              {!schedule.length && <p className="text-sm text-gray-400">No active projects with schedule data.</p>}
            </div>
          </div>
        )}

        {/* AI TOOLS */}
        {tab === 'ai' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Scope of Work */}
            <div className="bg-white rounded-xl border p-5 space-y-3">
              <h2 className="font-semibold text-gray-800">Scope of Work Generator</h2>
              <div><label className="text-xs text-gray-500">Project Name</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiScope.project_name} onChange={e => setAiScope(s => ({ ...s, project_name: e.target.value }))} /></div>
              <div><label className="text-xs text-gray-500">Project Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiScope.project_type} onChange={e => setAiScope(s => ({ ...s, project_type: e.target.value }))}>{PROJECT_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
              <div><label className="text-xs text-gray-500">Contract Value (CAD)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiScope.contract_value} onChange={e => setAiScope(s => ({ ...s, contract_value: e.target.value }))} /></div>
              <div><label className="text-xs text-gray-500">Client Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiScope.client_type} onChange={e => setAiScope(s => ({ ...s, client_type: e.target.value }))}>{CLIENT_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
              <button disabled={aiScope.loading || !aiScope.project_name} onClick={async () => { setAiScope(s => ({ ...s, loading: true, result: '' })); const r = await fetch('/api/admin/construction-pm/ai-scope', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project_name: aiScope.project_name, project_type: aiScope.project_type, contract_value: aiScope.contract_value, client_type: aiScope.client_type }) }); const d = await r.json() as { result: string }; setAiScope(s => ({ ...s, result: d.result, loading: false })); }} className="w-full py-2 bg-orange-600 text-white rounded text-sm font-medium hover:bg-orange-700 disabled:opacity-50">{aiScope.loading ? 'Generating…' : 'Generate Scope of Work'}</button>
              {aiScope.result && <div className="bg-gray-50 border rounded p-3 text-xs text-gray-700 whitespace-pre-wrap max-h-64 overflow-y-auto">{aiScope.result}</div>}
            </div>
            {/* RFI Response */}
            <div className="bg-white rounded-xl border p-5 space-y-3">
              <h2 className="font-semibold text-gray-800">RFI Response Drafter</h2>
              <div><label className="text-xs text-gray-500">Project Name</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiRfi.project_name} onChange={e => setAiRfi(s => ({ ...s, project_name: e.target.value }))} /></div>
              <div><label className="text-xs text-gray-500">RFI Subject</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiRfi.subject} onChange={e => setAiRfi(s => ({ ...s, subject: e.target.value }))} /></div>
              <div><label className="text-xs text-gray-500">Trade</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiRfi.trade} onChange={e => setAiRfi(s => ({ ...s, trade: e.target.value }))}>{TRADES.map(t => <option key={t}>{t}</option>)}</select></div>
              <div><label className="text-xs text-gray-500">Question / Description</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={3} value={aiRfi.description} onChange={e => setAiRfi(s => ({ ...s, description: e.target.value }))} /></div>
              <button disabled={aiRfi.loading || !aiRfi.subject} onClick={async () => { setAiRfi(s => ({ ...s, loading: true, result: '' })); const r = await fetch('/api/admin/construction-pm/ai-rfi-response', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project_name: aiRfi.project_name, subject: aiRfi.subject, trade: aiRfi.trade, description: aiRfi.description }) }); const d = await r.json() as { result: string }; setAiRfi(s => ({ ...s, result: d.result, loading: false })); }} className="w-full py-2 bg-orange-600 text-white rounded text-sm font-medium hover:bg-orange-700 disabled:opacity-50">{aiRfi.loading ? 'Drafting…' : 'Draft RFI Response'}</button>
              {aiRfi.result && <div className="bg-gray-50 border rounded p-3 text-xs text-gray-700 whitespace-pre-wrap max-h-64 overflow-y-auto">{aiRfi.result}</div>}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddClient && <AddClientModal onClose={() => setShowAddClient(false)} onSaved={() => { setShowAddClient(false); refresh(); }} />}
      {showAddProject && clients.length > 0 && <AddProjectModal clients={clients} onClose={() => setShowAddProject(false)} onSaved={() => { setShowAddProject(false); refresh(); }} />}
      {showAddTask && projects.length > 0 && <AddTaskModal projects={projects} onClose={() => setShowAddTask(false)} onSaved={() => { setShowAddTask(false); loadTasks(); }} />}
      {showAddRfi && projects.length > 0 && <AddRfiModal projects={projects} onClose={() => setShowAddRfi(false)} onSaved={() => { setShowAddRfi(false); loadRfis(); }} />}
      {respondRfi && <RespondRfiModal rfi={respondRfi} onClose={() => setRespondRfi(null)} onSaved={() => { setRespondRfi(null); loadRfis(); }} />}
    </div>
  );
}
