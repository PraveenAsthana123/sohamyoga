'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard','patients','exams','recalls','frames','orders','ai'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = { dashboard: 'Dashboard', patients: 'Patients', exams: 'Exams', recalls: 'Recalls', frames: 'Frame Inventory', orders: 'Orders', ai: 'AI Eye Care' };

const EXAM_TYPES = ['comprehensive','contact_lens','follow_up','emergency','pediatric','low_vision'];
const ORDER_TYPES = ['glasses','contact_lenses','sunglasses','accessories','repair'];
const ORDER_STATUSES = ['ordered','lab','ready','dispensed','cancelled'];
const FRAME_TYPES = ['full_rim','semi_rim','rimless','sports','kids'];

interface Patient { id: number; first_name: string; last_name: string; date_of_birth: string; phone: string; email: string; insurance_provider: string; last_exam_date: string; next_recall_date: string; recall_interval_months: number; city: string; }
interface Exam { id: number; patient_id: number; first_name: string; last_name: string; exam_date: string; optometrist: string; exam_type: string; od_sphere: number; os_sphere: number; od_visual_acuity: string; os_visual_acuity: string; total_fee: number; patient_paid: number; notes: string; }
interface Frame { id: number; brand: string; model: string; sku: string; color: string; frame_type: string; retail_price: number; quantity_on_hand: number; reorder_point: number; }
interface Order { id: number; patient_id: number; first_name: string; last_name: string; order_type: string; status: string; total_amount: number; deposit_paid: number; patient_balance: number; expected_ready_date: string; lab_reference: string; }
interface Dashboard { exams_today: number; recalls_due_30d: number; orders_in_lab: number; frames_low_stock: number; revenue_mtd: number; }

function fmtCad(n: number) { return `$${Number(n ?? 0).toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`; }
function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString('en-CA') : '—'; }
function recallStatus(p: Patient): 'overdue' | 'due' | 'ok' {
  if (!p.next_recall_date) return 'ok';
  const d = new Date(p.next_recall_date);
  if (d < new Date()) return 'overdue';
  if (d < new Date(Date.now() + 30 * 24 * 3600000)) return 'due';
  return 'ok';
}

function Badge({ label, color = 'gray' }: { label: string; color?: string }) {
  const m: Record<string, string> = { blue: 'bg-blue-100 text-blue-700', green: 'bg-green-100 text-green-700', amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700', purple: 'bg-purple-100 text-purple-700', gray: 'bg-gray-100 text-gray-700', teal: 'bg-teal-100 text-teal-700' };
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${m[color] ?? m.gray}`}>{label}</span>;
}

function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const c: Record<string, string> = { blue: 'border-l-4 border-blue-500 bg-blue-50', green: 'border-l-4 border-green-500 bg-green-50', amber: 'border-l-4 border-amber-500 bg-amber-50', red: 'border-l-4 border-red-500 bg-red-50', purple: 'border-l-4 border-purple-500 bg-purple-50' };
  return <div className={`rounded-lg p-4 ${c[color] ?? c.blue}`}><p className="text-sm text-gray-500">{label}</p><p className="text-2xl font-bold mt-1">{value}</p>{sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}</div>;
}

// ─── Add Patient Modal ─────────────────────────────────────────────────────────
function AddPatientModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', date_of_birth: '', health_card_number: '', phone: '', email: '', address: '', city: 'Calgary', province: 'AB', postal_code: '', insurance_provider: '', insurance_id: '', recall_interval_months: '12', notes: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.first_name || !form.last_name || !form.date_of_birth || !form.phone) return;
    setSaving(true);
    try {
      await fetch('/api/admin/optometry-clinic/patients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, recall_interval_months: parseInt(form.recall_interval_months) }) });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-4 text-slate-800">New Patient</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500">First Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.first_name} onChange={e => f('first_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Last Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.last_name} onChange={e => f('last_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Date of Birth *</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.date_of_birth} onChange={e => f('date_of_birth', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Health Card #</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5 font-mono" value={form.health_card_number} onChange={e => f('health_card_number', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Phone *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.phone} onChange={e => f('phone', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Email</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.email} onChange={e => f('email', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Insurance Provider</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.insurance_provider} onChange={e => f('insurance_provider', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Insurance ID</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.insurance_id} onChange={e => f('insurance_id', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Recall Interval (months)</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.recall_interval_months} onChange={e => f('recall_interval_months', e.target.value)}>{['6','12','18','24'].map(v => <option key={v} value={v}>{v} months</option>)}</select></div>
          <div><label className="text-xs text-gray-500">City</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.city} onChange={e => f('city', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.notes} onChange={e => f('notes', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border rounded hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Add Patient'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── New Exam Modal ────────────────────────────────────────────────────────────
function NewExamModal({ patients, onClose, onSaved }: { patients: Patient[]; onClose: () => void; onSaved: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ patient_id: '', exam_date: today, optometrist: '', exam_type: 'comprehensive', chief_complaint: '', od_sphere: '', od_cylinder: '', od_axis: '', od_visual_acuity: '', os_sphere: '', os_cylinder: '', os_axis: '', os_visual_acuity: '', od_iop: '', os_iop: '', pupil_distance: '', diagnosis: '', total_fee: '', insurance_claimed: '', patient_paid: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.patient_id || !form.exam_date || !form.optometrist) return;
    setSaving(true);
    try {
      await fetch('/api/admin/optometry-clinic/exams', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, patient_id: parseInt(form.patient_id), diagnosis: form.diagnosis ? [form.diagnosis] : undefined, od_sphere: form.od_sphere ? parseFloat(form.od_sphere) : undefined, os_sphere: form.os_sphere ? parseFloat(form.os_sphere) : undefined, od_cylinder: form.od_cylinder ? parseFloat(form.od_cylinder) : undefined, os_cylinder: form.os_cylinder ? parseFloat(form.os_cylinder) : undefined, od_axis: form.od_axis ? parseInt(form.od_axis) : undefined, os_axis: form.os_axis ? parseInt(form.os_axis) : undefined, od_iop: form.od_iop ? parseFloat(form.od_iop) : undefined, os_iop: form.os_iop ? parseFloat(form.os_iop) : undefined, pupil_distance: form.pupil_distance ? parseFloat(form.pupil_distance) : undefined, total_fee: form.total_fee ? parseFloat(form.total_fee) : undefined, insurance_claimed: form.insurance_claimed ? parseFloat(form.insurance_claimed) : undefined, patient_paid: form.patient_paid ? parseFloat(form.patient_paid) : undefined }) });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-4 text-slate-800">New Eye Exam</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs text-gray-500">Patient *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.patient_id} onChange={e => f('patient_id', e.target.value)}><option value="">Select patient…</option>{patients.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name} – {p.phone}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Exam Date *</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.exam_date} onChange={e => f('exam_date', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Optometrist *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.optometrist} onChange={e => f('optometrist', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Exam Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.exam_type} onChange={e => f('exam_type', e.target.value)}>{EXAM_TYPES.map(t => <option key={t}>{t.replace('_', ' ')}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Chief Complaint</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.chief_complaint} onChange={e => f('chief_complaint', e.target.value)} /></div>
          <div className="col-span-2"><p className="text-xs font-semibold text-gray-600 mt-2 mb-1">Refraction — OD (Right)</p></div>
          <div><label className="text-xs text-gray-500">OD Sphere</label><input type="number" step="0.25" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.od_sphere} onChange={e => f('od_sphere', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">OD Cylinder</label><input type="number" step="0.25" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.od_cylinder} onChange={e => f('od_cylinder', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">OD Axis</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.od_axis} onChange={e => f('od_axis', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">OD Visual Acuity</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" placeholder="e.g. 20/20" value={form.od_visual_acuity} onChange={e => f('od_visual_acuity', e.target.value)} /></div>
          <div className="col-span-2"><p className="text-xs font-semibold text-gray-600 mt-2 mb-1">Refraction — OS (Left)</p></div>
          <div><label className="text-xs text-gray-500">OS Sphere</label><input type="number" step="0.25" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.os_sphere} onChange={e => f('os_sphere', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">OS Cylinder</label><input type="number" step="0.25" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.os_cylinder} onChange={e => f('os_cylinder', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">OS Axis</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.os_axis} onChange={e => f('os_axis', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">OS Visual Acuity</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" placeholder="e.g. 20/25" value={form.os_visual_acuity} onChange={e => f('os_visual_acuity', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">OD IOP (mmHg)</label><input type="number" step="0.1" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.od_iop} onChange={e => f('od_iop', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">OS IOP (mmHg)</label><input type="number" step="0.1" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.os_iop} onChange={e => f('os_iop', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Pupil Distance (mm)</label><input type="number" step="0.5" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.pupil_distance} onChange={e => f('pupil_distance', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Diagnosis</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.diagnosis} onChange={e => f('diagnosis', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Total Fee ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.total_fee} onChange={e => f('total_fee', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Insurance Claimed ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.insurance_claimed} onChange={e => f('insurance_claimed', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Patient Paid ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.patient_paid} onChange={e => f('patient_paid', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.notes} onChange={e => f('notes', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border rounded hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Save Exam'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Frame Modal ───────────────────────────────────────────────────────────
function AddFrameModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ brand: '', model: '', sku: '', color: '', size: '', frame_type: 'full_rim', material: '', cost_price: '', retail_price: '', quantity_on_hand: '0', reorder_point: '2' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.brand || !form.model || !form.sku) return;
    setSaving(true);
    try {
      await fetch('/api/admin/optometry-clinic/frames', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, cost_price: form.cost_price ? parseFloat(form.cost_price) : undefined, retail_price: form.retail_price ? parseFloat(form.retail_price) : undefined, quantity_on_hand: parseInt(form.quantity_on_hand), reorder_point: parseInt(form.reorder_point) }) });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
        <h2 className="text-lg font-bold mb-4 text-slate-800">Add Frame</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500">Brand *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.brand} onChange={e => f('brand', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Model *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.model} onChange={e => f('model', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">SKU *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5 font-mono" value={form.sku} onChange={e => f('sku', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Frame Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.frame_type} onChange={e => f('frame_type', e.target.value)}>{FRAME_TYPES.map(t => <option key={t}>{t.replace('_', ' ')}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Color</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.color} onChange={e => f('color', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Size</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.size} placeholder="e.g. 52-18-140" onChange={e => f('size', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Cost Price ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.cost_price} onChange={e => f('cost_price', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Retail Price ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.retail_price} onChange={e => f('retail_price', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Qty on Hand</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.quantity_on_hand} onChange={e => f('quantity_on_hand', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Reorder Point</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.reorder_point} onChange={e => f('reorder_point', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border rounded hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Add Frame'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Order Modal ───────────────────────────────────────────────────────────
function AddOrderModal({ patients, onClose, onSaved }: { patients: Patient[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ patient_id: '', order_type: 'glasses', frame_sku: '', lens_type: '', contact_brand: '', total_amount: '', deposit_paid: '0', insurance_claimed: '0', expected_ready_date: '', lab_reference: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.patient_id || !form.order_type) return;
    setSaving(true);
    try {
      await fetch('/api/admin/optometry-clinic/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, patient_id: parseInt(form.patient_id), total_amount: parseFloat(form.total_amount) || 0, deposit_paid: parseFloat(form.deposit_paid) || 0, insurance_claimed: parseFloat(form.insurance_claimed) || 0 }) });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
        <h2 className="text-lg font-bold mb-4 text-slate-800">New Order</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs text-gray-500">Patient *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.patient_id} onChange={e => f('patient_id', e.target.value)}><option value="">Select patient…</option>{patients.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Order Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.order_type} onChange={e => f('order_type', e.target.value)}>{ORDER_TYPES.map(t => <option key={t}>{t.replace('_', ' ')}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Frame SKU</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5 font-mono" value={form.frame_sku} onChange={e => f('frame_sku', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Lens Type</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.lens_type} onChange={e => f('lens_type', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Lab Reference</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5 font-mono" value={form.lab_reference} onChange={e => f('lab_reference', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Total Amount ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.total_amount} onChange={e => f('total_amount', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Deposit Paid ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.deposit_paid} onChange={e => f('deposit_paid', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Insurance Claimed ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.insurance_claimed} onChange={e => f('insurance_claimed', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Expected Ready Date</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.expected_ready_date} onChange={e => f('expected_ready_date', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.notes} onChange={e => f('notes', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border rounded hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Create Order'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function OptometryPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [recalls, setRecalls] = useState<Patient[]>([]);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState('');
  const [recallDays, setRecallDays] = useState('30');
  const [orderStatus, setOrderStatus] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [showNewExam, setShowNewExam] = useState(false);
  const [showAddFrame, setShowAddFrame] = useState(false);
  const [showAddOrder, setShowAddOrder] = useState(false);
  const [aiPatientId, setAiPatientId] = useState('');
  const [aiMessage, setAiMessage] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [recallMsg, setRecallMsg] = useState<Record<number, string>>({});

  const load = useCallback(async (t: Tab) => {
    if (t === 'dashboard') { const r = await fetch('/api/admin/optometry-clinic'); setDashboard(await r.json()); }
    if (t === 'patients') { const r = await fetch(`/api/admin/optometry-clinic/patients?search=${encodeURIComponent(search)}`); setPatients(await r.json()); }
    if (t === 'exams') { const today = new Date().toISOString().slice(0, 10); const r = await fetch(`/api/admin/optometry-clinic/exams?date=${today}`); setExams(await r.json()); }
    if (t === 'recalls') { const r = await fetch(`/api/admin/optometry-clinic/recalls?days=${recallDays}`); setRecalls(await r.json()); }
    if (t === 'frames') { const r = await fetch(`/api/admin/optometry-clinic/frames?low_stock=${lowStockOnly}`); setFrames(await r.json()); }
    if (t === 'orders') { const r = await fetch(`/api/admin/optometry-clinic/orders?status=${orderStatus}`); setOrders(await r.json()); }
    if (t === 'ai' && patients.length === 0) { const r = await fetch('/api/admin/optometry-clinic/patients'); setPatients(await r.json()); }
  }, [search, recallDays, lowStockOnly, orderStatus, patients.length]);

  useEffect(() => { load(tab); }, [tab, load]);

  async function sendRecall(patientId: number) {
    const r = await fetch(`/api/admin/optometry-clinic/recalls/${patientId}/remind`, { method: 'POST' });
    const data = await r.json();
    setRecallMsg(prev => ({ ...prev, [patientId]: data.ai_message }));
  }

  async function generateAiMessage() {
    setAiLoading(true);
    try {
      const r = await fetch('/api/admin/optometry-clinic/ai-recall-message', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ patient_id: aiPatientId ? parseInt(aiPatientId) : undefined }) });
      const data = await r.json();
      setAiMessage(data.message);
    } finally { setAiLoading(false); }
  }

  async function advanceOrder(id: number) {
    await fetch(`/api/admin/optometry-clinic/orders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ advance_status: true }) });
    load('orders');
  }

  const statusColor = (s: string) => ({ ordered: 'blue', lab: 'amber', ready: 'green', dispensed: 'teal', cancelled: 'red' })[s] ?? 'gray';
  const recallColor = (s: string) => ({ overdue: 'red', due: 'amber', ok: 'green' })[s] ?? 'gray';

  const daysToReady = (d: string) => {
    if (!d) return null;
    const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
    return diff;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-2xl font-bold text-slate-800">Optometry & Vision Care Hub</h1>
        <p className="text-sm text-gray-500 mt-0.5">Patient management, eye exams, recalls, frame inventory, optical orders — Calgary, AB</p>
      </div>
      <div className="flex border-b bg-white px-6 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{TAB_LABELS[t]}</button>
        ))}
      </div>
      <div className="p-6">

        {/* DASHBOARD */}
        {tab === 'dashboard' && dashboard && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <KpiCard label="Exams Today" value={dashboard.exams_today} color="blue" />
              <KpiCard label="Recalls Due (30d)" value={dashboard.recalls_due_30d} color="amber" />
              <KpiCard label="Orders In Lab" value={dashboard.orders_in_lab} color="purple" />
              <KpiCard label="Frames Low Stock" value={dashboard.frames_low_stock} color="red" />
              <KpiCard label="Revenue MTD" value={fmtCad(dashboard.revenue_mtd)} color="green" />
            </div>
            <div className="bg-white rounded-lg border p-4">
              <h3 className="font-semibold text-slate-700 mb-3">Quick Actions</h3>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => { setTab('patients'); setShowAddPatient(true); }} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">+ New Patient</button>
                <button onClick={() => { setTab('exams'); setShowNewExam(true); }} className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700">+ New Exam</button>
                <button onClick={() => setTab('recalls')} className="px-3 py-1.5 text-sm bg-amber-500 text-white rounded hover:bg-amber-600">View Recalls</button>
                <button onClick={() => { setTab('orders'); setShowAddOrder(true); }} className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700">+ New Order</button>
              </div>
            </div>
          </div>
        )}

        {/* PATIENTS */}
        {tab === 'patients' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input className="border rounded px-3 py-1.5 text-sm flex-1 max-w-sm" placeholder="Search patients…" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load('patients')} />
              <button onClick={() => load('patients')} className="px-3 py-1.5 text-sm bg-gray-100 border rounded hover:bg-gray-200">Search</button>
              <button onClick={() => setShowAddPatient(true)} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 ml-auto">+ New Patient</button>
            </div>
            <div className="space-y-2">
              {patients.map(p => {
                const rs = recallStatus(p);
                return (
                  <div key={p.id} className="bg-white rounded-lg border px-4 py-3 flex items-center gap-4">
                    <div className="flex-1">
                      <p className="font-semibold text-slate-800">{p.first_name} {p.last_name}</p>
                      <p className="text-xs text-gray-500">{p.phone} · {p.email} · {p.city}</p>
                      {p.insurance_provider && <p className="text-xs text-gray-400 mt-0.5">Insurance: {p.insurance_provider}</p>}
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      <p>Last exam: {fmtDate(p.last_exam_date)}</p>
                      <p>Next recall: {fmtDate(p.next_recall_date)}</p>
                    </div>
                    <Badge label={rs} color={recallColor(rs)} />
                  </div>
                );
              })}
              {patients.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No patients found.</p>}
            </div>
            {showAddPatient && <AddPatientModal onClose={() => setShowAddPatient(false)} onSaved={() => { setShowAddPatient(false); load('patients'); }} />}
          </div>
        )}

        {/* EXAMS */}
        {tab === 'exams' && (
          <div className="space-y-4">
            <div className="flex gap-2 items-center">
              <span className="text-sm font-medium text-slate-700">Today's Exams</span>
              <button onClick={() => setShowNewExam(true)} className="ml-auto px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">+ New Exam</button>
            </div>
            <div className="space-y-3">
              {exams.map(e => (
                <div key={e.id} className="bg-white rounded-lg border px-4 py-3">
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <p className="font-semibold text-slate-800">{e.first_name} {e.last_name}</p>
                      <p className="text-xs text-gray-500">{e.optometrist} · <Badge label={e.exam_type.replace('_', ' ')} color="blue" /></p>
                      {(e.od_sphere !== null || e.os_sphere !== null) && (
                        <p className="text-xs text-gray-600 mt-1 font-mono">OD: {e.od_sphere > 0 ? '+' : ''}{e.od_sphere} / OS: {e.os_sphere > 0 ? '+' : ''}{e.os_sphere} · VA: {e.od_visual_acuity} / {e.os_visual_acuity}</p>
                      )}
                    </div>
                    <div className="text-right text-sm">
                      {e.total_fee && <p className="font-medium text-green-700">{fmtCad(e.total_fee)}</p>}
                    </div>
                  </div>
                  {e.notes && <p className="text-xs text-gray-400 mt-2 italic">{e.notes}</p>}
                </div>
              ))}
              {exams.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No exams scheduled for today.</p>}
            </div>
            {showNewExam && <NewExamModal patients={patients.length ? patients : []} onClose={() => setShowNewExam(false)} onSaved={() => { setShowNewExam(false); load('exams'); load('patients'); }} />}
          </div>
        )}

        {/* RECALLS */}
        {tab === 'recalls' && (
          <div className="space-y-4">
            <div className="flex gap-2 items-center">
              <span className="text-sm font-medium text-slate-700">Recall Window:</span>
              {['30','60','90'].map(d => (
                <button key={d} onClick={() => { setRecallDays(d); }} className={`px-3 py-1.5 text-sm rounded border ${recallDays === d ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-gray-50'}`}>{d} days</button>
              ))}
            </div>
            <div className="space-y-2">
              {recalls.map((p: Patient & { recall_status?: string }) => (
                <div key={p.id} className="bg-white rounded-lg border px-4 py-3 flex items-center gap-4">
                  <div className="flex-1">
                    <p className="font-semibold text-slate-800">{p.first_name} {p.last_name}</p>
                    <p className="text-xs text-gray-500">{p.phone} · {p.email}</p>
                    <p className="text-xs text-gray-400">Last exam: {fmtDate(p.last_exam_date)} · Due: {fmtDate(p.next_recall_date)} · Every {p.recall_interval_months}mo</p>
                    {recallMsg[p.id] && <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">{recallMsg[p.id]}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge label={(p as { recall_status?: string }).recall_status ?? 'due'} color={recallColor((p as { recall_status?: string }).recall_status ?? 'due')} />
                    <button onClick={() => sendRecall(p.id)} className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">Send Reminder</button>
                  </div>
                </div>
              ))}
              {recalls.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No recalls due in this window.</p>}
            </div>
          </div>
        )}

        {/* FRAMES */}
        {tab === 'frames' && (
          <div className="space-y-4">
            <div className="flex gap-2 items-center">
              <label className="flex items-center gap-1 text-sm text-gray-600 cursor-pointer"><input type="checkbox" checked={lowStockOnly} onChange={e => setLowStockOnly(e.target.checked)} className="mr-1" />Low Stock Only</label>
              <button onClick={() => load('frames')} className="px-3 py-1.5 text-sm bg-gray-100 border rounded hover:bg-gray-200">Refresh</button>
              <button onClick={() => setShowAddFrame(true)} className="ml-auto px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">+ Add Frame</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {frames.map(fr => {
                const isLow = fr.quantity_on_hand <= fr.reorder_point;
                return (
                  <div key={fr.id} className={`bg-white rounded-lg border px-4 py-3 ${isLow ? 'border-red-300' : ''}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-slate-800">{fr.brand} {fr.model}</p>
                        <p className="text-xs text-gray-500 font-mono">{fr.sku} · {fr.color} · {fr.frame_type?.replace('_', ' ')}</p>
                      </div>
                      <span className={`text-lg font-bold ${isLow ? 'text-red-600' : 'text-green-700'}`}>{fr.quantity_on_hand}</span>
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-gray-400">
                      <span>Retail: {fr.retail_price ? fmtCad(fr.retail_price) : '—'}</span>
                      <span>Reorder at: {fr.reorder_point}</span>
                    </div>
                    {isLow && <p className="text-xs text-red-500 mt-1 font-medium">Low stock — reorder needed</p>}
                  </div>
                );
              })}
              {frames.length === 0 && <p className="text-sm text-gray-400 col-span-3 text-center py-8">No frames found.</p>}
            </div>
            {showAddFrame && <AddFrameModal onClose={() => setShowAddFrame(false)} onSaved={() => { setShowAddFrame(false); load('frames'); }} />}
          </div>
        )}

        {/* ORDERS */}
        {tab === 'orders' && (
          <div className="space-y-4">
            <div className="flex gap-2 items-center flex-wrap">
              <span className="text-sm font-medium text-slate-700">Filter:</span>
              {['','ordered','lab','ready','dispensed'].map(s => (
                <button key={s} onClick={() => { setOrderStatus(s); }} className={`px-3 py-1 text-xs rounded border ${orderStatus === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-gray-50'}`}>{s || 'All'}</button>
              ))}
              <button onClick={() => setShowAddOrder(true)} className="ml-auto px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">+ New Order</button>
            </div>
            <div className="space-y-2">
              {orders.map(o => {
                const days = daysToReady(o.expected_ready_date);
                return (
                  <div key={o.id} className="bg-white rounded-lg border px-4 py-3 flex items-center gap-4">
                    <div className="flex-1">
                      <p className="font-semibold text-slate-800">{o.first_name} {o.last_name} <Badge label={o.order_type.replace('_', ' ')} color="blue" /></p>
                      <p className="text-xs text-gray-500">{o.lab_reference ? `Lab ref: ${o.lab_reference} · ` : ''}Expected: {fmtDate(o.expected_ready_date)}{days !== null ? ` (${days > 0 ? `${days}d` : 'overdue'})` : ''}</p>
                      <p className="text-xs text-gray-400">Total: {fmtCad(o.total_amount)} · Balance: {fmtCad(o.patient_balance)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge label={o.status} color={statusColor(o.status)} />
                      {['ordered','lab','ready'].includes(o.status) && (
                        <button onClick={() => advanceOrder(o.id)} className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700">Advance →</button>
                      )}
                    </div>
                  </div>
                );
              })}
              {orders.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No orders found.</p>}
            </div>
            {showAddOrder && <AddOrderModal patients={patients} onClose={() => setShowAddOrder(false)} onSaved={() => { setShowAddOrder(false); load('orders'); }} />}
          </div>
        )}

        {/* AI EYE CARE */}
        {tab === 'ai' && (
          <div className="max-w-2xl space-y-6">
            <div className="bg-white rounded-lg border p-5">
              <h3 className="font-semibold text-slate-700 mb-3">AI Recall Message Generator</h3>
              <p className="text-sm text-gray-500 mb-4">Select a patient and generate a personalized recall reminder using local AI (Llama 3.2).</p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500">Patient (optional — generates generic message if not selected)</label>
                  <select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiPatientId} onChange={e => setAiPatientId(e.target.value)}>
                    <option value="">Select patient…</option>
                    {patients.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                  </select>
                </div>
                <button onClick={generateAiMessage} disabled={aiLoading} className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50">{aiLoading ? 'Generating…' : 'Generate Recall Message'}</button>
                {aiMessage && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded">
                    <p className="text-sm text-blue-900 leading-relaxed">{aiMessage}</p>
                    <button onClick={() => navigator.clipboard?.writeText(aiMessage)} className="mt-2 text-xs text-blue-600 hover:underline">Copy to clipboard</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
