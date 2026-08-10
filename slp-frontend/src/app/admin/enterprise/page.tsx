'use client';
import { useState } from 'react';

const TABS = ['Overview', 'Branches', 'Franchise', 'Corporate Wellness', 'White Label', 'Analytics', 'Integrations'] as const;
type Tab = typeof TABS[number];

// ── Shared UI primitives ──────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string; sub?: string; color?: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    rose: 'bg-rose-50 border-rose-200 text-rose-700',
  };
  return (
    <div className={`border rounded-lg p-4 ${colors[color] ?? colors.blue}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm font-medium mt-1">{label}</div>
      {sub && <div className="text-xs opacity-70 mt-1">{sub}</div>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{children}</h3>;
}

function Badge({ label, color = 'gray' }: { label: string; color?: string }) {
  const colors: Record<string, string> = {
    green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700',
    red:   'bg-red-100 text-red-700',
    blue:  'bg-blue-100 text-blue-700',
    gray:  'bg-gray-100 text-gray-600',
    purple:'bg-purple-100 text-purple-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[color] ?? colors.gray}`}>
      {label}
    </span>
  );
}

// ── Overview tab ──────────────────────────────────────────────────────────────

function OverviewTab() {
  const kpis = [
    { label: 'Total Branches',         value: '24',    sub: '18 active, 4 pending, 2 suspended', color: 'blue' },
    { label: 'Franchise Agreements',   value: '11',    sub: '9 active, 2 draft',                 color: 'green' },
    { label: 'Corporate Programs',     value: '7',     sub: '5 active, 2 paused',                color: 'purple' },
    { label: 'White-Label Tenants',    value: '6',     sub: '4 active, 2 draft',                 color: 'amber' },
    { label: 'Monthly Royalties',      value: '$28.4k',sub: 'From 9 active franchise agreements',color: 'rose' },
    { label: 'Corporate Employees',    value: '1,340', sub: 'Across all active programs',        color: 'blue' },
  ];

  const branchTypeData = [
    { type: 'Corporate Owned', count: 8,  pct: 33 },
    { type: 'Franchise',       count: 11, pct: 46 },
    { type: 'Partner',         count: 4,  pct: 17 },
    { type: 'Virtual',         count: 1,  pct: 4  },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map(k => <KpiCard key={k.label} {...k} />)}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="border rounded-lg p-4">
          <SectionTitle>Branch Type Distribution</SectionTitle>
          <div className="space-y-3">
            {branchTypeData.map(d => (
              <div key={d.type}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{d.type}</span>
                  <span className="font-medium">{d.count} ({d.pct}%)</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full">
                  <div className="h-2 bg-blue-500 rounded-full" style={{ width: `${d.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <SectionTitle>Recent Enterprise Activity</SectionTitle>
          <div className="space-y-3 text-sm">
            {[
              { icon: '🏢', text: 'Downtown Mumbai branch activated',       time: '2 hours ago',  color: 'green' },
              { icon: '📄', text: 'Franchise agreement signed — ZenWave Co',time: '5 hours ago',  color: 'blue' },
              { icon: '💼', text: 'TechCorp wellness program enrolled 45',   time: '1 day ago',    color: 'purple' },
              { icon: '🎨', text: 'White-label config activated — OmBrand', time: '2 days ago',   color: 'amber' },
              { icon: '⚠️', text: 'Branch suspended — Bangalore pilot',     time: '3 days ago',   color: 'red' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <span>{item.icon}</span>
                <div className="flex-1">
                  <div>{item.text}</div>
                  <div className="text-gray-400 text-xs">{item.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Branches tab ──────────────────────────────────────────────────────────────

function BranchesTab() {
  const branches = [
    { name: 'Toronto Flagship',  type: 'corporate_owned', status: 'active',    city: 'Toronto',  country: 'CA', capacity: 120, opened: '2023-03-01' },
    { name: 'Mumbai Downtown',   type: 'franchise',       status: 'active',    city: 'Mumbai',   country: 'IN', capacity: 80,  opened: '2024-01-15' },
    { name: 'London West',       type: 'franchise',       status: 'active',    city: 'London',   country: 'GB', capacity: 60,  opened: '2024-06-01' },
    { name: 'Dubai Marina',      type: 'partner',         status: 'active',    city: 'Dubai',    country: 'AE', capacity: 45,  opened: '2025-01-10' },
    { name: 'Bangalore Pilot',   type: 'franchise',       status: 'suspended', city: 'Bangalore',country: 'IN', capacity: 30,  opened: '2025-05-01' },
    { name: 'Singapore East',    type: 'franchise',       status: 'pending_setup', city: 'Singapore',country: 'SG', capacity: 70, opened: null },
    { name: 'Online Studio',     type: 'virtual',         status: 'active',    city: 'Global',   country: '—',  capacity: 500, opened: '2023-01-01' },
  ];

  const statusColor: Record<string, string> = {
    active: 'green', pending_setup: 'amber', suspended: 'red', inactive: 'gray'
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        <KpiCard label="Active"       value="18" color="green" />
        <KpiCard label="Pending Setup" value="4"  color="amber" />
        <KpiCard label="Suspended"    value="2"  color="rose" />
        <KpiCard label="Countries"    value="9"  color="blue" />
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              {['Branch Name','Type','Status','City','Country','Max Cap.','Opened'].map(h => (
                <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {branches.map(b => (
              <tr key={b.name} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{b.name}</td>
                <td className="px-4 py-3"><Badge label={b.type.replace('_', ' ')} color="blue" /></td>
                <td className="px-4 py-3"><Badge label={b.status.replace('_', ' ')} color={statusColor[b.status] ?? 'gray'} /></td>
                <td className="px-4 py-3">{b.city}</td>
                <td className="px-4 py-3">{b.country}</td>
                <td className="px-4 py-3">{b.capacity}</td>
                <td className="px-4 py-3 text-gray-500">{b.opened ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Franchise tab ─────────────────────────────────────────────────────────────

function FranchiseTab() {
  const agreements = [
    { franchisee: 'ZenWave Co',   branch: 'Mumbai Downtown', royalty: 12, monthly: 1200, status: 'active',  endDate: '2028-01-15', currency: 'USD' },
    { franchisee: 'OM Studios UK',branch: 'London West',     royalty: 10, monthly: 1000, status: 'active',  endDate: '2027-06-01', currency: 'GBP' },
    { franchisee: 'Nirvana SG',   branch: 'Singapore East',  royalty: 11, monthly: 900,  status: 'draft',   endDate: '2029-01-01', currency: 'SGD' },
    { franchisee: 'Yoga360 IN',   branch: 'Bangalore Pilot', royalty: 8,  monthly: 600,  status: 'active',  endDate: '2026-12-01', currency: 'INR' },
    { franchisee: 'AuraFlow AE',  branch: 'Dubai Marina',    royalty: 15, monthly: 1500, status: 'active',  endDate: '2027-01-10', currency: 'AED' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <KpiCard label="Active Agreements"   value="9"       color="green" />
        <KpiCard label="Total Monthly Fees"  value="$8,200"  sub="Sum of all active monthly fees" color="blue" />
        <KpiCard label="Total Monthly Royalties" value="$1,025" sub="Avg royalty ~12.5%" color="purple" />
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              {['Franchisee','Branch','Royalty %','Monthly Fee','Royalty $','Status','Expires'].map(h => (
                <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {agreements.map(a => (
              <tr key={a.franchisee} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{a.franchisee}</td>
                <td className="px-4 py-3 text-gray-600">{a.branch}</td>
                <td className="px-4 py-3">{a.royalty}%</td>
                <td className="px-4 py-3">{a.currency} {a.monthly.toLocaleString()}</td>
                <td className="px-4 py-3 text-green-700 font-medium">
                  {a.currency} {Math.round(a.monthly * a.royalty / 100)}
                </td>
                <td className="px-4 py-3">
                  <Badge label={a.status} color={a.status === 'active' ? 'green' : 'amber'} />
                </td>
                <td className="px-4 py-3 text-gray-500">{a.endDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 text-sm">
        <div className="font-semibold text-amber-800 mb-1">Financial PII Notice</div>
        <div className="text-amber-700">
          Franchise royalty and fee data constitutes financial PII under PIPEDA Section 7.
          Export requires staff approval (confirmApprovalId) and is logged in the enterprise audit trail.
        </div>
      </div>
    </div>
  );
}

// ── Corporate Wellness tab ────────────────────────────────────────────────────

function CorporateWellnessTab() {
  const programs = [
    { corp: 'Acme Corp',       program: 'Acme Wellness 2026', enrolled: 450, max: 500, price: 50,  status: 'active',  features: ['yoga', 'meditation', 'pranayama'], currency: 'CAD' },
    { corp: 'TechGiant Inc',   program: 'TechWell Program',   enrolled: 280, max: 300, price: 65,  status: 'active',  features: ['yoga', 'live_classes'],             currency: 'USD' },
    { corp: 'Global Finance',  program: 'Balance & Focus',    enrolled: 200, max: 400, price: 40,  status: 'paused',  features: ['meditation', 'pranayama'],          currency: 'GBP' },
    { corp: 'Startup XYZ',     program: 'Startup Zen',        enrolled: 80,  max: 100, price: 45,  status: 'active',  features: ['yoga'],                             currency: 'USD' },
    { corp: 'HealthOrg',       program: 'Staff Wellness Q3',  enrolled: 0,   max: 200, price: 35,  status: 'draft',   features: [],                                   currency: 'CAD' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <KpiCard label="Active Programs"   value="5"       color="green" />
        <KpiCard label="Total Enrolled"    value="1,010"   sub="Across active programs" color="blue" />
        <KpiCard label="Monthly Revenue"   value="$52,800" sub="Active + paused"        color="purple" />
        <KpiCard label="Avg Utilization"   value="72%"     sub="Enrolled vs max seats"  color="amber" />
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              {['Corporate','Program','Enrolled / Max','Utilization','$/Employee','Monthly Rev','Status','Features'].map(h => (
                <th key={h} className="px-3 py-3 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {programs.map(p => {
              const util = p.max ? Math.round((p.enrolled / p.max) * 100) : 0;
              const rev  = p.enrolled * p.price;
              return (
                <tr key={p.corp} className="hover:bg-gray-50">
                  <td className="px-3 py-3 font-medium">{p.corp}</td>
                  <td className="px-3 py-3 text-gray-600">{p.program}</td>
                  <td className="px-3 py-3">{p.enrolled} / {p.max}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-gray-200 rounded-full">
                        <div className="h-1.5 bg-blue-500 rounded-full" style={{ width: `${util}%` }} />
                      </div>
                      <span>{util}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-3">{p.currency} {p.price}</td>
                  <td className="px-3 py-3 font-medium">{p.currency} {rev.toLocaleString()}</td>
                  <td className="px-3 py-3">
                    <Badge label={p.status} color={p.status === 'active' ? 'green' : p.status === 'paused' ? 'amber' : 'gray'} />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {p.features.map(f => <Badge key={f} label={f} color="blue" />)}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── White Label tab ───────────────────────────────────────────────────────────

function WhiteLabelTab() {
  const configs = [
    { tenant: 'ZenWave Co',   brand: 'ZenWave',    domain: 'app.zenwave.io',    primary: '#4F46E5', secondary: '#FFFFFF', accent: '#F59E0B', status: 'active',   logo: true },
    { tenant: 'OM Studios UK',brand: 'OM Studios', domain: 'studio.omyoga.co',  primary: '#059669', secondary: '#F0FDF4', accent: '#3B82F6', status: 'active',   logo: true },
    { tenant: 'AuraFlow AE',  brand: 'AuraFlow',   domain: null,                primary: '#7C3AED', secondary: '#EDE9FE', accent: '#EC4899', status: 'draft',    logo: false },
    { tenant: 'Nirvana SG',   brand: 'NirvanaYoga',domain: null,                primary: '#DC2626', secondary: '#FEF2F2', accent: '#F97316', status: 'draft',    logo: true },
    { tenant: 'Yoga360 IN',   brand: 'Yoga360',    domain: 'yoga360.in',        primary: '#B45309', secondary: '#FFFBEB', accent: '#10B981', status: 'inactive', logo: true },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <KpiCard label="Active Configs"   value="2" color="green" />
        <KpiCard label="Draft Configs"    value="2" color="amber" />
        <KpiCard label="Custom Domains"   value="3" color="blue" />
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              {['Tenant','Brand','Custom Domain','Colors','Logo','Status'].map(h => (
                <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {configs.map(c => (
              <tr key={c.tenant} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-600 text-xs">{c.tenant}</td>
                <td className="px-4 py-3 font-medium">{c.brand}</td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{c.domain ?? '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {[c.primary, c.secondary, c.accent].map((col, i) => (
                      <div key={i} className="w-5 h-5 rounded border border-gray-200" style={{ backgroundColor: col }} title={col} />
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">{c.logo ? '✓' : <span className="text-gray-300">—</span>}</td>
                <td className="px-4 py-3">
                  <Badge label={c.status} color={c.status === 'active' ? 'green' : c.status === 'draft' ? 'amber' : 'gray'} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 text-sm text-blue-800">
        Activating a white-label config requires a logoUrl. Activation is an admin-only MCP action
        (<code className="bg-blue-100 px-1 rounded">activate_white_label</code>).
      </div>
    </div>
  );
}

// ── Analytics tab ─────────────────────────────────────────────────────────────

function AnalyticsTab() {
  const monthlyRevenue = [
    { month: 'Mar', corp: 38000, royalties: 7200 },
    { month: 'Apr', corp: 42000, royalties: 8100 },
    { month: 'May', corp: 45000, royalties: 8800 },
    { month: 'Jun', corp: 48000, royalties: 9200 },
    { month: 'Jul', corp: 51000, royalties: 10100 },
    { month: 'Aug', corp: 52800, royalties: 10800 },
  ];
  const maxVal = Math.max(...monthlyRevenue.flatMap(m => [m.corp, m.royalties]));

  const geoBreakdown = [
    { country: 'Canada 🇨🇦',    branches: 8,  employees: 520, revenue: '$28k' },
    { country: 'India 🇮🇳',     branches: 6,  employees: 380, revenue: '$12k' },
    { country: 'UK 🇬🇧',        branches: 4,  employees: 210, revenue: '$18k' },
    { country: 'UAE 🇦🇪',       branches: 3,  employees: 140, revenue: '$22k' },
    { country: 'Singapore 🇸🇬', branches: 2,  employees: 90,  revenue: '$15k' },
    { country: 'Global (Virtual)', branches: 1, employees: 0, revenue: '$0' },
  ];

  return (
    <div className="space-y-6">
      <div className="border rounded-lg p-4">
        <SectionTitle>Monthly Revenue — Corporate Wellness vs Franchise Royalties</SectionTitle>
        <div className="flex items-end gap-3 h-40 mt-2">
          {monthlyRevenue.map(m => (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex gap-0.5 items-end" style={{ height: 120 }}>
                <div className="flex-1 bg-purple-400 rounded-t" style={{ height: `${(m.corp / maxVal) * 100}%` }} title={`Corp $${m.corp}`} />
                <div className="flex-1 bg-green-400 rounded-t"  style={{ height: `${(m.royalties / maxVal) * 100}%` }} title={`Royalties $${m.royalties}`} />
              </div>
              <span className="text-xs text-gray-500">{m.month}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-2 text-xs text-gray-500">
          <span><span className="inline-block w-3 h-3 bg-purple-400 rounded mr-1" />Corporate Wellness</span>
          <span><span className="inline-block w-3 h-3 bg-green-400 rounded mr-1" />Franchise Royalties</span>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 text-xs uppercase font-semibold text-gray-500">Geographic Breakdown</div>
        <table className="w-full text-sm">
          <thead className="text-gray-500 text-xs uppercase">
            <tr>
              {['Country','Branches','Corporate Employees','Monthly Revenue'].map(h => (
                <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {geoBreakdown.map(g => (
              <tr key={g.country} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{g.country}</td>
                <td className="px-4 py-3">{g.branches}</td>
                <td className="px-4 py-3">{g.employees}</td>
                <td className="px-4 py-3 font-medium text-green-700">{g.revenue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Integrations tab ──────────────────────────────────────────────────────────

function IntegrationsTab() {
  const mcpTools = [
    { name: 'get_branch_info',              tier: 'auto',              desc: 'Retrieve branch details' },
    { name: 'search_corporate_programs',    tier: 'auto',              desc: 'Search wellness programs' },
    { name: 'create_branch',               tier: 'staff',             desc: 'Create branch location' },
    { name: 'update_branch',               tier: 'staff',             desc: 'Update branch details' },
    { name: 'create_corporate_program',    tier: 'staff',             desc: 'Create corporate program' },
    { name: 'update_white_label',          tier: 'staff',             desc: 'Update white-label config' },
    { name: 'invite_franchisee',           tier: 'staff',             desc: 'Invite new franchisee' },
    { name: 'accept_franchise_terms',      tier: 'customer_confirm',  desc: 'confirmText: ACCEPT_TERMS' },
    { name: 'approve_branch_setup',        tier: 'staff_approval',    desc: 'Approve branch provisioning' },
    { name: 'export_franchise_data',       tier: 'staff_approval',    desc: 'Export franchise data (PII)' },
    { name: 'activate_white_label',        tier: 'admin',             desc: 'Activate WL config' },
    { name: 'suspend_branch',              tier: 'admin',             desc: 'Suspend active branch' },
    { name: 'terminate_franchise_agreement',tier:'admin_destructive', desc: 'Terminate agreement (irreversible)' },
  ];

  const tierColor: Record<string, string> = {
    auto: 'green', staff: 'blue', customer_confirm: 'purple',
    staff_approval: 'amber', admin: 'rose', admin_destructive: 'red',
  };

  const services = [
    { name: 'Twenty CRM',       role: 'Enterprise CRM for franchise + corporate accounts' },
    { name: 'ERPNext / Frappe', role: 'Multi-branch HR, payroll, and inventory' },
    { name: 'Baserow',          role: 'No-code database for franchise tracking' },
    { name: 'Appsmith',         role: 'Partner portal builder' },
    { name: 'Metabase',         role: 'Cross-branch analytics dashboards' },
    { name: 'Keycloak',         role: 'Enterprise SSO for multi-tenant auth' },
    { name: 'MinIO',            role: 'Object storage for contracts and agreements' },
    { name: 'Docuseal',         role: 'Document signing for franchise agreements' },
    { name: 'GrowthBook',       role: 'Feature flags per branch / tenant' },
    { name: 'FreeScout',        role: 'Enterprise helpdesk for franchisees' },
    { name: 'Infisical',        role: 'Secrets management per branch environment' },
    { name: 'Penpot',           role: 'White-label design asset management' },
  ];

  const dbTables = [
    'branch', 'franchise_agreement', 'corporate_wellness_program',
    'corporate_program_feature', 'white_label_config', 'enterprise_audit',
  ];
  const refTables = [
    'ref_branch_type', 'ref_branch_status', 'ref_agreement_status',
    'ref_program_status', 'ref_white_label_status',
  ];
  const views = ['v_active_branches', 'v_franchise_summary', 'v_corporate_program_stats'];

  return (
    <div className="space-y-6">
      <div className="border rounded-lg p-4">
        <SectionTitle>MCP Tools (13 tools — 2/5/1/2/2/1)</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {mcpTools.map(t => (
            <div key={t.name} className="flex items-start gap-2 p-2 rounded border border-gray-100 bg-gray-50">
              <Badge label={t.tier.replace('_', ' ')} color={tierColor[t.tier] ?? 'gray'} />
              <div>
                <div className="font-mono text-xs font-medium">{t.name}</div>
                <div className="text-xs text-gray-500">{t.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="border rounded-lg p-4">
          <SectionTitle>Domain Tables</SectionTitle>
          <div className="space-y-1">
            {dbTables.map(t => <div key={t} className="font-mono text-xs text-gray-700">{t}</div>)}
          </div>
        </div>
        <div className="border rounded-lg p-4">
          <SectionTitle>Reference Tables</SectionTitle>
          <div className="space-y-1">
            {refTables.map(t => <div key={t} className="font-mono text-xs text-gray-700">{t}</div>)}
          </div>
        </div>
        <div className="border rounded-lg p-4">
          <SectionTitle>Views</SectionTitle>
          <div className="space-y-1">
            {views.map(v => <div key={v} className="font-mono text-xs text-gray-700">{v}</div>)}
          </div>
        </div>
      </div>

      <div className="border rounded-lg p-4">
        <SectionTitle>Open-Source Services (clone-enterprise.sh)</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {services.map(s => (
            <div key={s.name} className="flex gap-2 p-2 rounded bg-gray-50 border border-gray-100">
              <div className="font-medium text-sm w-36 shrink-0">{s.name}</div>
              <div className="text-xs text-gray-500">{s.role}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EnterpriseAdminPage() {
  const [tab, setTab] = useState<Tab>('Overview');

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Enterprise & Multi-Branch</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage branches, franchise agreements, corporate wellness programs, and white-label configurations.
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

      {/* Tab content */}
      {tab === 'Overview'           && <OverviewTab />}
      {tab === 'Branches'           && <BranchesTab />}
      {tab === 'Franchise'          && <FranchiseTab />}
      {tab === 'Corporate Wellness' && <CorporateWellnessTab />}
      {tab === 'White Label'        && <WhiteLabelTab />}
      {tab === 'Analytics'          && <AnalyticsTab />}
      {tab === 'Integrations'       && <IntegrationsTab />}
    </div>
  );
}
