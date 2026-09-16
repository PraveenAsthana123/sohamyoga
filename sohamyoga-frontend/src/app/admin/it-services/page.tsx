'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard', 'clients', 'tickets', 'assets', 'projects', 'ai', 'sla'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = { dashboard: 'Dashboard', clients: 'Clients', tickets: 'Tickets', assets: 'Asset Inventory', projects: 'Projects', ai: 'AI IT Studio', sla: 'SLA Dashboard' };

const PRIORITIES = ['critical', 'high', 'medium', 'low'];
const TICKET_STATUSES = ['open', 'assigned', 'in_progress', 'waiting_client', 'resolved'];
const CATEGORIES = ['hardware', 'software', 'network', 'security', 'email', 'printer', 'account', 'backup', 'other'];
const CONTRACT_TYPES = ['managed', 'break_fix', 'project', 'hybrid'];
const ASSET_TYPES = ['desktop', 'laptop', 'server', 'network_device', 'printer', 'phone', 'tablet', 'other'];
const IT_SERVICES = ['helpdesk', 'network', 'security', 'cloud', 'm365', 'server', 'backup', 'voip', 'procurement', 'strategy'];
const IT_PROJECT_TYPES = ['cloud_migration', 'network_upgrade', 'security_audit', 'm365_deployment', 'server_setup', 'backup_implementation', 'voip_install', 'other'];
const IT_PROJECT_STATUSES = ['scoping', 'proposal', 'active', 'testing', 'complete', 'invoiced'];

interface ITClient { id: number; name: string; contact_person: string; email: string; phone: string; industry: string; city: string; province: string; num_users: number; num_devices: number; primary_os: string; cloud_platform: string; services: string[]; contract_type: string; monthly_fee: number; sla_response_hours: number; sla_resolution_hours: number; status: string; open_tickets: number; }
interface Ticket { id: number; client_id: number; client_name: string; ticket_number: string; title: string; description: string; category: string; priority: string; status: string; assigned_to: string; reported_by: string; created_at: string; first_response_at: string; resolved_at: string; sla_breach: boolean; resolution_notes: string; time_spent_minutes: number; billable: boolean; sla_response_hours: number; sla_resolution_hours: number; }
interface ITAsset { id: number; client_id: number; client_name: string; asset_type: string; make: string; model: string; serial_number: string; assigned_to_user: string; location: string; purchase_date: string; warranty_expiry: string; os: string; os_version: string; last_patch_date: string; status: string; }
interface ITProject { id: number; client_id: number; client_name: string; title: string; project_type: string; status: string; start_date: string; end_date: string; contract_value: number; hours_budget: number; hours_actual: number; }
interface SLARow { client_id: number; client_name: string; sla_response_hours: number; sla_resolution_hours: number; total_tickets: number; resolved_tickets: number; breach_count: number; avg_first_response_hours: number; avg_resolution_hours: number; compliance_pct: number; }

function fmtCad(n: number) { return `$${Number(n ?? 0).toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`; }
function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString('en-CA') : '—'; }
function timeAgo(d: string) {
  const diff = (Date.now() - new Date(d).getTime()) / 60000;
  if (diff < 60) return `${Math.round(diff)}m ago`;
  if (diff < 1440) return `${Math.round(diff / 60)}h ago`;
  return `${Math.round(diff / 1440)}d ago`;
}

function Badge({ label, color = 'gray' }: { label: string; color?: string }) {
  const map: Record<string, string> = { blue: 'bg-blue-100 text-blue-700', green: 'bg-green-100 text-green-700', amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700', purple: 'bg-purple-100 text-purple-700', gray: 'bg-gray-100 text-gray-700', teal: 'bg-teal-100 text-teal-700', orange: 'bg-orange-100 text-orange-700', indigo: 'bg-indigo-100 text-indigo-700' };
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${map[color] ?? map.gray}`}>{label}</span>;
}
function KpiCard({ label, value, sub, color = 'blue', alert }: { label: string; value: string | number; sub?: string; color?: string; alert?: boolean }) {
  const borders: Record<string, string> = { blue: 'border-l-4 border-blue-500 bg-blue-50', green: 'border-l-4 border-green-500 bg-green-50', amber: 'border-l-4 border-amber-500 bg-amber-50', red: 'border-l-4 border-red-500 bg-red-50', purple: 'border-l-4 border-purple-500 bg-purple-50' };
  return (
    <div className={`rounded-lg p-4 ${borders[color] ?? borders.blue} ${alert ? 'ring-2 ring-red-400' : ''}`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${alert ? 'text-red-600' : ''}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}
function priorityColor(p: string) { const m: Record<string, string> = { critical: 'red', high: 'orange', medium: 'amber', low: 'gray' }; return m[p] ?? 'gray'; }
function ticketStatusColor(s: string) { const m: Record<string, string> = { open: 'blue', assigned: 'indigo', in_progress: 'amber', waiting_client: 'purple', resolved: 'green', closed: 'teal' }; return m[s] ?? 'gray'; }
function projectStatusColor(s: string) { const m: Record<string, string> = { scoping: 'gray', proposal: 'blue', active: 'amber', testing: 'orange', complete: 'green', invoiced: 'teal' }; return m[s] ?? 'gray'; }
function complianceColor(pct: number) { return pct >= 95 ? 'green' : pct >= 85 ? 'amber' : 'red'; }

// ─── Add Client Modal ─────────────────────────────────────────────────────────
function AddClientModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', contact_person: '', email: '', phone: '', industry: '', city: 'Calgary', province: 'AB', num_users: '', num_devices: '', primary_os: 'windows', cloud_platform: 'microsoft365', contract_type: 'managed', monthly_fee: '', sla_response_hours: '4', sla_resolution_hours: '24', notes: '' });
  const [services, setServices] = useState<string[]>(['helpdesk']);
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  function toggleSvc(s: string) { setServices(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]); }
  async function submit() {
    if (!form.name) return;
    setSaving(true);
    try {
      await fetch('/api/admin/it-services', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, services, num_users: form.num_users ? parseInt(form.num_users) : null, num_devices: form.num_devices ? parseInt(form.num_devices) : null, monthly_fee: form.monthly_fee ? parseFloat(form.monthly_fee) : null, sla_response_hours: parseInt(form.sla_response_hours), sla_resolution_hours: parseInt(form.sla_resolution_hours) }) });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-4 text-slate-800">New IT Client</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs text-gray-500">Company Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.name} onChange={e => f('name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Contact Person</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.contact_person} onChange={e => f('contact_person', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Industry</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.industry} onChange={e => f('industry', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Email</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.email} onChange={e => f('email', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Phone</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.phone} onChange={e => f('phone', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Users</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.num_users} onChange={e => f('num_users', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Devices</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.num_devices} onChange={e => f('num_devices', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Primary OS</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.primary_os} onChange={e => f('primary_os', e.target.value)}>{['windows','mac','linux','mixed'].map(o => <option key={o}>{o}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Cloud Platform</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.cloud_platform} onChange={e => f('cloud_platform', e.target.value)}>{['microsoft365','google_workspace','aws','azure','none','mixed'].map(o => <option key={o}>{o}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Contract Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.contract_type} onChange={e => f('contract_type', e.target.value)}>{CONTRACT_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Monthly Fee (CAD)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.monthly_fee} onChange={e => f('monthly_fee', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">SLA Response (hrs)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.sla_response_hours} onChange={e => f('sla_response_hours', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">SLA Resolution (hrs)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.sla_resolution_hours} onChange={e => f('sla_resolution_hours', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Services</label><div className="flex flex-wrap gap-2 mt-1">{IT_SERVICES.map(s => <button key={s} type="button" onClick={() => toggleSvc(s)} className={`px-2 py-0.5 rounded text-xs border ${services.includes(s) ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-600 border-gray-300'}`}>{s}</button>)}</div></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.notes} onChange={e => f('notes', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-1.5 rounded border text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving || !form.name} className="px-4 py-1.5 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Create Client'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── New Ticket Modal ─────────────────────────────────────────────────────────
function NewTicketModal({ clients, onClose, onSaved }: { clients: ITClient[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ client_id: clients[0]?.id?.toString() ?? '', title: '', description: '', category: 'hardware', priority: 'medium', assigned_to: '', reported_by: '', billable: false });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.title) return;
    setSaving(true);
    try {
      await fetch('/api/admin/it-services/tickets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
        <h2 className="text-lg font-bold mb-4 text-slate-800">New Support Ticket</h2>
        <div className="space-y-3">
          <div><label className="text-xs text-gray-500">Client *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.client_id} onChange={e => f('client_id', e.target.value)}>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Title *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.title} onChange={e => f('title', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Description</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={3} value={form.description} onChange={e => f('description', e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs text-gray-500">Category</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.category} onChange={e => f('category', e.target.value)}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
            <div><label className="text-xs text-gray-500">Priority</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.priority} onChange={e => f('priority', e.target.value)}>{PRIORITIES.map(p => <option key={p}>{p}</option>)}</select></div>
            <div><label className="text-xs text-gray-500">Assigned To</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.assigned_to} onChange={e => f('assigned_to', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Reported By</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.reported_by} onChange={e => f('reported_by', e.target.value)} /></div>
          </div>
          <div className="flex items-center gap-2"><input type="checkbox" id="billable" checked={form.billable} onChange={e => f('billable', e.target.checked)} /><label htmlFor="billable" className="text-sm text-gray-600">Billable (break/fix)</label></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-1.5 rounded border text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving || !form.title} className="px-4 py-1.5 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Create Ticket'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Resolve Ticket Modal ─────────────────────────────────────────────────────
function ResolveModal({ ticket, onClose, onSaved }: { ticket: Ticket; onClose: () => void; onSaved: () => void }) {
  const [notes, setNotes] = useState('');
  const [minutes, setMinutes] = useState('');
  const [saving, setSaving] = useState(false);
  async function submit() {
    setSaving(true);
    try {
      await fetch(`/api/admin/it-services/tickets/${ticket.id}/resolve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resolution_notes: notes, time_spent_minutes: minutes ? parseInt(minutes) : undefined }) });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold mb-1">Resolve Ticket</h2>
        <p className="text-sm text-gray-500 mb-4">{ticket.ticket_number}: {ticket.title}</p>
        <div className="space-y-3">
          <div><label className="text-xs text-gray-500">Resolution Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={4} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Describe what was done to resolve the issue…" /></div>
          <div><label className="text-xs text-gray-500">Time Spent (minutes)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={minutes} onChange={e => setMinutes(e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-1.5 rounded border text-sm">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-1.5 rounded bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50">{saving ? 'Resolving…' : 'Mark Resolved'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Asset Modal ──────────────────────────────────────────────────────────
function AddAssetModal({ clients, onClose, onSaved }: { clients: ITClient[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ client_id: clients[0]?.id?.toString() ?? '', asset_type: 'laptop', make: '', model: '', serial_number: '', assigned_to_user: '', location: '', purchase_date: '', warranty_expiry: '', os: '', os_version: '', last_patch_date: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    setSaving(true);
    try {
      await fetch('/api/admin/it-services/assets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-4 text-slate-800">Add Asset</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs text-gray-500">Client *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.client_id} onChange={e => f('client_id', e.target.value)}>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Asset Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.asset_type} onChange={e => f('asset_type', e.target.value)}>{ASSET_TYPES.map(t => <option key={t}>{t.replace('_', ' ')}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Make</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.make} onChange={e => f('make', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Model</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.model} onChange={e => f('model', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Serial Number</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5 font-mono" value={form.serial_number} onChange={e => f('serial_number', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Assigned To User</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.assigned_to_user} onChange={e => f('assigned_to_user', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Location</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.location} onChange={e => f('location', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Purchase Date</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.purchase_date} onChange={e => f('purchase_date', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Warranty Expiry</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.warranty_expiry} onChange={e => f('warranty_expiry', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">OS</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" placeholder="e.g. windows" value={form.os} onChange={e => f('os', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">OS Version</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" placeholder="e.g. 11 Pro" value={form.os_version} onChange={e => f('os_version', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Last Patch Date</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.last_patch_date} onChange={e => f('last_patch_date', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-1.5 rounded border text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-1.5 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Add Asset'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add IT Project Modal ─────────────────────────────────────────────────────
function AddProjectModal({ clients, onClose, onSaved }: { clients: ITClient[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ client_id: clients[0]?.id?.toString() ?? '', title: '', project_type: 'cloud_migration', start_date: '', end_date: '', contract_value: '', hours_budget: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.title) return;
    setSaving(true);
    try {
      await fetch('/api/admin/it-services/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, contract_value: form.contract_value ? parseFloat(form.contract_value) : null, hours_budget: form.hours_budget ? parseFloat(form.hours_budget) : null }) });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
        <h2 className="text-lg font-bold mb-4 text-slate-800">New IT Project</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs text-gray-500">Client *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.client_id} onChange={e => f('client_id', e.target.value)}>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Project Title *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.title} onChange={e => f('title', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Project Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.project_type} onChange={e => f('project_type', e.target.value)}>{IT_PROJECT_TYPES.map(t => <option key={t}>{t.replace(/_/g, ' ')}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Start Date</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.start_date} onChange={e => f('start_date', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">End Date</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.end_date} onChange={e => f('end_date', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Contract Value (CAD)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.contract_value} onChange={e => f('contract_value', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Budget Hours</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.hours_budget} onChange={e => f('hours_budget', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.notes} onChange={e => f('notes', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-1.5 rounded border text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving || !form.title} className="px-4 py-1.5 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Create Project'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard Tab ─────────────────────────────────────────────────────────────
function DashboardTab() {
  const [data, setData] = useState<{ openTickets: number; criticalTickets: number; slaBreaches: number; mrr: number; warrantyExpiring: number } | null>(null);
  useEffect(() => { fetch('/api/admin/it-services?mode=dashboard').then(r => r.json()).then(setData); }, []);
  if (!data) return <div className="p-8 text-center text-gray-400">Loading dashboard…</div>;
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      <KpiCard label="Open Tickets" value={data.openTickets} color="blue" />
      <KpiCard label="Critical Tickets" value={data.criticalTickets} color="red" alert={data.criticalTickets > 0} />
      <KpiCard label="SLA Breaches" value={data.slaBreaches} sub="Open tickets breached" color="red" alert={data.slaBreaches > 0} />
      <KpiCard label="Managed MRR" value={fmtCad(data.mrr)} sub="Active managed clients" color="green" />
      <KpiCard label="Warranty Expiring" value={data.warrantyExpiring} sub="Next 90 days" color="amber" />
    </div>
  );
}

// ─── Clients Tab ──────────────────────────────────────────────────────────────
function ClientsTab() {
  const [clients, setClients] = useState<ITClient[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const load = useCallback(() => fetch('/api/admin/it-services').then(r => r.json()).then(d => setClients(d.clients ?? [])), []);
  useEffect(() => { load(); }, [load]);
  return (
    <div>
      {showAdd && <AddClientModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-slate-700">IT Clients ({clients.length})</h3>
        <button onClick={() => setShowAdd(true)} className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 font-medium">+ Add Client</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead><tr className="bg-gray-50 text-xs text-gray-500 uppercase">{['Company','Industry','Contract','Users/Devices','Services','Cloud','MRR','SLA','Open Tkts','Status'].map(h => <th key={h} className="px-3 py-2 text-left border-b">{h}</th>)}</tr></thead>
          <tbody>{clients.map(c => (
            <tr key={c.id} className="border-b hover:bg-gray-50">
              <td className="px-3 py-2 font-medium text-gray-900">{c.name}<br /><span className="text-xs text-gray-400">{c.contact_person}</span></td>
              <td className="px-3 py-2 text-gray-500 text-xs">{c.industry}</td>
              <td className="px-3 py-2"><Badge label={c.contract_type} color={c.contract_type === 'managed' ? 'blue' : 'gray'} /></td>
              <td className="px-3 py-2 text-xs text-gray-500">{c.num_users ?? '—'}u / {c.num_devices ?? '—'}d</td>
              <td className="px-3 py-2"><div className="flex flex-wrap gap-0.5">{(c.services ?? []).slice(0, 4).map(s => <Badge key={s} label={s} />)}{(c.services ?? []).length > 4 && <Badge label={`+${(c.services ?? []).length - 4}`} />}</div></td>
              <td className="px-3 py-2 text-xs text-gray-500">{c.cloud_platform ?? '—'}</td>
              <td className="px-3 py-2 font-medium text-gray-700">{c.monthly_fee ? fmtCad(c.monthly_fee) : '—'}</td>
              <td className="px-3 py-2 text-xs text-gray-500">{c.sla_response_hours}h/{c.sla_resolution_hours}h</td>
              <td className="px-3 py-2 text-center"><span className={`font-bold ${Number(c.open_tickets) > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{c.open_tickets}</span></td>
              <td className="px-3 py-2"><Badge label={c.status} color={c.status === 'active' ? 'green' : 'gray'} /></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Tickets Tab ──────────────────────────────────────────────────────────────
function TicketsTab({ clients }: { clients: ITClient[] }) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [resolveTicket, setResolveTicket] = useState<Ticket | null>(null);
  const [filterPriority, setFilterPriority] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const load = useCallback(() => {
    const p = new URLSearchParams();
    if (filterPriority) p.set('priority', filterPriority);
    if (filterStatus) p.set('status', filterStatus);
    fetch(`/api/admin/it-services/tickets?${p}`).then(r => r.json()).then(d => setTickets(d.tickets ?? []));
  }, [filterPriority, filterStatus]);
  useEffect(() => { load(); }, [load]);

  async function advance(id: number, status: string) {
    await fetch(`/api/admin/it-services/tickets/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    load();
  }

  const byStatus = (s: string) => tickets.filter(t => t.status === s);
  const nextStatus: Record<string, string> = { open: 'assigned', assigned: 'in_progress', in_progress: 'waiting_client', waiting_client: 'in_progress' };
  const nextLabel: Record<string, string> = { open: 'Assign', assigned: 'Start', in_progress: 'Wait Client', waiting_client: 'Resume' };

  return (
    <div>
      {showNew && <NewTicketModal clients={clients} onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load(); }} />}
      {resolveTicket && <ResolveModal ticket={resolveTicket} onClose={() => setResolveTicket(null)} onSaved={() => { setResolveTicket(null); load(); }} />}
      <div className="flex flex-wrap gap-3 items-center mb-4">
        <h3 className="font-semibold text-slate-700 flex-1">Tickets ({tickets.length})</h3>
        <select className="border rounded px-2 py-1.5 text-sm" value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
          <option value="">All Priorities</option>{PRIORITIES.map(p => <option key={p}>{p}</option>)}
        </select>
        <select className="border rounded px-2 py-1.5 text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>{TICKET_STATUSES.map(s => <option key={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <button onClick={() => setShowNew(true)} className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 font-medium">+ New Ticket</button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 overflow-x-auto">
        {TICKET_STATUSES.map(st => (
          <div key={st} className="min-w-[150px]">
            <div className="flex items-center gap-1 mb-2">
              <Badge label={st.replace(/_/g, ' ')} color={ticketStatusColor(st)} />
              <span className="text-xs text-gray-400">({byStatus(st).length})</span>
            </div>
            <div className="space-y-2">
              {byStatus(st).map(t => (
                <div key={t.id} className={`bg-white border rounded-lg p-2 shadow-sm text-xs ${t.sla_breach ? 'border-red-400 bg-red-50' : ''}`}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-mono text-gray-400 text-xs">{t.ticket_number}</span>
                    {t.sla_breach && <span className="text-red-600 font-bold text-xs">SLA!</span>}
                  </div>
                  <div className="font-medium text-gray-800 line-clamp-2">{t.title}</div>
                  <div className="text-gray-400 mt-0.5">{t.client_name}</div>
                  <div className="flex items-center justify-between mt-1 gap-1 flex-wrap">
                    <Badge label={t.priority} color={priorityColor(t.priority)} />
                    <Badge label={t.category ?? ''} />
                  </div>
                  {t.assigned_to && <div className="text-gray-400 mt-0.5 truncate">{t.assigned_to}</div>}
                  <div className="text-gray-300 mt-0.5">{timeAgo(t.created_at)}</div>
                  <div className="flex gap-1 mt-1.5">
                    {nextStatus[st] && <button onClick={() => advance(t.id, nextStatus[st])} className="flex-1 py-0.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">{nextLabel[st]}</button>}
                    {st !== 'resolved' && <button onClick={() => setResolveTicket(t)} className="flex-1 py-0.5 bg-green-600 text-white rounded text-xs hover:bg-green-700">Resolve</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Asset Inventory Tab ──────────────────────────────────────────────────────
function AssetsTab({ clients }: { clients: ITClient[] }) {
  const [assets, setAssets] = useState<ITAsset[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [filterClient, setFilterClient] = useState('');
  const [warrantyOnly, setWarrantyOnly] = useState(false);
  const load = useCallback(() => {
    const p = new URLSearchParams();
    if (filterClient) p.set('client_id', filterClient);
    if (warrantyOnly) p.set('warranty_expiring', 'true');
    fetch(`/api/admin/it-services/assets?${p}`).then(r => r.json()).then(d => setAssets(d.assets ?? []));
  }, [filterClient, warrantyOnly]);
  useEffect(() => { load(); }, [load]);
  const today = new Date();
  const ninety = new Date(); ninety.setDate(today.getDate() + 90);
  function warrantyAlert(d: string) { if (!d) return false; const exp = new Date(d); return exp >= today && exp <= ninety; }
  function warrantyExpired(d: string) { if (!d) return false; return new Date(d) < today; }

  return (
    <div>
      {showAdd && <AddAssetModal clients={clients} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
      <div className="flex flex-wrap gap-3 items-center mb-4">
        <h3 className="font-semibold text-slate-700 flex-1">Asset Inventory ({assets.length})</h3>
        <select className="border rounded px-2 py-1.5 text-sm" value={filterClient} onChange={e => setFilterClient(e.target.value)}>
          <option value="">All Clients</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <label className="flex items-center gap-1 text-sm cursor-pointer"><input type="checkbox" checked={warrantyOnly} onChange={e => setWarrantyOnly(e.target.checked)} /> Warranty expiring (90d)</label>
        <button onClick={() => setShowAdd(true)} className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 font-medium">+ Add Asset</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead><tr className="bg-gray-50 text-xs text-gray-500 uppercase">{['Client','Type','Make/Model','Serial','Assigned','Location','OS','Warranty','Last Patch','Status'].map(h => <th key={h} className="px-3 py-2 text-left border-b">{h}</th>)}</tr></thead>
          <tbody>{assets.map(a => (
            <tr key={a.id} className={`border-b hover:bg-gray-50 ${warrantyAlert(a.warranty_expiry) ? 'bg-amber-50' : ''}`}>
              <td className="px-3 py-2 text-xs text-gray-500">{a.client_name}</td>
              <td className="px-3 py-2"><Badge label={a.asset_type.replace('_', ' ')} /></td>
              <td className="px-3 py-2 font-medium text-sm">{a.make} {a.model}</td>
              <td className="px-3 py-2 font-mono text-xs text-gray-400">{a.serial_number || '—'}</td>
              <td className="px-3 py-2 text-xs text-gray-600">{a.assigned_to_user || '—'}</td>
              <td className="px-3 py-2 text-xs text-gray-500">{a.location || '—'}</td>
              <td className="px-3 py-2 text-xs text-gray-500">{a.os} {a.os_version}</td>
              <td className={`px-3 py-2 text-xs ${warrantyExpired(a.warranty_expiry) ? 'text-red-600 font-semibold' : warrantyAlert(a.warranty_expiry) ? 'text-amber-600 font-semibold' : 'text-gray-500'}`}>
                {fmtDate(a.warranty_expiry)}{warrantyAlert(a.warranty_expiry) && ' ⚠'}
              </td>
              <td className="px-3 py-2 text-xs text-gray-400">{fmtDate(a.last_patch_date)}</td>
              <td className="px-3 py-2"><Badge label={a.status} color={a.status === 'active' ? 'green' : a.status === 'repair' ? 'amber' : 'gray'} /></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

// ─── IT Projects Tab ──────────────────────────────────────────────────────────
function ProjectsTab({ clients }: { clients: ITClient[] }) {
  const [projects, setProjects] = useState<ITProject[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const load = useCallback(() => {
    const p = new URLSearchParams();
    if (filterStatus) p.set('status', filterStatus);
    fetch(`/api/admin/it-services/projects?${p}`).then(r => r.json()).then(d => setProjects(d.projects ?? []));
  }, [filterStatus]);
  useEffect(() => { load(); }, [load]);

  async function advanceStatus(id: number, next: string) {
    await fetch(`/api/admin/it-services/projects/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: next }) });
    load();
  }
  const next: Record<string, string> = { scoping: 'proposal', proposal: 'active', active: 'testing', testing: 'complete', complete: 'invoiced' };
  const nextLabel: Record<string, string> = { scoping: 'Send Proposal', proposal: 'Activate', active: 'Start Testing', testing: 'Mark Complete', complete: 'Invoice' };

  return (
    <div>
      {showAdd && <AddProjectModal clients={clients} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
      <div className="flex flex-wrap gap-3 items-center mb-4">
        <h3 className="font-semibold text-slate-700 flex-1">IT Projects ({projects.length})</h3>
        <select className="border rounded px-2 py-1.5 text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>{IT_PROJECT_STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <button onClick={() => setShowAdd(true)} className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 font-medium">+ New Project</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {projects.map(p => {
          const pct = p.hours_budget > 0 ? Math.min(100, Math.round((p.hours_actual / p.hours_budget) * 100)) : 0;
          return (
            <div key={p.id} className="bg-white border rounded-xl p-4 shadow-sm">
              <div className="font-semibold text-gray-900 mb-1">{p.title}</div>
              <div className="text-xs text-gray-400 mb-2">{p.client_name}</div>
              <div className="flex flex-wrap gap-1 mb-3">
                <Badge label={(p.project_type ?? '').replace(/_/g, ' ')} />
                <Badge label={p.status} color={projectStatusColor(p.status)} />
              </div>
              <div className="text-xs text-gray-500 space-y-0.5 mb-3">
                {p.contract_value > 0 && <div>Contract: {fmtCad(p.contract_value)}</div>}
                {p.hours_budget > 0 && <div>Hours: {p.hours_actual ?? 0}/{p.hours_budget}h</div>}
              </div>
              {p.hours_budget > 0 && (
                <div className="mb-3"><div className="h-1.5 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} /></div></div>
              )}
              {next[p.status] && <button onClick={() => advanceStatus(p.id, next[p.status])} className="w-full py-1 bg-slate-700 text-white rounded text-xs hover:bg-slate-800">{nextLabel[p.status]}</button>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── AI IT Studio Tab ─────────────────────────────────────────────────────────
function AITab() {
  const [mode, setMode] = useState<'diagnosis' | 'proposal' | 'checklist'>('diagnosis');
  const [symptoms, setSymptoms] = useState('');
  const [os, setOs] = useState('Windows 11');
  const [category, setCategory] = useState('software');
  const [clientSize, setClientSize] = useState('SMB (10-50 users)');
  const [industry, setIndustry] = useState('');
  const [servicesNeeded, setServicesNeeded] = useState('');
  const [painPoints, setPainPoints] = useState('');
  const [checklistType, setChecklistType] = useState('SMB office environment');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [fallback, setFallback] = useState(false);

  async function generate() {
    setLoading(true); setResult('');
    try {
      if (mode === 'diagnosis') {
        const res = await fetch('/api/admin/it-services/ai-diagnosis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symptoms, os, category }) });
        const d = await res.json(); setResult(d.steps ?? ''); setFallback(d.fallback ?? false);
      } else if (mode === 'proposal') {
        const res = await fetch('/api/admin/it-services/ai-proposal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_size: clientSize, industry, services_needed: servicesNeeded, pain_points: painPoints }) });
        const d = await res.json(); setResult(d.proposal ?? ''); setFallback(d.fallback ?? false);
      } else {
        const checklist_prompt = `Generate a comprehensive IT security audit checklist for: ${checklistType}. Include sections for: network security, endpoint/device security, access control & identity, email security, data backup & DR, patch management, incident response readiness, and physical security. Format as a numbered checklist with sub-items.`;
        const res = await fetch('/api/admin/it-services/ai-diagnosis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symptoms: checklist_prompt, os: 'All platforms', category: 'security' }) });
        const d = await res.json(); setResult(d.steps ?? ''); setFallback(d.fallback ?? false);
      }
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border p-4">
        <h3 className="font-semibold text-slate-700 mb-1">AI IT Studio</h3>
        <p className="text-xs text-gray-400 mb-3">Powered by local Ollama. Verify all AI-generated steps before applying to client systems.</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {(['diagnosis', 'proposal', 'checklist'] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setResult(''); }} className={`px-3 py-1.5 rounded text-sm font-medium border ${mode === m ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
              {m === 'diagnosis' ? 'Troubleshooting Assistant' : m === 'proposal' ? 'MSP Proposal Generator' : 'Security Audit Checklist'}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            {mode === 'diagnosis' && (
              <>
                <div><label className="text-xs text-gray-500">Symptoms / Issue *</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={4} placeholder="Describe the IT issue, error messages, what changed recently..." value={symptoms} onChange={e => setSymptoms(e.target.value)} /></div>
                <div><label className="text-xs text-gray-500">Operating System</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={os} onChange={e => setOs(e.target.value)} /></div>
                <div><label className="text-xs text-gray-500">Category</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={category} onChange={e => setCategory(e.target.value)}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
              </>
            )}
            {mode === 'proposal' && (
              <>
                <div><label className="text-xs text-gray-500">Client Size</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={clientSize} onChange={e => setClientSize(e.target.value)} /></div>
                <div><label className="text-xs text-gray-500">Industry</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={industry} onChange={e => setIndustry(e.target.value)} /></div>
                <div><label className="text-xs text-gray-500">Services Needed *</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={3} placeholder="e.g. helpdesk, M365, backup, cybersecurity, VoIP..." value={servicesNeeded} onChange={e => setServicesNeeded(e.target.value)} /></div>
                <div><label className="text-xs text-gray-500">Pain Points</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} placeholder="e.g. slow response, no backup, security incidents..." value={painPoints} onChange={e => setPainPoints(e.target.value)} /></div>
              </>
            )}
            {mode === 'checklist' && (
              <div><label className="text-xs text-gray-500">Client Environment / Type</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" placeholder="e.g. law firm, dental clinic, manufacturing, retail..." value={checklistType} onChange={e => setChecklistType(e.target.value)} /></div>
            )}
            <button onClick={generate} disabled={loading || (mode === 'diagnosis' && !symptoms) || (mode === 'proposal' && !servicesNeeded)} className="w-full py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Generating with Ollama…' : mode === 'diagnosis' ? 'Get Troubleshooting Steps' : mode === 'proposal' ? 'Generate MSP Proposal' : 'Generate Security Checklist'}
            </button>
          </div>
          <div>
            <label className="text-xs text-gray-500">Output {fallback && <span className="text-amber-600">(AI fallback)</span>}</label>
            <div className="mt-0.5 border rounded p-3 bg-gray-50 min-h-[300px] text-sm font-mono whitespace-pre-wrap text-gray-700 overflow-y-auto max-h-[500px]">{result || (loading ? 'Generating…' : 'Output will appear here…')}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SLA Dashboard Tab ────────────────────────────────────────────────────────
function SLATab() {
  const [data, setData] = useState<{ sla: SLARow[]; overall: number; breaches: Ticket[]; period: number } | null>(null);
  const [period, setPeriod] = useState('30');
  useEffect(() => { fetch(`/api/admin/it-services/sla-report?period=${period}`).then(r => r.json()).then(setData); }, [period]);
  if (!data) return <div className="p-8 text-center text-gray-400">Loading SLA data…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-6">
        <div>
          <div className="text-4xl font-bold text-gray-900">{data.overall}%</div>
          <div className="text-sm text-gray-500">Overall SLA Compliance — last {data.period} days</div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">Period:</label>
          <select className="border rounded px-2 py-1.5 text-sm" value={period} onChange={e => setPeriod(e.target.value)}>
            {['7', '14', '30', '60', '90'].map(p => <option key={p} value={p}>{p} days</option>)}
          </select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead><tr className="bg-gray-50 text-xs text-gray-500 uppercase">{['Client','SLA (Resp/Res)','Total','Resolved','Breaches','Avg Response','Avg Resolution','Compliance'].map(h => <th key={h} className="px-3 py-2 text-left border-b">{h}</th>)}</tr></thead>
          <tbody>{data.sla.map(r => (
            <tr key={r.client_id} className="border-b hover:bg-gray-50">
              <td className="px-3 py-2 font-medium text-gray-900">{r.client_name}</td>
              <td className="px-3 py-2 text-gray-500 text-xs">{r.sla_response_hours}h / {r.sla_resolution_hours}h</td>
              <td className="px-3 py-2 text-center text-gray-700">{r.total_tickets}</td>
              <td className="px-3 py-2 text-center text-green-600">{r.resolved_tickets}</td>
              <td className="px-3 py-2 text-center"><span className={Number(r.breach_count) > 0 ? 'text-red-600 font-bold' : 'text-gray-400'}>{r.breach_count}</span></td>
              <td className="px-3 py-2 text-gray-500 text-xs">{r.avg_first_response_hours != null ? `${r.avg_first_response_hours}h` : '—'}</td>
              <td className="px-3 py-2 text-gray-500 text-xs">{r.avg_resolution_hours != null ? `${r.avg_resolution_hours}h` : '—'}</td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden"><div className={`h-full rounded-full ${complianceColor(Number(r.compliance_pct)) === 'green' ? 'bg-green-500' : complianceColor(Number(r.compliance_pct)) === 'amber' ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${r.compliance_pct}%` }} /></div>
                  <Badge label={`${r.compliance_pct}%`} color={complianceColor(Number(r.compliance_pct))} />
                </div>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {data.breaches.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <h4 className="font-semibold text-red-700 mb-2">SLA Breach List ({data.breaches.length})</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead><tr className="text-red-500 uppercase">{['Ticket#','Client','Title','Priority','Status','Opened'].map(h => <th key={h} className="px-2 py-1.5 text-left border-b border-red-200">{h}</th>)}</tr></thead>
              <tbody>{data.breaches.map(t => (
                <tr key={t.id} className="border-b border-red-100">
                  <td className="px-2 py-1.5 font-mono text-red-700">{t.ticket_number}</td>
                  <td className="px-2 py-1.5">{t.client_name}</td>
                  <td className="px-2 py-1.5 text-gray-700">{t.title}</td>
                  <td className="px-2 py-1.5"><Badge label={t.priority} color={priorityColor(t.priority)} /></td>
                  <td className="px-2 py-1.5"><Badge label={t.status} color={ticketStatusColor(t.status)} /></td>
                  <td className="px-2 py-1.5 text-gray-400">{timeAgo(t.created_at)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ITServicesPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [clients, setClients] = useState<ITClient[]>([]);
  useEffect(() => { fetch('/api/admin/it-services').then(r => r.json()).then(d => setClients(d.clients ?? [])); }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-slate-800 text-white px-6 py-4">
        <h1 className="text-xl font-bold">IT Services Portal</h1>
        <p className="text-slate-300 text-sm mt-0.5">Managed Service Provider (MSP) CRM — Helpdesk, Network, Security, Cloud, M365, Backup, VoIP</p>
      </div>
      <div className="bg-white border-b px-6">
        <nav className="flex gap-1 pt-2 overflow-x-auto">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2.5 text-sm font-medium rounded-t border-b-2 transition-colors whitespace-nowrap ${tab === t ? 'border-blue-600 text-blue-700 bg-blue-50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {TAB_LABELS[t]}
            </button>
          ))}
        </nav>
      </div>
      <div className="p-6">
        {tab === 'dashboard' && <DashboardTab />}
        {tab === 'clients' && <ClientsTab />}
        {tab === 'tickets' && <TicketsTab clients={clients} />}
        {tab === 'assets' && <AssetsTab clients={clients} />}
        {tab === 'projects' && <ProjectsTab clients={clients} />}
        {tab === 'ai' && <AITab />}
        {tab === 'sla' && <SLATab />}
      </div>
    </div>
  );
}
