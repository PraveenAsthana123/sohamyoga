'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard', 'customers', 'equipment', 'jobs', 'parts', 'rebates', 'ai'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = {
  dashboard: 'Dashboard',
  customers: 'Customers',
  equipment: 'Equipment',
  jobs: 'Jobs',
  parts: 'Parts',
  rebates: 'Rebates',
  ai: 'AI Tools',
};

const JOB_TYPES = ['emergency', 'maintenance', 'installation', 'repair', 'inspection', 'tune_up'];
const JOB_STATUSES = ['scheduled', 'dispatched', 'in_progress', 'completed', 'cancelled'];
const BUILDING_TYPES = ['residential', 'commercial', 'industrial', 'multi_unit'];
const PRIORITY_TIERS = ['emergency', 'priority', 'standard'];
const EQUIPMENT_CONDITIONS = ['good', 'fair', 'poor', 'replace'];

interface Stats {
  total_customers: number;
  active_maintenance_contracts: number;
  jobs_today: number;
  revenue_mtd: number;
  emergency_calls_mtd: number;
  equipment_warranties_expiring_90d: number;
}
interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  building_type: string;
  priority_tier: string;
  is_active: boolean;
  contract_start: string | null;
  contract_end: string | null;
  system_age_years: number | null;
  notes: string | null;
  contract_status: string;
}
interface Equipment {
  id: number;
  customer_id: number;
  customer_name: string;
  equipment_type: string;
  brand: string;
  model: string;
  serial_number: string | null;
  install_date: string | null;
  warranty_expiry: string | null;
  last_service: string | null;
  condition: string;
  filter_size: string | null;
  warranty_status: string;
}
interface Job {
  id: number;
  customer_id: number;
  customer_name: string;
  customer_address: string;
  job_type: string;
  status: string;
  priority: string;
  technician_name: string | null;
  scheduled_date: string | null;
  completed_at: string | null;
  total_amount: number | null;
  description: string;
  notes: string | null;
}
interface Part {
  id: number;
  part_number: string;
  name: string;
  category: string;
  quantity_on_hand: number;
  reorder_point: number;
  cost_price: number;
  sell_price: number;
  supplier: string | null;
}
interface Rebate {
  id: number;
  customer_id: number;
  customer_name: string;
  program_name: string;
  utility_provider: string;
  rebate_amount: number;
  status: string;
  submitted_date: string | null;
  approved_date: string | null;
  notes: string | null;
}

function fmtCad(n: number) { return `$${Number(n ?? 0).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function fmtDate(d: string | null) { return d ? new Date(d).toLocaleDateString('en-CA') : '—'; }

function Badge({ label, color = 'gray' }: { label: string; color?: string }) {
  const map: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
    purple: 'bg-purple-100 text-purple-700',
    gray: 'bg-gray-100 text-gray-700',
    teal: 'bg-teal-100 text-teal-700',
    orange: 'bg-orange-100 text-orange-700',
  };
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${map[color] ?? map.gray}`}>{label.replace(/_/g, ' ')}</span>;
}

function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const borders: Record<string, string> = {
    blue: 'border-l-4 border-blue-500 bg-blue-50',
    green: 'border-l-4 border-green-500 bg-green-50',
    amber: 'border-l-4 border-amber-500 bg-amber-50',
    red: 'border-l-4 border-red-500 bg-red-50',
    purple: 'border-l-4 border-purple-500 bg-purple-50',
    teal: 'border-l-4 border-teal-500 bg-teal-50',
  };
  return (
    <div className={`rounded-lg p-4 ${borders[color] ?? borders.blue}`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function priorityColor(p: string): string {
  const m: Record<string, string> = { emergency: 'red', priority: 'amber', standard: 'green' };
  return m[p] ?? 'gray';
}
function jobTypeColor(t: string): string {
  const m: Record<string, string> = { emergency: 'red', maintenance: 'blue', installation: 'purple', repair: 'amber', inspection: 'teal', tune_up: 'green' };
  return m[t] ?? 'gray';
}
function conditionColor(c: string): string {
  const m: Record<string, string> = { good: 'green', fair: 'amber', poor: 'red', replace: 'red' };
  return m[c] ?? 'gray';
}
function warrantyStatusColor(w: string): string {
  const m: Record<string, string> = { valid: 'green', expiring_soon: 'amber', expired: 'red' };
  return m[w] ?? 'gray';
}
function rebateStatusColor(s: string): string {
  const m: Record<string, string> = { approved: 'green', pending: 'amber', submitted: 'blue', rejected: 'red', draft: 'gray' };
  return m[s] ?? 'gray';
}

function warrantyCountdown(expiry: string | null): string {
  if (!expiry) return '—';
  const days = Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000);
  if (days < 0) return 'Expired';
  if (days <= 30) return `${days}d (expiring soon)`;
  return `${days}d`;
}

// ─── Dashboard Tab ─────────────────────────────────────────────────────────────
function DashboardTab({ stats }: { stats: Stats | null }) {
  if (!stats) return <div className="p-8 text-center text-gray-400">Loading…</div>;
  return (
    <div className="space-y-6">
      {stats.emergency_calls_mtd > 0 && (
        <div className="bg-red-50 border-2 border-red-400 rounded-lg p-4 flex items-center gap-3">
          <div className="text-red-600 text-2xl font-bold">{stats.emergency_calls_mtd}</div>
          <div>
            <p className="font-bold text-red-700">Emergency Call{stats.emergency_calls_mtd !== 1 ? 's' : ''} This Month</p>
            <p className="text-xs text-red-600">Review Jobs tab for dispatch status</p>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard label="Total Customers" value={stats.total_customers} color="blue"/>
        <KpiCard label="Active Contracts" value={stats.active_maintenance_contracts} color="green"/>
        <KpiCard label="Jobs Today" value={stats.jobs_today} color="amber"/>
        <KpiCard label="Revenue MTD" value={fmtCad(stats.revenue_mtd)} color="teal"/>
        <KpiCard label="Emergency Calls MTD" value={stats.emergency_calls_mtd} color={stats.emergency_calls_mtd > 0 ? 'red' : 'green'}/>
        <KpiCard label="Warranties Expiring (90d)" value={stats.equipment_warranties_expiring_90d} color={stats.equipment_warranties_expiring_90d > 0 ? 'amber' : 'green'}/>
      </div>
    </div>
  );
}

// ─── Customers Tab ─────────────────────────────────────────────────────────────
function CustomersTab({ customers, reload }: { customers: Customer[]; reload: () => void }) {
  const [search, setSearch] = useState('');
  const [buildingFilter, setBuildingFilter] = useState('');
  const [tierFilter, setTierFilter] = useState('');

  const filtered = customers.filter(c => {
    if (buildingFilter && c.building_type !== buildingFilter) return false;
    if (tierFilter && c.priority_tier !== tierFilter) return false;
    if (search && !`${c.name} ${c.address} ${c.phone}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input className="border rounded-lg px-3 py-1.5 text-sm flex-1 min-w-40" placeholder="Search name, address, phone…" value={search} onChange={e => setSearch(e.target.value)}/>
        <select className="border rounded-lg px-3 py-1.5 text-sm" value={buildingFilter} onChange={e => setBuildingFilter(e.target.value)}>
          <option value="">All Building Types</option>
          {BUILDING_TYPES.map(b => <option key={b} value={b}>{b.replace(/_/g, ' ')}</option>)}
        </select>
        <select className="border rounded-lg px-3 py-1.5 text-sm" value={tierFilter} onChange={e => setTierFilter(e.target.value)}>
          <option value="">All Priority Tiers</option>
          {PRIORITY_TIERS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
        </select>
        <span className="text-sm text-gray-400">{filtered.length} customers</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-3 py-2 font-medium text-gray-600">Customer</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Building</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Priority</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Contract</th>
              <th className="text-right px-3 py-2 font-medium text-gray-600">System Age (yrs)</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Phone</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id} className={`border-b hover:bg-gray-50 ${c.priority_tier === 'emergency' ? 'bg-red-50' : ''}`}>
                <td className="px-3 py-2">
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-gray-400">{c.address}</p>
                </td>
                <td className="px-3 py-2"><Badge label={c.building_type} color="blue"/></td>
                <td className="px-3 py-2"><Badge label={c.priority_tier} color={priorityColor(c.priority_tier)}/></td>
                <td className="px-3 py-2">
                  <Badge label={c.contract_status ?? 'no contract'} color={c.contract_status === 'active' ? 'green' : c.contract_status === 'expiring_soon' ? 'amber' : 'gray'}/>
                  {c.contract_end && <p className="text-xs text-gray-400 mt-0.5">Ends {fmtDate(c.contract_end)}</p>}
                </td>
                <td className="px-3 py-2 text-right">{c.system_age_years != null ? c.system_age_years : '—'}</td>
                <td className="px-3 py-2 text-xs text-gray-600">{c.phone}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">No customers found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Equipment Tab ─────────────────────────────────────────────────────────────
function EquipmentTab({ equipment }: { equipment: Equipment[] }) {
  const [search, setSearch] = useState('');
  const filtered = equipment.filter(e => !search || `${e.customer_name} ${e.brand} ${e.model} ${e.equipment_type}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <input className="border rounded-lg px-3 py-1.5 text-sm flex-1" placeholder="Search customer, brand, model…" value={search} onChange={e => setSearch(e.target.value)}/>
        <span className="text-sm text-gray-400">{filtered.length} units</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-3 py-2 font-medium text-gray-600">Customer</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Equipment</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Brand / Model</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Condition</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Filter Size</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Warranty Expiry</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Last Service</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(e => (
              <tr key={e.id} className={`border-b hover:bg-gray-50 ${e.condition === 'replace' ? 'bg-red-50' : e.condition === 'poor' ? 'bg-amber-50' : ''}`}>
                <td className="px-3 py-2">
                  <p className="font-medium">{e.customer_name}</p>
                </td>
                <td className="px-3 py-2 text-gray-600">{e.equipment_type.replace(/_/g, ' ')}</td>
                <td className="px-3 py-2">
                  <p className="text-sm">{e.brand}</p>
                  <p className="text-xs text-gray-400">{e.model}</p>
                  {e.serial_number && <p className="text-xs font-mono text-gray-300">SN: {e.serial_number}</p>}
                </td>
                <td className="px-3 py-2"><Badge label={e.condition} color={conditionColor(e.condition)}/></td>
                <td className="px-3 py-2 text-xs text-gray-600">{e.filter_size ?? '—'}</td>
                <td className="px-3 py-2">
                  <Badge label={e.warranty_status} color={warrantyStatusColor(e.warranty_status)}/>
                  <p className="text-xs text-gray-400 mt-0.5">{warrantyCountdown(e.warranty_expiry)}</p>
                </td>
                <td className="px-3 py-2 text-xs">{fmtDate(e.last_service)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">No equipment found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Jobs Tab ──────────────────────────────────────────────────────────────────
function JobsTab({ jobs, reload }: { jobs: Job[]; reload: () => void }) {
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [actionId, setActionId] = useState<number | null>(null);

  const filtered = jobs.filter(j => {
    if (statusFilter && j.status !== statusFilter) return false;
    if (priorityFilter && j.priority !== priorityFilter) return false;
    return true;
  });

  async function dispatch(job: Job) {
    setActionId(job.id);
    try {
      await fetch(`/api/admin/hvac-services/jobs/${job.id}/dispatch`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      reload();
    } finally { setActionId(null); }
  }

  async function complete(job: Job) {
    setActionId(job.id);
    try {
      await fetch(`/api/admin/hvac-services/jobs/${job.id}/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ completed_at: new Date().toISOString() }) });
      reload();
    } finally { setActionId(null); }
  }

  const emergencyJobs = jobs.filter(j => j.priority === 'emergency' && j.status !== 'completed' && j.status !== 'cancelled');

  return (
    <div>
      {emergencyJobs.length > 0 && (
        <div className="mb-4 bg-red-50 border-2 border-red-400 rounded-lg p-3">
          <p className="font-bold text-red-700 text-sm">{emergencyJobs.length} EMERGENCY JOB{emergencyJobs.length > 1 ? 'S' : ''} OPEN — dispatch immediately</p>
          {emergencyJobs.map(j => (
            <p key={j.id} className="text-xs text-red-600 mt-0.5">#{j.id} — {j.customer_name}: {j.description}</p>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select className="border rounded-lg px-3 py-1.5 text-sm" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {JOB_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <select className="border rounded-lg px-3 py-1.5 text-sm" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
          <option value="">All Priorities</option>
          {PRIORITY_TIERS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
        </select>
        <span className="text-sm text-gray-400">{filtered.length} jobs</span>
      </div>
      <div className="space-y-3">
        {filtered.map(j => (
          <div key={j.id} className={`bg-white border-l-4 rounded-lg p-4 ${j.priority === 'emergency' ? 'border-red-500' : j.priority === 'priority' ? 'border-amber-500' : 'border-green-500'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge label={j.job_type} color={jobTypeColor(j.job_type)}/>
                  <Badge label={j.priority} color={priorityColor(j.priority)}/>
                  <Badge label={j.status} color={j.status === 'completed' ? 'green' : j.status === 'dispatched' || j.status === 'in_progress' ? 'amber' : j.status === 'cancelled' ? 'gray' : 'blue'}/>
                  <span className="text-xs text-gray-400">#{j.id}</span>
                </div>
                <p className="font-semibold text-sm">{j.customer_name}</p>
                <p className="text-xs text-gray-500">{j.customer_address}</p>
                <p className="text-xs text-gray-600 mt-1">{j.description}</p>
                {j.technician_name && <p className="text-xs text-gray-400 mt-0.5">Tech: {j.technician_name}</p>}
                {j.scheduled_date && <p className="text-xs text-gray-400">Scheduled: {fmtDate(j.scheduled_date)}</p>}
                {j.total_amount != null && <p className="text-xs font-mono text-green-700 mt-0.5">Total: {fmtCad(j.total_amount)}</p>}
              </div>
              <div className="flex flex-col gap-1">
                {(j.status === 'scheduled') && (
                  <button onClick={() => dispatch(j)} disabled={actionId === j.id} className="text-xs px-3 py-1 bg-amber-600 text-white rounded disabled:opacity-50">
                    {actionId === j.id ? '…' : 'Dispatch'}
                  </button>
                )}
                {(j.status === 'dispatched' || j.status === 'in_progress') && (
                  <button onClick={() => complete(j)} disabled={actionId === j.id} className="text-xs px-3 py-1 bg-green-600 text-white rounded disabled:opacity-50">
                    {actionId === j.id ? '…' : 'Complete'}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="py-8 text-center text-gray-400">No jobs found.</div>}
      </div>
    </div>
  );
}

// ─── Parts Tab ─────────────────────────────────────────────────────────────────
function PartsTab({ parts, reload }: { parts: Part[]; reload: () => void }) {
  const [search, setSearch] = useState('');
  const [adjustId, setAdjustId] = useState<number | null>(null);
  const [adjustQty, setAdjustQty] = useState('');

  const filtered = parts.filter(p => !search || `${p.name} ${p.part_number} ${p.category}`.toLowerCase().includes(search.toLowerCase()));

  async function adjust(id: number) {
    const delta = parseInt(adjustQty);
    if (isNaN(delta)) return;
    const cur = parts.find(p => p.id === id);
    if (!cur) return;
    await fetch(`/api/admin/hvac-services/parts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity_on_hand: cur.quantity_on_hand + delta }),
    });
    setAdjustId(null); setAdjustQty(''); reload();
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <input className="border rounded-lg px-3 py-1.5 text-sm flex-1" placeholder="Search part name, number, category…" value={search} onChange={e => setSearch(e.target.value)}/>
        <span className="text-sm text-gray-400">{filtered.length} parts</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-3 py-2 font-medium text-gray-600">Part</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Category</th>
              <th className="text-right px-3 py-2 font-medium text-gray-600">Qty On Hand</th>
              <th className="text-right px-3 py-2 font-medium text-gray-600">Reorder At</th>
              <th className="text-right px-3 py-2 font-medium text-gray-600">Cost</th>
              <th className="text-right px-3 py-2 font-medium text-gray-600">Sell Price</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => {
              const isLow = p.quantity_on_hand <= p.reorder_point;
              return (
                <tr key={p.id} className={`border-b hover:bg-gray-50 ${isLow ? 'bg-red-50' : ''}`}>
                  <td className="px-3 py-2">
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs font-mono text-gray-400">{p.part_number}</p>
                    {p.supplier && <p className="text-xs text-gray-400">{p.supplier}</p>}
                  </td>
                  <td className="px-3 py-2"><Badge label={p.category} color="blue"/></td>
                  <td className={`px-3 py-2 text-right font-bold ${isLow ? 'text-red-600' : ''}`}>{p.quantity_on_hand}</td>
                  <td className="px-3 py-2 text-right text-gray-400">{p.reorder_point}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtCad(p.cost_price)}</td>
                  <td className="px-3 py-2 text-right font-mono font-medium">{fmtCad(p.sell_price)}</td>
                  <td className="px-3 py-2">
                    {adjustId === p.id ? (
                      <div className="flex items-center gap-1">
                        <input type="number" className="border rounded px-1 py-0.5 text-xs w-16" placeholder="±qty" value={adjustQty} onChange={e => setAdjustQty(e.target.value)}/>
                        <button onClick={() => adjust(p.id)} className="text-xs px-2 py-0.5 bg-blue-600 text-white rounded">Save</button>
                        <button onClick={() => setAdjustId(null)} className="text-xs px-1 py-0.5 text-gray-500">✕</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setAdjustId(p.id); setAdjustQty(''); }} className="text-xs px-2 py-0.5 bg-gray-100 rounded">Adjust</button>
                        {isLow && <span className="text-xs text-red-600 font-semibold">LOW</span>}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">No parts found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Rebates Tab ───────────────────────────────────────────────────────────────
function RebatesTab({ rebates }: { rebates: Rebate[] }) {
  const statusGroups = ['draft', 'submitted', 'pending', 'approved', 'rejected'];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-5 gap-3">
        {statusGroups.map(s => {
          const group = rebates.filter(r => r.status === s);
          const total = group.reduce((acc, r) => acc + r.rebate_amount, 0);
          return (
            <div key={s} className="bg-white rounded-lg border p-3 text-center">
              <Badge label={s} color={rebateStatusColor(s)}/>
              <p className="text-2xl font-bold mt-2">{group.length}</p>
              <p className="text-xs text-gray-400 mt-0.5">{fmtCad(total)}</p>
            </div>
          );
        })}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-3 py-2 font-medium text-gray-600">Customer</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Program</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Utility</th>
              <th className="text-right px-3 py-2 font-medium text-gray-600">Amount</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Status</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Submitted</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Approved</th>
            </tr>
          </thead>
          <tbody>
            {rebates.map(r => (
              <tr key={r.id} className="border-b hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{r.customer_name}</td>
                <td className="px-3 py-2 text-gray-600">{r.program_name}</td>
                <td className="px-3 py-2 text-xs text-gray-500">{r.utility_provider}</td>
                <td className="px-3 py-2 text-right font-mono font-bold text-green-700">{fmtCad(r.rebate_amount)}</td>
                <td className="px-3 py-2"><Badge label={r.status} color={rebateStatusColor(r.status)}/></td>
                <td className="px-3 py-2 text-xs">{fmtDate(r.submitted_date)}</td>
                <td className="px-3 py-2 text-xs">{fmtDate(r.approved_date)}</td>
              </tr>
            ))}
            {rebates.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">No rebates tracked yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── AI Tools Tab ─────────────────────────────────────────────────────────────
function AIToolsTab() {
  const [symptoms, setSymptoms] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [diagLoading, setDiagLoading] = useState(false);

  const [custName, setCustName] = useState('');
  const [equipType, setEquipType] = useState('');
  const [systemAge, setSystemAge] = useState('');
  const [schedule, setSchedule] = useState('');
  const [schedLoading, setSchedLoading] = useState(false);

  async function runDiagnosis() {
    if (!symptoms) return;
    setDiagLoading(true); setDiagnosis('');
    try {
      const res = await fetch('/api/admin/hvac-services/ai-diagnosis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symptoms }),
      });
      const data = await res.json() as { diagnosis?: string; result?: string; error?: string };
      setDiagnosis(data.diagnosis ?? data.result ?? JSON.stringify(data));
    } finally { setDiagLoading(false); }
  }

  async function generateSchedule() {
    if (!custName || !equipType) return;
    setSchedLoading(true); setSchedule('');
    try {
      const res = await fetch('/api/admin/hvac-services/ai-maintenance-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_name: custName, equipment_type: equipType, system_age_years: systemAge ? parseInt(systemAge) : undefined }),
      });
      const data = await res.json() as { schedule?: string; maintenance_schedule?: string; error?: string };
      setSchedule(data.schedule ?? data.maintenance_schedule ?? JSON.stringify(data));
    } finally { setSchedLoading(false); }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
      {/* Diagnostic Assistant */}
      <div className="bg-white rounded-xl border p-5">
        <h3 className="font-bold text-slate-700 mb-1">Diagnostic Assistant</h3>
        <p className="text-xs text-gray-400 mb-4">Enter symptoms → get probable cause and recommended action</p>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500">Symptom Description *</label>
            <textarea
              className="w-full border rounded px-2 py-1.5 text-sm mt-0.5"
              rows={4}
              value={symptoms}
              onChange={e => setSymptoms(e.target.value)}
              placeholder="e.g. Unit runs but no heat. Blower works. Burner ignites then shuts off after 3 seconds. Gas smell present."
            />
          </div>
          <button onClick={runDiagnosis} disabled={!symptoms || diagLoading} className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
            {diagLoading ? 'Diagnosing…' : 'Run Diagnosis'}
          </button>
          {diagnosis && <div className="bg-gray-50 rounded-lg p-3 text-xs whitespace-pre-wrap max-h-60 overflow-y-auto">{diagnosis}</div>}
        </div>
      </div>
      {/* Maintenance Schedule Generator */}
      <div className="bg-white rounded-xl border p-5">
        <h3 className="font-bold text-slate-700 mb-1">Maintenance Schedule Generator</h3>
        <p className="text-xs text-gray-400 mb-4">Generate a seasonal maintenance plan for a customer's system</p>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500">Customer Name *</label>
            <input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={custName} onChange={e => setCustName(e.target.value)} placeholder="e.g. John Smith"/>
          </div>
          <div>
            <label className="text-xs text-gray-500">Equipment Type *</label>
            <input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={equipType} onChange={e => setEquipType(e.target.value)} placeholder="e.g. Gas furnace + central AC"/>
          </div>
          <div>
            <label className="text-xs text-gray-500">System Age (years)</label>
            <input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={systemAge} onChange={e => setSystemAge(e.target.value)} placeholder="e.g. 8"/>
          </div>
          <button onClick={generateSchedule} disabled={!custName || !equipType || schedLoading} className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
            {schedLoading ? 'Generating…' : 'Generate Schedule'}
          </button>
          {schedule && <div className="bg-gray-50 rounded-lg p-3 text-xs whitespace-pre-wrap max-h-60 overflow-y-auto">{schedule}</div>}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function HvacServicesPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [stats, setStats] = useState<Stats | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [rebates, setRebates] = useState<Rebate[]>([]);

  const loadAll = useCallback(async () => {
    const [s, c, eq, j, p, r] = await Promise.all([
      fetch('/api/admin/hvac-services').then(r => r.json()).catch(() => null),
      fetch('/api/admin/hvac-services/customers').then(r => r.json()).catch(() => []),
      fetch('/api/admin/hvac-services/equipment').then(r => r.json()).catch(() => []),
      fetch('/api/admin/hvac-services/jobs').then(r => r.json()).catch(() => []),
      fetch('/api/admin/hvac-services/parts').then(r => r.json()).catch(() => []),
      fetch('/api/admin/hvac-services/rebates').then(r => r.json()).catch(() => []),
    ]);
    setStats(s);
    setCustomers(Array.isArray(c) ? c : (c?.customers ?? []));
    setEquipment(Array.isArray(eq) ? eq : (eq?.equipment ?? []));
    setJobs(Array.isArray(j) ? j : (j?.jobs ?? []));
    setParts(Array.isArray(p) ? p : (p?.parts ?? []));
    setRebates(Array.isArray(r) ? r : (r?.rebates ?? []));
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const emergencyCount = jobs.filter(j => j.priority === 'emergency' && j.status !== 'completed' && j.status !== 'cancelled').length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-slate-800 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
            <span className="text-white text-sm font-bold">HV</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">HVAC Services Hub</h1>
            <p className="text-xs text-slate-400">Customer Contracts · Job Dispatch · Equipment · Parts · ERA Rebates</p>
          </div>
          {emergencyCount > 0 && (
            <div className="ml-auto bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full">
              {emergencyCount} EMERGENCY
            </div>
          )}
        </div>
      </div>
      <div className="border-b bg-white px-6">
        <div className="flex gap-0 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {TAB_LABELS[t]}
              {t === 'jobs' && emergencyCount > 0 && <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1">{emergencyCount}</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="p-6">
        {tab === 'dashboard' && <DashboardTab stats={stats}/>}
        {tab === 'customers' && <CustomersTab customers={customers} reload={loadAll}/>}
        {tab === 'equipment' && <EquipmentTab equipment={equipment}/>}
        {tab === 'jobs' && <JobsTab jobs={jobs} reload={loadAll}/>}
        {tab === 'parts' && <PartsTab parts={parts} reload={loadAll}/>}
        {tab === 'rebates' && <RebatesTab rebates={rebates}/>}
        {tab === 'ai' && <AIToolsTab/>}
      </div>
    </div>
  );
}
