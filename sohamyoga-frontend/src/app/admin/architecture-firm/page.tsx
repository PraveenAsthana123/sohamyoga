'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard','projects','deliverables','time','ai','financials'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = { dashboard: 'Dashboard', projects: 'Projects', deliverables: 'Deliverables', time: 'Time Tracking', ai: 'AI Design Tools', financials: 'Financials' };

const PROJECT_PHASES = ['pre_design','schematic_design','design_development','construction_documents','permit','bidding','construction_administration','closeout','on_hold'];
const PROJECT_TYPES = ['residential','multi_family','commercial','institutional','industrial','landscape','interior','mixed_use','renovation','master_planning'];
const DELIVERABLE_TYPES = ['drawing','report','specification','presentation','permit_submission','RFI_response','site_visit_report','addendum','other'];
const CLIENT_TYPES = ['private','developer','municipal','institutional','industrial','commercial'];
const REVISIONS = ['A','B','C','D','E','F'];

interface DashStats { active_projects: number; wip_value: number; permit_applications_pending: number; deliverables_overdue: number; revenue_mtd: number; }
interface ArchClient { id: number; company_name: string; contact_name: string; contact_email: string; contact_phone: string; city: string; client_type: string; status: string; total_fees: number; }
interface ArchProject { id: number; client_id: number; client_name: string; company_name: string; project_name: string; project_number: string; project_type: string; project_phase: string; principal: string; project_architect: string; city: string; gross_area_sqft: number; total_fee: number; billed_to_date: number; outstanding_balance: number; construction_budget: number; permit_submitted: string; permit_issued: string; permit_number: string; status: string; }
interface ArchDeliverable { id: number; project_id: number; deliverable_name: string; deliverable_type: string; phase: string; due_date: string; submitted_date: string; revision: string; status: string; assigned_to: string; }
interface TimeEntry { id: number; project_id: number; staff_name: string; entry_date: string; phase: string; task_description: string; hours: number; hourly_rate: number; billable: boolean; billed: boolean; }

function fmtCad(n: number) { return `$${Number(n ?? 0).toLocaleString('en-CA', { minimumFractionDigits: 0 })}`; }
function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString('en-CA') : '—'; }
function isOverdue(d: string) { return d && new Date(d) < new Date(); }

function Badge({ label, color = 'gray' }: { label: string; color?: string }) {
  const map: Record<string, string> = { blue: 'bg-blue-100 text-blue-700', green: 'bg-green-100 text-green-700', amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700', purple: 'bg-purple-100 text-purple-700', gray: 'bg-gray-100 text-gray-700', teal: 'bg-teal-100 text-teal-700', indigo: 'bg-indigo-100 text-indigo-700' };
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${map[color] ?? map.gray}`}>{label.replace(/_/g, ' ')}</span>;
}
function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const borders: Record<string, string> = { blue: 'border-l-4 border-blue-500 bg-blue-50', green: 'border-l-4 border-green-500 bg-green-50', amber: 'border-l-4 border-amber-500 bg-amber-50', red: 'border-l-4 border-red-500 bg-red-50', purple: 'border-l-4 border-purple-500 bg-purple-50' };
  return <div className={`rounded-lg p-4 ${borders[color] ?? borders.blue}`}><p className="text-sm text-gray-500">{label}</p><p className="text-2xl font-bold mt-1">{value}</p>{sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}</div>;
}
function phaseColor(p: string) { const m: Record<string,string> = { pre_design: 'gray', schematic_design: 'blue', design_development: 'indigo', construction_documents: 'purple', permit: 'amber', bidding: 'orange', construction_administration: 'green', closeout: 'teal', on_hold: 'red' }; return m[p] ?? 'gray'; }
function delivStatusColor(s: string) { const m: Record<string,string> = { in_progress: 'blue', submitted: 'amber', approved: 'green', revision_required: 'red', issued_for_construction: 'teal' }; return m[s] ?? 'gray'; }

// ─── Add Client Modal ─────────────────────────────────────────────────────────
function AddClientModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ company_name: '', contact_name: '', contact_email: '', contact_phone: '', city: 'Calgary', province: 'AB', client_type: 'private', status: 'active', notes: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.contact_name || !form.contact_email) return;
    setSaving(true);
    try { await fetch('/api/admin/architecture-firm/clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }); onSaved(); }
    finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-4 text-slate-800">New Architecture Client</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs text-gray-500">Company / Firm Name</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.company_name} onChange={e => f('company_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Contact Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.contact_name} onChange={e => f('contact_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Client Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.client_type} onChange={e => f('client_type', e.target.value)}>{CLIENT_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Email *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.contact_email} onChange={e => f('contact_email', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Phone</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.contact_phone} onChange={e => f('contact_phone', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">City</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.city} onChange={e => f('city', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Status</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.status} onChange={e => f('status', e.target.value)}>{['active','prospect','inactive'].map(s => <option key={s}>{s}</option>)}</select></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.notes} onChange={e => f('notes', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-1.5 rounded border text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-1.5 rounded bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">{saving ? 'Saving…' : 'Create Client'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Project Modal ────────────────────────────────────────────────────────
function AddProjectModal({ clients, onClose, onSaved }: { clients: ArchClient[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ client_id: clients[0]?.id?.toString() ?? '', project_name: '', project_type: 'residential', project_phase: 'schematic_design', principal: '', project_architect: '', city: 'Calgary', province: 'AB', gross_area_sqft: '', floors: '', contract_type: 'percentage', total_fee: '', fee_percentage: '', construction_budget: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.project_name) return;
    setSaving(true);
    try { await fetch('/api/admin/architecture-firm/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, gross_area_sqft: parseInt(form.gross_area_sqft) || null, floors: parseInt(form.floors) || null, total_fee: parseFloat(form.total_fee) || null, fee_percentage: parseFloat(form.fee_percentage) || null, construction_budget: parseFloat(form.construction_budget) || null }) }); onSaved(); }
    finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-4 text-slate-800">New Architecture Project</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs text-gray-500">Client *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.client_id} onChange={e => f('client_id', e.target.value)}>{clients.map(c => <option key={c.id} value={c.id}>{c.contact_name}{c.company_name ? ` — ${c.company_name}` : ''}</option>)}</select></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Project Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.project_name} onChange={e => f('project_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Project Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.project_type} onChange={e => f('project_type', e.target.value)}>{PROJECT_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Phase</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.project_phase} onChange={e => f('project_phase', e.target.value)}>{PROJECT_PHASES.map(p => <option key={p}>{p}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Principal</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.principal} onChange={e => f('principal', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Project Architect</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.project_architect} onChange={e => f('project_architect', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Gross Area (sq ft)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.gross_area_sqft} onChange={e => f('gross_area_sqft', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Floors</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.floors} onChange={e => f('floors', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Contract Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.contract_type} onChange={e => f('contract_type', e.target.value)}>{['percentage','fixed_fee','hourly','hybrid'].map(t => <option key={t}>{t}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Total Fee (CAD)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.total_fee} onChange={e => f('total_fee', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Fee % (if %-based)</label><input type="number" step="0.1" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.fee_percentage} onChange={e => f('fee_percentage', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Construction Budget (CAD)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.construction_budget} onChange={e => f('construction_budget', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-1.5 rounded border text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-1.5 rounded bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">{saving ? 'Saving…' : 'Create Project'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Log Time Modal ───────────────────────────────────────────────────────────
function LogTimeModal({ projects, onClose, onSaved }: { projects: ArchProject[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ project_id: projects[0]?.id?.toString() ?? '', staff_name: '', entry_date: new Date().toISOString().split('T')[0], phase: 'schematic_design', task_description: '', hours: '', hourly_rate: '145', billable: true });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.task_description || !form.hours) return;
    setSaving(true);
    try { await fetch(`/api/admin/architecture-firm/projects/${form.project_id}/time`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, hours: parseFloat(form.hours), hourly_rate: parseFloat(form.hourly_rate) }) }); onSaved(); }
    finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
        <h2 className="text-lg font-bold mb-4 text-slate-800">Log Time Entry</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs text-gray-500">Project *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.project_id} onChange={e => f('project_id', e.target.value)}>{projects.map(p => <option key={p.id} value={p.id}>{p.project_number} — {p.project_name}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Staff Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.staff_name} onChange={e => f('staff_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Date</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.entry_date} onChange={e => f('entry_date', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Phase</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.phase} onChange={e => f('phase', e.target.value)}>{PROJECT_PHASES.map(p => <option key={p}>{p}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Hours *</label><input type="number" step="0.5" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.hours} onChange={e => f('hours', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Hourly Rate (CAD)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.hourly_rate} onChange={e => f('hourly_rate', e.target.value)} /></div>
          <div className="flex items-center gap-2 pt-4"><input type="checkbox" id="billable" checked={form.billable} onChange={e => f('billable', e.target.checked)} /><label htmlFor="billable" className="text-sm text-gray-600">Billable</label></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Task Description *</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.task_description} onChange={e => f('task_description', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-1.5 rounded border text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-1.5 rounded bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">{saving ? 'Saving…' : 'Log Time'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ArchitectureFirmPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [stats, setStats] = useState<DashStats | null>(null);
  const [clients, setClients] = useState<ArchClient[]>([]);
  const [projects, setProjects] = useState<ArchProject[]>([]);
  const [deliverables, setDeliverables] = useState<ArchDeliverable[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddClient, setShowAddClient] = useState(false);
  const [showAddProject, setShowAddProject] = useState(false);
  const [showLogTime, setShowLogTime] = useState(false);
  const [selectedProject, setSelectedProject] = useState<(ArchProject & { deliverables?: ArchDeliverable[]; time_summary?: unknown[] }) | null>(null);
  const [phaseFilter, setPhaseFilter] = useState('');
  // AI
  const [aiBrief, setAiBrief] = useState({ project_type: 'residential', client_type: 'private', project_name: '', gross_area_sqft: '', construction_budget: '', result: '', loading: false });
  const [aiSpec, setAiSpec] = useState({ spec_section: '', project_type: 'residential', phase: 'construction_documents', result: '', loading: false });

  const loadStats = useCallback(async () => { const r = await fetch('/api/admin/architecture-firm'); setStats(await r.json()); }, []);
  const loadClients = useCallback(async () => { const r = await fetch('/api/admin/architecture-firm/clients'); setClients(await r.json()); }, []);
  const loadProjects = useCallback(async () => {
    const qs = phaseFilter ? `?phase=${phaseFilter}` : '';
    const r = await fetch(`/api/admin/architecture-firm/projects${qs}`); setProjects(await r.json());
  }, [phaseFilter]);
  const loadAllDeliverables = useCallback(async (projs: ArchProject[]) => {
    const all: ArchDeliverable[] = [];
    await Promise.all(projs.slice(0, 10).map(async p => { const r = await fetch(`/api/admin/architecture-firm/projects/${p.id}/deliverables`); const d = await r.json() as ArchDeliverable[]; all.push(...d); }));
    setDeliverables(all);
  }, []);
  const loadAllTime = useCallback(async (projs: ArchProject[]) => {
    const all: TimeEntry[] = [];
    await Promise.all(projs.slice(0, 10).map(async p => { const r = await fetch(`/api/admin/architecture-firm/projects/${p.id}/time`); const d = await r.json() as TimeEntry[]; all.push(...d); }));
    setTimeEntries(all);
  }, []);
  const loadProjectDetail = useCallback(async (id: number) => {
    const r = await fetch(`/api/admin/architecture-firm/projects/${id}`);
    setSelectedProject(await r.json());
  }, []);

  useEffect(() => {
    setLoading(true);
    loadStats().then(() => loadClients()).then(() => loadProjects()).finally(() => setLoading(false));
  }, []);
  useEffect(() => { loadProjects(); }, [phaseFilter]);
  useEffect(() => {
    if (tab === 'deliverables' && projects.length) loadAllDeliverables(projects);
    else if (tab === 'time' && projects.length) loadAllTime(projects);
  }, [tab, projects]);

  const refresh = () => { loadStats(); loadClients(); loadProjects(); };

  const filteredProjects = phaseFilter ? projects.filter(p => p.project_phase === phaseFilter) : projects;
  const overdueDeliverables = deliverables.filter(d => d.status === 'in_progress' && isOverdue(d.due_date));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-slate-800 text-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div><h1 className="text-xl font-bold">Architecture &amp; Design Firm Hub</h1><p className="text-slate-300 text-sm mt-0.5">Calgary, Alberta — Projects, deliverables, time tracking &amp; billing</p></div>
          <div className="flex gap-2">
            <button onClick={() => setShowAddClient(true)} className="px-3 py-1.5 bg-indigo-600 rounded text-sm font-medium hover:bg-indigo-700">+ Client</button>
            <button onClick={() => { if (clients.length) setShowAddProject(true); }} className="px-3 py-1.5 bg-indigo-600 rounded text-sm font-medium hover:bg-indigo-700">+ Project</button>
          </div>
        </div>
      </div>

      <div className="bg-white border-b px-6">
        <div className="flex gap-0 overflow-x-auto">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{TAB_LABELS[t]}</button>
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
              <KpiCard label="WIP Outstanding" value={fmtCad(stats.wip_value)} color="purple" />
              <KpiCard label="Permits Pending" value={stats.permit_applications_pending} sub="awaiting city approval" color="amber" />
              <KpiCard label="Deliverables Overdue" value={stats.deliverables_overdue} color={stats.deliverables_overdue > 0 ? 'red' : 'green'} />
              <KpiCard label="Revenue MTD" value={fmtCad(stats.revenue_mtd)} sub="billable hours this month" color="green" />
            </div>
            {overdueDeliverables.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <h3 className="font-semibold text-red-800 mb-2">Overdue Deliverables Alert</h3>
                {overdueDeliverables.map(d => <div key={d.id} className="text-sm text-red-700">• {d.deliverable_name} — Due: {fmtDate(d.due_date)} — Assigned: {d.assigned_to || '—'}</div>)}
              </div>
            )}
            <div className="bg-white rounded-xl border p-5">
              <h2 className="font-semibold text-gray-800 mb-3">Project Phase Pipeline</h2>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                {PROJECT_PHASES.slice(0, 8).map(phase => {
                  const count = projects.filter(p => p.project_phase === phase).length;
                  return <div key={phase} className={`rounded-lg p-3 text-center ${count > 0 ? 'bg-indigo-50 border border-indigo-200' : 'bg-gray-50 border'}`}><p className="text-xs text-gray-500 truncate">{phase.replace(/_/g, ' ')}</p><p className="text-xl font-bold text-indigo-700 mt-1">{count}</p></div>;
                })}
              </div>
            </div>
            <div className="bg-white rounded-xl border p-5">
              <h2 className="font-semibold text-gray-800 mb-3">WIP Billing Summary</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-gray-500 text-left"><th className="pb-2 pr-4">Project</th><th className="pb-2 pr-4">Phase</th><th className="pb-2 pr-4">Total Fee</th><th className="pb-2 pr-4">Billed</th><th className="pb-2">Outstanding</th></tr></thead>
                  <tbody>
                    {projects.filter(p => p.status === 'active').map(p => (
                      <tr key={p.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 pr-4 font-medium text-indigo-700">{p.project_name}<br /><span className="text-gray-400 text-xs font-mono">{p.project_number}</span></td>
                        <td className="py-2 pr-4"><Badge label={p.project_phase} color={phaseColor(p.project_phase)} /></td>
                        <td className="py-2 pr-4">{fmtCad(p.total_fee)}</td>
                        <td className="py-2 pr-4 text-green-700">{fmtCad(p.billed_to_date)}</td>
                        <td className="py-2 text-amber-700 font-semibold">{fmtCad(p.outstanding_balance)}</td>
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
              <select className="border rounded px-3 py-1.5 text-sm" value={phaseFilter} onChange={e => setPhaseFilter(e.target.value)}>
                <option value="">All Phases</option>{PROJECT_PHASES.map(p => <option key={p}>{p}</option>)}
              </select>
              <span className="text-sm text-gray-500">{filteredProjects.length} projects</span>
              <button onClick={() => setShowAddProject(true)} className="ml-auto px-3 py-1.5 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700">+ Add Project</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredProjects.map(p => (
                <div key={p.id} className="bg-white rounded-xl border p-4 hover:shadow-md cursor-pointer transition-shadow" onClick={() => loadProjectDetail(p.id)}>
                  <div className="flex items-start justify-between mb-2">
                    <div><p className="font-semibold text-gray-800">{p.project_name}</p><p className="text-xs text-gray-500 font-mono">{p.project_number} · {p.client_name}</p></div>
                    <Badge label={p.project_phase} color={phaseColor(p.project_phase)} />
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <Badge label={p.project_type} color="gray" />
                    {p.gross_area_sqft && <span className="text-xs text-gray-500">{p.gross_area_sqft.toLocaleString()} sq ft</span>}
                    {p.permit_submitted && !p.permit_issued && <Badge label="Permit Pending" color="amber" />}
                    {p.permit_issued && <Badge label="Permit Issued" color="green" />}
                  </div>
                  <div className="mb-2">
                    <div className="flex justify-between text-xs text-gray-500 mb-1"><span>Billed: {fmtCad(p.billed_to_date)}</span><span>Total: {fmtCad(p.total_fee)}</span></div>
                    <div className="bg-gray-200 rounded-full h-2"><div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${p.total_fee > 0 ? Math.min((p.billed_to_date / p.total_fee) * 100, 100) : 0}%` }} /></div>
                  </div>
                  {p.outstanding_balance > 0 && <p className="text-xs text-amber-600 font-medium">Outstanding: {fmtCad(p.outstanding_balance)}</p>}
                  {p.principal && <p className="text-xs text-gray-400 mt-1">Principal: {p.principal}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PROJECT DETAIL */}
        {tab === 'projects' && selectedProject && (
          <div className="space-y-4">
            <button onClick={() => setSelectedProject(null)} className="text-sm text-indigo-600 hover:underline">← Back to Projects</button>
            <div className="bg-white rounded-xl border p-5">
              <div className="flex items-start justify-between">
                <div><h2 className="text-lg font-bold text-gray-800">{selectedProject.project_name}</h2><p className="text-sm text-gray-500 font-mono">{selectedProject.project_number} · {selectedProject.client_name}</p></div>
                <Badge label={selectedProject.project_phase} color={phaseColor(selectedProject.project_phase)} />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <div><p className="text-xs text-gray-500">Total Fee</p><p className="font-semibold">{fmtCad(selectedProject.total_fee)}</p></div>
                <div><p className="text-xs text-gray-500">Billed to Date</p><p className="font-semibold text-green-700">{fmtCad(selectedProject.billed_to_date)}</p></div>
                <div><p className="text-xs text-gray-500">Outstanding</p><p className="font-semibold text-amber-600">{fmtCad(selectedProject.outstanding_balance)}</p></div>
                <div><p className="text-xs text-gray-500">Construction Budget</p><p className="font-semibold">{fmtCad(selectedProject.construction_budget)}</p></div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-4 text-xs text-gray-500">
                {selectedProject.permit_submitted && <div>Permit Submitted: {fmtDate(selectedProject.permit_submitted)}</div>}
                {selectedProject.permit_issued && <div>Permit Issued: {fmtDate(selectedProject.permit_issued)} — #{selectedProject.permit_number}</div>}
              </div>
            </div>
            <div className="bg-white rounded-xl border p-5">
              <h3 className="font-semibold text-gray-800 mb-3">Deliverables</h3>
              {(selectedProject.deliverables ?? []).map(d => (
                <div key={d.id} className={`flex items-center gap-3 py-2 border-b last:border-0 ${isOverdue(d.due_date) && d.status === 'in_progress' ? 'bg-red-50 rounded px-2' : ''}`}>
                  <span className="text-xs bg-gray-100 px-1.5 rounded font-mono">{d.revision}</span>
                  <span className="flex-1 text-sm text-gray-800">{d.deliverable_name}</span>
                  <Badge label={d.deliverable_type} color="gray" />
                  <span className={`text-xs ${isOverdue(d.due_date) && d.status === 'in_progress' ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>{fmtDate(d.due_date)}</span>
                  <Badge label={d.status} color={delivStatusColor(d.status)} />
                </div>
              ))}
              {!(selectedProject.deliverables ?? []).length && <p className="text-sm text-gray-400">No deliverables yet.</p>}
            </div>
          </div>
        )}

        {/* DELIVERABLES */}
        {tab === 'deliverables' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">{deliverables.length} deliverables across active projects</span>
              {overdueDeliverables.length > 0 && <span className="text-sm text-red-600 font-medium">{overdueDeliverables.length} overdue</span>}
            </div>
            <div className="bg-white rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b"><tr><th className="text-left px-4 py-2 text-gray-500 font-medium">Deliverable</th><th className="text-left px-4 py-2 text-gray-500 font-medium">Type</th><th className="text-left px-4 py-2 text-gray-500 font-medium">Phase</th><th className="text-left px-4 py-2 text-gray-500 font-medium">Rev</th><th className="text-left px-4 py-2 text-gray-500 font-medium">Due Date</th><th className="text-left px-4 py-2 text-gray-500 font-medium">Assigned</th><th className="text-left px-4 py-2 text-gray-500 font-medium">Status</th></tr></thead>
                <tbody>
                  {deliverables.map(d => (
                    <tr key={d.id} className={`border-b hover:bg-gray-50 ${isOverdue(d.due_date) && d.status === 'in_progress' ? 'bg-red-50' : ''}`}>
                      <td className="px-4 py-2 font-medium text-gray-800">{d.deliverable_name}</td>
                      <td className="px-4 py-2"><Badge label={d.deliverable_type} color="gray" /></td>
                      <td className="px-4 py-2 text-xs text-gray-500">{d.phase?.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-2"><span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{d.revision}</span></td>
                      <td className={`px-4 py-2 text-xs ${isOverdue(d.due_date) && d.status === 'in_progress' ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>{fmtDate(d.due_date)}</td>
                      <td className="px-4 py-2 text-xs text-gray-500">{d.assigned_to || '—'}</td>
                      <td className="px-4 py-2"><Badge label={d.status} color={delivStatusColor(d.status)} /></td>
                    </tr>
                  ))}
                  {!deliverables.length && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No deliverables found.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TIME TRACKING */}
        {tab === 'time' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">{timeEntries.length} entries</span>
              <button onClick={() => setShowLogTime(true)} className="ml-auto px-3 py-1.5 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700">+ Log Time</button>
            </div>
            <div className="bg-white rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b"><tr><th className="text-left px-4 py-2 text-gray-500 font-medium">Staff</th><th className="text-left px-4 py-2 text-gray-500 font-medium">Date</th><th className="text-left px-4 py-2 text-gray-500 font-medium">Phase</th><th className="text-left px-4 py-2 text-gray-500 font-medium">Description</th><th className="text-left px-4 py-2 text-gray-500 font-medium">Hours</th><th className="text-left px-4 py-2 text-gray-500 font-medium">Rate</th><th className="text-left px-4 py-2 text-gray-500 font-medium">Billable</th><th className="text-left px-4 py-2 text-gray-500 font-medium">Billed</th></tr></thead>
                <tbody>
                  {timeEntries.map(t => (
                    <tr key={t.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-800">{t.staff_name}</td>
                      <td className="px-4 py-2 text-xs text-gray-500">{fmtDate(t.entry_date)}</td>
                      <td className="px-4 py-2 text-xs text-gray-500">{t.phase?.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-2 text-xs text-gray-600 max-w-[200px] truncate">{t.task_description}</td>
                      <td className="px-4 py-2 font-semibold">{t.hours}h</td>
                      <td className="px-4 py-2 text-xs text-gray-500">${t.hourly_rate}/h</td>
                      <td className="px-4 py-2">{t.billable ? <Badge label="Billable" color="green" /> : <Badge label="Non-bill" color="gray" />}</td>
                      <td className="px-4 py-2">{t.billed ? <Badge label="Billed" color="teal" /> : <Badge label="Unbilled" color="amber" />}</td>
                    </tr>
                  ))}
                  {!timeEntries.length && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No time entries found.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* AI TOOLS */}
        {tab === 'ai' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border p-5 space-y-3">
              <h2 className="font-semibold text-gray-800">Design Brief Generator</h2>
              <div><label className="text-xs text-gray-500">Project Name</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiBrief.project_name} onChange={e => setAiBrief(s => ({ ...s, project_name: e.target.value }))} /></div>
              <div><label className="text-xs text-gray-500">Project Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiBrief.project_type} onChange={e => setAiBrief(s => ({ ...s, project_type: e.target.value }))}>{PROJECT_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
              <div><label className="text-xs text-gray-500">Client Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiBrief.client_type} onChange={e => setAiBrief(s => ({ ...s, client_type: e.target.value }))}>{CLIENT_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
              <div><label className="text-xs text-gray-500">Gross Area (sq ft)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiBrief.gross_area_sqft} onChange={e => setAiBrief(s => ({ ...s, gross_area_sqft: e.target.value }))} /></div>
              <div><label className="text-xs text-gray-500">Construction Budget (CAD)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiBrief.construction_budget} onChange={e => setAiBrief(s => ({ ...s, construction_budget: e.target.value }))} /></div>
              <button disabled={aiBrief.loading} onClick={async () => { setAiBrief(s => ({ ...s, loading: true, result: '' })); const r = await fetch('/api/admin/architecture-firm/ai-design-brief', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(aiBrief) }); const d = await r.json() as { result: string }; setAiBrief(s => ({ ...s, result: d.result, loading: false })); }} className="w-full py-2 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">{aiBrief.loading ? 'Generating…' : 'Generate Design Brief'}</button>
              {aiBrief.result && <div className="bg-gray-50 border rounded p-3 text-xs text-gray-700 whitespace-pre-wrap max-h-64 overflow-y-auto">{aiBrief.result}</div>}
            </div>
            <div className="bg-white rounded-xl border p-5 space-y-3">
              <h2 className="font-semibold text-gray-800">Specification Section Writer</h2>
              <div><label className="text-xs text-gray-500">Specification Section</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" placeholder="e.g. 09 21 16 — Gypsum Board Assemblies" value={aiSpec.spec_section} onChange={e => setAiSpec(s => ({ ...s, spec_section: e.target.value }))} /></div>
              <div><label className="text-xs text-gray-500">Project Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiSpec.project_type} onChange={e => setAiSpec(s => ({ ...s, project_type: e.target.value }))}>{PROJECT_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
              <div><label className="text-xs text-gray-500">Phase</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiSpec.phase} onChange={e => setAiSpec(s => ({ ...s, phase: e.target.value }))}>{PROJECT_PHASES.map(p => <option key={p}>{p}</option>)}</select></div>
              <button disabled={aiSpec.loading || !aiSpec.spec_section} onClick={async () => { setAiSpec(s => ({ ...s, loading: true, result: '' })); const r = await fetch('/api/admin/architecture-firm/ai-specifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(aiSpec) }); const d = await r.json() as { result: string }; setAiSpec(s => ({ ...s, result: d.result, loading: false })); }} className="w-full py-2 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">{aiSpec.loading ? 'Writing…' : 'Write Spec Section'}</button>
              {aiSpec.result && <div className="bg-gray-50 border rounded p-3 text-xs text-gray-700 whitespace-pre-wrap max-h-64 overflow-y-auto">{aiSpec.result}</div>}
            </div>
          </div>
        )}

        {/* FINANCIALS */}
        {tab === 'financials' && (
          <div className="space-y-4">
            <h2 className="font-semibold text-gray-800">WIP &amp; Financial Summary</h2>
            <div className="bg-white rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b"><tr><th className="text-left px-4 py-2 text-gray-500 font-medium">Project</th><th className="text-left px-4 py-2 text-gray-500 font-medium">Phase</th><th className="text-left px-4 py-2 text-gray-500 font-medium">Total Fee</th><th className="text-left px-4 py-2 text-gray-500 font-medium">Billed</th><th className="text-left px-4 py-2 text-gray-500 font-medium">Outstanding</th><th className="text-left px-4 py-2 text-gray-500 font-medium">% Billed</th></tr></thead>
                <tbody>
                  {projects.map(p => {
                    const pct = p.total_fee > 0 ? Math.round((p.billed_to_date / p.total_fee) * 100) : 0;
                    return (
                      <tr key={p.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2"><p className="font-medium text-gray-800">{p.project_name}</p><p className="text-xs text-gray-400 font-mono">{p.project_number}</p></td>
                        <td className="px-4 py-2"><Badge label={p.project_phase} color={phaseColor(p.project_phase)} /></td>
                        <td className="px-4 py-2">{fmtCad(p.total_fee)}</td>
                        <td className="px-4 py-2 text-green-700">{fmtCad(p.billed_to_date)}</td>
                        <td className="px-4 py-2 text-amber-700 font-semibold">{fmtCad(p.outstanding_balance)}</td>
                        <td className="px-4 py-2"><div className="flex items-center gap-2"><div className="w-20 bg-gray-200 rounded-full h-1.5"><div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} /></div><span className="text-xs text-gray-400">{pct}%</span></div></td>
                      </tr>
                    );
                  })}
                  {!projects.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No projects found.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showAddClient && <AddClientModal onClose={() => setShowAddClient(false)} onSaved={() => { setShowAddClient(false); refresh(); }} />}
      {showAddProject && clients.length > 0 && <AddProjectModal clients={clients} onClose={() => setShowAddProject(false)} onSaved={() => { setShowAddProject(false); refresh(); }} />}
      {showLogTime && projects.length > 0 && <LogTimeModal projects={projects} onClose={() => setShowLogTime(false)} onSaved={() => { setShowLogTime(false); if (tab === 'time') loadAllTime(projects); }} />}
    </div>
  );
}
