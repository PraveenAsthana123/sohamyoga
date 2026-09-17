'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard','clients','fields','jobs','equipment','grain'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab,string> = {
  dashboard: 'Dashboard',
  clients: 'Clients',
  fields: 'Fields',
  jobs: 'Jobs',
  equipment: 'Equipment',
  grain: 'Grain Marketing',
};

interface DashData {
  total_clients: number;
  active_field_contracts: number;
  acres_under_management: number;
  crop_insurance_filed_ytd: number;
  equipment_scheduled_this_week: number;
  revenue_mtd: number;
}
interface AgClient {
  id: number;
  farm_name: string;
  operator_name: string;
  email: string;
  phone: string;
  municipality: string;
  province: string;
  total_acres: number;
  operation_type: string;
  primary_crops: string[];
  carbon_credit_enrolled: boolean;
  is_active: boolean;
}
interface AgField {
  id: number;
  field_name: string;
  farm_name: string;
  operator_name: string;
  acres: number;
  soil_zone: string;
  crop_this_year: string;
  crop_last_year: string;
  seeding_date: string;
  expected_harvest_date: string;
  yield_estimate_bu_ac: number;
  actual_yield_bu_ac: number | null;
}
interface AgJob {
  id: number;
  farm_name: string;
  field_name: string | null;
  job_type: string;
  status: string;
  scheduled_date: string;
  completed_date: string | null;
  operator_name: string;
  equipment_used: string;
  acres_done: number;
  total_cost: number;
}
interface AgEquipment {
  id: number;
  name: string;
  type: string;
  make: string;
  model: string;
  year: number;
  hours_meter: number;
  next_service_hours: number;
  condition: string;
  insurance_expiry: string;
  is_available: boolean;
}
interface GrainContract {
  id: number;
  farm_name: string;
  commodity: string;
  contract_type: string;
  bushels_contracted: number;
  price_per_bu: number;
  delivery_start: string;
  delivery_end: string;
  buyer_name: string;
  status: string;
  bushels_delivered: number;
}

function fmtCad(n: number) { return `$${Number(n ?? 0).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString('en-CA') : '—'; }
function daysUntil(d: string) { return Math.round((new Date(d).getTime() - Date.now()) / 86400000); }

function Badge({ label, color = 'gray' }: { label: string; color?: string }) {
  const m: Record<string,string> = {
    blue: 'bg-blue-100 text-blue-700', green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700',
    purple: 'bg-purple-100 text-purple-700', gray: 'bg-gray-100 text-gray-700',
    teal: 'bg-teal-100 text-teal-700', brown: 'bg-orange-100 text-orange-800',
    darkbrown: 'bg-orange-200 text-orange-900',
  };
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${m[color] ?? m.gray}`}>{label.replace(/_/g, ' ')}</span>;
}

function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const b: Record<string,string> = {
    blue: 'border-l-4 border-blue-500 bg-blue-50', green: 'border-l-4 border-green-500 bg-green-50',
    amber: 'border-l-4 border-amber-500 bg-amber-50', red: 'border-l-4 border-red-500 bg-red-50',
    purple: 'border-l-4 border-purple-500 bg-purple-50',
  };
  return (
    <div className={`rounded-lg p-4 ${b[color] ?? b.blue}`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function opTypeColor(t: string): string {
  const m: Record<string,string> = { grain: 'blue', livestock: 'amber', mixed: 'teal', specialty: 'purple', organic: 'green' };
  return m[t] ?? 'gray';
}
function soilColor(z: string): string {
  const m: Record<string,string> = { black: 'gray', dark_brown: 'darkbrown', brown: 'brown', gray: 'gray' };
  return m[z] ?? 'gray';
}
function soilLabel(z: string): string {
  const m: Record<string,string> = { black: 'Black', dark_brown: 'Dark Brown', brown: 'Brown', gray: 'Gray' };
  return m[z] ?? z;
}
function conditionColor(c: string): string {
  const m: Record<string,string> = { excellent: 'green', good: 'blue', fair: 'amber', poor: 'red' };
  return m[c] ?? 'gray';
}
function contractColor(c: string): string {
  const m: Record<string,string> = { basis: 'blue', flat_price: 'green', deferred: 'purple', pool: 'teal' };
  return m[c] ?? 'gray';
}
function jobStatusColor(s: string): string {
  const m: Record<string,string> = { scheduled: 'blue', in_progress: 'amber', completed: 'green', cancelled: 'red' };
  return m[s] ?? 'gray';
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────
function DashboardTab({ dash }: { dash: DashData | null }) {
  if (!dash) return <div className="p-8 text-center text-gray-400">Loading…</div>;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard label="Total Clients" value={dash.total_clients} color="blue" />
        <KpiCard label="Active Field Contracts" value={dash.active_field_contracts} color="green" />
        <KpiCard label="Acres Under Management" value={dash.acres_under_management.toLocaleString('en-CA')} color="amber" />
        <KpiCard label="Crop Insurance Filed (YTD)" value={dash.crop_insurance_filed_ytd} color="teal" />
        <KpiCard label="Equipment Jobs This Week" value={dash.equipment_scheduled_this_week} color="purple" />
        <KpiCard label="Revenue MTD" value={fmtCad(dash.revenue_mtd)} color="green" />
      </div>
    </div>
  );
}

// ─── Clients ───────────────────────────────────────────────────────────────────
function ClientsTab() {
  const [clients, setClients] = useState<AgClient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/farm-agricultural/clients')
      .then(r => r.json())
      .then(d => setClients(d.clients ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center text-gray-400">Loading…</div>;
  return (
    <div className="space-y-3">
      {clients.map(c => (
        <div key={c.id} className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-semibold text-gray-900">{c.farm_name}</span>
            <Badge label={c.operation_type} color={opTypeColor(c.operation_type)} />
            {c.carbon_credit_enrolled && <Badge label="Carbon Credits" color="green" />}
          </div>
          <div className="text-sm text-gray-600">
            <span className="font-medium">{c.operator_name}</span> · {c.municipality}, {c.province}
          </div>
          <div className="flex gap-4 mt-2 text-xs text-gray-500">
            <span>{c.total_acres?.toLocaleString('en-CA')} acres</span>
            {c.email && <span>{c.email}</span>}
            {c.phone && <span>{c.phone}</span>}
            {c.primary_crops?.length > 0 && <span>Crops: {c.primary_crops.join(', ')}</span>}
          </div>
        </div>
      ))}
      {clients.length === 0 && <div className="text-gray-400 text-center py-8">No clients found.</div>}
    </div>
  );
}

// ─── Fields ────────────────────────────────────────────────────────────────────
function FieldsTab() {
  const [fields, setFields] = useState<AgField[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/farm-agricultural/fields')
      .then(r => r.json())
      .then(d => setFields(d.fields ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center text-gray-400">Loading…</div>;
  return (
    <div className="space-y-3">
      {fields.map(f => {
        const pct = f.yield_estimate_bu_ac && f.actual_yield_bu_ac
          ? Math.min(100, Math.round((f.actual_yield_bu_ac / f.yield_estimate_bu_ac) * 100))
          : null;
        return (
          <div key={f.id} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-semibold text-gray-900">{f.field_name}</span>
              <Badge label={soilLabel(f.soil_zone)} color={soilColor(f.soil_zone)} />
              {f.crop_this_year && <Badge label={f.crop_this_year} color="green" />}
            </div>
            <div className="text-sm text-gray-600">{f.farm_name} · {f.operator_name}</div>
            <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500">
              <span>{f.acres} acres</span>
              {f.seeding_date && <span>Seeded: {fmtDate(f.seeding_date)}</span>}
              {f.expected_harvest_date && <span>Est. Harvest: {fmtDate(f.expected_harvest_date)}</span>}
              {f.crop_last_year && <span>Last year: {f.crop_last_year}</span>}
            </div>
            {f.yield_estimate_bu_ac > 0 && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Yield: est {f.yield_estimate_bu_ac} bu/ac{f.actual_yield_bu_ac ? ` · actual ${f.actual_yield_bu_ac} bu/ac` : ' · pending'}</span>
                  {pct !== null && <span>{pct}%</span>}
                </div>
                {pct !== null && (
                  <div className="w-full bg-gray-200 rounded h-2">
                    <div className={`h-2 rounded ${pct >= 90 ? 'bg-green-500' : pct >= 70 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${pct}%` }} />
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
      {fields.length === 0 && <div className="text-gray-400 text-center py-8">No fields found.</div>}
    </div>
  );
}

// ─── Jobs ──────────────────────────────────────────────────────────────────────
function JobsTab() {
  const [jobs, setJobs] = useState<AgJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/farm-agricultural/jobs')
      .then(r => r.json())
      .then(d => setJobs(d.jobs ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function completeJob(id: number) {
    setCompleting(id);
    await fetch(`/api/admin/farm-agricultural/jobs/${id}/complete`, { method: 'POST' });
    setCompleting(null);
    load();
  }

  if (loading) return <div className="p-8 text-center text-gray-400">Loading…</div>;
  return (
    <div className="space-y-3">
      {jobs.map(j => (
        <div key={j.id} className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge label={j.job_type} color="blue" />
              <Badge label={j.status} color={jobStatusColor(j.status)} />
            </div>
            {j.status === 'scheduled' && (
              <button
                onClick={() => completeJob(j.id)}
                disabled={completing === j.id}
                className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50"
              >
                {completing === j.id ? 'Completing…' : 'Mark Complete'}
              </button>
            )}
          </div>
          <div className="text-sm font-medium text-gray-800">{j.farm_name}{j.field_name ? ` — ${j.field_name}` : ''}</div>
          <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500">
            {j.scheduled_date && <span>Scheduled: {fmtDate(j.scheduled_date)}</span>}
            {j.completed_date && <span>Completed: {fmtDate(j.completed_date)}</span>}
            {j.operator_name && <span>Operator: {j.operator_name}</span>}
            {j.equipment_used && <span>Equipment: {j.equipment_used}</span>}
            {j.acres_done > 0 && <span>{j.acres_done} acres</span>}
            {j.total_cost > 0 && <span>{fmtCad(j.total_cost)}</span>}
          </div>
        </div>
      ))}
      {jobs.length === 0 && <div className="text-gray-400 text-center py-8">No jobs found.</div>}
    </div>
  );
}

// ─── Equipment ─────────────────────────────────────────────────────────────────
function EquipmentTab() {
  const [equipment, setEquipment] = useState<AgEquipment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/farm-agricultural/equipment')
      .then(r => r.json())
      .then(d => setEquipment(d.equipment ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center text-gray-400">Loading…</div>;
  return (
    <div className="space-y-3">
      {equipment.map(e => {
        const serviceDue = e.next_service_hours > 0 && e.hours_meter >= e.next_service_hours - 50;
        const insExpDays = e.insurance_expiry ? daysUntil(e.insurance_expiry) : null;
        return (
          <div key={e.id} className={`bg-white border rounded-lg p-4 ${serviceDue ? 'border-amber-400' : 'border-gray-200'}`}>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-semibold text-gray-900">{e.name}</span>
              <Badge label={e.condition} color={conditionColor(e.condition)} />
              {serviceDue && <Badge label="Service Due" color="amber" />}
              <Badge label={e.is_available ? 'Available' : 'Unavailable'} color={e.is_available ? 'green' : 'red'} />
            </div>
            <div className="text-sm text-gray-600">{e.year} {e.make} {e.model}</div>
            <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500">
              {e.hours_meter > 0 && <span>Hours: {e.hours_meter.toLocaleString('en-CA')}</span>}
              {e.next_service_hours > 0 && <span>Next service at: {e.next_service_hours.toLocaleString('en-CA')} hrs</span>}
              {e.insurance_expiry && (
                <span className={insExpDays !== null && insExpDays < 60 ? 'text-red-600 font-medium' : ''}>
                  Insurance expires: {fmtDate(e.insurance_expiry)}{insExpDays !== null && insExpDays < 60 ? ` (${insExpDays}d)` : ''}
                </span>
              )}
            </div>
          </div>
        );
      })}
      {equipment.length === 0 && <div className="text-gray-400 text-center py-8">No equipment found.</div>}
    </div>
  );
}

// ─── Grain Marketing ───────────────────────────────────────────────────────────
function GrainTab() {
  const [contracts, setContracts] = useState<GrainContract[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/farm-agricultural/grain-contracts')
      .then(r => r.json())
      .then(d => setContracts(d.contracts ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center text-gray-400">Loading…</div>;
  return (
    <div className="space-y-3">
      {contracts.map(c => {
        const pct = c.bushels_contracted > 0
          ? Math.min(100, Math.round((c.bushels_delivered / c.bushels_contracted) * 100))
          : 0;
        return (
          <div key={c.id} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-semibold capitalize text-gray-900">{c.commodity}</span>
              <Badge label={c.contract_type} color={contractColor(c.contract_type)} />
              <Badge label={c.status} color={c.status === 'open' ? 'blue' : c.status === 'partial' ? 'amber' : 'green'} />
            </div>
            <div className="text-sm text-gray-600">{c.farm_name} · {c.buyer_name}</div>
            <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500">
              <span>{c.bushels_contracted?.toLocaleString('en-CA')} bu contracted @ ${c.price_per_bu}/bu</span>
              <span>Delivery: {fmtDate(c.delivery_start)} – {fmtDate(c.delivery_end)}</span>
            </div>
            <div className="mt-3">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Delivered: {c.bushels_delivered?.toLocaleString('en-CA')} / {c.bushels_contracted?.toLocaleString('en-CA')} bu</span>
                <span>{pct}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded h-2">
                <div className={`h-2 rounded ${pct === 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>
        );
      })}
      {contracts.length === 0 && <div className="text-gray-400 text-center py-8">No grain contracts found.</div>}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function FarmAgriculturalPage() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [dash, setDash] = useState<DashData | null>(null);

  useEffect(() => {
    fetch('/api/admin/farm-agricultural')
      .then(r => r.json())
      .then(d => setDash(d));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">Farm &amp; Agricultural Services</h1>
        <p className="text-sm text-gray-500 mt-1">Client operations, field management, equipment, and grain marketing</p>
      </div>

      <div className="bg-white border-b border-gray-200 px-6">
        <nav className="flex gap-1 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab
                  ? 'border-green-600 text-green-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </nav>
      </div>

      <div className="p-6">
        {activeTab === 'dashboard' && <DashboardTab dash={dash} />}
        {activeTab === 'clients' && <ClientsTab />}
        {activeTab === 'fields' && <FieldsTab />}
        {activeTab === 'jobs' && <JobsTab />}
        {activeTab === 'equipment' && <EquipmentTab />}
        {activeTab === 'grain' && <GrainTab />}
      </div>
    </div>
  );
}
