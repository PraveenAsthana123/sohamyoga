'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard', 'appointments', 'clients', 'services', 'inventory', 'ai'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = { dashboard: 'Dashboard', appointments: 'Appointments', clients: 'Clients', services: 'Services & Menu', inventory: 'Inventory', ai: 'AI Beauty Advisor' };

const SERVICE_CATEGORIES = ['hair','nails','skin','spa','makeup','waxing','lashes','other'];
const APPOINTMENT_STATUSES = ['scheduled','confirmed','in_progress','completed','cancelled','no_show'];
const PAYMENT_METHODS = ['cash','credit','debit','etransfer','gift_card'];

interface DashboardData { appointments_today: number; revenue_today: number; tips_today: number; top_stylist: { stylist: string; appointments: number; revenue: number } | null; low_stock_count: number; }
interface SalonClient { id: number; first_name: string; last_name: string; email: string; phone: string; preferred_stylist: string; skin_type: string; hair_type: string; allergies: string; loyalty_points: number; total_spent: number; visit_count: number; last_visit: string; }
interface SalonService { id: number; name: string; category: string; description: string; duration_minutes: number; price: number; stylist: string; }
interface SalonAppointment { id: number; client_id: number; service_id: number; first_name: string; last_name: string; phone: string; service_name: string; category: string; duration_minutes: number; stylist: string; appointment_at: string; status: string; notes: string; total_amount: number; tip_amount: number; payment_method: string; loyalty_points: number; }
interface SalonProduct { id: number; name: string; brand: string; category: string; sku: string; cost_price: number; retail_price: number; stock_quantity: number; reorder_level: number; low_stock: boolean; }

function fmtCad(n: number) { return `$${Number(n ?? 0).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString('en-CA') : '—'; }
function fmtDT(d: string) { return d ? new Date(d).toLocaleString('en-CA', { dateStyle: 'short', timeStyle: 'short' }) : '—'; }

function Badge({ label, color = 'gray' }: { label: string; color?: string }) {
  const map: Record<string, string> = { blue: 'bg-blue-100 text-blue-700', green: 'bg-green-100 text-green-700', amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700', purple: 'bg-purple-100 text-purple-700', gray: 'bg-gray-100 text-gray-700', teal: 'bg-teal-100 text-teal-700', pink: 'bg-pink-100 text-pink-700', orange: 'bg-orange-100 text-orange-700' };
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${map[color] ?? map.gray}`}>{label}</span>;
}

function KpiCard({ label, value, sub, color = 'pink' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const borders: Record<string, string> = { pink: 'border-l-4 border-pink-500 bg-pink-50', green: 'border-l-4 border-green-500 bg-green-50', amber: 'border-l-4 border-amber-500 bg-amber-50', red: 'border-l-4 border-red-500 bg-red-50', purple: 'border-l-4 border-purple-500 bg-purple-50', blue: 'border-l-4 border-blue-500 bg-blue-50' };
  return (
    <div className={`rounded-lg p-4 ${borders[color] ?? borders.pink}`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function apptStatusColor(s: string): string {
  const m: Record<string, string> = { scheduled: 'blue', confirmed: 'teal', in_progress: 'amber', completed: 'green', cancelled: 'gray', no_show: 'red' };
  return m[s] ?? 'gray';
}
function catColor(c: string): string {
  const m: Record<string, string> = { hair: 'purple', nails: 'pink', skin: 'teal', spa: 'blue', makeup: 'orange', waxing: 'amber', lashes: 'green' };
  return m[c] ?? 'gray';
}

// ── Add Client Modal ──
function AddClientModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '', email: '', preferred_stylist: '', skin_type: '', hair_type: '', allergies: '', notes: '' });
  const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  async function save() {
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/admin/beauty-salon/clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const d = await res.json(); if (!res.ok) { setError(d.error ?? 'Error'); return; } onSaved();
    } catch (e) { setError(String(e)); } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold mb-4">Add New Client</h3>
        {error && <div className="mb-3 p-2 bg-red-50 text-red-600 text-sm rounded">{error}</div>}
        <div className="grid grid-cols-2 gap-3">
          {[['first_name','First Name'],['last_name','Last Name'],['phone','Phone'],['email','Email'],['preferred_stylist','Preferred Stylist'],['skin_type','Skin Type'],['hair_type','Hair Type'],['allergies','Allergies']].map(([k,l]) => (
            <div key={k}><label className="text-xs text-gray-500">{l}</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={(form as Record<string,string>)[k]} onChange={e => set(k, e.target.value)} /></div>
          ))}
          <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
        </div>
        <div className="flex gap-2 mt-4 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 text-sm bg-pink-600 text-white rounded disabled:opacity-50">{saving ? 'Saving…' : 'Add Client'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Add Appointment Modal ──
function AddAppointmentModal({ clients, services, onClose, onSaved }: { clients: SalonClient[]; services: SalonService[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ client_id: '', service_id: '', stylist: '', appointment_at: '', notes: '' });
  const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  async function save() {
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/admin/beauty-salon/appointments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, client_id: Number(form.client_id), service_id: form.service_id ? Number(form.service_id) : null }) });
      const d = await res.json(); if (!res.ok) { setError(d.error ?? 'Error'); return; } onSaved();
    } catch (e) { setError(String(e)); } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold mb-4">Book Appointment</h3>
        {error && <div className="mb-3 p-2 bg-red-50 text-red-600 text-sm rounded">{error}</div>}
        <div className="space-y-3">
          <div><label className="text-xs text-gray-500">Client</label>
            <select className="w-full border rounded px-2 py-1.5 text-sm" value={form.client_id} onChange={e => set('client_id', e.target.value)}>
              <option value="">Select client…</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name} — {c.phone}</option>)}
            </select>
          </div>
          <div><label className="text-xs text-gray-500">Service (optional)</label>
            <select className="w-full border rounded px-2 py-1.5 text-sm" value={form.service_id} onChange={e => set('service_id', e.target.value)}>
              <option value="">Walk-in / TBD</option>
              {services.map(s => <option key={s.id} value={s.id}>{s.name} ({s.duration_minutes}min — {fmtCad(s.price)})</option>)}
            </select>
          </div>
          <div><label className="text-xs text-gray-500">Stylist</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.stylist} onChange={e => set('stylist', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Date & Time</label><input type="datetime-local" className="w-full border rounded px-2 py-1.5 text-sm" value={form.appointment_at} onChange={e => set('appointment_at', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
        </div>
        <div className="flex gap-2 mt-4 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 text-sm bg-pink-600 text-white rounded disabled:opacity-50">{saving ? 'Booking…' : 'Book Appointment'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Complete Appointment Modal ──
function CompleteModal({ appointment, onClose, onSaved }: { appointment: SalonAppointment; onClose: () => void; onSaved: () => void }) {
  const [total, setTotal] = useState(String(appointment.total_amount ?? ''));
  const [tip, setTip] = useState('0');
  const [method, setMethod] = useState('credit');
  const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  async function save() {
    setSaving(true); setError('');
    try {
      const res = await fetch(`/api/admin/beauty-salon/appointments/${appointment.id}/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ total_amount: Number(total), tip_amount: Number(tip), payment_method: method }) });
      const d = await res.json(); if (!res.ok) { setError(d.error ?? 'Error'); return; } onSaved();
    } catch (e) { setError(String(e)); } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <h3 className="text-lg font-bold mb-1">Complete Appointment</h3>
        <p className="text-sm text-gray-500 mb-4">{appointment.first_name} {appointment.last_name} — {appointment.service_name ?? 'Walk-in'}</p>
        {error && <div className="mb-3 p-2 bg-red-50 text-red-600 text-sm rounded">{error}</div>}
        <div className="space-y-3">
          <div><label className="text-xs text-gray-500">Total Amount (CAD)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm" value={total} onChange={e => setTotal(e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Tip (CAD)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm" value={tip} onChange={e => setTip(e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Payment Method</label>
            <select className="w-full border rounded px-2 py-1.5 text-sm" value={method} onChange={e => setMethod(e.target.value)}>
              {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace('_',' ')}</option>)}
            </select>
          </div>
          {total && <p className="text-xs text-teal-600">Loyalty points to earn: +{Math.floor(Number(total) / 10)} pts</p>}
        </div>
        <div className="flex gap-2 mt-4 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 text-sm bg-green-600 text-white rounded disabled:opacity-50">{saving ? 'Completing…' : 'Complete & Charge'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Adjust Stock Modal ──
function AdjustStockModal({ product, onClose, onSaved }: { product: SalonProduct; onClose: () => void; onSaved: () => void }) {
  const [delta, setDelta] = useState('0');
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    await fetch(`/api/admin/beauty-salon/products/${product.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stock_delta: Number(delta) }) });
    setSaving(false); onSaved();
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xs p-6">
        <h3 className="text-lg font-bold mb-2">Adjust Stock</h3>
        <p className="text-sm text-gray-500 mb-4">{product.name} — Current: {product.stock_quantity}</p>
        <label className="text-xs text-gray-500">Adjustment (+ to add, - to remove)</label>
        <input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-1" value={delta} onChange={e => setDelta(e.target.value)} />
        <p className="text-xs text-gray-400 mt-1">New total: {product.stock_quantity + Number(delta)}</p>
        <div className="flex gap-2 mt-4 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded disabled:opacity-50">{saving ? 'Saving…' : 'Update'}</button>
        </div>
      </div>
    </div>
  );
}

export default function BeautySalonPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [appointments, setAppointments] = useState<SalonAppointment[]>([]);
  const [clients, setClients] = useState<SalonClient[]>([]);
  const [services, setServices] = useState<SalonService[]>([]);
  const [products, setProducts] = useState<SalonProduct[]>([]);
  const [apptDate, setApptDate] = useState(new Date().toISOString().slice(0, 10));
  const [apptStylist, setApptStylist] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [serviceCat, setServiceCat] = useState('');
  const [showAddClient, setShowAddClient] = useState(false);
  const [showAddAppt, setShowAddAppt] = useState(false);
  const [completeAppt, setCompleteAppt] = useState<SalonAppointment | null>(null);
  const [adjustProduct, setAdjustProduct] = useState<SalonProduct | null>(null);
  const [aiClient, setAiClient] = useState<SalonClient | null>(null);
  const [aiService, setAiService] = useState('');
  const [aiConsult, setAiConsult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const loadDashboard = useCallback(async () => { const res = await fetch('/api/admin/beauty-salon'); setDashboard(await res.json()); }, []);
  const loadAppointments = useCallback(async () => {
    const p = new URLSearchParams({ date: apptDate });
    if (apptStylist) p.set('stylist', apptStylist);
    const res = await fetch(`/api/admin/beauty-salon/appointments?${p}`);
    const d = await res.json(); setAppointments(d.appointments ?? []);
  }, [apptDate, apptStylist]);
  const loadClients = useCallback(async () => {
    const p = new URLSearchParams();
    if (clientSearch) p.set('search', clientSearch);
    const res = await fetch(`/api/admin/beauty-salon/clients?${p}`);
    const d = await res.json(); setClients(d.clients ?? []);
  }, [clientSearch]);
  const loadServices = useCallback(async () => {
    const p = new URLSearchParams();
    if (serviceCat) p.set('category', serviceCat);
    const res = await fetch(`/api/admin/beauty-salon/services?${p}`);
    const d = await res.json(); setServices(d.services ?? []);
  }, [serviceCat]);
  const loadProducts = useCallback(async () => { const res = await fetch('/api/admin/beauty-salon/products'); const d = await res.json(); setProducts(d.products ?? []); }, []);

  useEffect(() => { loadDashboard(); loadClients(); loadServices(); }, [loadDashboard, loadClients, loadServices]);
  useEffect(() => { if (tab === 'appointments') loadAppointments(); }, [tab, loadAppointments]);
  useEffect(() => { if (tab === 'clients') loadClients(); }, [tab, loadClients]);
  useEffect(() => { if (tab === 'services') loadServices(); }, [tab, loadServices]);
  useEffect(() => { if (tab === 'inventory') loadProducts(); }, [tab, loadProducts]);

  async function updateApptStatus(id: number, status: string) {
    await fetch(`/api/admin/beauty-salon/appointments/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    loadAppointments(); loadDashboard();
  }
  async function generateConsultation() {
    if (!aiClient) return; setAiLoading(true); setAiConsult('');
    try {
      const res = await fetch('/api/admin/beauty-salon/ai-consultation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ skin_type: aiClient.skin_type, hair_type: aiClient.hair_type, allergies: aiClient.allergies, service: aiService, client_name: `${aiClient.first_name} ${aiClient.last_name}` }) });
      const d = await res.json(); setAiConsult(d.consultation ?? d.error ?? 'No response');
    } catch (e) { setAiConsult(String(e)); } finally { setAiLoading(false); }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-800">Beauty Salon & Spa Hub</h1>
        <p className="text-sm text-gray-500 mt-1">Appointments · Clients · Services · Inventory · AI Consultations</p>
      </div>
      <div className="bg-white border-b px-6">
        <div className="flex gap-0">
          {TABS.map(t => <button key={t} onClick={() => setTab(t)} className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-pink-500 text-pink-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{TAB_LABELS[t]}</button>)}
        </div>
      </div>
      <div className="p-6 max-w-7xl mx-auto">

        {/* DASHBOARD */}
        {tab === 'dashboard' && dashboard && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard label="Appointments Today" value={dashboard.appointments_today} color="pink" />
              <KpiCard label="Revenue Today" value={fmtCad(dashboard.revenue_today)} color="green" />
              <KpiCard label="Tips Today" value={fmtCad(dashboard.tips_today)} color="purple" />
              <KpiCard label="Low Stock Items" value={dashboard.low_stock_count} color={dashboard.low_stock_count > 0 ? 'amber' : 'blue'} />
            </div>
            {dashboard.top_stylist && (
              <div className="bg-white rounded-xl border p-5">
                <h2 className="font-semibold text-gray-700 mb-2">Top Stylist (Last 30 Days)</h2>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 font-bold text-lg">{dashboard.top_stylist.stylist[0]}</div>
                  <div>
                    <p className="font-semibold">{dashboard.top_stylist.stylist}</p>
                    <p className="text-sm text-gray-500">{dashboard.top_stylist.appointments} appointments · {fmtCad(Number(dashboard.top_stylist.revenue))} revenue</p>
                  </div>
                </div>
              </div>
            )}
            <div className="bg-white rounded-xl border p-5">
              <h2 className="font-semibold text-gray-700 mb-3">Today's Appointments Timeline</h2>
              <div className="space-y-2">
                {appointments.length === 0 ? (
                  <p className="text-sm text-gray-400">Load appointments tab to see today's schedule.</p>
                ) : appointments.map(a => (
                  <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg border">
                    <div className="text-sm font-mono text-gray-500 w-14">{new Date(a.appointment_at).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}</div>
                    <div className="flex-1"><p className="text-sm font-medium">{a.first_name} {a.last_name}</p><p className="text-xs text-gray-400">{a.service_name ?? 'Walk-in'} · {a.stylist}</p></div>
                    <Badge label={a.status} color={apptStatusColor(a.status)} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* APPOINTMENTS */}
        {tab === 'appointments' && (
          <div className="space-y-4">
            <div className="flex gap-3 items-center flex-wrap">
              <input type="date" className="border rounded px-3 py-2 text-sm" value={apptDate} onChange={e => setApptDate(e.target.value)} />
              <input className="border rounded px-3 py-2 text-sm" placeholder="Filter by stylist…" value={apptStylist} onChange={e => setApptStylist(e.target.value)} />
              <button onClick={loadAppointments} className="px-3 py-2 text-sm bg-gray-100 rounded">Filter</button>
              <button onClick={() => setShowAddAppt(true)} className="px-4 py-2 text-sm bg-pink-600 text-white rounded ml-auto">+ Book Appointment</button>
            </div>
            <div className="space-y-3">
              {appointments.map(a => (
                <div key={a.id} className="bg-white rounded-xl border p-4 flex items-start gap-4">
                  <div className="text-sm font-mono text-gray-500 w-16 pt-1">{new Date(a.appointment_at).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">{a.first_name} {a.last_name}</span>
                      <Badge label={a.status} color={apptStatusColor(a.status)} />
                      {a.service_name && <Badge label={a.category} color={catColor(a.category)} />}
                    </div>
                    <p className="text-sm text-gray-500">{a.service_name ?? 'Walk-in'} · {a.duration_minutes}min · Stylist: {a.stylist}</p>
                    {a.notes && <p className="text-xs text-gray-400 mt-1">{a.notes}</p>}
                    {a.total_amount && <p className="text-sm text-green-600 mt-1">{fmtCad(a.total_amount)} + tip {fmtCad(a.tip_amount)} · {a.payment_method}</p>}
                  </div>
                  <div className="flex gap-1 flex-wrap justify-end">
                    {a.status === 'scheduled' && <button onClick={() => updateApptStatus(a.id, 'confirmed')} className="px-2 py-1 text-xs bg-teal-100 text-teal-700 rounded">Confirm</button>}
                    {['scheduled','confirmed'].includes(a.status) && <button onClick={() => setCompleteAppt(a)} className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded">Complete</button>}
                    {['scheduled','confirmed'].includes(a.status) && <button onClick={() => updateApptStatus(a.id, 'cancelled')} className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">Cancel</button>}
                    {a.status === 'confirmed' && <button onClick={() => updateApptStatus(a.id, 'no_show')} className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded">No-Show</button>}
                  </div>
                </div>
              ))}
              {appointments.length === 0 && <div className="bg-white rounded-xl border p-8 text-center text-gray-400 text-sm">No appointments for this date.</div>}
            </div>
            {showAddAppt && <AddAppointmentModal clients={clients} services={services} onClose={() => setShowAddAppt(false)} onSaved={() => { setShowAddAppt(false); loadAppointments(); loadDashboard(); }} />}
            {completeAppt && <CompleteModal appointment={completeAppt} onClose={() => setCompleteAppt(null)} onSaved={() => { setCompleteAppt(null); loadAppointments(); loadDashboard(); }} />}
          </div>
        )}

        {/* CLIENTS */}
        {tab === 'clients' && (
          <div className="space-y-4">
            <div className="flex gap-3 items-center">
              <input className="border rounded px-3 py-2 text-sm flex-1" placeholder="Search name, phone, or email…" value={clientSearch} onChange={e => setClientSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadClients()} />
              <button onClick={loadClients} className="px-3 py-2 text-sm bg-gray-100 rounded">Search</button>
              <button onClick={() => setShowAddClient(true)} className="px-4 py-2 text-sm bg-pink-600 text-white rounded">+ Add Client</button>
            </div>
            <div className="bg-white rounded-xl border overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-gray-500 border-b bg-gray-50">{['Name','Phone','Email','Preferred Stylist','Visits','Loyalty Pts','Total Spent','Last Visit'].map(h => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead>
                <tbody>{clients.map(c => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{c.first_name} {c.last_name}</td>
                    <td className="px-4 py-3 text-gray-500">{c.phone}</td>
                    <td className="px-4 py-3 text-gray-500">{c.email ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{c.preferred_stylist ?? '—'}</td>
                    <td className="px-4 py-3 text-center">{c.visit_count}</td>
                    <td className="px-4 py-3"><Badge label={`${c.loyalty_points} pts`} color="purple" /></td>
                    <td className="px-4 py-3 text-green-600">{fmtCad(c.total_spent)}</td>
                    <td className="px-4 py-3 text-gray-500">{c.last_visit ? fmtDate(c.last_visit) : '—'}</td>
                  </tr>
                ))}</tbody>
              </table>
              {clients.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">No clients found.</p>}
            </div>
            {showAddClient && <AddClientModal onClose={() => setShowAddClient(false)} onSaved={() => { setShowAddClient(false); loadClients(); }} />}
          </div>
        )}

        {/* SERVICES */}
        {tab === 'services' && (
          <div className="space-y-4">
            <div className="flex gap-3 items-center">
              <select className="border rounded px-3 py-2 text-sm" value={serviceCat} onChange={e => setServiceCat(e.target.value)}>
                <option value="">All Categories</option>
                {SERVICE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button onClick={loadServices} className="px-3 py-2 text-sm bg-gray-100 rounded">Filter</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {services.map(s => (
                <div key={s.id} className="bg-white rounded-xl border p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold">{s.name}</h3>
                    <Badge label={s.category} color={catColor(s.category)} />
                  </div>
                  {s.description && <p className="text-sm text-gray-500 mb-2">{s.description}</p>}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">{s.duration_minutes} min{s.stylist ? ` · ${s.stylist}` : ''}</span>
                    <span className="font-bold text-pink-600">{fmtCad(s.price)}</span>
                  </div>
                </div>
              ))}
            </div>
            {services.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">No services found.</p>}
          </div>
        )}

        {/* INVENTORY */}
        {tab === 'inventory' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Product Inventory</h2>
              <div className="flex items-center gap-2 text-sm text-amber-600"><span className="w-3 h-3 bg-amber-400 rounded-full inline-block"></span>Low stock items highlighted</div>
            </div>
            <div className="bg-white rounded-xl border overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-gray-500 border-b bg-gray-50">{['Product','Brand','Category','SKU','Cost','Retail','Stock','Reorder At','Actions'].map(h => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead>
                <tbody>{products.map(p => (
                  <tr key={p.id} className={`border-b last:border-0 ${p.low_stock ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-gray-500">{p.brand ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{p.category ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{p.sku ?? '—'}</td>
                    <td className="px-4 py-3">{p.cost_price ? fmtCad(p.cost_price) : '—'}</td>
                    <td className="px-4 py-3">{p.retail_price ? fmtCad(p.retail_price) : '—'}</td>
                    <td className="px-4 py-3"><span className={`font-bold ${p.low_stock ? 'text-red-600' : 'text-gray-800'}`}>{p.stock_quantity}</span></td>
                    <td className="px-4 py-3 text-gray-500">{p.reorder_level}</td>
                    <td className="px-4 py-3"><button onClick={() => setAdjustProduct(p)} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">Adjust</button></td>
                  </tr>
                ))}</tbody>
              </table>
              {products.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">No products yet.</p>}
            </div>
            {adjustProduct && <AdjustStockModal product={adjustProduct} onClose={() => setAdjustProduct(null)} onSaved={() => { setAdjustProduct(null); loadProducts(); }} />}
          </div>
        )}

        {/* AI BEAUTY ADVISOR */}
        {tab === 'ai' && (
          <div className="max-w-2xl space-y-4">
            <div className="bg-white rounded-xl border p-6">
              <h2 className="text-lg font-semibold mb-4">AI Beauty Advisor (Ollama / llama3.2)</h2>
              <div className="space-y-3">
                <div><label className="text-xs text-gray-500">Select Client</label>
                  <select className="w-full border rounded px-2 py-1.5 text-sm mt-1" value={aiClient?.id ?? ''} onChange={e => setAiClient(clients.find(c => c.id === Number(e.target.value)) ?? null)}>
                    <option value="">Choose client…</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                  </select>
                </div>
                {aiClient && (
                  <div className="p-3 bg-pink-50 rounded text-sm grid grid-cols-2 gap-1">
                    <span className="text-gray-500">Skin:</span><span>{aiClient.skin_type ?? '—'}</span>
                    <span className="text-gray-500">Hair:</span><span>{aiClient.hair_type ?? '—'}</span>
                    <span className="text-gray-500">Allergies:</span><span>{aiClient.allergies ?? 'none'}</span>
                  </div>
                )}
                <div><label className="text-xs text-gray-500">Service Type</label>
                  <select className="w-full border rounded px-2 py-1.5 text-sm mt-1" value={aiService} onChange={e => setAiService(e.target.value)}>
                    <option value="">General consultation</option>
                    {services.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
                <button onClick={generateConsultation} disabled={aiLoading || !aiClient} className="w-full py-2 bg-pink-600 text-white rounded text-sm font-medium disabled:opacity-50">{aiLoading ? 'Generating…' : 'Generate Consultation'}</button>
              </div>
            </div>
            {aiConsult && (
              <div className="bg-white rounded-xl border p-6">
                <div className="flex justify-between mb-3">
                  <h3 className="font-semibold">Beauty Consultation</h3>
                  <button onClick={() => navigator.clipboard.writeText(aiConsult)} className="text-xs text-pink-600 border border-pink-200 px-2 py-1 rounded">Copy</button>
                </div>
                <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">{aiConsult}</pre>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
