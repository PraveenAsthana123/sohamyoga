'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard', 'clients', 'matters', 'time', 'deadlines', 'ai', 'billing'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = {
  dashboard: 'Dashboard', clients: 'Clients', matters: 'Matters',
  time: 'Time Tracking', deadlines: 'Deadlines', ai: 'AI Document Studio', billing: 'Billing',
};

const MATTER_TYPES = ['corporate', 'litigation', 'real_estate', 'employment', 'immigration', 'family', 'estate', 'ip', 'criminal', 'regulatory'];
const MATTER_STATUSES = ['intake', 'active', 'discovery', 'negotiation', 'pending_court', 'closed', 'on_hold'];
const DEADLINE_TYPES = ['limitation', 'court', 'filing', 'discovery', 'response', 'hearing', 'other'];
const DOC_TYPES = ['retainer_agreement', 'demand_letter', 'statement_of_claim', 'affidavit', 'nda', 'shareholder_agreement', 'will', 'powers_of_attorney', 'separation_agreement', 'employment_contract'];

interface LegalClient {
  id: number; name: string; email: string; phone: string; city: string; province: string;
  matter_type: string; conflict_checked: boolean; retainer_balance: number; hourly_rate: number;
  source: string; status: string;
}
interface Matter {
  id: number; matter_number: string; client_id: number; client_name: string; type: string;
  assigned_lawyer: string; status: string; hours_budget: number; hours_actual: number;
  deadline_count: number; retainer_balance: number; description: string; opened_date: string;
}
interface TimeEntry {
  id: number; matter_id: number; matter_number: string; client_name: string;
  date: string; description: string; hours: number; rate: number; billed: boolean;
}
interface Deadline {
  id: number; matter_id: number; matter_number: string; client_name: string;
  type: string; due_date: string; description: string; completed: boolean;
}

function fmtCad(n: number) { return `$${Number(n ?? 0).toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`; }
function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString('en-CA') : '—'; }
function daysUntil(d: string) { return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000); }

function Badge({ label, color = 'gray' }: { label: string; color?: string }) {
  const map: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-700', green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700',
    purple: 'bg-purple-100 text-purple-700', gray: 'bg-gray-100 text-gray-700',
    teal: 'bg-teal-100 text-teal-700', orange: 'bg-orange-100 text-orange-700',
  };
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${map[color] ?? map.gray}`}>{label}</span>;
}

function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const borders: Record<string, string> = {
    blue: 'border-l-4 border-blue-500 bg-blue-50', green: 'border-l-4 border-green-500 bg-green-50',
    amber: 'border-l-4 border-amber-500 bg-amber-50', red: 'border-l-4 border-red-500 bg-red-50',
    purple: 'border-l-4 border-purple-500 bg-purple-50',
  };
  return (
    <div className={`rounded-lg p-4 ${borders[color] ?? borders.blue}`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function matterStatusColor(s: string) {
  const m: Record<string, string> = { intake: 'gray', active: 'blue', discovery: 'purple', negotiation: 'amber', pending_court: 'orange', closed: 'green', on_hold: 'red' };
  return m[s] ?? 'gray';
}
function matterTypeColor(t: string) {
  const m: Record<string, string> = { corporate: 'blue', litigation: 'red', real_estate: 'teal', employment: 'green', immigration: 'purple', family: 'amber', estate: 'orange', ip: 'teal' };
  return m[t] ?? 'gray';
}
function deadlineTypeColor(t: string) {
  const m: Record<string, string> = { limitation: 'red', court: 'orange', filing: 'amber', discovery: 'purple', response: 'blue', hearing: 'teal' };
  return m[t] ?? 'gray';
}

// ─── Add Client Modal ─────────────────────────────────────────────────────────
function AddClientModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', city: 'Calgary', province: 'AB', matter_type: 'corporate', retainer: '', hourly_rate: '350', source: 'referral', conflict_checked: false });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));

  async function save() {
    setSaving(true);
    await fetch('/api/admin/legal-services/clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setSaving(false); onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b"><h2 className="text-lg font-bold">Add Client</h2></div>
        <div className="p-6 grid grid-cols-2 gap-4">
          {[['name','Client Name','text'],['email','Email','email'],['phone','Phone','text'],['city','City','text']].map(([k,l,t]) => (
            <div key={k}><label className="text-xs text-gray-500">{l}</label>
              <input type={t} className="w-full border rounded px-3 py-2 mt-1 text-sm" value={(form as unknown as Record<string,string>)[k]} onChange={e => set(k, e.target.value)} /></div>
          ))}
          <div><label className="text-xs text-gray-500">Province</label>
            <select className="w-full border rounded px-3 py-2 mt-1 text-sm" value={form.province} onChange={e => set('province', e.target.value)}>
              {['AB','BC','ON','QC','SK','MB','NS','NB','NL','PE'].map(p => <option key={p}>{p}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Matter Type</label>
            <select className="w-full border rounded px-3 py-2 mt-1 text-sm" value={form.matter_type} onChange={e => set('matter_type', e.target.value)}>
              {MATTER_TYPES.map(t => <option key={t}>{t.replace('_',' ')}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Retainer ($)</label>
            <input type="number" className="w-full border rounded px-3 py-2 mt-1 text-sm" value={form.retainer} onChange={e => set('retainer', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Hourly Rate</label>
            <input type="number" className="w-full border rounded px-3 py-2 mt-1 text-sm" value={form.hourly_rate} onChange={e => set('hourly_rate', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Source</label>
            <select className="w-full border rounded px-3 py-2 mt-1 text-sm" value={form.source} onChange={e => set('source', e.target.value)}>
              {['referral','website','cold_outreach','existing_client','advertising'].map(s => <option key={s}>{s.replace('_',' ')}</option>)}</select></div>
          <div className="col-span-2 flex items-center gap-2">
            <input type="checkbox" id="cc" checked={form.conflict_checked} onChange={e => set('conflict_checked', e.target.checked)} />
            <label htmlFor="cc" className="text-sm">Conflict check completed</label></div>
        </div>
        <div className="p-6 border-t flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded border text-sm">Cancel</button>
          <button onClick={save} disabled={saving || !form.name} className="px-4 py-2 rounded bg-blue-700 text-white text-sm disabled:opacity-50">{saving ? 'Saving…' : 'Add Client'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard Tab ────────────────────────────────────────────────────────────
function DashboardTab({ clients, matters, timeEntries }: { clients: LegalClient[]; matters: Matter[]; timeEntries: TimeEntry[] }) {
  const openMatters = matters.filter(m => m.status !== 'closed');
  const wipValue = timeEntries.filter(e => !e.billed).reduce((s, e) => s + e.hours * e.rate, 0);
  const unbilled = wipValue;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Open Matters" value={openMatters.length} color="blue" />
        <KpiCard label="WIP Value" value={fmtCad(wipValue)} color="purple" />
        <KpiCard label="Clients" value={clients.length} color="green" />
        <KpiCard label="Unbilled Total" value={fmtCad(unbilled)} color="amber" />
      </div>
      <div className="bg-white border rounded-xl p-5">
        <h3 className="font-semibold mb-3">Open Matters</h3>
        <div className="space-y-2">
          {openMatters.slice(0, 8).map(m => (
            <div key={m.id} className="flex items-center justify-between py-2 border-b last:border-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{m.matter_number}</span>
                <span className="text-gray-500 text-sm">· {m.client_name}</span>
                <Badge label={m.type.replace('_',' ')} color={matterTypeColor(m.type)} />
              </div>
              <Badge label={m.status.replace('_',' ')} color={matterStatusColor(m.status)} />
            </div>
          ))}
          {openMatters.length === 0 && <p className="text-sm text-gray-400">No open matters</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Clients Tab ──────────────────────────────────────────────────────────────
function ClientsTab({ clients, onRefresh }: { clients: LegalClient[]; onRefresh: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-gray-700">{clients.length} Clients</h3>
        <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-blue-700 text-white rounded-lg text-sm">+ Add Client</button>
      </div>
      <div className="overflow-x-auto bg-white border rounded-xl">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>{['Name','Matter Type','Conflict','Retainer','Source','Status'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {clients.map(c => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{c.name}<div className="text-xs text-gray-400">{c.email}</div></td>
                <td className="px-4 py-3"><Badge label={(c.matter_type ?? '').replace('_',' ')} color={matterTypeColor(c.matter_type)} /></td>
                <td className="px-4 py-3 text-center">{c.conflict_checked ? <span className="text-green-600 font-bold">✓</span> : <span className="text-red-400">✗</span>}</td>
                <td className="px-4 py-3 font-medium">{fmtCad(c.retainer_balance)}</td>
                <td className="px-4 py-3 text-gray-500 capitalize">{(c.source ?? '').replace('_',' ')}</td>
                <td className="px-4 py-3"><Badge label={c.status ?? 'active'} color={c.status === 'active' ? 'green' : 'gray'} /></td>
              </tr>
            ))}
            {clients.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No clients yet</td></tr>}
          </tbody>
        </table>
      </div>
      {showAdd && <AddClientModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); onRefresh(); }} />}
    </div>
  );
}

// ─── Matters Tab ──────────────────────────────────────────────────────────────
function MattersTab({ clients, matters, onRefresh }: { clients: LegalClient[]; matters: Matter[]; onRefresh: () => void }) {
  const [showNew, setShowNew] = useState(false);
  const [filter, setFilter] = useState('all');
  const [newForm, setNewForm] = useState({ client_id: '', type: 'corporate', assigned_lawyer: '', hours_budget: '40', description: '' });
  const [saving, setSaving] = useState(false);
  const filtered = filter === 'all' ? matters : matters.filter(m => m.status === filter);

  async function createMatter() {
    setSaving(true);
    await fetch('/api/admin/legal-services/matters', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newForm) });
    setSaving(false); setShowNew(false); onRefresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2 flex-wrap">
          {['all', ...MATTER_STATUSES].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${filter === s ? 'bg-blue-700 text-white border-blue-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
              {s === 'all' ? 'All' : s.replace('_',' ')}
            </button>
          ))}
        </div>
        <button onClick={() => setShowNew(true)} className="px-4 py-2 bg-blue-700 text-white rounded-lg text-sm">+ New Matter</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(m => {
          const pct = m.hours_budget > 0 ? Math.min(100, Math.round((m.hours_actual / m.hours_budget) * 100)) : 0;
          return (
            <div key={m.id} className="bg-white border rounded-xl p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div><div className="font-semibold text-sm">{m.matter_number}</div><div className="text-gray-500 text-xs mt-0.5">{m.client_name}</div></div>
                <Badge label={m.status.replace('_',' ')} color={matterStatusColor(m.status)} />
              </div>
              <div className="flex gap-2 flex-wrap">
                <Badge label={m.type.replace('_',' ')} color={matterTypeColor(m.type)} />
                {m.assigned_lawyer && <span className="text-xs text-gray-500">{m.assigned_lawyer}</span>}
              </div>
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1"><span>Hours: {m.hours_actual} / {m.hours_budget}</span><span>{pct}%</span></div>
                <div className="bg-gray-100 rounded-full h-2">
                  <div className={`h-2 rounded-full ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
              {(m.deadline_count ?? 0) > 0 && <div className="text-xs text-orange-600 font-medium">{m.deadline_count} deadline{m.deadline_count !== 1 ? 's' : ''}</div>}
            </div>
          );
        })}
        {filtered.length === 0 && <div className="col-span-3 text-center py-8 text-gray-400">No matters found</div>}
      </div>
      {showNew && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b"><h2 className="text-lg font-bold">New Matter</h2></div>
            <div className="p-6 space-y-3">
              <div><label className="text-xs text-gray-500">Client</label>
                <select className="w-full border rounded px-3 py-2 mt-1 text-sm" value={newForm.client_id} onChange={e => setNewForm(f => ({ ...f, client_id: e.target.value }))}>
                  <option value="">Select client…</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div><label className="text-xs text-gray-500">Type</label>
                <select className="w-full border rounded px-3 py-2 mt-1 text-sm" value={newForm.type} onChange={e => setNewForm(f => ({ ...f, type: e.target.value }))}>
                  {MATTER_TYPES.map(t => <option key={t}>{t.replace('_',' ')}</option>)}</select></div>
              <div><label className="text-xs text-gray-500">Assigned Lawyer</label>
                <input type="text" className="w-full border rounded px-3 py-2 mt-1 text-sm" value={newForm.assigned_lawyer} onChange={e => setNewForm(f => ({ ...f, assigned_lawyer: e.target.value }))} /></div>
              <div><label className="text-xs text-gray-500">Hours Budget</label>
                <input type="number" className="w-full border rounded px-3 py-2 mt-1 text-sm" value={newForm.hours_budget} onChange={e => setNewForm(f => ({ ...f, hours_budget: e.target.value }))} /></div>
              <div><label className="text-xs text-gray-500">Description</label>
                <textarea rows={3} className="w-full border rounded px-3 py-2 mt-1 text-sm" value={newForm.description} onChange={e => setNewForm(f => ({ ...f, description: e.target.value }))} /></div>
            </div>
            <div className="p-6 border-t flex gap-3 justify-end">
              <button onClick={() => setShowNew(false)} className="px-4 py-2 rounded border text-sm">Cancel</button>
              <button onClick={createMatter} disabled={saving || !newForm.client_id} className="px-4 py-2 rounded bg-blue-700 text-white text-sm disabled:opacity-50">{saving ? 'Saving…' : 'Create Matter'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Time Tracking Tab ────────────────────────────────────────────────────────
function TimeTab({ matters }: { matters: Matter[] }) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [selectedMatterId, setSelectedMatterId] = useState<number | null>(matters[0]?.id ?? null);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), description: '', hours: '', rate: '350' });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchEntries = useCallback(async (id: number) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/legal-services/time?matter_id=${id}`);
      const d = await r.json();
      setEntries(d.entries ?? []);
    } catch { setEntries([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (selectedMatterId) fetchEntries(selectedMatterId); }, [selectedMatterId, fetchEntries]);

  const unbilled = entries.filter(e => !e.billed).reduce((s, e) => s + e.hours * e.rate, 0);

  async function logTime() {
    if (!selectedMatterId) return;
    setSaving(true);
    await fetch('/api/admin/legal-services/time', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, matter_id: selectedMatterId }) });
    setSaving(false);
    setForm({ date: new Date().toISOString().slice(0, 10), description: '', hours: '', rate: '350' });
    fetchEntries(selectedMatterId);
  }

  async function generateInvoice() {
    await fetch('/api/admin/legal-services/invoices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ matter_id: selectedMatterId, entry_ids: entries.filter(e => !e.billed).map(e => e.id) }) });
    if (selectedMatterId) fetchEntries(selectedMatterId);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <select className="border rounded-lg px-3 py-2 text-sm" value={selectedMatterId ?? ''} onChange={e => setSelectedMatterId(Number(e.target.value))}>
          {matters.map(m => <option key={m.id} value={m.id}>{m.matter_number} — {m.client_name}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm font-medium">Unbilled: <strong className="text-amber-600">{fmtCad(unbilled)}</strong></span>
          <button onClick={generateInvoice} disabled={unbilled === 0} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm disabled:opacity-40">Generate Invoice</button>
        </div>
      </div>
      <div className="bg-white border rounded-xl p-5">
        <h4 className="font-semibold mb-4 text-sm">Log Time</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><label className="text-xs text-gray-500">Date</label>
            <input type="date" className="w-full border rounded px-3 py-2 mt-1 text-sm" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Description</label>
            <input type="text" className="w-full border rounded px-3 py-2 mt-1 text-sm" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
          <div><label className="text-xs text-gray-500">Hours</label>
            <input type="number" step="0.25" className="w-full border rounded px-3 py-2 mt-1 text-sm" value={form.hours} onChange={e => setForm(f => ({ ...f, hours: e.target.value }))} /></div>
          <div><label className="text-xs text-gray-500">Rate ($/hr)</label>
            <input type="number" className="w-full border rounded px-3 py-2 mt-1 text-sm" value={form.rate} onChange={e => setForm(f => ({ ...f, rate: e.target.value }))} /></div>
        </div>
        <button onClick={logTime} disabled={saving || !form.description || !form.hours}
          className="mt-4 px-4 py-2 bg-blue-700 text-white rounded-lg text-sm disabled:opacity-50">{saving ? 'Saving…' : 'Log Time'}</button>
      </div>
      {loading ? <div className="text-center py-6 text-gray-400">Loading…</div> : (
        <div className="overflow-x-auto bg-white border rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>{['Date','Description','Hours','Rate','Amount','Status'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y">
              {entries.map(e => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{fmtDate(e.date)}</td>
                  <td className="px-4 py-3">{e.description}</td>
                  <td className="px-4 py-3">{e.hours}h</td>
                  <td className="px-4 py-3">{fmtCad(e.rate)}/hr</td>
                  <td className="px-4 py-3 font-medium">{fmtCad(e.hours * e.rate)}</td>
                  <td className="px-4 py-3"><Badge label={e.billed ? 'billed' : 'unbilled'} color={e.billed ? 'green' : 'amber'} /></td>
                </tr>
              ))}
              {entries.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No time entries</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Deadlines Tab ────────────────────────────────────────────────────────────
function DeadlinesTab({ matters }: { matters: Matter[] }) {
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ matter_id: String(matters[0]?.id ?? ''), type: 'filing', due_date: '', description: '' });

  const fetchDeadlines = useCallback(async () => {
    setLoading(true);
    try { const r = await fetch('/api/admin/legal-services/deadlines'); const d = await r.json(); setDeadlines(d.deadlines ?? []); }
    catch { setDeadlines([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchDeadlines(); }, [fetchDeadlines]);

  async function markComplete(id: number) {
    await fetch(`/api/admin/legal-services/deadlines/${id}/complete`, { method: 'POST' });
    fetchDeadlines();
  }
  async function addDeadline() {
    await fetch('/api/admin/legal-services/deadlines', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(addForm) });
    setShowAdd(false); fetchDeadlines();
  }

  const pending = deadlines.filter(d => !d.completed).sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">{pending.length} Pending Deadlines</h3>
        <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-blue-700 text-white rounded-lg text-sm">+ Add Deadline</button>
      </div>
      {loading ? <div className="text-center py-8 text-gray-400">Loading…</div> : (
        <div className="space-y-2">
          {pending.map(d => {
            const days = daysUntil(d.due_date);
            const urgencyBg = days <= 7 ? 'bg-red-50 border-red-200' : days <= 14 ? 'bg-orange-50 border-orange-200' : days <= 30 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200';
            const dayLabel = days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'TODAY' : `${days}d`;
            const dayColor = days <= 0 ? 'text-red-700 font-bold' : days <= 7 ? 'text-red-600 font-semibold' : days <= 14 ? 'text-orange-600' : 'text-gray-500';
            return (
              <div key={d.id} className={`flex items-center justify-between p-4 border rounded-xl ${urgencyBg}`}>
                <div className="flex items-center gap-3">
                  <Badge label={d.type} color={deadlineTypeColor(d.type)} />
                  <div><div className="text-sm font-medium">{d.description}</div><div className="text-xs text-gray-500">{d.matter_number} · {d.client_name}</div></div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right"><div className="text-sm text-gray-700">{fmtDate(d.due_date)}</div><div className={`text-xs ${dayColor}`}>{dayLabel}</div></div>
                  <button onClick={() => markComplete(d.id)} className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg">Mark Complete</button>
                </div>
              </div>
            );
          })}
          {pending.length === 0 && <div className="text-center py-8 text-gray-400">No pending deadlines</div>}
        </div>
      )}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b"><h2 className="text-lg font-bold">Add Deadline</h2></div>
            <div className="p-6 space-y-3">
              <div><label className="text-xs text-gray-500">Matter</label>
                <select className="w-full border rounded px-3 py-2 mt-1 text-sm" value={addForm.matter_id} onChange={e => setAddForm(f => ({ ...f, matter_id: e.target.value }))}>
                  {matters.map(m => <option key={m.id} value={m.id}>{m.matter_number} — {m.client_name}</option>)}</select></div>
              <div><label className="text-xs text-gray-500">Type</label>
                <select className="w-full border rounded px-3 py-2 mt-1 text-sm" value={addForm.type} onChange={e => setAddForm(f => ({ ...f, type: e.target.value }))}>
                  {DEADLINE_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
              <div><label className="text-xs text-gray-500">Due Date</label>
                <input type="date" className="w-full border rounded px-3 py-2 mt-1 text-sm" value={addForm.due_date} onChange={e => setAddForm(f => ({ ...f, due_date: e.target.value }))} /></div>
              <div><label className="text-xs text-gray-500">Description</label>
                <input type="text" className="w-full border rounded px-3 py-2 mt-1 text-sm" value={addForm.description} onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))} /></div>
            </div>
            <div className="p-6 border-t flex gap-3 justify-end">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded border text-sm">Cancel</button>
              <button onClick={addDeadline} disabled={!addForm.due_date} className="px-4 py-2 rounded bg-blue-700 text-white text-sm disabled:opacity-50">Add Deadline</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── AI Document Studio Tab ───────────────────────────────────────────────────
function AITab() {
  const [matterType, setMatterType] = useState('corporate');
  const [docType, setDocType] = useState('retainer_agreement');
  const [details, setDetails] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true); setResult('');
    try {
      const r = await fetch('/api/admin/legal-services/ai-document', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ matter_type: matterType, document_type: docType, details }) });
      const d = await r.json();
      setResult(d.result ?? d.content ?? JSON.stringify(d));
    } catch (e) { setResult(String(e)); }
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div className="bg-red-50 border border-red-300 rounded-xl p-4">
        <p className="text-red-800 text-sm font-bold">DISCLAIMER — NOT LEGAL ADVICE</p>
        <p className="text-red-700 text-xs mt-1">AI-generated content is a draft only. All documents must be reviewed and approved by a licensed lawyer (LSA/LSO member) before any use. Do not rely on these drafts for any legal purpose whatsoever.</p>
      </div>
      <div className="bg-white border rounded-xl p-6 space-y-4">
        <h3 className="font-semibold">Generate Legal Document Draft</h3>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="text-xs text-gray-500">Matter Type</label>
            <select className="w-full border rounded px-3 py-2 mt-1 text-sm" value={matterType} onChange={e => setMatterType(e.target.value)}>
              {MATTER_TYPES.map(t => <option key={t} value={t}>{t.replace('_',' ')}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Document Type</label>
            <select className="w-full border rounded px-3 py-2 mt-1 text-sm" value={docType} onChange={e => setDocType(e.target.value)}>
              {DOC_TYPES.map(d => <option key={d} value={d}>{d.replace(/_/g,' ')}</option>)}</select></div>
        </div>
        <div><label className="text-xs text-gray-500">Client / Situation Details</label>
          <textarea rows={4} className="w-full border rounded px-3 py-2 mt-1 text-sm" value={details} onChange={e => setDetails(e.target.value)} placeholder="Describe parties, context, key clauses needed…" /></div>
        <button onClick={generate} disabled={loading || !details} className="px-6 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
          {loading ? 'Generating…' : 'Generate Draft'}</button>
      </div>
      {result && (
        <div className="bg-white border rounded-xl p-6">
          <h4 className="font-semibold mb-3 text-sm">Generated Draft</h4>
          <div className="bg-gray-50 rounded-lg p-4 text-sm whitespace-pre-wrap max-h-[500px] overflow-y-auto border">{result}</div>
        </div>
      )}
    </div>
  );
}

// ─── Billing Tab ──────────────────────────────────────────────────────────────
function BillingTab() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { const r = await fetch('/api/admin/legal-services/time?unbilled=true'); const d = await r.json(); setEntries(d.entries ?? []); }
      catch { setEntries([]); } finally { setLoading(false); }
    })();
  }, []);

  const byMatter = entries.reduce((acc, e) => {
    if (!acc[e.matter_number]) acc[e.matter_number] = { matter: e.matter_number, client: e.client_name, count: 0, total: 0 };
    acc[e.matter_number].count++; acc[e.matter_number].total += e.hours * e.rate;
    return acc;
  }, {} as Record<string, { matter: string; client: string; count: number; total: number }>);

  const totalUnbilled = entries.reduce((s, e) => s + e.hours * e.rate, 0);

  return (
    <div className="space-y-6">
      <KpiCard label="Total Unbilled" value={fmtCad(totalUnbilled)} color="amber" />
      {loading ? <div className="text-center py-8 text-gray-400">Loading…</div> : (
        <div className="space-y-3">
          {Object.values(byMatter).map(m => (
            <div key={m.matter} className="bg-white border rounded-xl p-5 flex items-center justify-between">
              <div><span className="font-semibold">{m.matter}</span><span className="text-gray-500 text-sm ml-2">· {m.client}</span><div className="text-xs text-gray-400 mt-0.5">{m.count} unbilled entries</div></div>
              <span className="font-bold text-amber-600 text-lg">{fmtCad(m.total)}</span>
            </div>
          ))}
          {Object.keys(byMatter).length === 0 && <div className="text-center py-8 text-gray-400">No unbilled time</div>}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function LegalServicesPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [clients, setClients] = useState<LegalClient[]>([]);
  const [matters, setMatters] = useState<Matter[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/legal-services');
      const d = await r.json();
      setClients(d.clients ?? []);
      setMatters(d.matters ?? []);
      setTimeEntries(d.time_entries ?? []);
    } catch { /* keep empty */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openMatters = matters.filter(m => m.status !== 'closed').length;
  const unbilled = timeEntries.filter(e => !e.billed).reduce((s, e) => s + e.hours * e.rate, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Legal Services</h1>
          <p className="text-sm text-gray-500">Client & matter management · Time tracking · AI document drafting</p>
        </div>
        <div className="flex gap-6">
          <div className="text-right"><div className="text-xl font-bold text-blue-700">{openMatters}</div><div className="text-xs text-gray-400">Open Matters</div></div>
          <div className="text-right"><div className="text-xl font-bold text-amber-600">{fmtCad(unbilled)}</div><div className="text-xs text-gray-400">Unbilled WIP</div></div>
        </div>
      </div>
      <div className="border-b bg-white">
        <div className="flex overflow-x-auto px-6">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab === t ? 'border-blue-700 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
      </div>
      <div className="p-6">
        {loading ? <div className="text-center py-12 text-gray-400">Loading…</div> : (
          <>
            {tab === 'dashboard' && <DashboardTab clients={clients} matters={matters} timeEntries={timeEntries} />}
            {tab === 'clients' && <ClientsTab clients={clients} onRefresh={fetchData} />}
            {tab === 'matters' && <MattersTab clients={clients} matters={matters} onRefresh={fetchData} />}
            {tab === 'time' && <TimeTab matters={matters} />}
            {tab === 'deadlines' && <DeadlinesTab matters={matters} />}
            {tab === 'ai' && <AITab />}
            {tab === 'billing' && <BillingTab />}
          </>
        )}
      </div>
    </div>
  );
}
