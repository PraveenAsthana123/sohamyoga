'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard','reservations','menu','staff','suppliers','ai','compliance'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = { dashboard: 'Dashboard', reservations: 'Reservations', menu: 'Menu', staff: 'Staff', suppliers: 'Suppliers', ai: 'AI Menu Planner', compliance: 'Compliance' };

const MENU_CATEGORIES = ['all','appetizer','soup','salad','main','dessert','beverage','cocktail','wine','beer','side','special'];
const STAFF_ROLES = ['head_chef','sous_chef','line_cook','prep_cook','dishwasher','server','bartender','host','manager','busser'];
const SUPPLIER_CATS = ['produce','meat','seafood','dairy','dry_goods','beverages','cleaning','packaging','equipment'];
const RES_STATUSES = ['confirmed','seated','completed','no_show','cancelled'];
const RES_SOURCES = ['phone','walk_in','website','opentable','yelp','google'];
const DIETARY_OPTIONS = ['vegan','vegetarian','gluten_free','halal','kosher'];
const ALLERGEN_OPTIONS = ['gluten','dairy','nuts','shellfish','eggs','soy'];

interface Location { id: number; name: string; city: string; cuisine_type: string; seating_capacity: number; patio_capacity: number; health_inspection_date: string; health_inspection_score: number; liquor_license_expiry: string; status: string; manager_name: string; }
interface Reservation { id: number; location_id: number; location_name: string; guest_name: string; phone: string; party_size: number; reservation_date: string; reservation_time: string; table_number: string; section: string; status: string; special_requests: string; occasion: string; source: string; }
interface MenuItem { id: number; location_id: number; name: string; category: string; description: string; price: number; food_cost: number; food_cost_pct: number; allergens: string[]; dietary: string[]; is_available: boolean; is_featured: boolean; calories: number; prep_time_minutes: number; }
interface Supplier { id: number; name: string; category: string; contact_name: string; phone: string; email: string; payment_terms: number; delivery_days: string[]; min_order_amount: number; status: string; }
interface Staff { id: number; location_id: number; location_name: string; name: string; role: string; employment_type: string; hourly_rate: number; status: string; food_safe_expiry: string; serving_it_right_expiry: string; }
interface DashStats { todayReservations: number; coversTonight: number; locations: { id: number; name: string; status: string; health_inspection_score: number; health_inspection_date: string; liquor_license_expiry: string }[]; avgFoodCostPct: number; highCostItems: number; certAlerts: number; }

function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString('en-CA') : '—'; }
function daysUntil(d: string) { if (!d) return 9999; return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000); }
function expiryColor(d: string) { const days = daysUntil(d); if (days < 30) return 'red'; if (days < 60) return 'amber'; return 'green'; }

function Badge({ label, color = 'gray' }: { label: string; color?: string }) {
  const map: Record<string, string> = { blue: 'bg-blue-100 text-blue-700', green: 'bg-green-100 text-green-700', amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700', purple: 'bg-purple-100 text-purple-700', gray: 'bg-gray-100 text-gray-700', teal: 'bg-teal-100 text-teal-700', orange: 'bg-orange-100 text-orange-700' };
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${map[color] ?? map.gray}`}>{label.replace(/_/g,' ')}</span>;
}
function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const borders: Record<string, string> = { blue: 'border-l-4 border-blue-500 bg-blue-50', green: 'border-l-4 border-green-500 bg-green-50', amber: 'border-l-4 border-amber-500 bg-amber-50', red: 'border-l-4 border-red-500 bg-red-50', purple: 'border-l-4 border-purple-500 bg-purple-50', teal: 'border-l-4 border-teal-500 bg-teal-50' };
  return <div className={`rounded-lg p-4 ${borders[color] ?? borders.blue}`}><p className="text-sm text-gray-500">{label}</p><p className="text-2xl font-bold mt-1">{value}</p>{sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}</div>;
}
function foodCostColor(pct: number) { if (pct > 35) return 'red'; if (pct >= 28) return 'green'; return 'amber'; }
function statusColor(s: string) { const m: Record<string,string> = { confirmed: 'blue', seated: 'amber', completed: 'green', no_show: 'red', cancelled: 'gray', open: 'green', closed: 'red', seasonal: 'amber', renovation: 'orange', active: 'green', inactive: 'gray' }; return m[s] ?? 'gray'; }
function roleColor(r: string) { const m: Record<string,string> = { head_chef: 'purple', sous_chef: 'blue', line_cook: 'teal', prep_cook: 'teal', dishwasher: 'gray', server: 'green', bartender: 'amber', host: 'blue', manager: 'red', busser: 'gray' }; return m[r] ?? 'gray'; }

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

function AddReservationModal({ locations, onClose, onSaved }: { locations: Location[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ location_id: locations[0]?.id?.toString() || '', guest_name: '', phone: '', email: '', party_size: '2', reservation_date: new Date().toISOString().slice(0, 10), reservation_time: '19:00', duration_minutes: '90', table_number: '', section: '', special_requests: '', occasion: '', source: 'phone' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.guest_name || !form.party_size || !form.location_id) return;
    setSaving(true);
    try { await fetch('/api/admin/restaurant-hospitality/reservations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, party_size: parseInt(form.party_size), duration_minutes: parseInt(form.duration_minutes) }) }); onSaved(); }
    finally { setSaving(false); }
  }
  return (
    <Modal title="New Reservation" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-xs text-gray-500">Location</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.location_id} onChange={e => f('location_id', e.target.value)}>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
        <div><label className="text-xs text-gray-500">Source</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.source} onChange={e => f('source', e.target.value)}>{RES_SOURCES.map(s => <option key={s}>{s.replace(/_/g,' ')}</option>)}</select></div>
        <div className="col-span-2"><label className="text-xs text-gray-500">Guest Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.guest_name} onChange={e => f('guest_name', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Phone</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.phone} onChange={e => f('phone', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Email</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.email} onChange={e => f('email', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Party Size *</label><input type="number" min="1" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.party_size} onChange={e => f('party_size', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Duration (min)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.duration_minutes} onChange={e => f('duration_minutes', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Date *</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.reservation_date} onChange={e => f('reservation_date', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Time *</label><input type="time" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.reservation_time} onChange={e => f('reservation_time', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Table #</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.table_number} onChange={e => f('table_number', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Section</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.section} onChange={e => f('section', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Occasion</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" placeholder="Birthday, Anniversary…" value={form.occasion} onChange={e => f('occasion', e.target.value)} /></div>
        <div className="col-span-2"><label className="text-xs text-gray-500">Special Requests</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.special_requests} onChange={e => f('special_requests', e.target.value)} /></div>
      </div>
      <div className="flex justify-end gap-2 mt-4"><button onClick={onClose} className="px-4 py-2 text-sm border rounded">Cancel</button><button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Book Reservation'}</button></div>
    </Modal>
  );
}

function AddMenuItemModal({ locations, onClose, onSaved }: { locations: Location[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ location_id: locations[0]?.id?.toString() || '', name: '', category: 'main', description: '', price: '', food_cost: '', calories: '', prep_time_minutes: '', is_available: true, is_featured: false });
  const [allergens, setAllergens] = useState<string[]>([]);
  const [dietary, setDietary] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));
  function toggleArr(arr: string[], setArr: (a: string[]) => void, val: string) { setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]); }
  async function submit() {
    if (!form.name || !form.location_id) return;
    setSaving(true);
    try { await fetch('/api/admin/restaurant-hospitality/menu', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, price: form.price ? parseFloat(form.price) : null, food_cost: form.food_cost ? parseFloat(form.food_cost) : null, calories: form.calories ? parseInt(form.calories) : null, prep_time_minutes: form.prep_time_minutes ? parseInt(form.prep_time_minutes) : null, allergens, dietary }) }); onSaved(); }
    finally { setSaving(false); }
  }
  return (
    <Modal title="Add Menu Item" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-xs text-gray-500">Location</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.location_id} onChange={e => f('location_id', e.target.value)}>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
        <div><label className="text-xs text-gray-500">Category</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.category} onChange={e => f('category', e.target.value)}>{MENU_CATEGORIES.filter(c => c !== 'all').map(c => <option key={c}>{c}</option>)}</select></div>
        <div className="col-span-2"><label className="text-xs text-gray-500">Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.name} onChange={e => f('name', e.target.value)} /></div>
        <div className="col-span-2"><label className="text-xs text-gray-500">Description</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.description} onChange={e => f('description', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Price (CAD)</label><input type="number" step="0.01" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.price} onChange={e => f('price', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Food Cost (CAD)</label><input type="number" step="0.01" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.food_cost} onChange={e => f('food_cost', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Calories</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.calories} onChange={e => f('calories', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Prep Time (min)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.prep_time_minutes} onChange={e => f('prep_time_minutes', e.target.value)} /></div>
        <div className="col-span-2">
          <label className="text-xs text-gray-500">Allergens</label>
          <div className="flex flex-wrap gap-2 mt-1">{ALLERGEN_OPTIONS.map(a => <label key={a} className={`flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer border ${allergens.includes(a) ? 'bg-red-50 border-red-300' : 'bg-gray-50 border-gray-200'}`}><input type="checkbox" checked={allergens.includes(a)} onChange={() => toggleArr(allergens, setAllergens, a)} />{a}</label>)}</div>
        </div>
        <div className="col-span-2">
          <label className="text-xs text-gray-500">Dietary</label>
          <div className="flex flex-wrap gap-2 mt-1">{DIETARY_OPTIONS.map(d => <label key={d} className={`flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer border ${dietary.includes(d) ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-200'}`}><input type="checkbox" checked={dietary.includes(d)} onChange={() => toggleArr(dietary, setDietary, d)} />{d.replace(/_/g,' ')}</label>)}</div>
        </div>
        <div className="flex items-center gap-2"><input type="checkbox" id="avail" checked={form.is_available} onChange={e => f('is_available', e.target.checked)} /><label htmlFor="avail" className="text-sm text-gray-700">Available</label></div>
        <div className="flex items-center gap-2"><input type="checkbox" id="feat" checked={form.is_featured} onChange={e => f('is_featured', e.target.checked)} /><label htmlFor="feat" className="text-sm text-gray-700">Featured</label></div>
      </div>
      <div className="flex justify-end gap-2 mt-4"><button onClick={onClose} className="px-4 py-2 text-sm border rounded">Cancel</button><button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Add Item'}</button></div>
    </Modal>
  );
}

function AddStaffModal({ locations, onClose, onSaved }: { locations: Location[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ location_id: locations[0]?.id?.toString() || '', name: '', role: 'server', employment_type: 'part_time', hourly_rate: '', start_date: '', food_safe_expiry: '', serving_it_right_expiry: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.name || !form.location_id) return;
    setSaving(true);
    try { await fetch('/api/admin/restaurant-hospitality/staff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, hourly_rate: form.hourly_rate ? parseFloat(form.hourly_rate) : null }) }); onSaved(); }
    finally { setSaving(false); }
  }
  return (
    <Modal title="Add Staff Member" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-xs text-gray-500">Location</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.location_id} onChange={e => f('location_id', e.target.value)}>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
        <div><label className="text-xs text-gray-500">Role</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.role} onChange={e => f('role', e.target.value)}>{STAFF_ROLES.map(r => <option key={r}>{r.replace(/_/g,' ')}</option>)}</select></div>
        <div className="col-span-2"><label className="text-xs text-gray-500">Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.name} onChange={e => f('name', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Employment Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.employment_type} onChange={e => f('employment_type', e.target.value)}>{['full_time','part_time','casual'].map(t => <option key={t}>{t.replace(/_/g,' ')}</option>)}</select></div>
        <div><label className="text-xs text-gray-500">Hourly Rate</label><input type="number" step="0.01" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.hourly_rate} onChange={e => f('hourly_rate', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Start Date</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.start_date} onChange={e => f('start_date', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Food Safe Expiry</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.food_safe_expiry} onChange={e => f('food_safe_expiry', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Serving It Right Expiry</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.serving_it_right_expiry} onChange={e => f('serving_it_right_expiry', e.target.value)} /></div>
        <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.notes} onChange={e => f('notes', e.target.value)} /></div>
      </div>
      <div className="flex justify-end gap-2 mt-4"><button onClick={onClose} className="px-4 py-2 text-sm border rounded">Cancel</button><button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Add Staff'}</button></div>
    </Modal>
  );
}

function AddSupplierModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', category: 'produce', contact_name: '', phone: '', email: '', payment_terms: '30', min_order_amount: '', notes: '' });
  const [deliveryDays, setDeliveryDays] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  function toggleDay(d: string) { setDeliveryDays(p => p.includes(d) ? p.filter(x => x !== d) : [...p, d]); }
  async function submit() {
    if (!form.name) return;
    setSaving(true);
    try { await fetch('/api/admin/restaurant-hospitality/suppliers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, payment_terms: parseInt(form.payment_terms), min_order_amount: form.min_order_amount ? parseFloat(form.min_order_amount) : null, delivery_days: deliveryDays }) }); onSaved(); }
    finally { setSaving(false); }
  }
  return (
    <Modal title="Add Supplier" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><label className="text-xs text-gray-500">Supplier Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.name} onChange={e => f('name', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Category</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.category} onChange={e => f('category', e.target.value)}>{SUPPLIER_CATS.map(c => <option key={c}>{c.replace(/_/g,' ')}</option>)}</select></div>
        <div><label className="text-xs text-gray-500">Contact Name</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.contact_name} onChange={e => f('contact_name', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Phone</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.phone} onChange={e => f('phone', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Email</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.email} onChange={e => f('email', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Payment Terms (days)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.payment_terms} onChange={e => f('payment_terms', e.target.value)} /></div>
        <div><label className="text-xs text-gray-500">Min Order (CAD)</label><input type="number" step="0.01" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.min_order_amount} onChange={e => f('min_order_amount', e.target.value)} /></div>
        <div className="col-span-2">
          <label className="text-xs text-gray-500">Delivery Days</label>
          <div className="flex gap-2 mt-1">{['mon','tue','wed','thu','fri','sat','sun'].map(d => <button key={d} type="button" onClick={() => toggleDay(d)} className={`px-2 py-1 text-xs rounded capitalize border ${deliveryDays.includes(d) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-300'}`}>{d}</button>)}</div>
        </div>
        <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.notes} onChange={e => f('notes', e.target.value)} /></div>
      </div>
      <div className="flex justify-end gap-2 mt-4"><button onClick={onClose} className="px-4 py-2 text-sm border rounded">Cancel</button><button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Add Supplier'}</button></div>
    </Modal>
  );
}

export default function RestaurantHospitalityPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [stats, setStats] = useState<DashStats | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [compliance, setCompliance] = useState<{ locations: unknown[]; staff: unknown[] } | null>(null);
  const [resDate, setResDate] = useState(new Date().toISOString().slice(0, 10));
  const [resLocFilter, setResLocFilter] = useState('');
  const [menuLocFilter, setMenuLocFilter] = useState('');
  const [menuCatFilter, setMenuCatFilter] = useState('all');
  const [staffLocFilter, setStaffLocFilter] = useState('');
  const [supplierCatFilter, setSupplierCatFilter] = useState('');
  const [showAddRes, setShowAddRes] = useState(false);
  const [showAddMenuItem, setShowAddMenuItem] = useState(false);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [aiMenuForm, setAiMenuForm] = useState({ cuisine_type: 'Canadian Contemporary', season: '', dietary_trend: 'vegan-friendly, gluten-free, locally-sourced', price_point: 'mid-range ($25-45 mains)' });
  const [aiMenu, setAiMenu] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const fetchStats = useCallback(async () => { const r = await fetch('/api/admin/restaurant-hospitality'); if (r.ok) setStats(await r.json()); }, []);
  const fetchLocations = useCallback(async () => { const r = await fetch('/api/admin/restaurant-hospitality/locations'); if (r.ok) setLocations(await r.json()); }, []);
  const fetchReservations = useCallback(async () => {
    const params = new URLSearchParams({ date: resDate });
    if (resLocFilter) params.set('location_id', resLocFilter);
    const r = await fetch(`/api/admin/restaurant-hospitality/reservations?${params}`);
    if (r.ok) setReservations(await r.json());
  }, [resDate, resLocFilter]);
  const fetchMenu = useCallback(async () => {
    const params = new URLSearchParams();
    if (menuLocFilter) params.set('location_id', menuLocFilter);
    if (menuCatFilter && menuCatFilter !== 'all') params.set('category', menuCatFilter);
    const r = await fetch(`/api/admin/restaurant-hospitality/menu?${params}`);
    if (r.ok) setMenuItems(await r.json());
  }, [menuLocFilter, menuCatFilter]);
  const fetchStaff = useCallback(async () => {
    const params = staffLocFilter ? `?location_id=${staffLocFilter}` : '';
    const r = await fetch(`/api/admin/restaurant-hospitality/staff${params}`);
    if (r.ok) setStaff(await r.json());
  }, [staffLocFilter]);
  const fetchSuppliers = useCallback(async () => {
    const params = supplierCatFilter ? `?category=${supplierCatFilter}` : '';
    const r = await fetch(`/api/admin/restaurant-hospitality/suppliers${params}`);
    if (r.ok) setSuppliers(await r.json());
  }, [supplierCatFilter]);
  const fetchCompliance = useCallback(async () => {
    const r = await fetch('/api/admin/restaurant-hospitality/compliance');
    if (r.ok) setCompliance(await r.json());
  }, []);

  useEffect(() => { fetchStats(); fetchLocations(); fetchReservations(); fetchMenu(); fetchStaff(); fetchSuppliers(); }, [fetchStats, fetchLocations, fetchReservations, fetchMenu, fetchStaff, fetchSuppliers]);
  useEffect(() => { if (tab === 'compliance') fetchCompliance(); }, [tab, fetchCompliance]);
  useEffect(() => { fetchReservations(); }, [resDate, resLocFilter, fetchReservations]);
  useEffect(() => { fetchMenu(); }, [menuLocFilter, menuCatFilter, fetchMenu]);
  useEffect(() => { fetchStaff(); }, [staffLocFilter, fetchStaff]);
  useEffect(() => { fetchSuppliers(); }, [supplierCatFilter, fetchSuppliers]);

  async function updateResStatus(id: number, action: 'seat' | 'complete' | 'no_show' | 'cancel') {
    if (action === 'seat') await fetch(`/api/admin/restaurant-hospitality/reservations/${id}/seat`, { method: 'POST' });
    else if (action === 'complete') await fetch(`/api/admin/restaurant-hospitality/reservations/${id}/complete`, { method: 'POST' });
    else await fetch(`/api/admin/restaurant-hospitality/reservations/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: action === 'no_show' ? 'no_show' : 'cancelled' }) });
    fetchReservations(); fetchStats();
  }
  async function toggleMenuAvailability(item: MenuItem) {
    await fetch(`/api/admin/restaurant-hospitality/menu/${item.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...item, is_available: !item.is_available }) });
    fetchMenu();
  }
  async function runAiMenu() {
    if (!aiMenuForm.cuisine_type) return;
    setAiLoading(true); setAiMenu('');
    try { const r = await fetch('/api/admin/restaurant-hospitality/ai-menu', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(aiMenuForm) }); if (r.ok) { const d = await r.json(); setAiMenu(d.menu || ''); } } finally { setAiLoading(false); }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-slate-800 text-white px-6 py-4">
        <h1 className="text-xl font-bold">Restaurant & Hospitality Portal</h1>
        <p className="text-slate-400 text-sm mt-0.5">Multi-Location Restaurant Management — Reservations, Menu, Staff, Compliance</p>
      </div>
      <div className="border-b bg-white px-6">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map(t => <button key={t} onClick={() => setTab(t)} className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{TAB_LABELS[t]}</button>)}
        </div>
      </div>
      <div className="p-6">

        {tab === 'dashboard' && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard label="Today's Reservations" value={stats.todayReservations} color="blue" />
              <KpiCard label="Covers Tonight" value={stats.coversTonight} color="teal" sub="Total guests" />
              <KpiCard label="Avg Food Cost %" value={`${stats.avgFoodCostPct}%`} color={stats.avgFoodCostPct > 35 ? 'red' : stats.avgFoodCostPct >= 28 ? 'green' : 'amber'} sub="Target: 28–32%" />
              <KpiCard label="Cert Alerts" value={stats.certAlerts} color={stats.certAlerts > 0 ? 'red' : 'green'} sub="Expiring in 60d" />
            </div>
            <div className="grid gap-4">
              {stats.locations.map(loc => (
                <div key={loc.id} className="bg-white rounded-xl border p-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <h3 className="font-semibold text-slate-800">{loc.name}</h3>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        <Badge label={loc.status} color={statusColor(loc.status)} />
                        {loc.health_inspection_score && <Badge label={`Health Score: ${loc.health_inspection_score}`} color={loc.health_inspection_score >= 90 ? 'green' : loc.health_inspection_score >= 80 ? 'amber' : 'red'} />}
                        {loc.liquor_license_expiry && <Badge label={`Liquor lic: ${fmtDate(loc.liquor_license_expiry)}`} color={expiryColor(loc.liquor_license_expiry)} />}
                      </div>
                    </div>
                    <div className="text-right text-sm text-gray-500">
                      {loc.health_inspection_date && <p>Last inspection: {fmtDate(loc.health_inspection_date)}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'reservations' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex gap-2 flex-wrap">
                <input type="date" className="border rounded px-3 py-1.5 text-sm" value={resDate} onChange={e => setResDate(e.target.value)} />
                <select className="border rounded px-3 py-1.5 text-sm" value={resLocFilter} onChange={e => setResLocFilter(e.target.value)}><option value="">All Locations</option>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-sm text-gray-500">Total covers: <span className="font-bold text-slate-800">{reservations.filter(r => !['cancelled','no_show'].includes(r.status)).reduce((s, r) => s + r.party_size, 0)}</span></div>
                <button onClick={() => setShowAddRes(true)} className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">+ New Reservation</button>
              </div>
            </div>
            <div className="bg-white rounded-xl border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Time','Guest','Party','Table','Location','Occasion','Special Requests','Status','Actions'].map(h => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr></thead>
                <tbody>
                  {reservations.map(r => (
                    <tr key={r.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono font-semibold">{String(r.reservation_time).slice(0,5)}</td>
                      <td className="px-4 py-3"><p className="font-semibold">{r.guest_name}</p><p className="text-xs text-gray-400">{r.phone}</p></td>
                      <td className="px-4 py-3 text-center font-bold">{r.party_size}</td>
                      <td className="px-4 py-3">{r.table_number || '—'}{r.section && <span className="text-gray-400 text-xs ml-1">({r.section})</span>}</td>
                      <td className="px-4 py-3 text-xs">{r.location_name}</td>
                      <td className="px-4 py-3">{r.occasion ? <Badge label={r.occasion} color="purple" /> : '—'}</td>
                      <td className="px-4 py-3 text-xs max-w-[180px]">{r.special_requests ? <span className="text-amber-700 bg-amber-50 px-1 rounded">{r.special_requests}</span> : '—'}</td>
                      <td className="px-4 py-3"><Badge label={r.status} color={statusColor(r.status)} /></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {r.status === 'confirmed' && <button onClick={() => updateResStatus(r.id, 'seat')} className="text-xs px-2 py-1 bg-amber-500 text-white rounded">Seat</button>}
                          {r.status === 'seated' && <button onClick={() => updateResStatus(r.id, 'complete')} className="text-xs px-2 py-1 bg-green-600 text-white rounded">Complete</button>}
                          {['confirmed','seated'].includes(r.status) && <button onClick={() => updateResStatus(r.id, 'no_show')} className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded">No Show</button>}
                          {['confirmed'].includes(r.status) && <button onClick={() => updateResStatus(r.id, 'cancel')} className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">Cancel</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {reservations.length === 0 && <p className="text-center text-gray-400 py-8">No reservations for {resDate}</p>}
            </div>
            {showAddRes && <AddReservationModal locations={locations} onClose={() => setShowAddRes(false)} onSaved={() => { setShowAddRes(false); fetchReservations(); fetchStats(); }} />}
          </div>
        )}

        {tab === 'menu' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex gap-2 flex-wrap">
                <select className="border rounded px-3 py-1.5 text-sm" value={menuLocFilter} onChange={e => setMenuLocFilter(e.target.value)}><option value="">All Locations</option>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
                <div className="flex gap-1 flex-wrap">{MENU_CATEGORIES.map(c => <button key={c} onClick={() => setMenuCatFilter(c)} className={`px-3 py-1 text-xs rounded capitalize border ${menuCatFilter === c ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-300'}`}>{c}</button>)}</div>
              </div>
              <button onClick={() => setShowAddMenuItem(true)} className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">+ Add Item</button>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {menuItems.map(item => (
                <div key={item.id} className="bg-white rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <Badge label={item.category} color="blue" />
                      {item.is_featured && <Badge label="Featured" color="amber" />}
                    </div>
                    <button onClick={() => toggleMenuAvailability(item)} className={`text-xs px-2 py-0.5 rounded border ${item.is_available ? 'border-green-400 text-green-700 bg-green-50' : 'border-gray-300 text-gray-400 bg-gray-50'}`}>{item.is_available ? 'Available' : 'Off Menu'}</button>
                  </div>
                  <h3 className="font-semibold text-slate-800">{item.name}</h3>
                  {item.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.description}</p>}
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-bold text-slate-800">${Number(item.price).toFixed(2)}</span>
                    {item.food_cost_pct && (
                      <Badge label={`Food cost: ${Number(item.food_cost_pct).toFixed(1)}%`} color={foodCostColor(Number(item.food_cost_pct))} />
                    )}
                  </div>
                  {(item.allergens?.length > 0 || item.dietary?.length > 0) && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {item.allergens?.map(a => <Badge key={a} label={a} color="red" />)}
                      {item.dietary?.map(d => <Badge key={d} label={d} color="green" />)}
                    </div>
                  )}
                  {item.calories && <p className="text-xs text-gray-400 mt-1">{item.calories} cal{item.prep_time_minutes ? ` · ${item.prep_time_minutes} min prep` : ''}</p>}
                </div>
              ))}
            </div>
            {menuItems.length === 0 && <p className="text-center text-gray-400 py-8">No menu items found</p>}
            {showAddMenuItem && <AddMenuItemModal locations={locations} onClose={() => setShowAddMenuItem(false)} onSaved={() => { setShowAddMenuItem(false); fetchMenu(); }} />}
          </div>
        )}

        {tab === 'staff' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <select className="border rounded px-3 py-1.5 text-sm" value={staffLocFilter} onChange={e => setStaffLocFilter(e.target.value)}><option value="">All Locations</option>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
              <button onClick={() => setShowAddStaff(true)} className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">+ Add Staff</button>
            </div>
            <div className="bg-white rounded-xl border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Name','Role','Location','Type','Hourly Rate','Food Safe','Serving It Right','Status'].map(h => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr></thead>
                <tbody>
                  {staff.map(s => (
                    <tr key={s.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold">{s.name}</td>
                      <td className="px-4 py-3"><Badge label={s.role} color={roleColor(s.role)} /></td>
                      <td className="px-4 py-3 text-xs">{s.location_name}</td>
                      <td className="px-4 py-3"><Badge label={s.employment_type} color="gray" /></td>
                      <td className="px-4 py-3">{s.hourly_rate ? `$${s.hourly_rate}/hr` : '—'}</td>
                      <td className="px-4 py-3">{s.food_safe_expiry ? <Badge label={fmtDate(s.food_safe_expiry)} color={expiryColor(s.food_safe_expiry)} /> : <Badge label="N/A" color="gray" />}</td>
                      <td className="px-4 py-3">{s.serving_it_right_expiry ? <Badge label={fmtDate(s.serving_it_right_expiry)} color={expiryColor(s.serving_it_right_expiry)} /> : <Badge label="N/A" color="gray" />}</td>
                      <td className="px-4 py-3"><Badge label={s.status} color={statusColor(s.status)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {staff.length === 0 && <p className="text-center text-gray-400 py-8">No staff found</p>}
            </div>
            {showAddStaff && <AddStaffModal locations={locations} onClose={() => setShowAddStaff(false)} onSaved={() => { setShowAddStaff(false); fetchStaff(); }} />}
          </div>
        )}

        {tab === 'suppliers' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <select className="border rounded px-3 py-1.5 text-sm" value={supplierCatFilter} onChange={e => setSupplierCatFilter(e.target.value)}><option value="">All Categories</option>{SUPPLIER_CATS.map(c => <option key={c}>{c.replace(/_/g,' ')}</option>)}</select>
              <button onClick={() => setShowAddSupplier(true)} className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">+ Add Supplier</button>
            </div>
            <div className="bg-white rounded-xl border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Supplier','Category','Contact','Phone','Payment Terms','Delivery Days','Min Order','Status'].map(h => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr></thead>
                <tbody>
                  {suppliers.map(s => (
                    <tr key={s.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold">{s.name}</td>
                      <td className="px-4 py-3"><Badge label={s.category||'—'} color="blue" /></td>
                      <td className="px-4 py-3">{s.contact_name || '—'}</td>
                      <td className="px-4 py-3">{s.phone || '—'}</td>
                      <td className="px-4 py-3">Net {s.payment_terms}d</td>
                      <td className="px-4 py-3 text-xs">{s.delivery_days?.join(', ') || '—'}</td>
                      <td className="px-4 py-3">{s.min_order_amount ? `$${s.min_order_amount}` : '—'}</td>
                      <td className="px-4 py-3"><Badge label={s.status} color={s.status === 'active' ? 'green' : 'gray'} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {suppliers.length === 0 && <p className="text-center text-gray-400 py-8">No suppliers found</p>}
            </div>
            {showAddSupplier && <AddSupplierModal onClose={() => setShowAddSupplier(false)} onSaved={() => { setShowAddSupplier(false); fetchSuppliers(); }} />}
          </div>
        )}

        {tab === 'ai' && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border p-5 space-y-3">
              <h3 className="font-bold text-slate-800">AI Menu Planner</h3>
              <p className="text-sm text-gray-500">Generate seasonal menu suggestions with food cost estimates for your restaurant type.</p>
              <div><label className="text-xs text-gray-500">Cuisine Type</label><input className="w-full border rounded px-3 py-2 text-sm mt-0.5" value={aiMenuForm.cuisine_type} onChange={e => setAiMenuForm(p => ({ ...p, cuisine_type: e.target.value }))} /></div>
              <div><label className="text-xs text-gray-500">Season</label><select className="w-full border rounded px-3 py-2 text-sm mt-0.5" value={aiMenuForm.season} onChange={e => setAiMenuForm(p => ({ ...p, season: e.target.value }))}><option value="">Auto-detect</option>{['Spring','Summer','Fall','Winter'].map(s => <option key={s}>{s}</option>)}</select></div>
              <div><label className="text-xs text-gray-500">Dietary Trends</label><input className="w-full border rounded px-3 py-2 text-sm mt-0.5" placeholder="vegan-friendly, gluten-free, halal…" value={aiMenuForm.dietary_trend} onChange={e => setAiMenuForm(p => ({ ...p, dietary_trend: e.target.value }))} /></div>
              <div><label className="text-xs text-gray-500">Price Point</label><input className="w-full border rounded px-3 py-2 text-sm mt-0.5" placeholder="e.g. budget under $20, mid-range $25-45…" value={aiMenuForm.price_point} onChange={e => setAiMenuForm(p => ({ ...p, price_point: e.target.value }))} /></div>
              <button onClick={runAiMenu} disabled={aiLoading || !aiMenuForm.cuisine_type} className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">{aiLoading ? 'Generating menu…' : 'Generate Seasonal Menu'}</button>
            </div>
            <div className="bg-white rounded-xl border p-5">
              <h3 className="font-bold text-slate-800 mb-3">Seasonal Menu Proposal</h3>
              {aiLoading && <div className="text-center text-gray-400 py-8"><div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2" /><p>Creating seasonal menu…</p></div>}
              {aiMenu && !aiLoading && <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{aiMenu}</div>}
              {!aiMenu && !aiLoading && <p className="text-gray-400 text-sm">Fill in the form to generate a seasonal menu proposal with food cost estimates.</p>}
            </div>
          </div>
        )}

        {tab === 'compliance' && compliance && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border p-4">
              <h3 className="font-semibold text-slate-800 mb-3">Locations — Licenses & Inspections</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Location','Manager','Liquor License Expiry','Last Health Inspection','Score','Inspection Due'].map(h => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr></thead>
                  <tbody>
                    {(compliance.locations as Location[]).map((loc: Location) => {
                      const inspDue = daysUntil(loc.health_inspection_date) < -180;
                      return (
                        <tr key={loc.id} className="border-t">
                          <td className="px-4 py-3 font-semibold">{loc.name}</td>
                          <td className="px-4 py-3">{loc.manager_name || '—'}</td>
                          <td className="px-4 py-3">{loc.liquor_license_expiry ? <Badge label={fmtDate(loc.liquor_license_expiry)} color={expiryColor(loc.liquor_license_expiry)} /> : <Badge label="N/A" color="gray" />}</td>
                          <td className="px-4 py-3">{fmtDate(loc.health_inspection_date)}</td>
                          <td className="px-4 py-3">{loc.health_inspection_score ? <Badge label={String(loc.health_inspection_score)} color={Number(loc.health_inspection_score) >= 90 ? 'green' : Number(loc.health_inspection_score) >= 80 ? 'amber' : 'red'} /> : '—'}</td>
                          <td className="px-4 py-3">{inspDue ? <Badge label="OVERDUE" color="red" /> : <Badge label="Current" color="green" />}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <h3 className="font-semibold text-slate-800 mb-3">Staff — Expiring Certifications (&lt;60 days)</h3>
              {compliance.staff.length === 0 ? <p className="text-green-600 text-sm">All staff certifications are current.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Staff','Role','Location','Food Safe Expiry','Serving It Right Expiry'].map(h => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr></thead>
                    <tbody>
                      {(compliance.staff as Staff[]).map((s: Staff) => (
                        <tr key={s.id} className="border-t">
                          <td className="px-4 py-3 font-semibold">{s.name}</td>
                          <td className="px-4 py-3"><Badge label={s.role} color={roleColor(s.role)} /></td>
                          <td className="px-4 py-3 text-xs">{s.location_name}</td>
                          <td className="px-4 py-3">{s.food_safe_expiry ? <Badge label={fmtDate(s.food_safe_expiry)} color={expiryColor(s.food_safe_expiry)} /> : <Badge label="N/A" color="gray" />}</td>
                          <td className="px-4 py-3">{s.serving_it_right_expiry ? <Badge label={fmtDate(s.serving_it_right_expiry)} color={expiryColor(s.serving_it_right_expiry)} /> : <Badge label="N/A" color="gray" />}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <h3 className="font-semibold text-amber-800 mb-2">Alberta Health Services — Inspection Reference</h3>
              <div className="grid md:grid-cols-3 gap-4 text-sm text-amber-700">
                <div><p className="font-medium mb-1">Inspection Categories</p><ul className="space-y-0.5 list-disc list-inside text-xs"><li>Critical — foodborne illness risk</li><li>Non-critical — hygiene standards</li><li>Structural — facility maintenance</li></ul></div>
                <div><p className="font-medium mb-1">Critical Infractions</p><ul className="space-y-0.5 list-disc list-inside text-xs"><li>Improper food temperature control</li><li>Cross-contamination between raw/cooked</li><li>No effective handwashing station</li><li>Rodent/pest activity evidence</li><li>Staff illness exclusion failures</li></ul></div>
                <div><p className="font-medium mb-1">Compliance Reminders</p><ul className="space-y-0.5 list-disc list-inside text-xs"><li>Food Safe Level 1 — all food handlers</li><li>Serving It Right — all liquor servers</li><li>Liquor license renewal — 60 days advance</li><li>Health inspection — announce/unannounced</li><li>HACCP plan — update annually</li></ul></div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
