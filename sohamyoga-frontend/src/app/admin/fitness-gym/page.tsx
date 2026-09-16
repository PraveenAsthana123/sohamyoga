'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard', 'members', 'classes', 'bookings', 'checkin', 'ai'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = { dashboard: 'Dashboard', members: 'Members', classes: 'Classes', bookings: 'Bookings', checkin: 'Check-In', ai: 'AI Fitness Advisor' };

const MEMBERSHIP_TYPES = ['day_pass','monthly','quarterly','annual','student','senior','family','corporate'];
const MEMBERSHIP_STATUSES = ['active','frozen','expired','cancelled'];
const CLASS_TYPES = ['group','personal_training','virtual','specialty'];
const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

interface DashboardData { total_members: number; active_members: number; classes_today: number; checkins_today: number; revenue_mtd: number; expiring_soon_30d: GymMember[]; }
interface GymMember { id: number; first_name: string; last_name: string; email: string; phone: string; membership_type: string; membership_status: string; start_date: string; expiry_date: string; health_waiver_signed: boolean; created_at: string; }
interface GymClass { id: number; name: string; description: string; instructor: string; class_type: string; capacity: number; duration_minutes: number; schedule_days: string[]; schedule_time: string; location: string; price_drop_in: number; booking_count_today: number; }
interface GymBooking { id: number; member_id: number; class_id: number; first_name: string; last_name: string; class_name: string; instructor: string; booking_date: string; status: string; payment_status: string; booked_at: string; }
interface GymCheckin { id: number; member_id: number; first_name: string; last_name: string; membership_type: string; membership_status: string; checked_in_at: string; check_in_method: string; }

function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString('en-CA') : '—'; }
function fmtCad(n: number) { return `$${Number(n ?? 0).toLocaleString('en-CA', { minimumFractionDigits: 0 })}`; }
function fmtTime(t: string) { return t ? t.slice(0, 5) : '—'; }

function Badge({ label, color = 'gray' }: { label: string; color?: string }) {
  const map: Record<string, string> = { blue: 'bg-blue-100 text-blue-700', green: 'bg-green-100 text-green-700', amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700', purple: 'bg-purple-100 text-purple-700', gray: 'bg-gray-100 text-gray-700', teal: 'bg-teal-100 text-teal-700', orange: 'bg-orange-100 text-orange-700' };
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

function statusColor(s: string): string {
  const m: Record<string, string> = { active: 'green', frozen: 'blue', expired: 'red', cancelled: 'gray', booked: 'blue', attended: 'green', no_show: 'red', waitlist: 'amber' };
  return m[s] ?? 'gray';
}

// ── Add Member Modal ──
function AddMemberModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', membership_type: 'monthly', start_date: new Date().toISOString().slice(0, 10), expiry_date: '', emergency_contact_name: '', emergency_contact_phone: '', health_waiver_signed: false, notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));
  async function save() {
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/admin/fitness-gym/members', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? 'Error'); return; }
      onSaved();
    } catch (e) { setError(String(e)); } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold mb-4">Add New Member</h3>
        {error && <div className="mb-3 p-2 bg-red-50 text-red-600 text-sm rounded">{error}</div>}
        <div className="grid grid-cols-2 gap-3">
          {[['first_name','First Name'],['last_name','Last Name'],['email','Email'],['phone','Phone']].map(([k,l]) => (
            <div key={k}><label className="text-xs text-gray-500">{l}</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={(form as Record<string,unknown>)[k] as string} onChange={e => set(k, e.target.value)} /></div>
          ))}
          <div><label className="text-xs text-gray-500">Membership Type</label>
            <select className="w-full border rounded px-2 py-1.5 text-sm" value={form.membership_type} onChange={e => set('membership_type', e.target.value)}>
              {MEMBERSHIP_TYPES.map(t => <option key={t} value={t}>{t.replace('_',' ')}</option>)}
            </select>
          </div>
          <div><label className="text-xs text-gray-500">Start Date</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm" value={form.start_date} onChange={e => set('start_date', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Expiry Date</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm" value={form.expiry_date} onChange={e => set('expiry_date', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Emergency Contact</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.emergency_contact_name} onChange={e => set('emergency_contact_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Emergency Phone</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.emergency_contact_phone} onChange={e => set('emergency_contact_phone', e.target.value)} /></div>
        </div>
        <div className="mt-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.health_waiver_signed} onChange={e => set('health_waiver_signed', e.target.checked)} /> Health Waiver Signed</label></div>
        <div className="mt-3"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
        <div className="flex gap-2 mt-4 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded disabled:opacity-50">{saving ? 'Saving…' : 'Add Member'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Add Class Modal ──
function AddClassModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', description: '', instructor: '', class_type: 'group', capacity: 20, duration_minutes: 60, schedule_days: [] as string[], schedule_time: '', location: 'Studio A', price_drop_in: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));
  function toggleDay(d: string) { setForm(f => ({ ...f, schedule_days: f.schedule_days.includes(d) ? f.schedule_days.filter(x => x !== d) : [...f.schedule_days, d] })); }
  async function save() {
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/admin/fitness-gym/classes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, price_drop_in: form.price_drop_in ? Number(form.price_drop_in) : null }) });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? 'Error'); return; }
      onSaved();
    } catch (e) { setError(String(e)); } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
        <h3 className="text-lg font-bold mb-4">Add New Class</h3>
        {error && <div className="mb-3 p-2 bg-red-50 text-red-600 text-sm rounded">{error}</div>}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs text-gray-500">Class Name</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.name} onChange={e => set('name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Instructor</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.instructor} onChange={e => set('instructor', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Type</label>
            <select className="w-full border rounded px-2 py-1.5 text-sm" value={form.class_type} onChange={e => set('class_type', e.target.value)}>
              {CLASS_TYPES.map(t => <option key={t} value={t}>{t.replace('_',' ')}</option>)}
            </select>
          </div>
          <div><label className="text-xs text-gray-500">Capacity</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm" value={form.capacity} onChange={e => set('capacity', Number(e.target.value))} /></div>
          <div><label className="text-xs text-gray-500">Duration (min)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm" value={form.duration_minutes} onChange={e => set('duration_minutes', Number(e.target.value))} /></div>
          <div><label className="text-xs text-gray-500">Time</label><input type="time" className="w-full border rounded px-2 py-1.5 text-sm" value={form.schedule_time} onChange={e => set('schedule_time', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Location</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.location} onChange={e => set('location', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Drop-in Price (CAD)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm" value={form.price_drop_in} onChange={e => set('price_drop_in', e.target.value)} placeholder="optional" /></div>
        </div>
        <div className="mt-3"><label className="text-xs text-gray-500 block mb-1">Schedule Days</label>
          <div className="flex gap-1 flex-wrap">{DAYS.map(d => <button key={d} onClick={() => toggleDay(d)} className={`px-2 py-1 text-xs rounded border ${form.schedule_days.includes(d) ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300'}`}>{d}</button>)}</div>
        </div>
        <div className="flex gap-2 mt-4 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded disabled:opacity-50">{saving ? 'Saving…' : 'Add Class'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Manual Check-In Modal ──
function CheckInModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [search, setSearch] = useState('');
  const [members, setMembers] = useState<GymMember[]>([]);
  const [selected, setSelected] = useState<GymMember | null>(null);
  const [method, setMethod] = useState('staff');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (search.length < 2) { setMembers([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/admin/fitness-gym/members?search=${encodeURIComponent(search)}&status=active`);
      const d = await res.json(); setMembers(d.members ?? []);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);
  async function save() {
    if (!selected) return; setSaving(true); setError('');
    try {
      const res = await fetch('/api/admin/fitness-gym/checkins', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ member_id: selected.id, check_in_method: method }) });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? 'Error'); return; }
      onSaved();
    } catch (e) { setError(String(e)); } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold mb-4">Manual Check-In</h3>
        {error && <div className="mb-3 p-2 bg-red-50 text-red-600 text-sm rounded">{error}</div>}
        <div className="mb-3">
          <label className="text-xs text-gray-500">Search Member (name or email)</label>
          <input className="w-full border rounded px-2 py-1.5 text-sm mt-1" value={search} onChange={e => setSearch(e.target.value)} placeholder="Type to search…" />
          {members.length > 0 && <div className="border rounded mt-1 max-h-40 overflow-y-auto bg-white shadow">
            {members.map(m => <button key={m.id} onClick={() => { setSelected(m); setMembers([]); setSearch(`${m.first_name} ${m.last_name}`); }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b last:border-0">
              {m.first_name} {m.last_name} — {m.email} <Badge label={m.membership_type} color="blue" />
            </button>)}
          </div>}
        </div>
        {selected && <div className="p-3 bg-green-50 rounded text-sm mb-3">Selected: <strong>{selected.first_name} {selected.last_name}</strong></div>}
        <div><label className="text-xs text-gray-500">Check-In Method</label>
          <select className="w-full border rounded px-2 py-1.5 text-sm mt-1" value={method} onChange={e => setMethod(e.target.value)}>
            {['staff','kiosk','app','qr'].map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="flex gap-2 mt-4 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded">Cancel</button>
          <button onClick={save} disabled={saving || !selected} className="px-4 py-2 text-sm bg-green-600 text-white rounded disabled:opacity-50">{saving ? 'Checking in…' : 'Check In'}</button>
        </div>
      </div>
    </div>
  );
}

export default function FitnessGymPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [members, setMembers] = useState<GymMember[]>([]);
  const [classes, setClasses] = useState<GymClass[]>([]);
  const [bookings, setBookings] = useState<GymBooking[]>([]);
  const [checkins, setCheckins] = useState<GymCheckin[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberStatusFilter, setMemberStatusFilter] = useState('');
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().slice(0, 10));
  const [bookingClassFilter, setBookingClassFilter] = useState('');
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddClass, setShowAddClass] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [aiMemberType, setAiMemberType] = useState('monthly');
  const [aiGoal, setAiGoal] = useState('general fitness');
  const [aiFitnessLevel, setAiFitnessLevel] = useState('beginner');
  const [aiDays, setAiDays] = useState(3);
  const [aiPlan, setAiPlan] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadDashboard = useCallback(async () => { const res = await fetch('/api/admin/fitness-gym'); setDashboard(await res.json()); }, []);
  const loadMembers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (memberSearch) params.set('search', memberSearch);
    if (memberStatusFilter) params.set('status', memberStatusFilter);
    const res = await fetch(`/api/admin/fitness-gym/members?${params}`);
    const d = await res.json(); setMembers(d.members ?? []); setLoading(false);
  }, [memberSearch, memberStatusFilter]);
  const loadClasses = useCallback(async () => { const res = await fetch('/api/admin/fitness-gym/classes'); const d = await res.json(); setClasses(d.classes ?? []); }, []);
  const loadBookings = useCallback(async () => {
    const params = new URLSearchParams({ date: bookingDate });
    if (bookingClassFilter) params.set('class_id', bookingClassFilter);
    const res = await fetch(`/api/admin/fitness-gym/bookings?${params}`);
    const d = await res.json(); setBookings(d.bookings ?? []);
  }, [bookingDate, bookingClassFilter]);
  const loadCheckins = useCallback(async () => { const res = await fetch('/api/admin/fitness-gym/checkins'); const d = await res.json(); setCheckins(d.checkins ?? []); }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);
  useEffect(() => { if (tab === 'members') loadMembers(); }, [tab, loadMembers]);
  useEffect(() => { if (tab === 'classes') loadClasses(); }, [tab, loadClasses]);
  useEffect(() => { if (tab === 'bookings') { loadClasses(); loadBookings(); } }, [tab, loadBookings, loadClasses]);
  useEffect(() => { if (tab === 'checkin') loadCheckins(); }, [tab, loadCheckins]);

  async function freezeMember(id: number) {
    await fetch(`/api/admin/fitness-gym/members/${id}/freeze`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    loadMembers();
  }
  async function updateBookingStatus(id: number, status: string) {
    await fetch(`/api/admin/fitness-gym/bookings/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    loadBookings();
  }
  async function generatePlan() {
    setAiLoading(true); setAiPlan('');
    try {
      const res = await fetch('/api/admin/fitness-gym/ai-workout-plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ member_type: aiMemberType, goal: aiGoal, fitness_level: aiFitnessLevel, days_per_week: aiDays }) });
      const d = await res.json(); setAiPlan(d.plan ?? d.error ?? 'No response');
    } catch (e) { setAiPlan(String(e)); } finally { setAiLoading(false); }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-800">Fitness & Gym Management Hub</h1>
        <p className="text-sm text-gray-500 mt-1">Memberships · Classes · Bookings · Check-Ins · AI Fitness Planning</p>
      </div>
      <div className="bg-white border-b px-6">
        <div className="flex gap-0">
          {TABS.map(t => <button key={t} onClick={() => setTab(t)} className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{TAB_LABELS[t]}</button>)}
        </div>
      </div>
      <div className="p-6 max-w-7xl mx-auto">

        {/* DASHBOARD */}
        {tab === 'dashboard' && dashboard && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard label="Total Members" value={dashboard.total_members} color="blue" />
              <KpiCard label="Active Members" value={dashboard.active_members} color="green" />
              <KpiCard label="Active Classes" value={dashboard.classes_today} sub="in system" color="purple" />
              <KpiCard label="Check-Ins Today" value={dashboard.checkins_today} color="teal" />
            </div>
            <div className="bg-white rounded-xl border p-5">
              <h2 className="font-semibold text-gray-700 mb-3">Memberships Expiring in 30 Days ({dashboard.expiring_soon_30d.length})</h2>
              {dashboard.expiring_soon_30d.length === 0 ? <p className="text-sm text-gray-400">No memberships expiring soon.</p> : (
                <div className="overflow-x-auto"><table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-gray-500 border-b">{['Name','Email','Type','Expires'].map(h => <th key={h} className="pb-2 pr-4">{h}</th>)}</tr></thead>
                  <tbody>{dashboard.expiring_soon_30d.map(m => (
                    <tr key={m.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">{m.first_name} {m.last_name}</td>
                      <td className="py-2 pr-4 text-gray-500">{m.email}</td>
                      <td className="py-2 pr-4"><Badge label={m.membership_type} color="blue" /></td>
                      <td className="py-2 text-amber-600 font-medium">{fmtDate(m.expiry_date)}</td>
                    </tr>
                  ))}</tbody>
                </table></div>
              )}
            </div>
          </div>
        )}

        {/* MEMBERS */}
        {tab === 'members' && (
          <div className="space-y-4">
            <div className="flex gap-3 items-center flex-wrap">
              <input className="border rounded px-3 py-2 text-sm flex-1 min-w-48" placeholder="Search name or email…" value={memberSearch} onChange={e => setMemberSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadMembers()} />
              <select className="border rounded px-3 py-2 text-sm" value={memberStatusFilter} onChange={e => setMemberStatusFilter(e.target.value)}>
                <option value="">All Statuses</option>
                {MEMBERSHIP_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button onClick={loadMembers} className="px-3 py-2 text-sm bg-gray-100 rounded">Search</button>
              <button onClick={() => setShowAddMember(true)} className="px-4 py-2 text-sm bg-blue-600 text-white rounded">+ Add Member</button>
            </div>
            {loading ? <p className="text-sm text-gray-400">Loading…</p> : (
              <div className="bg-white rounded-xl border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-gray-500 border-b bg-gray-50">{['Name','Email','Phone','Type','Status','Start','Expires','Waiver','Actions'].map(h => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead>
                  <tbody>{members.map(m => (
                    <tr key={m.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{m.first_name} {m.last_name}</td>
                      <td className="px-4 py-3 text-gray-500">{m.email}</td>
                      <td className="px-4 py-3 text-gray-500">{m.phone ?? '—'}</td>
                      <td className="px-4 py-3"><Badge label={m.membership_type} color="blue" /></td>
                      <td className="px-4 py-3"><Badge label={m.membership_status} color={statusColor(m.membership_status)} /></td>
                      <td className="px-4 py-3 text-gray-500">{fmtDate(m.start_date)}</td>
                      <td className="px-4 py-3 text-gray-500">{m.expiry_date ? fmtDate(m.expiry_date) : '—'}</td>
                      <td className="px-4 py-3">{m.health_waiver_signed ? <span className="text-green-600">✓</span> : <span className="text-red-400">✗</span>}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => freezeMember(m.id)} className={`px-2 py-1 text-xs rounded ${m.membership_status === 'frozen' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{m.membership_status === 'frozen' ? 'Unfreeze' : 'Freeze'}</button>
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
                {members.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">No members found.</p>}
              </div>
            )}
            {showAddMember && <AddMemberModal onClose={() => setShowAddMember(false)} onSaved={() => { setShowAddMember(false); loadMembers(); }} />}
          </div>
        )}

        {/* CLASSES */}
        {tab === 'classes' && (
          <div className="space-y-4">
            <div className="flex justify-end"><button onClick={() => setShowAddClass(true)} className="px-4 py-2 text-sm bg-blue-600 text-white rounded">+ Add Class</button></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {classes.map(c => {
                const pct = Math.min(100, Math.round((Number(c.booking_count_today) / c.capacity) * 100));
                return (
                  <div key={c.id} className="bg-white rounded-xl border p-5">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold">{c.name}</h3>
                      <Badge label={c.class_type.replace('_',' ')} color="purple" />
                    </div>
                    <p className="text-sm text-gray-500 mb-1">Instructor: {c.instructor}</p>
                    <p className="text-sm text-gray-500 mb-1">Duration: {c.duration_minutes} min · {c.location}</p>
                    {c.schedule_time && <p className="text-sm text-gray-500 mb-1">Time: {fmtTime(c.schedule_time)} · {(c.schedule_days ?? []).join(', ')}</p>}
                    {c.price_drop_in && <p className="text-sm text-gray-500 mb-2">Drop-in: {fmtCad(c.price_drop_in)}</p>}
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-gray-500 mb-1"><span>Today's bookings</span><span>{c.booking_count_today}/{c.capacity}</span></div>
                      <div className="w-full bg-gray-100 rounded-full h-2"><div className={`h-2 rounded-full ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${pct}%` }} /></div>
                    </div>
                  </div>
                );
              })}
            </div>
            {classes.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">No active classes.</p>}
            {showAddClass && <AddClassModal onClose={() => setShowAddClass(false)} onSaved={() => { setShowAddClass(false); loadClasses(); }} />}
          </div>
        )}

        {/* BOOKINGS */}
        {tab === 'bookings' && (
          <div className="space-y-4">
            <div className="flex gap-3 items-center flex-wrap">
              <input type="date" className="border rounded px-3 py-2 text-sm" value={bookingDate} onChange={e => setBookingDate(e.target.value)} />
              <select className="border rounded px-3 py-2 text-sm" value={bookingClassFilter} onChange={e => setBookingClassFilter(e.target.value)}>
                <option value="">All Classes</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button onClick={loadBookings} className="px-3 py-2 text-sm bg-gray-100 rounded">Filter</button>
            </div>
            <div className="bg-white rounded-xl border overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-gray-500 border-b bg-gray-50">{['Member','Class','Instructor','Date','Status','Payment','Actions'].map(h => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead>
                <tbody>{bookings.map(b => (
                  <tr key={b.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{b.first_name} {b.last_name}</td>
                    <td className="px-4 py-3">{b.class_name}</td>
                    <td className="px-4 py-3 text-gray-500">{b.instructor}</td>
                    <td className="px-4 py-3 text-gray-500">{fmtDate(b.booking_date)}</td>
                    <td className="px-4 py-3"><Badge label={b.status} color={statusColor(b.status)} /></td>
                    <td className="px-4 py-3"><Badge label={b.payment_status.replace('_',' ')} color="gray" /></td>
                    <td className="px-4 py-3 flex gap-1">
                      {b.status === 'booked' && <>
                        <button onClick={() => updateBookingStatus(b.id, 'attended')} className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded">Attended</button>
                        <button onClick={() => updateBookingStatus(b.id, 'no_show')} className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded">No-Show</button>
                      </>}
                    </td>
                  </tr>
                ))}</tbody>
              </table>
              {bookings.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">No bookings found.</p>}
            </div>
          </div>
        )}

        {/* CHECK-IN */}
        {tab === 'checkin' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Today's Check-Ins ({checkins.length})</h2>
              <button onClick={() => setShowCheckIn(true)} className="px-4 py-2 text-sm bg-green-600 text-white rounded">+ Manual Check-In</button>
            </div>
            <div className="bg-white rounded-xl border overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-gray-500 border-b bg-gray-50">{['Member','Membership','Status','Time','Method'].map(h => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead>
                <tbody>{checkins.map(c => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">{c.first_name} {c.last_name}</td>
                    <td className="px-4 py-3"><Badge label={c.membership_type} color="blue" /></td>
                    <td className="px-4 py-3"><Badge label={c.membership_status} color={statusColor(c.membership_status)} /></td>
                    <td className="px-4 py-3 text-gray-500">{new Date(c.checked_in_at).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="px-4 py-3"><Badge label={c.check_in_method} color="gray" /></td>
                  </tr>
                ))}</tbody>
              </table>
              {checkins.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">No check-ins today yet.</p>}
            </div>
            {showCheckIn && <CheckInModal onClose={() => setShowCheckIn(false)} onSaved={() => { setShowCheckIn(false); loadCheckins(); }} />}
          </div>
        )}

        {/* AI FITNESS ADVISOR */}
        {tab === 'ai' && (
          <div className="max-w-2xl space-y-4">
            <div className="bg-white rounded-xl border p-6">
              <h2 className="text-lg font-semibold mb-4">AI Fitness Advisor (Ollama / llama3.2)</h2>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div><label className="text-xs text-gray-500">Membership Type</label>
                  <select className="w-full border rounded px-2 py-1.5 text-sm mt-1" value={aiMemberType} onChange={e => setAiMemberType(e.target.value)}>
                    {MEMBERSHIP_TYPES.map(t => <option key={t} value={t}>{t.replace('_',' ')}</option>)}
                  </select>
                </div>
                <div><label className="text-xs text-gray-500">Fitness Level</label>
                  <select className="w-full border rounded px-2 py-1.5 text-sm mt-1" value={aiFitnessLevel} onChange={e => setAiFitnessLevel(e.target.value)}>
                    {['beginner','intermediate','advanced'].map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div className="col-span-2"><label className="text-xs text-gray-500">Fitness Goal</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-1" value={aiGoal} onChange={e => setAiGoal(e.target.value)} placeholder="e.g. weight loss, muscle gain, flexibility…" /></div>
                <div><label className="text-xs text-gray-500">Days per Week</label><input type="number" min={1} max={7} className="w-full border rounded px-2 py-1.5 text-sm mt-1" value={aiDays} onChange={e => setAiDays(Number(e.target.value))} /></div>
              </div>
              <button onClick={generatePlan} disabled={aiLoading} className="w-full py-2 bg-blue-600 text-white rounded text-sm font-medium disabled:opacity-50">{aiLoading ? 'Generating Plan…' : 'Generate 4-Week Workout Plan'}</button>
            </div>
            {aiPlan && (
              <div className="bg-white rounded-xl border p-6">
                <div className="flex justify-between mb-3">
                  <h3 className="font-semibold">Generated Workout Plan</h3>
                  <button onClick={() => navigator.clipboard.writeText(aiPlan)} className="text-xs text-blue-600 border border-blue-200 px-2 py-1 rounded">Copy</button>
                </div>
                <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">{aiPlan}</pre>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
