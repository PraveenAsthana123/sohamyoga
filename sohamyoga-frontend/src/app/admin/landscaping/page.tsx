'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard', 'jobs', 'clients', 'equipment', 'routes', 'ai-tools'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = {
  dashboard: 'Dashboard', jobs: 'Jobs', clients: 'Clients',
  equipment: 'Equipment', routes: 'Routes', 'ai-tools': 'AI Tools',
};

const SERVICE_TYPES = ['lawn_mowing','snow_removal','spring_cleanup','fall_cleanup','fertilizing','aeration','overseeding','hedge_trimming','tree_pruning','irrigation_startup','irrigation_winterize','sod_installation','flower_bed','mulching','power_washing','other'];
const PROPERTY_TYPES = ['residential','commercial','condo','strata','municipal'];
const EQUIPMENT_TYPES = ['mower','snow_blower','plow_truck','trailer','trimmer','edger','blower','spreader','aerator','sprayer','other'];
const PAYMENT_STATUSES = ['pending','invoiced','paid','overdue'];

interface DashData { jobs_today: number; crew_in_field: number; revenue_mtd: number; equipment_needing_service: number; weather_holds_today: number; today_jobs: LsJob[]; }
interface LsClient { id: number; first_name: string; last_name: string; email: string; phone: string; address: string; city: string; property_type: string; lot_size_sqft: number; has_irrigation: boolean; dog_on_property: boolean; gate_code: string; special_notes: string; services_subscribed: string[]; seasonal_contract_value: number; contract_type: string; status: string; }
interface LsJob { id: number; client_id: number; client_name: string; address: string; dog_on_property: boolean; gate_code: string; service_type: string; job_date: string; scheduled_time: string; crew_size: number; status: string; duration_minutes: number; price: number; materials_cost: number; tip_amount: number; payment_status: string; quality_rating: number; notes: string; }
interface Equipment { id: number; equipment_name: string; equipment_type: string; make: string; model: string; year: number; status: string; last_service_date: string; next_service_date: string; service_days_remaining: number; notes: string; }
interface Route { id: number; route_name: string; route_date: string; crew_lead: string; vehicle: string; job_ids: number[]; status: string; estimated_hours: number; actual_hours: number; }

function fmtCad(n: number) { return `$${Number(n ?? 0).toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`; }
function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString('en-CA') : '—'; }
function fmtTime(t: string) { return t ? t.substring(0, 5) : '—'; }

function Badge({ label, color = 'gray' }: { label: string; color?: string }) {
  const map: Record<string, string> = { blue: 'bg-blue-100 text-blue-700', green: 'bg-green-100 text-green-700', amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700', purple: 'bg-purple-100 text-purple-700', gray: 'bg-gray-100 text-gray-700', teal: 'bg-teal-100 text-teal-700', orange: 'bg-orange-100 text-orange-700', sky: 'bg-sky-100 text-sky-700' };
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${map[color] ?? map.gray}`}>{label}</span>;
}

function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const borders: Record<string, string> = { blue: 'border-l-4 border-blue-500 bg-blue-50', green: 'border-l-4 border-green-500 bg-green-50', amber: 'border-l-4 border-amber-500 bg-amber-50', red: 'border-l-4 border-red-500 bg-red-50', purple: 'border-l-4 border-purple-500 bg-purple-50', teal: 'border-l-4 border-teal-500 bg-teal-50', sky: 'border-l-4 border-sky-500 bg-sky-50' };
  return (
    <div className={`rounded-lg p-4 ${borders[color] ?? borders.blue}`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function jobStatusColor(s: string) {
  const m: Record<string, string> = { scheduled: 'gray', en_route: 'sky', in_progress: 'blue', completed: 'green', cancelled: 'red', weather_hold: 'amber' };
  return m[s] ?? 'gray';
}
function paymentColor(s: string) {
  const m: Record<string, string> = { pending: 'amber', invoiced: 'blue', paid: 'green', overdue: 'red' };
  return m[s] ?? 'gray';
}
function equipStatusColor(s: string) {
  const m: Record<string, string> = { operational: 'green', maintenance: 'amber', repair: 'red', retired: 'gray' };
  return m[s] ?? 'gray';
}

// ─── Modal: Add Client ─────────────────────────────────────────────────────────
function AddClientModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', address: '', city: 'Calgary', province: 'AB', postal_code: '', property_type: 'residential', lot_size_sqft: '', has_irrigation: false, dog_on_property: false, gate_code: '', fence_type: '', special_notes: '', seasonal_contract_value: '', contract_type: 'seasonal' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.first_name || !form.last_name || !form.phone || !form.address) return;
    setSaving(true);
    try {
      await fetch('/api/admin/landscaping/clients', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, lot_size_sqft: form.lot_size_sqft ? parseInt(form.lot_size_sqft) : null, seasonal_contract_value: form.seasonal_contract_value ? parseFloat(form.seasonal_contract_value) : null }),
      });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold mb-4">Add Client</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500">First Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.first_name} onChange={e => f('first_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Last Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.last_name} onChange={e => f('last_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Email</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.email} onChange={e => f('email', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Phone *</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.phone} onChange={e => f('phone', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Address *</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.address} onChange={e => f('address', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">City</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.city} onChange={e => f('city', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Postal Code</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.postal_code} onChange={e => f('postal_code', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Property Type</label>
            <select className="w-full border rounded px-2 py-1.5 text-sm" value={form.property_type} onChange={e => f('property_type', e.target.value)}>
              {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div><label className="text-xs text-gray-500">Lot Size (sqft)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm" value={form.lot_size_sqft} onChange={e => f('lot_size_sqft', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Contract Value (seasonal $)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm" value={form.seasonal_contract_value} onChange={e => f('seasonal_contract_value', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Gate Code</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.gate_code} onChange={e => f('gate_code', e.target.value)} /></div>
          <div className="col-span-2 flex gap-4">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.has_irrigation} onChange={e => f('has_irrigation', e.target.checked)} />Has Irrigation</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.dog_on_property} onChange={e => f('dog_on_property', e.target.checked)} />Dog on Property</label>
          </div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Special Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm" rows={2} value={form.special_notes} onChange={e => f('special_notes', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="px-4 py-2 rounded border text-sm" onClick={onClose}>Cancel</button>
          <button className="px-4 py-2 rounded bg-green-600 text-white text-sm" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Add Client'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Add Job ────────────────────────────────────────────────────────────
function AddJobModal({ clients, onClose, onSaved }: { clients: LsClient[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ client_id: '', service_type: 'lawn_mowing', job_date: new Date().toISOString().split('T')[0], scheduled_time: '09:00', crew_size: '2', price: '', materials_cost: '0', notes: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.service_type || !form.job_date || !form.price) return;
    setSaving(true);
    try {
      await fetch('/api/admin/landscaping/jobs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, client_id: form.client_id ? parseInt(form.client_id) : null, crew_size: parseInt(form.crew_size), price: parseFloat(form.price), materials_cost: parseFloat(form.materials_cost) }),
      });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold mb-4">Add Job</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs text-gray-500">Client</label>
            <select className="w-full border rounded px-2 py-1.5 text-sm" value={form.client_id} onChange={e => f('client_id', e.target.value)}>
              <option value="">— Select Client —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name} — {c.address}</option>)}
            </select>
          </div>
          <div><label className="text-xs text-gray-500">Service Type *</label>
            <select className="w-full border rounded px-2 py-1.5 text-sm" value={form.service_type} onChange={e => f('service_type', e.target.value)}>
              {SERVICE_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div><label className="text-xs text-gray-500">Date *</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm" value={form.job_date} onChange={e => f('job_date', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Scheduled Time</label><input type="time" className="w-full border rounded px-2 py-1.5 text-sm" value={form.scheduled_time} onChange={e => f('scheduled_time', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Crew Size</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm" value={form.crew_size} onChange={e => f('crew_size', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Price ($) *</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm" value={form.price} onChange={e => f('price', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Materials Cost ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm" value={form.materials_cost} onChange={e => f('materials_cost', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm" rows={2} value={form.notes} onChange={e => f('notes', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="px-4 py-2 rounded border text-sm" onClick={onClose}>Cancel</button>
          <button className="px-4 py-2 rounded bg-green-600 text-white text-sm" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Add Job'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Complete Job ───────────────────────────────────────────────────────
function CompleteJobModal({ job, onClose, onSaved }: { job: LsJob; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ duration_minutes: '', materials_cost: String(job.materials_cost ?? 0), tip_amount: '0', quality_rating: '5', notes: '', payment_status: 'invoiced' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    setSaving(true);
    try {
      await fetch(`/api/admin/landscaping/jobs/${job.id}/complete`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : null, materials_cost: parseFloat(form.materials_cost), tip_amount: parseFloat(form.tip_amount), quality_rating: parseInt(form.quality_rating) }),
      });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold mb-1">Complete Job</h2>
        <p className="text-sm text-gray-500 mb-4">{job.service_type.replace(/_/g, ' ')} · {job.client_name}</p>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500">Duration (min)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm" value={form.duration_minutes} onChange={e => f('duration_minutes', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Materials ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm" value={form.materials_cost} onChange={e => f('materials_cost', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Tip ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm" value={form.tip_amount} onChange={e => f('tip_amount', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Quality (1-5)</label><input type="number" min="1" max="5" className="w-full border rounded px-2 py-1.5 text-sm" value={form.quality_rating} onChange={e => f('quality_rating', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Payment Status</label>
            <select className="w-full border rounded px-2 py-1.5 text-sm" value={form.payment_status} onChange={e => f('payment_status', e.target.value)}>
              {PAYMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm" rows={2} value={form.notes} onChange={e => f('notes', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="px-4 py-2 rounded border text-sm" onClick={onClose}>Cancel</button>
          <button className="px-4 py-2 rounded bg-green-600 text-white text-sm" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Mark Complete'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Add Equipment ──────────────────────────────────────────────────────
function AddEquipmentModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ equipment_name: '', equipment_type: 'mower', make: '', model: '', year: '', serial_number: '', fuel_type: '', purchase_date: '', last_service_date: '', next_service_date: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.equipment_name) return;
    setSaving(true);
    try {
      await fetch('/api/admin/landscaping/equipment', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, year: form.year ? parseInt(form.year) : null }),
      });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold mb-4">Add Equipment</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs text-gray-500">Equipment Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.equipment_name} onChange={e => f('equipment_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Type</label>
            <select className="w-full border rounded px-2 py-1.5 text-sm" value={form.equipment_type} onChange={e => f('equipment_type', e.target.value)}>
              {EQUIPMENT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div><label className="text-xs text-gray-500">Make</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.make} onChange={e => f('make', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Model</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.model} onChange={e => f('model', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Year</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm" value={form.year} onChange={e => f('year', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Serial #</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.serial_number} onChange={e => f('serial_number', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Fuel Type</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.fuel_type} onChange={e => f('fuel_type', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Purchase Date</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm" value={form.purchase_date} onChange={e => f('purchase_date', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Last Service</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm" value={form.last_service_date} onChange={e => f('last_service_date', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Next Service</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm" value={form.next_service_date} onChange={e => f('next_service_date', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm" rows={2} value={form.notes} onChange={e => f('notes', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="px-4 py-2 rounded border text-sm" onClick={onClose}>Cancel</button>
          <button className="px-4 py-2 rounded bg-green-600 text-white text-sm" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Add Equipment'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function LandscapingPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [dash, setDash] = useState<DashData | null>(null);
  const [clients, setClients] = useState<LsClient[]>([]);
  const [jobs, setJobs] = useState<LsJob[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [jobDate, setJobDate] = useState(new Date().toISOString().split('T')[0]);
  const [serviceFilter, setServiceFilter] = useState('');
  const [showAddClient, setShowAddClient] = useState(false);
  const [showAddJob, setShowAddJob] = useState(false);
  const [showAddEquip, setShowAddEquip] = useState(false);
  const [completingJob, setCompletingJob] = useState<LsJob | null>(null);
  const [aiQuote, setAiQuote] = useState('');
  const [aiSnowPlan, setAiSnowPlan] = useState('');
  const [aiLoading, setAiLoading] = useState<'quote' | 'snow' | null>(null);
  const [aiForm, setAiForm] = useState({ property_type: 'residential', lot_size_sqft: '5000', frequency: 'weekly', service_types: ['lawn_mowing'] });
  const [routeDate, setRouteDate] = useState(new Date().toISOString().split('T')[0]);

  const loadDash = useCallback(async () => { const r = await fetch('/api/admin/landscaping'); setDash(await r.json()); }, []);
  const loadClients = useCallback(async () => { const r = await fetch('/api/admin/landscaping/clients'); setClients(await r.json()); }, []);
  const loadJobs = useCallback(async (date: string, service = '') => {
    const url = `/api/admin/landscaping/jobs?date=${date}${service ? `&service_type=${service}` : ''}`;
    const r = await fetch(url); setJobs(await r.json());
  }, []);
  const loadEquipment = useCallback(async () => { const r = await fetch('/api/admin/landscaping/equipment'); setEquipment(await r.json()); }, []);
  const loadRoutes = useCallback(async (date: string) => { const r = await fetch(`/api/admin/landscaping/routes?date=${date}`); setRoutes(await r.json()); }, []);

  useEffect(() => { loadDash(); loadClients(); }, []);
  useEffect(() => { if (tab === 'jobs') loadJobs(jobDate, serviceFilter); }, [tab, jobDate, serviceFilter]);
  useEffect(() => { if (tab === 'equipment') loadEquipment(); }, [tab]);
  useEffect(() => { if (tab === 'routes') loadRoutes(routeDate); }, [tab, routeDate]);

  async function jobAction(id: number, action: string) {
    await fetch(`/api/admin/landscaping/jobs/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
    loadJobs(jobDate, serviceFilter);
    loadDash();
  }

  async function runAiQuote() {
    setAiLoading('quote');
    try {
      const r = await fetch('/api/admin/landscaping/ai-quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(aiForm) });
      const d = await r.json();
      setAiQuote(d.quote);
    } finally { setAiLoading(null); }
  }

  async function runAiSnow() {
    setAiLoading('snow');
    try {
      const r = await fetch('/api/admin/landscaping/ai-snow-plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(aiForm) });
      const d = await r.json();
      setAiSnowPlan(d.plan);
    } finally { setAiLoading(null); }
  }

  function toggleAiService(s: string) {
    setAiForm(p => ({ ...p, service_types: p.service_types.includes(s) ? p.service_types.filter(x => x !== s) : [...p.service_types, s] }));
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-slate-800 text-white px-6 py-4">
        <h1 className="text-xl font-bold">Landscaping & Snow Removal Hub</h1>
        <p className="text-slate-300 text-sm mt-0.5">Job scheduling, crew dispatch, equipment management — Calgary, AB</p>
      </div>

      <div className="bg-white border-b px-6">
        <div className="flex gap-1">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {/* ── Dashboard ── */}
        {tab === 'dashboard' && dash && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <KpiCard label="Jobs Today" value={dash.jobs_today} color="green" />
              <KpiCard label="Crew in Field" value={dash.crew_in_field} color="blue" />
              <KpiCard label="Revenue MTD" value={fmtCad(dash.revenue_mtd)} color="teal" />
              <KpiCard label="Equip. Service Due" value={dash.equipment_needing_service} sub="Within 14 days" color="amber" />
              <KpiCard label="Weather Holds" value={dash.weather_holds_today} color="sky" />
            </div>

            <div className="bg-white rounded-xl shadow-sm border p-5">
              <h2 className="font-semibold mb-4">Today's Job Board</h2>
              {dash.today_jobs.length === 0 ? (
                <p className="text-gray-400 text-sm">No jobs scheduled today.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-gray-500 border-b"><th className="pb-2">Client</th><th className="pb-2">Service</th><th className="pb-2">Address</th><th className="pb-2">Time</th><th className="pb-2">Crew</th><th className="pb-2">Price</th><th className="pb-2">Status</th></tr></thead>
                    <tbody>
                      {dash.today_jobs.map(j => (
                        <tr key={j.id} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="py-2">{j.client_name ?? '—'}</td>
                          <td className="py-2 capitalize">{j.service_type.replace(/_/g, ' ')}</td>
                          <td className="py-2 text-gray-500 text-xs">{j.address ?? '—'}</td>
                          <td className="py-2">{fmtTime(j.scheduled_time)}</td>
                          <td className="py-2">{j.crew_size}</td>
                          <td className="py-2">{fmtCad(j.price)}</td>
                          <td className="py-2"><Badge label={j.status.replace(/_/g, ' ')} color={jobStatusColor(j.status)} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Jobs ── */}
        {tab === 'jobs' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <input type="date" className="border rounded px-3 py-1.5 text-sm" value={jobDate} onChange={e => setJobDate(e.target.value)} />
                <select className="border rounded px-3 py-1.5 text-sm" value={serviceFilter} onChange={e => setServiceFilter(e.target.value)}>
                  <option value="">All Services</option>
                  {SERVICE_TYPES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
                <span className="text-sm text-gray-500">{jobs.length} jobs</span>
              </div>
              <button onClick={() => setShowAddJob(true)} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium">+ Add Job</button>
            </div>
            <div className="grid gap-3">
              {jobs.map(j => (
                <div key={j.id} className="bg-white rounded-xl border p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-medium">{j.client_name ?? 'No client'}</span>
                        <Badge label={j.service_type.replace(/_/g, ' ')} color="green" />
                        <Badge label={j.status.replace(/_/g, ' ')} color={jobStatusColor(j.status)} />
                        <Badge label={j.payment_status} color={paymentColor(j.payment_status)} />
                        {j.dog_on_property && <Badge label="Dog" color="amber" />}
                        {j.gate_code && <Badge label={`Gate: ${j.gate_code}`} color="purple" />}
                      </div>
                      <p className="text-sm text-gray-500">{j.address ?? '—'} · {fmtTime(j.scheduled_time)} · Crew: {j.crew_size}</p>
                      <p className="text-sm font-medium text-green-700">{fmtCad(j.price)}{j.tip_amount > 0 ? ` + ${fmtCad(j.tip_amount)} tip` : ''} · {j.duration_minutes ? `${j.duration_minutes}min` : ''}</p>
                      {j.quality_rating && <div className="flex mt-1">{'★'.repeat(j.quality_rating)}{'☆'.repeat(5 - j.quality_rating)}</div>}
                    </div>
                    <div className="flex gap-2 ml-4 flex-col">
                      {j.status === 'scheduled' && <button onClick={() => jobAction(j.id, 'en_route')} className="text-xs bg-sky-600 text-white px-3 py-1.5 rounded">En Route</button>}
                      {j.status === 'en_route' && <button onClick={() => jobAction(j.id, 'start')} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded">Start Job</button>}
                      {j.status === 'in_progress' && <button onClick={() => setCompletingJob(j)} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded">Complete</button>}
                      {(j.status === 'scheduled' || j.status === 'en_route') && <button onClick={() => jobAction(j.id, 'weather_hold')} className="text-xs bg-amber-100 text-amber-700 px-3 py-1.5 rounded">Weather Hold</button>}
                    </div>
                  </div>
                  {j.notes && <p className="text-xs text-gray-500 mt-2 italic">{j.notes}</p>}
                </div>
              ))}
              {jobs.length === 0 && <div className="bg-white rounded-xl border p-8 text-center text-gray-400">No jobs for selected date/filter.</div>}
            </div>
          </div>
        )}

        {/* ── Clients ── */}
        {tab === 'clients' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={() => setShowAddClient(true)} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium">+ Add Client</button>
            </div>
            <div className="grid gap-3">
              {clients.map(c => (
                <div key={c.id} className="bg-white rounded-xl border p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{c.first_name} {c.last_name}</span>
                        <Badge label={c.property_type} color="teal" />
                        <Badge label={c.status} color={c.status === 'active' ? 'green' : c.status === 'seasonal_pause' ? 'amber' : 'red'} />
                        {c.dog_on_property && <Badge label="Dog" color="amber" />}
                        {c.gate_code && <Badge label={`Gate: ${c.gate_code}`} color="purple" />}
                        {c.has_irrigation && <Badge label="Irrigation" color="sky" />}
                      </div>
                      <p className="text-sm text-gray-500">{c.address} · {c.city}, {c.province}</p>
                      <p className="text-sm text-gray-500">{c.phone} · {c.email ?? '—'}</p>
                      {c.lot_size_sqft && <p className="text-xs text-gray-400">{c.lot_size_sqft.toLocaleString()} sqft</p>}
                      {c.services_subscribed?.length > 0 && <div className="flex gap-1 mt-1 flex-wrap">{c.services_subscribed.map(s => <Badge key={s} label={s.replace(/_/g, ' ')} color="green" />)}</div>}
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg text-green-700">{c.seasonal_contract_value ? fmtCad(c.seasonal_contract_value) : '—'}</p>
                      <p className="text-xs text-gray-400">{c.contract_type}</p>
                    </div>
                  </div>
                  {c.special_notes && <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 mt-2">{c.special_notes}</p>}
                </div>
              ))}
              {clients.length === 0 && <div className="bg-white rounded-xl border p-8 text-center text-gray-400">No clients found.</div>}
            </div>
          </div>
        )}

        {/* ── Equipment ── */}
        {tab === 'equipment' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={() => setShowAddEquip(true)} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium">+ Add Equipment</button>
            </div>
            <div className="grid gap-3">
              {equipment.map(e => (
                <div key={e.id} className="bg-white rounded-xl border p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{e.equipment_name}</span>
                        <Badge label={e.equipment_type?.replace(/_/g, ' ') ?? 'other'} color="blue" />
                        <Badge label={e.status} color={equipStatusColor(e.status)} />
                      </div>
                      <p className="text-sm text-gray-500">{[e.make, e.model, e.year].filter(Boolean).join(' ')}</p>
                      <p className="text-xs text-gray-400">Last service: {fmtDate(e.last_service_date)} · Next: {fmtDate(e.next_service_date)}</p>
                    </div>
                    <div className={`px-3 py-1 rounded text-sm font-medium ${e.service_days_remaining <= 0 ? 'bg-red-100 text-red-700' : e.service_days_remaining <= 14 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                      {e.next_service_date ? `${e.service_days_remaining}d to service` : 'No schedule'}
                    </div>
                  </div>
                  {e.notes && <p className="text-xs text-gray-500 mt-2 italic">{e.notes}</p>}
                </div>
              ))}
              {equipment.length === 0 && <div className="bg-white rounded-xl border p-8 text-center text-gray-400">No equipment found.</div>}
            </div>
          </div>
        )}

        {/* ── Routes ── */}
        {tab === 'routes' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input type="date" className="border rounded px-3 py-1.5 text-sm" value={routeDate} onChange={e => { setRouteDate(e.target.value); loadRoutes(e.target.value); }} />
              <span className="text-sm text-gray-500">{routes.length} routes</span>
            </div>
            {routes.map(r => (
              <div key={r.id} className="bg-white rounded-xl border p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{r.route_name}</span>
                    <Badge label={r.status} color={r.status === 'completed' ? 'green' : r.status === 'in_progress' ? 'blue' : 'gray'} />
                  </div>
                  <div className="flex gap-2">
                    {r.status === 'planned' && <button onClick={async () => { await fetch(`/api/admin/landscaping/routes/${r.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'start' }) }); loadRoutes(routeDate); }} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded">Start Route</button>}
                    {r.status === 'in_progress' && <button onClick={async () => { await fetch(`/api/admin/landscaping/routes/${r.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'complete', actual_hours: r.estimated_hours }) }); loadRoutes(routeDate); }} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded">Complete Route</button>}
                  </div>
                </div>
                <p className="text-sm text-gray-500">Crew Lead: {r.crew_lead} · Vehicle: {r.vehicle ?? '—'} · Est: {r.estimated_hours}h · Actual: {r.actual_hours ?? '—'}h</p>
                <p className="text-xs text-gray-400">{r.job_ids?.length ?? 0} jobs assigned</p>
              </div>
            ))}
            {routes.length === 0 && <div className="bg-white rounded-xl border p-8 text-center text-gray-400">No routes for this date.</div>}
          </div>
        )}

        {/* ── AI Tools ── */}
        {tab === 'ai-tools' && (
          <div className="space-y-6 max-w-2xl">
            <div className="bg-white rounded-xl border p-5">
              <h2 className="font-semibold mb-4">AI Input Parameters</h2>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-gray-500">Property Type</label>
                  <select className="w-full border rounded px-2 py-1.5 text-sm" value={aiForm.property_type} onChange={e => setAiForm(p => ({ ...p, property_type: e.target.value }))}>
                    {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div><label className="text-xs text-gray-500">Lot Size (sqft)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm" value={aiForm.lot_size_sqft} onChange={e => setAiForm(p => ({ ...p, lot_size_sqft: e.target.value }))} /></div>
                <div><label className="text-xs text-gray-500">Frequency</label>
                  <select className="w-full border rounded px-2 py-1.5 text-sm" value={aiForm.frequency} onChange={e => setAiForm(p => ({ ...p, frequency: e.target.value }))}>
                    {['weekly','bi_weekly','monthly','seasonal','per_visit'].map(f => <option key={f} value={f}>{f.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div className="col-span-2"><label className="text-xs text-gray-500 block mb-1">Services (for Quote)</label>
                  <div className="flex flex-wrap gap-2">{SERVICE_TYPES.slice(0, 8).map(s => <button key={s} onClick={() => toggleAiService(s)} className={`text-xs px-2 py-1 rounded border ${aiForm.service_types.includes(s) ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600'}`}>{s.replace(/_/g, ' ')}</button>)}</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Quote Generator</h3>
                <button onClick={runAiQuote} disabled={aiLoading !== null} className="bg-green-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50">{aiLoading === 'quote' ? 'Generating…' : 'Generate Quote'}</button>
              </div>
              {aiQuote && <pre className="bg-gray-50 rounded p-4 text-xs whitespace-pre-wrap font-mono border max-h-96 overflow-y-auto">{aiQuote}</pre>}
            </div>

            <div className="bg-white rounded-xl border p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Alberta Snow Removal Plan</h3>
                <button onClick={runAiSnow} disabled={aiLoading !== null} className="bg-sky-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50">{aiLoading === 'snow' ? 'Generating…' : 'Generate Snow Plan'}</button>
              </div>
              {aiSnowPlan && <pre className="bg-gray-50 rounded p-4 text-xs whitespace-pre-wrap font-mono border max-h-96 overflow-y-auto">{aiSnowPlan}</pre>}
            </div>
          </div>
        )}
      </div>

      {showAddClient && <AddClientModal onClose={() => setShowAddClient(false)} onSaved={() => { setShowAddClient(false); loadClients(); }} />}
      {showAddJob && <AddJobModal clients={clients} onClose={() => setShowAddJob(false)} onSaved={() => { setShowAddJob(false); loadJobs(jobDate, serviceFilter); loadDash(); }} />}
      {showAddEquip && <AddEquipmentModal onClose={() => setShowAddEquip(false)} onSaved={() => { setShowAddEquip(false); loadEquipment(); }} />}
      {completingJob && <CompleteJobModal job={completingJob} onClose={() => setCompletingJob(null)} onSaved={() => { setCompletingJob(null); loadJobs(jobDate, serviceFilter); loadDash(); }} />}
    </div>
  );
}
