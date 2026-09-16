'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard','properties','tenants','rent','maintenance','ai-lease','financials'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = { dashboard: 'Dashboard', properties: 'Properties', tenants: 'Tenants', rent: 'Rent Tracker', maintenance: 'Maintenance', 'ai-lease': 'AI Lease Generator', financials: 'Financials' };

const PROPERTY_TYPES = ['residential','commercial','condo','townhouse','duplex','multi_unit'];
const PROPERTY_STATUSES = ['occupied','vacant','maintenance','listed'];
const ISSUE_TYPES = ['plumbing','electrical','hvac','appliance','structural','pest','cleaning','landscaping','other'];
const PRIORITIES = ['emergency','high','medium','low'];
const MAINT_STATUSES = ['open','in_progress','completed','deferred'];
const TENANT_STATUSES = ['active','notice_given','moved_out','eviction'];
const PAYMENT_METHODS = ['e-transfer','cheque','cash','direct_debit','credit_card'];

interface DashData { total_properties: number; vacant_count: number; rent_collected_mtd: number; maintenance_open: number; overdue_rent_count: number; }
interface Property { id: number; address: string; city: string; province: string; property_type: string; units_count: number; owner_name: string; owner_email: string; monthly_rent: number; status: string; active_tenants: number; }
interface Tenant { id: number; property_id: number; address: string; first_name: string; last_name: string; email: string; phone: string; unit_number: string; lease_start: string; lease_end: string; monthly_rent: number; status: string; days_until_expiry: number; }
interface RentPayment { id: number; tenant_id: number; first_name: string; last_name: string; address: string; amount: number; due_date: string; paid_date: string; payment_method: string; status: string; late_fee: number; }
interface Maintenance { id: number; property_id: number; address: string; first_name: string; last_name: string; issue_type: string; description: string; priority: string; status: string; assigned_contractor: string; estimated_cost: number; actual_cost: number; reported_at: string; }

function fmtCad(n: number | string) { return `$${Number(n ?? 0).toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`; }
function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString('en-CA') : '—'; }
function cap(s: string) { return s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : s; }

function Badge({ label, color = 'gray' }: { label: string; color?: string }) {
  const m: Record<string, string> = { blue: 'bg-blue-100 text-blue-700', green: 'bg-green-100 text-green-700', amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700', purple: 'bg-purple-100 text-purple-700', gray: 'bg-gray-100 text-gray-700', teal: 'bg-teal-100 text-teal-700', orange: 'bg-orange-100 text-orange-700' };
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${m[color] ?? m.gray}`}>{cap(label)}</span>;
}
function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const b: Record<string, string> = { blue: 'border-l-4 border-blue-500 bg-blue-50', green: 'border-l-4 border-green-500 bg-green-50', amber: 'border-l-4 border-amber-500 bg-amber-50', red: 'border-l-4 border-red-500 bg-red-50', purple: 'border-l-4 border-purple-500 bg-purple-50' };
  return <div className={`rounded-lg p-4 ${b[color] ?? b.blue}`}><p className="text-sm text-gray-500">{label}</p><p className="text-2xl font-bold mt-1">{value}</p>{sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}</div>;
}
function statusColor(s: string): string {
  const m: Record<string, string> = { occupied: 'green', vacant: 'red', maintenance: 'amber', listed: 'blue', active: 'green', notice_given: 'amber', moved_out: 'gray', eviction: 'red', paid: 'green', pending: 'amber', partial: 'orange', late: 'red', waived: 'gray', open: 'red', in_progress: 'blue', completed: 'green', deferred: 'gray' };
  return m[s] ?? 'gray';
}
function priorityColor(p: string): string {
  const m: Record<string, string> = { emergency: 'red', high: 'orange', medium: 'amber', low: 'blue' };
  return m[p] ?? 'gray';
}

// ── Add Property Modal ──────────────────────────────────────────────────────
function AddPropertyModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ address: '', city: 'Calgary', province: 'AB', postal_code: '', property_type: 'residential', units_count: '1', owner_name: '', owner_email: '', owner_phone: '', monthly_rent: '', purchase_price: '', year_built: '', square_feet: '', status: 'occupied' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.address) return;
    setSaving(true);
    try {
      await fetch('/api/admin/property-management/properties', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, units_count: parseInt(form.units_count), monthly_rent: form.monthly_rent ? parseFloat(form.monthly_rent) : null, purchase_price: form.purchase_price ? parseFloat(form.purchase_price) : null, year_built: form.year_built ? parseInt(form.year_built) : null, square_feet: form.square_feet ? parseInt(form.square_feet) : null }) });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-4 text-slate-800">Add Property</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs text-gray-500">Address *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.address} onChange={e => f('address', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">City</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.city} onChange={e => f('city', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Postal Code</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.postal_code} onChange={e => f('postal_code', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Property Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.property_type} onChange={e => f('property_type', e.target.value)}>{PROPERTY_TYPES.map(t => <option key={t} value={t}>{cap(t)}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Units</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.units_count} onChange={e => f('units_count', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Owner Name</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.owner_name} onChange={e => f('owner_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Owner Email</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.owner_email} onChange={e => f('owner_email', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Monthly Rent (CAD)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.monthly_rent} onChange={e => f('monthly_rent', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Purchase Price</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.purchase_price} onChange={e => f('purchase_price', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Year Built</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.year_built} onChange={e => f('year_built', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Sq Ft</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.square_feet} onChange={e => f('square_feet', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Status</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.status} onChange={e => f('status', e.target.value)}>{PROPERTY_STATUSES.map(s => <option key={s} value={s}>{cap(s)}</option>)}</select></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded border text-sm">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-medium disabled:opacity-50">{saving ? 'Saving…' : 'Save Property'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Add Tenant Modal ─────────────────────────────────────────────────────────
function AddTenantModal({ properties, onClose, onSaved }: { properties: Property[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ property_id: '', first_name: '', last_name: '', email: '', phone: '', unit_number: '', lease_start: '', lease_end: '', monthly_rent: '', security_deposit: '', status: 'active', emergency_contact_name: '', emergency_contact_phone: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.first_name || !form.last_name || !form.email || !form.lease_start || !form.monthly_rent) return;
    setSaving(true);
    try {
      await fetch('/api/admin/property-management/tenants', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, property_id: form.property_id ? parseInt(form.property_id) : null, monthly_rent: parseFloat(form.monthly_rent), security_deposit: form.security_deposit ? parseFloat(form.security_deposit) : null }) });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-4 text-slate-800">Add Tenant</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs text-gray-500">Property</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.property_id} onChange={e => f('property_id', e.target.value)}><option value="">— select property —</option>{properties.map(p => <option key={p.id} value={p.id}>{p.address}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">First Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.first_name} onChange={e => f('first_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Last Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.last_name} onChange={e => f('last_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Email *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.email} onChange={e => f('email', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Phone</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.phone} onChange={e => f('phone', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Unit #</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.unit_number} onChange={e => f('unit_number', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Lease Start *</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.lease_start} onChange={e => f('lease_start', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Lease End</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.lease_end} onChange={e => f('lease_end', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Monthly Rent *</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.monthly_rent} onChange={e => f('monthly_rent', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Security Deposit</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.security_deposit} onChange={e => f('security_deposit', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Emergency Contact</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" placeholder="Name" value={form.emergency_contact_name} onChange={e => f('emergency_contact_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Emergency Phone</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.emergency_contact_phone} onChange={e => f('emergency_contact_phone', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.notes} onChange={e => f('notes', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded border text-sm">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-medium disabled:opacity-50">{saving ? 'Saving…' : 'Add Tenant'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Add Maintenance Modal ────────────────────────────────────────────────────
function AddMaintenanceModal({ properties, onClose, onSaved }: { properties: Property[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ property_id: '', issue_type: 'plumbing', description: '', priority: 'medium', assigned_contractor: '', estimated_cost: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.property_id || !form.description) return;
    setSaving(true);
    try {
      await fetch('/api/admin/property-management/maintenance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, property_id: parseInt(form.property_id), estimated_cost: form.estimated_cost ? parseFloat(form.estimated_cost) : null }) });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold mb-4 text-slate-800">New Maintenance Request</h2>
        <div className="space-y-3">
          <div><label className="text-xs text-gray-500">Property *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.property_id} onChange={e => f('property_id', e.target.value)}><option value="">— select —</option>{properties.map(p => <option key={p.id} value={p.id}>{p.address}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Issue Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.issue_type} onChange={e => f('issue_type', e.target.value)}>{ISSUE_TYPES.map(t => <option key={t} value={t}>{cap(t)}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Priority</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.priority} onChange={e => f('priority', e.target.value)}>{PRIORITIES.map(p => <option key={p} value={p}>{cap(p)}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Description *</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={3} value={form.description} onChange={e => f('description', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Contractor</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.assigned_contractor} onChange={e => f('assigned_contractor', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Estimated Cost</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.estimated_cost} onChange={e => f('estimated_cost', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded border text-sm">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 rounded bg-red-600 text-white text-sm font-medium disabled:opacity-50">{saving ? 'Saving…' : 'Submit Request'}</button>
        </div>
      </div>
    </div>
  );
}

export default function PropertyManagementPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [dash, setDash] = useState<DashData | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [payments, setPayments] = useState<RentPayment[]>([]);
  const [overdueCount, setOverdueCount] = useState(0);
  const [maintenance, setMaintenance] = useState<Maintenance[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddProp, setShowAddProp] = useState(false);
  const [showAddTenant, setShowAddTenant] = useState(false);
  const [showAddMaint, setShowAddMaint] = useState(false);
  const [rentMonth, setRentMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [maintFilter, setMaintFilter] = useState('');
  const [leaseForm, setLeaseForm] = useState({ tenant_name: '', address: '', amount: '', lease_start: '', lease_end: '', late_fee: '75', unit_number: '' });
  const [leaseOutput, setLeaseOutput] = useState('');
  const [leaseLoading, setLeaseLoading] = useState(false);
  const [leaseAi, setLeaseAi] = useState(false);
  const [markPaidId, setMarkPaidId] = useState<number | null>(null);
  const [paidForm, setPaidForm] = useState({ paid_date: new Date().toISOString().slice(0, 10), payment_method: 'e-transfer' });
  const [genMsg, setGenMsg] = useState('');
  const [assignModal, setAssignModal] = useState<Maintenance | null>(null);
  const [assignForm, setAssignForm] = useState({ assigned_contractor: '', estimated_cost: '' });

  const loadDash = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/property-management');
    if (res.ok) setDash(await res.json());
    setLoading(false);
  }, []);

  const loadProperties = useCallback(async () => {
    const res = await fetch('/api/admin/property-management/properties');
    if (res.ok) setProperties(await res.json());
  }, []);

  const loadTenants = useCallback(async () => {
    const res = await fetch('/api/admin/property-management/tenants');
    if (res.ok) setTenants(await res.json());
  }, []);

  const loadPayments = useCallback(async () => {
    const res = await fetch(`/api/admin/property-management/rent?month=${rentMonth}`);
    if (res.ok) { const d = await res.json(); setPayments(d.payments); setOverdueCount(d.overdue_count); }
  }, [rentMonth]);

  const loadMaintenance = useCallback(async () => {
    const url = maintFilter ? `/api/admin/property-management/maintenance?priority=${maintFilter}` : '/api/admin/property-management/maintenance';
    const res = await fetch(url);
    if (res.ok) setMaintenance(await res.json());
  }, [maintFilter]);

  useEffect(() => { loadDash(); loadProperties(); }, [loadDash, loadProperties]);
  useEffect(() => { if (tab === 'tenants') loadTenants(); }, [tab, loadTenants]);
  useEffect(() => { if (tab === 'rent') loadPayments(); }, [tab, loadPayments, rentMonth]);
  useEffect(() => { if (tab === 'maintenance') loadMaintenance(); }, [tab, loadMaintenance, maintFilter]);

  async function markPaid() {
    if (!markPaidId) return;
    await fetch(`/api/admin/property-management/rent/${markPaidId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'paid', paid_date: paidForm.paid_date, payment_method: paidForm.payment_method }) });
    setMarkPaidId(null);
    loadPayments();
  }

  async function generateRent() {
    setGenMsg('');
    const res = await fetch('/api/admin/property-management/rent/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ month: rentMonth }) });
    if (res.ok) { const d = await res.json(); setGenMsg(d.message); loadPayments(); }
  }

  async function generateLease() {
    if (!leaseForm.tenant_name || !leaseForm.address || !leaseForm.amount) return;
    setLeaseLoading(true);
    const res = await fetch('/api/admin/property-management/ai-lease', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...leaseForm, amount: parseFloat(leaseForm.amount), late_fee: parseFloat(leaseForm.late_fee) }) });
    if (res.ok) { const d = await res.json(); setLeaseOutput(d.lease); setLeaseAi(d.ai_used); }
    setLeaseLoading(false);
  }

  async function assignContractor() {
    if (!assignModal) return;
    await fetch(`/api/admin/property-management/maintenance/${assignModal.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assigned_contractor: assignForm.assigned_contractor, estimated_cost: assignForm.estimated_cost ? parseFloat(assignForm.estimated_cost) : undefined, status: 'in_progress' }) });
    setAssignModal(null);
    loadMaintenance();
  }

  async function completeMaint(id: number, actual_cost: string) {
    await fetch(`/api/admin/property-management/maintenance/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'completed', actual_cost: actual_cost ? parseFloat(actual_cost) : undefined }) });
    loadMaintenance();
  }

  const occupancyRate = properties.length ? Math.round(((properties.length - properties.filter(p => p.status === 'vacant').length) / properties.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-slate-800 text-white px-6 py-4">
        <h1 className="text-xl font-bold">Property Management Hub</h1>
        <p className="text-slate-300 text-sm mt-0.5">Alberta Residential Portfolio Management</p>
      </div>
      <div className="border-b bg-white px-6 flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{TAB_LABELS[t]}</button>
        ))}
      </div>
      <div className="p-6 max-w-7xl mx-auto">
        {/* ── Dashboard ── */}
        {tab === 'dashboard' && (
          <div className="space-y-6">
            {loading && <p className="text-gray-400 text-sm">Loading…</p>}
            {dash && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <KpiCard label="Total Properties" value={dash.total_properties} color="blue" />
                  <KpiCard label="Vacant Units" value={dash.vacant_count} color={dash.vacant_count > 0 ? 'amber' : 'green'} />
                  <KpiCard label="Rent Collected MTD" value={fmtCad(dash.rent_collected_mtd)} color="green" />
                  <KpiCard label="Open Maintenance" value={dash.maintenance_open} color={dash.maintenance_open > 2 ? 'red' : 'amber'} />
                  <KpiCard label="Overdue Rent" value={dash.overdue_rent_count} color={dash.overdue_rent_count > 0 ? 'red' : 'green'} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl border p-5">
                    <h3 className="font-semibold text-slate-700 mb-3">Occupancy Rate</h3>
                    <div className="flex items-center gap-4">
                      <div className="relative w-24 h-24">
                        <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
                          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#3b82f6" strokeWidth="3" strokeDasharray={`${occupancyRate} ${100 - occupancyRate}`} strokeLinecap="round" />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center text-lg font-bold text-slate-700">{occupancyRate}%</div>
                      </div>
                      <div className="text-sm text-gray-500 space-y-1">
                        <p><span className="w-3 h-3 rounded-full bg-blue-500 inline-block mr-2"></span>Occupied</p>
                        <p><span className="w-3 h-3 rounded-full bg-gray-200 inline-block mr-2"></span>Vacant ({dash.vacant_count})</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border p-5">
                    <h3 className="font-semibold text-slate-700 mb-3">Quick Actions</h3>
                    <div className="space-y-2">
                      {dash.overdue_rent_count > 0 && <div className="flex items-center gap-2 p-2 bg-red-50 rounded text-sm text-red-700"><span className="font-medium">{dash.overdue_rent_count} overdue rent payments</span><button onClick={() => setTab('rent')} className="ml-auto text-xs underline">View</button></div>}
                      {dash.maintenance_open > 0 && <div className="flex items-center gap-2 p-2 bg-amber-50 rounded text-sm text-amber-700"><span className="font-medium">{dash.maintenance_open} open maintenance requests</span><button onClick={() => setTab('maintenance')} className="ml-auto text-xs underline">View</button></div>}
                      {dash.vacant_count > 0 && <div className="flex items-center gap-2 p-2 bg-blue-50 rounded text-sm text-blue-700"><span className="font-medium">{dash.vacant_count} vacant units</span><button onClick={() => setTab('properties')} className="ml-auto text-xs underline">View</button></div>}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Properties ── */}
        {tab === 'properties' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-700">Properties ({properties.length})</h2>
              <button onClick={() => setShowAddProp(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">+ Add Property</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {properties.map(p => (
                <div key={p.id} className="bg-white rounded-xl border p-5 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-slate-800">{p.address}</p>
                      <p className="text-xs text-gray-400">{p.city}, {p.province}</p>
                    </div>
                    <Badge label={p.status} color={statusColor(p.status)} />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Badge label={cap(p.property_type)} color="blue" />
                    {p.units_count > 1 && <Badge label={`${p.units_count} units`} color="purple" />}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><p className="text-xs text-gray-400">Monthly Rent</p><p className="font-semibold text-green-700">{fmtCad(p.monthly_rent)}</p></div>
                    <div><p className="text-xs text-gray-400">Active Tenants</p><p className="font-semibold">{p.active_tenants}</p></div>
                  </div>
                  {p.owner_name && <p className="text-xs text-gray-500">Owner: {p.owner_name}</p>}
                </div>
              ))}
            </div>
            {showAddProp && <AddPropertyModal onClose={() => setShowAddProp(false)} onSaved={() => { setShowAddProp(false); loadProperties(); loadDash(); }} />}
          </div>
        )}

        {/* ── Tenants ── */}
        {tab === 'tenants' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-700">Tenants ({tenants.length})</h2>
              <button onClick={() => setShowAddTenant(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">+ Add Tenant</button>
            </div>
            <div className="bg-white rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>{['Tenant','Property','Email','Rent/Mo','Lease End','Status'].map(h => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tenants.map(t => (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{t.first_name} {t.last_name}</td>
                      <td className="px-4 py-3 text-gray-500">{t.address || '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{t.email}</td>
                      <td className="px-4 py-3 text-green-700 font-medium">{fmtCad(t.monthly_rent)}</td>
                      <td className="px-4 py-3">
                        <span className={t.days_until_expiry !== null && t.days_until_expiry < 60 ? 'text-amber-600 font-medium' : 'text-gray-500'}>
                          {fmtDate(t.lease_end)} {t.days_until_expiry !== null && t.days_until_expiry < 60 && t.days_until_expiry > 0 && <span className="text-xs">({Math.round(t.days_until_expiry)}d)</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3"><Badge label={t.status} color={statusColor(t.status)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!tenants.length && <p className="text-center text-gray-400 py-8">No tenants found.</p>}
            </div>
            {showAddTenant && <AddTenantModal properties={properties} onClose={() => setShowAddTenant(false)} onSaved={() => { setShowAddTenant(false); loadTenants(); }} />}
          </div>
        )}

        {/* ── Rent Tracker ── */}
        {tab === 'rent' && (
          <div>
            <div className="flex flex-wrap gap-3 items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-700">Rent Tracker</h2>
              <input type="month" className="border rounded px-2 py-1.5 text-sm" value={rentMonth} onChange={e => setRentMonth(e.target.value)} />
              <button onClick={generateRent} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium">Generate Monthly Records</button>
              {genMsg && <span className="text-sm text-green-700 font-medium">{genMsg}</span>}
              {overdueCount > 0 && <span className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm font-medium">{overdueCount} overdue</span>}
            </div>
            <div className="bg-white rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>{['Tenant','Property','Amount','Due Date','Paid Date','Method','Status','Action'].map(h => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {payments.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{p.first_name} {p.last_name}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{p.address}</td>
                      <td className="px-4 py-3 font-semibold text-green-700">{fmtCad(p.amount)}</td>
                      <td className="px-4 py-3">{fmtDate(p.due_date)}</td>
                      <td className="px-4 py-3">{p.paid_date ? fmtDate(p.paid_date) : '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{p.payment_method || '—'}</td>
                      <td className="px-4 py-3"><Badge label={p.status} color={statusColor(p.status)} /></td>
                      <td className="px-4 py-3">
                        {p.status === 'pending' && <button onClick={() => setMarkPaidId(p.id)} className="text-xs text-blue-600 underline">Mark Paid</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!payments.length && <p className="text-center text-gray-400 py-8">No payments for this month. Click "Generate Monthly Records" to create them.</p>}
            </div>
            {markPaidId && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
                  <h3 className="font-bold mb-4">Mark Payment as Paid</h3>
                  <div className="space-y-3">
                    <div><label className="text-xs text-gray-500">Paid Date</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={paidForm.paid_date} onChange={e => setPaidForm(p => ({ ...p, paid_date: e.target.value }))} /></div>
                    <div><label className="text-xs text-gray-500">Payment Method</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={paidForm.payment_method} onChange={e => setPaidForm(p => ({ ...p, payment_method: e.target.value }))}>{PAYMENT_METHODS.map(m => <option key={m} value={m}>{cap(m)}</option>)}</select></div>
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                    <button onClick={() => setMarkPaidId(null)} className="px-4 py-2 rounded border text-sm">Cancel</button>
                    <button onClick={markPaid} className="px-4 py-2 rounded bg-green-600 text-white text-sm">Confirm Paid</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Maintenance ── */}
        {tab === 'maintenance' && (
          <div>
            <div className="flex flex-wrap gap-3 items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-700">Maintenance Requests</h2>
              <select className="border rounded px-2 py-1.5 text-sm" value={maintFilter} onChange={e => setMaintFilter(e.target.value)}><option value="">All Priorities</option>{PRIORITIES.map(p => <option key={p} value={p}>{cap(p)}</option>)}</select>
              <button onClick={() => setShowAddMaint(true)} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium ml-auto">+ New Request</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {maintenance.map(m => (
                <div key={m.id} className={`bg-white rounded-xl border-l-4 p-5 space-y-2 ${m.priority === 'emergency' ? 'border-red-500' : m.priority === 'high' ? 'border-orange-500' : m.priority === 'medium' ? 'border-amber-400' : 'border-blue-400'}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-slate-800">{cap(m.issue_type)}</p>
                      <p className="text-xs text-gray-400">{m.address}</p>
                    </div>
                    <div className="flex gap-2">
                      <Badge label={m.priority} color={priorityColor(m.priority)} />
                      <Badge label={m.status} color={statusColor(m.status)} />
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">{m.description}</p>
                  {m.assigned_contractor && <p className="text-xs text-gray-500">Contractor: {m.assigned_contractor}</p>}
                  {(m.estimated_cost || m.actual_cost) && <p className="text-xs text-gray-500">Est: {m.estimated_cost ? fmtCad(m.estimated_cost) : '—'} | Actual: {m.actual_cost ? fmtCad(m.actual_cost) : '—'}</p>}
                  <p className="text-xs text-gray-400">Reported: {fmtDate(m.reported_at)}</p>
                  {m.status !== 'completed' && (
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => { setAssignModal(m); setAssignForm({ assigned_contractor: m.assigned_contractor || '', estimated_cost: m.estimated_cost?.toString() || '' }); }} className="text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded">Assign Contractor</button>
                      {m.status === 'in_progress' && <button onClick={() => { const cost = window.prompt('Actual cost ($):'); completeMaint(m.id, cost || ''); }} className="text-xs px-3 py-1 bg-green-100 text-green-700 rounded">Complete</button>}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {!maintenance.length && <p className="text-center text-gray-400 py-12">No maintenance requests found.</p>}
            {showAddMaint && <AddMaintenanceModal properties={properties} onClose={() => setShowAddMaint(false)} onSaved={() => { setShowAddMaint(false); loadMaintenance(); }} />}
            {assignModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
                  <h3 className="font-bold mb-4">Assign Contractor</h3>
                  <div className="space-y-3">
                    <div><label className="text-xs text-gray-500">Contractor Name</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={assignForm.assigned_contractor} onChange={e => setAssignForm(p => ({ ...p, assigned_contractor: e.target.value }))} /></div>
                    <div><label className="text-xs text-gray-500">Estimated Cost ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={assignForm.estimated_cost} onChange={e => setAssignForm(p => ({ ...p, estimated_cost: e.target.value }))} /></div>
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                    <button onClick={() => setAssignModal(null)} className="px-4 py-2 rounded border text-sm">Cancel</button>
                    <button onClick={assignContractor} className="px-4 py-2 rounded bg-blue-600 text-white text-sm">Assign & Start</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── AI Lease Generator ── */}
        {tab === 'ai-lease' && (
          <div className="max-w-3xl">
            <h2 className="text-lg font-semibold text-slate-700 mb-4">AI Lease Generator — Alberta Residential</h2>
            <div className="bg-white rounded-xl border p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs text-gray-500">Tenant Name *</label>
                  <select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" onChange={e => { const t = tenants.find(x => x.id === parseInt(e.target.value)); if (t) { setLeaseForm(p => ({ ...p, tenant_name: `${t.first_name} ${t.last_name}`, address: t.address || '', amount: t.monthly_rent.toString(), lease_start: t.lease_start, lease_end: t.lease_end || '' })); } }}>
                    <option value="">— or select tenant —</option>
                    {tenants.map(t => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
                  </select>
                  <input className="w-full border rounded px-2 py-1.5 text-sm mt-1" placeholder="Or type tenant name" value={leaseForm.tenant_name} onChange={e => setLeaseForm(p => ({ ...p, tenant_name: e.target.value }))} />
                </div>
                <div><label className="text-xs text-gray-500">Property Address *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={leaseForm.address} onChange={e => setLeaseForm(p => ({ ...p, address: e.target.value }))} /></div>
                <div><label className="text-xs text-gray-500">Unit Number</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={leaseForm.unit_number} onChange={e => setLeaseForm(p => ({ ...p, unit_number: e.target.value }))} /></div>
                <div><label className="text-xs text-gray-500">Monthly Rent *</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={leaseForm.amount} onChange={e => setLeaseForm(p => ({ ...p, amount: e.target.value }))} /></div>
                <div><label className="text-xs text-gray-500">Lease Start *</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={leaseForm.lease_start} onChange={e => setLeaseForm(p => ({ ...p, lease_start: e.target.value }))} /></div>
                <div><label className="text-xs text-gray-500">Lease End *</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={leaseForm.lease_end} onChange={e => setLeaseForm(p => ({ ...p, lease_end: e.target.value }))} /></div>
                <div><label className="text-xs text-gray-500">Late Fee ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={leaseForm.late_fee} onChange={e => setLeaseForm(p => ({ ...p, late_fee: e.target.value }))} /></div>
              </div>
              <button onClick={generateLease} disabled={leaseLoading} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50">{leaseLoading ? 'Generating…' : 'Generate Lease Agreement'}</button>
              {leaseOutput && (
                <div className="mt-4">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-xs text-gray-500">{leaseAi ? 'Generated by Ollama llama3.2' : 'Generated with fallback template'}</p>
                    <button onClick={() => { const el = document.createElement('a'); el.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(leaseOutput); el.download = 'lease-agreement.txt'; el.click(); }} className="text-xs text-blue-600 underline">Download .txt</button>
                  </div>
                  <textarea readOnly className="w-full border rounded p-3 text-sm font-mono bg-gray-50 h-96 resize-none" value={leaseOutput} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Financials ── */}
        {tab === 'financials' && (
          <div className="max-w-4xl">
            <h2 className="text-lg font-semibold text-slate-700 mb-4">Financial Summary</h2>
            <div className="bg-white rounded-xl border p-6">
              <div className="grid grid-cols-3 gap-4 mb-6">
                <KpiCard label="Properties" value={properties.length} color="blue" />
                <KpiCard label="Total Monthly Rent" value={fmtCad(properties.reduce((s, p) => s + (Number(p.monthly_rent) || 0), 0))} color="green" />
                <KpiCard label="Vacant Loss/Mo" value={fmtCad(properties.filter(p => p.status === 'vacant').reduce((s, p) => s + (Number(p.monthly_rent) || 0), 0))} color="red" />
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr><th className="px-4 py-3 text-left">Property</th><th className="px-4 py-3 text-left">Type</th><th className="px-4 py-3 text-left">Status</th><th className="px-4 py-3 text-right">Monthly Rent</th><th className="px-4 py-3 text-right">Purchase Price</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {properties.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{p.address}</td>
                      <td className="px-4 py-3"><Badge label={cap(p.property_type)} color="blue" /></td>
                      <td className="px-4 py-3"><Badge label={p.status} color={statusColor(p.status)} /></td>
                      <td className="px-4 py-3 text-right font-semibold text-green-700">{fmtCad(p.monthly_rent)}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{p.monthly_rent ? fmtCad(Number(p.monthly_rent) * 12) + '/yr' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 font-semibold">
                  <tr><td colSpan={3} className="px-4 py-3">Total Portfolio</td><td className="px-4 py-3 text-right text-green-700">{fmtCad(properties.reduce((s, p) => s + (Number(p.monthly_rent) || 0), 0))}/mo</td><td className="px-4 py-3 text-right">{fmtCad(properties.reduce((s, p) => s + (Number(p.monthly_rent) || 0), 0) * 12)}/yr</td></tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
