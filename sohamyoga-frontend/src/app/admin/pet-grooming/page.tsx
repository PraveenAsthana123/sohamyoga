'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard','appointments','pets-owners','boarding','vaccinations','ai-care-card'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = {
  dashboard: 'Dashboard',
  appointments: 'Appointments',
  'pets-owners': 'Pets & Owners',
  boarding: 'Boarding',
  vaccinations: 'Vaccinations',
  'ai-care-card': 'AI Care Card',
};

const APPT_STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700',
  checked_in: 'bg-teal-100 text-teal-700',
  in_progress: 'bg-purple-100 text-purple-700',
  ready_for_pickup: 'bg-amber-100 text-amber-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-600',
  no_show: 'bg-orange-100 text-orange-700',
};
const VACC_STATUS_COLORS: Record<string, string> = {
  current: 'bg-green-100 text-green-700',
  expired: 'bg-red-100 text-red-600',
  unknown: 'bg-gray-100 text-gray-600',
};
const SPECIES_EMOJI: Record<string, string> = { dog: '🐕', cat: '🐈', rabbit: '🐇', guinea_pig: '🐹', bird: '🐦', other: '🐾' };

function Badge({ label, cls }: { label: string; cls: string }) {
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{label.replace(/_/g, ' ')}</span>;
}
function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const borders: Record<string, string> = {
    blue: 'border-l-4 border-blue-500 bg-blue-50',
    green: 'border-l-4 border-green-500 bg-green-50',
    amber: 'border-l-4 border-amber-500 bg-amber-50',
    red: 'border-l-4 border-red-500 bg-red-50',
  };
  return (
    <div className={`rounded-lg p-4 ${borders[color] ?? borders.blue}`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

// ─── Dashboard Tab ────────────────────────────────────────────────────────────
function DashboardTab() {
  const [kpis, setKpis] = useState<Record<string, number> | null>(null);
  const [todayAppts, setTodayAppts] = useState<Record<string, unknown>[]>([]);
  const [boarders, setBoarders] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    fetch('/api/admin/pet-grooming').then(r => r.json()).then(d => setKpis(d));
    const today = new Date().toISOString().slice(0, 10);
    fetch(`/api/admin/pet-grooming/appointments?date=${today}`).then(r => r.json()).then(d => setTodayAppts(d.appointments || []));
    fetch('/api/admin/pet-grooming/boarding?status=checked_in').then(r => r.json()).then(d => setBoarders(d.boardings || []));
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Appointments Today" value={kpis?.appointments_today ?? '…'} color="blue" />
        <KpiCard label="Pets Boarding Now" value={kpis?.pets_boarding_now ?? '…'} color="green" />
        <KpiCard label="Revenue Today" value={kpis ? `$${Number(kpis.revenue_today).toFixed(2)}` : '…'} color="amber" />
        <KpiCard label="Vacc. Expiring (30d)" value={kpis?.vaccination_expiring_30d ?? '…'} color="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-700 mb-3">Today's Appointment Queue</h3>
          {todayAppts.length === 0
            ? <p className="text-gray-400 text-sm text-center py-8">No appointments today</p>
            : <div className="space-y-2">
              {todayAppts.map((a: Record<string, unknown>) => (
                <div key={String(a.id)} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50">
                  <div>
                    <p className="font-medium">{String(a.pet_name)} <span className="text-gray-400 text-xs">({String(a.species || '')})</span></p>
                    <p className="text-xs text-gray-500">{String(a.service_type || '').replace(/_/g, ' ')} · {String(a.groomer || 'Unassigned')}</p>
                    <p className="text-xs text-gray-400">{String(a.owner_first || '')} {String(a.owner_last || '')} · {String(a.owner_phone || '')}</p>
                  </div>
                  <div className="text-right">
                    <Badge label={String(a.status)} cls={APPT_STATUS_COLORS[String(a.status)] || ''} />
                    <p className="text-xs text-gray-400 mt-1">{a.scheduled_at ? new Date(String(a.scheduled_at)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</p>
                  </div>
                </div>
              ))}
            </div>
          }
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-700 mb-3">Currently Boarding</h3>
          {boarders.length === 0
            ? <p className="text-gray-400 text-sm text-center py-8">No pets currently boarding</p>
            : <div className="grid grid-cols-2 gap-2">
              {boarders.map((b: Record<string, unknown>) => (
                <div key={String(b.id)} className="border border-green-200 bg-green-50 rounded-lg p-3 text-sm">
                  <p className="font-medium">{String(b.pet_name)} {SPECIES_EMOJI[String(b.species)] || '🐾'}</p>
                  <p className="text-xs text-gray-500">{String(b.kennel_number || 'No kennel')} · {String(b.breed || '')}</p>
                  <p className="text-xs text-gray-400">Out: {String(b.check_out_date || '—')}</p>
                </div>
              ))}
            </div>
          }
        </div>
      </div>
    </div>
  );
}

// ─── Appointments Tab ─────────────────────────────────────────────────────────
function AppointmentsTab() {
  const [appointments, setAppointments] = useState<Record<string, unknown>[]>([]);
  const [pets, setPets] = useState<Record<string, unknown>[]>([]);
  const [owners, setOwners] = useState<Record<string, unknown>[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [statusFilter, setStatusFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showComplete, setShowComplete] = useState<string | null>(null);
  const [form, setForm] = useState({ pet_id: '', owner_id: '', service_type: 'full_groom', scheduled_at: '', groomer: '', price: '', duration_minutes: '' });
  const [completeForm, setCompleteForm] = useState({ price: '', tip_amount: '0', payment_method: 'cash' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    const params = new URLSearchParams({ date });
    if (statusFilter) params.set('status', statusFilter);
    fetch(`/api/admin/pet-grooming/appointments?${params}`).then(r => r.json()).then(d => setAppointments(d.appointments || []));
  }, [date, statusFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch('/api/admin/pet-grooming/pets').then(r => r.json()).then(d => setPets(d.pets || []));
    fetch('/api/admin/pet-grooming/owners').then(r => r.json()).then(d => setOwners(d.owners || []));
  }, []);

  async function handleStatusChange(id: unknown, status: string) {
    await fetch(`/api/admin/pet-grooming/appointments/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    load();
  }

  async function handleAdd() {
    setSaving(true);
    await fetch('/api/admin/pet-grooming/appointments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, price: form.price || undefined, duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : undefined }),
    });
    setSaving(false);
    setShowAdd(false);
    load();
  }

  async function handleComplete(id: string) {
    setSaving(true);
    await fetch(`/api/admin/pet-grooming/appointments/${id}/complete`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...completeForm, price: parseFloat(completeForm.price), tip_amount: parseFloat(completeForm.tip_amount) || 0 }),
    });
    setSaving(false);
    setShowComplete(null);
    load();
  }

  const SERVICES = ['full_groom','bath_brush','nail_trim','ear_cleaning','teeth_brushing','de_shed','de_mat','lion_cut','boarding_night','daycare','spa_treatment'];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="border rounded px-2 py-1.5 text-sm" />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
          <option value="">All Statuses</option>
          {['scheduled','checked_in','in_progress','ready_for_pickup','completed','cancelled','no_show'].map(s => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <button onClick={() => setShowAdd(true)} className="ml-auto bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-blue-700">+ Add Appointment</button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>{['Pet','Owner','Service','Groomer','Time','Status','Actions'].map(h => (
              <th key={h} className="text-left px-4 py-3 text-gray-500 font-medium">{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {appointments.map((a: Record<string, unknown>) => (
              <tr key={String(a.id)} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium">{SPECIES_EMOJI[String(a.species)] || '🐾'} {String(a.pet_name)}</p>
                  <p className="text-xs text-gray-400">{String(a.breed || '')}</p>
                </td>
                <td className="px-4 py-3">
                  <p>{String(a.owner_first || '')} {String(a.owner_last || '')}</p>
                  <p className="text-xs text-gray-400">{String(a.owner_phone || '')}</p>
                </td>
                <td className="px-4 py-3"><Badge label={String(a.service_type)} cls="bg-blue-50 text-blue-700" /></td>
                <td className="px-4 py-3 text-gray-600">{String(a.groomer || '—')}</td>
                <td className="px-4 py-3 text-gray-500">{a.scheduled_at ? new Date(String(a.scheduled_at)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                <td className="px-4 py-3"><Badge label={String(a.status)} cls={APPT_STATUS_COLORS[String(a.status)] || ''} /></td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 flex-wrap">
                    {a.status === 'scheduled' && (
                      <button onClick={() => handleStatusChange(a.id, 'checked_in')} className="text-xs bg-teal-600 text-white px-2 py-1 rounded hover:bg-teal-700">Check In</button>
                    )}
                    {a.status === 'checked_in' && (
                      <button onClick={() => handleStatusChange(a.id, 'in_progress')} className="text-xs bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-700">Start</button>
                    )}
                    {a.status === 'in_progress' && (
                      <button onClick={() => handleStatusChange(a.id, 'ready_for_pickup')} className="text-xs bg-amber-600 text-white px-2 py-1 rounded hover:bg-amber-700">Ready</button>
                    )}
                    {a.status === 'ready_for_pickup' && (
                      <button onClick={() => { setShowComplete(String(a.id)); setCompleteForm({ price: String(a.price || ''), tip_amount: '0', payment_method: 'cash' }); }} className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700">Complete</button>
                    )}
                    {['scheduled','checked_in'].includes(String(a.status)) && (
                      <button onClick={() => handleStatusChange(a.id, 'cancelled')} className="text-xs border border-red-200 text-red-500 px-2 py-1 rounded hover:bg-red-50">Cancel</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {appointments.length === 0 && (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400">No appointments for this date</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Appointment Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">Add Appointment</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Pet *</label>
                <select value={form.pet_id} onChange={e => {
                  const pet = pets.find(p => String(p.id) === e.target.value);
                  setForm(f => ({ ...f, pet_id: e.target.value, owner_id: pet ? String(pet.owner_id || '') : f.owner_id }));
                }} className="w-full border rounded px-2 py-1.5 text-sm">
                  <option value="">Select pet…</option>
                  {pets.map(p => <option key={String(p.id)} value={String(p.id)}>{String(p.name)} ({String(p.species)}) — {String(p.owner_first)} {String(p.owner_last)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Owner *</label>
                <select value={form.owner_id} onChange={e => setForm(f => ({ ...f, owner_id: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm">
                  <option value="">Select owner…</option>
                  {owners.map(o => <option key={String(o.id)} value={String(o.id)}>{String(o.first_name)} {String(o.last_name)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Service *</label>
                <select value={form.service_type} onChange={e => setForm(f => ({ ...f, service_type: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm">
                  {SERVICES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Scheduled At *</label>
                <input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Groomer</label>
                  <input value={form.groomer} onChange={e => setForm(f => ({ ...f, groomer: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Price ($)</label>
                  <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={handleAdd} disabled={saving} className="flex-1 bg-blue-600 text-white py-2 rounded font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving…' : 'Add Appointment'}
              </button>
              <button onClick={() => setShowAdd(false)} className="flex-1 border rounded py-2 text-gray-600 hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Complete Appointment Modal */}
      {showComplete && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold mb-4">Complete Appointment</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Price ($) *</label>
                <input type="number" value={completeForm.price} onChange={e => setCompleteForm(f => ({ ...f, price: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Tip ($)</label>
                <input type="number" value={completeForm.tip_amount} onChange={e => setCompleteForm(f => ({ ...f, tip_amount: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Payment Method</label>
                <select value={completeForm.payment_method} onChange={e => setCompleteForm(f => ({ ...f, payment_method: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm">
                  {['cash','debit','credit','etransfer','app'].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => handleComplete(showComplete)} disabled={saving || !completeForm.price}
                className="flex-1 bg-green-600 text-white py-2 rounded font-medium hover:bg-green-700 disabled:opacity-50">
                {saving ? 'Saving…' : 'Complete & Collect Payment'}
              </button>
              <button onClick={() => setShowComplete(null)} className="flex-1 border rounded py-2 text-gray-600 hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Pets & Owners Tab ────────────────────────────────────────────────────────
function PetsOwnersTab() {
  const [owners, setOwners] = useState<Record<string, unknown>[]>([]);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [ownerDetail, setOwnerDetail] = useState<Record<string, unknown> | null>(null);
  const [showAddOwner, setShowAddOwner] = useState(false);
  const [showAddPet, setShowAddPet] = useState<string | null>(null);
  const [ownerForm, setOwnerForm] = useState({ first_name: '', last_name: '', phone: '', email: '', address: '', emergency_contact_name: '', emergency_contact_phone: '', vet_name: '', vet_phone: '', vet_clinic: '', notes: '' });
  const [petForm, setPetForm] = useState({ name: '', species: 'dog', breed: '', color: '', sex: 'male', weight_kg: '', spayed_neutered: false, vaccination_status: 'unknown', rabies_expiry: '', bordetella_expiry: '', distemper_expiry: '', behavioural_notes: '', allergies: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    fetch(`/api/admin/pet-grooming/owners?${params}`).then(r => r.json()).then(d => setOwners(d.owners || []));
  }, [search]);

  useEffect(() => { load(); }, [load]);

  async function handleOwnerExpand(id: string) {
    if (expanded === id) { setExpanded(null); setOwnerDetail(null); return; }
    setExpanded(id);
    const res = await fetch(`/api/admin/pet-grooming/owners/${id}`);
    const data = await res.json();
    setOwnerDetail(data);
  }

  async function handleAddOwner() {
    setSaving(true);
    await fetch('/api/admin/pet-grooming/owners', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ownerForm) });
    setSaving(false);
    setShowAddOwner(false);
    load();
  }

  async function handleAddPet(owner_id: string) {
    setSaving(true);
    await fetch('/api/admin/pet-grooming/pets', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...petForm, owner_id, weight_kg: petForm.weight_kg ? parseFloat(petForm.weight_kg) : undefined, rabies_expiry: petForm.rabies_expiry || undefined, bordetella_expiry: petForm.bordetella_expiry || undefined, distemper_expiry: petForm.distemper_expiry || undefined }),
    });
    setSaving(false);
    setShowAddPet(null);
    handleOwnerExpand(owner_id);
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search owner name, email, or phone…"
          className="flex-1 border rounded px-3 py-1.5 text-sm" onKeyDown={e => e.key === 'Enter' && load()} />
        <button onClick={load} className="bg-gray-100 px-3 py-1.5 rounded text-sm hover:bg-gray-200">Search</button>
        <button onClick={() => setShowAddOwner(true)} className="ml-auto bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-blue-700">+ Add Owner</button>
      </div>

      <div className="space-y-2">
        {owners.map((o: Record<string, unknown>) => (
          <div key={String(o.id)} className="bg-white rounded-xl border border-gray-200">
            <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50" onClick={() => handleOwnerExpand(String(o.id))}>
              <div className="flex items-center gap-4">
                <div>
                  <p className="font-medium">{String(o.first_name)} {String(o.last_name)}</p>
                  <p className="text-xs text-gray-400">{String(o.phone || '')} {o.email ? `· ${String(o.email)}` : ''}</p>
                </div>
                <div className="flex gap-3 text-sm text-gray-500">
                  <span>{String(o.pet_count)} pet{Number(o.pet_count) !== 1 ? 's' : ''}</span>
                  <span>{String(o.total_visits)} visits</span>
                  <span>${Number(o.total_spent).toFixed(0)} spent</span>
                </div>
              </div>
              <span className="text-gray-400 text-sm">{expanded === String(o.id) ? '▲' : '▼'}</span>
            </div>

            {expanded === String(o.id) && ownerDetail && (
              <div className="border-t border-gray-100 p-4">
                {/* Pets */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-sm text-gray-700">Pets</h4>
                    <button onClick={() => { setPetForm({ name: '', species: 'dog', breed: '', color: '', sex: 'male', weight_kg: '', spayed_neutered: false, vaccination_status: 'unknown', rabies_expiry: '', bordetella_expiry: '', distemper_expiry: '', behavioural_notes: '', allergies: '' }); setShowAddPet(String(o.id)); }}
                      className="text-xs text-blue-600 hover:underline">+ Add Pet</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {((ownerDetail.pets as Record<string, unknown>[]) || []).map((p: Record<string, unknown>) => (
                      <div key={String(p.id)} className="border rounded-lg p-3 bg-gray-50 text-sm">
                        <p className="font-medium">{SPECIES_EMOJI[String(p.species)] || '🐾'} {String(p.name)} <span className="text-gray-400 text-xs">({String(p.breed || 'Mixed')})</span></p>
                        <div className="flex gap-2 mt-1 flex-wrap">
                          <Badge label={String(p.vaccination_status)} cls={VACC_STATUS_COLORS[String(p.vaccination_status)] || ''} />
                          {!!p.spayed_neutered && <Badge label="Spayed/Neutered" cls="bg-teal-50 text-teal-700" />}
                          {!!p.allergies && <span className="text-xs text-red-600">⚠ {String(p.allergies)}</span>}
                        </div>
                        {!!p.last_visit && <p className="text-xs text-gray-400 mt-1">Last visit: {new Date(String(p.last_visit)).toLocaleDateString()}</p>}
                      </div>
                    ))}
                    {((ownerDetail.pets as Record<string, unknown>[]) || []).length === 0 && <p className="text-gray-400 text-xs">No pets yet</p>}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        {owners.length === 0 && <p className="text-center py-10 text-gray-400">No owners found</p>}
      </div>

      {/* Add Owner Modal */}
      {showAddOwner && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-screen overflow-y-auto p-6">
            <h3 className="text-lg font-semibold mb-4">Add Owner</h3>
            <div className="grid grid-cols-2 gap-3">
              {['first_name','last_name','phone','email','address'].map(f => (
                <div key={f} className={f === 'address' ? 'col-span-2' : ''}>
                  <label className="block text-xs text-gray-500 mb-1">{f.replace(/_/g, ' ')}</label>
                  <input value={String(ownerForm[f as keyof typeof ownerForm])} onChange={e => setOwnerForm(p => ({ ...p, [f]: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm" />
                </div>
              ))}
              <div className="col-span-2 border-t pt-3">
                <p className="text-xs font-medium text-gray-500 mb-2">Emergency Contact</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Name</label>
                    <input value={ownerForm.emergency_contact_name} onChange={e => setOwnerForm(p => ({ ...p, emergency_contact_name: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Phone</label>
                    <input value={ownerForm.emergency_contact_phone} onChange={e => setOwnerForm(p => ({ ...p, emergency_contact_phone: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm" />
                  </div>
                </div>
              </div>
              <div className="col-span-2 border-t pt-3">
                <p className="text-xs font-medium text-gray-500 mb-2">Veterinarian</p>
                <div className="grid grid-cols-3 gap-3">
                  {['vet_name','vet_phone','vet_clinic'].map(f => (
                    <div key={f}>
                      <label className="block text-xs text-gray-400 mb-1">{f.replace(/_/g, ' ')}</label>
                      <input value={String(ownerForm[f as keyof typeof ownerForm])} onChange={e => setOwnerForm(p => ({ ...p, [f]: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Notes</label>
                <textarea value={ownerForm.notes} onChange={e => setOwnerForm(p => ({ ...p, notes: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm" rows={2} />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={handleAddOwner} disabled={saving} className="flex-1 bg-blue-600 text-white py-2 rounded font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving…' : 'Add Owner'}
              </button>
              <button onClick={() => setShowAddOwner(false)} className="flex-1 border rounded py-2 text-gray-600 hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Pet Modal */}
      {showAddPet && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-screen overflow-y-auto p-6">
            <h3 className="text-lg font-semibold mb-4">Add Pet</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Pet Name *</label>
                <input value={petForm.name} onChange={e => setPetForm(p => ({ ...p, name: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Species</label>
                <select value={petForm.species} onChange={e => setPetForm(p => ({ ...p, species: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm">
                  {['dog','cat','rabbit','guinea_pig','bird','other'].map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Sex</label>
                <select value={petForm.sex} onChange={e => setPetForm(p => ({ ...p, sex: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm">
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
              {['breed','color','weight_kg'].map(f => (
                <div key={f}>
                  <label className="block text-xs text-gray-500 mb-1">{f.replace(/_/g, ' ')}</label>
                  <input type={f === 'weight_kg' ? 'number' : 'text'} value={String(petForm[f as keyof typeof petForm])} onChange={e => setPetForm(p => ({ ...p, [f]: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm" />
                </div>
              ))}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Vaccination Status</label>
                <select value={petForm.vaccination_status} onChange={e => setPetForm(p => ({ ...p, vaccination_status: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm">
                  {['current','expired','unknown'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="col-span-2 grid grid-cols-3 gap-3">
                {['rabies_expiry','bordetella_expiry','distemper_expiry'].map(f => (
                  <div key={f}>
                    <label className="block text-xs text-gray-500 mb-1">{f.replace('_expiry', '').replace(/_/g, ' ')} expiry</label>
                    <input type="date" value={String(petForm[f as keyof typeof petForm])} onChange={e => setPetForm(p => ({ ...p, [f]: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm" />
                  </div>
                ))}
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Behavioural Notes</label>
                <textarea value={petForm.behavioural_notes} onChange={e => setPetForm(p => ({ ...p, behavioural_notes: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm" rows={2} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Allergies</label>
                <input value={petForm.allergies} onChange={e => setPetForm(p => ({ ...p, allergies: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm" />
              </div>
              <div className="col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={petForm.spayed_neutered} onChange={e => setPetForm(p => ({ ...p, spayed_neutered: e.target.checked }))} />
                  Spayed / Neutered
                </label>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => handleAddPet(showAddPet)} disabled={saving} className="flex-1 bg-blue-600 text-white py-2 rounded font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving…' : 'Add Pet'}
              </button>
              <button onClick={() => setShowAddPet(null)} className="flex-1 border rounded py-2 text-gray-600 hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Boarding Tab ─────────────────────────────────────────────────────────────
function BoardingTab() {
  const [boardings, setBoardings] = useState<Record<string, unknown>[]>([]);
  const [pets, setPets] = useState<Record<string, unknown>[]>([]);
  const [owners, setOwners] = useState<Record<string, unknown>[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ pet_id: '', owner_id: '', check_in_date: '', check_out_date: '', kennel_number: '', daily_rate: '', feeding_instructions: '', medication_instructions: '', exercise_level: 'standard', special_requests: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    fetch(`/api/admin/pet-grooming/boarding?${params}`).then(r => r.json()).then(d => setBoardings(d.boardings || []));
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch('/api/admin/pet-grooming/pets').then(r => r.json()).then(d => setPets(d.pets || []));
    fetch('/api/admin/pet-grooming/owners').then(r => r.json()).then(d => setOwners(d.owners || []));
  }, []);

  async function handleAction(id: unknown, action: string) {
    await fetch(`/api/admin/pet-grooming/boarding/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    load();
  }

  async function handleAdd() {
    setSaving(true);
    await fetch('/api/admin/pet-grooming/boarding', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, daily_rate: form.daily_rate ? parseFloat(form.daily_rate) : undefined }),
    });
    setSaving(false);
    setShowAdd(false);
    load();
  }

  const STATUS_COLORS: Record<string, string> = {
    reserved: 'bg-blue-100 text-blue-700',
    checked_in: 'bg-green-100 text-green-700',
    checked_out: 'bg-gray-100 text-gray-600',
    cancelled: 'bg-red-100 text-red-600',
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
          <option value="">All Statuses</option>
          {['reserved','checked_in','checked_out','cancelled'].map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <button onClick={() => setShowAdd(true)} className="ml-auto bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-blue-700">+ Add Boarding</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {boardings.map((b: Record<string, unknown>) => (
          <div key={String(b.id)} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-semibold">{SPECIES_EMOJI[String(b.species)] || '🐾'} {String(b.pet_name)}</p>
                <p className="text-xs text-gray-400">{String(b.breed || '')} · Kennel {String(b.kennel_number || 'TBD')}</p>
              </div>
              <Badge label={String(b.status)} cls={STATUS_COLORS[String(b.status)] || ''} />
            </div>
            <div className="text-xs text-gray-600 space-y-1 mb-3">
              <p>Owner: {String(b.owner_first || '')} {String(b.owner_last || '')} · {String(b.owner_phone || '')}</p>
              <p>Check-in: {String(b.check_in_date || '—')} → Check-out: {String(b.check_out_date || '—')}</p>
              {!!b.daily_rate && <p>Rate: ${String(b.daily_rate)}/night · Total: ${Number(b.total_amount).toFixed(2)}</p>}
              {!!b.feeding_instructions && <p>Feeding: {String(b.feeding_instructions).slice(0, 60)}…</p>}
              {!!b.exercise_level && <p>Exercise: {String(b.exercise_level)}</p>}
            </div>
            <div className="flex gap-2 border-t border-gray-100 pt-3">
              {b.status === 'reserved' && (
                <button onClick={() => handleAction(b.id, 'check_in')} className="flex-1 text-xs bg-green-600 text-white py-1.5 rounded hover:bg-green-700">Check In</button>
              )}
              {b.status === 'checked_in' && (
                <button onClick={() => handleAction(b.id, 'check_out')} className="flex-1 text-xs bg-gray-600 text-white py-1.5 rounded hover:bg-gray-700">Check Out</button>
              )}
              {['reserved','checked_in'].includes(String(b.status)) && (
                <button onClick={() => handleAction(b.id, 'cancelled')} className="flex-1 text-xs border border-red-200 text-red-500 py-1.5 rounded hover:bg-red-50">Cancel</button>
              )}
            </div>
          </div>
        ))}
        {boardings.length === 0 && <p className="col-span-3 text-center py-10 text-gray-400">No boarding records found</p>}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-screen overflow-y-auto p-6">
            <h3 className="text-lg font-semibold mb-4">Add Boarding Reservation</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Pet *</label>
                <select value={form.pet_id} onChange={e => {
                  const pet = pets.find(p => String(p.id) === e.target.value);
                  setForm(f => ({ ...f, pet_id: e.target.value, owner_id: pet ? String(pet.owner_id || '') : f.owner_id }));
                }} className="w-full border rounded px-2 py-1.5 text-sm">
                  <option value="">Select pet…</option>
                  {pets.map(p => <option key={String(p.id)} value={String(p.id)}>{String(p.name)} ({String(p.species)}) — {String(p.owner_first)} {String(p.owner_last)}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Check-in Date *</label>
                  <input type="date" value={form.check_in_date} onChange={e => setForm(f => ({ ...f, check_in_date: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Check-out Date *</label>
                  <input type="date" value={form.check_out_date} onChange={e => setForm(f => ({ ...f, check_out_date: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Kennel Number</label>
                  <input value={form.kennel_number} onChange={e => setForm(f => ({ ...f, kennel_number: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Daily Rate ($)</label>
                  <input type="number" value={form.daily_rate} onChange={e => setForm(f => ({ ...f, daily_rate: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Exercise Level</label>
                <select value={form.exercise_level} onChange={e => setForm(f => ({ ...f, exercise_level: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm">
                  <option value="minimal">Minimal</option>
                  <option value="standard">Standard</option>
                  <option value="active">Active</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Feeding Instructions</label>
                <textarea value={form.feeding_instructions} onChange={e => setForm(f => ({ ...f, feeding_instructions: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm" rows={2} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Medication Instructions</label>
                <textarea value={form.medication_instructions} onChange={e => setForm(f => ({ ...f, medication_instructions: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm" rows={2} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Special Requests</label>
                <input value={form.special_requests} onChange={e => setForm(f => ({ ...f, special_requests: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm" />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={handleAdd} disabled={saving} className="flex-1 bg-blue-600 text-white py-2 rounded font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving…' : 'Create Reservation'}
              </button>
              <button onClick={() => setShowAdd(false)} className="flex-1 border rounded py-2 text-gray-600 hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Vaccinations Tab ─────────────────────────────────────────────────────────
function VaccinationsTab() {
  const [petsDue, setPetsDue] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    fetch('/api/admin/pet-grooming/vaccinations-due').then(r => r.json()).then(d => setPetsDue(d.pets_due || []));
  }, []);

  function daysUntil(dateStr: string): number {
    return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
  }

  function urgencyColor(days: number): string {
    if (days <= 7) return 'border-red-300 bg-red-50';
    if (days <= 14) return 'border-amber-300 bg-amber-50';
    return 'border-yellow-200 bg-yellow-50';
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">Vaccinations Due in 30 Days</h3>
        <span className="text-sm text-gray-500">{petsDue.length} pet{petsDue.length !== 1 ? 's' : ''} need attention</span>
      </div>

      {petsDue.length === 0
        ? <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">No vaccinations due in the next 30 days</div>
        : <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {petsDue.map((p: Record<string, unknown>) => {
            const soonestDays = p.soonest_expiry ? daysUntil(String(p.soonest_expiry)) : 999;
            return (
              <div key={String(p.id)} className={`rounded-xl border p-4 ${urgencyColor(soonestDays)}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold">{SPECIES_EMOJI[String(p.species)] || '🐾'} {String(p.name)}</p>
                    <p className="text-xs text-gray-500">{String(p.breed || '')} · {String(p.owner_first || '')} {String(p.owner_last || '')}</p>
                    <p className="text-xs text-gray-400">{String(p.owner_phone || '')} {p.owner_email ? `· ${String(p.owner_email)}` : ''}</p>
                  </div>
                  <span className={`text-xs font-bold ${soonestDays <= 7 ? 'text-red-600' : soonestDays <= 14 ? 'text-amber-600' : 'text-yellow-700'}`}>
                    {soonestDays <= 0 ? 'OVERDUE' : `${soonestDays}d`}
                  </span>
                </div>
                <div className="space-y-1 text-xs">
                  {!!p.rabies_due && !!p.rabies_expiry && (
                    <div className="flex justify-between">
                      <span className="text-red-600 font-medium">Rabies due</span>
                      <span>{String(p.rabies_expiry).slice(0, 10)} ({daysUntil(String(p.rabies_expiry))}d)</span>
                    </div>
                  )}
                  {!!p.bordetella_due && !!p.bordetella_expiry && (
                    <div className="flex justify-between">
                      <span className="text-amber-600 font-medium">Bordetella due</span>
                      <span>{String(p.bordetella_expiry).slice(0, 10)} ({daysUntil(String(p.bordetella_expiry))}d)</span>
                    </div>
                  )}
                  {!!p.distemper_due && !!p.distemper_expiry && (
                    <div className="flex justify-between">
                      <span className="text-amber-600 font-medium">Distemper due</span>
                      <span>{String(p.distemper_expiry).slice(0, 10)} ({daysUntil(String(p.distemper_expiry))}d)</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => {
                    const msg = `Hi ${p.owner_first}, this is a reminder that ${p.name}'s vaccination is due soon. Please contact your vet at your earliest convenience.`;
                    alert(`Reminder message:\n\n${msg}\n\n(In production: send via SMS/email to ${p.owner_phone || p.owner_email})`);
                  }}
                  className="mt-3 w-full text-xs border border-gray-300 text-gray-600 py-1.5 rounded hover:bg-white">
                  Send Reminder
                </button>
              </div>
            );
          })}
        </div>
      }
    </div>
  );
}

// ─── AI Care Card Tab ─────────────────────────────────────────────────────────
function AICareCardTab() {
  const [pets, setPets] = useState<Record<string, unknown>[]>([]);
  const [boardings, setBoardings] = useState<Record<string, unknown>[]>([]);
  const [selectedPet, setSelectedPet] = useState('');
  const [selectedBoarding, setSelectedBoarding] = useState('');
  const [careCard, setCareCard] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/admin/pet-grooming/pets').then(r => r.json()).then(d => setPets(d.pets || []));
    fetch('/api/admin/pet-grooming/boarding?status=checked_in').then(r => r.json()).then(d => setBoardings(d.boardings || []));
  }, []);

  async function generate() {
    if (!selectedPet) return;
    setLoading(true);
    setCareCard('');
    const res = await fetch('/api/admin/pet-grooming/ai-care-card', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pet_id: selectedPet, boarding_id: selectedBoarding || undefined }),
    });
    const data = await res.json();
    setCareCard(data.care_card || '');
    setLoading(false);
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Select Pet *</label>
          <select value={selectedPet} onChange={e => setSelectedPet(e.target.value)} className="w-full border rounded px-2 py-2 text-sm">
            <option value="">Choose a pet…</option>
            {pets.map(p => (
              <option key={String(p.id)} value={String(p.id)}>
                {SPECIES_EMOJI[String(p.species)] || '🐾'} {String(p.name)} ({String(p.species)}) — {String(p.owner_first || '')} {String(p.owner_last || '')}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Link to Boarding Record (optional)</label>
          <select value={selectedBoarding} onChange={e => setSelectedBoarding(e.target.value)} className="w-full border rounded px-2 py-2 text-sm">
            <option value="">No boarding record</option>
            {boardings.map(b => (
              <option key={String(b.id)} value={String(b.id)}>
                {String(b.pet_name)} · Kennel {String(b.kennel_number || '?')} · {String(b.check_in_date)} → {String(b.check_out_date)}
              </option>
            ))}
          </select>
        </div>
        <button onClick={generate} disabled={loading || !selectedPet}
          className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
          {loading ? 'Generating care card with AI…' : 'Generate Boarding Care Card'}
        </button>
      </div>

      {careCard && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-700">Pet Care Card</h3>
            <div className="flex gap-2">
              <button onClick={() => navigator.clipboard.writeText(careCard)} className="text-xs text-blue-600 hover:underline">Copy</button>
              <button onClick={() => window.print()} className="text-xs text-gray-500 hover:underline">Print</button>
            </div>
          </div>
          <pre className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{careCard}</pre>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PetGroomingPage() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-xl font-bold text-gray-900">Pet Grooming &amp; Boarding Hub</h1>
          <p className="text-sm text-gray-500 mt-0.5">Appointments, pets, boarding, vaccinations, and AI care cards</p>
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
        {activeTab === 'appointments' && <AppointmentsTab />}
        {activeTab === 'pets-owners' && <PetsOwnersTab />}
        {activeTab === 'boarding' && <BoardingTab />}
        {activeTab === 'vaccinations' && <VaccinationsTab />}
        {activeTab === 'ai-care-card' && <AICareCardTab />}
      </div>
    </div>
  );
}
