'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard', 'clients', 'engagements', 'time', 'ai'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = { dashboard: 'Dashboard', clients: 'Clients', engagements: 'Work Queue', time: 'Time Tracking', ai: 'AI Studio' };

const CLIENT_TYPES = ['personal', 'corporate', 'non_profit', 'trust', 'partnership'];
const ENGAGEMENT_TYPES = ['bookkeeping', 'payroll', 't1', 't2', 'gst_hst', 'audit', 'review', 'compilation', 'advisory', 'year_end'];
const ENGAGEMENT_STATUSES = ['not_started', 'in_progress', 'review', 'completed', 'filed', 'billed'];
const MEMO_TYPES = ['management_letter', 'tax_planning_memo', 'engagement_letter', 'compilation_report'];
const SOFTWARE_OPTIONS = ['QuickBooks', 'Xero', 'Sage50', 'Wave', 'Freshbooks', 'Excel', 'other'];

interface AccountingClient { id: number; name: string; client_type: string; email: string; phone: string; city: string; province: string; industry: string; services: string[]; software: string; engagement_type: string; monthly_fee: number; hourly_rate: number; status: string; assigned_cpa: string; fiscal_year_end: string; }
interface Engagement { id: number; client_id: number; client_name: string; engagement_type: string; period_start: string; period_end: string; status: string; assigned_to: string; due_date: string; hours_budget: number; hours_actual: number; fee: number; invoiced: boolean; paid: boolean; notes: string; }
interface TimeEntry { id: number; client_id: number; client_name: string; engagement_id: number; date: string; staff_name: string; description: string; hours: number; rate: number; billable: boolean; billed: boolean; }

function fmtCad(n: number) { return `$${Number(n ?? 0).toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`; }
function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString('en-CA') : '—'; }

function Badge({ label, color = 'gray' }: { label: string; color?: string }) {
  const map: Record<string, string> = { blue: 'bg-blue-100 text-blue-700', green: 'bg-green-100 text-green-700', amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700', purple: 'bg-purple-100 text-purple-700', gray: 'bg-gray-100 text-gray-700', teal: 'bg-teal-100 text-teal-700' };
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${map[color] ?? map.gray}`}>{label}</span>;
}

function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const borders: Record<string, string> = { blue: 'border-l-4 border-blue-500 bg-blue-50', green: 'border-l-4 border-green-500 bg-green-50', amber: 'border-l-4 border-amber-500 bg-amber-50', red: 'border-l-4 border-red-500 bg-red-50', purple: 'border-l-4 border-purple-500 bg-purple-50' };
  return (
    <div className={`rounded-lg p-4 ${borders[color] ?? borders.blue}`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function statusColor(s: string) {
  const m: Record<string, string> = { not_started: 'gray', in_progress: 'blue', review: 'amber', completed: 'green', filed: 'teal', billed: 'purple' };
  return m[s] ?? 'gray';
}

function clientTypeColor(t: string) {
  const m: Record<string, string> = { corporate: 'blue', personal: 'green', non_profit: 'purple', trust: 'amber', partnership: 'teal' };
  return m[t] ?? 'gray';
}

// ─── Add Client Modal ─────────────────────────────────────────────────────────
function AddClientModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', client_type: 'corporate', email: '', phone: '', city: 'Calgary', province: 'AB', bn: '', industry: '', software: 'QuickBooks', engagement_type: 'annual', monthly_fee: '', hourly_rate: '185', assigned_cpa: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.name) return;
    setSaving(true);
    try {
      await fetch('/api/admin/accounting-firm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, monthly_fee: form.monthly_fee ? parseFloat(form.monthly_fee) : null, hourly_rate: form.hourly_rate ? parseFloat(form.hourly_rate) : null }) });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-4 text-slate-800">New Accounting Client</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs text-gray-500">Client Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.name} onChange={e => f('name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Client Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.client_type} onChange={e => f('client_type', e.target.value)}>{CLIENT_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Industry</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.industry} onChange={e => f('industry', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Email</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.email} onChange={e => f('email', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Phone</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.phone} onChange={e => f('phone', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">City</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.city} onChange={e => f('city', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Province</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.province} onChange={e => f('province', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Business Number (BN)</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5 font-mono" value={form.bn} onChange={e => f('bn', e.target.value)} placeholder="123456789RT0001" /></div>
          <div><label className="text-xs text-gray-500">Software</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.software} onChange={e => f('software', e.target.value)}>{SOFTWARE_OPTIONS.map(s => <option key={s}>{s}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Engagement Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.engagement_type} onChange={e => f('engagement_type', e.target.value)}>{['monthly_bookkeeping','quarterly','annual','one_time'].map(t => <option key={t}>{t}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Monthly Fee (CAD)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.monthly_fee} onChange={e => f('monthly_fee', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Hourly Rate (CAD)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.hourly_rate} onChange={e => f('hourly_rate', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Assigned CPA</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.assigned_cpa} onChange={e => f('assigned_cpa', e.target.value)} /></div>
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

// ─── Add Engagement Modal ─────────────────────────────────────────────────────
function AddEngagementModal({ clients, onClose, onSaved }: { clients: AccountingClient[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ client_id: clients[0]?.id?.toString() ?? '', engagement_type: 'bookkeeping', period_start: '', period_end: '', due_date: '', assigned_to: '', hours_budget: '', fee: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.client_id) return;
    setSaving(true);
    try {
      await fetch('/api/admin/accounting-firm/engagements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, hours_budget: form.hours_budget ? parseFloat(form.hours_budget) : null, fee: form.fee ? parseFloat(form.fee) : null }) });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
        <h2 className="text-lg font-bold mb-4 text-slate-800">New Engagement</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs text-gray-500">Client *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.client_id} onChange={e => f('client_id', e.target.value)}>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Engagement Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.engagement_type} onChange={e => f('engagement_type', e.target.value)}>{ENGAGEMENT_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Period Start</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.period_start} onChange={e => f('period_start', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Period End</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.period_end} onChange={e => f('period_end', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Due Date</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.due_date} onChange={e => f('due_date', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Assigned To</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.assigned_to} onChange={e => f('assigned_to', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Budget Hours</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.hours_budget} onChange={e => f('hours_budget', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Fee (CAD)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.fee} onChange={e => f('fee', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.notes} onChange={e => f('notes', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-1.5 rounded border text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-1.5 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Create'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard Tab ─────────────────────────────────────────────────────────────
function DashboardTab() {
  const [data, setData] = useState<{ mrr: number; clientTypes: { client_type: string; cnt: number }[]; engagementsDue: number; overdue: number; wipValue: number } | null>(null);
  useEffect(() => { fetch('/api/admin/accounting-firm?mode=dashboard').then(r => r.json()).then(setData); }, []);
  if (!data) return <div className="p-8 text-center text-gray-400">Loading dashboard…</div>;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Monthly Recurring Revenue" value={fmtCad(data.mrr)} sub="Active monthly retainers" color="green" />
        <KpiCard label="WIP Value (Unbilled)" value={fmtCad(data.wipValue)} sub="Unbilled time entries" color="blue" />
        <KpiCard label="Engagements Due (30d)" value={data.engagementsDue} color="amber" />
        <KpiCard label="Overdue Engagements" value={data.overdue} color="red" />
      </div>
      <div className="bg-white rounded-xl border p-4">
        <h3 className="font-semibold text-slate-700 mb-3">Clients by Type</h3>
        <div className="flex flex-wrap gap-3">
          {data.clientTypes.map(ct => (
            <div key={ct.client_type} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border">
              <Badge label={ct.client_type} color={clientTypeColor(ct.client_type)} />
              <span className="font-bold text-gray-700">{ct.cnt}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Clients Tab ──────────────────────────────────────────────────────────────
function ClientsTab() {
  const [clients, setClients] = useState<AccountingClient[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const load = useCallback(() => fetch('/api/admin/accounting-firm').then(r => r.json()).then(d => setClients(d.clients ?? [])), []);
  useEffect(() => { load(); }, [load]);
  return (
    <div>
      {showAdd && <AddClientModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-slate-700">All Clients ({clients.length})</h3>
        <button onClick={() => setShowAdd(true)} className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 font-medium">+ Add Client</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead><tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">{['Client','Type','City','Services','Software','Engagement','Monthly Fee','Hourly Rate','CPA','Status'].map(h => <th key={h} className="px-3 py-2 border-b">{h}</th>)}</tr></thead>
          <tbody>
            {clients.map(c => (
              <tr key={c.id} className="border-b hover:bg-gray-50">
                <td className="px-3 py-2 font-medium text-gray-900">{c.name}<br /><span className="text-xs text-gray-400">{c.email}</span></td>
                <td className="px-3 py-2"><Badge label={c.client_type} color={clientTypeColor(c.client_type)} /></td>
                <td className="px-3 py-2 text-gray-600">{c.city}, {c.province}</td>
                <td className="px-3 py-2"><div className="flex flex-wrap gap-1">{(c.services ?? []).slice(0, 3).map((s: string) => <Badge key={s} label={s} />)}{(c.services ?? []).length > 3 && <Badge label={`+${(c.services ?? []).length - 3}`} />}</div></td>
                <td className="px-3 py-2 text-gray-500">{c.software}</td>
                <td className="px-3 py-2 text-gray-500">{c.engagement_type?.replace(/_/g, ' ')}</td>
                <td className="px-3 py-2 text-gray-700">{c.monthly_fee ? fmtCad(c.monthly_fee) : '—'}</td>
                <td className="px-3 py-2 text-gray-700">{c.hourly_rate ? `$${c.hourly_rate}/hr` : '—'}</td>
                <td className="px-3 py-2 text-gray-500 text-xs">{c.assigned_cpa}</td>
                <td className="px-3 py-2"><Badge label={c.status} color={c.status === 'active' ? 'green' : 'gray'} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Engagements / Work Queue Tab ─────────────────────────────────────────────
function EngagementsTab({ clients }: { clients: AccountingClient[] }) {
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const load = useCallback(() => fetch('/api/admin/accounting-firm/engagements').then(r => r.json()).then(d => setEngagements(d.engagements ?? [])), []);
  useEffect(() => { load(); }, [load]);

  async function advance(id: number, next: string) {
    await fetch(`/api/admin/accounting-firm/engagements/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: next }) });
    load();
  }
  async function complete(id: number) {
    await fetch(`/api/admin/accounting-firm/engagements/${id}/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    load();
  }

  const byStatus = (s: string) => engagements.filter(e => e.status === s);
  const nextStatus: Record<string, string> = { not_started: 'in_progress', in_progress: 'review', review: 'completed', completed: 'filed', filed: 'billed' };
  const nextLabel: Record<string, string> = { not_started: 'Start', in_progress: 'Send to Review', review: 'Mark Complete', completed: 'Mark Filed', filed: 'Mark Billed' };

  return (
    <div>
      {showAdd && <AddEngagementModal clients={clients} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-slate-700">Work Queue — Kanban</h3>
        <button onClick={() => setShowAdd(true)} className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 font-medium">+ New Engagement</button>
      </div>
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3 overflow-x-auto">
        {ENGAGEMENT_STATUSES.map(st => (
          <div key={st} className="min-w-[160px]">
            <div className={`text-xs font-semibold uppercase tracking-wide mb-2 px-2 py-1 rounded`}>
              <Badge label={st.replace(/_/g, ' ')} color={statusColor(st)} />
              <span className="ml-1 text-gray-500 text-xs">({byStatus(st).length})</span>
            </div>
            <div className="space-y-2">
              {byStatus(st).map(e => {
                const overdue = e.due_date && new Date(e.due_date) < new Date() && !['completed','filed','billed'].includes(e.status);
                const hoursOver = e.hours_actual > e.hours_budget;
                return (
                  <div key={e.id} className={`bg-white border rounded-lg p-2 shadow-sm text-xs ${overdue ? 'border-red-300' : ''}`}>
                    <div className="font-medium text-gray-800 truncate">{e.client_name}</div>
                    <div className="text-gray-500 capitalize mt-0.5">{e.engagement_type.replace(/_/g, ' ')}</div>
                    <div className={`mt-1 ${overdue ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>Due: {fmtDate(e.due_date)}</div>
                    {e.hours_budget > 0 && <div className={`mt-0.5 ${hoursOver ? 'text-red-600' : 'text-gray-400'}`}>{e.hours_actual}h / {e.hours_budget}h</div>}
                    {e.fee > 0 && <div className="text-gray-600 font-medium mt-0.5">{fmtCad(e.fee)}</div>}
                    {nextStatus[st] && (
                      <button onClick={() => st === 'review' ? complete(e.id) : advance(e.id, nextStatus[st])} className="mt-1.5 w-full text-center py-0.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">
                        {nextLabel[st]}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Time Tracking Tab ────────────────────────────────────────────────────────
function TimeTab({ clients }: { clients: AccountingClient[] }) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [form, setForm] = useState({ client_id: clients[0]?.id?.toString() ?? '', engagement_id: '', date: new Date().toISOString().slice(0, 10), staff_name: '', description: '', hours: '', rate: '185', billable: true });
  const [wip, setWip] = useState<{ wip: { client_name: string; total_hours: number; wip_value: number }[]; total: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));

  const loadEntries = useCallback(() => fetch('/api/admin/accounting-firm/time').then(r => r.json()).then(d => setEntries(d.entries ?? [])), []);
  const loadWip = useCallback(() => fetch('/api/admin/accounting-firm/wip').then(r => r.json()).then(setWip), []);
  useEffect(() => { loadEntries(); loadWip(); }, [loadEntries, loadWip]);

  async function logTime() {
    if (!form.description || !form.hours) return;
    setSaving(true);
    try {
      await fetch('/api/admin/accounting-firm/time', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, hours: parseFloat(form.hours), rate: parseFloat(form.rate) }) });
      setForm(p => ({ ...p, description: '', hours: '' }));
      loadEntries(); loadWip();
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Log Time Form */}
        <div className="bg-white rounded-xl border p-4">
          <h3 className="font-semibold text-slate-700 mb-3">Log Time</h3>
          <div className="space-y-2">
            <div><label className="text-xs text-gray-500">Client</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.client_id} onChange={e => f('client_id', e.target.value)}>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div><label className="text-xs text-gray-500">Date</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.date} onChange={e => f('date', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Staff Name</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.staff_name} onChange={e => f('staff_name', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Description *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.description} onChange={e => f('description', e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-xs text-gray-500">Hours *</label><input type="number" step="0.25" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.hours} onChange={e => f('hours', e.target.value)} /></div>
              <div><label className="text-xs text-gray-500">Rate ($/hr)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.rate} onChange={e => f('rate', e.target.value)} /></div>
            </div>
            <div className="flex items-center gap-2"><input type="checkbox" id="billable" checked={form.billable} onChange={e => f('billable', e.target.checked)} /><label htmlFor="billable" className="text-sm text-gray-600">Billable</label></div>
            <button onClick={logTime} disabled={saving || !form.description || !form.hours} className="w-full py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Log Time'}</button>
          </div>
        </div>
        {/* WIP Summary */}
        <div className="bg-white rounded-xl border p-4">
          <h3 className="font-semibold text-slate-700 mb-1">Work in Progress</h3>
          <p className="text-sm text-gray-400 mb-3">Unbilled billable time</p>
          {wip && (
            <>
              <div className="text-2xl font-bold text-blue-600 mb-3">{fmtCad(wip.total)} total</div>
              <div className="space-y-2">
                {wip.wip.map((w, i) => (
                  <div key={i} className="flex justify-between items-center text-sm border-b pb-1">
                    <span className="text-gray-700">{w.client_name}</span>
                    <span className="text-gray-500">{Number(w.total_hours).toFixed(1)}h</span>
                    <span className="font-medium text-gray-800">{fmtCad(Number(w.wip_value))}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      {/* Recent Entries */}
      <div className="bg-white rounded-xl border p-4">
        <h3 className="font-semibold text-slate-700 mb-3">Recent Time Entries</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead><tr className="bg-gray-50 text-xs text-gray-500 uppercase">{['Date','Client','Staff','Description','Hours','Rate','Billable','Billed'].map(h => <th key={h} className="px-3 py-1.5 text-left border-b">{h}</th>)}</tr></thead>
            <tbody>{entries.slice(0, 20).map(e => (
              <tr key={e.id} className="border-b hover:bg-gray-50">
                <td className="px-3 py-1.5 text-gray-500">{fmtDate(e.date)}</td>
                <td className="px-3 py-1.5 font-medium">{e.client_name}</td>
                <td className="px-3 py-1.5 text-gray-500">{e.staff_name}</td>
                <td className="px-3 py-1.5 text-gray-700 max-w-xs truncate">{e.description}</td>
                <td className="px-3 py-1.5 font-medium">{e.hours}h</td>
                <td className="px-3 py-1.5 text-gray-500">{e.rate ? `$${e.rate}/hr` : '—'}</td>
                <td className="px-3 py-1.5">{e.billable ? <Badge label="Billable" color="green" /> : <Badge label="Non-Bill" />}</td>
                <td className="px-3 py-1.5">{e.billed ? <Badge label="Billed" color="teal" /> : <Badge label="Unbilled" color="amber" />}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── AI Studio Tab ────────────────────────────────────────────────────────────
function AITab() {
  const [memoType, setMemoType] = useState('management_letter');
  const [clientInfo, setClientInfo] = useState('');
  const [financialData, setFinancialData] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [fallback, setFallback] = useState(false);

  async function generate() {
    if (!clientInfo) return;
    setLoading(true); setResult('');
    try {
      const res = await fetch('/api/admin/accounting-firm/ai-memo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memo_type: memoType, client_info: clientInfo, financial_data: financialData }) });
      const data = await res.json();
      setResult(data.memo ?? ''); setFallback(data.fallback ?? false);
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border p-4">
        <h3 className="font-semibold text-slate-700 mb-1">AI Accounting Memo Drafting</h3>
        <p className="text-xs text-gray-400 mb-3">Powered by local Ollama — draft professional CPA communications. Always review with a licensed CPA before issuance.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div><label className="text-xs text-gray-500">Memo Type</label>
              <select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={memoType} onChange={e => setMemoType(e.target.value)}>
                {MEMO_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
              </select>
            </div>
            <div><label className="text-xs text-gray-500">Client Situation / Information *</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={5} placeholder="e.g. Corporate client, Prairie Grains Ltd., fiscal year end Dec 31, $8.5M revenue, agriculture industry, using QuickBooks. Key issues: inventory valuation, related-party transactions." value={clientInfo} onChange={e => setClientInfo(e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Financial Data / Context (optional)</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={3} placeholder="Revenue, key accounts, tax positions, prior year issues…" value={financialData} onChange={e => setFinancialData(e.target.value)} /></div>
            <button onClick={generate} disabled={loading || !clientInfo} className="w-full py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:opacity-50">{loading ? 'Drafting with Ollama…' : 'Draft Memo'}</button>
          </div>
          <div>
            <label className="text-xs text-gray-500">Generated Draft {fallback && <span className="text-amber-600">(AI fallback)</span>}</label>
            <div className="mt-0.5 border rounded p-3 bg-gray-50 min-h-[300px] text-sm font-mono whitespace-pre-wrap text-gray-700">{result || (loading ? 'Generating…' : 'Draft will appear here…')}</div>
            {result && (
              <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
                DISCLAIMER: This AI-generated draft is for professional CPA review only. It must be reviewed, verified, and approved by a licensed Chartered Professional Accountant before issuance to any client.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AccountingFirmPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [clients, setClients] = useState<AccountingClient[]>([]);
  useEffect(() => { fetch('/api/admin/accounting-firm').then(r => r.json()).then(d => setClients(d.clients ?? [])); }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-slate-800 text-white px-6 py-4">
        <h1 className="text-xl font-bold">Accounting Firm Portal</h1>
        <p className="text-slate-300 text-sm mt-0.5">Canadian CPA Practice — Bookkeeping, Payroll, Tax, Audit & Advisory</p>
      </div>
      <div className="bg-white border-b px-6">
        <nav className="flex gap-1 pt-2">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2.5 text-sm font-medium rounded-t border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-700 bg-blue-50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {TAB_LABELS[t]}
            </button>
          ))}
        </nav>
      </div>
      <div className="p-6">
        {tab === 'dashboard' && <DashboardTab />}
        {tab === 'clients' && <ClientsTab />}
        {tab === 'engagements' && <EngagementsTab clients={clients} />}
        {tab === 'time' && <TimeTab clients={clients} />}
        {tab === 'ai' && <AITab />}
      </div>
    </div>
  );
}
