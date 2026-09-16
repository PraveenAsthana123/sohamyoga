'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard','members','spaces','bookings','visitors','ai-pitch'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = {
  dashboard: 'Dashboard',
  members: 'Members',
  spaces: 'Spaces',
  bookings: 'Bookings',
  visitors: 'Visitors',
  'ai-pitch': 'AI Sales Pitch',
};

const PLAN_COLORS: Record<string, string> = {
  day_pass: 'bg-gray-100 text-gray-700',
  hot_desk: 'bg-blue-100 text-blue-700',
  dedicated_desk: 'bg-indigo-100 text-indigo-700',
  private_office: 'bg-purple-100 text-purple-700',
  virtual_office: 'bg-teal-100 text-teal-700',
  meeting_room_only: 'bg-orange-100 text-orange-700',
};
const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-red-100 text-red-600',
};
const BOOKING_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  checked_in: 'bg-green-100 text-green-700',
  completed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-600',
  no_show: 'bg-orange-100 text-orange-700',
};
const SPACE_TYPE_COLORS: Record<string, string> = {
  hot_desk: 'bg-blue-50 border-blue-200',
  dedicated_desk: 'bg-indigo-50 border-indigo-200',
  private_office: 'bg-purple-50 border-purple-200',
  meeting_room: 'bg-teal-50 border-teal-200',
  phone_booth: 'bg-cyan-50 border-cyan-200',
  event_space: 'bg-amber-50 border-amber-200',
  lounge: 'bg-orange-50 border-orange-200',
};

function Badge({ label, cls }: { label: string; cls: string }) {
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{label.replace(/_/g, ' ')}</span>;
}
function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const borders: Record<string, string> = {
    blue: 'border-l-4 border-blue-500 bg-blue-50',
    green: 'border-l-4 border-green-500 bg-green-50',
    amber: 'border-l-4 border-amber-500 bg-amber-50',
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

// ─── Dashboard Tab ──────────────────────────────────────────────────────────
function DashboardTab() {
  const [kpis, setKpis] = useState<Record<string, number> | null>(null);
  const [visitors, setVisitors] = useState<Record<string, unknown>[]>([]);
  const [spaces, setSpaces] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    fetch('/api/admin/coworking-space').then(r => r.json()).then(d => setKpis(d));
    fetch('/api/admin/coworking-space/visitors').then(r => r.json()).then(d => setVisitors(d.visitors || []));
    fetch('/api/admin/coworking-space/spaces').then(r => r.json()).then(d => setSpaces(d.spaces || []));
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiCard label="Active Members" value={kpis?.active_members ?? '…'} color="blue" />
        <KpiCard label="Spaces Booked Today" value={kpis?.spaces_occupied_today ?? '…'} color="purple" />
        <KpiCard label="Revenue MTD" value={kpis ? `$${Number(kpis.revenue_mtd).toFixed(0)}` : '…'} color="green" />
        <KpiCard label="Visitors Today" value={kpis?.visitors_today ?? '…'} color="amber" />
        <KpiCard label="Hot Desks Available" value={kpis?.hot_desks_available ?? '…'} color="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-700 mb-3">Live Space Grid</h3>
          <div className="grid grid-cols-3 gap-2">
            {spaces.slice(0, 18).map((s: Record<string, unknown>) => (
              <div key={String(s.id)} className={`rounded border p-2 text-xs ${SPACE_TYPE_COLORS[String(s.space_type)] || 'bg-gray-50 border-gray-200'}`}>
                <p className="font-medium truncate">{String(s.space_name)}</p>
                <p className="text-gray-500">{String(s.space_type).replace(/_/g, ' ')}</p>
                <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-xs ${s.is_available ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                  {s.is_available ? 'Available' : 'Occupied'}
                </span>
              </div>
            ))}
            {spaces.length === 0 && <p className="col-span-3 text-gray-400 text-sm py-4 text-center">No spaces configured yet</p>}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-700 mb-3">Today's Visitors</h3>
          {visitors.length === 0
            ? <p className="text-gray-400 text-sm text-center py-6">No visitors today</p>
            : <table className="w-full text-sm">
              <thead><tr className="text-left text-gray-500 border-b"><th className="pb-2">Visitor</th><th className="pb-2">Host</th><th className="pb-2">Status</th></tr></thead>
              <tbody>
                {visitors.map((v: Record<string, unknown>) => (
                  <tr key={String(v.id)} className="border-b last:border-0 py-2">
                    <td className="py-2">
                      <p className="font-medium">{String(v.visitor_name)}</p>
                      {v.visitor_company && <p className="text-xs text-gray-400">{String(v.visitor_company)}</p>}
                    </td>
                    <td className="py-2 text-gray-600">{v.host_first ? `${v.host_first} ${v.host_last}` : '—'}</td>
                    <td className="py-2">
                      {v.checked_out_at
                        ? <Badge label="Checked Out" cls="bg-gray-100 text-gray-600" />
                        : v.checked_in_at
                          ? <Badge label="Checked In" cls="bg-green-100 text-green-700" />
                          : <Badge label="Expected" cls="bg-blue-100 text-blue-700" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        </div>
      </div>
    </div>
  );
}

// ─── Members Tab ─────────────────────────────────────────────────────────────
function MembersTab() {
  const [members, setMembers] = useState<Record<string, unknown>[]>([]);
  const [planFilter, setPlanFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', company: '', job_title: '', membership_plan: 'hot_desk', billing_cycle: 'monthly', monthly_rate: '', desk_number: '', printer_access: true, mail_service: false, access_24hr: false, emergency_contact: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (planFilter) params.set('plan', planFilter);
    if (statusFilter) params.set('status', statusFilter);
    fetch(`/api/admin/coworking-space/members?${params}`).then(r => r.json()).then(d => setMembers(d.members || []));
  }, [planFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd() {
    setSaving(true);
    const body = { ...form, monthly_rate: form.monthly_rate ? parseFloat(form.monthly_rate) : undefined };
    await fetch('/api/admin/coworking-space/members', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setSaving(false);
    setShowAdd(false);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <select value={planFilter} onChange={e => setPlanFilter(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
          <option value="">All Plans</option>
          {['day_pass','hot_desk','dedicated_desk','private_office','virtual_office','meeting_room_only'].map(p => (
            <option key={p} value={p}>{p.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button onClick={() => setShowAdd(true)} className="ml-auto bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-blue-700">+ Add Member</button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>{['Name','Email','Plan','Status','Rate','Desk','Access','Start'].map(h => (
              <th key={h} className="text-left px-4 py-3 text-gray-500 font-medium">{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {members.map((m: Record<string, unknown>) => (
              <tr key={String(m.id)} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium">{String(m.first_name)} {String(m.last_name)}</p>
                  {m.company && <p className="text-xs text-gray-400">{String(m.company)}</p>}
                </td>
                <td className="px-4 py-3 text-gray-600">{String(m.email)}</td>
                <td className="px-4 py-3"><Badge label={String(m.membership_plan)} cls={PLAN_COLORS[String(m.membership_plan)] || 'bg-gray-100 text-gray-600'} /></td>
                <td className="px-4 py-3"><Badge label={String(m.membership_status)} cls={STATUS_COLORS[String(m.membership_status)] || ''} /></td>
                <td className="px-4 py-3">{m.monthly_rate ? `$${Number(m.monthly_rate).toFixed(0)}/mo` : '—'}</td>
                <td className="px-4 py-3">{m.desk_number || '—'}</td>
                <td className="px-4 py-3 flex gap-1 flex-wrap">
                  {m.printer_access && <span className="text-xs bg-gray-100 px-1.5 rounded">Print</span>}
                  {m.mail_service && <span className="text-xs bg-gray-100 px-1.5 rounded">Mail</span>}
                  {m['24hr_access'] && <span className="text-xs bg-gray-100 px-1.5 rounded">24hr</span>}
                </td>
                <td className="px-4 py-3 text-gray-500">{m.start_date ? new Date(String(m.start_date)).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr><td colSpan={8} className="text-center py-10 text-gray-400">No members found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-screen overflow-y-auto p-6">
            <h3 className="text-lg font-semibold mb-4">Add Member</h3>
            <div className="grid grid-cols-2 gap-3">
              {['first_name','last_name','email','phone','company','job_title'].map(f => (
                <div key={f}>
                  <label className="block text-xs text-gray-500 mb-1">{f.replace(/_/g, ' ')}</label>
                  <input value={String(form[f as keyof typeof form])} onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))}
                    className="w-full border rounded px-2 py-1.5 text-sm" />
                </div>
              ))}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Plan</label>
                <select value={form.membership_plan} onChange={e => setForm(p => ({ ...p, membership_plan: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm">
                  {['day_pass','hot_desk','dedicated_desk','private_office','virtual_office','meeting_room_only'].map(p => (
                    <option key={p} value={p}>{p.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Monthly Rate ($)</label>
                <input type="number" value={form.monthly_rate} onChange={e => setForm(p => ({ ...p, monthly_rate: e.target.value }))}
                  className="w-full border rounded px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Desk Number</label>
                <input value={form.desk_number} onChange={e => setForm(p => ({ ...p, desk_number: e.target.value }))}
                  className="w-full border rounded px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Emergency Contact</label>
                <input value={form.emergency_contact} onChange={e => setForm(p => ({ ...p, emergency_contact: e.target.value }))}
                  className="w-full border rounded px-2 py-1.5 text-sm" />
              </div>
              <div className="col-span-2 flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.printer_access} onChange={e => setForm(p => ({ ...p, printer_access: e.target.checked }))} />
                  Printer Access
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.mail_service} onChange={e => setForm(p => ({ ...p, mail_service: e.target.checked }))} />
                  Mail Service
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.access_24hr} onChange={e => setForm(p => ({ ...p, access_24hr: e.target.checked }))} />
                  24hr Access
                </label>
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full border rounded px-2 py-1.5 text-sm" rows={2} />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={handleAdd} disabled={saving} className="flex-1 bg-blue-600 text-white py-2 rounded font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving…' : 'Add Member'}
              </button>
              <button onClick={() => setShowAdd(false)} className="flex-1 border rounded py-2 text-gray-600 hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Spaces Tab ──────────────────────────────────────────────────────────────
function SpacesTab() {
  const [spaces, setSpaces] = useState<Record<string, unknown>[]>([]);
  const [typeFilter, setTypeFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ space_name: '', space_type: 'hot_desk', capacity: '1', floor: '', amenities: '', hourly_rate: '', daily_rate: '', monthly_rate: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (typeFilter) params.set('type', typeFilter);
    fetch(`/api/admin/coworking-space/spaces?${params}`).then(r => r.json()).then(d => setSpaces(d.spaces || []));
  }, [typeFilter]);

  useEffect(() => { load(); }, [load]);

  async function toggleAvailability(id: unknown, current: unknown) {
    await fetch(`/api/admin/coworking-space/spaces/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_available: !current }) });
    load();
  }

  async function handleAdd() {
    setSaving(true);
    const amenities = form.amenities ? form.amenities.split(',').map(s => s.trim()).filter(Boolean) : [];
    await fetch('/api/admin/coworking-space/spaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, capacity: parseInt(form.capacity) || 1, amenities, hourly_rate: form.hourly_rate || undefined, daily_rate: form.daily_rate || undefined, monthly_rate: form.monthly_rate || undefined }),
    });
    setSaving(false);
    setShowAdd(false);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
          <option value="">All Types</option>
          {['hot_desk','dedicated_desk','private_office','meeting_room','phone_booth','event_space','lounge'].map(t => (
            <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <button onClick={() => setShowAdd(true)} className="ml-auto bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-blue-700">+ Add Space</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {spaces.map((s: Record<string, unknown>) => (
          <div key={String(s.id)} className={`rounded-xl border p-4 ${SPACE_TYPE_COLORS[String(s.space_type)] || 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-semibold">{String(s.space_name)}</p>
                <p className="text-xs text-gray-500">{String(s.space_type).replace(/_/g,'  ')} · Floor {s.floor || 'N/A'} · Cap {String(s.capacity)}</p>
              </div>
              <button onClick={() => toggleAvailability(s.id, s.is_available)}
                className={`text-xs px-2 py-1 rounded font-medium ${s.is_available ? 'bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-600' : 'bg-red-100 text-red-600 hover:bg-green-100 hover:text-green-700'}`}>
                {s.is_available ? 'Available' : 'Unavailable'}
              </button>
            </div>
            <div className="text-xs text-gray-600 space-y-1">
              {s.hourly_rate && <p>${String(s.hourly_rate)}/hr</p>}
              {s.daily_rate && <p>${String(s.daily_rate)}/day</p>}
              {s.monthly_rate && <p>${String(s.monthly_rate)}/mo</p>}
            </div>
            {Array.isArray(s.amenities) && s.amenities.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {(s.amenities as string[]).slice(0, 4).map((a, i) => (
                  <span key={i} className="text-xs bg-white bg-opacity-70 rounded px-1.5 py-0.5">{a}</span>
                ))}
              </div>
            )}
          </div>
        ))}
        {spaces.length === 0 && <p className="col-span-3 text-center py-10 text-gray-400">No spaces found</p>}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">Add Space</h3>
            <div className="space-y-3">
              {['space_name','floor'].map(f => (
                <div key={f}>
                  <label className="block text-xs text-gray-500 mb-1">{f.replace(/_/g, ' ')}</label>
                  <input value={String(form[f as keyof typeof form])} onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))}
                    className="w-full border rounded px-2 py-1.5 text-sm" />
                </div>
              ))}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Type</label>
                <select value={form.space_type} onChange={e => setForm(p => ({ ...p, space_type: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm">
                  {['hot_desk','dedicated_desk','private_office','meeting_room','phone_booth','event_space','lounge'].map(t => (
                    <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Capacity</label>
                  <input type="number" value={form.capacity} onChange={e => setForm(p => ({ ...p, capacity: e.target.value }))}
                    className="w-full border rounded px-2 py-1.5 text-sm" />
                </div>
                {['hourly_rate','daily_rate','monthly_rate'].map(f => (
                  <div key={f}>
                    <label className="block text-xs text-gray-500 mb-1">{f.replace(/_/g, ' ')} ($)</label>
                    <input type="number" value={String(form[f as keyof typeof form])} onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))}
                      className="w-full border rounded px-2 py-1.5 text-sm" />
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Amenities (comma-separated)</label>
                <input value={form.amenities} onChange={e => setForm(p => ({ ...p, amenities: e.target.value }))}
                  className="w-full border rounded px-2 py-1.5 text-sm" placeholder="WiFi, Coffee, Whiteboard" />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={handleAdd} disabled={saving} className="flex-1 bg-blue-600 text-white py-2 rounded font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving…' : 'Add Space'}
              </button>
              <button onClick={() => setShowAdd(false)} className="flex-1 border rounded py-2 text-gray-600 hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Bookings Tab ─────────────────────────────────────────────────────────────
function BookingsTab() {
  const [bookings, setBookings] = useState<Record<string, unknown>[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [statusFilter, setStatusFilter] = useState('');
  const [spaces, setSpaces] = useState<Record<string, unknown>[]>([]);
  const [members, setMembers] = useState<Record<string, unknown>[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ member_id: '', space_id: '', booking_date: new Date().toISOString().slice(0, 10), start_time: '09:00', end_time: '10:00', attendees: '1', purpose: '', amount_charged: '' });
  const [conflict, setConflict] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    const params = new URLSearchParams({ date });
    if (statusFilter) params.set('status', statusFilter);
    fetch(`/api/admin/coworking-space/bookings?${params}`).then(r => r.json()).then(d => setBookings(d.bookings || []));
  }, [date, statusFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch('/api/admin/coworking-space/spaces').then(r => r.json()).then(d => setSpaces(d.spaces || []));
    fetch('/api/admin/coworking-space/members').then(r => r.json()).then(d => setMembers(d.members || []));
  }, []);

  async function handleAdd() {
    setSaving(true);
    setConflict(false);
    const res = await fetch('/api/admin/coworking-space/bookings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, attendees: parseInt(form.attendees) || 1, amount_charged: form.amount_charged || undefined, member_id: form.member_id || undefined }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.conflict) { setConflict(true); return; }
    setShowAdd(false);
    load();
  }

  async function handleStatusChange(id: unknown, status: string) {
    await fetch(`/api/admin/coworking-space/bookings/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="border rounded px-2 py-1.5 text-sm" />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
          <option value="">All Statuses</option>
          {['pending','confirmed','checked_in','completed','cancelled','no_show'].map(s => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <button onClick={() => setShowAdd(true)} className="ml-auto bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-blue-700">+ Add Booking</button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>{['Space','Member','Time','Attendees','Purpose','Amount','Status','Actions'].map(h => (
              <th key={h} className="text-left px-4 py-3 text-gray-500 font-medium">{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {bookings.map((b: Record<string, unknown>) => (
              <tr key={String(b.id)} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium">{String(b.space_name || '—')}</p>
                  <p className="text-xs text-gray-400">{String(b.space_type || '').replace(/_/g, ' ')}</p>
                </td>
                <td className="px-4 py-3">{b.first_name ? `${b.first_name} ${b.last_name}` : '—'}</td>
                <td className="px-4 py-3">{String(b.start_time || '').slice(0,5)} – {String(b.end_time || '').slice(0,5)}</td>
                <td className="px-4 py-3">{String(b.attendees)}</td>
                <td className="px-4 py-3 max-w-xs truncate">{String(b.purpose || '—')}</td>
                <td className="px-4 py-3">{b.amount_charged ? `$${Number(b.amount_charged).toFixed(2)}` : '—'}</td>
                <td className="px-4 py-3"><Badge label={String(b.status)} cls={BOOKING_STATUS_COLORS[String(b.status)] || ''} /></td>
                <td className="px-4 py-3">
                  <select value={String(b.status)} onChange={e => handleStatusChange(b.id, e.target.value)}
                    className="text-xs border rounded px-1 py-0.5">
                    {['pending','confirmed','checked_in','completed','cancelled','no_show'].map(s => (
                      <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {bookings.length === 0 && (
              <tr><td colSpan={8} className="text-center py-10 text-gray-400">No bookings for this date</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">Add Booking</h3>
            {conflict && <p className="mb-3 text-red-600 text-sm bg-red-50 rounded p-2">Space is already booked for this time slot. Please choose a different time.</p>}
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Space *</label>
                <select value={form.space_id} onChange={e => setForm(p => ({ ...p, space_id: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm">
                  <option value="">Select space…</option>
                  {spaces.filter(s => s.is_available).map(s => (
                    <option key={String(s.id)} value={String(s.id)}>{String(s.space_name)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Member (optional)</label>
                <select value={form.member_id} onChange={e => setForm(p => ({ ...p, member_id: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm">
                  <option value="">No member / walk-in</option>
                  {members.map(m => (
                    <option key={String(m.id)} value={String(m.id)}>{m.first_name} {m.last_name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-3">
                  <label className="block text-xs text-gray-500 mb-1">Date</label>
                  <input type="date" value={form.booking_date} onChange={e => setForm(p => ({ ...p, booking_date: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Start</label>
                  <input type="time" value={form.start_time} onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">End</label>
                  <input type="time" value={form.end_time} onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Attendees</label>
                  <input type="number" min="1" value={form.attendees} onChange={e => setForm(p => ({ ...p, attendees: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Purpose</label>
                <input value={form.purpose} onChange={e => setForm(p => ({ ...p, purpose: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Amount Charged ($)</label>
                <input type="number" value={form.amount_charged} onChange={e => setForm(p => ({ ...p, amount_charged: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm" />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={handleAdd} disabled={saving} className="flex-1 bg-blue-600 text-white py-2 rounded font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Checking…' : 'Add Booking'}
              </button>
              <button onClick={() => { setShowAdd(false); setConflict(false); }} className="flex-1 border rounded py-2 text-gray-600 hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Visitors Tab ─────────────────────────────────────────────────────────────
function VisitorsTab() {
  const [visitors, setVisitors] = useState<Record<string, unknown>[]>([]);
  const [members, setMembers] = useState<Record<string, unknown>[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ host_member_id: '', visitor_name: '', visitor_company: '', visit_purpose: '', scheduled_at: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    fetch('/api/admin/coworking-space/visitors').then(r => r.json()).then(d => setVisitors(d.visitors || []));
  };
  useEffect(() => {
    load();
    fetch('/api/admin/coworking-space/members').then(r => r.json()).then(d => setMembers(d.members || []));
  }, []);

  async function handleAction(id: unknown, action: string, badge?: string) {
    await fetch(`/api/admin/coworking-space/visitors/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, badge_number: badge }),
    });
    load();
  }

  async function handleAdd() {
    setSaving(true);
    await fetch('/api/admin/coworking-space/visitors', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, host_member_id: form.host_member_id || undefined, scheduled_at: form.scheduled_at || undefined }),
    });
    setSaving(false);
    setShowAdd(false);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowAdd(true)} className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-blue-700">+ Pre-register Visitor</button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>{['Visitor','Company','Host','Purpose','Scheduled','Checked In','Status','Actions'].map(h => (
              <th key={h} className="text-left px-4 py-3 text-gray-500 font-medium">{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {visitors.map((v: Record<string, unknown>) => (
              <tr key={String(v.id)} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{String(v.visitor_name)}</td>
                <td className="px-4 py-3 text-gray-600">{String(v.visitor_company || '—')}</td>
                <td className="px-4 py-3 text-gray-600">{v.host_first ? `${v.host_first} ${v.host_last}` : '—'}</td>
                <td className="px-4 py-3 max-w-xs truncate">{String(v.visit_purpose || '—')}</td>
                <td className="px-4 py-3 text-gray-500">{v.scheduled_at ? new Date(String(v.scheduled_at)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                <td className="px-4 py-3 text-gray-500">{v.checked_in_at ? new Date(String(v.checked_in_at)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                <td className="px-4 py-3">
                  {v.checked_out_at ? <Badge label="Checked Out" cls="bg-gray-100 text-gray-600" />
                    : v.checked_in_at ? <Badge label="In Building" cls="bg-green-100 text-green-700" />
                      : <Badge label="Expected" cls="bg-blue-100 text-blue-700" />}
                </td>
                <td className="px-4 py-3">
                  {!v.checked_in_at && !v.checked_out_at && (
                    <button onClick={() => { const b = prompt('Badge number (optional):') || ''; handleAction(v.id, 'check_in', b); }}
                      className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700">Check In</button>
                  )}
                  {v.checked_in_at && !v.checked_out_at && (
                    <button onClick={() => handleAction(v.id, 'check_out')}
                      className="text-xs bg-gray-600 text-white px-2 py-1 rounded hover:bg-gray-700">Check Out</button>
                  )}
                </td>
              </tr>
            ))}
            {visitors.length === 0 && (
              <tr><td colSpan={8} className="text-center py-10 text-gray-400">No visitors today</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">Pre-register Visitor</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Visitor Name *</label>
                <input value={form.visitor_name} onChange={e => setForm(p => ({ ...p, visitor_name: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Visitor Company</label>
                <input value={form.visitor_company} onChange={e => setForm(p => ({ ...p, visitor_company: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Host Member</label>
                <select value={form.host_member_id} onChange={e => setForm(p => ({ ...p, host_member_id: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm">
                  <option value="">Select host…</option>
                  {members.map(m => <option key={String(m.id)} value={String(m.id)}>{m.first_name} {m.last_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Visit Purpose</label>
                <input value={form.visit_purpose} onChange={e => setForm(p => ({ ...p, visit_purpose: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Scheduled At</label>
                <input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(p => ({ ...p, scheduled_at: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm" />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={handleAdd} disabled={saving} className="flex-1 bg-blue-600 text-white py-2 rounded font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving…' : 'Pre-register'}
              </button>
              <button onClick={() => setShowAdd(false)} className="flex-1 border rounded py-2 text-gray-600 hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── AI Sales Pitch Tab ───────────────────────────────────────────────────────
function AIPitchTab() {
  const [clientType, setClientType] = useState('startup');
  const [amenities, setAmenities] = useState<string[]>(['High-speed WiFi', 'Meeting Rooms', 'Coffee Bar', 'Printing']);
  const [customAmenity, setCustomAmenity] = useState('');
  const [pitch, setPitch] = useState('');
  const [loading, setLoading] = useState(false);

  const PRESET_AMENITIES = ['High-speed WiFi', 'Meeting Rooms', 'Coffee Bar', 'Printing', 'Lounge', 'Phone Booths', 'Event Space', 'Mail Service', '24hr Access', 'Storage Lockers', 'Bike Storage', 'Shower Facilities'];

  async function generate() {
    setLoading(true);
    setPitch('');
    const res = await fetch('/api/admin/coworking-space/ai-tour-pitch', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_type: clientType, amenities }),
    });
    const data = await res.json();
    setPitch(data.pitch || '');
    setLoading(false);
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Client Type</label>
        <div className="flex flex-wrap gap-2">
          {['startup', 'freelancer', 'remote_worker', 'corporate'].map(t => (
            <button key={t} onClick={() => setClientType(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border ${clientType === t ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {t.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Amenities to Highlight</label>
        <div className="flex flex-wrap gap-2 mb-3">
          {PRESET_AMENITIES.map(a => (
            <button key={a} onClick={() => setAmenities(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])}
              className={`px-3 py-1.5 rounded text-xs font-medium border ${amenities.includes(a) ? 'bg-blue-100 text-blue-700 border-blue-300' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {a}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={customAmenity} onChange={e => setCustomAmenity(e.target.value)} placeholder="Add custom amenity…"
            className="flex-1 border rounded px-2 py-1.5 text-sm" onKeyDown={e => { if (e.key === 'Enter' && customAmenity.trim()) { setAmenities(p => [...p, customAmenity.trim()]); setCustomAmenity(''); } }} />
          <button onClick={() => { if (customAmenity.trim()) { setAmenities(p => [...p, customAmenity.trim()]); setCustomAmenity(''); } }}
            className="bg-gray-100 px-3 rounded text-sm hover:bg-gray-200">Add</button>
        </div>
      </div>

      <button onClick={generate} disabled={loading}
        className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
        {loading ? 'Generating pitch with AI…' : 'Generate Sales Pitch'}
      </button>

      {pitch && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-700">Generated Pitch</h3>
            <button onClick={() => navigator.clipboard.writeText(pitch)} className="text-xs text-blue-600 hover:underline">Copy</button>
          </div>
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{pitch}</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CoworkingSpacePage() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-xl font-bold text-gray-900">Coworking Space &amp; Office Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Members, spaces, bookings, visitors, and AI sales tools</p>
        </div>
      </div>

      <div className="bg-white border-b border-gray-200 px-6">
        <div className="max-w-7xl mx-auto flex gap-0 overflow-x-auto">
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {activeTab === 'dashboard' && <DashboardTab />}
        {activeTab === 'members' && <MembersTab />}
        {activeTab === 'spaces' && <SpacesTab />}
        {activeTab === 'bookings' && <BookingsTab />}
        {activeTab === 'visitors' && <VisitorsTab />}
        {activeTab === 'ai-pitch' && <AIPitchTab />}
      </div>
    </div>
  );
}
