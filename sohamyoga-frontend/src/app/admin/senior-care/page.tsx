'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard','clients','caregivers','schedule','care-notes','ai-care-plan'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = { dashboard: 'Dashboard', clients: 'Clients', caregivers: 'Caregivers', schedule: 'Schedule', 'care-notes': 'Care Notes', 'ai-care-plan': 'AI Care Plan' };

const CARE_LEVELS = ['companion','personal_care','medical_support','dementia','palliative','respite'];
const CARE_TYPES = ['companion','personal_hygiene','medication_reminder','meal_prep','light_housekeeping','transportation','medical_escort','respite'];
const SCHEDULE_STATUSES = ['scheduled','confirmed','in_progress','completed','missed','cancelled'];
const MOODS = ['excellent','good','fair','poor','distressed'];
const APPETITE_OPTS = ['excellent','good','fair','poor','refused'];
const MOBILITY_OPTS = ['independent','assisted','limited','bed_bound'];
const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

interface DashData { active_clients: number; visits_today: number; missed_visits_mtd: number; caregivers_active: number; }
interface Client { id: number; first_name: string; last_name: string; date_of_birth: string; age: number; phone: string; care_level: string; primary_condition: string; emergency_contact_name: string; emergency_contact_phone: string; status: string; aish_recipient: boolean; alberta_seniors_benefit: boolean; }
interface Caregiver { id: number; first_name: string; last_name: string; email: string; phone: string; certification: string[]; languages: string[]; availability_days: string[]; status: string; hourly_rate: number; }
interface Visit { id: number; client_id: number; caregiver_id: number; client_first: string; client_last: string; cg_first: string; cg_last: string; care_level: string; visit_date: string; start_time: string; end_time: string; care_type: string; status: string; notes: string; }
interface CareNote { id: number; client_first: string; client_last: string; cg_first: string; cg_last: string; visit_date: string; mood: string; appetite: string; mobility: string; medications_taken: boolean; incidents: string; general_notes: string; }

function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString('en-CA') : '—'; }
function cap(s: string) { return s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : s; }

function Badge({ label, color = 'gray' }: { label: string; color?: string }) {
  const m: Record<string, string> = { blue: 'bg-blue-100 text-blue-700', green: 'bg-green-100 text-green-700', amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700', purple: 'bg-purple-100 text-purple-700', gray: 'bg-gray-100 text-gray-700', teal: 'bg-teal-100 text-teal-700', rose: 'bg-rose-100 text-rose-700' };
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${m[color] ?? m.gray}`}>{cap(label)}</span>;
}
function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const b: Record<string, string> = { blue: 'border-l-4 border-blue-500 bg-blue-50', green: 'border-l-4 border-green-500 bg-green-50', amber: 'border-l-4 border-amber-500 bg-amber-50', red: 'border-l-4 border-red-500 bg-red-50', purple: 'border-l-4 border-purple-500 bg-purple-50' };
  return <div className={`rounded-lg p-4 ${b[color] ?? b.blue}`}><p className="text-sm text-gray-500">{label}</p><p className="text-2xl font-bold mt-1">{value}</p>{sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}</div>;
}
function careLevelColor(l: string): string {
  const m: Record<string, string> = { companion: 'blue', personal_care: 'teal', medical_support: 'purple', dementia: 'amber', palliative: 'rose', respite: 'green' };
  return m[l] ?? 'gray';
}
function visitStatusColor(s: string): string {
  const m: Record<string, string> = { scheduled: 'blue', confirmed: 'teal', in_progress: 'amber', completed: 'green', missed: 'red', cancelled: 'gray' };
  return m[s] ?? 'gray';
}

// ── Add Client Modal ──────────────────────────────────────────────────────────
function AddClientModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', date_of_birth: '', phone: '', address: '', city: 'Calgary', province: 'AB', postal_code: '', care_level: 'companion', primary_condition: '', physician_name: '', physician_phone: '', emergency_contact_name: '', emergency_contact_phone: '', emergency_contact_relation: '', preferred_language: 'English', aish_recipient: false, alberta_seniors_benefit: false, notes: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.first_name || !form.last_name || !form.emergency_contact_name || !form.emergency_contact_phone) return;
    setSaving(true);
    try {
      await fetch('/api/admin/senior-care/clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-4 text-slate-800">Add Client</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500">First Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.first_name} onChange={e => f('first_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Last Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.last_name} onChange={e => f('last_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Date of Birth</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.date_of_birth} onChange={e => f('date_of_birth', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Phone</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.phone} onChange={e => f('phone', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Address</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.address} onChange={e => f('address', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">City</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.city} onChange={e => f('city', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Care Level</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.care_level} onChange={e => f('care_level', e.target.value)}>{CARE_LEVELS.map(l => <option key={l} value={l}>{cap(l)}</option>)}</select></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Primary Condition</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.primary_condition} onChange={e => f('primary_condition', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Physician Name</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.physician_name} onChange={e => f('physician_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Physician Phone</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.physician_phone} onChange={e => f('physician_phone', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Emergency Contact *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.emergency_contact_name} onChange={e => f('emergency_contact_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Emergency Phone *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.emergency_contact_phone} onChange={e => f('emergency_contact_phone', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Relation</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" placeholder="Daughter, Son, Spouse…" value={form.emergency_contact_relation} onChange={e => f('emergency_contact_relation', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Language</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.preferred_language} onChange={e => f('preferred_language', e.target.value)} /></div>
          <div className="flex items-center gap-2 mt-1"><input type="checkbox" id="aish" checked={form.aish_recipient} onChange={e => f('aish_recipient', e.target.checked)} /><label htmlFor="aish" className="text-sm">AISH Recipient</label></div>
          <div className="flex items-center gap-2 mt-1"><input type="checkbox" id="asb" checked={form.alberta_seniors_benefit} onChange={e => f('alberta_seniors_benefit', e.target.checked)} /><label htmlFor="asb" className="text-sm">Alberta Seniors Benefit</label></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.notes} onChange={e => f('notes', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded border text-sm">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 rounded bg-teal-600 text-white text-sm font-medium disabled:opacity-50">{saving ? 'Saving…' : 'Add Client'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Add Visit Modal ───────────────────────────────────────────────────────────
function AddVisitModal({ clients, caregivers, onClose, onSaved }: { clients: Client[]; caregivers: Caregiver[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ client_id: '', caregiver_id: '', visit_date: new Date().toISOString().slice(0, 10), start_time: '09:00', end_time: '11:00', care_type: 'companion', notes: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.client_id || !form.caregiver_id || !form.visit_date) return;
    setSaving(true);
    try {
      await fetch('/api/admin/senior-care/schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, client_id: parseInt(form.client_id), caregiver_id: parseInt(form.caregiver_id) }) });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold mb-4 text-slate-800">Schedule Visit</h2>
        <div className="space-y-3">
          <div><label className="text-xs text-gray-500">Client *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.client_id} onChange={e => f('client_id', e.target.value)}><option value="">— select client —</option>{clients.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Caregiver *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.caregiver_id} onChange={e => f('caregiver_id', e.target.value)}><option value="">— select caregiver —</option>{caregivers.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Visit Date *</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.visit_date} onChange={e => f('visit_date', e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500">Start Time</label><input type="time" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.start_time} onChange={e => f('start_time', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">End Time</label><input type="time" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.end_time} onChange={e => f('end_time', e.target.value)} /></div>
          </div>
          <div><label className="text-xs text-gray-500">Care Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.care_type} onChange={e => f('care_type', e.target.value)}>{CARE_TYPES.map(t => <option key={t} value={t}>{cap(t)}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.notes} onChange={e => f('notes', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded border text-sm">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 rounded bg-teal-600 text-white text-sm font-medium disabled:opacity-50">{saving ? 'Saving…' : 'Schedule Visit'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Add Note Modal ────────────────────────────────────────────────────────────
function AddNoteModal({ clients, caregivers, onClose, onSaved }: { clients: Client[]; caregivers: Caregiver[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ client_id: '', caregiver_id: '', visit_date: new Date().toISOString().slice(0, 10), mood: 'good', appetite: 'good', mobility: 'assisted', medications_taken: true, incidents: '', general_notes: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.client_id || !form.visit_date) return;
    setSaving(true);
    try {
      await fetch('/api/admin/senior-care/care-notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, client_id: parseInt(form.client_id), caregiver_id: form.caregiver_id ? parseInt(form.caregiver_id) : null }) });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold mb-4 text-slate-800">Add Care Note</h2>
        <div className="space-y-3">
          <div><label className="text-xs text-gray-500">Client *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.client_id} onChange={e => f('client_id', e.target.value)}><option value="">— select —</option>{clients.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Caregiver</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.caregiver_id} onChange={e => f('caregiver_id', e.target.value)}><option value="">— select —</option>{caregivers.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Visit Date</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.visit_date} onChange={e => f('visit_date', e.target.value)} /></div>
          <div className="grid grid-cols-3 gap-2">
            <div><label className="text-xs text-gray-500">Mood</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.mood} onChange={e => f('mood', e.target.value)}>{MOODS.map(m => <option key={m}>{m}</option>)}</select></div>
            <div><label className="text-xs text-gray-500">Appetite</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.appetite} onChange={e => f('appetite', e.target.value)}>{APPETITE_OPTS.map(a => <option key={a}>{a}</option>)}</select></div>
            <div><label className="text-xs text-gray-500">Mobility</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.mobility} onChange={e => f('mobility', e.target.value)}>{MOBILITY_OPTS.map(m => <option key={m} value={m}>{cap(m)}</option>)}</select></div>
          </div>
          <div className="flex items-center gap-2"><input type="checkbox" checked={form.medications_taken} onChange={e => f('medications_taken', e.target.checked)} /><label className="text-sm">Medications Taken</label></div>
          <div><label className="text-xs text-gray-500">Incidents</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.incidents} onChange={e => f('incidents', e.target.value)} placeholder="Any falls, changes, concerns…" /></div>
          <div><label className="text-xs text-gray-500">General Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.general_notes} onChange={e => f('general_notes', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded border text-sm">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 rounded bg-teal-600 text-white text-sm font-medium disabled:opacity-50">{saving ? 'Saving…' : 'Save Note'}</button>
        </div>
      </div>
    </div>
  );
}

export default function SeniorCarePage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [dash, setDash] = useState<DashData | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [caregivers, setCaregivers] = useState<Caregiver[]>([]);
  const [schedule, setSchedule] = useState<Visit[]>([]);
  const [careNotes, setCareNotes] = useState<CareNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddClient, setShowAddClient] = useState(false);
  const [showAddVisit, setShowAddVisit] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [schedDate, setSchedDate] = useState(new Date().toISOString().slice(0, 10));
  const [noteClientId, setNoteClientId] = useState('');
  const [carePlanForm, setCarePlanForm] = useState({ client_id: '', primary_condition: '', care_level: 'personal_care', age: '', aish_recipient: false, alberta_seniors_benefit: false });
  const [carePlanOutput, setCarePlanOutput] = useState('');
  const [carePlanLoading, setCarePlanLoading] = useState(false);
  const [carePlanAi, setCarePlanAi] = useState(false);

  const loadDash = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/senior-care');
    if (res.ok) setDash(await res.json());
    setLoading(false);
  }, []);
  const loadClients = useCallback(async () => {
    const res = await fetch('/api/admin/senior-care/clients');
    if (res.ok) setClients(await res.json());
  }, []);
  const loadCaregivers = useCallback(async () => {
    const res = await fetch('/api/admin/senior-care/caregivers');
    if (res.ok) setCaregivers(await res.json());
  }, []);
  const loadSchedule = useCallback(async () => {
    const res = await fetch(`/api/admin/senior-care/schedule?date=${schedDate}`);
    if (res.ok) setSchedule(await res.json());
  }, [schedDate]);
  const loadNotes = useCallback(async () => {
    const url = noteClientId ? `/api/admin/senior-care/care-notes?client_id=${noteClientId}` : '/api/admin/senior-care/care-notes';
    const res = await fetch(url);
    if (res.ok) setCareNotes(await res.json());
  }, [noteClientId]);

  useEffect(() => { loadDash(); loadClients(); loadCaregivers(); }, [loadDash, loadClients, loadCaregivers]);
  useEffect(() => { if (tab === 'schedule') loadSchedule(); }, [tab, loadSchedule, schedDate]);
  useEffect(() => { if (tab === 'care-notes') loadNotes(); }, [tab, loadNotes, noteClientId]);

  async function updateVisitStatus(id: number, status: string) {
    await fetch(`/api/admin/senior-care/schedule/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    loadSchedule();
    loadDash();
  }

  async function generateCarePlan() {
    if (!carePlanForm.primary_condition || !carePlanForm.care_level) return;
    setCarePlanLoading(true);
    const client = clients.find(c => c.id === parseInt(carePlanForm.client_id));
    const res = await fetch('/api/admin/senior-care/ai-care-plan', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...carePlanForm, age: carePlanForm.age || client?.age, primary_condition: carePlanForm.primary_condition || client?.primary_condition, client_name: client ? `${client.first_name} ${client.last_name}` : undefined }),
    });
    if (res.ok) { const d = await res.json(); setCarePlanOutput(d.plan); setCarePlanAi(d.ai_used); }
    setCarePlanLoading(false);
  }

  const careLevelCounts = CARE_LEVELS.map(l => ({ level: l, count: clients.filter(c => c.care_level === l).length })).filter(x => x.count > 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-slate-800 text-white px-6 py-4">
        <h1 className="text-xl font-bold">Senior Care & Home Health Hub</h1>
        <p className="text-slate-300 text-sm mt-0.5">Calgary Home Care Coordination Platform</p>
      </div>
      <div className="border-b bg-white px-6 flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab === t ? 'border-teal-600 text-teal-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{TAB_LABELS[t]}</button>
        ))}
      </div>
      <div className="p-6 max-w-7xl mx-auto">

        {/* ── Dashboard ── */}
        {tab === 'dashboard' && (
          <div className="space-y-6">
            {loading && <p className="text-gray-400 text-sm">Loading…</p>}
            {dash && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <KpiCard label="Active Clients" value={dash.active_clients} color="teal" />
                  <KpiCard label="Visits Today" value={dash.visits_today} color="blue" />
                  <KpiCard label="Missed Visits MTD" value={dash.missed_visits_mtd} color={dash.missed_visits_mtd > 0 ? 'red' : 'green'} />
                  <KpiCard label="Active Caregivers" value={dash.caregivers_active} color="green" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl border p-5">
                    <h3 className="font-semibold text-slate-700 mb-3">Care Level Distribution</h3>
                    <div className="space-y-2">
                      {careLevelCounts.map(({ level, count }) => (
                        <div key={level} className="flex items-center gap-3">
                          <span className="text-xs text-gray-500 w-32">{cap(level)}</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-2"><div className="bg-teal-500 h-2 rounded-full" style={{ width: `${(count / Math.max(...careLevelCounts.map(x => x.count))) * 100}%` }}></div></div>
                          <span className="text-xs font-medium text-gray-700 w-6">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border p-5">
                    <h3 className="font-semibold text-slate-700 mb-3">Today&apos;s Schedule</h3>
                    {schedule.slice(0, 5).map(v => (
                      <div key={v.id} className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0">
                        <div><p className="text-sm font-medium">{v.client_first} {v.client_last}</p><p className="text-xs text-gray-400">{v.start_time} – {v.end_time} · {cap(v.care_type)}</p></div>
                        <Badge label={v.status} color={visitStatusColor(v.status)} />
                      </div>
                    ))}
                    {!schedule.length && <p className="text-sm text-gray-400">No visits today.</p>}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Clients ── */}
        {tab === 'clients' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-700">Clients ({clients.length})</h2>
              <button onClick={() => setShowAddClient(true)} className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium">+ Add Client</button>
            </div>
            <div className="bg-white rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>{['Client','Age','Care Level','Condition','Emergency Contact','Benefits','Status'].map(h => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {clients.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3"><p className="font-medium">{c.first_name} {c.last_name}</p><p className="text-xs text-gray-400">{c.phone}</p></td>
                      <td className="px-4 py-3">{c.age ? `${Math.round(c.age)} yrs` : '—'}</td>
                      <td className="px-4 py-3"><Badge label={c.care_level} color={careLevelColor(c.care_level)} /></td>
                      <td className="px-4 py-3 text-gray-500">{c.primary_condition || '—'}</td>
                      <td className="px-4 py-3"><p className="text-sm">{c.emergency_contact_name}</p><p className="text-xs text-gray-400">{c.emergency_contact_phone}</p></td>
                      <td className="px-4 py-3"><div className="flex gap-1 flex-wrap">{c.aish_recipient && <Badge label="AISH" color="purple" />}{c.alberta_seniors_benefit && <Badge label="ASB" color="teal" />}</div></td>
                      <td className="px-4 py-3"><Badge label={c.status} color={c.status === 'active' ? 'green' : 'gray'} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!clients.length && <p className="text-center text-gray-400 py-8">No clients found.</p>}
            </div>
            {showAddClient && <AddClientModal onClose={() => setShowAddClient(false)} onSaved={() => { setShowAddClient(false); loadClients(); loadDash(); }} />}
          </div>
        )}

        {/* ── Caregivers ── */}
        {tab === 'caregivers' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-700">Caregivers ({caregivers.length})</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {caregivers.map(cg => (
                <div key={cg.id} className="bg-white rounded-xl border p-5 space-y-3">
                  <div className="flex justify-between items-start">
                    <div><p className="font-semibold text-slate-800">{cg.first_name} {cg.last_name}</p><p className="text-xs text-gray-400">{cg.phone}</p></div>
                    <Badge label={cg.status} color={cg.status === 'active' ? 'green' : 'gray'} />
                  </div>
                  <div className="flex flex-wrap gap-1">{(cg.certification || []).map(c => <Badge key={c} label={c} color="blue" />)}</div>
                  <div><p className="text-xs text-gray-400 mb-1">Languages</p><p className="text-sm">{(cg.languages || []).join(', ') || '—'}</p></div>
                  <div><p className="text-xs text-gray-400 mb-1">Available Days</p><div className="flex flex-wrap gap-1">{DAYS.map(d => <span key={d} className={`text-xs px-1.5 py-0.5 rounded ${(cg.availability_days || []).includes(d) ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-300'}`}>{d.slice(0, 2)}</span>)}</div></div>
                  {cg.hourly_rate && <p className="text-sm font-semibold text-green-700">${Number(cg.hourly_rate).toFixed(2)}/hr</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Schedule ── */}
        {tab === 'schedule' && (
          <div>
            <div className="flex flex-wrap gap-3 items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-700">Visit Schedule</h2>
              <input type="date" className="border rounded px-2 py-1.5 text-sm" value={schedDate} onChange={e => setSchedDate(e.target.value)} />
              <button onClick={() => setShowAddVisit(true)} className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium ml-auto">+ Schedule Visit</button>
            </div>
            <div className="space-y-3">
              {schedule.map(v => (
                <div key={v.id} className="bg-white rounded-xl border p-4 flex flex-wrap gap-4 items-center">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-slate-800">{v.client_first} {v.client_last}</p>
                      <Badge label={v.care_level} color={careLevelColor(v.care_level)} />
                    </div>
                    <p className="text-sm text-gray-500">{v.start_time} – {v.end_time} · {cap(v.care_type)}</p>
                    <p className="text-xs text-gray-400">Caregiver: {v.cg_first} {v.cg_last}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge label={v.status} color={visitStatusColor(v.status)} />
                    {v.status === 'scheduled' && <button onClick={() => updateVisitStatus(v.id, 'confirmed')} className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">Confirm</button>}
                    {v.status === 'confirmed' && <button onClick={() => updateVisitStatus(v.id, 'in_progress')} className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded">Start</button>}
                    {v.status === 'in_progress' && <button onClick={() => updateVisitStatus(v.id, 'completed')} className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">Complete</button>}
                    {['scheduled','confirmed'].includes(v.status) && <button onClick={() => updateVisitStatus(v.id, 'missed')} className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded">Missed</button>}
                    {['scheduled','confirmed'].includes(v.status) && <button onClick={() => updateVisitStatus(v.id, 'cancelled')} className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">Cancel</button>}
                  </div>
                </div>
              ))}
              {!schedule.length && <p className="text-center text-gray-400 py-12">No visits scheduled for this date.</p>}
            </div>
            {showAddVisit && <AddVisitModal clients={clients} caregivers={caregivers} onClose={() => setShowAddVisit(false)} onSaved={() => { setShowAddVisit(false); loadSchedule(); loadDash(); }} />}
          </div>
        )}

        {/* ── Care Notes ── */}
        {tab === 'care-notes' && (
          <div>
            <div className="flex flex-wrap gap-3 items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-700">Care Notes</h2>
              <select className="border rounded px-2 py-1.5 text-sm" value={noteClientId} onChange={e => setNoteClientId(e.target.value)}>
                <option value="">All Clients</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
              </select>
              <button onClick={() => setShowAddNote(true)} className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium ml-auto">+ Add Note</button>
            </div>
            <div className="space-y-4">
              {careNotes.map(n => (
                <div key={n.id} className="bg-white rounded-xl border p-5">
                  <div className="flex justify-between items-start mb-3">
                    <div><p className="font-semibold text-slate-800">{n.client_first} {n.client_last}</p><p className="text-xs text-gray-400">{fmtDate(n.visit_date)} · Caregiver: {n.cg_first ? `${n.cg_first} ${n.cg_last}` : '—'}</p></div>
                    {!n.medications_taken && <Badge label="Meds Missed" color="red" />}
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="bg-gray-50 rounded p-2 text-center"><p className="text-xs text-gray-400">Mood</p><p className="text-sm font-medium mt-0.5">{cap(n.mood || '—')}</p></div>
                    <div className="bg-gray-50 rounded p-2 text-center"><p className="text-xs text-gray-400">Appetite</p><p className="text-sm font-medium mt-0.5">{cap(n.appetite || '—')}</p></div>
                    <div className="bg-gray-50 rounded p-2 text-center"><p className="text-xs text-gray-400">Mobility</p><p className="text-sm font-medium mt-0.5">{cap(n.mobility || '—')}</p></div>
                  </div>
                  {n.incidents && <div className="mb-2 p-2 bg-red-50 rounded text-sm text-red-700"><span className="font-medium">Incident: </span>{n.incidents}</div>}
                  {n.general_notes && <p className="text-sm text-gray-600">{n.general_notes}</p>}
                </div>
              ))}
              {!careNotes.length && <p className="text-center text-gray-400 py-12">No care notes found.</p>}
            </div>
            {showAddNote && <AddNoteModal clients={clients} caregivers={caregivers} onClose={() => setShowAddNote(false)} onSaved={() => { setShowAddNote(false); loadNotes(); }} />}
          </div>
        )}

        {/* ── AI Care Plan ── */}
        {tab === 'ai-care-plan' && (
          <div className="max-w-3xl">
            <h2 className="text-lg font-semibold text-slate-700 mb-4">AI Care Plan Generator</h2>
            <div className="bg-white rounded-xl border p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs text-gray-500">Select Client (optional)</label>
                  <select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={carePlanForm.client_id} onChange={e => {
                    const c = clients.find(x => x.id === parseInt(e.target.value));
                    setCarePlanForm(p => ({ ...p, client_id: e.target.value, primary_condition: c?.primary_condition || p.primary_condition, care_level: c?.care_level || p.care_level, age: c?.age ? String(Math.round(c.age)) : p.age, aish_recipient: c?.aish_recipient || p.aish_recipient, alberta_seniors_benefit: c?.alberta_seniors_benefit || p.alberta_seniors_benefit }));
                  }}>
                    <option value="">— or fill manually —</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                  </select>
                </div>
                <div><label className="text-xs text-gray-500">Primary Condition *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={carePlanForm.primary_condition} onChange={e => setCarePlanForm(p => ({ ...p, primary_condition: e.target.value }))} /></div>
                <div><label className="text-xs text-gray-500">Care Level</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={carePlanForm.care_level} onChange={e => setCarePlanForm(p => ({ ...p, care_level: e.target.value }))}>{CARE_LEVELS.map(l => <option key={l} value={l}>{cap(l)}</option>)}</select></div>
                <div><label className="text-xs text-gray-500">Age</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={carePlanForm.age} onChange={e => setCarePlanForm(p => ({ ...p, age: e.target.value }))} /></div>
                <div className="flex flex-col gap-2 justify-end">
                  <div className="flex items-center gap-2"><input type="checkbox" checked={carePlanForm.aish_recipient} onChange={e => setCarePlanForm(p => ({ ...p, aish_recipient: e.target.checked }))} /><label className="text-sm">AISH Recipient</label></div>
                  <div className="flex items-center gap-2"><input type="checkbox" checked={carePlanForm.alberta_seniors_benefit} onChange={e => setCarePlanForm(p => ({ ...p, alberta_seniors_benefit: e.target.checked }))} /><label className="text-sm">Alberta Seniors Benefit</label></div>
                </div>
              </div>
              <button onClick={generateCarePlan} disabled={carePlanLoading} className="px-6 py-2 bg-teal-600 text-white rounded-lg font-medium disabled:opacity-50">{carePlanLoading ? 'Generating…' : 'Generate Care Plan'}</button>
              {carePlanOutput && (
                <div className="mt-4">
                  <p className="text-xs text-gray-500 mb-2">{carePlanAi ? 'Generated by Ollama llama3.2' : 'Generated with fallback template'}</p>
                  <textarea readOnly className="w-full border rounded p-3 text-sm font-mono bg-gray-50 h-96 resize-none" value={carePlanOutput} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
