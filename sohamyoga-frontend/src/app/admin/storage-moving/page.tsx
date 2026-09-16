'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard','moves','storage-units','rentals','customers','ai-quote'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = { dashboard: 'Dashboard', moves: 'Moves', 'storage-units': 'Storage Units', rentals: 'Storage Rentals', customers: 'Customers', 'ai-quote': 'AI Quote' };

const MOVE_TYPES = ['local','long_distance','cross_province','international','office_move','student_move','senior_move','piano_move','specialty'];
const MOVE_STATUSES = ['quoted','booked','confirmed','in_progress','completed','cancelled'];
const TRUCK_SIZES = ['16ft','20ft','26ft','tractor_trailer','cargo_van'];
const UNIT_SIZES = ['5x5','5x10','10x10','10x15','10x20','10x25','10x30'];
const UNIT_TYPES = ['standard','climate_controlled','drive_up','indoor'];
const CUSTOMER_TYPES = ['residential','commercial','senior','student','military'];

interface Customer { id: number; first_name: string; last_name: string; email: string; phone: string; customer_type: string; city: string; total_jobs: number; total_spent: number; notes: string; }
interface Move { id: number; customer_id: number; first_name: string; last_name: string; phone: string; customer_type: string; move_type: string; move_date: string; move_time: string; origin_address: string; origin_city: string; destination_address: string; destination_city: string; estimated_hours: number; actual_hours: number; crew_size: number; truck_size: string; status: string; quote_amount: number; final_amount: number; deposit_paid: number; packing_service: boolean; special_items: string[]; customer_rating: number; }
interface StorageUnit { id: number; unit_number: string; unit_size: string; unit_type: string; monthly_rate: number; floor: string; building: string; is_occupied: boolean; }
interface Rental { id: number; unit_id: number; customer_id: number; first_name: string; last_name: string; phone: string; email: string; unit_number: string; unit_size: string; unit_type: string; unit_rate: number; monthly_rate: number; start_date: string; end_date: string; status: string; last_payment_date: string; access_code: string; is_overdue: boolean; }
interface Dashboard { moves_this_month: number; moves_this_week: number; storage_units_occupied: number; storage_occupancy_pct: number; revenue_mtd: number; outstanding_balance: number; }
interface AvailRow { unit_size: string; available: string; total: string; }

function fmtCad(n: number) { return `$${Number(n ?? 0).toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`; }
function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString('en-CA') : '—'; }

function Badge({ label, color = 'gray' }: { label: string; color?: string }) {
  const m: Record<string, string> = { blue: 'bg-blue-100 text-blue-700', green: 'bg-green-100 text-green-700', amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700', purple: 'bg-purple-100 text-purple-700', gray: 'bg-gray-100 text-gray-700', teal: 'bg-teal-100 text-teal-700', orange: 'bg-orange-100 text-orange-700' };
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${m[color] ?? m.gray}`}>{label}</span>;
}

function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const c: Record<string, string> = { blue: 'border-l-4 border-blue-500 bg-blue-50', green: 'border-l-4 border-green-500 bg-green-50', amber: 'border-l-4 border-amber-500 bg-amber-50', red: 'border-l-4 border-red-500 bg-red-50', purple: 'border-l-4 border-purple-500 bg-purple-50' };
  return <div className={`rounded-lg p-4 ${c[color] ?? c.blue}`}><p className="text-sm text-gray-500">{label}</p><p className="text-2xl font-bold mt-1">{value}</p>{sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}</div>;
}

const moveStatusColor = (s: string) => ({ quoted: 'gray', booked: 'blue', confirmed: 'teal', in_progress: 'amber', completed: 'green', cancelled: 'red' })[s] ?? 'gray';
const customerTypeColor = (t: string) => ({ residential: 'blue', commercial: 'purple', senior: 'amber', student: 'green', military: 'teal' })[t] ?? 'gray';

// ─── Add Customer Modal ────────────────────────────────────────────────────────
function AddCustomerModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', current_address: '', new_address: '', city: 'Calgary', province: 'AB', referral_source: '', customer_type: 'residential', notes: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.first_name || !form.last_name || !form.email || !form.phone) return;
    setSaving(true);
    try {
      await fetch('/api/admin/storage-moving/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
        <h2 className="text-lg font-bold mb-4 text-slate-800">New Customer</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500">First Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.first_name} onChange={e => f('first_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Last Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.last_name} onChange={e => f('last_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Email *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.email} onChange={e => f('email', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Phone *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.phone} onChange={e => f('phone', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Customer Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.customer_type} onChange={e => f('customer_type', e.target.value)}>{CUSTOMER_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Referral Source</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.referral_source} onChange={e => f('referral_source', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Current Address</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.current_address} onChange={e => f('current_address', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">New Address (if known)</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.new_address} onChange={e => f('new_address', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.notes} onChange={e => f('notes', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border rounded hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Add Customer'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Move Modal ────────────────────────────────────────────────────────────
function AddMoveModal({ customers, onClose, onSaved }: { customers: Customer[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ customer_id: '', move_type: 'local', move_date: '', move_time: '08:00', origin_address: '', origin_city: 'Calgary', destination_address: '', destination_city: 'Calgary', estimated_hours: '', crew_size: '2', truck_size: '16ft', quote_amount: '', deposit_paid: '0', packing_service: false, elevator_booking_required: false, storage_needed: false, special_items: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.customer_id || !form.move_date || !form.origin_address || !form.destination_address) return;
    setSaving(true);
    try {
      await fetch('/api/admin/storage-moving/moves', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, customer_id: parseInt(form.customer_id), crew_size: parseInt(form.crew_size), estimated_hours: form.estimated_hours ? parseFloat(form.estimated_hours) : undefined, quote_amount: form.quote_amount ? parseFloat(form.quote_amount) : undefined, deposit_paid: parseFloat(form.deposit_paid) || 0, special_items: form.special_items ? form.special_items.split(',').map(s => s.trim()) : undefined }) });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-4 text-slate-800">New Move</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs text-gray-500">Customer *</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.customer_id} onChange={e => f('customer_id', e.target.value)}><option value="">Select customer…</option>{customers.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name} – {c.phone}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Move Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.move_type} onChange={e => f('move_type', e.target.value)}>{MOVE_TYPES.map(t => <option key={t}>{t.replace(/_/g,' ')}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Move Date *</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.move_date} onChange={e => f('move_date', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Move Time</label><input type="time" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.move_time} onChange={e => f('move_time', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Truck Size</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.truck_size} onChange={e => f('truck_size', e.target.value)}>{TRUCK_SIZES.map(t => <option key={t}>{t}</option>)}</select></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Origin Address *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.origin_address} onChange={e => f('origin_address', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Destination Address *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.destination_address} onChange={e => f('destination_address', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Estimated Hours</label><input type="number" step="0.5" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.estimated_hours} onChange={e => f('estimated_hours', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Crew Size</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.crew_size} onChange={e => f('crew_size', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Quote Amount ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.quote_amount} onChange={e => f('quote_amount', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Deposit Paid ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.deposit_paid} onChange={e => f('deposit_paid', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Special Items (comma-separated)</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" placeholder="Piano, antique dresser, gun safe…" value={form.special_items} onChange={e => f('special_items', e.target.value)} /></div>
          <div className="flex gap-4 col-span-2 mt-1">
            <label className="flex items-center gap-1 text-sm text-gray-600 cursor-pointer"><input type="checkbox" checked={form.packing_service} onChange={e => f('packing_service', e.target.checked)} />Packing Service</label>
            <label className="flex items-center gap-1 text-sm text-gray-600 cursor-pointer"><input type="checkbox" checked={form.elevator_booking_required} onChange={e => f('elevator_booking_required', e.target.checked)} />Elevator Booking</label>
            <label className="flex items-center gap-1 text-sm text-gray-600 cursor-pointer"><input type="checkbox" checked={form.storage_needed} onChange={e => f('storage_needed', e.target.checked)} />Storage Needed</label>
          </div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.notes} onChange={e => f('notes', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border rounded hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Create Move'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Complete Move Modal ───────────────────────────────────────────────────────
function CompleteMoveModal({ move, onClose, onSaved }: { move: Move; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ actual_hours: String(move.actual_hours ?? ''), final_amount: String(move.final_amount ?? move.quote_amount ?? ''), customer_rating: '', customer_feedback: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    setSaving(true);
    try {
      await fetch(`/api/admin/storage-moving/moves/${move.id}/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actual_hours: form.actual_hours ? parseFloat(form.actual_hours) : undefined, final_amount: form.final_amount ? parseFloat(form.final_amount) : undefined, customer_rating: form.customer_rating ? parseInt(form.customer_rating) : undefined, customer_feedback: form.customer_feedback }) });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
        <h2 className="text-lg font-bold mb-1 text-slate-800">Complete Move</h2>
        <p className="text-xs text-gray-500 mb-4">{move.first_name} {move.last_name} — {fmtDate(move.move_date)}</p>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500">Actual Hours</label><input type="number" step="0.5" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.actual_hours} onChange={e => f('actual_hours', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Final Amount ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.final_amount} onChange={e => f('final_amount', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Customer Rating (1-5)</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.customer_rating} onChange={e => f('customer_rating', e.target.value)}><option value="">— Select —</option>{[1,2,3,4,5].map(n => <option key={n} value={n}>{'★'.repeat(n)}</option>)}</select></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Customer Feedback</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.customer_feedback} onChange={e => f('customer_feedback', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border rounded hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">{saving ? 'Saving…' : 'Mark Complete'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function StorageMovingPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [moves, setMoves] = useState<Move[]>([]);
  const [units, setUnits] = useState<StorageUnit[]>([]);
  const [availability, setAvailability] = useState<AvailRow[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [moveStatus, setMoveStatus] = useState('');
  const [rentalStatus, setRentalStatus] = useState('active');
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showAddMove, setShowAddMove] = useState(false);
  const [completeMove, setCompleteMove] = useState<Move | null>(null);
  // AI Quote
  const [quoteForm, setQuoteForm] = useState({ move_type: 'local', origin_address: '', destination_address: '', home_size: '2', special_items: '', packing_service: false });
  const [quoteResult, setQuoteResult] = useState('');
  const [quoteTotal, setQuoteTotal] = useState<number | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  const load = useCallback(async (t: Tab) => {
    if (t === 'dashboard') { const r = await fetch('/api/admin/storage-moving'); setDashboard(await r.json()); }
    if (t === 'moves') { const r = await fetch(`/api/admin/storage-moving/moves?status=${moveStatus}`); setMoves(await r.json()); if (customers.length === 0) { const cr = await fetch('/api/admin/storage-moving/customers'); setCustomers(await cr.json()); } }
    if (t === 'storage-units') { const r = await fetch('/api/admin/storage-moving/storage/units'); const data = await r.json(); setUnits(data.units ?? []); setAvailability(data.availability ?? []); }
    if (t === 'rentals') { const r = await fetch(`/api/admin/storage-moving/storage/rentals?status=${rentalStatus}`); setRentals(await r.json()); }
    if (t === 'customers') { const r = await fetch('/api/admin/storage-moving/customers'); setCustomers(await r.json()); }
    if (t === 'ai-quote') { /* no load needed */ }
  }, [moveStatus, rentalStatus, customers.length]);

  useEffect(() => { load(tab); }, [tab, load]);

  async function advanceMoveStatus(m: Move) {
    const next: Record<string, string> = { quoted: 'booked', booked: 'confirmed', confirmed: 'in_progress' };
    const nextStatus = next[m.status];
    if (!nextStatus) return;
    await fetch(`/api/admin/storage-moving/moves/${m.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: nextStatus }) });
    load('moves');
  }

  async function recordPayment(rentalId: number, method: string) {
    await fetch(`/api/admin/storage-moving/storage/rentals/${rentalId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ record_payment: true, payment_method: method }) });
    load('rentals');
  }

  async function vacateUnit(rentalId: number) {
    if (!confirm('Mark this unit as vacated?')) return;
    await fetch(`/api/admin/storage-moving/storage/rentals/${rentalId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vacate: true }) });
    load('rentals');
  }

  async function generateQuote() {
    setQuoteLoading(true);
    try {
      const r = await fetch('/api/admin/storage-moving/ai-quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(quoteForm) });
      const data = await r.json();
      setQuoteResult(data.quote);
      setQuoteTotal(data.estimated_total);
    } finally { setQuoteLoading(false); }
  }

  const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-2xl font-bold text-slate-800">Storage & Moving Company Hub</h1>
        <p className="text-sm text-gray-500 mt-0.5">Move scheduling, storage unit management, rental tracking, AI quotes — Calgary, AB</p>
      </div>
      <div className="flex border-b bg-white px-6 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{TAB_LABELS[t]}</button>
        ))}
      </div>
      <div className="p-6">

        {/* DASHBOARD */}
        {tab === 'dashboard' && dashboard && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <KpiCard label="Moves This Month" value={dashboard.moves_this_month} color="blue" />
              <KpiCard label="Moves This Week" value={dashboard.moves_this_week} color="teal" />
              <KpiCard label="Units Occupied" value={dashboard.storage_units_occupied} color="purple" />
              <KpiCard label="Occupancy %" value={`${dashboard.storage_occupancy_pct}%`} color="green" />
              <KpiCard label="Revenue MTD" value={fmtCad(dashboard.revenue_mtd)} color="green" />
              <KpiCard label="Outstanding" value={fmtCad(dashboard.outstanding_balance)} color="amber" />
            </div>
            <div className="bg-white rounded-lg border p-4">
              <h3 className="font-semibold text-slate-700 mb-3">Quick Actions</h3>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => { setTab('customers'); setShowAddCustomer(true); }} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">+ New Customer</button>
                <button onClick={() => { setTab('moves'); setShowAddMove(true); }} className="px-3 py-1.5 text-sm bg-orange-500 text-white rounded hover:bg-orange-600">+ Book Move</button>
                <button onClick={() => setTab('ai-quote')} className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700">Generate AI Quote</button>
              </div>
            </div>
          </div>
        )}

        {/* MOVES */}
        {tab === 'moves' && (
          <div className="space-y-4">
            <div className="flex gap-2 items-center flex-wrap">
              {['','quoted','booked','confirmed','in_progress','completed'].map(s => (
                <button key={s} onClick={() => setMoveStatus(s)} className={`px-3 py-1 text-xs rounded border ${moveStatus === s ? 'bg-orange-500 text-white border-orange-500' : 'bg-white hover:bg-gray-50'}`}>{s || 'All'}</button>
              ))}
              <button onClick={() => setShowAddMove(true)} className="ml-auto px-3 py-1.5 text-sm bg-orange-500 text-white rounded hover:bg-orange-600">+ Book Move</button>
            </div>
            <div className="space-y-2">
              {moves.map(m => (
                <div key={m.id} className="bg-white rounded-lg border px-4 py-3">
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <p className="font-semibold text-slate-800">{m.first_name} {m.last_name} <Badge label={m.move_type.replace(/_/g,' ')} color="blue" /> <Badge label={m.customer_type} color={customerTypeColor(m.customer_type)} /></p>
                      <p className="text-xs text-gray-500">{fmtDate(m.move_date)} · {m.move_time?.slice(0,5)} · {m.crew_size} crew · {m.truck_size}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{m.origin_address} → {m.destination_address}</p>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {m.packing_service && <Badge label="Packing" color="purple" />}
                        {m.special_items?.length > 0 && <Badge label={`Special: ${m.special_items.join(', ')}`} color="amber" />}
                      </div>
                      {m.customer_rating && <p className="text-sm text-amber-500 mt-1">{stars(m.customer_rating)}</p>}
                    </div>
                    <div className="text-right flex flex-col items-end gap-2">
                      <Badge label={m.status} color={moveStatusColor(m.status)} />
                      <p className="text-sm font-medium">{fmtCad(m.final_amount ?? m.quote_amount ?? 0)}</p>
                      <div className="flex gap-1">
                        {['quoted','booked','confirmed'].includes(m.status) && (
                          <button onClick={() => advanceMoveStatus(m)} className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">Advance →</button>
                        )}
                        {m.status === 'in_progress' && (
                          <button onClick={() => setCompleteMove(m)} className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700">Complete</button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {moves.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No moves found.</p>}
            </div>
            {showAddMove && <AddMoveModal customers={customers} onClose={() => setShowAddMove(false)} onSaved={() => { setShowAddMove(false); load('moves'); }} />}
            {completeMove && <CompleteMoveModal move={completeMove} onClose={() => setCompleteMove(null)} onSaved={() => { setCompleteMove(null); load('moves'); }} />}
          </div>
        )}

        {/* STORAGE UNITS */}
        {tab === 'storage-units' && (
          <div className="space-y-4">
            {availability.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                {availability.map(a => (
                  <div key={a.unit_size} className="bg-white border rounded-lg p-3 text-center">
                    <p className="text-xs font-medium text-gray-500">{a.unit_size}</p>
                    <p className="text-xl font-bold text-green-700">{a.available}</p>
                    <p className="text-xs text-gray-400">/ {a.total} avail</p>
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {units.map(u => (
                <div key={u.id} className={`bg-white rounded-lg border p-3 ${u.is_occupied ? 'border-red-200' : 'border-green-200'}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-slate-800">{u.unit_number}</p>
                      <p className="text-xs text-gray-500">{u.unit_size} · {u.unit_type?.replace(/_/g,' ')}</p>
                      {u.floor && <p className="text-xs text-gray-400">Floor {u.floor}{u.building ? ` · Bldg ${u.building}` : ''}</p>}
                    </div>
                    <div>
                      <span className={`inline-block w-3 h-3 rounded-full mt-1 ${u.is_occupied ? 'bg-red-500' : 'bg-green-500'}`} />
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-gray-700 mt-2">{fmtCad(u.monthly_rate)}/mo</p>
                  <p className="text-xs text-gray-400">{u.is_occupied ? 'Occupied' : 'Available'}</p>
                </div>
              ))}
              {units.length === 0 && <p className="text-sm text-gray-400 col-span-4 text-center py-8">No storage units. Add units via the database or API.</p>}
            </div>
          </div>
        )}

        {/* RENTALS */}
        {tab === 'rentals' && (
          <div className="space-y-4">
            <div className="flex gap-2 items-center">
              {['active','overdue','vacated'].map(s => (
                <button key={s} onClick={() => setRentalStatus(s)} className={`px-3 py-1 text-xs rounded border ${rentalStatus === s ? 'bg-orange-500 text-white border-orange-500' : 'bg-white hover:bg-gray-50'}`}>{s}</button>
              ))}
              <button onClick={() => load('rentals')} className="ml-auto px-3 py-1.5 text-sm bg-gray-100 border rounded hover:bg-gray-200">Refresh</button>
            </div>
            <div className="space-y-2">
              {rentals.map(r => (
                <div key={r.id} className={`bg-white rounded-lg border px-4 py-3 ${r.is_overdue ? 'border-red-300' : ''}`}>
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <p className="font-semibold text-slate-800">{r.first_name} {r.last_name} — Unit {r.unit_number} ({r.unit_size})</p>
                      <p className="text-xs text-gray-500">{r.phone} · {r.unit_type?.replace(/_/g,' ')}</p>
                      <p className="text-xs text-gray-400">Started: {fmtDate(r.start_date)} · Rate: {fmtCad(r.monthly_rate)}/mo · Last paid: {fmtDate(r.last_payment_date)}</p>
                      {r.access_code && <p className="text-xs text-gray-400 font-mono">Code: {r.access_code}</p>}
                      {r.is_overdue && <p className="text-xs text-red-600 font-medium mt-1">Payment overdue</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge label={r.status} color={r.status === 'active' ? 'green' : r.status === 'overdue' ? 'red' : 'gray'} />
                      {r.status !== 'vacated' && (
                        <>
                          <button onClick={() => recordPayment(r.id, 'credit_card')} className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700">Record Payment</button>
                          <button onClick={() => vacateUnit(r.id)} className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600">Vacate</button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {rentals.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No rentals found.</p>}
            </div>
          </div>
        )}

        {/* CUSTOMERS */}
        {tab === 'customers' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <button onClick={() => setShowAddCustomer(true)} className="ml-auto px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">+ New Customer</button>
            </div>
            <div className="space-y-2">
              {customers.map(c => (
                <div key={c.id} className="bg-white rounded-lg border px-4 py-3 flex items-center gap-4">
                  <div className="flex-1">
                    <p className="font-semibold text-slate-800">{c.first_name} {c.last_name}</p>
                    <p className="text-xs text-gray-500">{c.phone} · {c.email} · {c.city}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge label={c.customer_type} color={customerTypeColor(c.customer_type)} />
                    <span className="text-xs text-gray-400">{c.total_jobs} jobs · {fmtCad(c.total_spent)}</span>
                  </div>
                </div>
              ))}
              {customers.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No customers found.</p>}
            </div>
            {showAddCustomer && <AddCustomerModal onClose={() => setShowAddCustomer(false)} onSaved={() => { setShowAddCustomer(false); load('customers'); }} />}
          </div>
        )}

        {/* AI QUOTE */}
        {tab === 'ai-quote' && (
          <div className="max-w-2xl space-y-6">
            <div className="bg-white rounded-lg border p-5">
              <h3 className="font-semibold text-slate-700 mb-3">AI Moving Quote Generator</h3>
              <p className="text-sm text-gray-500 mb-4">Enter move details and generate a professional quote with full price breakdown, Calgary-specific notes, and moving day tips.</p>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div><label className="text-xs text-gray-500">Move Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={quoteForm.move_type} onChange={e => setQuoteForm(p => ({ ...p, move_type: e.target.value }))}>{MOVE_TYPES.map(t => <option key={t}>{t.replace(/_/g,' ')}</option>)}</select></div>
                <div><label className="text-xs text-gray-500">Home Size (bedrooms)</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={quoteForm.home_size} onChange={e => setQuoteForm(p => ({ ...p, home_size: e.target.value }))}>{['studio','1','2','3','4','5+'].map(s => <option key={s}>{s}</option>)}</select></div>
                <div className="col-span-2"><label className="text-xs text-gray-500">Origin Address</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" placeholder="123 Main St SW, Calgary, AB" value={quoteForm.origin_address} onChange={e => setQuoteForm(p => ({ ...p, origin_address: e.target.value }))} /></div>
                <div className="col-span-2"><label className="text-xs text-gray-500">Destination Address</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" placeholder="456 Park Ave NW, Calgary, AB" value={quoteForm.destination_address} onChange={e => setQuoteForm(p => ({ ...p, destination_address: e.target.value }))} /></div>
                <div className="col-span-2"><label className="text-xs text-gray-500">Special Items</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" placeholder="Piano, gun safe, antiques…" value={quoteForm.special_items} onChange={e => setQuoteForm(p => ({ ...p, special_items: e.target.value }))} /></div>
                <div className="col-span-2"><label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer"><input type="checkbox" checked={quoteForm.packing_service} onChange={e => setQuoteForm(p => ({ ...p, packing_service: e.target.checked }))} />Include Packing Service</label></div>
              </div>
              <button onClick={generateQuote} disabled={quoteLoading} className="px-4 py-2 bg-orange-500 text-white text-sm rounded hover:bg-orange-600 disabled:opacity-50">{quoteLoading ? 'Generating…' : 'Generate Quote'}</button>
              {quoteResult && (
                <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded">
                  {quoteTotal && <p className="text-lg font-bold text-orange-700 mb-2">Estimated Total: {fmtCad(quoteTotal)}</p>}
                  <pre className="text-sm text-orange-900 whitespace-pre-wrap font-sans leading-relaxed">{quoteResult}</pre>
                  <button onClick={() => navigator.clipboard?.writeText(quoteResult)} className="mt-2 text-xs text-orange-700 hover:underline">Copy to clipboard</button>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
