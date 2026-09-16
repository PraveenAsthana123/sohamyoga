'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard','events','menu','expenses','compliance','ai-tools'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = {
  'dashboard': 'Dashboard', 'events': 'Events', 'menu': 'Menu Builder',
  'expenses': 'Expenses', 'compliance': 'Compliance', 'ai-tools': 'AI Tools',
};

const CUISINES = ['mexican','asian_fusion','bbq','pizza','burgers','indian','greek','thai','japanese','canadian','desserts','coffee','breakfast','vegan','other'];
const VEHICLE_TYPES = ['truck','trailer','cart','van','bus'];
const EVENT_TYPES = ['street_vending','festival','private_catering','corporate_lunch','farmers_market','food_truck_rally','wedding','birthday','other'];
const EVENT_STATUSES = ['scheduled','confirmed','in_progress','completed','cancelled','rained_out'];
const MENU_CATEGORIES = ['main','side','drink','dessert','combo','special'];
const EXPENSE_CATEGORIES = ['food_supplies','propane_fuel','vehicle_fuel','permits','commissary','staff_wages','maintenance','marketing','insurance','other'];

interface Truck { id: number; truck_name: string; cuisine_type: string; vehicle_type: string; license_plate: string; permit_expiry: string; business_license_expiry: string; fire_extinguisher_expiry: string; insurance_expiry: string; capacity_servings_per_hour: number; is_active: boolean; permit_days: number; license_days: number; fire_days: number; insurance_days: number; }
interface FoodEvent { id: number; truck_id: number; truck_name: string; event_name: string; event_type: string; event_date: string; start_time: string; end_time: string; location: string; expected_customers: number; actual_customers: number; gross_revenue: number; cogs: number; net_revenue: number; margin_pct: number; status: string; staff_count: number; location_permit_required: boolean; location_permit_obtained: boolean; }
interface MenuItem { id: number; truck_id: number; truck_name: string; name: string; description: string; category: string; price: number; food_cost: number; food_cost_pct: number; is_active: boolean; is_seasonal: boolean; dietary_tags: string[]; allergens: string[]; }
interface Expense { id: number; truck_id: number; truck_name: string; event_id: number; event_name: string; expense_date: string; category: string; description: string; amount: number; vendor: string; }
interface DashData { events_this_month: number; revenue_mtd: number; best_event: { event_name: string; gross_revenue: number } | null; avg_food_cost_pct: number; permits_expiring_60d: number; }

function fmtCad(n: number) { return `$${Number(n ?? 0).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString('en-CA') : '—'; }

function expiryColor(days: number | null) {
  if (days === null || days === undefined) return 'text-gray-400';
  if (days < 0) return 'text-red-700 font-bold';
  if (days < 30) return 'text-red-600 font-semibold';
  if (days < 60) return 'text-amber-600 font-semibold';
  return 'text-green-600';
}

function expiryBg(days: number | null) {
  if (days === null || days === undefined) return 'bg-gray-50';
  if (days < 0) return 'bg-red-50 border border-red-200';
  if (days < 30) return 'bg-red-50 border border-red-200';
  if (days < 60) return 'bg-amber-50 border border-amber-200';
  return 'bg-green-50 border border-green-200';
}

function foodCostColor(pct: number) {
  if (pct === 0) return 'text-gray-400';
  if (pct > 40) return 'text-red-600 font-semibold';
  if (pct > 30) return 'text-amber-600 font-semibold';
  return 'text-green-600 font-semibold';
}

function Badge({ label, cls = 'bg-gray-100 text-gray-700' }: { label: string; cls?: string }) {
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{label}</span>;
}
function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const borders: Record<string, string> = { blue: 'border-l-4 border-blue-500 bg-blue-50', green: 'border-l-4 border-green-500 bg-green-50', amber: 'border-l-4 border-amber-500 bg-amber-50', red: 'border-l-4 border-red-500 bg-red-50', purple: 'border-l-4 border-purple-500 bg-purple-50' };
  return (
    <div className={`rounded-lg p-4 ${borders[color] ?? borders.blue}`}>
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl font-bold">×</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="mb-3"><label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>{children}</div>;
}
const inp = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
const sel = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

export default function FoodTruckPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [dash, setDash] = useState<DashData | null>(null);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [events, setEvents] = useState<FoodEvent[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [permitTrucks, setPermitTrucks] = useState<Truck[]>([]);

  const [truckFilter, setTruckFilter] = useState('');
  const [eventStatusFilter, setEventStatusFilter] = useState('');
  const [menuTruckFilter, setMenuTruckFilter] = useState('');
  const [menuCatFilter, setMenuCatFilter] = useState('');

  const [showTruckModal, setShowTruckModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [completeEvent, setCompleteEvent] = useState<FoodEvent | null>(null);

  const [truckForm, setTruckForm] = useState<Record<string,string>>({ truck_name:'',cuisine_type:'mexican',vehicle_type:'truck',license_plate:'',commissary_kitchen:'',alberta_health_permit_number:'',permit_expiry:'',calgary_business_license:'',business_license_expiry:'',fire_extinguisher_expiry:'',insurance_expiry:'',capacity_servings_per_hour:'60' });
  const [eventForm, setEventForm] = useState<Record<string,string>>({ truck_id:'',event_name:'',event_type:'street_vending',event_date:'',start_time:'',end_time:'',location:'',expected_customers:'',staff_count:'2' });
  const [menuForm, setMenuForm] = useState<Record<string,string>>({ truck_id:'',name:'',description:'',category:'main',price:'',food_cost:'',dietary_tags:'' });
  const [expenseForm, setExpenseForm] = useState<Record<string,string>>({ truck_id:'',event_id:'',expense_date:'',category:'food_supplies',description:'',amount:'',vendor:'' });
  const [completeForm, setCompleteForm] = useState({ actual_customers:'',gross_revenue:'',cogs:'',weather_notes:'' });

  const [aiMenuForm, setAiMenuForm] = useState({ cuisine_type:'mexican',truck_name:'' });
  const [aiPitchForm, setAiPitchForm] = useState({ event_name:'',event_type:'festival',expected_customers:'',cuisine_type:'mexican',truck_name:'',capacity_servings_per_hour:'60' });
  const [aiMenu, setAiMenu] = useState('');
  const [aiPitch, setAiPitch] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  const loadDash = useCallback(async () => { const r = await fetch('/api/admin/food-truck'); if (r.ok) setDash(await r.json()); }, []);
  const loadTrucks = useCallback(async () => { const r = await fetch('/api/admin/food-truck/trucks?is_active=true'); if (r.ok) { const d = await r.json(); setTrucks(d.trucks); } }, []);
  const loadEvents = useCallback(async () => {
    const params = new URLSearchParams();
    if (truckFilter) params.set('truck_id', truckFilter);
    if (eventStatusFilter) params.set('status', eventStatusFilter);
    const r = await fetch(`/api/admin/food-truck/events?${params}`);
    if (r.ok) { const d = await r.json(); setEvents(d.events); }
  }, [truckFilter, eventStatusFilter]);
  const loadMenu = useCallback(async () => {
    const params = new URLSearchParams();
    if (menuTruckFilter) params.set('truck_id', menuTruckFilter);
    if (menuCatFilter) params.set('category', menuCatFilter);
    const r = await fetch(`/api/admin/food-truck/menu?${params}`);
    if (r.ok) { const d = await r.json(); setMenuItems(d.items); }
  }, [menuTruckFilter, menuCatFilter]);
  const loadExpenses = useCallback(async () => { const r = await fetch('/api/admin/food-truck/expenses'); if (r.ok) { const d = await r.json(); setExpenses(d.expenses); } }, []);
  const loadPermits = useCallback(async () => { const r = await fetch('/api/admin/food-truck/permits-check'); if (r.ok) { const d = await r.json(); setPermitTrucks(d.trucks_with_expiries); } }, []);

  useEffect(() => { loadDash(); loadTrucks(); }, [loadDash, loadTrucks]);
  useEffect(() => { if (tab === 'events') loadEvents(); }, [tab, loadEvents]);
  useEffect(() => { if (tab === 'menu') loadMenu(); }, [tab, loadMenu]);
  useEffect(() => { if (tab === 'expenses') loadExpenses(); }, [tab, loadExpenses]);
  useEffect(() => { if (tab === 'compliance') loadPermits(); }, [tab, loadPermits]);

  async function addTruck() {
    setLoading(true);
    const r = await fetch('/api/admin/food-truck/trucks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...truckForm, capacity_servings_per_hour: Number(truckForm.capacity_servings_per_hour) }) });
    setLoading(false);
    if (r.ok) { setShowTruckModal(false); loadTrucks(); loadDash(); flash('Truck added'); }
    else { const e = await r.json(); flash(e.error || 'Error'); }
  }
  async function addEvent() {
    setLoading(true);
    const r = await fetch('/api/admin/food-truck/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...eventForm, truck_id: Number(eventForm.truck_id), expected_customers: eventForm.expected_customers ? Number(eventForm.expected_customers) : null, staff_count: Number(eventForm.staff_count) }) });
    setLoading(false);
    if (r.ok) { setShowEventModal(false); loadEvents(); loadDash(); flash('Event added'); }
    else { const e = await r.json(); flash(e.error || 'Error'); }
  }
  async function addMenuItem() {
    setLoading(true);
    const dietary_tags = menuForm.dietary_tags ? menuForm.dietary_tags.split(',').map(s => s.trim()) : [];
    const r = await fetch('/api/admin/food-truck/menu', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...menuForm, truck_id: Number(menuForm.truck_id), price: Number(menuForm.price), food_cost: menuForm.food_cost ? Number(menuForm.food_cost) : null, dietary_tags }) });
    setLoading(false);
    if (r.ok) { setShowMenuModal(false); loadMenu(); flash('Menu item added'); }
    else { const e = await r.json(); flash(e.error || 'Error'); }
  }
  async function addExpense() {
    setLoading(true);
    const r = await fetch('/api/admin/food-truck/expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...expenseForm, truck_id: Number(expenseForm.truck_id), event_id: expenseForm.event_id ? Number(expenseForm.event_id) : null, amount: Number(expenseForm.amount) }) });
    setLoading(false);
    if (r.ok) { setShowExpenseModal(false); loadExpenses(); flash('Expense added'); }
    else { const e = await r.json(); flash(e.error || 'Error'); }
  }
  async function completeEventSubmit() {
    if (!completeEvent) return;
    const r = await fetch(`/api/admin/food-truck/events/${completeEvent.id}/complete`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actual_customers: Number(completeForm.actual_customers), gross_revenue: Number(completeForm.gross_revenue), cogs: Number(completeForm.cogs), weather_notes: completeForm.weather_notes }),
    });
    if (r.ok) { setCompleteEvent(null); loadEvents(); loadDash(); flash('Event completed'); }
  }
  async function toggleMenuActive(item: MenuItem) {
    await fetch(`/api/admin/food-truck/menu/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !item.is_active }) });
    loadMenu();
  }
  async function genMenu() {
    setAiLoading(true); setAiMenu('');
    const r = await fetch('/api/admin/food-truck/ai-menu', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(aiMenuForm) });
    setAiLoading(false);
    if (r.ok) { const d = await r.json(); setAiMenu(d.menu); }
  }
  async function genPitch() {
    setAiLoading(true); setAiPitch('');
    const r = await fetch('/api/admin/food-truck/ai-event-pitch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...aiPitchForm, expected_customers: aiPitchForm.expected_customers ? Number(aiPitchForm.expected_customers) : null, capacity_servings_per_hour: Number(aiPitchForm.capacity_servings_per_hour) }) });
    setAiLoading(false);
    if (r.ok) { const d = await r.json(); setAiPitch(d.pitch); }
  }

  const statusColor: Record<string,string> = { scheduled:'bg-blue-100 text-blue-700', confirmed:'bg-green-100 text-green-700', in_progress:'bg-amber-100 text-amber-800', completed:'bg-gray-100 text-gray-700', cancelled:'bg-red-100 text-red-700', rained_out:'bg-purple-100 text-purple-700' };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-800">Food Truck &amp; Mobile Vendor Hub</h1>
        <p className="text-sm text-gray-500">Events · Menu · Expenses · Compliance · AI Tools — Calgary, Alberta</p>
      </div>
      {msg && <div className="mx-6 mt-3 px-4 py-2 bg-green-100 text-green-800 rounded text-sm">{msg}</div>}
      <div className="border-b bg-white">
        <div className="flex overflow-x-auto px-6">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {/* DASHBOARD */}
        {tab === 'dashboard' && dash && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard label="Events This Month" value={dash.events_this_month} color="blue" />
              <KpiCard label="Revenue MTD" value={fmtCad(dash.revenue_mtd)} color="green" />
              <KpiCard label="Avg Food Cost %" value={`${dash.avg_food_cost_pct}%`} sub="across active menu" color={dash.avg_food_cost_pct > 35 ? 'red' : 'green'} />
              <KpiCard label="Permits Expiring (60d)" value={dash.permits_expiring_60d} color={dash.permits_expiring_60d > 0 ? 'amber' : 'green'} />
            </div>
            {dash.best_event && (
              <div className="bg-white rounded-xl shadow p-5">
                <h2 className="font-semibold text-gray-700 mb-1">Best Event (All Time)</h2>
                <p className="text-xl font-bold text-green-600">{fmtCad(dash.best_event.gross_revenue)}</p>
                <p className="text-sm text-gray-500">{dash.best_event.event_name}</p>
              </div>
            )}
            <div className="bg-white rounded-xl shadow p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-gray-700">Active Trucks</h2>
                <button onClick={() => setShowTruckModal(true)} className="text-sm px-3 py-1 bg-orange-500 text-white rounded">+ Add Truck</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {trucks.map(t => (
                  <div key={t.id} className="border rounded-lg p-3">
                    <p className="font-semibold text-gray-800">{t.truck_name}</p>
                    <Badge label={t.cuisine_type.replace('_',' ')} cls="bg-orange-100 text-orange-700 mt-1" />
                    <p className="text-xs text-gray-500 mt-1">{t.capacity_servings_per_hour} servings/hr · {t.vehicle_type}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* EVENTS */}
        {tab === 'events' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div className="flex gap-2">
                <select value={truckFilter} onChange={e => setTruckFilter(e.target.value)} className={`${sel} w-44`}>
                  <option value="">All Trucks</option>
                  {trucks.map(t => <option key={t.id} value={String(t.id)}>{t.truck_name}</option>)}
                </select>
                <select value={eventStatusFilter} onChange={e => setEventStatusFilter(e.target.value)} className={`${sel} w-36`}>
                  <option value="">All Statuses</option>
                  {EVENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button onClick={loadEvents} className="px-3 py-2 bg-blue-600 text-white rounded text-sm">Filter</button>
              </div>
              <button onClick={() => setShowEventModal(true)} className="px-4 py-2 bg-orange-500 text-white rounded text-sm font-medium">+ Add Event</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {events.map(ev => (
                <div key={ev.id} className="bg-white rounded-xl shadow p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-gray-800 text-sm">{ev.event_name}</h3>
                    <Badge label={ev.status} cls={statusColor[ev.status] ?? 'bg-gray-100 text-gray-600'} />
                  </div>
                  <p className="text-xs text-gray-500">{ev.truck_name} · {ev.event_type.replace('_',' ')}</p>
                  <p className="text-xs text-gray-500">{fmtDate(ev.event_date)} {ev.start_time}–{ev.end_time}</p>
                  <p className="text-xs text-gray-500">{ev.location}</p>
                  {ev.location_permit_required && !ev.location_permit_obtained && (
                    <Badge label="Permit Needed" cls="bg-red-100 text-red-700 mt-1" />
                  )}
                  {ev.gross_revenue != null && (
                    <div className="mt-2 pt-2 border-t text-sm">
                      <p className="text-green-700 font-semibold">{fmtCad(ev.gross_revenue)} gross</p>
                      {ev.net_revenue != null && <p className="text-gray-500">Net: {fmtCad(ev.net_revenue)} ({ev.margin_pct}%)</p>}
                      {ev.actual_customers && <p className="text-gray-500">{ev.actual_customers} customers</p>}
                    </div>
                  )}
                  {(ev.status === 'confirmed' || ev.status === 'in_progress') && (
                    <button onClick={() => { setCompleteEvent(ev); setCompleteForm({ actual_customers:'', gross_revenue:'', cogs:'', weather_notes:'' }); }} className="mt-2 w-full text-xs py-1 bg-green-600 text-white rounded">Complete Event</button>
                  )}
                </div>
              ))}
              {!events.length && <p className="text-gray-400 col-span-3">No events found</p>}
            </div>
          </div>
        )}

        {/* MENU */}
        {tab === 'menu' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div className="flex gap-2">
                <select value={menuTruckFilter} onChange={e => setMenuTruckFilter(e.target.value)} className={`${sel} w-44`}>
                  <option value="">All Trucks</option>
                  {trucks.map(t => <option key={t.id} value={String(t.id)}>{t.truck_name}</option>)}
                </select>
                <select value={menuCatFilter} onChange={e => setMenuCatFilter(e.target.value)} className={`${sel} w-32`}>
                  <option value="">All Categories</option>
                  {MENU_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <button onClick={loadMenu} className="px-3 py-2 bg-blue-600 text-white rounded text-sm">Filter</button>
              </div>
              <button onClick={() => setShowMenuModal(true)} className="px-4 py-2 bg-orange-500 text-white rounded text-sm font-medium">+ Add Item</button>
            </div>
            <div className="bg-white rounded-xl shadow overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>{['Name','Truck','Category','Price','Food Cost','Food Cost %','Dietary Tags','Active','Action'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {menuItems.map(item => (
                    <tr key={item.id} className={`border-b hover:bg-gray-50 ${!item.is_active ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3 font-medium">{item.name}{item.is_seasonal && <Badge label="Seasonal" cls="bg-purple-100 text-purple-700 ml-1" />}</td>
                      <td className="px-4 py-3 text-gray-500">{item.truck_name}</td>
                      <td className="px-4 py-3"><Badge label={item.category} cls="bg-orange-100 text-orange-700" /></td>
                      <td className="px-4 py-3 font-semibold">{fmtCad(item.price)}</td>
                      <td className="px-4 py-3 text-gray-500">{item.food_cost ? fmtCad(item.food_cost) : '—'}</td>
                      <td className={`px-4 py-3 ${foodCostColor(item.food_cost_pct)}`}>{item.food_cost_pct ? `${Number(item.food_cost_pct).toFixed(1)}%` : '—'}</td>
                      <td className="px-4 py-3">{(item.dietary_tags || []).map(t => <Badge key={t} label={t} cls="bg-green-100 text-green-700 mr-1" />)}</td>
                      <td className="px-4 py-3"><span className={`inline-block w-3 h-3 rounded-full ${item.is_active ? 'bg-green-500' : 'bg-gray-300'}`} /></td>
                      <td className="px-4 py-3">
                        <button onClick={() => toggleMenuActive(item)} className="text-xs px-2 py-1 border rounded text-gray-600 hover:bg-gray-50">{item.is_active ? 'Deactivate' : 'Activate'}</button>
                      </td>
                    </tr>
                  ))}
                  {!menuItems.length && <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No menu items found</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* EXPENSES */}
        {tab === 'expenses' && (
          <div className="space-y-4">
            <div className="flex justify-between">
              <h2 className="text-lg font-semibold text-gray-700">Expense Tracking</h2>
              <button onClick={() => setShowExpenseModal(true)} className="px-4 py-2 bg-orange-500 text-white rounded text-sm font-medium">+ Add Expense</button>
            </div>
            <div className="bg-white rounded-xl shadow overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>{['Date','Truck','Event','Category','Description','Amount','Vendor'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {expenses.map(ex => (
                    <tr key={ex.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500">{fmtDate(ex.expense_date)}</td>
                      <td className="px-4 py-3">{ex.truck_name}</td>
                      <td className="px-4 py-3 text-gray-500">{ex.event_name || '—'}</td>
                      <td className="px-4 py-3"><Badge label={ex.category.replace('_',' ')} cls="bg-amber-100 text-amber-700" /></td>
                      <td className="px-4 py-3">{ex.description}</td>
                      <td className="px-4 py-3 font-semibold text-red-600">{fmtCad(ex.amount)}</td>
                      <td className="px-4 py-3 text-gray-500">{ex.vendor || '—'}</td>
                    </tr>
                  ))}
                  {!expenses.length && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No expenses found</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* COMPLIANCE */}
        {tab === 'compliance' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-700">Permit &amp; Compliance Dashboard</h2>
            <p className="text-sm text-gray-500">Trucks with any permit/license expiring within 60 days.</p>
            {permitTrucks.length === 0 ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                <p className="text-green-700 font-semibold">All permits are current beyond 60 days!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {permitTrucks.map(t => (
                  <div key={t.id} className="bg-white rounded-xl shadow p-5">
                    <h3 className="font-semibold text-gray-800 mb-3">{t.truck_name}</h3>
                    <div className="space-y-2 text-sm">
                      {t.permit_expiry && (
                        <div className={`flex justify-between px-3 py-2 rounded ${expiryBg(t.permit_days)}`}>
                          <span>Alberta Health Permit</span>
                          <span className={expiryColor(t.permit_days)}>{fmtDate(t.permit_expiry)} ({t.permit_days}d)</span>
                        </div>
                      )}
                      {t.business_license_expiry && (
                        <div className={`flex justify-between px-3 py-2 rounded ${expiryBg(t.license_days)}`}>
                          <span>Business License</span>
                          <span className={expiryColor(t.license_days)}>{fmtDate(t.business_license_expiry)} ({t.license_days}d)</span>
                        </div>
                      )}
                      {t.fire_extinguisher_expiry && (
                        <div className={`flex justify-between px-3 py-2 rounded ${expiryBg(t.fire_days)}`}>
                          <span>Fire Extinguisher</span>
                          <span className={expiryColor(t.fire_days)}>{fmtDate(t.fire_extinguisher_expiry)} ({t.fire_days}d)</span>
                        </div>
                      )}
                      {t.insurance_expiry && (
                        <div className={`flex justify-between px-3 py-2 rounded ${expiryBg(t.insurance_days)}`}>
                          <span>Insurance</span>
                          <span className={expiryColor(t.insurance_days)}>{fmtDate(t.insurance_expiry)} ({t.insurance_days}d)</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* AI TOOLS */}
        {tab === 'ai-tools' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow p-5">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">AI Menu Creator</h2>
              <FormRow label="Cuisine Type">
                <select value={aiMenuForm.cuisine_type} onChange={e => setAiMenuForm(f => ({ ...f, cuisine_type: e.target.value }))} className={sel}>
                  {CUISINES.map(c => <option key={c} value={c}>{c.replace('_',' ')}</option>)}
                </select>
              </FormRow>
              <FormRow label="Truck Name (optional)">
                <input value={aiMenuForm.truck_name} onChange={e => setAiMenuForm(f => ({ ...f, truck_name: e.target.value }))} className={inp} />
              </FormRow>
              <button onClick={genMenu} disabled={aiLoading} className="w-full py-2 bg-orange-500 text-white rounded font-medium text-sm disabled:opacity-50">
                {aiLoading ? 'Generating...' : 'Generate Menu'}
              </button>
              {aiMenu && (
                <div className="mt-4">
                  <div className="flex justify-between mb-2"><p className="text-xs font-medium text-gray-500">Generated Menu</p><button onClick={() => navigator.clipboard.writeText(aiMenu)} className="text-xs text-blue-600">Copy</button></div>
                  <textarea readOnly value={aiMenu} className="w-full h-56 border rounded p-3 text-sm text-gray-700 bg-gray-50" />
                </div>
              )}
            </div>
            <div className="bg-white rounded-xl shadow p-5">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Event Booking Pitch Generator</h2>
              <FormRow label="Event Name"><input value={aiPitchForm.event_name} onChange={e => setAiPitchForm(f => ({ ...f, event_name: e.target.value }))} className={inp} /></FormRow>
              <FormRow label="Event Type">
                <select value={aiPitchForm.event_type} onChange={e => setAiPitchForm(f => ({ ...f, event_type: e.target.value }))} className={sel}>
                  {EVENT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
                </select>
              </FormRow>
              <FormRow label="Expected Attendees"><input type="number" value={aiPitchForm.expected_customers} onChange={e => setAiPitchForm(f => ({ ...f, expected_customers: e.target.value }))} className={inp} /></FormRow>
              <FormRow label="Cuisine Type">
                <select value={aiPitchForm.cuisine_type} onChange={e => setAiPitchForm(f => ({ ...f, cuisine_type: e.target.value }))} className={sel}>
                  {CUISINES.map(c => <option key={c} value={c}>{c.replace('_',' ')}</option>)}
                </select>
              </FormRow>
              <FormRow label="Truck Name"><input value={aiPitchForm.truck_name} onChange={e => setAiPitchForm(f => ({ ...f, truck_name: e.target.value }))} className={inp} /></FormRow>
              <button onClick={genPitch} disabled={aiLoading} className="w-full py-2 bg-blue-600 text-white rounded font-medium text-sm disabled:opacity-50">
                {aiLoading ? 'Generating...' : 'Generate Booking Pitch'}
              </button>
              {aiPitch && (
                <div className="mt-4">
                  <div className="flex justify-between mb-2"><p className="text-xs font-medium text-gray-500">Generated Pitch</p><button onClick={() => navigator.clipboard.writeText(aiPitch)} className="text-xs text-blue-600">Copy</button></div>
                  <textarea readOnly value={aiPitch} className="w-full h-56 border rounded p-3 text-sm text-gray-700 bg-gray-50" />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODALS */}
      {showTruckModal && (
        <Modal title="Add Food Truck" onClose={() => setShowTruckModal(false)}>
          <FormRow label="Truck Name *"><input value={truckForm.truck_name} onChange={e => setTruckForm(f => ({ ...f, truck_name: e.target.value }))} className={inp} /></FormRow>
          <div className="grid grid-cols-2 gap-2">
            <FormRow label="Cuisine Type *">
              <select value={truckForm.cuisine_type} onChange={e => setTruckForm(f => ({ ...f, cuisine_type: e.target.value }))} className={sel}>
                {CUISINES.map(c => <option key={c} value={c}>{c.replace('_',' ')}</option>)}
              </select>
            </FormRow>
            <FormRow label="Vehicle Type">
              <select value={truckForm.vehicle_type} onChange={e => setTruckForm(f => ({ ...f, vehicle_type: e.target.value }))} className={sel}>
                {VEHICLE_TYPES.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </FormRow>
          </div>
          <FormRow label="License Plate"><input value={truckForm.license_plate} onChange={e => setTruckForm(f => ({ ...f, license_plate: e.target.value }))} className={inp} /></FormRow>
          <FormRow label="Commissary Kitchen"><input value={truckForm.commissary_kitchen} onChange={e => setTruckForm(f => ({ ...f, commissary_kitchen: e.target.value }))} className={inp} /></FormRow>
          <FormRow label="Alberta Health Permit #"><input value={truckForm.alberta_health_permit_number} onChange={e => setTruckForm(f => ({ ...f, alberta_health_permit_number: e.target.value }))} className={inp} /></FormRow>
          <div className="grid grid-cols-2 gap-2">
            <FormRow label="Permit Expiry"><input type="date" value={truckForm.permit_expiry} onChange={e => setTruckForm(f => ({ ...f, permit_expiry: e.target.value }))} className={inp} /></FormRow>
            <FormRow label="Business License Expiry"><input type="date" value={truckForm.business_license_expiry} onChange={e => setTruckForm(f => ({ ...f, business_license_expiry: e.target.value }))} className={inp} /></FormRow>
            <FormRow label="Fire Ext. Expiry"><input type="date" value={truckForm.fire_extinguisher_expiry} onChange={e => setTruckForm(f => ({ ...f, fire_extinguisher_expiry: e.target.value }))} className={inp} /></FormRow>
            <FormRow label="Insurance Expiry"><input type="date" value={truckForm.insurance_expiry} onChange={e => setTruckForm(f => ({ ...f, insurance_expiry: e.target.value }))} className={inp} /></FormRow>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={addTruck} disabled={loading} className="flex-1 py-2 bg-orange-500 text-white rounded text-sm font-medium disabled:opacity-50">{loading ? 'Saving...' : 'Add Truck'}</button>
            <button onClick={() => setShowTruckModal(false)} className="flex-1 py-2 border text-gray-600 rounded text-sm">Cancel</button>
          </div>
        </Modal>
      )}

      {showEventModal && (
        <Modal title="Add Event" onClose={() => setShowEventModal(false)}>
          <FormRow label="Truck *">
            <select value={eventForm.truck_id} onChange={e => setEventForm(f => ({ ...f, truck_id: e.target.value }))} className={sel}>
              <option value="">Select truck...</option>
              {trucks.map(t => <option key={t.id} value={String(t.id)}>{t.truck_name}</option>)}
            </select>
          </FormRow>
          <FormRow label="Event Name *"><input value={eventForm.event_name} onChange={e => setEventForm(f => ({ ...f, event_name: e.target.value }))} className={inp} /></FormRow>
          <div className="grid grid-cols-2 gap-2">
            <FormRow label="Event Type">
              <select value={eventForm.event_type} onChange={e => setEventForm(f => ({ ...f, event_type: e.target.value }))} className={sel}>
                {EVENT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
              </select>
            </FormRow>
            <FormRow label="Event Date *"><input type="date" value={eventForm.event_date} onChange={e => setEventForm(f => ({ ...f, event_date: e.target.value }))} className={inp} /></FormRow>
            <FormRow label="Start Time *"><input type="time" value={eventForm.start_time} onChange={e => setEventForm(f => ({ ...f, start_time: e.target.value }))} className={inp} /></FormRow>
            <FormRow label="End Time *"><input type="time" value={eventForm.end_time} onChange={e => setEventForm(f => ({ ...f, end_time: e.target.value }))} className={inp} /></FormRow>
          </div>
          <FormRow label="Location *"><input value={eventForm.location} onChange={e => setEventForm(f => ({ ...f, location: e.target.value }))} className={inp} /></FormRow>
          <FormRow label="Expected Customers"><input type="number" value={eventForm.expected_customers} onChange={e => setEventForm(f => ({ ...f, expected_customers: e.target.value }))} className={inp} /></FormRow>
          <div className="flex gap-2 mt-4">
            <button onClick={addEvent} disabled={loading} className="flex-1 py-2 bg-orange-500 text-white rounded text-sm font-medium disabled:opacity-50">{loading ? 'Saving...' : 'Add Event'}</button>
            <button onClick={() => setShowEventModal(false)} className="flex-1 py-2 border text-gray-600 rounded text-sm">Cancel</button>
          </div>
        </Modal>
      )}

      {showMenuModal && (
        <Modal title="Add Menu Item" onClose={() => setShowMenuModal(false)}>
          <FormRow label="Truck *">
            <select value={menuForm.truck_id} onChange={e => setMenuForm(f => ({ ...f, truck_id: e.target.value }))} className={sel}>
              <option value="">Select truck...</option>
              {trucks.map(t => <option key={t.id} value={String(t.id)}>{t.truck_name}</option>)}
            </select>
          </FormRow>
          <FormRow label="Item Name *"><input value={menuForm.name} onChange={e => setMenuForm(f => ({ ...f, name: e.target.value }))} className={inp} /></FormRow>
          <FormRow label="Description"><input value={menuForm.description} onChange={e => setMenuForm(f => ({ ...f, description: e.target.value }))} className={inp} /></FormRow>
          <div className="grid grid-cols-3 gap-2">
            <FormRow label="Category">
              <select value={menuForm.category} onChange={e => setMenuForm(f => ({ ...f, category: e.target.value }))} className={sel}>
                {MENU_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </FormRow>
            <FormRow label="Price ($) *"><input type="number" step="0.01" value={menuForm.price} onChange={e => setMenuForm(f => ({ ...f, price: e.target.value }))} className={inp} /></FormRow>
            <FormRow label="Food Cost ($)"><input type="number" step="0.01" value={menuForm.food_cost} onChange={e => setMenuForm(f => ({ ...f, food_cost: e.target.value }))} className={inp} /></FormRow>
          </div>
          <FormRow label="Dietary Tags (comma separated)"><input value={menuForm.dietary_tags} onChange={e => setMenuForm(f => ({ ...f, dietary_tags: e.target.value }))} className={inp} placeholder="vegan, GF, halal" /></FormRow>
          <div className="flex gap-2 mt-4">
            <button onClick={addMenuItem} disabled={loading} className="flex-1 py-2 bg-orange-500 text-white rounded text-sm font-medium disabled:opacity-50">{loading ? 'Saving...' : 'Add Item'}</button>
            <button onClick={() => setShowMenuModal(false)} className="flex-1 py-2 border text-gray-600 rounded text-sm">Cancel</button>
          </div>
        </Modal>
      )}

      {showExpenseModal && (
        <Modal title="Add Expense" onClose={() => setShowExpenseModal(false)}>
          <FormRow label="Truck *">
            <select value={expenseForm.truck_id} onChange={e => setExpenseForm(f => ({ ...f, truck_id: e.target.value }))} className={sel}>
              <option value="">Select truck...</option>
              {trucks.map(t => <option key={t.id} value={String(t.id)}>{t.truck_name}</option>)}
            </select>
          </FormRow>
          <FormRow label="Category *">
            <select value={expenseForm.category} onChange={e => setExpenseForm(f => ({ ...f, category: e.target.value }))} className={sel}>
              {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g,' ')}</option>)}
            </select>
          </FormRow>
          <FormRow label="Description *"><input value={expenseForm.description} onChange={e => setExpenseForm(f => ({ ...f, description: e.target.value }))} className={inp} /></FormRow>
          <div className="grid grid-cols-2 gap-2">
            <FormRow label="Amount ($) *"><input type="number" step="0.01" value={expenseForm.amount} onChange={e => setExpenseForm(f => ({ ...f, amount: e.target.value }))} className={inp} /></FormRow>
            <FormRow label="Date"><input type="date" value={expenseForm.expense_date} onChange={e => setExpenseForm(f => ({ ...f, expense_date: e.target.value }))} className={inp} /></FormRow>
          </div>
          <FormRow label="Vendor"><input value={expenseForm.vendor} onChange={e => setExpenseForm(f => ({ ...f, vendor: e.target.value }))} className={inp} /></FormRow>
          <div className="flex gap-2 mt-4">
            <button onClick={addExpense} disabled={loading} className="flex-1 py-2 bg-orange-500 text-white rounded text-sm font-medium disabled:opacity-50">{loading ? 'Saving...' : 'Add Expense'}</button>
            <button onClick={() => setShowExpenseModal(false)} className="flex-1 py-2 border text-gray-600 rounded text-sm">Cancel</button>
          </div>
        </Modal>
      )}

      {completeEvent && (
        <Modal title={`Complete: ${completeEvent.event_name}`} onClose={() => setCompleteEvent(null)}>
          <FormRow label="Actual Customers"><input type="number" value={completeForm.actual_customers} onChange={e => setCompleteForm(f => ({ ...f, actual_customers: e.target.value }))} className={inp} /></FormRow>
          <FormRow label="Gross Revenue ($) *"><input type="number" step="0.01" value={completeForm.gross_revenue} onChange={e => setCompleteForm(f => ({ ...f, gross_revenue: e.target.value }))} className={inp} /></FormRow>
          <FormRow label="COGS ($)"><input type="number" step="0.01" value={completeForm.cogs} onChange={e => setCompleteForm(f => ({ ...f, cogs: e.target.value }))} className={inp} /></FormRow>
          <FormRow label="Weather Notes"><input value={completeForm.weather_notes} onChange={e => setCompleteForm(f => ({ ...f, weather_notes: e.target.value }))} className={inp} /></FormRow>
          <div className="flex gap-2 mt-4">
            <button onClick={completeEventSubmit} className="flex-1 py-2 bg-green-600 text-white rounded text-sm font-medium">Mark Complete</button>
            <button onClick={() => setCompleteEvent(null)} className="flex-1 py-2 border text-gray-600 rounded text-sm">Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
