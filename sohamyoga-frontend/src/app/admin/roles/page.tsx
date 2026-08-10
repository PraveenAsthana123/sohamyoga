'use client';
import { useState } from 'react';

const TABS = ['Overview', 'Roles', 'Permissions', 'Users', 'MFA', 'Sessions', 'Audit'] as const;
type Tab = typeof TABS[number];

const ROLES = ['super_admin', 'admin', 'manager', 'finance', 'marketing', 'content', 'support', 'teacher', 'receptionist', 'student'] as const;
const ACTIONS = ['read', 'create', 'update', 'delete', 'approve', 'export'] as const;
const RESOURCES = ['bookings', 'payments', 'members', 'teachers', 'content', 'analytics', 'mcp', 'settings'] as const;

function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string; sub?: string; color?: string }) {
  const c: Record<string, string> = { blue: 'bg-blue-50 border-blue-200 text-blue-700', green: 'bg-green-50 border-green-200 text-green-700', amber: 'bg-amber-50 border-amber-200 text-amber-700', purple: 'bg-purple-50 border-purple-200 text-purple-700', rose: 'bg-rose-50 border-rose-200 text-rose-700', teal: 'bg-teal-50 border-teal-200 text-teal-700' };
  return (
    <div className={`border rounded-lg p-4 ${c[color] ?? c.blue}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm font-medium mt-1">{label}</div>
      {sub && <div className="text-xs opacity-60 mt-0.5">{sub}</div>}
    </div>
  );
}

function Badge({ children, color = 'blue' }: { children: React.ReactNode; color?: string }) {
  const c: Record<string, string> = { blue: 'bg-blue-100 text-blue-700', green: 'bg-green-100 text-green-700', amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700', purple: 'bg-purple-100 text-purple-700', gray: 'bg-gray-100 text-gray-600' };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c[color] ?? c.blue}`}>{children}</span>;
}

function OverviewTab() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total Admin Users"   value="24"   sub="Active accounts"     color="blue" />
        <KpiCard label="MFA Enabled"         value="18"   sub="75% — target: 100%"  color="amber" />
        <KpiCard label="Active Sessions"     value="12"   sub="Right now"            color="green" />
        <KpiCard label="Security Events 24h" value="8"    sub="2 suspicious logins"  color="rose" />
        <KpiCard label="Failed Logins (24h)" value="14"   sub="3 from unknown IPs"  color="amber" />
        <KpiCard label="Active Roles"        value="10"   sub="4 privileged"         color="purple" />
        <KpiCard label="Permission Changes"  value="3"    sub="Today"                color="teal" />
        <KpiCard label="Locked Accounts"     value="1"    sub="Max attempts exceeded" color="red" />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="border rounded-lg p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Users by Role</h3>
          {[['super_admin', 2, 4], ['admin', 4, 4], ['manager', 3, 4], ['finance', 2, 4], ['teacher', 22, 4], ['student', 2847, 4]].map(([role, n, risk]) => (
            <div key={String(role)} className="flex justify-between text-sm py-1 border-b border-gray-50">
              <span className="font-mono text-xs">{role}</span>
              <span className="font-medium">{n} users</span>
            </div>
          ))}
        </div>
        <div className="border rounded-lg p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Recent Security Events</h3>
          {[
            { type: 'login_suspicious', actor: 'admin@studio.com', time: '09:44', severity: 'warn' },
            { type: 'login_failed',     actor: 'unknown@x.com',    time: '09:12', severity: 'warn' },
            { type: 'role_granted',     actor: 'manager@studio.com',time:'08:31', severity: 'warn' },
            { type: 'login_success',    actor: 'priya@studio.com', time: '07:55', severity: 'info' },
          ].map((e, i) => (
            <div key={i} className="flex items-start gap-3 text-xs py-1.5 border-b border-gray-50">
              <Badge color={e.severity === 'warn' ? 'amber' : 'green'}>{e.severity}</Badge>
              <div><div className="font-medium">{e.type}</div><div className="text-gray-500">{e.actor} — {e.time}</div></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RolesTab() {
  const roleData = [
    { role: 'super_admin',   label: 'Super Admin',   risk: 4, users: 2,   desc: 'Full system access' },
    { role: 'admin',         label: 'Admin',         risk: 3, users: 4,   desc: 'Admin access except super-admin settings' },
    { role: 'manager',       label: 'Manager',       risk: 3, users: 3,   desc: 'Day-to-day operations management' },
    { role: 'finance',       label: 'Finance',       risk: 3, users: 2,   desc: 'Payment, invoices, commissions' },
    { role: 'marketing',     label: 'Marketing',     risk: 2, users: 3,   desc: 'Campaigns, CRM, analytics' },
    { role: 'content',       label: 'Content',       risk: 2, users: 2,   desc: 'Blog, media, class descriptions' },
    { role: 'support',       label: 'Support',       risk: 2, users: 4,   desc: 'Student queries, bookings help' },
    { role: 'teacher',       label: 'Teacher',       risk: 1, users: 22,  desc: 'Own schedule, students, check-in' },
    { role: 'receptionist',  label: 'Receptionist',  risk: 1, users: 3,   desc: 'Front-desk, walk-ins, QR scan' },
    { role: 'student',       label: 'Student',       risk: 1, users: 2847, desc: 'Own profile, bookings, wellness' },
  ];
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 flex justify-between">
        <h3 className="text-sm font-semibold">Roles ({roleData.length})</h3>
        <button className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded">+ Custom Role</button>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Role', 'Label', 'Risk Level', 'Users', 'Description', 'Actions'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-gray-100">
          {roleData.map(r => (
            <tr key={r.role} className="hover:bg-gray-50">
              <td className="px-3 py-2 font-mono text-xs font-medium">{r.role}</td>
              <td className="px-3 py-2">{r.label}</td>
              <td className="px-3 py-2">
                <span className={`text-xs font-bold ${r.risk === 4 ? 'text-red-600' : r.risk === 3 ? 'text-amber-600' : r.risk === 2 ? 'text-blue-600' : 'text-gray-500'}`}>{'★'.repeat(r.risk)}</span>
              </td>
              <td className="px-3 py-2">{r.users.toLocaleString()}</td>
              <td className="px-3 py-2 text-gray-600 text-xs">{r.desc}</td>
              <td className="px-3 py-2">
                <button className="text-xs text-blue-600 hover:underline mr-2">Permissions</button>
                <button className="text-xs text-gray-500 hover:underline">Users</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PermissionsTab() {
  const matrix: Record<string, string[]> = {
    super_admin: ['read', 'create', 'update', 'delete', 'approve', 'export'],
    admin:       ['read', 'create', 'update', 'delete', 'approve', 'export'],
    manager:     ['read', 'create', 'update', 'approve'],
    finance:     ['read', 'approve', 'export'],
    teacher:     ['read', 'update'],
    student:     ['read'],
  };
  const selectedRoles = Object.keys(matrix);
  return (
    <div className="space-y-4">
      <div className="border rounded-lg overflow-x-auto">
        <div className="px-4 py-3 bg-gray-50"><h3 className="text-sm font-semibold">Permission Matrix (key roles × actions)</h3></div>
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-gray-500 uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Role</th>
              {ACTIONS.map(a => <th key={a} className="px-3 py-2 text-center">{a}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {selectedRoles.map(role => (
              <tr key={role} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-mono font-medium">{role}</td>
                {ACTIONS.map(action => (
                  <td key={action} className="px-3 py-2 text-center">
                    {matrix[role]?.includes(action)
                      ? <span className="text-green-600 font-bold">✓</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-2 bg-gray-50 text-xs text-gray-500">This is a simplified view. Full per-resource permissions managed per role.</div>
      </div>
    </div>
  );
}

function UsersTab() {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 flex justify-between">
        <h3 className="text-sm font-semibold">Admin Users</h3>
        <button className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded">+ Invite User</button>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['User', 'Email', 'Role', 'MFA', 'Last Login', 'Status', 'Actions'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-gray-100">
          {[
            ['Ranjit Singh', 'ranjit@studio.com', 'super_admin', true, 'Today 07:55', 'Active'],
            ['Meera Sharma', 'meera@studio.com',  'super_admin', true, 'Today 08:12', 'Active'],
            ['Ops Lead',     'ops@studio.com',    'admin',       true, 'Today 09:01', 'Active'],
            ['Finance Lead', 'finance@studio.com','finance',     false,'Today 09:44', 'Active'],
            ['Support 1',    'support@studio.com','support',     false,'Yesterday',   'Active'],
          ].map(([name, email, role, mfa, lastLogin, status]) => (
            <tr key={String(email)} className="hover:bg-gray-50">
              <td className="px-3 py-2 font-medium">{name}</td>
              <td className="px-3 py-2 text-gray-600 text-xs">{email}</td>
              <td className="px-3 py-2"><Badge color="purple">{role}</Badge></td>
              <td className="px-3 py-2">{mfa ? <Badge color="green">Enabled</Badge> : <Badge color="amber">Off</Badge>}</td>
              <td className="px-3 py-2 text-gray-500 text-xs">{lastLogin}</td>
              <td className="px-3 py-2"><Badge color="green">{status}</Badge></td>
              <td className="px-3 py-2 space-x-2">
                <button className="text-xs text-blue-600 hover:underline">Edit Role</button>
                <button className="text-xs text-red-500 hover:underline">Revoke</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MFATab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="MFA Enabled"   value="18/24" sub="75% coverage"     color="amber" />
        <KpiCard label="Enforced Roles" value="2"    sub="super_admin, admin" color="green" />
        <KpiCard label="MFA Exempt"    value="0"     sub="No exemptions"     color="teal" />
      </div>
      <div className="border rounded-lg p-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">MFA Coverage by Role</h3>
        {[['super_admin', 2, 2], ['admin', 4, 4], ['manager', 2, 3], ['finance', 1, 2], ['support', 2, 4], ['teacher', 7, 22]].map(([role, mfa, total]) => (
          <div key={String(role)} className="flex items-center gap-3 text-sm mb-2">
            <span className="w-28 font-mono text-xs">{role}</span>
            <div className="flex-1 h-2 bg-gray-100 rounded"><div className={`h-2 ${Number(mfa) === Number(total) ? 'bg-green-500' : 'bg-amber-400'} rounded`} style={{ width: `${(Number(mfa) / Number(total)) * 100}%` }} /></div>
            <span className="text-xs">{mfa}/{total}</span>
          </div>
        ))}
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
          Target: 100% MFA coverage for roles with risk level ≥ 2 (admin, manager, finance, marketing, content, support)
        </div>
      </div>
    </div>
  );
}

function SessionsTab() {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 flex justify-between">
        <h3 className="text-sm font-semibold">Active Sessions (12)</h3>
        <button className="text-xs text-red-600 hover:underline">Revoke All Others</button>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['User', 'Role', 'IP', 'Device', 'MFA', 'Since', 'Actions'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-gray-100">
          {[
            ['Ranjit Singh', 'super_admin', '192.168.1.10', 'Chrome / macOS',  true,  '07:55'],
            ['Meera Sharma', 'super_admin', '192.168.1.11', 'Firefox / Linux', true,  '08:12'],
            ['Ops Lead',     'admin',       '10.0.0.42',    'Chrome / Win11',  true,  '09:01'],
            ['Finance Lead', 'finance',     '10.0.0.18',    'Safari / macOS',  false, '09:44'],
          ].map(([name, role, ip, device, mfa, since]) => (
            <tr key={String(name)} className="hover:bg-gray-50">
              <td className="px-3 py-2 font-medium">{name}</td>
              <td className="px-3 py-2"><Badge color="purple">{role}</Badge></td>
              <td className="px-3 py-2 font-mono text-xs text-gray-600">{ip}</td>
              <td className="px-3 py-2 text-xs text-gray-600">{device}</td>
              <td className="px-3 py-2">{mfa ? <Badge color="green">✓</Badge> : <Badge color="amber">✗</Badge>}</td>
              <td className="px-3 py-2 font-mono text-xs text-gray-500">{since}</td>
              <td className="px-3 py-2"><button className="text-xs text-red-500 hover:underline">Revoke</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AuditTab() {
  return (
    <div className="border rounded-lg p-4">
      <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Security Audit Log</h3>
      <div className="space-y-2">
        {[
          { event: 'role_granted',       actor: 'Ranjit Singh', detail: 'Granted finance role to ops@studio.com', severity: 'warn', time: 'Aug 5 08:31' },
          { event: 'login_suspicious',   actor: 'Finance Lead', detail: 'Login from new device: Safari/macOS', severity: 'warn', time: 'Aug 5 09:44' },
          { event: 'mfa_disabled',       actor: 'Support 1',   detail: 'MFA disabled for support@studio.com', severity: 'warn', time: 'Aug 4 16:22' },
          { event: 'permission_changed', actor: 'Ranjit Singh', detail: 'finance: export permission on payments granted', severity: 'warn', time: 'Aug 4 14:10' },
          { event: 'login_success',      actor: 'Meera Sharma', detail: 'Login from 192.168.1.11 — MFA verified', severity: 'info', time: 'Aug 5 08:12' },
        ].map((e, i) => (
          <div key={i} className={`p-3 rounded border text-xs ${e.severity === 'warn' ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex justify-between items-start">
              <div>
                <span className="font-semibold">{e.event}</span> — {e.detail}
                <div className="text-gray-500 mt-0.5">By {e.actor}</div>
              </div>
              <span className="text-gray-400">{e.time}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RolesAdminPage() {
  const [tab, setTab] = useState<Tab>('Overview');
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Roles & Security (RBAC)</h1>
        <p className="text-sm text-gray-500 mt-1">User roles, permissions, MFA enforcement, sessions and security audit</p>
      </div>
      <div className="border-b flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{t}</button>
        ))}
      </div>
      {tab === 'Overview'    && <OverviewTab />}
      {tab === 'Roles'       && <RolesTab />}
      {tab === 'Permissions' && <PermissionsTab />}
      {tab === 'Users'       && <UsersTab />}
      {tab === 'MFA'         && <MFATab />}
      {tab === 'Sessions'    && <SessionsTab />}
      {tab === 'Audit'       && <AuditTab />}
    </div>
  );
}
