'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard', 'prescriptions', 'patients', 'inventory', 'interactions', 'counselling'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = {
  dashboard: 'Dashboard',
  prescriptions: 'Prescriptions',
  patients: 'Patients',
  inventory: 'Inventory',
  interactions: 'Drug Interaction Checker',
  counselling: 'Patient Counselling',
};

const RX_STATUSES = ['new', 'on_hold', 'ready', 'dispensed', 'partial', 'expired', 'cancelled'];
const PROVINCES = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'];

interface DashData { prescriptions_today: number; ready_for_pickup: number; low_stock_count: number; refills_due_7d: number; }
interface Patient { id: number; first_name: string; last_name: string; date_of_birth: string; health_card_number: string; phone: string; email: string; allergies: string[]; current_conditions: string[]; insurance_provider: string; insurance_id: string; city: string; notes: string; }
interface Prescription { id: number; patient_id: number; first_name: string; last_name: string; drug_name: string; brand_name: string; strength: string; form: string; quantity: number; days_supply: number; refills_remaining: number; directions: string; prescriber_name: string; status: string; insurance_claim_status: string; patient_cost: number; written_date: string; dispensed_at: string; allergies: string[]; insurance_paid?: number; }
interface InventoryItem { id: number; din: string; drug_name: string; brand_name: string; strength: string; form: string; quantity_on_hand: number; reorder_point: number; unit_cost: number; selling_price: number; location: string; expiry_date: string; narcotic: boolean; }

function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString('en-CA') : '—'; }
function fmtCad(n: number | null) { return n != null ? `$${Number(n).toFixed(2)}` : '—'; }

function Badge({ label, color = 'gray' }: { label: string; color?: string }) {
  const m: Record<string, string> = { blue: 'bg-blue-100 text-blue-700', green: 'bg-green-100 text-green-700', amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700', purple: 'bg-purple-100 text-purple-700', gray: 'bg-gray-100 text-gray-700', teal: 'bg-teal-100 text-teal-700', orange: 'bg-orange-100 text-orange-700' };
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${m[color] ?? m.gray}`}>{label}</span>;
}

function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const b: Record<string, string> = { blue: 'border-l-4 border-blue-500 bg-blue-50', green: 'border-l-4 border-green-500 bg-green-50', amber: 'border-l-4 border-amber-500 bg-amber-50', red: 'border-l-4 border-red-500 bg-red-50', purple: 'border-l-4 border-purple-500 bg-purple-50' };
  return <div className={`rounded-lg p-4 ${b[color] ?? b.blue}`}><p className="text-sm text-gray-500">{label}</p><p className="text-2xl font-bold mt-1">{value}</p>{sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}</div>;
}

function statusColor(s: string): string {
  const m: Record<string, string> = { new: 'blue', on_hold: 'amber', ready: 'green', dispensed: 'teal', partial: 'orange', expired: 'red', cancelled: 'gray' };
  return m[s] ?? 'gray';
}

// ─── Add Patient Modal ───────────────────────────────────────────────────────
function AddPatientModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', date_of_birth: '', health_card_number: '', phone: '', email: '', address: '', city: 'Calgary', province: 'AB', postal_code: '', allergies: '', current_conditions: '', insurance_provider: '', insurance_id: '', insurance_group: '', preferred_pharmacist: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.first_name || !form.last_name || !form.date_of_birth || !form.phone) return;
    setSaving(true);
    try {
      await fetch('/api/admin/pharmacy/patients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, allergies: form.allergies ? form.allergies.split(',').map(s => s.trim()) : [], current_conditions: form.current_conditions ? form.current_conditions.split(',').map(s => s.trim()) : [] }) });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-4 text-slate-800">New Patient</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500">First Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.first_name} onChange={e => f('first_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Last Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.last_name} onChange={e => f('last_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Date of Birth *</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.date_of_birth} onChange={e => f('date_of_birth', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Health Card #</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.health_card_number} onChange={e => f('health_card_number', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Phone *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.phone} onChange={e => f('phone', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Email</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.email} onChange={e => f('email', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Address</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.address} onChange={e => f('address', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">City</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.city} onChange={e => f('city', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Province</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.province} onChange={e => f('province', e.target.value)}>{PROVINCES.map(p => <option key={p}>{p}</option>)}</select></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">⚠️ Allergies (comma-separated)</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5 border-red-300" placeholder="e.g. penicillin, sulfa, aspirin" value={form.allergies} onChange={e => f('allergies', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Current Conditions (comma-separated)</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" placeholder="e.g. hypertension, diabetes, asthma" value={form.current_conditions} onChange={e => f('current_conditions', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Insurance Provider</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.insurance_provider} onChange={e => f('insurance_provider', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Insurance ID</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.insurance_id} onChange={e => f('insurance_id', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Insurance Group</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.insurance_group} onChange={e => f('insurance_group', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Preferred Pharmacist</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.preferred_pharmacist} onChange={e => f('preferred_pharmacist', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.notes} onChange={e => f('notes', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded border text-sm">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 rounded bg-blue-600 text-white text-sm disabled:opacity-50">{saving ? 'Saving…' : 'Add Patient'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Prescription Modal ──────────────────────────────────────────────────
function AddPrescriptionModal({ patients, onClose, onSaved }: { patients: Patient[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ patient_id: '', din: '', drug_name: '', brand_name: '', strength: '', form: '', quantity: '', days_supply: '', refills_authorized: '0', directions: '', prescriber_name: '', prescriber_license: '', prescriber_phone: '', written_date: new Date().toISOString().slice(0, 10), patient_cost: '', insurance_paid: '' });
  const [saving, setSaving] = useState(false);
  const fld = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.patient_id || !form.drug_name || !form.strength || !form.quantity || !form.directions || !form.prescriber_name || !form.written_date) return;
    setSaving(true);
    try {
      await fetch('/api/admin/pharmacy/prescriptions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, patient_id: parseInt(form.patient_id), quantity: parseInt(form.quantity), days_supply: form.days_supply ? parseInt(form.days_supply) : null, refills_authorized: parseInt(form.refills_authorized), patient_cost: form.patient_cost ? parseFloat(form.patient_cost) : null, insurance_paid: form.insurance_paid ? parseFloat(form.insurance_paid) : null }) });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-4 text-slate-800">New Prescription</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs text-gray-500">Patient *</label>
            <select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.patient_id} onChange={e => fld('patient_id', e.target.value)}>
              <option value="">Select patient…</option>
              {patients.map(p => <option key={p.id} value={p.id}>{p.last_name}, {p.first_name} {p.allergies?.length ? `⚠️ Allergies: ${p.allergies.join(', ')}` : ''}</option>)}
            </select>
          </div>
          <div><label className="text-xs text-gray-500">DIN</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5 font-mono" value={form.din} onChange={e => fld('din', e.target.value)} placeholder="00000000" /></div>
          <div><label className="text-xs text-gray-500">Drug Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.drug_name} onChange={e => fld('drug_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Brand Name</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.brand_name} onChange={e => fld('brand_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Strength *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.strength} onChange={e => fld('strength', e.target.value)} placeholder="e.g. 10mg" /></div>
          <div><label className="text-xs text-gray-500">Form</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.form} onChange={e => fld('form', e.target.value)}><option value="">Select…</option>{['tablet','capsule','liquid','cream','ointment','patch','inhaler','injection','suppository','drops','spray'].map(f => <option key={f}>{f}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Quantity *</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.quantity} onChange={e => fld('quantity', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Days Supply</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.days_supply} onChange={e => fld('days_supply', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Refills Authorized</label><input type="number" min="0" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.refills_authorized} onChange={e => fld('refills_authorized', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Directions *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.directions} onChange={e => fld('directions', e.target.value)} placeholder="e.g. Take 1 tablet by mouth twice daily with food" /></div>
          <div><label className="text-xs text-gray-500">Prescriber Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.prescriber_name} onChange={e => fld('prescriber_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">License #</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5 font-mono" value={form.prescriber_license} onChange={e => fld('prescriber_license', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Prescriber Phone</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.prescriber_phone} onChange={e => fld('prescriber_phone', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Written Date *</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.written_date} onChange={e => fld('written_date', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Patient Cost ($)</label><input type="number" step="0.01" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.patient_cost} onChange={e => fld('patient_cost', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Insurance Paid ($)</label><input type="number" step="0.01" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.insurance_paid} onChange={e => fld('insurance_paid', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded border text-sm">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 rounded bg-blue-600 text-white text-sm disabled:opacity-50">{saving ? 'Saving…' : 'Create Prescription'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Inventory Modal ─────────────────────────────────────────────────────
function AddInventoryModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ din: '', drug_name: '', brand_name: '', manufacturer: '', strength: '', form: '', quantity_on_hand: '0', reorder_point: '50', reorder_quantity: '200', unit_cost: '', selling_price: '', location: '', expiry_date: '', narcotic: false });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.din || !form.drug_name) return;
    setSaving(true);
    try {
      await fetch('/api/admin/pharmacy/inventory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, quantity_on_hand: parseInt(form.quantity_on_hand), reorder_point: parseInt(form.reorder_point), reorder_quantity: parseInt(form.reorder_quantity), unit_cost: form.unit_cost ? parseFloat(form.unit_cost) : null, selling_price: form.selling_price ? parseFloat(form.selling_price) : null }) });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-4 text-slate-800">Add Inventory Item</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500">DIN *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5 font-mono" value={form.din} onChange={e => f('din', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Drug Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.drug_name} onChange={e => f('drug_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Brand Name</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.brand_name} onChange={e => f('brand_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Manufacturer</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.manufacturer} onChange={e => f('manufacturer', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Strength</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.strength} onChange={e => f('strength', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Form</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.form} onChange={e => f('form', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Qty on Hand</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.quantity_on_hand} onChange={e => f('quantity_on_hand', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Reorder Point</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.reorder_point} onChange={e => f('reorder_point', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Unit Cost ($)</label><input type="number" step="0.01" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.unit_cost} onChange={e => f('unit_cost', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Selling Price ($)</label><input type="number" step="0.01" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.selling_price} onChange={e => f('selling_price', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Location</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.location} onChange={e => f('location', e.target.value)} placeholder="e.g. Shelf A-3" /></div>
          <div><label className="text-xs text-gray-500">Expiry Date</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.expiry_date} onChange={e => f('expiry_date', e.target.value)} /></div>
          <div className="col-span-2 flex items-center gap-2 mt-1">
            <input type="checkbox" id="narcotic" checked={form.narcotic} onChange={e => f('narcotic', e.target.checked)} className="w-4 h-4" />
            <label htmlFor="narcotic" className="text-sm text-red-700 font-medium">Narcotic / Controlled Substance</label>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded border text-sm">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 rounded bg-blue-600 text-white text-sm disabled:opacity-50">{saving ? 'Saving…' : 'Add to Inventory'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Adjust Quantity Modal ───────────────────────────────────────────────────
function AdjustQtyModal({ item, onClose, onSaved }: { item: InventoryItem; onClose: () => void; onSaved: () => void }) {
  const [adjust, setAdjust] = useState('');
  const [saving, setSaving] = useState(false);
  async function submit() {
    setSaving(true);
    try {
      await fetch(`/api/admin/pharmacy/inventory/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adjust_quantity: parseInt(adjust) }) });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-80 p-6">
        <h3 className="font-bold mb-3 text-slate-800">Adjust Quantity</h3>
        <p className="text-sm text-gray-600 mb-2">{item.drug_name} {item.strength} — Current: <strong>{item.quantity_on_hand}</strong></p>
        <label className="text-xs text-gray-500">Adjustment (+/-)</label>
        <input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={adjust} onChange={e => setAdjust(e.target.value)} placeholder="e.g. 100 or -20" />
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-3 py-1.5 rounded border text-sm">Cancel</button>
          <button onClick={submit} disabled={saving || !adjust} className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm disabled:opacity-50">{saving ? 'Saving…' : 'Apply'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard Tab ───────────────────────────────────────────────────────────
function DashboardTab({ data, prescriptions }: { data: DashData | null; prescriptions: Prescription[] }) {
  const columns: Record<string, Prescription[]> = { new: [], on_hold: [], ready: [], dispensed: [] };
  prescriptions.slice(0, 40).forEach(rx => { if (columns[rx.status]) columns[rx.status].push(rx); });
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Prescriptions Today" value={data?.prescriptions_today ?? '—'} color="blue" />
        <KpiCard label="Ready for Pickup" value={data?.ready_for_pickup ?? '—'} color="green" />
        <KpiCard label="Low Stock Items" value={data?.low_stock_count ?? '—'} color="red" />
        <KpiCard label="Refills Due (7d)" value={data?.refills_due_7d ?? '—'} color="amber" />
      </div>
      <div>
        <h3 className="font-semibold text-slate-700 mb-3">Today&apos;s Queue</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(['new', 'on_hold', 'ready', 'dispensed'] as const).map(st => (
            <div key={st} className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">{st.replace('_', ' ')}</p>
              <div className="space-y-2">
                {columns[st].length === 0 && <p className="text-xs text-gray-400">—</p>}
                {columns[st].map(rx => (
                  <div key={rx.id} className="bg-white rounded p-2 shadow-sm border-l-2 border-blue-400">
                    <p className="text-xs font-medium text-slate-800">{rx.last_name}, {rx.first_name}</p>
                    <p className="text-xs text-gray-500">{rx.drug_name} {rx.strength}</p>
                    {rx.allergies?.length > 0 && <p className="text-xs text-red-600 font-medium mt-0.5">⚠️ {rx.allergies.join(', ')}</p>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Prescriptions Tab ───────────────────────────────────────────────────────
function PrescriptionsTab({ prescriptions, patients, onRefresh }: { prescriptions: Prescription[]; patients: Patient[]; onRefresh: () => void }) {
  const [statusFilter, setStatusFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [dispensing, setDispensing] = useState<number | null>(null);

  const filtered = prescriptions.filter(rx => !statusFilter || rx.status === statusFilter);

  async function dispense(rx: Prescription) {
    if (!confirm(`Dispense ${rx.drug_name} ${rx.strength} for ${rx.last_name}, ${rx.first_name}?`)) return;
    setDispensing(rx.id);
    try {
      await fetch(`/api/admin/pharmacy/prescriptions/${rx.id}/dispense`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dispensed_by: 'Pharmacist' }) });
      onRefresh();
    } finally { setDispensing(null); }
  }

  async function updateStatus(rx: Prescription, status: string) {
    await fetch(`/api/admin/pharmacy/prescriptions/${rx.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    onRefresh();
  }

  return (
    <div className="space-y-4">
      {showAdd && <AddPrescriptionModal patients={patients} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); onRefresh(); }} />}
      <div className="flex items-center gap-3">
        <select className="border rounded px-2 py-1.5 text-sm" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {RX_STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <button onClick={() => setShowAdd(true)} className="ml-auto px-4 py-2 rounded bg-blue-600 text-white text-sm">+ New Prescription</button>
      </div>
      <div className="space-y-3">
        {filtered.length === 0 && <p className="text-gray-400 text-sm py-4 text-center">No prescriptions found.</p>}
        {filtered.map(rx => (
          <div key={rx.id} className="bg-white border rounded-lg p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-800">{rx.last_name}, {rx.first_name}</span>
                  <Badge label={rx.status} color={statusColor(rx.status)} />
                  {rx.allergies?.length > 0 && <Badge label={`⚠️ Allergies: ${rx.allergies.slice(0, 2).join(', ')}`} color="red" />}
                </div>
                <p className="text-sm text-gray-700 mt-1"><strong>{rx.drug_name}</strong>{rx.brand_name ? ` (${rx.brand_name})` : ''} {rx.strength} — {rx.form}</p>
                <p className="text-xs text-gray-500 mt-0.5">{rx.directions}</p>
                <p className="text-xs text-gray-400 mt-0.5">Dr. {rx.prescriber_name} · Written {fmtDate(rx.written_date)} · Qty {rx.quantity} · Refills left: {rx.refills_remaining}</p>
                <p className="text-xs text-gray-400">Patient cost: {fmtCad(rx.patient_cost)} · Insurance: {fmtCad(rx.insurance_paid ?? 0)}</p>
              </div>
              <div className="flex flex-col gap-2 items-end shrink-0">
                {rx.status === 'new' && <button onClick={() => updateStatus(rx, 'ready')} className="px-3 py-1 text-xs rounded bg-green-600 text-white">Mark Ready</button>}
                {rx.status === 'ready' && <button onClick={() => dispense(rx)} disabled={dispensing === rx.id} className="px-3 py-1 text-xs rounded bg-teal-600 text-white disabled:opacity-50">{dispensing === rx.id ? '…' : 'Dispense'}</button>}
                {(rx.status === 'new' || rx.status === 'ready') && <button onClick={() => updateStatus(rx, 'on_hold')} className="px-3 py-1 text-xs rounded bg-amber-500 text-white">On Hold</button>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Patients Tab ────────────────────────────────────────────────────────────
function PatientsTab({ patients, onRefresh }: { patients: Patient[]; onRefresh: () => void }) {
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [filtered, setFiltered] = useState<Patient[]>(patients);

  useEffect(() => {
    setFiltered(patients.filter(p => `${p.first_name} ${p.last_name} ${p.health_card_number} ${p.phone}`.toLowerCase().includes(search.toLowerCase())));
  }, [search, patients]);

  return (
    <div className="space-y-4">
      {showAdd && <AddPatientModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); onRefresh(); }} />}
      <div className="flex items-center gap-3">
        <input className="border rounded px-2 py-1.5 text-sm flex-1 max-w-sm" placeholder="Search name, health card, phone…" value={search} onChange={e => setSearch(e.target.value)} />
        <button onClick={() => setShowAdd(true)} className="ml-auto px-4 py-2 rounded bg-blue-600 text-white text-sm">+ Add Patient</button>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>{['Patient', 'DOB', 'Health Card', 'Phone', 'Allergies', 'Conditions', 'Insurance', 'City'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map(p => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium text-slate-800">{p.last_name}, {p.first_name}</td>
                <td className="px-3 py-2 text-gray-500">{fmtDate(p.date_of_birth)}</td>
                <td className="px-3 py-2 font-mono text-xs">{p.health_card_number ?? '—'}</td>
                <td className="px-3 py-2">{p.phone}</td>
                <td className="px-3 py-2">{p.allergies?.length > 0 ? <span className="text-red-600 font-medium text-xs">⚠️ {p.allergies.join(', ')}</span> : <span className="text-gray-300 text-xs">None</span>}</td>
                <td className="px-3 py-2 text-xs text-gray-600">{p.current_conditions?.join(', ') || '—'}</td>
                <td className="px-3 py-2 text-xs text-gray-600">{p.insurance_provider ?? '—'}</td>
                <td className="px-3 py-2 text-xs text-gray-500">{p.city}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="text-center text-gray-400 text-sm py-6">No patients found.</p>}
      </div>
    </div>
  );
}

// ─── Inventory Tab ───────────────────────────────────────────────────────────
function InventoryTab() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [expiring, setExpiring] = useState<InventoryItem[]>([]);
  const [view, setView] = useState<'all' | 'lowstock' | 'expiring'>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);

  const load = useCallback(async () => {
    const [all, exp] = await Promise.all([
      fetch('/api/admin/pharmacy/inventory').then(r => r.json()),
      fetch('/api/admin/pharmacy/inventory/expiring').then(r => r.json()),
    ]);
    setItems(all);
    setExpiring(exp);
  }, []);
  useEffect(() => { load(); }, [load]);

  const displayed = view === 'expiring' ? expiring : view === 'lowstock' ? items.filter(i => i.quantity_on_hand <= i.reorder_point) : items;

  function expiryWarning(d: string) {
    if (!d) return '';
    const days = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
    return days <= 30 ? 'red' : days <= 90 ? 'amber' : '';
  }

  return (
    <div className="space-y-4">
      {showAdd && <AddInventoryModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
      {adjustItem && <AdjustQtyModal item={adjustItem} onClose={() => setAdjustItem(null)} onSaved={() => { setAdjustItem(null); load(); }} />}
      <div className="flex items-center gap-3 flex-wrap">
        {(['all', 'lowstock', 'expiring'] as const).map(v => <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 text-sm rounded border ${view === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600'}`}>{v === 'lowstock' ? 'Low Stock' : v === 'expiring' ? 'Expiring Soon' : 'All Items'}</button>)}
        <button onClick={() => setShowAdd(true)} className="ml-auto px-4 py-2 rounded bg-blue-600 text-white text-sm">+ Add Item</button>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>{['DIN', 'Drug', 'Strength/Form', 'On Hand', 'Reorder @', 'Expiry', 'Location', 'Narcotic', ''].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {displayed.map(i => {
              const low = i.quantity_on_hand <= i.reorder_point;
              const expWarn = expiryWarning(i.expiry_date);
              return (
                <tr key={i.id} className={`hover:bg-gray-50 ${low ? 'bg-red-50' : ''}`}>
                  <td className="px-3 py-2 font-mono text-xs">{i.din}</td>
                  <td className="px-3 py-2 font-medium text-slate-800">{i.drug_name}{i.brand_name ? ` (${i.brand_name})` : ''}</td>
                  <td className="px-3 py-2 text-gray-600 text-xs">{i.strength} {i.form}</td>
                  <td className={`px-3 py-2 font-bold ${low ? 'text-red-600' : 'text-slate-800'}`}>{i.quantity_on_hand}</td>
                  <td className="px-3 py-2 text-gray-400 text-xs">{i.reorder_point}</td>
                  <td className={`px-3 py-2 text-xs font-medium ${expWarn === 'red' ? 'text-red-600' : expWarn === 'amber' ? 'text-amber-600' : 'text-gray-500'}`}>{fmtDate(i.expiry_date)}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{i.location ?? '—'}</td>
                  <td className="px-3 py-2 text-xs">{i.narcotic ? <span className="text-red-600 font-bold">NARC</span> : '—'}</td>
                  <td className="px-3 py-2"><button onClick={() => setAdjustItem(i)} className="text-xs text-blue-600 hover:underline">Adjust Qty</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {displayed.length === 0 && <p className="text-center text-gray-400 text-sm py-6">No items found.</p>}
      </div>
    </div>
  );
}

// ─── Drug Interaction Checker Tab ────────────────────────────────────────────
function InteractionsTab({ patients }: { patients: Patient[] }) {
  const [patientId, setPatientId] = useState('');
  const [newDrug, setNewDrug] = useState('');
  const [strength, setStrength] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAI, setIsAI] = useState(false);

  const selectedPatient = patients.find(p => p.id === parseInt(patientId));

  async function check() {
    if (!newDrug) return;
    setLoading(true);
    setResult('');
    try {
      const res = await fetch('/api/admin/pharmacy/ai-interaction-check', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allergies: selectedPatient?.allergies ?? [], current_meds: selectedPatient?.current_conditions ?? [], new_drug: newDrug, strength }),
      });
      const data = await res.json();
      setResult(data.result);
      setIsAI(data.ai);
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
        ⚠️ This tool provides AI-assisted clinical decision support only. The pharmacist must independently verify all interactions before dispensing.
      </div>
      <div>
        <label className="text-xs text-gray-500">Patient</label>
        <select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={patientId} onChange={e => setPatientId(e.target.value)}>
          <option value="">Select patient (optional)…</option>
          {patients.map(p => <option key={p.id} value={p.id}>{p.last_name}, {p.first_name}</option>)}
        </select>
        {selectedPatient && (
          <div className="mt-2 p-2 bg-red-50 rounded text-xs">
            <strong>Allergies:</strong> {selectedPatient.allergies?.join(', ') || 'None documented'}<br />
            <strong>Conditions:</strong> {selectedPatient.current_conditions?.join(', ') || 'None documented'}
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-xs text-gray-500">New Drug Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={newDrug} onChange={e => setNewDrug(e.target.value)} placeholder="e.g. Metformin" /></div>
        <div><label className="text-xs text-gray-500">Strength</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={strength} onChange={e => setStrength(e.target.value)} placeholder="e.g. 500mg" /></div>
      </div>
      <button onClick={check} disabled={loading || !newDrug} className="px-5 py-2 rounded bg-blue-600 text-white text-sm disabled:opacity-50">{loading ? 'Checking…' : 'Check Interactions'}</button>
      {result && (
        <div className={`rounded-lg p-4 border text-sm whitespace-pre-wrap font-mono ${isAI ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
          <p className="text-xs mb-2 font-sans text-gray-500">{isAI ? '🤖 AI Response' : '📋 Manual Checklist (AI unavailable)'}</p>
          {result}
        </div>
      )}
    </div>
  );
}

// ─── Patient Counselling Tab ─────────────────────────────────────────────────
function CounsellingTab({ prescriptions }: { prescriptions: Prescription[] }) {
  const [rxId, setRxId] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAI, setIsAI] = useState(false);

  const selected = prescriptions.find(rx => rx.id === parseInt(rxId));

  async function generate() {
    if (!selected) return;
    setLoading(true);
    setResult('');
    try {
      const res = await fetch('/api/admin/pharmacy/ai-counselling', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drug_name: selected.drug_name, strength: selected.strength, directions: selected.directions, patient_name: `${selected.first_name} ${selected.last_name}` }),
      });
      const data = await res.json();
      setResult(data.result);
      setIsAI(data.ai);
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <label className="text-xs text-gray-500">Select Prescription</label>
        <select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={rxId} onChange={e => setRxId(e.target.value)}>
          <option value="">Select…</option>
          {prescriptions.map(rx => <option key={rx.id} value={rx.id}>{rx.last_name}, {rx.first_name} — {rx.drug_name} {rx.strength}</option>)}
        </select>
        {selected && (
          <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-700">
            <strong>Directions:</strong> {selected.directions} | <strong>Qty:</strong> {selected.quantity} | <strong>Days:</strong> {selected.days_supply ?? '—'}
          </div>
        )}
      </div>
      <button onClick={generate} disabled={loading || !selected} className="px-5 py-2 rounded bg-blue-600 text-white text-sm disabled:opacity-50">{loading ? 'Generating…' : 'Generate Counselling Sheet'}</button>
      {result && (
        <div className={`rounded-lg p-4 border text-sm whitespace-pre-wrap ${isAI ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
          <div className="flex justify-between items-center mb-3">
            <p className="text-xs text-gray-500">{isAI ? '🤖 AI-Generated Counselling Sheet' : '📋 Standard Template'}</p>
            <button onClick={() => window.print()} className="text-xs text-blue-600 hover:underline">Print</button>
          </div>
          {result}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function PharmacyPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [dash, setDash] = useState<DashData | null>(null);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);

  const loadAll = useCallback(async () => {
    const [d, rxs, pts] = await Promise.all([
      fetch('/api/admin/pharmacy').then(r => r.json()),
      fetch('/api/admin/pharmacy/prescriptions').then(r => r.json()),
      fetch('/api/admin/pharmacy/patients').then(r => r.json()),
    ]);
    setDash(d);
    setPrescriptions(Array.isArray(rxs) ? rxs : []);
    setPatients(Array.isArray(pts) ? pts : []);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-xl font-bold text-slate-800">Pharmacy & Dispensary Hub</h1>
        <p className="text-sm text-gray-500 mt-0.5">Prescription management, inventory, drug interactions &amp; patient counselling</p>
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
        {tab === 'dashboard' && <DashboardTab data={dash} prescriptions={prescriptions} />}
        {tab === 'prescriptions' && <PrescriptionsTab prescriptions={prescriptions} patients={patients} onRefresh={loadAll} />}
        {tab === 'patients' && <PatientsTab patients={patients} onRefresh={loadAll} />}
        {tab === 'inventory' && <InventoryTab />}
        {tab === 'interactions' && <InteractionsTab patients={patients} />}
        {tab === 'counselling' && <CounsellingTab prescriptions={prescriptions} />}
      </div>
    </div>
  );
}
