'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['fleet', 'vehicles', 'drivers', 'loads', 'maintenance', 'compliance', 'ai'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = { fleet: 'Fleet Command', vehicles: 'Vehicles', drivers: 'Drivers', loads: 'Loads', maintenance: 'Maintenance', compliance: 'Compliance', ai: 'AI Dispatch' };

const VEHICLE_TYPES = ['semi_truck','straight_truck','van','flatbed','reefer','tanker','container','trailer','pickup'];
const VEHICLE_STATUSES = ['active','maintenance','out_of_service','sold'];
const DRIVER_STATUSES = ['active','on_leave','terminated','inactive'];
const EMPLOYMENT_TYPES = ['employee','owner_operator','contractor'];
const LOAD_STATUSES = ['pending','assigned','in_transit','delivered','invoiced','paid','cancelled'];
const MAINTENANCE_TYPES = ['oil_change','tire','brake','inspection','annual_safety','repair','pm_service'];

interface Vehicle { id: number; unit_number: string; type: string; make: string; model: string; year: number; license_plate: string; province: string; status: string; odometer_km: number; fuel_type: string; insurance_expiry: string; registration_expiry: string; safety_cert_expiry: string; next_maintenance_km: number; driver_name: string; }
interface Driver { id: number; name: string; email: string; phone: string; license_class: string; license_expiry: string; medical_expiry: string; status: string; employment_type: string; base_city: string; hourly_rate: number; per_km_rate: number; }
interface Load { id: number; load_number: string; vehicle_id: number; driver_id: number; shipper_name: string; consignee_name: string; origin_city: string; origin_province: string; destination_city: string; destination_province: string; commodity: string; weight_kg: number; pickup_date: string; delivery_date: string; actual_delivery: string; distance_km: number; rate: number; total_revenue: number; driver_pay: number; status: string; bol_number: string; driver_name: string; unit_number: string; }
interface Maintenance { id: number; vehicle_id: number; unit_number: string; maintenance_type: string; description: string; odometer_km: number; cost: number; vendor: string; maintenance_date: string; next_due_date: string; status: string; }
interface DashStats { vehicleStats: Record<string, number>; loadStats: Record<string, number>; revenueToday: number; revenueWeek: number; complianceAlerts: number; }

function fmtCad(n: number) { return `$${Number(n ?? 0).toLocaleString('en-CA', { minimumFractionDigits: 0 })}`; }
function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString('en-CA') : '—'; }
function daysUntil(d: string) { if (!d) return 9999; return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000); }

function Badge({ label, color = 'gray' }: { label: string; color?: string }) {
  const map: Record<string, string> = { blue: 'bg-blue-100 text-blue-700', green: 'bg-green-100 text-green-700', amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700', purple: 'bg-purple-100 text-purple-700', gray: 'bg-gray-100 text-gray-700', teal: 'bg-teal-100 text-teal-700', orange: 'bg-orange-100 text-orange-700' };
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${map[color] ?? map.gray}`}>{label.replace(/_/g,' ')}</span>;
}
function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const borders: Record<string, string> = { blue: 'border-l-4 border-blue-500 bg-blue-50', green: 'border-l-4 border-green-500 bg-green-50', amber: 'border-l-4 border-amber-500 bg-amber-50', red: 'border-l-4 border-red-500 bg-red-50', purple: 'border-l-4 border-purple-500 bg-purple-50', teal: 'border-l-4 border-teal-500 bg-teal-50' };
  return <div className={`rounded-lg p-4 ${borders[color] ?? borders.blue}`}><p className="text-sm text-gray-500">{label}</p><p className="text-2xl font-bold mt-1">{value}</p>{sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}</div>;
}
function expiryColor(d: string) { const days = daysUntil(d); if (days < 30) return 'red'; if (days < 60) return 'amber'; return 'green'; }
function statusColor(s: string) {
  const m: Record<string, string> = { active: 'green', maintenance: 'amber', out_of_service: 'red', sold: 'gray', pending: 'gray', assigned: 'blue', in_transit: 'teal', delivered: 'green', invoiced: 'purple', paid: 'green', cancelled: 'red', on_leave: 'amber', terminated: 'red', inactive: 'gray', employee: 'blue', owner_operator: 'purple', contractor: 'teal' };
  return m[s] ?? 'gray';
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold text-slate-800">{title}</h2><button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button></div>
        {children}
      </div>
    </div>
  );
}

function AddVehicleModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ unit_number: '', type: 'semi_truck', make: '', model: '', year: '', vin: '', license_plate: '', province: 'AB', fuel_type: 'diesel', status: 'active', insurance_expiry: '', registration_expiry: '', safety_cert_expiry: '', next_maintenance_km: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.unit_number || !form.type) return;
    setSaving(true);
    try { await fetch('/api/admin/trucking-logistics/vehicles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, year: form.year ? parseInt(form.year) : null, next_maintenance_km: form.next_maintenance_km ? parseInt(form.next_maintenance_km) : null }) }); onSaved(); }
    finally { setSaving(false); }
  }
  return (
    <Modal title="Add Vehicle" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        {[['Unit Number *','unit_number',''],['Make','make',''],['Model','model',''],['Year','year','number'],['VIN','vin',''],['License Plate','license_plate',''],['Province','province','']].map(([label, key, type]) => (
          <div key={key as string}><label className="text-xs text-gray-500">{label as string}</label><input type={type as string||'text'} className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={(form as Record<string,string>)[key as string]} onChange={e => f(key as string, e.target.value)} /></div>
        ))}
        <div><label className="text-xs text-gray-500">Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.type} onChange={e => f('type', e.target.value)}>{VEHICLE_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}</select></div>
        <div><label className="text-xs text-gray-500">Fuel Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.fuel_type} onChange={e => f('fuel_type', e.target.value)}>{['diesel','gas','electric','natural_gas'].map(t => <option key={t}>{t.replace(/_/g,' ')}</option>)}</select></div>
        <div><label className="text-xs text-gray-500">Status</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.status} onChange={e => f('status', e.target.value)}>{VEHICLE_STATUSES.map(s => <option key={s}>{s.replace(/_/g,' ')}</option>)}</select></div>
        {[['Insurance Expiry','insurance_expiry'],['Registration Expiry','registration_expiry'],['Safety Cert Expiry','safety_cert_expiry']].map(([label, key]) => (
          <div key={key}><label className="text-xs text-gray-500">{label}</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={(form as Record<string,string>)[key]} onChange={e => f(key, e.target.value)} /></div>
        ))}
        <div><label className="text-xs text-gray-500">Next Maintenance (km)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.next_maintenance_km} onChange={e => f('next_maintenance_km', e.target.value)} /></div>
        <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.notes} onChange={e => f('notes', e.target.value)} /></div>
      </div>
      <div className="flex justify-end gap-2 mt-4"><button onClick={onClose} className="px-4 py-2 text-sm border rounded">Cancel</button><button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Add Vehicle'}</button></div>
    </Modal>
  );
}

function AddDriverModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', license_number: '', license_class: 'Class 1', license_expiry: '', medical_expiry: '', abstract_date: '', status: 'active', employment_type: 'employee', base_city: 'Calgary', province: 'AB', hourly_rate: '', per_km_rate: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.name) return;
    setSaving(true);
    try { await fetch('/api/admin/trucking-logistics/drivers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, hourly_rate: form.hourly_rate ? parseFloat(form.hourly_rate) : null, per_km_rate: form.per_km_rate ? parseFloat(form.per_km_rate) : null }) }); onSaved(); }
    finally { setSaving(false); }
  }
  return (
    <Modal title="Add Driver" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><label className="text-xs text-gray-500">Full Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.name} onChange={e => f('name', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Email</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.email} onChange={e => f('email', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Phone</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.phone} onChange={e => f('phone', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">License #</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.license_number} onChange={e => f('license_number', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">License Class</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.license_class} onChange={e => f('license_class', e.target.value)}>{['Class 1','Class 2','Class 3','Class 5'].map(c => <option key={c}>{c}</option>)}</select></div>
        <div><label className="text-xs text-gray-500">License Expiry</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.license_expiry} onChange={e => f('license_expiry', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Medical Expiry</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.medical_expiry} onChange={e => f('medical_expiry', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Abstract Date</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.abstract_date} onChange={e => f('abstract_date', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Employment Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.employment_type} onChange={e => f('employment_type', e.target.value)}>{EMPLOYMENT_TYPES.map(t => <option key={t}>{t.replace(/_/g,' ')}</option>)}</select></div>
        <div><label className="text-xs text-gray-500">Status</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.status} onChange={e => f('status', e.target.value)}>{DRIVER_STATUSES.map(s => <option key={s}>{s.replace(/_/g,' ')}</option>)}</select></div>
        <div><label className="text-xs text-gray-500">Base City</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.base_city} onChange={e => f('base_city', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Province</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.province} onChange={e => f('province', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Hourly Rate (CAD)</label><input type="number" step="0.01" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.hourly_rate} onChange={e => f('hourly_rate', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Per-km Rate (CAD)</label><input type="number" step="0.0001" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.per_km_rate} onChange={e => f('per_km_rate', e.target.value)} /></div>
        <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.notes} onChange={e => f('notes', e.target.value)} /></div>
      </div>
      <div className="flex justify-end gap-2 mt-4"><button onClick={onClose} className="px-4 py-2 text-sm border rounded">Cancel</button><button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Add Driver'}</button></div>
    </Modal>
  );
}

function AddLoadModal({ vehicles, drivers, onClose, onSaved }: { vehicles: Vehicle[]; drivers: Driver[]; onClose: () => void; onSaved: () => void }) {
  const now = new Date();
  const [form, setForm] = useState({ load_number: `L-${now.getFullYear()}-${String(now.getTime()).slice(-4)}`, vehicle_id: '', driver_id: '', shipper_name: '', consignee_name: '', origin_city: 'Calgary', origin_province: 'AB', origin_postal: '', destination_city: '', destination_province: 'AB', destination_postal: '', commodity: '', weight_kg: '', pieces: '', hazmat: false, pickup_date: '', delivery_date: '', distance_km: '', rate: '', fuel_surcharge: '', accessorials: '', total_revenue: '', driver_pay: '', bol_number: '', po_number: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.load_number || !form.origin_city || !form.destination_city) return;
    setSaving(true);
    try {
      await fetch('/api/admin/trucking-logistics/loads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, vehicle_id: form.vehicle_id || null, driver_id: form.driver_id || null, weight_kg: form.weight_kg ? parseFloat(form.weight_kg) : null, pieces: form.pieces ? parseInt(form.pieces) : null, distance_km: form.distance_km ? parseFloat(form.distance_km) : null, rate: form.rate ? parseFloat(form.rate) : null, fuel_surcharge: form.fuel_surcharge ? parseFloat(form.fuel_surcharge) : null, total_revenue: form.total_revenue ? parseFloat(form.total_revenue) : null, driver_pay: form.driver_pay ? parseFloat(form.driver_pay) : null }) });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <Modal title="New Load" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-xs text-gray-500">Load Number *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5 font-mono" value={form.load_number} onChange={e => f('load_number', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">BOL Number</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.bol_number} onChange={e => f('bol_number', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Vehicle</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.vehicle_id} onChange={e => f('vehicle_id', e.target.value)}><option value="">— Select —</option>{vehicles.filter(v=>v.status==='active').map(v => <option key={v.id} value={v.id}>{v.unit_number} ({v.type.replace(/_/g,' ')})</option>)}</select></div>
        <div><label className="text-xs text-gray-500">Driver</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.driver_id} onChange={e => f('driver_id', e.target.value)}><option value="">— Select —</option>{drivers.filter(d=>d.status==='active').map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
        <div><label className="text-xs text-gray-500">Shipper</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.shipper_name} onChange={e => f('shipper_name', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Consignee</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.consignee_name} onChange={e => f('consignee_name', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Origin City *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.origin_city} onChange={e => f('origin_city', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Origin Province</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.origin_province} onChange={e => f('origin_province', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Destination City *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.destination_city} onChange={e => f('destination_city', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Destination Province</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.destination_province} onChange={e => f('destination_province', e.target.value)} /></div>
        <div className="col-span-2"><label className="text-xs text-gray-500">Commodity</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.commodity} onChange={e => f('commodity', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Weight (kg)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.weight_kg} onChange={e => f('weight_kg', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Pieces</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.pieces} onChange={e => f('pieces', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Pickup Date</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.pickup_date} onChange={e => f('pickup_date', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Delivery Date</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.delivery_date} onChange={e => f('delivery_date', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Distance (km)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.distance_km} onChange={e => f('distance_km', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Rate (CAD)</label><input type="number" step="0.01" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.rate} onChange={e => f('rate', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Fuel Surcharge</label><input type="number" step="0.01" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.fuel_surcharge} onChange={e => f('fuel_surcharge', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Total Revenue</label><input type="number" step="0.01" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.total_revenue} onChange={e => f('total_revenue', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Driver Pay</label><input type="number" step="0.01" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.driver_pay} onChange={e => f('driver_pay', e.target.value)} /></div>
        <div className="flex items-center gap-2 mt-2"><input type="checkbox" id="hazmat" checked={form.hazmat} onChange={e => f('hazmat', e.target.checked)} /><label htmlFor="hazmat" className="text-sm text-gray-700">Hazmat Load</label></div>
        {form.hazmat && <div><label className="text-xs text-gray-500">Hazmat Class</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.hazmat_class ?? ''} onChange={e => f('hazmat_class', e.target.value)} /></div>}
        <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.notes} onChange={e => f('notes', e.target.value)} /></div>
      </div>
      <div className="flex justify-end gap-2 mt-4"><button onClick={onClose} className="px-4 py-2 text-sm border rounded">Cancel</button><button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Create Load'}</button></div>
    </Modal>
  );
}

function AddMaintenanceModal({ vehicles, onClose, onSaved }: { vehicles: Vehicle[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ vehicle_id: '', maintenance_type: 'oil_change', description: '', odometer_km: '', cost: '', vendor: '', work_order: '', maintenance_date: new Date().toISOString().slice(0, 10), next_due_date: '', next_due_km: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.vehicle_id) return;
    setSaving(true);
    try { await fetch('/api/admin/trucking-logistics/maintenance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, odometer_km: form.odometer_km ? parseInt(form.odometer_km) : null, cost: form.cost ? parseFloat(form.cost) : null, next_due_km: form.next_due_km ? parseInt(form.next_due_km) : null }) }); onSaved(); }
    finally { setSaving(false); }
  }
  return (
    <Modal title="Add Maintenance Record" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-xs text-gray-500">Vehicle *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.vehicle_id} onChange={e => f('vehicle_id', e.target.value)}><option value="">— Select —</option>{vehicles.map(v => <option key={v.id} value={v.id}>{v.unit_number}</option>)}</select></div>
        <div><label className="text-xs text-gray-500">Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.maintenance_type} onChange={e => f('maintenance_type', e.target.value)}>{MAINTENANCE_TYPES.map(t => <option key={t}>{t.replace(/_/g,' ')}</option>)}</select></div>
        <div className="col-span-2"><label className="text-xs text-gray-500">Description</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.description} onChange={e => f('description', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Odometer (km)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.odometer_km} onChange={e => f('odometer_km', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Cost (CAD)</label><input type="number" step="0.01" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.cost} onChange={e => f('cost', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Vendor</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.vendor} onChange={e => f('vendor', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Work Order #</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.work_order} onChange={e => f('work_order', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Maintenance Date</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.maintenance_date} onChange={e => f('maintenance_date', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Next Due Date</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.next_due_date} onChange={e => f('next_due_date', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Next Due (km)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.next_due_km} onChange={e => f('next_due_km', e.target.value)} /></div>
      </div>
      <div className="flex justify-end gap-2 mt-4"><button onClick={onClose} className="px-4 py-2 text-sm border rounded">Cancel</button><button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Save Record'}</button></div>
    </Modal>
  );
}

export default function TruckingLogisticsPage() {
  const [tab, setTab] = useState<Tab>('fleet');
  const [stats, setStats] = useState<DashStats | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loads, setLoads] = useState<Load[]>([]);
  const [maintenance, setMaintenance] = useState<Maintenance[]>([]);
  const [compliance, setCompliance] = useState<{ vehicles: unknown[]; drivers: unknown[] } | null>(null);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [showAddDriver, setShowAddDriver] = useState(false);
  const [showAddLoad, setShowAddLoad] = useState(false);
  const [showAddMaintenance, setShowAddMaintenance] = useState(false);
  const [loadFilter, setLoadFilter] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [driverFilter, setDriverFilter] = useState('');
  const [aiForm, setAiForm] = useState({ origin: '', destination: '', commodity: '', weight: '', special_requirements: '' });
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    const r = await fetch('/api/admin/trucking-logistics');
    if (r.ok) setStats(await r.json());
  }, []);
  const fetchVehicles = useCallback(async () => {
    const params = vehicleFilter ? `?status=${vehicleFilter}` : '';
    const r = await fetch(`/api/admin/trucking-logistics/vehicles${params}`);
    if (r.ok) setVehicles(await r.json());
  }, [vehicleFilter]);
  const fetchDrivers = useCallback(async () => {
    const params = driverFilter ? `?status=${driverFilter}` : '';
    const r = await fetch(`/api/admin/trucking-logistics/drivers${params}`);
    if (r.ok) setDrivers(await r.json());
  }, [driverFilter]);
  const fetchLoads = useCallback(async () => {
    const params = loadFilter ? `?status=${loadFilter}` : '';
    const r = await fetch(`/api/admin/trucking-logistics/loads${params}`);
    if (r.ok) setLoads(await r.json());
  }, [loadFilter]);
  const fetchMaintenance = useCallback(async () => {
    const r = await fetch('/api/admin/trucking-logistics/maintenance');
    if (r.ok) setMaintenance(await r.json());
  }, []);
  const fetchCompliance = useCallback(async () => {
    const r = await fetch('/api/admin/trucking-logistics/compliance-check');
    if (r.ok) setCompliance(await r.json());
  }, []);

  useEffect(() => { fetchStats(); fetchVehicles(); fetchDrivers(); fetchLoads(); fetchMaintenance(); }, [fetchStats, fetchVehicles, fetchDrivers, fetchLoads, fetchMaintenance]);
  useEffect(() => { if (tab === 'compliance') fetchCompliance(); }, [tab, fetchCompliance]);
  useEffect(() => { fetchVehicles(); }, [vehicleFilter, fetchVehicles]);
  useEffect(() => { fetchDrivers(); }, [driverFilter, fetchDrivers]);
  useEffect(() => { fetchLoads(); }, [loadFilter, fetchLoads]);

  async function deliverLoad(id: number) {
    await fetch(`/api/admin/trucking-logistics/loads/${id}/deliver`, { method: 'POST' });
    fetchLoads(); fetchStats();
  }

  async function runAiDispatch() {
    if (!aiForm.origin || !aiForm.destination) return;
    setAiLoading(true); setAiResult('');
    try {
      const r = await fetch('/api/admin/trucking-logistics/ai-dispatch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(aiForm) });
      if (r.ok) { const d = await r.json(); setAiResult(d.advice || ''); }
    } finally { setAiLoading(false); }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-slate-800 text-white px-6 py-4">
        <h1 className="text-xl font-bold">Trucking & Logistics Portal</h1>
        <p className="text-slate-400 text-sm mt-0.5">Canadian Fleet Management — Loads, Drivers, Compliance</p>
      </div>
      <div className="border-b bg-white px-6">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map(t => <button key={t} onClick={() => setTab(t)} className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{TAB_LABELS[t]}</button>)}
        </div>
      </div>
      <div className="p-6">

        {tab === 'fleet' && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard label="Active Vehicles" value={stats.vehicleStats.active ?? 0} color="green" />
              <KpiCard label="Loads In Transit" value={stats.loadStats.in_transit ?? 0} color="blue" />
              <KpiCard label="Revenue This Week" value={fmtCad(stats.revenueWeek)} color="teal" />
              <KpiCard label="Compliance Alerts" value={stats.complianceAlerts} color={stats.complianceAlerts > 0 ? 'red' : 'green'} sub="Expiring docs in 60d" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard label="Revenue Today" value={fmtCad(stats.revenueToday)} color="purple" />
              <KpiCard label="In Maintenance" value={stats.vehicleStats.maintenance ?? 0} color="amber" />
              <KpiCard label="Delivered" value={stats.loadStats.delivered ?? 0} color="green" sub="Awaiting invoice" />
              <KpiCard label="Pending Loads" value={stats.loadStats.pending ?? 0} color="gray" />
            </div>
            <div className="bg-white rounded-xl border p-4">
              <h3 className="font-semibold text-slate-800 mb-3">Fleet Status Summary</h3>
              <div className="flex flex-wrap gap-3">
                {Object.entries(stats.vehicleStats).map(([s, n]) => <div key={s} className="text-center bg-gray-50 rounded p-3 min-w-[80px]"><p className="text-2xl font-bold">{n}</p><Badge label={s} color={statusColor(s)} /></div>)}
              </div>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <h3 className="font-semibold text-slate-800 mb-3">Load Pipeline</h3>
              <div className="flex flex-wrap gap-3">
                {LOAD_STATUSES.map(s => <div key={s} className="text-center bg-gray-50 rounded p-3 min-w-[80px]"><p className="text-2xl font-bold">{stats.loadStats[s] ?? 0}</p><Badge label={s} color={statusColor(s)} /></div>)}
              </div>
            </div>
          </div>
        )}

        {tab === 'vehicles' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex gap-2 flex-wrap">
                <select className="border rounded px-3 py-1.5 text-sm" value={vehicleFilter} onChange={e => setVehicleFilter(e.target.value)}><option value="">All Statuses</option>{VEHICLE_STATUSES.map(s => <option key={s}>{s}</option>)}</select>
              </div>
              <button onClick={() => setShowAddVehicle(true)} className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">+ Add Vehicle</button>
            </div>
            <div className="bg-white rounded-xl border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Unit#','Type','Make/Model/Year','Plate','Driver','Odometer','Status','Insurance','Safety Cert','Next Maint'].map(h => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr></thead>
                <tbody>
                  {vehicles.map(v => (
                    <tr key={v.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono font-semibold">{v.unit_number}</td>
                      <td className="px-4 py-3"><Badge label={v.type} color="blue" /></td>
                      <td className="px-4 py-3">{[v.make, v.model, v.year].filter(Boolean).join(' ')}</td>
                      <td className="px-4 py-3 font-mono">{v.license_plate} <span className="text-gray-400">{v.province}</span></td>
                      <td className="px-4 py-3">{v.driver_name || <span className="text-gray-400">—</span>}</td>
                      <td className="px-4 py-3">{v.odometer_km?.toLocaleString()} km</td>
                      <td className="px-4 py-3"><Badge label={v.status} color={statusColor(v.status)} /></td>
                      <td className="px-4 py-3"><Badge label={fmtDate(v.insurance_expiry)} color={v.insurance_expiry ? expiryColor(v.insurance_expiry) : 'gray'} /></td>
                      <td className="px-4 py-3"><Badge label={fmtDate(v.safety_cert_expiry)} color={v.safety_cert_expiry ? expiryColor(v.safety_cert_expiry) : 'gray'} /></td>
                      <td className="px-4 py-3">{v.next_maintenance_km ? `${v.next_maintenance_km.toLocaleString()} km` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {vehicles.length === 0 && <p className="text-center text-gray-400 py-8">No vehicles found</p>}
            </div>
            {showAddVehicle && <AddVehicleModal onClose={() => setShowAddVehicle(false)} onSaved={() => { setShowAddVehicle(false); fetchVehicles(); fetchStats(); }} />}
          </div>
        )}

        {tab === 'drivers' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex gap-2 flex-wrap">
                <select className="border rounded px-3 py-1.5 text-sm" value={driverFilter} onChange={e => setDriverFilter(e.target.value)}><option value="">All Statuses</option>{DRIVER_STATUSES.map(s => <option key={s}>{s}</option>)}</select>
              </div>
              <button onClick={() => setShowAddDriver(true)} className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">+ Add Driver</button>
            </div>
            <div className="bg-white rounded-xl border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Name','License Class','License Expiry','Medical Expiry','Employment','Pay Rate','Base City','Status'].map(h => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr></thead>
                <tbody>
                  {drivers.map(d => (
                    <tr key={d.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold">{d.name}</td>
                      <td className="px-4 py-3"><Badge label={d.license_class} color="blue" /></td>
                      <td className="px-4 py-3"><Badge label={fmtDate(d.license_expiry)} color={d.license_expiry ? expiryColor(d.license_expiry) : 'gray'} /></td>
                      <td className="px-4 py-3"><Badge label={fmtDate(d.medical_expiry)} color={d.medical_expiry ? expiryColor(d.medical_expiry) : 'gray'} /></td>
                      <td className="px-4 py-3"><Badge label={d.employment_type} color={statusColor(d.employment_type)} /></td>
                      <td className="px-4 py-3">{d.hourly_rate ? `$${d.hourly_rate}/hr` : d.per_km_rate ? `$${d.per_km_rate}/km` : '—'}</td>
                      <td className="px-4 py-3">{d.base_city}</td>
                      <td className="px-4 py-3"><Badge label={d.status} color={statusColor(d.status)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {drivers.length === 0 && <p className="text-center text-gray-400 py-8">No drivers found</p>}
            </div>
            {showAddDriver && <AddDriverModal onClose={() => setShowAddDriver(false)} onSaved={() => { setShowAddDriver(false); fetchDrivers(); }} />}
          </div>
        )}

        {tab === 'loads' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex gap-2 flex-wrap">
                <select className="border rounded px-3 py-1.5 text-sm" value={loadFilter} onChange={e => setLoadFilter(e.target.value)}><option value="">All Statuses</option>{LOAD_STATUSES.map(s => <option key={s}>{s}</option>)}</select>
              </div>
              <button onClick={() => setShowAddLoad(true)} className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">+ New Load</button>
            </div>
            <div className="bg-white rounded-xl border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Load#','Route','Commodity','Weight','Revenue','Driver','Vehicle','Pickup','Delivery','Status','Actions'].map(h => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr></thead>
                <tbody>
                  {loads.map(l => (
                    <tr key={l.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono font-semibold">{l.load_number}</td>
                      <td className="px-4 py-3 text-xs"><span className="font-medium">{l.origin_city},{l.origin_province}</span><span className="text-gray-400 mx-1">→</span><span className="font-medium">{l.destination_city},{l.destination_province}</span></td>
                      <td className="px-4 py-3">{l.commodity}</td>
                      <td className="px-4 py-3">{l.weight_kg ? `${Number(l.weight_kg).toLocaleString()} kg` : '—'}</td>
                      <td className="px-4 py-3 font-semibold">{l.total_revenue ? fmtCad(l.total_revenue) : '—'}</td>
                      <td className="px-4 py-3">{l.driver_name || '—'}</td>
                      <td className="px-4 py-3 font-mono">{l.unit_number || '—'}</td>
                      <td className="px-4 py-3">{fmtDate(l.pickup_date)}</td>
                      <td className="px-4 py-3">{l.actual_delivery ? fmtDate(l.actual_delivery) : fmtDate(l.delivery_date)}</td>
                      <td className="px-4 py-3"><Badge label={l.status} color={statusColor(l.status)} /></td>
                      <td className="px-4 py-3">
                        {l.status === 'in_transit' && <button onClick={() => deliverLoad(l.id)} className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700">Deliver</button>}
                        {l.status === 'pending' && <button onClick={async () => { await fetch(`/api/admin/trucking-logistics/loads/${l.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...l, status: 'assigned' }) }); fetchLoads(); }} className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">Assign</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {loads.length === 0 && <p className="text-center text-gray-400 py-8">No loads found</p>}
            </div>
            {showAddLoad && <AddLoadModal vehicles={vehicles} drivers={drivers} onClose={() => setShowAddLoad(false)} onSaved={() => { setShowAddLoad(false); fetchLoads(); fetchStats(); }} />}
          </div>
        )}

        {tab === 'maintenance' && (
          <div className="space-y-4">
            <div className="flex justify-end"><button onClick={() => setShowAddMaintenance(true)} className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">+ Add Maintenance</button></div>
            <div className="bg-white rounded-xl border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Unit#','Type','Description','Odometer','Cost','Vendor','Date','Next Due','Status'].map(h => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr></thead>
                <tbody>
                  {maintenance.map(m => (
                    <tr key={m.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono font-semibold">{m.unit_number}</td>
                      <td className="px-4 py-3"><Badge label={m.maintenance_type} color="blue" /></td>
                      <td className="px-4 py-3 max-w-[200px] truncate">{m.description}</td>
                      <td className="px-4 py-3">{m.odometer_km ? `${Number(m.odometer_km).toLocaleString()} km` : '—'}</td>
                      <td className="px-4 py-3">{m.cost ? fmtCad(m.cost) : '—'}</td>
                      <td className="px-4 py-3">{m.vendor || '—'}</td>
                      <td className="px-4 py-3">{fmtDate(m.maintenance_date)}</td>
                      <td className="px-4 py-3">{fmtDate(m.next_due_date)}</td>
                      <td className="px-4 py-3"><Badge label={m.status} color={m.status === 'completed' ? 'green' : 'amber'} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {maintenance.length === 0 && <p className="text-center text-gray-400 py-8">No maintenance records</p>}
            </div>
            {showAddMaintenance && <AddMaintenanceModal vehicles={vehicles} onClose={() => setShowAddMaintenance(false)} onSaved={() => { setShowAddMaintenance(false); fetchMaintenance(); }} />}
          </div>
        )}

        {tab === 'compliance' && compliance && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border p-4">
              <h3 className="font-semibold text-slate-800 mb-3">Vehicles — Expiring Documents (&lt;60 days)</h3>
              {compliance.vehicles.length === 0 ? <p className="text-green-600 text-sm">All vehicle documents are current.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Unit#','Type','Insurance Expiry','Registration Expiry','Safety Cert Expiry'].map(h => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr></thead>
                    <tbody>
                      {(compliance.vehicles as Vehicle[]).map((v: Vehicle) => (
                        <tr key={v.id} className="border-t">
                          <td className="px-4 py-3 font-mono font-semibold">{v.unit_number}</td>
                          <td className="px-4 py-3"><Badge label={v.type} color="blue" /></td>
                          <td className="px-4 py-3"><Badge label={fmtDate(v.insurance_expiry)} color={expiryColor(v.insurance_expiry)} /></td>
                          <td className="px-4 py-3"><Badge label={fmtDate(v.registration_expiry)} color={expiryColor(v.registration_expiry)} /></td>
                          <td className="px-4 py-3"><Badge label={fmtDate(v.safety_cert_expiry)} color={expiryColor(v.safety_cert_expiry)} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="bg-white rounded-xl border p-4">
              <h3 className="font-semibold text-slate-800 mb-3">Drivers — Expiring Credentials (&lt;60 days)</h3>
              {compliance.drivers.length === 0 ? <p className="text-green-600 text-sm">All driver credentials are current.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Driver','License Class','License Expiry','Medical Expiry','Employment'].map(h => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr></thead>
                    <tbody>
                      {(compliance.drivers as Driver[]).map((d: Driver) => (
                        <tr key={d.id} className="border-t">
                          <td className="px-4 py-3 font-semibold">{d.name}</td>
                          <td className="px-4 py-3"><Badge label={d.license_class} color="blue" /></td>
                          <td className="px-4 py-3"><Badge label={fmtDate(d.license_expiry)} color={expiryColor(d.license_expiry)} /></td>
                          <td className="px-4 py-3"><Badge label={fmtDate(d.medical_expiry)} color={expiryColor(d.medical_expiry)} /></td>
                          <td className="px-4 py-3"><Badge label={d.employment_type} color={statusColor(d.employment_type)} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <h3 className="font-semibold text-amber-800 mb-2">CVSA & Carrier Profile Reminders</h3>
              <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
                <li>NSC Safety Fitness Certificate renewal — check Alberta Transportation carrier portal annually</li>
                <li>CVOR Certificate (Ontario operations) — review points quarterly</li>
                <li>ELD mandate compliance — verify ELD devices are certified under Canadian mandate</li>
                <li>CVSA Level I inspections — schedule quarterly pre-trip inspection audits</li>
                <li>Hours of Service (HOS) log review — audit driver logs monthly</li>
                <li>Carrier Profile update — verify IFTA, IRP registrations are current</li>
              </ul>
            </div>
          </div>
        )}

        {tab === 'ai' && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border p-5 space-y-3">
              <h3 className="font-bold text-slate-800">AI Dispatch Advisor</h3>
              <p className="text-sm text-gray-500">Get route recommendations, permit requirements, and regulatory notes for Canadian freight.</p>
              {[['Origin City/Province','origin','e.g. Calgary, AB'],['Destination City/Province','destination','e.g. Winnipeg, MB'],['Commodity','commodity','e.g. Grain, Lumber, Hazmat'],['Weight (kg)','weight','e.g. 24000'],['Special Requirements','special_requirements','e.g. Temperature-controlled, Oversize']].map(([label, key, placeholder]) => (
                <div key={key}><label className="text-xs text-gray-500">{label}</label><input className="w-full border rounded px-3 py-2 text-sm mt-0.5" placeholder={placeholder as string} value={(aiForm as Record<string,string>)[key as string]} onChange={e => setAiForm(p => ({ ...p, [key as string]: e.target.value }))} /></div>
              ))}
              <button onClick={runAiDispatch} disabled={aiLoading || !aiForm.origin || !aiForm.destination} className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">{aiLoading ? 'Generating advice…' : 'Get Dispatch Advice'}</button>
            </div>
            <div className="bg-white rounded-xl border p-5">
              <h3 className="font-bold text-slate-800 mb-3">Dispatch Advisory</h3>
              {aiLoading && <div className="text-center text-gray-400 py-8"><div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2" /><p>Consulting dispatch AI…</p></div>}
              {aiResult && !aiLoading && (
                <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{aiResult}</div>
              )}
              {!aiResult && !aiLoading && <p className="text-gray-400 text-sm">Fill in the form and click &ldquo;Get Dispatch Advice&rdquo; to generate route recommendations.</p>}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
