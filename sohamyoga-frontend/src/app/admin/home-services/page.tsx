'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard', 'jobs', 'customers', 'team', 'supplies', 'ai'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = { dashboard: 'Dashboard', jobs: 'Jobs', customers: 'Customers', team: 'Team', supplies: 'Supplies', ai: 'AI Tools' };

const SERVICE_TYPES = ['regular_cleaning','deep_clean','move_in','move_out','post_construction','carpet_cleaning','window_cleaning','organizing','snow_removal','lawn_care','pressure_washing','other'];
const JOB_STATUSES = ['scheduled','confirmed','en_route','in_progress','completed','cancelled','rescheduled'];
const SUPPLY_CATS = ['cleaning_solution','equipment','ppe','disposables','other'];
const ROLES = ['cleaner','lead_cleaner','supervisor','driver'];

interface DashData { jobs_today: number; jobs_this_week: number; revenue_mtd: number; avg_rating: number | null; overdue_payments_count: number; }
interface Customer { id: number; first_name: string; last_name: string; email: string; phone: string; address: string; city: string; gate_code: string; pet_info: string; total_jobs: number; total_spent: number; status: string; preferred_team: string; referral_source: string; service_notes: string; }
interface Job { id: number; customer_id: number; first_name: string; last_name: string; address: string; phone: string; gate_code: string; pet_info: string; service_type: string; scheduled_at: string; duration_hours: number; assigned_team: string[]; status: string; recurrence: string; price: number; tip_amount: number; payment_status: string; customer_rating: number; notes: string; checklist_completed: boolean; customer_feedback?: string; }
interface TeamMember { id: number; first_name: string; last_name: string; phone: string; role: string; status: string; hourly_rate: number; vehicle: string; certifications: string[]; }
interface Supply { id: number; name: string; category: string; quantity_on_hand: number; unit: string; reorder_point: number; cost_per_unit: number; supplier: string; }

function fmtCad(n: number | null) { return n != null ? `$${Number(n).toLocaleString('en-CA', { minimumFractionDigits: 0 })}` : '—'; }
function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString('en-CA') : '—'; }
function fmtDT(d: string) { return d ? new Date(d).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'; }
function stars(n: number | null) { if (!n) return '—'; return '★'.repeat(n) + '☆'.repeat(5 - n); }

function Badge({ label, color = 'gray' }: { label: string; color?: string }) {
  const m: Record<string, string> = { blue: 'bg-blue-100 text-blue-700', green: 'bg-green-100 text-green-700', amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700', purple: 'bg-purple-100 text-purple-700', gray: 'bg-gray-100 text-gray-700', teal: 'bg-teal-100 text-teal-700', orange: 'bg-orange-100 text-orange-700' };
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${m[color] ?? m.gray}`}>{label.replace(/_/g, ' ')}</span>;
}

function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const b: Record<string, string> = { blue: 'border-l-4 border-blue-500 bg-blue-50', green: 'border-l-4 border-green-500 bg-green-50', amber: 'border-l-4 border-amber-500 bg-amber-50', red: 'border-l-4 border-red-500 bg-red-50', purple: 'border-l-4 border-purple-500 bg-purple-50' };
  return <div className={`rounded-lg p-4 ${b[color] ?? b.blue}`}><p className="text-sm text-gray-500">{label}</p><p className="text-2xl font-bold mt-1">{value}</p>{sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}</div>;
}

function statusColor(s: string) {
  const m: Record<string, string> = { scheduled: 'blue', confirmed: 'purple', en_route: 'amber', in_progress: 'orange', completed: 'green', cancelled: 'red', rescheduled: 'gray' };
  return m[s] ?? 'gray';
}

function payColor(s: string) {
  const m: Record<string, string> = { pending: 'amber', paid: 'green', partial: 'orange', overdue: 'red' };
  return m[s] ?? 'gray';
}

// ─── Add Customer Modal ──────────────────────────────────────────────────────
function AddCustomerModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', address: '', city: 'Calgary', province: 'AB', postal_code: '', service_notes: '', gate_code: '', pet_info: '', alarm_code: '', preferred_team: '', referral_source: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.first_name || !form.last_name || !form.phone || !form.address) return;
    setSaving(true);
    try {
      await fetch('/api/admin/home-services/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-4 text-slate-800">New Customer</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500">First Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.first_name} onChange={e => f('first_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Last Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.last_name} onChange={e => f('last_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Phone *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.phone} onChange={e => f('phone', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Email</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.email} onChange={e => f('email', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Address *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.address} onChange={e => f('address', e.target.value)} placeholder="123 Main St NW" /></div>
          <div><label className="text-xs text-gray-500">City</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.city} onChange={e => f('city', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Postal Code</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.postal_code} onChange={e => f('postal_code', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Gate Code</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5 font-mono" value={form.gate_code} onChange={e => f('gate_code', e.target.value)} placeholder="e.g. #1234" /></div>
          <div><label className="text-xs text-gray-500">Alarm Code</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5 font-mono" value={form.alarm_code} onChange={e => f('alarm_code', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Pet Info</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.pet_info} onChange={e => f('pet_info', e.target.value)} placeholder="e.g. 2 cats, dog in backyard" /></div>
          <div><label className="text-xs text-gray-500">Preferred Team</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.preferred_team} onChange={e => f('preferred_team', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Referral Source</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.referral_source} onChange={e => f('referral_source', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Service Notes (for cleaners)</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.service_notes} onChange={e => f('service_notes', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded border text-sm">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 rounded bg-blue-600 text-white text-sm disabled:opacity-50">{saving ? 'Saving…' : 'Add Customer'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Job Modal ───────────────────────────────────────────────────────────
function AddJobModal({ customers, team, onClose, onSaved }: { customers: Customer[]; team: TeamMember[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ customer_id: '', service_type: 'regular_cleaning', scheduled_at: '', duration_hours: '3', recurrence: 'one_time', price: '', payment_method: 'credit_card', notes: '', assigned_team: [] as string[] });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  function toggleTeam(name: string) {
    setForm(p => ({ ...p, assigned_team: p.assigned_team.includes(name) ? p.assigned_team.filter(n => n !== name) : [...p.assigned_team, name] }));
  }

  async function submit() {
    if (!form.customer_id || !form.scheduled_at || !form.price) return;
    setSaving(true);
    try {
      await fetch('/api/admin/home-services/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, customer_id: parseInt(form.customer_id), duration_hours: parseFloat(form.duration_hours), price: parseFloat(form.price) }) });
      onSaved();
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-4 text-slate-800">Schedule Job</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs text-gray-500">Customer *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.customer_id} onChange={e => f('customer_id', e.target.value)}><option value="">Select…</option>{customers.map(c => <option key={c.id} value={c.id}>{c.last_name}, {c.first_name} — {c.address}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Service Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.service_type} onChange={e => f('service_type', e.target.value)}>{SERVICE_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Recurrence</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.recurrence} onChange={e => f('recurrence', e.target.value)}>{['one_time','weekly','bi_weekly','monthly'].map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Scheduled At *</label><input type="datetime-local" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.scheduled_at} onChange={e => f('scheduled_at', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Duration (hrs)</label><input type="number" step="0.5" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.duration_hours} onChange={e => f('duration_hours', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Price ($) *</label><input type="number" step="0.01" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.price} onChange={e => f('price', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Payment Method</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.payment_method} onChange={e => f('payment_method', e.target.value)}>{['credit_card','e_transfer','cash','cheque','square'].map(m => <option key={m}>{m.replace(/_/g, ' ')}</option>)}</select></div>
          <div className="col-span-2">
            <label className="text-xs text-gray-500">Assign Team</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {team.map(m => {
                const name = `${m.first_name} ${m.last_name}`;
                return <button type="button" key={m.id} onClick={() => toggleTeam(name)} className={`px-2 py-1 text-xs rounded border ${form.assigned_team.includes(name) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700'}`}>{name}</button>;
              })}
              {team.length === 0 && <p className="text-xs text-gray-400">No active team members.</p>}
            </div>
          </div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.notes} onChange={e => f('notes', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded border text-sm">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 rounded bg-blue-600 text-white text-sm disabled:opacity-50">{saving ? 'Saving…' : 'Schedule Job'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Complete Job Modal ───────────────────────────────────────────────────────
function CompleteJobModal({ job, onClose, onSaved }: { job: Job; onClose: () => void; onSaved: () => void }) {
  const [rating, setRating] = useState('');
  const [feedback, setFeedback] = useState('');
  const [tip, setTip] = useState('');
  const [saving, setSaving] = useState(false);
  async function submit() {
    setSaving(true);
    try {
      await fetch(`/api/admin/home-services/jobs/${job.id}/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payment_status: 'paid', customer_rating: rating ? parseInt(rating) : null, customer_feedback: feedback, tip_amount: tip ? parseFloat(tip) : 0 }) });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-96 p-6">
        <h3 className="font-bold mb-3 text-slate-800">Complete Job</h3>
        <p className="text-sm text-gray-600 mb-3">{job.last_name}, {job.first_name} — {job.service_type?.replace(/_/g,' ')}</p>
        <div className="space-y-3">
          <div><label className="text-xs text-gray-500">Customer Rating (1-5)</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={rating} onChange={e => setRating(e.target.value)}><option value="">—</option>{[5,4,3,2,1].map(n => <option key={n} value={n}>{stars(n)}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Customer Feedback</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={feedback} onChange={e => setFeedback(e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Tip Amount ($)</label><input type="number" step="0.01" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={tip} onChange={e => setTip(e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-3 py-1.5 rounded border text-sm">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-3 py-1.5 rounded bg-green-600 text-white text-sm disabled:opacity-50">{saving ? 'Saving…' : 'Mark Complete'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Team Member Modal ────────────────────────────────────────────────────
function AddTeamMemberModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '', role: 'cleaner', hourly_rate: '', vehicle: '', background_check_date: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.first_name || !form.last_name) return;
    setSaving(true);
    try {
      await fetch('/api/admin/home-services/team', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, hourly_rate: form.hourly_rate ? parseFloat(form.hourly_rate) : null }) });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-96 p-6">
        <h3 className="font-bold mb-3 text-slate-800">Add Team Member</h3>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500">First Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.first_name} onChange={e => f('first_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Last Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.last_name} onChange={e => f('last_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Phone</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.phone} onChange={e => f('phone', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Role</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.role} onChange={e => f('role', e.target.value)}>{ROLES.map(r => <option key={r}>{r.replace(/_/g,' ')}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Hourly Rate ($)</label><input type="number" step="0.01" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.hourly_rate} onChange={e => f('hourly_rate', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Vehicle</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.vehicle} onChange={e => f('vehicle', e.target.value)} placeholder="e.g. 2020 Civic" /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Background Check Date</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.background_check_date} onChange={e => f('background_check_date', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-3 py-1.5 rounded border text-sm">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm disabled:opacity-50">{saving ? 'Saving…' : 'Add Member'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Supply Adjust Modal ──────────────────────────────────────────────────────
function SupplyAdjustModal({ supply, onClose, onSaved }: { supply: Supply; onClose: () => void; onSaved: () => void }) {
  const [qty, setQty] = useState(String(supply.quantity_on_hand));
  const [saving, setSaving] = useState(false);
  async function submit() {
    setSaving(true);
    try {
      await fetch('/api/admin/home-services/supplies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: supply.id, quantity_on_hand: parseFloat(qty) }) });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-80 p-6">
        <h3 className="font-bold mb-3">Adjust Supply — {supply.name}</h3>
        <label className="text-xs text-gray-500">New Quantity ({supply.unit})</label>
        <input type="number" step="0.5" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={qty} onChange={e => setQty(e.target.value)} />
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-3 py-1.5 rounded border text-sm">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm disabled:opacity-50">{saving ? '…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard Tab ────────────────────────────────────────────────────────────
function DashboardTab({ data, jobs }: { data: DashData | null; jobs: Job[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const todaysJobs = jobs.filter(j => j.scheduled_at?.slice(0, 10) === today && j.status !== 'cancelled');
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiCard label="Jobs Today" value={data?.jobs_today ?? '—'} color="blue" />
        <KpiCard label="Jobs This Week" value={data?.jobs_this_week ?? '—'} color="purple" />
        <KpiCard label="Revenue MTD" value={data ? fmtCad(data.revenue_mtd) : '—'} color="green" />
        <KpiCard label="Avg Rating" value={data?.avg_rating ? `${data.avg_rating} ★` : '—'} color="amber" />
        <KpiCard label="Overdue Payments" value={data?.overdue_payments_count ?? '—'} color="red" />
      </div>
      <div>
        <h3 className="font-semibold text-slate-700 mb-3">Today&apos;s Schedule</h3>
        <div className="space-y-2">
          {todaysJobs.length === 0 && <p className="text-gray-400 text-sm">No jobs today.</p>}
          {todaysJobs.map(j => (
            <div key={j.id} className="bg-white border rounded-lg p-3 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-slate-800">{j.last_name}, {j.first_name}</span>
                    <Badge label={j.status} color={statusColor(j.status)} />
                    <Badge label={j.service_type} color="blue" />
                    {j.recurrence !== 'one_time' && <Badge label={j.recurrence} color="purple" />}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{j.address} · {fmtDT(j.scheduled_at)} · {j.duration_hours}h</p>
                  {j.gate_code && <p className="text-xs text-amber-700 font-medium mt-0.5">Gate: {j.gate_code}</p>}
                  {j.pet_info && <p className="text-xs text-blue-600 mt-0.5">Pets: {j.pet_info}</p>}
                  {j.assigned_team?.length > 0 && <p className="text-xs text-gray-400">Team: {j.assigned_team.join(', ')}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-slate-800">{fmtCad(j.price)}</p>
                  <Badge label={j.payment_status} color={payColor(j.payment_status)} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Jobs Tab ─────────────────────────────────────────────────────────────────
function JobsTab({ jobs, customers, team, onRefresh }: { jobs: Job[]; customers: Customer[]; team: TeamMember[]; onRefresh: () => void }) {
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [completeJob, setCompleteJob] = useState<Job | null>(null);

  const filtered = jobs.filter(j =>
    (!statusFilter || j.status === statusFilter) &&
    (!dateFilter || j.scheduled_at?.slice(0, 10) === dateFilter)
  );

  async function moveStatus(job: Job, status: string) {
    await fetch(`/api/admin/home-services/jobs/${job.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    onRefresh();
  }

  return (
    <div className="space-y-4">
      {showAdd && <AddJobModal customers={customers} team={team} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); onRefresh(); }} />}
      {completeJob && <CompleteJobModal job={completeJob} onClose={() => setCompleteJob(null)} onSaved={() => { setCompleteJob(null); onRefresh(); }} />}
      <div className="flex items-center gap-3 flex-wrap">
        <input type="date" className="border rounded px-2 py-1.5 text-sm" value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
        <select className="border rounded px-2 py-1.5 text-sm" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {JOB_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
        </select>
        <button onClick={() => { setStatusFilter(''); setDateFilter(''); }} className="text-xs text-blue-600 hover:underline">Clear</button>
        <button onClick={() => setShowAdd(true)} className="ml-auto px-4 py-2 rounded bg-blue-600 text-white text-sm">+ Schedule Job</button>
      </div>
      <div className="space-y-3">
        {filtered.length === 0 && <p className="text-gray-400 text-sm py-4 text-center">No jobs found.</p>}
        {filtered.map(j => (
          <div key={j.id} className="bg-white border rounded-lg p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-800">{j.last_name}, {j.first_name}</span>
                  <Badge label={j.status} color={statusColor(j.status)} />
                  <Badge label={j.service_type} color="blue" />
                  {j.recurrence !== 'one_time' && <Badge label={`🔁 ${j.recurrence}`} color="purple" />}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{j.address} · {fmtDT(j.scheduled_at)} · {j.duration_hours}h</p>
                {j.gate_code && <p className="text-xs text-amber-700 font-medium">Gate: {j.gate_code}</p>}
                {j.pet_info && <p className="text-xs text-blue-600">Pets: {j.pet_info}</p>}
                {j.assigned_team?.length > 0 && <p className="text-xs text-gray-400 mt-0.5">Team: {j.assigned_team.join(', ')}</p>}
                {j.notes && <p className="text-xs text-gray-500 mt-0.5 italic">{j.notes}</p>}
                {j.customer_rating && <p className="text-xs text-amber-600 mt-0.5">{stars(j.customer_rating)} {j.customer_feedback ?? ''}</p>}
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <p className="font-bold text-slate-800">{fmtCad(j.price)}{j.tip_amount > 0 ? ` +$${j.tip_amount} tip` : ''}</p>
                <Badge label={j.payment_status} color={payColor(j.payment_status)} />
                <div className="flex gap-1 flex-wrap justify-end">
                  {j.status === 'scheduled' && <button onClick={() => moveStatus(j, 'confirmed')} className="px-2 py-0.5 rounded bg-purple-600 text-white text-xs">Confirm</button>}
                  {j.status === 'confirmed' && <button onClick={() => moveStatus(j, 'en_route')} className="px-2 py-0.5 rounded bg-amber-600 text-white text-xs">En Route</button>}
                  {j.status === 'en_route' && <button onClick={() => moveStatus(j, 'in_progress')} className="px-2 py-0.5 rounded bg-orange-600 text-white text-xs">Start</button>}
                  {j.status === 'in_progress' && <button onClick={() => setCompleteJob(j)} className="px-2 py-0.5 rounded bg-green-600 text-white text-xs">Complete</button>}
                  {!['completed','cancelled'].includes(j.status) && <button onClick={() => moveStatus(j, 'cancelled')} className="px-2 py-0.5 rounded bg-red-500 text-white text-xs">Cancel</button>}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Customers Tab ────────────────────────────────────────────────────────────
function CustomersTab({ customers, onRefresh }: { customers: Customer[]; onRefresh: () => void }) {
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const filtered = customers.filter(c => `${c.first_name} ${c.last_name} ${c.phone} ${c.address}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="space-y-4">
      {showAdd && <AddCustomerModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); onRefresh(); }} />}
      <div className="flex items-center gap-3">
        <input className="border rounded px-2 py-1.5 text-sm flex-1 max-w-sm" placeholder="Search name, phone, address…" value={search} onChange={e => setSearch(e.target.value)} />
        <button onClick={() => setShowAdd(true)} className="ml-auto px-4 py-2 rounded bg-blue-600 text-white text-sm">+ Add Customer</button>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>{['Customer', 'Phone', 'Address', 'Gate', 'Pets', 'Jobs', 'Total Spent', 'Status'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map(c => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium text-slate-800">{c.last_name}, {c.first_name}</td>
                <td className="px-3 py-2 text-xs">{c.phone}</td>
                <td className="px-3 py-2 text-xs text-gray-600 max-w-xs truncate">{c.address}</td>
                <td className="px-3 py-2 text-xs font-mono text-amber-700">{c.gate_code ?? '—'}</td>
                <td className="px-3 py-2 text-xs text-blue-600">{c.pet_info ?? '—'}</td>
                <td className="px-3 py-2 text-center">{c.total_jobs}</td>
                <td className="px-3 py-2 font-medium text-green-600">{fmtCad(c.total_spent)}</td>
                <td className="px-3 py-2"><Badge label={c.status} color={c.status === 'active' ? 'green' : c.status === 'paused' ? 'amber' : 'red'} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="text-center text-gray-400 text-sm py-6">No customers found.</p>}
      </div>
    </div>
  );
}

// ─── Team Tab ─────────────────────────────────────────────────────────────────
function TeamTab({ team, jobs, onRefresh }: { team: TeamMember[]; jobs: Job[]; onRefresh: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="space-y-4">
      {showAdd && <AddTeamMemberModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); onRefresh(); }} />}
      <div className="flex justify-end"><button onClick={() => setShowAdd(true)} className="px-4 py-2 rounded bg-blue-600 text-white text-sm">+ Add Team Member</button></div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {team.map(m => {
          const memberName = `${m.first_name} ${m.last_name}`;
          const todaysJobs = jobs.filter(j => j.scheduled_at?.slice(0, 10) === today && j.assigned_team?.includes(memberName));
          return (
            <div key={m.id} className="bg-white border rounded-xl p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-slate-800">{memberName}</p>
                  <p className="text-xs text-gray-500">{m.role?.replace(/_/g,' ')}</p>
                </div>
                <Badge label={m.status} color={m.status === 'active' ? 'green' : 'amber'} />
              </div>
              <div className="mt-2 space-y-0.5 text-xs text-gray-500">
                {m.phone && <p>📱 {m.phone}</p>}
                {m.vehicle && <p>🚗 {m.vehicle}</p>}
                {m.hourly_rate && <p>💰 ${m.hourly_rate}/hr</p>}
                {m.certifications?.length > 0 && <p>🏅 {m.certifications.join(', ')}</p>}
              </div>
              {todaysJobs.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-gray-600 mb-1">Today&apos;s Jobs ({todaysJobs.length})</p>
                  {todaysJobs.map(j => <p key={j.id} className="text-xs text-gray-500">{fmtDT(j.scheduled_at)} — {j.last_name}, {j.first_name}</p>)}
                </div>
              )}
            </div>
          );
        })}
        {team.length === 0 && <p className="text-gray-400 text-sm">No active team members.</p>}
      </div>
    </div>
  );
}

// ─── Supplies Tab ──────────────────────────────────────────────────────────────
function SuppliesTab() {
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [adjustSupply, setAdjustSupply] = useState<Supply | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'cleaning_solution', quantity_on_hand: '0', unit: 'bottle', reorder_point: '5', cost_per_unit: '', supplier: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const data = await fetch('/api/admin/home-services/supplies').then(r => r.json());
    setSupplies(Array.isArray(data) ? data : []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  async function addSupply() {
    if (!form.name) return;
    setSaving(true);
    try {
      await fetch('/api/admin/home-services/supplies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, quantity_on_hand: parseFloat(form.quantity_on_hand), reorder_point: parseFloat(form.reorder_point), cost_per_unit: form.cost_per_unit ? parseFloat(form.cost_per_unit) : null }) });
      setShowAdd(false);
      load();
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      {adjustSupply && <SupplyAdjustModal supply={adjustSupply} onClose={() => setAdjustSupply(null)} onSaved={() => { setAdjustSupply(null); load(); }} />}
      <div className="flex justify-end"><button onClick={() => setShowAdd(!showAdd)} className="px-4 py-2 rounded bg-blue-600 text-white text-sm">+ Add Supply</button></div>
      {showAdd && (
        <div className="bg-gray-50 border rounded-lg p-4 grid grid-cols-3 gap-3">
          <div><label className="text-xs text-gray-500">Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.name} onChange={e => f('name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Category</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.category} onChange={e => f('category', e.target.value)}>{SUPPLY_CATS.map(c => <option key={c}>{c.replace(/_/g,' ')}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Unit</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.unit} onChange={e => f('unit', e.target.value)} placeholder="bottle, bag, pair…" /></div>
          <div><label className="text-xs text-gray-500">Qty on Hand</label><input type="number" step="0.5" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.quantity_on_hand} onChange={e => f('quantity_on_hand', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Reorder Point</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.reorder_point} onChange={e => f('reorder_point', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Cost/Unit ($)</label><input type="number" step="0.01" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.cost_per_unit} onChange={e => f('cost_per_unit', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Supplier</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.supplier} onChange={e => f('supplier', e.target.value)} /></div>
          <div className="flex items-end gap-2">
            <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 rounded border text-sm">Cancel</button>
            <button onClick={addSupply} disabled={saving} className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm disabled:opacity-50">{saving ? '…' : 'Add'}</button>
          </div>
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>{['Supply', 'Category', 'On Hand', 'Unit', 'Reorder @', 'Cost/Unit', 'Supplier', ''].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {supplies.map(s => {
              const low = (s.quantity_on_hand ?? 0) <= (s.reorder_point ?? 0);
              return (
                <tr key={s.id} className={`hover:bg-gray-50 ${low ? 'bg-red-50' : ''}`}>
                  <td className="px-3 py-2 font-medium text-slate-800">{s.name}</td>
                  <td className="px-3 py-2"><Badge label={s.category?.replace(/_/g,' ')} color="gray" /></td>
                  <td className={`px-3 py-2 font-bold ${low ? 'text-red-600' : 'text-slate-800'}`}>{s.quantity_on_hand}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{s.unit}</td>
                  <td className="px-3 py-2 text-xs text-gray-400">{s.reorder_point}</td>
                  <td className="px-3 py-2 text-xs text-gray-600">{s.cost_per_unit ? fmtCad(s.cost_per_unit) : '—'}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{s.supplier ?? '—'}</td>
                  <td className="px-3 py-2"><button onClick={() => setAdjustSupply(s)} className="text-xs text-blue-600 hover:underline">Adjust</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {supplies.length === 0 && <p className="text-center text-gray-400 text-sm py-6">No supplies found.</p>}
      </div>
    </div>
  );
}

// ─── AI Tools Tab ─────────────────────────────────────────────────────────────
function AIToolsTab() {
  const [quoteForm, setQuoteForm] = useState({ service_type: 'regular_cleaning', address: '', bedrooms: '3', bathrooms: '2', sqft: '1500', extras: '' });
  const [quoteResult, setQuoteResult] = useState('');
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteAI, setQuoteAI] = useState(false);

  const [checklistType, setChecklistType] = useState('regular_cleaning');
  const [checklistResult, setChecklistResult] = useState('');
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [checklistAI, setChecklistAI] = useState(false);

  const qf = (k: string, v: string) => setQuoteForm(p => ({ ...p, [k]: v }));

  async function generateQuote() {
    setQuoteLoading(true); setQuoteResult('');
    try {
      const res = await fetch('/api/admin/home-services/ai-quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(quoteForm) });
      const data = await res.json(); setQuoteResult(data.result); setQuoteAI(data.ai);
    } finally { setQuoteLoading(false); }
  }

  async function generateChecklist() {
    setChecklistLoading(true); setChecklistResult('');
    try {
      const res = await fetch('/api/admin/home-services/ai-checklist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ service_type: checklistType }) });
      const data = await res.json(); setChecklistResult(data.result); setChecklistAI(data.ai);
    } finally { setChecklistLoading(false); }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Quote Generator */}
      <div className="space-y-4">
        <h3 className="font-semibold text-slate-800">Quote Generator</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs text-gray-500">Service Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={quoteForm.service_type} onChange={e => qf('service_type', e.target.value)}>{SERVICE_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}</select></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Address</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={quoteForm.address} onChange={e => qf('address', e.target.value)} placeholder="123 Main St NW, Calgary" /></div>
          <div><label className="text-xs text-gray-500">Bedrooms</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={quoteForm.bedrooms} onChange={e => qf('bedrooms', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Bathrooms</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={quoteForm.bathrooms} onChange={e => qf('bathrooms', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Sq Ft</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={quoteForm.sqft} onChange={e => qf('sqft', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Extras</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={quoteForm.extras} onChange={e => qf('extras', e.target.value)} placeholder="oven, fridge, windows…" /></div>
        </div>
        <button onClick={generateQuote} disabled={quoteLoading} className="w-full px-4 py-2 rounded bg-blue-600 text-white text-sm disabled:opacity-50">{quoteLoading ? 'Generating…' : 'Generate Quote'}</button>
        {quoteResult && (
          <div className={`rounded-lg p-3 border text-xs whitespace-pre-wrap font-mono ${quoteAI ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
            <p className="text-gray-500 mb-2 font-sans">{quoteAI ? '🤖 AI Quote' : '📋 Standard Rate'}</p>
            {quoteResult}
          </div>
        )}
      </div>

      {/* Checklist Generator */}
      <div className="space-y-4">
        <h3 className="font-semibold text-slate-800">Cleaning Checklist Generator</h3>
        <div>
          <label className="text-xs text-gray-500">Service Type</label>
          <select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={checklistType} onChange={e => setChecklistType(e.target.value)}>
            {SERVICE_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
          </select>
        </div>
        <button onClick={generateChecklist} disabled={checklistLoading} className="w-full px-4 py-2 rounded bg-blue-600 text-white text-sm disabled:opacity-50">{checklistLoading ? 'Generating…' : 'Generate Checklist'}</button>
        {checklistResult && (
          <div className={`rounded-lg p-3 border text-xs whitespace-pre-wrap font-mono ${checklistAI ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex justify-between items-center mb-2">
              <p className="text-gray-500 font-sans">{checklistAI ? '🤖 AI Checklist' : '📋 Standard Template'}</p>
              <button onClick={() => window.print()} className="text-blue-600 font-sans hover:underline">Print</button>
            </div>
            {checklistResult}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function HomeServicesPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [dash, setDash] = useState<DashData | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);

  const loadAll = useCallback(async () => {
    const [d, j, c, t] = await Promise.all([
      fetch('/api/admin/home-services').then(r => r.json()),
      fetch('/api/admin/home-services/jobs').then(r => r.json()),
      fetch('/api/admin/home-services/customers').then(r => r.json()),
      fetch('/api/admin/home-services/team').then(r => r.json()),
    ]);
    setDash(d);
    setJobs(Array.isArray(j) ? j : []);
    setCustomers(Array.isArray(c) ? c : []);
    setTeam(Array.isArray(t) ? t : []);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-xl font-bold text-slate-800">Home Services & Cleaning Company Hub</h1>
        <p className="text-sm text-gray-500 mt-0.5">Job scheduling, customer management, team, supplies &amp; AI quote/checklist tools</p>
      </div>
      <div className="border-b bg-white px-6">
        <div className="flex gap-0 overflow-x-auto">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
      </div>
      <div className="p-6">
        {tab === 'dashboard' && <DashboardTab data={dash} jobs={jobs} />}
        {tab === 'jobs' && <JobsTab jobs={jobs} customers={customers} team={team} onRefresh={loadAll} />}
        {tab === 'customers' && <CustomersTab customers={customers} onRefresh={loadAll} />}
        {tab === 'team' && <TeamTab team={team} jobs={jobs} onRefresh={loadAll} />}
        {tab === 'supplies' && <SuppliesTab />}
        {tab === 'ai' && <AIToolsTab />}
      </div>
    </div>
  );
}
