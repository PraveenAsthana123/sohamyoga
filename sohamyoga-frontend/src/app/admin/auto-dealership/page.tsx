'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard', 'inventory', 'customers', 'deals', 'service', 'fi', 'ai'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = {
  dashboard: 'Dashboard', inventory: 'Inventory', customers: 'Customers',
  deals: 'Deals (Desk)', service: 'Service', fi: 'F&I Performance', ai: 'AI Tools',
};

const CONDITIONS = ['new', 'used', 'certified_pre_owned', 'demo'];
const FUEL_TYPES = ['gasoline', 'diesel', 'hybrid', 'electric', 'phev'];
const DRIVETRAINS = ['fwd', 'rwd', 'awd', '4wd'];
const CREDIT_TIERS = ['A', 'B', 'C', 'D'];
const SOURCES = ['walk_in', 'internet', 'referral', 'repeat', 'phone'];
const DEAL_TYPES = ['retail', 'lease', 'wholesale', 'fleet'];
const DEAL_STATUSES = ['pending', 'approved', 'funded', 'delivered', 'unwound'];
const SERVICE_TYPES = ['oil_change', 'tire_rotation', 'brake_inspection', 'recall', 'warranty', 'collision', 'pdi', 'detail', 'general_repair'];
const LENDERS = ['TD Auto Finance', 'Scotia Dealer Advantage', 'BMO', 'RBC', 'CIBC', 'Desjardins', 'Pave Fin'];

interface VehicleInventory {
  id: number; stock_number: string; condition: string; year: number; make: string; model: string;
  trim: string; body_style: string; color_exterior: string; mileage_km: number; fuel_type: string;
  msrp: number; asking_price: number; cost: number; status: string; days_in_inventory: number;
  date_added: string; features: string[]; engine: string; transmission: string; drivetrain: string;
}
interface Customer {
  id: number; name: string; email: string; phone: string; city: string; credit_tier: string;
  employment_type: string; annual_income: number; source: string; status: string; deal_count: number;
}
interface Deal {
  id: number; customer_id: number; vehicle_id: number; customer_name: string; deal_type: string;
  sale_price: number; total_financed: number; interest_rate: number; term_months: number;
  monthly_payment: number; lender: string; salesperson: string; status: string;
  front_gross: number; back_gross: number; total_gross: number; extended_warranty: boolean;
  gap_insurance: boolean; paint_protection: boolean; year: number; make: string; model: string;
  stock_number: string; created_at: string;
}
interface ServiceAppt {
  id: number; customer_name: string; customer_vehicle: string; service_type: string;
  description: string; advisor: string; appointment_time: string; status: string;
  labour_hours: number; total_invoice: number;
}
interface Dashboard {
  inventory_by_condition: Array<{ condition: string; cnt: number; total_value: number }>;
  deals: { deals_this_month: number; gross_this_month: number; front_this_month: number; back_this_month: number };
  service: { today_service: number; service_revenue_today: number };
  aging: { over_60: number; over_90: number; over_120: number };
}

function fmtCad(n: number) { return `$${Number(n ?? 0).toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`; }
function fmtKm(n: number) { return `${Number(n ?? 0).toLocaleString('en-CA')} km`; }
function condLabel(c: string) { return { new: 'New', used: 'Used', certified_pre_owned: 'CPO', demo: 'Demo' }[c] ?? c; }

function Badge({ label, color = 'gray' }: { label: string; color?: string }) {
  const map: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-700', green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700',
    purple: 'bg-purple-100 text-purple-700', gray: 'bg-gray-100 text-gray-700',
    teal: 'bg-teal-100 text-teal-700', orange: 'bg-orange-100 text-orange-700',
  };
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${map[color] ?? map.gray}`}>{label}</span>;
}

function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const borders: Record<string, string> = {
    blue: 'border-l-4 border-blue-500 bg-blue-50', green: 'border-l-4 border-green-500 bg-green-50',
    amber: 'border-l-4 border-amber-500 bg-amber-50', red: 'border-l-4 border-red-500 bg-red-50',
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

function daysColor(d: number) { return d > 90 ? 'red' : d > 60 ? 'amber' : d > 30 ? 'blue' : 'green'; }
function dealStatusColor(s: string) {
  return { pending: 'amber', approved: 'blue', funded: 'green', delivered: 'teal', unwound: 'red' }[s] ?? 'gray';
}
function serviceStatusColor(s: string) {
  return { scheduled: 'gray', arrived: 'blue', in_service: 'amber', completed: 'green', no_show: 'red' }[s] ?? 'gray';
}

// ─── Add Vehicle Modal ──────────────────────────────────────────────────────
function AddVehicleModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    stock_number: '', condition: 'used', year: new Date().getFullYear().toString(), make: '', model: '',
    trim: '', body_style: 'SUV', vin: '', color_exterior: '', color_interior: '', mileage_km: '0',
    engine: '', transmission: 'automatic', drivetrain: 'fwd', fuel_type: 'gasoline', doors: '4',
    msrp: '', asking_price: '', cost: '', location: 'Calgary', lot_position: '', status: 'available', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.stock_number || !form.make || !form.model) return;
    setSaving(true);
    try {
      await fetch('/api/admin/auto-dealership/inventory', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, year: parseInt(form.year), mileage_km: parseInt(form.mileage_km), doors: parseInt(form.doors), msrp: form.msrp ? parseFloat(form.msrp) : null, asking_price: form.asking_price ? parseFloat(form.asking_price) : null, cost: form.cost ? parseFloat(form.cost) : null }),
      });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-4 text-slate-800">Add Vehicle to Inventory</h2>
        <div className="grid grid-cols-3 gap-3">
          <div><label className="text-xs text-gray-500">Stock # *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.stock_number} onChange={e => f('stock_number', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Condition</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.condition} onChange={e => f('condition', e.target.value)}>{CONDITIONS.map(c => <option key={c} value={c}>{condLabel(c)}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Status</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.status} onChange={e => f('status', e.target.value)}>{['available','on_hold','sold','wholesale'].map(s => <option key={s}>{s}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Year *</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.year} onChange={e => f('year', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Make *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.make} onChange={e => f('make', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Model *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.model} onChange={e => f('model', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Trim</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.trim} onChange={e => f('trim', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Body Style</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.body_style} onChange={e => f('body_style', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">VIN</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5 font-mono text-xs" value={form.vin} onChange={e => f('vin', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Ext. Color</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.color_exterior} onChange={e => f('color_exterior', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Int. Color</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.color_interior} onChange={e => f('color_interior', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Mileage (km)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.mileage_km} onChange={e => f('mileage_km', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Engine</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.engine} onChange={e => f('engine', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Transmission</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.transmission} onChange={e => f('transmission', e.target.value)}><option value="automatic">Automatic</option><option value="manual">Manual</option><option value="cvt">CVT</option></select></div>
          <div><label className="text-xs text-gray-500">Drivetrain</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.drivetrain} onChange={e => f('drivetrain', e.target.value)}>{DRIVETRAINS.map(d => <option key={d} value={d}>{d.toUpperCase()}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Fuel Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.fuel_type} onChange={e => f('fuel_type', e.target.value)}>{FUEL_TYPES.map(f2 => <option key={f2}>{f2}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">MSRP (CAD)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.msrp} onChange={e => f('msrp', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Asking Price (CAD)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.asking_price} onChange={e => f('asking_price', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Cost (CAD)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.cost} onChange={e => f('cost', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Lot Position</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.lot_position} onChange={e => f('lot_position', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.notes} onChange={e => f('notes', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-1.5 rounded border text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving || !form.stock_number || !form.make} className="px-4 py-1.5 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Add Vehicle'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Customer Modal ─────────────────────────────────────────────────────
function AddCustomerModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', city: 'Calgary', province: 'AB', credit_tier: 'A', employment_type: 'employed', annual_income: '', source: 'walk_in', notes: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.name) return;
    setSaving(true);
    try {
      await fetch('/api/admin/auto-dealership/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, annual_income: form.annual_income ? parseFloat(form.annual_income) : null }) });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-4 text-slate-800">New Customer</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs text-gray-500">Full Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.name} onChange={e => f('name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Email</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.email} onChange={e => f('email', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Phone</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.phone} onChange={e => f('phone', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">City</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.city} onChange={e => f('city', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Province</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.province} onChange={e => f('province', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Credit Tier</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.credit_tier} onChange={e => f('credit_tier', e.target.value)}>{CREDIT_TIERS.map(t => <option key={t}>{t}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Employment</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.employment_type} onChange={e => f('employment_type', e.target.value)}>{['employed','self_employed','retired','student','other'].map(t => <option key={t}>{t}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Annual Income (CAD)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.annual_income} onChange={e => f('annual_income', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Source</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.source} onChange={e => f('source', e.target.value)}>{SOURCES.map(s => <option key={s}>{s}</option>)}</select></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.notes} onChange={e => f('notes', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-1.5 rounded border text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving || !form.name} className="px-4 py-1.5 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Add Customer'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── New Deal Modal ─────────────────────────────────────────────────────────
function NewDealModal({ customers, inventory, onClose, onSaved }: { customers: Customer[]; inventory: VehicleInventory[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    customer_id: '', vehicle_id: '', deal_type: 'retail', salesperson: '', finance_manager: '',
    sale_price: '', trade_in_value: '0', trade_in_vehicle: '', down_payment: '0', rebates: '0',
    lender: LENDERS[0], interest_rate: '6.99', term_months: '60', monthly_payment: '',
    extended_warranty: false, extended_warranty_cost: '', gap_insurance: false, gap_cost: '',
    paint_protection: false, protection_cost: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.customer_id || !form.sale_price) return;
    setSaving(true);
    try {
      await fetch('/api/admin/auto-dealership/deals', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          customer_id: parseInt(form.customer_id), vehicle_id: form.vehicle_id ? parseInt(form.vehicle_id) : null,
          sale_price: parseFloat(form.sale_price), trade_in_value: parseFloat(form.trade_in_value),
          down_payment: parseFloat(form.down_payment), rebates: parseFloat(form.rebates),
          interest_rate: parseFloat(form.interest_rate), term_months: parseInt(form.term_months),
          monthly_payment: form.monthly_payment ? parseFloat(form.monthly_payment) : null,
          extended_warranty_cost: form.extended_warranty_cost ? parseFloat(form.extended_warranty_cost) : null,
          gap_cost: form.gap_cost ? parseFloat(form.gap_cost) : null,
          protection_cost: form.protection_cost ? parseFloat(form.protection_cost) : null,
        }),
      });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-4 text-slate-800">New Deal</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500">Customer *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.customer_id} onChange={e => f('customer_id', e.target.value)}><option value="">Select customer</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Vehicle</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.vehicle_id} onChange={e => f('vehicle_id', e.target.value)}><option value="">No vehicle</option>{inventory.filter(v => v.status === 'available').map(v => <option key={v.id} value={v.id}>{v.year} {v.make} {v.model} — {v.stock_number}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Deal Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.deal_type} onChange={e => f('deal_type', e.target.value)}>{DEAL_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Salesperson</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.salesperson} onChange={e => f('salesperson', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Finance Manager</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.finance_manager} onChange={e => f('finance_manager', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Sale Price *</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.sale_price} onChange={e => f('sale_price', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Trade-In Value</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.trade_in_value} onChange={e => f('trade_in_value', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Trade-In Vehicle</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.trade_in_vehicle} onChange={e => f('trade_in_vehicle', e.target.value)} placeholder="e.g. 2018 Honda Civic" /></div>
          <div><label className="text-xs text-gray-500">Down Payment</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.down_payment} onChange={e => f('down_payment', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Rebates</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.rebates} onChange={e => f('rebates', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Lender</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.lender} onChange={e => f('lender', e.target.value)}>{LENDERS.map(l => <option key={l}>{l}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Rate (%)</label><input type="number" step="0.01" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.interest_rate} onChange={e => f('interest_rate', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Term (months)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.term_months} onChange={e => f('term_months', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Monthly Payment</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.monthly_payment} onChange={e => f('monthly_payment', e.target.value)} /></div>
          <div className="col-span-2 border-t pt-3 mt-1">
            <p className="text-xs font-medium text-gray-600 mb-2">F&I Products (Back-End)</p>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={form.extended_warranty} onChange={e => f('extended_warranty', e.target.checked)} /> Ext. Warranty</label><input type="number" placeholder="Cost" className="w-full border rounded px-2 py-1 text-sm mt-1" value={form.extended_warranty_cost} onChange={e => f('extended_warranty_cost', e.target.value)} disabled={!form.extended_warranty} /></div>
              <div><label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={form.gap_insurance} onChange={e => f('gap_insurance', e.target.checked)} /> GAP Insurance</label><input type="number" placeholder="Cost" className="w-full border rounded px-2 py-1 text-sm mt-1" value={form.gap_cost} onChange={e => f('gap_cost', e.target.value)} disabled={!form.gap_insurance} /></div>
              <div><label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={form.paint_protection} onChange={e => f('paint_protection', e.target.checked)} /> Paint Protection</label><input type="number" placeholder="Cost" className="w-full border rounded px-2 py-1 text-sm mt-1" value={form.protection_cost} onChange={e => f('protection_cost', e.target.value)} disabled={!form.paint_protection} /></div>
            </div>
          </div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.notes} onChange={e => f('notes', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-1.5 rounded border text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving || !form.customer_id || !form.sale_price} className="px-4 py-1.5 rounded bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50">{saving ? 'Saving…' : 'Create Deal'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── New Service Appointment Modal ─────────────────────────────────────────
function NewServiceModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ customer_vehicle: '', service_type: 'oil_change', description: '', advisor: '', appointment_date: new Date().toISOString().split('T')[0], appointment_time: '09:00', labour_rate: '145', loaner_vehicle: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.customer_vehicle || !form.appointment_date) return;
    setSaving(true);
    try {
      await fetch('/api/admin/auto-dealership/service', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, labour_rate: parseFloat(form.labour_rate) }) });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-4 text-slate-800">New Service Appointment</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs text-gray-500">Customer Vehicle *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.customer_vehicle} onChange={e => f('customer_vehicle', e.target.value)} placeholder="e.g. 2020 Toyota Camry" /></div>
          <div><label className="text-xs text-gray-500">Service Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.service_type} onChange={e => f('service_type', e.target.value)}>{SERVICE_TYPES.map(t => <option key={t}>{t.replace(/_/g, ' ')}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Advisor</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.advisor} onChange={e => f('advisor', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Date *</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.appointment_date} onChange={e => f('appointment_date', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Time</label><input type="time" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.appointment_time} onChange={e => f('appointment_time', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Labour Rate ($/hr)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.labour_rate} onChange={e => f('labour_rate', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Loaner Vehicle</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.loaner_vehicle} onChange={e => f('loaner_vehicle', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Description</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.description} onChange={e => f('description', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.notes} onChange={e => f('notes', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-1.5 rounded border text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving || !form.customer_vehicle} className="px-4 py-1.5 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Book Appointment'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Complete Service Modal ─────────────────────────────────────────────────
function CompleteServiceModal({ appt, onClose, onSaved }: { appt: ServiceAppt; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ labour_hours: '', labour_rate: '145', parts_cost: '0', shop_supplies: '0', notes: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  const total = (parseFloat(form.labour_hours || '0') * parseFloat(form.labour_rate)) + parseFloat(form.parts_cost || '0') + parseFloat(form.shop_supplies || '0');
  async function submit() {
    setSaving(true);
    try {
      await fetch(`/api/admin/auto-dealership/service/${appt.id}/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ labour_hours: parseFloat(form.labour_hours), labour_rate: parseFloat(form.labour_rate), parts_cost: parseFloat(form.parts_cost), shop_supplies: parseFloat(form.shop_supplies), notes: form.notes }) });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold mb-1 text-slate-800">Complete Service</h2>
        <p className="text-sm text-gray-500 mb-4">{appt.customer_vehicle} — {appt.service_type}</p>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500">Labour Hours</label><input type="number" step="0.25" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.labour_hours} onChange={e => f('labour_hours', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Labour Rate ($/hr)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.labour_rate} onChange={e => f('labour_rate', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Parts Cost</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.parts_cost} onChange={e => f('parts_cost', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Shop Supplies</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.shop_supplies} onChange={e => f('shop_supplies', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.notes} onChange={e => f('notes', e.target.value)} /></div>
        </div>
        <div className="mt-3 p-3 bg-green-50 rounded-lg text-center">
          <p className="text-sm text-gray-500">Total Invoice</p>
          <p className="text-xl font-bold text-green-700">{fmtCad(total)}</p>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-1.5 rounded border text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-1.5 rounded bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50">{saving ? 'Completing…' : 'Complete & Invoice'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function AutoDealershipPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [inventory, setInventory] = useState<VehicleInventory[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [service, setService] = useState<ServiceAppt[]>([]);
  const [agingReport, setAgingReport] = useState<(VehicleInventory & { days_in_inventory: number; suggested_price: number; recommendation: string })[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showNewDeal, setShowNewDeal] = useState(false);
  const [showNewService, setShowNewService] = useState(false);
  const [completeAppt, setCompleteAppt] = useState<ServiceAppt | null>(null);
  const [invFilter, setInvFilter] = useState({ condition: '', fuel_type: '', status: 'available', search: '' });
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dealFilter, setDealFilter] = useState({ status: '', deal_type: '' });
  const [aiForm, setAiForm] = useState({ year: '', make: '', model: '', trim: '', km: '', condition: 'Good' });
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const loadDashboard = useCallback(async () => {
    const r = await fetch('/api/admin/auto-dealership');
    if (r.ok) setDashboard(await r.json());
  }, []);

  const loadInventory = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (invFilter.condition) params.set('condition', invFilter.condition);
    if (invFilter.fuel_type) params.set('fuel_type', invFilter.fuel_type);
    if (invFilter.status) params.set('status', invFilter.status);
    const r = await fetch(`/api/admin/auto-dealership/inventory?${params}`);
    if (r.ok) setInventory(await r.json());
    setLoading(false);
  }, [invFilter]);

  const loadCustomers = useCallback(async () => {
    const r = await fetch('/api/admin/auto-dealership/customers');
    if (r.ok) setCustomers(await r.json());
  }, []);

  const loadDeals = useCallback(async () => {
    const params = new URLSearchParams();
    if (dealFilter.status) params.set('status', dealFilter.status);
    if (dealFilter.deal_type) params.set('deal_type', dealFilter.deal_type);
    const r = await fetch(`/api/admin/auto-dealership/deals?${params}`);
    if (r.ok) setDeals(await r.json());
  }, [dealFilter]);

  const loadService = useCallback(async () => {
    const r = await fetch(`/api/admin/auto-dealership/service?date=${serviceDate}`);
    if (r.ok) setService(await r.json());
  }, [serviceDate]);

  const loadAging = useCallback(async () => {
    const r = await fetch('/api/admin/auto-dealership/aging-report');
    if (r.ok) setAgingReport(await r.json());
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);
  useEffect(() => { if (tab === 'inventory') loadInventory(); }, [tab, loadInventory]);
  useEffect(() => { if (tab === 'customers') loadCustomers(); }, [tab, loadCustomers]);
  useEffect(() => { if (tab === 'deals') { loadDeals(); loadInventory(); loadCustomers(); } }, [tab, loadDeals, loadInventory, loadCustomers]);
  useEffect(() => { if (tab === 'service') loadService(); }, [tab, serviceDate, loadService]);
  useEffect(() => { if (tab === 'ai') loadAging(); }, [tab, loadAging]);

  async function fundDeal(id: number) {
    await fetch(`/api/admin/auto-dealership/deals/${id}/fund`, { method: 'POST' });
    loadDeals(); loadDashboard();
  }

  async function updateServiceStatus(id: number, status: string) {
    await fetch(`/api/admin/auto-dealership/service/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    loadService();
  }

  async function runAppraisal() {
    if (!aiForm.year || !aiForm.make || !aiForm.model) return;
    setAiLoading(true);
    setAiResult('');
    try {
      const r = await fetch('/api/admin/auto-dealership/ai-appraisal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(aiForm) });
      const data = await r.json();
      setAiResult(data.appraisal ?? data.error ?? 'No response');
    } finally { setAiLoading(false); }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-slate-800 text-white px-6 py-4">
        <h1 className="text-xl font-bold">Auto Dealership CRM</h1>
        <p className="text-slate-400 text-sm">Calgary, AB — Inventory · Sales · F&I · Service</p>
      </div>
      <div className="border-b bg-white px-6 flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="p-6">
        {/* DASHBOARD */}
        {tab === 'dashboard' && dashboard && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard label="Deals This Month" value={dashboard.deals.deals_this_month ?? 0} color="blue" />
              <KpiCard label="Total Gross MTD" value={fmtCad(dashboard.deals.gross_this_month)} sub={`Front: ${fmtCad(dashboard.deals.front_this_month)} | Back: ${fmtCad(dashboard.deals.back_this_month)}`} color="green" />
              <KpiCard label="Service Today" value={`${dashboard.service.today_service} ROs`} sub={`Revenue: ${fmtCad(dashboard.service.service_revenue_today)}`} color="amber" />
              <KpiCard label="Aging Inventory (>60d)" value={dashboard.aging.over_60 ?? 0} sub={`>90d: ${dashboard.aging.over_90} | >120d: ${dashboard.aging.over_120}`} color={parseInt(String(dashboard.aging.over_60)) > 3 ? 'red' : 'amber'} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-700 mb-3">Inventory by Condition</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {dashboard.inventory_by_condition.map(row => (
                  <div key={row.condition} className="bg-white rounded-lg p-4 border">
                    <p className="text-xs text-gray-500">{condLabel(row.condition)}</p>
                    <p className="text-2xl font-bold">{row.cnt}</p>
                    <p className="text-xs text-gray-400 mt-1">Total: {fmtCad(row.total_value)}</p>
                  </div>
                ))}
              </div>
            </div>
            {parseInt(String(dashboard.aging.over_60)) > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="font-medium text-amber-800">Aging Inventory Alert</p>
                <p className="text-sm text-amber-700 mt-1">{dashboard.aging.over_60} vehicles over 60 days. Check the AI Tools tab for price reduction recommendations.</p>
              </div>
            )}
          </div>
        )}

        {/* INVENTORY */}
        {tab === 'inventory' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 items-center">
              <select className="border rounded px-3 py-2 text-sm" value={invFilter.condition} onChange={e => setInvFilter(p => ({ ...p, condition: e.target.value }))}>
                <option value="">All Conditions</option>
                {CONDITIONS.map(c => <option key={c} value={c}>{condLabel(c)}</option>)}
              </select>
              <select className="border rounded px-3 py-2 text-sm" value={invFilter.fuel_type} onChange={e => setInvFilter(p => ({ ...p, fuel_type: e.target.value }))}>
                <option value="">All Fuel Types</option>
                {FUEL_TYPES.map(f2 => <option key={f2} value={f2}>{f2}</option>)}
              </select>
              <select className="border rounded px-3 py-2 text-sm" value={invFilter.status} onChange={e => setInvFilter(p => ({ ...p, status: e.target.value }))}>
                {['available', 'on_hold', 'sold', 'wholesale', ''].map(s => <option key={s} value={s}>{s || 'All Status'}</option>)}
              </select>
              <button onClick={loadInventory} className="px-3 py-2 bg-gray-700 text-white rounded text-sm">Filter</button>
              <button onClick={() => setShowAddVehicle(true)} className="ml-auto px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium">+ Add Vehicle</button>
            </div>
            {loading ? <p className="text-gray-500 text-sm">Loading…</p> : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {inventory.map(v => (
                  <div key={v.id} className="bg-white rounded-lg border p-4 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-slate-800">{v.year} {v.make} {v.model}</p>
                        <p className="text-sm text-gray-500">{v.trim} — Stock #{v.stock_number}</p>
                      </div>
                      <Badge label={String(v.days_in_inventory) + 'd'} color={daysColor(v.days_in_inventory)} />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Badge label={condLabel(v.condition)} color="blue" />
                      <Badge label={v.fuel_type} color="gray" />
                      <Badge label={v.status} color={v.status === 'available' ? 'green' : v.status === 'sold' ? 'red' : 'amber'} />
                    </div>
                    <div className="text-xs text-gray-500 space-y-0.5">
                      <p>Color: {v.color_exterior}</p>
                      <p>Mileage: {fmtKm(v.mileage_km)} | Engine: {v.engine || '—'}</p>
                      <p>Drive: {v.drivetrain?.toUpperCase()} | Trans: {v.transmission}</p>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t">
                      <div>
                        <p className="text-lg font-bold text-slate-800">{fmtCad(v.asking_price)}</p>
                        <p className="text-xs text-gray-400">Cost: {fmtCad(v.cost)} | MSRP: {v.msrp ? fmtCad(v.msrp) : '—'}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {inventory.length === 0 && <p className="text-gray-400 col-span-3 text-center py-12">No vehicles match the filters.</p>}
              </div>
            )}
            {showAddVehicle && <AddVehicleModal onClose={() => setShowAddVehicle(false)} onSaved={() => { setShowAddVehicle(false); loadInventory(); loadDashboard(); }} />}
          </div>
        )}

        {/* CUSTOMERS */}
        {tab === 'customers' && (
          <div className="space-y-4">
            <div className="flex gap-3 items-center">
              <select className="border rounded px-3 py-2 text-sm" onChange={e => setCustomers([])} defaultValue="">
                <option value="">All Credit Tiers</option>
                {CREDIT_TIERS.map(t => <option key={t} value={t}>Tier {t}</option>)}
              </select>
              <button onClick={() => setShowAddCustomer(true)} className="ml-auto px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium">+ Add Customer</button>
            </div>
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>{['Name','Phone','Email','Credit Tier','Income','Source','Deals','Status'].map(h => <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-gray-500">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y">
                  {customers.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium">{c.name}</td>
                      <td className="px-4 py-2 text-gray-500">{c.phone || '—'}</td>
                      <td className="px-4 py-2 text-gray-500">{c.email || '—'}</td>
                      <td className="px-4 py-2"><Badge label={`Tier ${c.credit_tier || '?'}`} color={c.credit_tier === 'A' ? 'green' : c.credit_tier === 'B' ? 'blue' : c.credit_tier === 'C' ? 'amber' : 'red'} /></td>
                      <td className="px-4 py-2 text-gray-500">{c.annual_income ? fmtCad(c.annual_income) : '—'}</td>
                      <td className="px-4 py-2 text-gray-500">{c.source?.replace(/_/g, ' ') || '—'}</td>
                      <td className="px-4 py-2"><Badge label={String(c.deal_count)} color="purple" /></td>
                      <td className="px-4 py-2"><Badge label={c.status} color={c.status === 'active' ? 'green' : 'gray'} /></td>
                    </tr>
                  ))}
                  {customers.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No customers found.</td></tr>}
                </tbody>
              </table>
            </div>
            {showAddCustomer && <AddCustomerModal onClose={() => setShowAddCustomer(false)} onSaved={() => { setShowAddCustomer(false); loadCustomers(); }} />}
          </div>
        )}

        {/* DEALS */}
        {tab === 'deals' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 items-center">
              <select className="border rounded px-3 py-2 text-sm" value={dealFilter.status} onChange={e => setDealFilter(p => ({ ...p, status: e.target.value }))}>
                <option value="">All Status</option>
                {DEAL_STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
              <select className="border rounded px-3 py-2 text-sm" value={dealFilter.deal_type} onChange={e => setDealFilter(p => ({ ...p, deal_type: e.target.value }))}>
                <option value="">All Types</option>
                {DEAL_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
              <button onClick={loadDeals} className="px-3 py-2 bg-gray-700 text-white rounded text-sm">Filter</button>
              <button onClick={() => setShowNewDeal(true)} className="ml-auto px-4 py-2 bg-green-600 text-white rounded text-sm font-medium">+ New Deal</button>
            </div>
            <div className="space-y-3">
              {deals.map(d => (
                <div key={d.id} className="bg-white rounded-lg border p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-semibold text-slate-800">{d.customer_name}</p>
                      <p className="text-sm text-gray-500">{d.year} {d.make} {d.model} — Stock #{d.stock_number}</p>
                      <p className="text-xs text-gray-400">{d.salesperson} | {d.lender}</p>
                    </div>
                    <div className="text-right">
                      <Badge label={d.status} color={dealStatusColor(d.status)} />
                      <p className="text-xs text-gray-400 mt-1">{new Date(d.created_at).toLocaleDateString('en-CA')}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm border-t pt-3">
                    <div><p className="text-xs text-gray-400">Sale Price</p><p className="font-medium">{fmtCad(d.sale_price)}</p></div>
                    <div><p className="text-xs text-gray-400">Financing</p><p className="font-medium">{d.term_months}mo @ {d.interest_rate}%</p><p className="text-xs text-gray-400">{fmtCad(d.monthly_payment)}/mo</p></div>
                    <div><p className="text-xs text-gray-400">Front Gross</p><p className="font-medium text-green-700">{fmtCad(d.front_gross)}</p></div>
                    <div><p className="text-xs text-gray-400">Back Gross</p><p className="font-medium text-purple-700">{fmtCad(d.back_gross)}</p></div>
                  </div>
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {d.extended_warranty && <Badge label="Ext. Warranty" color="teal" />}
                    {d.gap_insurance && <Badge label="GAP" color="blue" />}
                    {d.paint_protection && <Badge label="Paint Protection" color="purple" />}
                    {d.status === 'approved' && (
                      <button onClick={() => fundDeal(d.id)} className="ml-auto px-3 py-1 bg-green-600 text-white rounded text-xs font-medium">Fund Deal</button>
                    )}
                  </div>
                </div>
              ))}
              {deals.length === 0 && <p className="text-center text-gray-400 py-12">No deals found.</p>}
            </div>
            {showNewDeal && <NewDealModal customers={customers} inventory={inventory} onClose={() => setShowNewDeal(false)} onSaved={() => { setShowNewDeal(false); loadDeals(); loadDashboard(); }} />}
          </div>
        )}

        {/* SERVICE */}
        {tab === 'service' && (
          <div className="space-y-4">
            <div className="flex gap-3 items-center">
              <input type="date" className="border rounded px-3 py-2 text-sm" value={serviceDate} onChange={e => setServiceDate(e.target.value)} />
              <button onClick={loadService} className="px-3 py-2 bg-gray-700 text-white rounded text-sm">Load</button>
              <button onClick={() => setShowNewService(true)} className="ml-auto px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium">+ New Appointment</button>
            </div>
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>{['Time','Vehicle','Service Type','Advisor','Status','Invoice','Actions'].map(h => <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-gray-500">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y">
                  {service.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-mono text-sm">{s.appointment_time || '—'}</td>
                      <td className="px-4 py-2">
                        <p className="font-medium">{s.customer_vehicle || `Stock #${s.id}`}</p>
                        {s.customer_name && <p className="text-xs text-gray-400">{s.customer_name}</p>}
                      </td>
                      <td className="px-4 py-2">{s.service_type?.replace(/_/g, ' ') || '—'}</td>
                      <td className="px-4 py-2 text-gray-500">{s.advisor || '—'}</td>
                      <td className="px-4 py-2"><Badge label={s.status} color={serviceStatusColor(s.status)} /></td>
                      <td className="px-4 py-2">{s.total_invoice ? fmtCad(s.total_invoice) : '—'}</td>
                      <td className="px-4 py-2">
                        <div className="flex gap-1 flex-wrap">
                          {s.status === 'scheduled' && <button onClick={() => updateServiceStatus(s.id, 'arrived')} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">Arrived</button>}
                          {s.status === 'arrived' && <button onClick={() => updateServiceStatus(s.id, 'in_service')} className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">In Service</button>}
                          {s.status === 'in_service' && <button onClick={() => setCompleteAppt(s)} className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">Complete</button>}
                          {s.status === 'scheduled' && <button onClick={() => updateServiceStatus(s.id, 'no_show')} className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">No-Show</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {service.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No appointments for this date.</td></tr>}
                </tbody>
              </table>
            </div>
            {showNewService && <NewServiceModal onClose={() => setShowNewService(false)} onSaved={() => { setShowNewService(false); loadService(); }} />}
            {completeAppt && <CompleteServiceModal appt={completeAppt} onClose={() => setCompleteAppt(null)} onSaved={() => { setCompleteAppt(null); loadService(); loadDashboard(); }} />}
          </div>
        )}

        {/* F&I PERFORMANCE */}
        {tab === 'fi' && (
          <div className="space-y-6">
            <h2 className="font-semibold text-slate-800">F&I Performance — All Funded/Delivered Deals</h2>
            {deals.length === 0 && <button onClick={loadDeals} className="px-4 py-2 bg-blue-600 text-white rounded text-sm">Load Deals</button>}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Ext. Warranty Penetration', count: deals.filter(d => d.extended_warranty).length, total: deals.length },
                { label: 'GAP Penetration', count: deals.filter(d => d.gap_insurance).length, total: deals.length },
                { label: 'Paint Protection', count: deals.filter(d => d.paint_protection).length, total: deals.length },
              ].map(({ label, count, total }) => (
                <div key={label} className="bg-white rounded-lg border p-4">
                  <p className="text-sm text-gray-500">{label}</p>
                  <p className="text-2xl font-bold mt-1">{total > 0 ? Math.round((count / total) * 100) : 0}%</p>
                  <p className="text-xs text-gray-400 mt-1">{count} of {total} deals</p>
                  <div className="mt-2 h-2 bg-gray-100 rounded-full"><div className="h-2 bg-purple-500 rounded-full" style={{ width: total > 0 ? `${(count / total) * 100}%` : '0%' }} /></div>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-lg border p-4">
              <p className="text-sm font-medium text-gray-600 mb-3">Back-End Gross by Lender</p>
              {LENDERS.map(lender => {
                const lenderDeals = deals.filter(d => d.lender === lender);
                const avgBack = lenderDeals.length ? lenderDeals.reduce((s, d) => s + (d.back_gross ?? 0), 0) / lenderDeals.length : 0;
                if (!lenderDeals.length) return null;
                return (
                  <div key={lender} className="flex items-center gap-3 mb-2">
                    <span className="text-xs text-gray-600 w-44 shrink-0">{lender}</span>
                    <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-4 bg-purple-400 rounded-full" style={{ width: `${Math.min((avgBack / 2000) * 100, 100)}%` }} />
                    </div>
                    <span className="text-xs font-medium w-20 text-right">{fmtCad(avgBack)} avg</span>
                    <span className="text-xs text-gray-400 w-16 text-right">{lenderDeals.length} deals</span>
                  </div>
                );
              })}
              {deals.length === 0 && <p className="text-gray-400 text-sm">No deals loaded. Switch to Deals tab first or click Load Deals above.</p>}
            </div>
          </div>
        )}

        {/* AI TOOLS */}
        {tab === 'ai' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border p-6">
              <h3 className="font-semibold text-slate-800 mb-4">Trade-In Appraiser (Alberta Market)</h3>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div><label className="text-xs text-gray-500">Year</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiForm.year} onChange={e => setAiForm(p => ({ ...p, year: e.target.value }))} placeholder="2021" /></div>
                <div><label className="text-xs text-gray-500">Make</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiForm.make} onChange={e => setAiForm(p => ({ ...p, make: e.target.value }))} placeholder="Toyota" /></div>
                <div><label className="text-xs text-gray-500">Model</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiForm.model} onChange={e => setAiForm(p => ({ ...p, model: e.target.value }))} placeholder="RAV4" /></div>
                <div><label className="text-xs text-gray-500">Trim</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiForm.trim} onChange={e => setAiForm(p => ({ ...p, trim: e.target.value }))} placeholder="XLE" /></div>
                <div><label className="text-xs text-gray-500">Mileage (km)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiForm.km} onChange={e => setAiForm(p => ({ ...p, km: e.target.value }))} placeholder="45000" /></div>
                <div><label className="text-xs text-gray-500">Condition</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiForm.condition} onChange={e => setAiForm(p => ({ ...p, condition: e.target.value }))}>{['Excellent','Good','Fair','Poor'].map(c => <option key={c}>{c}</option>)}</select></div>
              </div>
              <button onClick={runAppraisal} disabled={aiLoading || !aiForm.year || !aiForm.make || !aiForm.model} className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium disabled:opacity-50">{aiLoading ? 'Appraising…' : 'Get Trade-In Value'}</button>
              {aiResult && <pre className="mt-4 p-4 bg-blue-50 rounded-lg text-sm text-gray-700 whitespace-pre-wrap font-sans">{aiResult}</pre>}
            </div>

            <div className="bg-white rounded-lg border p-6">
              <h3 className="font-semibold text-slate-800 mb-4">Aging Inventory Report (Over 60 Days)</h3>
              {agingReport.length === 0 ? <p className="text-gray-400 text-sm">No vehicles over 60 days in inventory.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>{['Stock #','Vehicle','Days','Asking Price','Suggested Price','Action'].map(h => <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-500">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y">
                      {agingReport.map(v => (
                        <tr key={v.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-mono text-xs">{v.stock_number}</td>
                          <td className="px-3 py-2 font-medium">{v.year} {v.make} {v.model} {v.trim}</td>
                          <td className="px-3 py-2"><Badge label={`${v.days_in_inventory}d`} color={daysColor(v.days_in_inventory)} /></td>
                          <td className="px-3 py-2">{fmtCad(v.asking_price)}</td>
                          <td className="px-3 py-2 font-medium text-amber-700">{fmtCad(v.suggested_price)}</td>
                          <td className="px-3 py-2 text-xs text-gray-600">{v.recommendation}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
