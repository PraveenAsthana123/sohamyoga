'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard', 'events', 'detail', 'vendors', 'tasks', 'timeline', 'ai'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = { dashboard: 'Dashboard', events: 'Events', detail: 'Event Detail', vendors: 'Vendors', tasks: 'Tasks', timeline: 'Timeline Builder', ai: 'AI Event Planner' };

const EVENT_TYPES = ['corporate','wedding','birthday','conference','concert','fundraiser','networking','product_launch','other'];
const EVENT_STATUSES = ['inquiry','planning','confirmed','in_progress','completed','cancelled'];
const VENDOR_TYPES = ['venue','catering','photography','videography','florist','entertainment','decor','audio_visual','transportation','other'];
const VENDOR_STATUSES = ['contacted','quoted','booked','confirmed','completed','cancelled'];
const TASK_PRIORITIES = ['low','medium','high','critical'];
const TASK_STATUSES = ['pending','in_progress','completed','overdue'];

interface EpEvent { id: number; name: string; event_type: string; client_name: string; client_email: string; client_phone: string; event_date: string; event_time: string; venue: string; guest_count: number; budget: number; status: string; theme: string; vendor_count: number; open_tasks: number; }
interface EpVendor { id: number; event_id: number; vendor_type: string; vendor_name: string; contact_name: string; contact_phone: string; quoted_amount: number; confirmed_amount: number; deposit_paid: number; balance_due: number; contract_signed: boolean; status: string; notes: string; }
interface EpTask { id: number; event_id: number; task_name: string; category: string; assigned_to: string; due_date: string; status: string; priority: string; notes: string; }
interface EpTimeline { id: number; event_id: number; time_slot: string; activity: string; responsible_party: string; duration_minutes: number; notes: string; }
interface DashboardData { events_this_month: number; upcoming_events: EpEvent[]; total_budget_pipeline: number; overdue_tasks_count: number; }

function fmtCad(n: number) { return `$${Number(n ?? 0).toLocaleString('en-CA', { minimumFractionDigits: 0 })}`; }
function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString('en-CA') : '—'; }

function Badge({ label, color = 'gray' }: { label: string; color?: string }) {
  const map: Record<string, string> = { blue: 'bg-blue-100 text-blue-700', green: 'bg-green-100 text-green-700', amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700', purple: 'bg-purple-100 text-purple-700', gray: 'bg-gray-100 text-gray-700', teal: 'bg-teal-100 text-teal-700', orange: 'bg-orange-100 text-orange-700', pink: 'bg-pink-100 text-pink-700' };
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${map[color] ?? map.gray}`}>{label}</span>;
}

function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const borders: Record<string, string> = { blue: 'border-l-4 border-blue-500 bg-blue-50', green: 'border-l-4 border-green-500 bg-green-50', amber: 'border-l-4 border-amber-500 bg-amber-50', red: 'border-l-4 border-red-500 bg-red-50', purple: 'border-l-4 border-purple-500 bg-purple-50', teal: 'border-l-4 border-teal-500 bg-teal-50' };
  return (
    <div className={`rounded-lg p-4 ${borders[color] ?? borders.blue}`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function eventStatusColor(s: string): string {
  const m: Record<string, string> = { inquiry: 'gray', planning: 'blue', confirmed: 'teal', in_progress: 'amber', completed: 'green', cancelled: 'red' };
  return m[s] ?? 'gray';
}
function priorityColor(p: string): string {
  const m: Record<string, string> = { low: 'gray', medium: 'blue', high: 'amber', critical: 'red' };
  return m[p] ?? 'gray';
}
function vendorStatusColor(s: string): string {
  const m: Record<string, string> = { contacted: 'gray', quoted: 'blue', booked: 'purple', confirmed: 'teal', completed: 'green', cancelled: 'red' };
  return m[s] ?? 'gray';
}

// ── Create Event Modal ──
function CreateEventModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', event_type: 'corporate', client_name: '', client_email: '', client_phone: '', event_date: '', event_time: '', venue: '', guest_count: 50, budget: '', status: 'inquiry', theme: '', notes: '' });
  const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));
  async function save() {
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/admin/event-planning/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, budget: form.budget ? Number(form.budget) : null }) });
      const d = await res.json(); if (!res.ok) { setError(d.error ?? 'Error'); return; } onSaved();
    } catch (e) { setError(String(e)); } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold mb-4">Create Event</h3>
        {error && <div className="mb-3 p-2 bg-red-50 text-red-600 text-sm rounded">{error}</div>}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs text-gray-500">Event Name</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.name} onChange={e => set('name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Event Type</label>
            <select className="w-full border rounded px-2 py-1.5 text-sm" value={form.event_type} onChange={e => set('event_type', e.target.value)}>
              {EVENT_TYPES.map(t => <option key={t} value={t}>{t.replace('_',' ')}</option>)}
            </select>
          </div>
          <div><label className="text-xs text-gray-500">Status</label>
            <select className="w-full border rounded px-2 py-1.5 text-sm" value={form.status} onChange={e => set('status', e.target.value)}>
              {EVENT_STATUSES.map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
            </select>
          </div>
          <div><label className="text-xs text-gray-500">Client Name</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.client_name} onChange={e => set('client_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Client Email</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.client_email} onChange={e => set('client_email', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Client Phone</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.client_phone} onChange={e => set('client_phone', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Event Date</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm" value={form.event_date} onChange={e => set('event_date', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Event Time</label><input type="time" className="w-full border rounded px-2 py-1.5 text-sm" value={form.event_time} onChange={e => set('event_time', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Guest Count</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm" value={form.guest_count} onChange={e => set('guest_count', Number(e.target.value))} /></div>
          <div><label className="text-xs text-gray-500">Budget (CAD)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm" value={form.budget} onChange={e => set('budget', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Venue</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.venue} onChange={e => set('venue', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Theme</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.theme} onChange={e => set('theme', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
        </div>
        <div className="flex gap-2 mt-4 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded disabled:opacity-50">{saving ? 'Creating…' : 'Create Event'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Add Vendor Modal ──
function AddVendorModal({ eventId, onClose, onSaved }: { eventId: number; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ vendor_type: 'catering', vendor_name: '', contact_name: '', contact_phone: '', contact_email: '', quoted_amount: '', confirmed_amount: '', deposit_paid: '0', contract_signed: false, status: 'contacted', notes: '' });
  const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));
  async function save() {
    setSaving(true); setError('');
    try {
      const payload = { ...form, quoted_amount: form.quoted_amount ? Number(form.quoted_amount) : null, confirmed_amount: form.confirmed_amount ? Number(form.confirmed_amount) : null, deposit_paid: Number(form.deposit_paid) };
      const res = await fetch(`/api/admin/event-planning/events/${eventId}/vendors`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const d = await res.json(); if (!res.ok) { setError(d.error ?? 'Error'); return; } onSaved();
    } catch (e) { setError(String(e)); } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold mb-4">Add Vendor</h3>
        {error && <div className="mb-3 p-2 bg-red-50 text-red-600 text-sm rounded">{error}</div>}
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500">Vendor Type</label>
            <select className="w-full border rounded px-2 py-1.5 text-sm" value={form.vendor_type} onChange={e => set('vendor_type', e.target.value)}>
              {VENDOR_TYPES.map(t => <option key={t} value={t}>{t.replace('_',' ')}</option>)}
            </select>
          </div>
          <div><label className="text-xs text-gray-500">Status</label>
            <select className="w-full border rounded px-2 py-1.5 text-sm" value={form.status} onChange={e => set('status', e.target.value)}>
              {VENDOR_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Vendor Name</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.vendor_name} onChange={e => set('vendor_name', e.target.value)} /></div>
          {[['contact_name','Contact Name'],['contact_phone','Phone'],['contact_email','Email']].map(([k,l]) => (
            <div key={k}><label className="text-xs text-gray-500">{l}</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={(form as Record<string,unknown>)[k] as string} onChange={e => set(k, e.target.value)} /></div>
          ))}
          <div><label className="text-xs text-gray-500">Quoted (CAD)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm" value={form.quoted_amount} onChange={e => set('quoted_amount', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Confirmed (CAD)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm" value={form.confirmed_amount} onChange={e => set('confirmed_amount', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Deposit Paid (CAD)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm" value={form.deposit_paid} onChange={e => set('deposit_paid', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
        </div>
        <div className="mt-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.contract_signed} onChange={e => set('contract_signed', e.target.checked)} /> Contract Signed</label></div>
        <div className="flex gap-2 mt-4 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded disabled:opacity-50">{saving ? 'Saving…' : 'Add Vendor'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Add Task Modal ──
function AddTaskModal({ eventId, onClose, onSaved }: { eventId: number; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ task_name: '', category: '', assigned_to: '', due_date: '', priority: 'medium', notes: '' });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  async function save() {
    setSaving(true);
    await fetch(`/api/admin/event-planning/events/${eventId}/tasks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setSaving(false); onSaved();
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold mb-4">Add Task</h3>
        <div className="space-y-3">
          <div><label className="text-xs text-gray-500">Task Name</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.task_name} onChange={e => set('task_name', e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500">Category</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.category} onChange={e => set('category', e.target.value)} placeholder="e.g. Venue, Catering…" /></div>
            <div><label className="text-xs text-gray-500">Assigned To</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Due Date</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm" value={form.due_date} onChange={e => set('due_date', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Priority</label>
              <select className="w-full border rounded px-2 py-1.5 text-sm" value={form.priority} onChange={e => set('priority', e.target.value)}>
                {TASK_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
        </div>
        <div className="flex gap-2 mt-4 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded disabled:opacity-50">{saving ? 'Saving…' : 'Add Task'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Add Timeline Slot Modal ──
function AddTimelineModal({ eventId, onClose, onSaved }: { eventId: number; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ time_slot: '', activity: '', responsible_party: '', duration_minutes: 30, notes: '' });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));
  async function save() {
    setSaving(true);
    await fetch(`/api/admin/event-planning/events/${eventId}/timeline`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setSaving(false); onSaved();
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold mb-4">Add Timeline Slot</h3>
        <div className="space-y-3">
          <div><label className="text-xs text-gray-500">Time Slot</label><input type="time" className="w-full border rounded px-2 py-1.5 text-sm" value={form.time_slot} onChange={e => set('time_slot', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Activity</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.activity} onChange={e => set('activity', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Responsible Party</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.responsible_party} onChange={e => set('responsible_party', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Duration (minutes)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm" value={form.duration_minutes} onChange={e => set('duration_minutes', Number(e.target.value))} /></div>
          <div><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
        </div>
        <div className="flex gap-2 mt-4 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded disabled:opacity-50">{saving ? 'Saving…' : 'Add Slot'}</button>
        </div>
      </div>
    </div>
  );
}

export default function EventPlanningPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [events, setEvents] = useState<EpEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EpEvent | null>(null);
  const [detailVendors, setDetailVendors] = useState<EpVendor[]>([]);
  const [detailTasks, setDetailTasks] = useState<EpTask[]>([]);
  const [detailTimeline, setDetailTimeline] = useState<EpTimeline[]>([]);
  const [allTasks, setAllTasks] = useState<EpTask[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [timelineEventId, setTimelineEventId] = useState('');
  const [timelineData, setTimelineData] = useState<EpTimeline[]>([]);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [showAddVendor, setShowAddVendor] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddTimeline, setShowAddTimeline] = useState(false);
  const [aiMode, setAiMode] = useState<'proposal' | 'checklist'>('proposal');
  const [aiEventType, setAiEventType] = useState('corporate');
  const [aiGuests, setAiGuests] = useState(100);
  const [aiBudget, setAiBudget] = useState(15000);
  const [aiTheme, setAiTheme] = useState('modern professional');
  const [aiClientName, setAiClientName] = useState('');
  const [aiWeeksOut, setAiWeeksOut] = useState(12);
  const [aiOutput, setAiOutput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const loadDashboard = useCallback(async () => { const res = await fetch('/api/admin/event-planning'); setDashboard(await res.json()); }, []);
  const loadEvents = useCallback(async () => {
    const p = new URLSearchParams();
    if (statusFilter) p.set('status', statusFilter);
    if (typeFilter) p.set('type', typeFilter);
    const res = await fetch(`/api/admin/event-planning/events?${p}`);
    const d = await res.json(); setEvents(d.events ?? []);
  }, [statusFilter, typeFilter]);
  const loadEventDetail = useCallback(async (ev: EpEvent) => {
    setSelectedEvent(ev);
    const res = await fetch(`/api/admin/event-planning/events/${ev.id}`);
    const d = await res.json();
    setDetailVendors(d.vendors ?? []); setDetailTasks(d.tasks ?? []); setDetailTimeline(d.timeline ?? []);
    setTab('detail');
  }, []);
  const loadTimelineForEvent = useCallback(async (id: string) => {
    if (!id) return;
    const res = await fetch(`/api/admin/event-planning/events/${id}/timeline`);
    const d = await res.json(); setTimelineData(d.timeline ?? []);
  }, []);
  const loadAllTasks = useCallback(async () => {
    const taskRes: EpTask[] = [];
    for (const ev of events) {
      const res = await fetch(`/api/admin/event-planning/events/${ev.id}/tasks`);
      const d = await res.json();
      taskRes.push(...(d.tasks ?? []).map((t: EpTask) => ({ ...t, _event_name: ev.name })));
    }
    setAllTasks(taskRes);
  }, [events]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);
  useEffect(() => { if (tab === 'events' || tab === 'tasks') loadEvents(); }, [tab, loadEvents]);
  useEffect(() => { if (tab === 'tasks' && events.length > 0) loadAllTasks(); }, [tab, events, loadAllTasks]);
  useEffect(() => { if (tab === 'timeline' && events.length === 0) loadEvents(); }, [tab, events, loadEvents]);
  useEffect(() => { if (timelineEventId) loadTimelineForEvent(timelineEventId); }, [timelineEventId, loadTimelineForEvent]);

  async function updateTaskStatus(eventId: number, taskId: number, status: string) {
    await fetch(`/api/admin/event-planning/events/${eventId}/tasks/${taskId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    if (tab === 'detail' && selectedEvent) loadEventDetail(selectedEvent);
    if (tab === 'tasks') loadAllTasks();
  }
  async function updateVendorStatus(eventId: number, vendorId: number, status: string) {
    await fetch(`/api/admin/event-planning/events/${eventId}/vendors/${vendorId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    if (selectedEvent) loadEventDetail(selectedEvent);
  }
  async function updateEventStatus(id: number, status: string) {
    await fetch(`/api/admin/event-planning/events/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    loadEvents(); loadDashboard();
  }
  async function generateAI() {
    setAiLoading(true); setAiOutput('');
    try {
      const endpoint = aiMode === 'proposal' ? '/api/admin/event-planning/ai-proposal' : '/api/admin/event-planning/ai-checklist';
      const body = aiMode === 'proposal'
        ? { event_type: aiEventType, guest_count: aiGuests, budget: aiBudget, theme: aiTheme, client_name: aiClientName || 'Valued Client' }
        : { event_type: aiEventType, weeks_out: aiWeeksOut, guest_count: aiGuests };
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await res.json();
      setAiOutput(d.proposal ?? d.checklist ?? d.error ?? 'No response');
    } catch (e) { setAiOutput(String(e)); } finally { setAiLoading(false); }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-800">Event Planning & Management Hub</h1>
        <p className="text-sm text-gray-500 mt-1">Events · Vendors · Tasks · Timelines · AI Event Planning</p>
      </div>
      <div className="bg-white border-b px-6">
        <div className="flex gap-0 overflow-x-auto">
          {TABS.map(t => <button key={t} onClick={() => setTab(t)} className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab === t ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{TAB_LABELS[t]}</button>)}
        </div>
      </div>
      <div className="p-6 max-w-7xl mx-auto">

        {/* DASHBOARD */}
        {tab === 'dashboard' && dashboard && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard label="Events This Month" value={dashboard.events_this_month} color="blue" />
              <KpiCard label="Pipeline Value" value={fmtCad(dashboard.total_budget_pipeline)} color="green" />
              <KpiCard label="Upcoming Events" value={dashboard.upcoming_events.length} sub="next active" color="purple" />
              <KpiCard label="Overdue Tasks" value={dashboard.overdue_tasks_count} color={dashboard.overdue_tasks_count > 0 ? 'red' : 'teal'} />
            </div>
            {dashboard.overdue_tasks_count > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {dashboard.overdue_tasks_count} overdue task{dashboard.overdue_tasks_count > 1 ? 's' : ''} require attention. Check the Tasks tab.
              </div>
            )}
            <div className="bg-white rounded-xl border p-5">
              <h2 className="font-semibold text-gray-700 mb-3">Upcoming Events</h2>
              {dashboard.upcoming_events.length === 0 ? <p className="text-sm text-gray-400">No upcoming events.</p> : (
                <div className="space-y-3">{dashboard.upcoming_events.map(ev => (
                  <div key={ev.id} className="flex items-center gap-4 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer" onClick={() => loadEventDetail(ev)}>
                    <div className="text-center min-w-14">
                      <p className="text-xs text-gray-400">{new Date(ev.event_date).toLocaleDateString('en-CA', { month: 'short' })}</p>
                      <p className="text-2xl font-bold text-purple-600">{new Date(ev.event_date).getDate()}</p>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">{ev.name}</p>
                      <p className="text-sm text-gray-500">{ev.client_name} · {ev.guest_count} guests{ev.budget ? ` · ${fmtCad(ev.budget)}` : ''}</p>
                    </div>
                    <Badge label={ev.status.replace('_',' ')} color={eventStatusColor(ev.status)} />
                    <Badge label={ev.event_type.replace('_',' ')} color="blue" />
                  </div>
                ))}</div>
              )}
            </div>
          </div>
        )}

        {/* EVENTS */}
        {tab === 'events' && (
          <div className="space-y-4">
            <div className="flex gap-3 items-center flex-wrap">
              <select className="border rounded px-3 py-2 text-sm" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="">All Statuses</option>
                {EVENT_STATUSES.map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
              </select>
              <select className="border rounded px-3 py-2 text-sm" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                <option value="">All Types</option>
                {EVENT_TYPES.map(t => <option key={t} value={t}>{t.replace('_',' ')}</option>)}
              </select>
              <button onClick={loadEvents} className="px-3 py-2 text-sm bg-gray-100 rounded">Filter</button>
              <button onClick={() => setShowCreateEvent(true)} className="px-4 py-2 text-sm bg-purple-600 text-white rounded ml-auto">+ Create Event</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {events.map(ev => (
                <div key={ev.id} className="bg-white rounded-xl border p-5 hover:border-purple-300 cursor-pointer transition-colors" onClick={() => loadEventDetail(ev)}>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold">{ev.name}</h3>
                    <div className="flex gap-1">
                      <Badge label={ev.status.replace('_',' ')} color={eventStatusColor(ev.status)} />
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 mb-1">{ev.client_name} · <Badge label={ev.event_type.replace('_',' ')} color="blue" /></p>
                  <p className="text-sm text-gray-500 mb-3">{fmtDate(ev.event_date)}{ev.venue ? ` · ${ev.venue}` : ''} · {ev.guest_count} guests</p>
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>{ev.vendor_count ?? 0} vendors · {ev.open_tasks ?? 0} open tasks</span>
                    {ev.budget && <span className="font-medium text-green-600">{fmtCad(ev.budget)}</span>}
                  </div>
                  <div className="flex gap-1 mt-3" onClick={e => e.stopPropagation()}>
                    {ev.status === 'inquiry' && <button onClick={() => updateEventStatus(ev.id, 'planning')} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">→ Planning</button>}
                    {ev.status === 'planning' && <button onClick={() => updateEventStatus(ev.id, 'confirmed')} className="px-2 py-1 text-xs bg-teal-100 text-teal-700 rounded">Confirm</button>}
                    {ev.status === 'confirmed' && <button onClick={() => updateEventStatus(ev.id, 'completed')} className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded">Complete</button>}
                    <button onClick={() => updateEventStatus(ev.id, 'cancelled')} className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">Cancel</button>
                  </div>
                </div>
              ))}
            </div>
            {events.length === 0 && <div className="bg-white rounded-xl border p-8 text-center text-gray-400 text-sm">No events found.</div>}
            {showCreateEvent && <CreateEventModal onClose={() => setShowCreateEvent(false)} onSaved={() => { setShowCreateEvent(false); loadEvents(); loadDashboard(); }} />}
          </div>
        )}

        {/* EVENT DETAIL */}
        {tab === 'detail' && selectedEvent && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold">{selectedEvent.name}</h2>
                  <p className="text-sm text-gray-500 mt-1">{selectedEvent.client_name} · {fmtDate(selectedEvent.event_date)} · {selectedEvent.guest_count} guests</p>
                  {selectedEvent.venue && <p className="text-sm text-gray-500">{selectedEvent.venue}</p>}
                </div>
                <div className="flex gap-2">
                  <Badge label={selectedEvent.status.replace('_',' ')} color={eventStatusColor(selectedEvent.status)} />
                  <Badge label={selectedEvent.event_type.replace('_',' ')} color="blue" />
                  {selectedEvent.budget && <span className="text-green-600 font-semibold text-sm">{fmtCad(selectedEvent.budget)}</span>}
                </div>
              </div>
            </div>
            {/* Vendors */}
            <div className="bg-white rounded-xl border p-5">
              <div className="flex justify-between mb-3">
                <h3 className="font-semibold">Vendors ({detailVendors.length})</h3>
                <button onClick={() => setShowAddVendor(true)} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded">+ Add Vendor</button>
              </div>
              <div className="space-y-2">{detailVendors.map(v => (
                <div key={v.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <Badge label={v.vendor_type.replace('_',' ')} color="purple" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{v.vendor_name}{v.contact_name ? ` — ${v.contact_name}` : ''}</p>
                    {v.quoted_amount && <p className="text-xs text-gray-400">Quoted: {fmtCad(v.quoted_amount)}{v.confirmed_amount ? ` · Confirmed: ${fmtCad(v.confirmed_amount)}` : ''}{v.deposit_paid ? ` · Deposit: ${fmtCad(v.deposit_paid)}` : ''}</p>}
                  </div>
                  <Badge label={v.status} color={vendorStatusColor(v.status)} />
                  {v.contract_signed && <span className="text-xs text-green-600 font-medium">✓ Signed</span>}
                  <div className="flex gap-1">
                    {v.status === 'contacted' && <button onClick={() => updateVendorStatus(selectedEvent.id, v.id, 'booked')} className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded">Book</button>}
                    {v.status === 'booked' && <button onClick={() => updateVendorStatus(selectedEvent.id, v.id, 'confirmed')} className="px-2 py-1 text-xs bg-teal-100 text-teal-700 rounded">Confirm</button>}
                  </div>
                </div>
              ))}</div>
              {detailVendors.length === 0 && <p className="text-sm text-gray-400">No vendors added yet.</p>}
            </div>
            {/* Tasks */}
            <div className="bg-white rounded-xl border p-5">
              <div className="flex justify-between mb-3">
                <h3 className="font-semibold">Tasks ({detailTasks.filter(t => t.status !== 'completed').length} open)</h3>
                <button onClick={() => setShowAddTask(true)} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded">+ Add Task</button>
              </div>
              <div className="space-y-2">{detailTasks.map(t => (
                <div key={t.id} className={`flex items-center gap-3 p-3 border rounded-lg ${t.status === 'overdue' || (t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed') ? 'border-red-200 bg-red-50' : ''}`}>
                  <Badge label={t.priority} color={priorityColor(t.priority)} />
                  <div className="flex-1">
                    <p className={`text-sm ${t.status === 'completed' ? 'line-through text-gray-400' : 'font-medium'}`}>{t.task_name}</p>
                    <p className="text-xs text-gray-400">{t.category ? `${t.category} · ` : ''}{t.assigned_to ? `@${t.assigned_to}` : ''}{t.due_date ? ` · Due: ${fmtDate(t.due_date)}` : ''}</p>
                  </div>
                  <Badge label={t.status} color={t.status === 'completed' ? 'green' : t.status === 'overdue' ? 'red' : 'gray'} />
                  {t.status !== 'completed' && <button onClick={() => updateTaskStatus(selectedEvent.id, t.id, 'completed')} className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded">Done</button>}
                </div>
              ))}</div>
              {detailTasks.length === 0 && <p className="text-sm text-gray-400">No tasks yet.</p>}
            </div>
            {/* Timeline */}
            <div className="bg-white rounded-xl border p-5">
              <h3 className="font-semibold mb-3">Day-Of Timeline ({detailTimeline.length} slots)</h3>
              <div className="space-y-2">{detailTimeline.map(t => (
                <div key={t.id} className="flex items-center gap-3 p-2 border-l-4 border-purple-300 pl-4">
                  <span className="font-mono text-sm text-purple-600 w-14">{t.time_slot.slice(0,5)}</span>
                  <div className="flex-1"><p className="text-sm font-medium">{t.activity}</p>{t.responsible_party && <p className="text-xs text-gray-400">{t.responsible_party} · {t.duration_minutes} min</p>}</div>
                </div>
              ))}</div>
              {detailTimeline.length === 0 && <p className="text-sm text-gray-400">No timeline entries yet.</p>}
            </div>
            {showAddVendor && <AddVendorModal eventId={selectedEvent.id} onClose={() => setShowAddVendor(false)} onSaved={() => { setShowAddVendor(false); loadEventDetail(selectedEvent); }} />}
            {showAddTask && <AddTaskModal eventId={selectedEvent.id} onClose={() => setShowAddTask(false)} onSaved={() => { setShowAddTask(false); loadEventDetail(selectedEvent); }} />}
          </div>
        )}
        {tab === 'detail' && !selectedEvent && (
          <div className="bg-white rounded-xl border p-8 text-center text-gray-400 text-sm">Select an event from the Events tab to view details.</div>
        )}

        {/* VENDORS */}
        {tab === 'vendors' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Showing vendors across all events. Click an event in the Events tab to manage its vendors.</p>
            <div className="bg-white rounded-xl border overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-gray-500 border-b bg-gray-50">{['Type','Vendor','Contact','Quoted','Confirmed','Deposit','Contract','Status'].map(h => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead>
                <tbody>
                  {detailVendors.map(v => (
                    <tr key={v.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3"><Badge label={v.vendor_type.replace('_',' ')} color="purple" /></td>
                      <td className="px-4 py-3 font-medium">{v.vendor_name}</td>
                      <td className="px-4 py-3 text-gray-500">{v.contact_name ?? '—'}{v.contact_phone ? ` · ${v.contact_phone}` : ''}</td>
                      <td className="px-4 py-3">{v.quoted_amount ? fmtCad(v.quoted_amount) : '—'}</td>
                      <td className="px-4 py-3">{v.confirmed_amount ? fmtCad(v.confirmed_amount) : '—'}</td>
                      <td className="px-4 py-3">{v.deposit_paid ? fmtCad(v.deposit_paid) : '—'}</td>
                      <td className="px-4 py-3">{v.contract_signed ? <span className="text-green-600">✓ Signed</span> : <span className="text-gray-400">Pending</span>}</td>
                      <td className="px-4 py-3"><Badge label={v.status} color={vendorStatusColor(v.status)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {detailVendors.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">Open an event detail to see its vendors here.</p>}
            </div>
          </div>
        )}

        {/* TASKS */}
        {tab === 'tasks' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">All Tasks ({allTasks.filter(t => t.status !== 'completed').length} open)</h2>
              <p className="text-sm text-gray-400">Load events first, then tasks will appear</p>
            </div>
            <div className="space-y-2">
              {allTasks.map(t => (
                <div key={t.id} className={`flex items-center gap-3 p-3 border rounded-lg bg-white ${(t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed') ? 'border-red-200 bg-red-50' : ''}`}>
                  <Badge label={t.priority} color={priorityColor(t.priority)} />
                  <div className="flex-1">
                    <p className={`text-sm ${t.status === 'completed' ? 'line-through text-gray-400' : 'font-medium'}`}>{t.task_name}</p>
                    <p className="text-xs text-gray-400">{(t as EpTask & { _event_name?: string })._event_name ?? ''} · {t.assigned_to ? `@${t.assigned_to}` : ''}  {t.due_date ? `· Due: ${fmtDate(t.due_date)}` : ''}</p>
                  </div>
                  <Badge label={t.status} color={t.status === 'completed' ? 'green' : t.status === 'overdue' ? 'red' : 'gray'} />
                  {t.status !== 'completed' && <button onClick={() => updateTaskStatus(t.event_id, t.id, 'completed')} className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded">Done</button>}
                </div>
              ))}
            </div>
            {allTasks.length === 0 && <div className="bg-white rounded-xl border p-8 text-center text-gray-400 text-sm">No tasks yet. Navigate to Events tab first, then return here.</div>}
          </div>
        )}

        {/* TIMELINE BUILDER */}
        {tab === 'timeline' && (
          <div className="space-y-4">
            <div className="flex gap-3 items-center">
              <select className="border rounded px-3 py-2 text-sm flex-1" value={timelineEventId} onChange={e => setTimelineEventId(e.target.value)}>
                <option value="">Select event…</option>
                {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name} — {fmtDate(ev.event_date)}</option>)}
              </select>
              {timelineEventId && <button onClick={() => setShowAddTimeline(true)} className="px-4 py-2 text-sm bg-purple-600 text-white rounded">+ Add Slot</button>}
            </div>
            {timelineEventId && (
              <div className="bg-white rounded-xl border p-5">
                <h3 className="font-semibold mb-4">Day-Of Timeline</h3>
                {timelineData.length === 0 ? <p className="text-sm text-gray-400">No timeline entries yet. Add your first slot.</p> : (
                  <div className="space-y-2">
                    {timelineData.map((t, i) => (
                      <div key={t.id} className="flex items-center gap-3 p-3 border rounded-lg">
                        <div className="flex flex-col gap-1">
                          <button disabled={i === 0} onClick={async () => { /* reorder via PATCH if needed */ }} className="text-xs text-gray-400 disabled:opacity-30">▲</button>
                          <button disabled={i === timelineData.length - 1} onClick={async () => { }} className="text-xs text-gray-400 disabled:opacity-30">▼</button>
                        </div>
                        <span className="font-mono text-sm font-bold text-purple-600 w-16">{t.time_slot.slice(0,5)}</span>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{t.activity}</p>
                          <p className="text-xs text-gray-400">{t.duration_minutes} min{t.responsible_party ? ` · ${t.responsible_party}` : ''}{t.notes ? ` · ${t.notes}` : ''}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {showAddTimeline && timelineEventId && <AddTimelineModal eventId={Number(timelineEventId)} onClose={() => setShowAddTimeline(false)} onSaved={() => { setShowAddTimeline(false); loadTimelineForEvent(timelineEventId); }} />}
          </div>
        )}

        {/* AI EVENT PLANNER */}
        {tab === 'ai' && (
          <div className="max-w-2xl space-y-4">
            <div className="bg-white rounded-xl border p-6">
              <h2 className="text-lg font-semibold mb-4">AI Event Planner (Ollama / llama3.2)</h2>
              <div className="flex gap-2 mb-4">
                <button onClick={() => setAiMode('proposal')} className={`px-4 py-2 text-sm rounded ${aiMode === 'proposal' ? 'bg-purple-600 text-white' : 'border'}`}>Generate Proposal</button>
                <button onClick={() => setAiMode('checklist')} className={`px-4 py-2 text-sm rounded ${aiMode === 'checklist' ? 'bg-purple-600 text-white' : 'border'}`}>Generate Checklist</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-gray-500">Event Type</label>
                  <select className="w-full border rounded px-2 py-1.5 text-sm mt-1" value={aiEventType} onChange={e => setAiEventType(e.target.value)}>
                    {EVENT_TYPES.map(t => <option key={t} value={t}>{t.replace('_',' ')}</option>)}
                  </select>
                </div>
                <div><label className="text-xs text-gray-500">Guest Count</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-1" value={aiGuests} onChange={e => setAiGuests(Number(e.target.value))} /></div>
                {aiMode === 'proposal' ? <>
                  <div><label className="text-xs text-gray-500">Budget (CAD)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-1" value={aiBudget} onChange={e => setAiBudget(Number(e.target.value))} /></div>
                  <div><label className="text-xs text-gray-500">Theme</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-1" value={aiTheme} onChange={e => setAiTheme(e.target.value)} /></div>
                  <div className="col-span-2"><label className="text-xs text-gray-500">Client Name</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-1" value={aiClientName} onChange={e => setAiClientName(e.target.value)} placeholder="Valued Client" /></div>
                </> : <>
                  <div><label className="text-xs text-gray-500">Weeks Until Event</label><input type="number" min={1} max={52} className="w-full border rounded px-2 py-1.5 text-sm mt-1" value={aiWeeksOut} onChange={e => setAiWeeksOut(Number(e.target.value))} /></div>
                </>}
              </div>
              <button onClick={generateAI} disabled={aiLoading} className="w-full mt-4 py-2 bg-purple-600 text-white rounded text-sm font-medium disabled:opacity-50">
                {aiLoading ? 'Generating…' : aiMode === 'proposal' ? 'Generate Event Proposal' : 'Generate Planning Checklist'}
              </button>
            </div>
            {aiOutput && (
              <div className="bg-white rounded-xl border p-6">
                <div className="flex justify-between mb-3">
                  <h3 className="font-semibold">{aiMode === 'proposal' ? 'Event Proposal' : 'Planning Checklist'}</h3>
                  <button onClick={() => navigator.clipboard.writeText(aiOutput)} className="text-xs text-purple-600 border border-purple-200 px-2 py-1 rounded">Copy</button>
                </div>
                <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">{aiOutput}</pre>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
