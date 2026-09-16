'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard', 'customers', 'visits', 'chemicals', 'equipment', 'ai'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = { dashboard: 'Dashboard', customers: 'Customers', visits: 'Service Visits', chemicals: 'Chemicals', equipment: 'Equipment', ai: 'AI Tools' };

const VISIT_TYPES = ['opening', 'closing', 'maintenance', 'repair', 'chemical-balance'];
const VISIT_STATUSES = ['scheduled', 'in_progress', 'completed'];
const SERVICE_PLANS = ['standard', 'premium', 'full-service', 'chemical-only', 'open-close'];
const POOL_TYPES = ['inground', 'above_ground', 'hot_tub', 'combo'];
const CHEMICAL_CATEGORIES = ['sanitizer', 'alkalinity', 'pH', 'clarifier', 'shock', 'algaecide'];
const EQUIPMENT_CONDITIONS = ['good', 'fair', 'poor', 'replace'];

interface Stats { total_customers: number; active_service_contracts: number; jobs_this_week: number; revenue_mtd: number; chemicals_low_stock: number; permits_expiring_90d: number; }
interface Customer { id: number; name: string; email: string; phone: string; address: string; pool_type: string; pool_size_gallons: number; hot_tub_brand: string; service_plan: string; contract_start: string; contract_end: string; is_active: boolean; last_service_date: string; contract_status: string; }
interface Visit { id: number; customer_id: number; customer_name: string; customer_address: string; pool_type: string; technician_name: string; visit_date: string; visit_type: string; status: string; ph_level: number; chlorine_ppm: number; alkalinity_ppm: number; calcium_hardness: number; notes: string; labour_hours: number; labour_rate: number; parts_cost: number; total_amount: number; }
interface Chemical { id: number; name: string; category: string; unit: string; quantity_on_hand: number; reorder_threshold: number; cost_per_unit: number; supplier: string; health_canada_reg: string; is_low_stock: boolean; }
interface Equipment { id: number; customer_id: number; customer_name: string; equipment_type: string; brand: string; model: string; serial_number: string; install_date: string; warranty_expiry: string; last_service: string; next_service_due: string; condition: string; warranty_status: string; }

function fmtCad(n: number) { return `$${Number(n ?? 0).toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`; }
function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString('en-CA') : '—'; }

function Badge({ label, color = 'gray' }: { label: string; color?: string }) {
  const map: Record<string, string> = { blue: 'bg-blue-100 text-blue-700', green: 'bg-green-100 text-green-700', amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700', purple: 'bg-purple-100 text-purple-700', gray: 'bg-gray-100 text-gray-700', teal: 'bg-teal-100 text-teal-700', cyan: 'bg-cyan-100 text-cyan-700' };
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${map[color] ?? map.gray}`}>{label}</span>;
}

function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const borders: Record<string, string> = { blue: 'border-l-4 border-blue-500 bg-blue-50', green: 'border-l-4 border-green-500 bg-green-50', amber: 'border-l-4 border-amber-500 bg-amber-50', red: 'border-l-4 border-red-500 bg-red-50', purple: 'border-l-4 border-purple-500 bg-purple-50', teal: 'border-l-4 border-teal-500 bg-teal-50' };
  return (
    <div className={`rounded-lg p-4 ${borders[color] ?? borders.blue}`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function phColor(ph: number) { return ph >= 7.2 && ph <= 7.8 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'; }
function clColor(cl: number) { return cl >= 1 && cl <= 3 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'; }
function visitStatusColor(s: string) { const m: Record<string, string> = { scheduled: 'blue', in_progress: 'amber', completed: 'green' }; return m[s] ?? 'gray'; }
function contractStatusColor(s: string) { const m: Record<string, string> = { active: 'green', expiring_soon: 'amber', expired: 'red' }; return m[s] ?? 'gray'; }
function conditionColor(c: string) { const m: Record<string, string> = { good: 'green', fair: 'amber', poor: 'red', replace: 'red' }; return m[c] ?? 'gray'; }
function warrantyColor(w: string) { const m: Record<string, string> = { valid: 'green', expiring_soon: 'amber', expired: 'red' }; return m[w] ?? 'gray'; }

// ─── Add Customer Modal ───────────────────────────────────────────────────────
function AddCustomerModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', pool_type: 'inground', pool_size_gallons: '', hot_tub_brand: '', service_plan: 'standard', contract_start: '', contract_end: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-bold">Add Pool/Hot Tub Customer</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          {[['name', 'Customer Name *'], ['email', 'Email'], ['phone', 'Phone'], ['address', 'Address']].map(([k, l]) => (
            <div key={k} className={k === 'address' ? 'col-span-2' : ''}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{l}</label>
              <input value={(form as any)[k]} onChange={e => set(k, e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pool Type</label>
            <select value={form.pool_type} onChange={e => set('pool_type', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              {POOL_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pool Size (gallons)</label>
            <input type="number" value={form.pool_size_gallons} onChange={e => set('pool_size_gallons', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hot Tub Brand</label>
            <input value={form.hot_tub_brand} onChange={e => set('hot_tub_brand', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. Beachcomber, Sundance" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Service Plan</label>
            <select value={form.service_plan} onChange={e => set('service_plan', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              {SERVICE_PLANS.map(p => <option key={p} value={p}>{p.replace('-', ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contract Start</label>
            <input type="date" value={form.contract_start} onChange={e => set('contract_start', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contract End</label>
            <input type="date" value={form.contract_end} onChange={e => set('contract_end', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="flex gap-3 justify-end p-6 border-t">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
          <button disabled={saving || !form.name} onClick={async () => {
            setSaving(true);
            try {
              await fetch('/api/admin/pool-hot-tub/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, pool_size_gallons: form.pool_size_gallons ? Number(form.pool_size_gallons) : null }) });
              onSaved();
            } finally { setSaving(false); }
          }} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
            {saving ? 'Saving…' : 'Add Customer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Visit Modal ──────────────────────────────────────────────────────────
function AddVisitModal({ customers, onClose, onSaved }: { customers: Customer[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ customer_id: '', technician_name: '', visit_date: new Date().toISOString().slice(0, 10), visit_type: 'maintenance', status: 'scheduled', ph_level: '', chlorine_ppm: '', alkalinity_ppm: '', calcium_hardness: '', notes: '', labour_hours: '2', labour_rate: '95', parts_cost: '0' });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-bold">Schedule Service Visit</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer *</label>
            <select value={form.customer_id} onChange={e => set('customer_id', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">Select customer…</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name} — {c.address}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Visit Date *</label>
            <input type="date" value={form.visit_date} onChange={e => set('visit_date', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Visit Type</label>
            <select value={form.visit_type} onChange={e => set('visit_type', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              {VISIT_TYPES.map(t => <option key={t} value={t}>{t.replace('-', ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Technician</label>
            <input value={form.technician_name} onChange={e => set('technician_name', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              {VISIT_STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">pH</label><input type="number" step="0.01" value={form.ph_level} onChange={e => set('ph_level', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="7.2–7.8" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Chlorine (ppm)</label><input type="number" step="0.1" value={form.chlorine_ppm} onChange={e => set('chlorine_ppm', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="1–3" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Alkalinity (ppm)</label><input type="number" value={form.alkalinity_ppm} onChange={e => set('alkalinity_ppm', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="80–120" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Calcium Hardness</label><input type="number" value={form.calcium_hardness} onChange={e => set('calcium_hardness', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="200–400" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Labour Hours</label><input type="number" step="0.5" value={form.labour_hours} onChange={e => set('labour_hours', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Labour Rate ($/hr)</label><input type="number" value={form.labour_rate} onChange={e => set('labour_rate', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Parts Cost ($)</label><input type="number" step="0.01" value={form.parts_cost} onChange={e => set('parts_cost', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
          <div className="col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Notes</label><textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
        </div>
        <div className="flex gap-3 justify-end p-6 border-t">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
          <button disabled={saving || !form.customer_id || !form.visit_date} onClick={async () => {
            setSaving(true);
            try {
              const payload = { ...form, customer_id: Number(form.customer_id), ph_level: form.ph_level ? Number(form.ph_level) : null, chlorine_ppm: form.chlorine_ppm ? Number(form.chlorine_ppm) : null, alkalinity_ppm: form.alkalinity_ppm ? Number(form.alkalinity_ppm) : null, calcium_hardness: form.calcium_hardness ? Number(form.calcium_hardness) : null, labour_hours: Number(form.labour_hours), labour_rate: Number(form.labour_rate), parts_cost: Number(form.parts_cost) };
              await fetch('/api/admin/pool-hot-tub/service-visits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
              onSaved();
            } finally { setSaving(false); }
          }} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
            {saving ? 'Saving…' : 'Schedule Visit'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PoolHotTubPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [stats, setStats] = useState<Stats | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [chemicals, setChemicals] = useState<Chemical[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showAddVisit, setShowAddVisit] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [visitStatusFilter, setVisitStatusFilter] = useState('');
  const [chemLowStock, setChemLowStock] = useState(false);
  const [aiWaterForm, setAiWaterForm] = useState({ ph: '', chlorine_ppm: '', alkalinity_ppm: '', calcium_hardness: '', pool_size_gallons: '', pool_type: 'inground' });
  const [aiWaterResult, setAiWaterResult] = useState('');
  const [aiWaterLoading, setAiWaterLoading] = useState(false);
  const [aiReportForm, setAiReportForm] = useState({ customer_name: '', visit_date: '', visit_type: 'maintenance', technician_name: '', ph_level: '', chlorine_ppm: '', alkalinity_ppm: '', calcium_hardness: '', notes: '', labour_hours: '', total_amount: '', pool_type: 'inground', address: '' });
  const [aiReportResult, setAiReportResult] = useState('');
  const [aiReportLoading, setAiReportLoading] = useState(false);

  const loadStats = useCallback(async () => {
    try { const r = await fetch('/api/admin/pool-hot-tub'); setStats(await r.json()); } catch {}
  }, []);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (customerSearch) q.set('search', customerSearch);
      const r = await fetch(`/api/admin/pool-hot-tub/customers?${q}`);
      const d = await r.json();
      setCustomers(d.customers ?? []);
    } finally { setLoading(false); }
  }, [customerSearch]);

  const loadVisits = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (visitStatusFilter) q.set('status', visitStatusFilter);
      const r = await fetch(`/api/admin/pool-hot-tub/service-visits?${q}`);
      const d = await r.json();
      setVisits(d.visits ?? []);
    } finally { setLoading(false); }
  }, [visitStatusFilter]);

  const loadChemicals = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (chemLowStock) q.set('low_stock', 'true');
      const r = await fetch(`/api/admin/pool-hot-tub/chemicals?${q}`);
      const d = await r.json();
      setChemicals(d.chemicals ?? []);
    } finally { setLoading(false); }
  }, [chemLowStock]);

  const loadEquipment = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/pool-hot-tub/equipment');
      const d = await r.json();
      setEquipment(d.equipment ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { if (tab === 'customers') loadCustomers(); }, [tab, loadCustomers]);
  useEffect(() => { if (tab === 'visits') loadVisits(); }, [tab, loadVisits]);
  useEffect(() => { if (tab === 'chemicals') loadChemicals(); }, [tab, loadChemicals]);
  useEffect(() => { if (tab === 'equipment') loadEquipment(); }, [tab, loadEquipment]);

  const completeVisit = async (id: number) => {
    await fetch(`/api/admin/pool-hot-tub/service-visits/${id}/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    loadVisits(); loadStats();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pool &amp; Hot Tub Services</h1>
            <p className="text-sm text-gray-500 mt-1">Alberta seasonal pool management — May–Sep primary season, ALGC chemical compliance</p>
          </div>
          <div className="flex gap-2">
            {stats && stats.chemicals_low_stock > 0 && <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">{stats.chemicals_low_stock} chemicals low</span>}
            {stats && stats.permits_expiring_90d > 0 && <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">{stats.permits_expiring_90d} warranties expiring</span>}
          </div>
        </div>
        {/* Tabs */}
        <div className="flex gap-1 mt-4">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {/* DASHBOARD */}
        {tab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <KpiCard label="Active Customers" value={stats?.total_customers ?? '—'} color="blue" />
              <KpiCard label="Active Contracts" value={stats?.active_service_contracts ?? '—'} color="green" />
              <KpiCard label="Jobs This Week" value={stats?.jobs_this_week ?? '—'} color="teal" />
              <KpiCard label="Revenue MTD" value={stats ? fmtCad(stats.revenue_mtd) : '—'} color="purple" />
              <KpiCard label="Chemicals Low Stock" value={stats?.chemicals_low_stock ?? '—'} color={stats?.chemicals_low_stock ? 'red' : 'green'} sub="reorder needed" />
              <KpiCard label="Warranties Expiring" value={stats?.permits_expiring_90d ?? '—'} color={stats?.permits_expiring_90d ? 'amber' : 'green'} sub="next 90 days" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border p-4">
                <h3 className="font-semibold mb-3 text-gray-800">Alberta Seasonal Calendar</h3>
                <div className="space-y-2 text-sm">
                  {[['May', 'Pool Openings', 'blue'], ['Jun–Aug', 'Maintenance Season', 'green'], ['Sep', 'Pool Closings / Cover Storage', 'amber'], ['Oct–Apr', 'Winter Equipment Storage, Hot Tub Only', 'gray']].map(([m, d, c]) => (
                    <div key={m} className={`flex items-center gap-3 p-2 rounded bg-${c}-50`}>
                      <span className={`font-bold text-${c}-700 w-20`}>{m}</span>
                      <span className="text-gray-700">{d}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-xl border p-4">
                <h3 className="font-semibold mb-3 text-gray-800">ALGC Compliance Notes</h3>
                <ul className="text-sm text-gray-700 space-y-2">
                  <li className="flex gap-2"><span className="text-blue-500">•</span> All chemicals must have Health Canada registration number on file</li>
                  <li className="flex gap-2"><span className="text-blue-500">•</span> Chemical SDS sheets must be available on-site</li>
                  <li className="flex gap-2"><span className="text-blue-500">•</span> pH target: 7.2–7.8 | Chlorine: 1–3 ppm</li>
                  <li className="flex gap-2"><span className="text-blue-500">•</span> Never mix chemicals — 15–30 min between additions</li>
                  <li className="flex gap-2"><span className="text-blue-500">•</span> Public pools: test every 4 hours minimum</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* CUSTOMERS */}
        {tab === 'customers' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-3">
                <input value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} placeholder="Search customers…" className="border rounded-lg px-3 py-2 text-sm w-64" />
                <button onClick={loadCustomers} className="px-4 py-2 bg-gray-100 rounded-lg text-sm">Search</button>
              </div>
              <button onClick={() => setShowAddCustomer(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">+ Add Customer</button>
            </div>
            {loading ? <div className="text-center py-12 text-gray-400">Loading…</div> : (
              <div className="bg-white rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>{['Customer', 'Contact', 'Pool Info', 'Service Plan', 'Contract', 'Last Service', 'Status'].map(h => <th key={h} className="text-left px-4 py-3 font-medium text-gray-600">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y">
                    {customers.map(c => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{c.name}</td>
                        <td className="px-4 py-3 text-gray-500"><div>{c.email}</div><div>{c.phone}</div></td>
                        <td className="px-4 py-3"><div><Badge label={c.pool_type} color="cyan" /></div>{c.pool_size_gallons && <div className="text-gray-500 text-xs mt-1">{c.pool_size_gallons.toLocaleString()} gal</div>}</td>
                        <td className="px-4 py-3"><Badge label={c.service_plan} color="blue" /></td>
                        <td className="px-4 py-3"><div className="text-xs text-gray-500">{fmtDate(c.contract_start)} – {fmtDate(c.contract_end)}</div><Badge label={c.contract_status?.replace('_', ' ')} color={contractStatusColor(c.contract_status)} /></td>
                        <td className="px-4 py-3 text-gray-500">{fmtDate(c.last_service_date)}</td>
                        <td className="px-4 py-3"><Badge label={c.is_active ? 'Active' : 'Inactive'} color={c.is_active ? 'green' : 'gray'} /></td>
                      </tr>
                    ))}
                    {!customers.length && <tr><td colSpan={7} className="text-center py-12 text-gray-400">No customers found</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* SERVICE VISITS */}
        {tab === 'visits' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-3">
                <select value={visitStatusFilter} onChange={e => setVisitStatusFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
                  <option value="">All Statuses</option>
                  {VISIT_STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
                <button onClick={loadVisits} className="px-4 py-2 bg-gray-100 rounded-lg text-sm">Filter</button>
              </div>
              <button onClick={() => setShowAddVisit(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">+ Schedule Visit</button>
            </div>
            {loading ? <div className="text-center py-12 text-gray-400">Loading…</div> : (
              <div className="bg-white rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>{['Customer', 'Date', 'Type', 'Technician', 'Water Chemistry', 'Cost', 'Status', ''].map(h => <th key={h} className="text-left px-4 py-3 font-medium text-gray-600">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y">
                    {visits.map(v => (
                      <tr key={v.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3"><div className="font-medium">{v.customer_name}</div><div className="text-xs text-gray-400">{v.customer_address}</div></td>
                        <td className="px-4 py-3">{fmtDate(v.visit_date)}</td>
                        <td className="px-4 py-3"><Badge label={v.visit_type} color="teal" /></td>
                        <td className="px-4 py-3 text-gray-600">{v.technician_name || '—'}</td>
                        <td className="px-4 py-3">
                          {v.ph_level != null && <div>pH: <span className={phColor(v.ph_level)}>{v.ph_level}</span></div>}
                          {v.chlorine_ppm != null && <div>Cl: <span className={clColor(v.chlorine_ppm)}>{v.chlorine_ppm} ppm</span></div>}
                          {v.alkalinity_ppm != null && <div className="text-gray-500 text-xs">Alk: {v.alkalinity_ppm} ppm</div>}
                        </td>
                        <td className="px-4 py-3 font-medium">{v.total_amount ? fmtCad(v.total_amount) : '—'}</td>
                        <td className="px-4 py-3"><Badge label={v.status.replace('_', ' ')} color={visitStatusColor(v.status)} /></td>
                        <td className="px-4 py-3">
                          {v.status !== 'completed' && (
                            <button onClick={() => completeVisit(v.id)} className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200">Complete</button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!visits.length && <tr><td colSpan={8} className="text-center py-12 text-gray-400">No visits found</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* CHEMICALS */}
        {tab === 'chemicals' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={chemLowStock} onChange={e => setChemLowStock(e.target.checked)} />
                Show low stock only
              </label>
              <button onClick={loadChemicals} className="px-4 py-2 bg-gray-100 rounded-lg text-sm">Refresh</button>
            </div>
            {loading ? <div className="text-center py-12 text-gray-400">Loading…</div> : (
              <div className="bg-white rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>{['Chemical', 'Category', 'Stock', 'Reorder At', 'Cost/Unit', 'Supplier', 'Health Canada Reg', 'Status'].map(h => <th key={h} className="text-left px-4 py-3 font-medium text-gray-600">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y">
                    {chemicals.map(c => (
                      <tr key={c.id} className={`hover:bg-gray-50 ${c.is_low_stock ? 'bg-red-50' : ''}`}>
                        <td className="px-4 py-3 font-medium">{c.name}</td>
                        <td className="px-4 py-3"><Badge label={c.category} color="blue" /></td>
                        <td className="px-4 py-3 font-semibold">{c.quantity_on_hand} {c.unit}</td>
                        <td className="px-4 py-3 text-gray-500">{c.reorder_threshold} {c.unit}</td>
                        <td className="px-4 py-3">{fmtCad(c.cost_per_unit)}/{c.unit}</td>
                        <td className="px-4 py-3 text-gray-500">{c.supplier || '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 font-mono">{c.health_canada_reg || '—'}</td>
                        <td className="px-4 py-3"><Badge label={c.is_low_stock ? 'Reorder Now' : 'OK'} color={c.is_low_stock ? 'red' : 'green'} /></td>
                      </tr>
                    ))}
                    {!chemicals.length && <tr><td colSpan={8} className="text-center py-12 text-gray-400">No chemicals found</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* EQUIPMENT */}
        {tab === 'equipment' && (
          <div>
            <div className="flex justify-end mb-4">
              <button onClick={loadEquipment} className="px-4 py-2 bg-gray-100 rounded-lg text-sm">Refresh</button>
            </div>
            {loading ? <div className="text-center py-12 text-gray-400">Loading…</div> : (
              <div className="bg-white rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>{['Customer', 'Equipment', 'Brand/Model', 'Installed', 'Warranty', 'Next Service', 'Condition'].map(h => <th key={h} className="text-left px-4 py-3 font-medium text-gray-600">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y">
                    {equipment.map(e => (
                      <tr key={e.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{e.customer_name}</td>
                        <td className="px-4 py-3"><Badge label={e.equipment_type} color="teal" /></td>
                        <td className="px-4 py-3 text-gray-600">{[e.brand, e.model].filter(Boolean).join(' ')}</td>
                        <td className="px-4 py-3 text-gray-500">{fmtDate(e.install_date)}</td>
                        <td className="px-4 py-3"><div className="text-xs">{fmtDate(e.warranty_expiry)}</div><Badge label={e.warranty_status?.replace('_', ' ') ?? 'unknown'} color={warrantyColor(e.warranty_status)} /></td>
                        <td className="px-4 py-3 text-gray-500">{fmtDate(e.next_service_due)}</td>
                        <td className="px-4 py-3"><Badge label={e.condition} color={conditionColor(e.condition)} /></td>
                      </tr>
                    ))}
                    {!equipment.length && <tr><td colSpan={7} className="text-center py-12 text-gray-400">No equipment found</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* AI TOOLS */}
        {tab === 'ai' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Water Treatment Advisor */}
            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-bold text-lg mb-1">Water Treatment Advisor</h3>
              <p className="text-sm text-gray-500 mb-4">Enter current readings for AI-powered chemical dosage recommendations (ALGC compliant)</p>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[['ph', 'pH (target 7.2–7.8)', '7.4'], ['chlorine_ppm', 'Chlorine ppm (target 1–3)', '2.0'], ['alkalinity_ppm', 'Alkalinity ppm (target 80–120)', '100'], ['calcium_hardness', 'Calcium Hardness ppm (200–400)', '300'], ['pool_size_gallons', 'Pool Size (gallons)', '15000']].map(([k, l, ph]) => (
                  <div key={k}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{l}</label>
                    <input type="number" step="0.01" placeholder={ph} value={(aiWaterForm as any)[k]} onChange={e => setAiWaterForm(f => ({ ...f, [k]: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Pool Type</label>
                  <select value={aiWaterForm.pool_type} onChange={e => setAiWaterForm(f => ({ ...f, pool_type: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                    {POOL_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                  </select>
                </div>
              </div>
              <button disabled={aiWaterLoading} onClick={async () => {
                setAiWaterLoading(true); setAiWaterResult('');
                try {
                  const r = await fetch('/api/admin/pool-hot-tub/ai-water-treatment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...aiWaterForm, ph: Number(aiWaterForm.ph), chlorine_ppm: Number(aiWaterForm.chlorine_ppm), alkalinity_ppm: Number(aiWaterForm.alkalinity_ppm), calcium_hardness: Number(aiWaterForm.calcium_hardness), pool_size_gallons: Number(aiWaterForm.pool_size_gallons) }) });
                  const d = await r.json();
                  setAiWaterResult(d.recommendation + (d.offline ? '\n\n[Offline fallback — Ollama unavailable]' : ''));
                } finally { setAiWaterLoading(false); }
              }} className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {aiWaterLoading ? 'Analyzing…' : 'Get Treatment Recommendation'}
              </button>
              {aiWaterResult && <pre className="mt-4 p-4 bg-gray-50 rounded-lg text-sm whitespace-pre-wrap text-gray-700">{aiWaterResult}</pre>}
            </div>

            {/* Service Report Generator */}
            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-bold text-lg mb-1">Service Report Generator</h3>
              <p className="text-sm text-gray-500 mb-4">Generate a professional client service report from visit data</p>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[['customer_name', 'Customer Name'], ['address', 'Address'], ['technician_name', 'Technician'], ['visit_date', 'Visit Date'], ['ph_level', 'pH'], ['chlorine_ppm', 'Chlorine ppm'], ['alkalinity_ppm', 'Alkalinity ppm'], ['calcium_hardness', 'Calcium Hardness'], ['labour_hours', 'Labour Hours'], ['total_amount', 'Total Amount ($)']].map(([k, l]) => (
                  <div key={k} className={k === 'address' || k === 'customer_name' ? 'col-span-2' : ''}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{l}</label>
                    <input type={['ph_level', 'chlorine_ppm', 'alkalinity_ppm', 'calcium_hardness', 'labour_hours', 'total_amount'].includes(k) ? 'number' : k === 'visit_date' ? 'date' : 'text'} value={(aiReportForm as any)[k]} onChange={e => setAiReportForm(f => ({ ...f, [k]: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                ))}
                <div className="col-span-2"><label className="block text-xs font-medium text-gray-600 mb-1">Technician Notes</label><textarea value={aiReportForm.notes} onChange={e => setAiReportForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
              </div>
              <button disabled={aiReportLoading} onClick={async () => {
                setAiReportLoading(true); setAiReportResult('');
                try {
                  const r = await fetch('/api/admin/pool-hot-tub/ai-service-report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(aiReportForm) });
                  const d = await r.json();
                  setAiReportResult(d.report + (d.offline ? '\n\n[Offline fallback]' : ''));
                } finally { setAiReportLoading(false); }
              }} className="w-full py-2 bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {aiReportLoading ? 'Generating…' : 'Generate Service Report'}
              </button>
              {aiReportResult && <pre className="mt-4 p-4 bg-gray-50 rounded-lg text-sm whitespace-pre-wrap text-gray-700">{aiReportResult}</pre>}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddCustomer && <AddCustomerModal onClose={() => setShowAddCustomer(false)} onSaved={() => { setShowAddCustomer(false); loadCustomers(); loadStats(); }} />}
      {showAddVisit && <AddVisitModal customers={customers} onClose={() => setShowAddVisit(false)} onSaved={() => { setShowAddVisit(false); loadVisits(); loadStats(); }} />}
    </div>
  );
}
