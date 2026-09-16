'use client';
import { useEffect, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan: string | null;
  capability_count: string | number;
  created_at: string;
}

interface FranchiseAgreement {
  id: string;
  franchisee_name?: string;
  branch_name?: string;
  royalty_percent?: number;
  monthly_fee?: number;
  status?: string;
  end_date?: string;
  currency?: string;
  [key: string]: unknown;
}

interface CorporateProgram {
  id: string;
  company_name?: string;
  program_name?: string;
  enrolled_count?: number;
  max_seats?: number;
  price_per_employee?: number;
  status?: string;
  [key: string]: unknown;
}

interface AuditEntry {
  id: string;
  action?: string;
  actor?: string;
  entity_type?: string;
  entity_id?: string;
  created_at?: string;
  [key: string]: unknown;
}

interface EnterpriseData {
  summary: {
    totalTenants: number;
    activeTenants: number;
    franchiseAgreements: number;
    corporatePrograms: number;
  };
  tenants: Tenant[];
  franchises: FranchiseAgreement[];
  corporatePrograms: CorporateProgram[];
  audits: AuditEntry[];
}

// ── Shared UI ────────────────────────────────────────────────────────────────

const TABS = ['Overview', 'Tenants', 'Franchise', 'Corporate Wellness', 'Audit'] as const;
type Tab = typeof TABS[number];

function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const colors: Record<string, string> = {
    blue:   'bg-blue-50 border-blue-200 text-blue-700',
    green:  'bg-green-50 border-green-200 text-green-700',
    amber:  'bg-amber-50 border-amber-200 text-amber-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    rose:   'bg-rose-50 border-rose-200 text-rose-700',
  };
  return (
    <div className={`border rounded-lg p-4 ${colors[color] ?? colors.blue}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm font-medium mt-1">{label}</div>
      {sub && <div className="text-xs opacity-70 mt-1">{sub}</div>}
    </div>
  );
}

function Badge({ label, color = 'gray' }: { label: string; color?: string }) {
  const colors: Record<string, string> = {
    green:  'bg-green-100 text-green-700',
    amber:  'bg-amber-100 text-amber-700',
    red:    'bg-red-100 text-red-700',
    blue:   'bg-blue-100 text-blue-700',
    gray:   'bg-gray-100 text-gray-600',
    purple: 'bg-purple-100 text-purple-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[color] ?? colors.gray}`}>
      {label}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="border border-dashed border-gray-300 rounded-lg p-8 text-center text-sm text-gray-400">
      {message}
    </div>
  );
}

function fmt(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString();
}

// ── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ summary }: { summary: EnterpriseData['summary'] }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total Tenants"         value={summary.totalTenants}        color="blue"   />
        <KpiCard label="Active Tenants"        value={summary.activeTenants}       color="green"  />
        <KpiCard label="Franchise Agreements"  value={summary.franchiseAgreements} color="purple" />
        <KpiCard label="Corporate Programs"    value={summary.corporatePrograms}   color="amber"  />
      </div>
      <div className="border rounded-lg p-4 bg-blue-50 border-blue-200 text-sm text-blue-800">
        Data is live from the database. Franchise agreements and corporate programs show honest counts —
        empty tables will show 0. Use the tabs above to inspect each entity type.
      </div>
    </div>
  );
}

// ── Tenants Tab ───────────────────────────────────────────────────────────────

function statusColor(s: string) {
  if (s === 'active') return 'green';
  if (s === 'suspended' || s === 'inactive') return 'red';
  if (s === 'pending_setup' || s === 'draft') return 'amber';
  return 'gray';
}

function TenantsTab({ tenants }: { tenants: Tenant[] }) {
  if (!tenants.length) return <EmptyState message="No tenants in the database yet." />;
  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
          <tr>
            {['Name', 'Slug', 'Status', 'Plan', 'Capabilities', 'Created'].map(h => (
              <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {tenants.map(t => (
            <tr key={t.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium">{t.name}</td>
              <td className="px-4 py-3 font-mono text-xs text-gray-500">{t.slug}</td>
              <td className="px-4 py-3">
                <Badge label={t.status} color={statusColor(t.status)} />
              </td>
              <td className="px-4 py-3 text-gray-600">{t.plan ?? '—'}</td>
              <td className="px-4 py-3">{t.capability_count}</td>
              <td className="px-4 py-3 text-gray-500">{fmt(t.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Franchise Tab ─────────────────────────────────────────────────────────────

function FranchiseTab({ franchises }: { franchises: FranchiseAgreement[] }) {
  if (!franchises.length) {
    return (
      <div className="space-y-4">
        <EmptyState message="No franchise agreements in the database yet. Add agreements via the franchise management API." />
        <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 text-sm text-blue-800">
          Franchise agreements are stored in the <code className="bg-blue-100 px-1 rounded">franchise_agreement</code> table.
          The GET /api/admin/enterprise endpoint populates this tab when rows exist.
        </div>
      </div>
    );
  }
  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
          <tr>
            {Object.keys(franchises[0]).filter(k => k !== 'id').slice(0, 6).map(h => (
              <th key={h} className="px-4 py-3 text-left font-medium">{h.replace(/_/g, ' ')}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {franchises.map(f => (
            <tr key={f.id} className="hover:bg-gray-50">
              {Object.entries(f).filter(([k]) => k !== 'id').slice(0, 6).map(([k, v]) => (
                <td key={k} className="px-4 py-3 text-gray-700">
                  {v === null || v === undefined ? '—' : String(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Corporate Wellness Tab ────────────────────────────────────────────────────

function CorporateWellnessTab({ programs }: { programs: CorporateProgram[] }) {
  if (!programs.length) {
    return (
      <div className="space-y-4">
        <EmptyState message="No corporate wellness programs in the database yet. Add programs via the API." />
        <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 text-sm text-blue-800">
          Programs are stored in <code className="bg-blue-100 px-1 rounded">corporate_wellness_program</code>.
          Stats join from <code className="bg-blue-100 px-1 rounded">v_corporate_program_stats</code>.
        </div>
      </div>
    );
  }
  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
          <tr>
            {Object.keys(programs[0]).filter(k => k !== 'id').slice(0, 6).map(h => (
              <th key={h} className="px-4 py-3 text-left font-medium">{h.replace(/_/g, ' ')}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {programs.map(p => (
            <tr key={p.id} className="hover:bg-gray-50">
              {Object.entries(p).filter(([k]) => k !== 'id').slice(0, 6).map(([k, v]) => (
                <td key={k} className="px-4 py-3 text-gray-700">
                  {v === null || v === undefined ? '—' : String(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Audit Tab ─────────────────────────────────────────────────────────────────

function AuditTab({ audits }: { audits: AuditEntry[] }) {
  if (!audits.length) {
    return (
      <div className="space-y-4">
        <EmptyState message="No audit log entries yet. Actions on enterprise entities will be logged here." />
        <div className="border border-gray-200 bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
          Audit entries are stored in <code className="bg-gray-100 px-1 rounded">enterprise_audit</code>.
          This tab shows the last 100 entries ordered by most-recent first.
        </div>
      </div>
    );
  }
  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
          <tr>
            {['Action', 'Actor', 'Entity Type', 'Entity ID', 'Timestamp'].map(h => (
              <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {audits.map(a => (
            <tr key={a.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium">{a.action ?? '—'}</td>
              <td className="px-4 py-3 text-gray-600">{a.actor ?? '—'}</td>
              <td className="px-4 py-3 text-gray-500">{a.entity_type ?? '—'}</td>
              <td className="px-4 py-3 font-mono text-xs text-gray-400">{a.entity_id ? String(a.entity_id).slice(0, 8) + '…' : '—'}</td>
              <td className="px-4 py-3 text-gray-500">{fmt(a.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EnterpriseAdminPage() {
  const [tab, setTab] = useState<Tab>('Overview');
  const [data, setData] = useState<EnterpriseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/enterprise', { cache: 'no-store' })
      .then(async r => {
        const d = await r.json() as EnterpriseData | { error: string };
        if (!r.ok) throw new Error(('error' in d ? d.error : undefined) ?? `HTTP ${r.status}`);
        setData(d as EnterpriseData);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Enterprise & Multi-Tenant</h1>
        <p className="text-sm text-gray-500 mt-1">
          Tenants, franchise agreements, corporate wellness programs, and audit log — live from database.
        </p>
      </div>

      {/* Tab bar */}
      <div className="border-b flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === t
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading && (
        <div className="text-sm text-gray-400 py-8 text-center">Loading enterprise data…</div>
      )}

      {error && (
        <div className="border border-red-200 bg-red-50 rounded-lg p-4 text-sm text-red-700">{error}</div>
      )}

      {data && (
        <>
          {tab === 'Overview'           && <OverviewTab summary={data.summary} />}
          {tab === 'Tenants'            && <TenantsTab tenants={data.tenants} />}
          {tab === 'Franchise'          && <FranchiseTab franchises={data.franchises} />}
          {tab === 'Corporate Wellness' && <CorporateWellnessTab programs={data.corporatePrograms} />}
          {tab === 'Audit'              && <AuditTab audits={data.audits} />}
        </>
      )}
    </div>
  );
}
