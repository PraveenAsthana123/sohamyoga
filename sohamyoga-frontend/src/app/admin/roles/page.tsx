'use client';

import { useState, useEffect, useCallback } from 'react';

const TABS = ['Roles', 'Permissions', 'Users', 'Sessions', 'Audit'] as const;
type Tab = (typeof TABS)[number];

interface RoleRow {
  code: string;
  label: string;
  risk_level: number;
  sort_order: number;
  permission_count: number;
  user_count: number;
}

interface PermissionRow {
  role: string;
  resource: string;
  is_active: boolean;
  actions: string[];
}

interface UserRow {
  id: string;
  email: string;
  status: string;
  mfa_enabled: boolean;
  last_login_at: string | null;
  login_failure_count: number;
  role: string;
  assigned_at: string;
}

interface SessionRow {
  id: string;
  user_id: string;
  user_role: string;
  ip_address: string | null;
  device_info: string | null;
  mfa_verified: boolean;
  created_at: string;
  last_seen_at: string;
}

interface APIResponse {
  roles: RoleRow[];
  permissions: PermissionRow[];
  users: UserRow[];
  sessions: SessionRow[];
}

function Badge({ children, color = 'blue' }: { children: React.ReactNode; color?: string }) {
  const c: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
    purple: 'bg-purple-100 text-purple-700',
    gray: 'bg-gray-100 text-gray-600',
    rose: 'bg-rose-100 text-rose-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c[color] ?? c.blue}`}>
      {children}
    </span>
  );
}

function RiskStars({ level }: { level: number }) {
  const color =
    level >= 4
      ? 'text-red-600'
      : level === 3
        ? 'text-amber-600'
        : level === 2
          ? 'text-blue-600'
          : 'text-gray-400';
  return <span className={`font-bold text-xs ${color}`}>{'★'.repeat(level)}</span>;
}

function RolesTab({ roles }: { roles: RoleRow[] }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 flex justify-between items-center">
        <h3 className="text-sm font-semibold">Roles ({roles.length})</h3>
        <span className="text-xs text-gray-400">Live data from ref_admin_role</span>
      </div>
      {roles.length === 0 ? (
        <div className="p-8 text-center text-gray-400 text-sm">No roles found in database.</div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              {['Code', 'Label', 'Risk', 'Permissions', 'Users', 'Actions'].map((h) => (
                <th key={h} className="px-3 py-2 text-left">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {roles.map((r) => (
              <tr key={r.code} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-xs font-medium">{r.code}</td>
                <td className="px-3 py-2 font-medium">{r.label}</td>
                <td className="px-3 py-2">
                  <RiskStars level={r.risk_level} />
                </td>
                <td className="px-3 py-2">
                  <Badge color="blue">{r.permission_count} resources</Badge>
                </td>
                <td className="px-3 py-2">{r.user_count.toLocaleString()}</td>
                <td className="px-3 py-2">
                  <button className="text-xs text-blue-600 hover:underline">View</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function PermissionsTab({ permissions }: { permissions: PermissionRow[] }) {
  const roles = [...new Set(permissions.map((p) => p.role))].sort();
  const resources = [...new Set(permissions.map((p) => p.resource))].sort();

  function getActions(role: string, resource: string): string[] {
    return (
      permissions.find((p) => p.role === role && p.resource === resource && p.is_active)?.actions ??
      []
    );
  }

  if (permissions.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center text-gray-400 text-sm">
        No permissions configured yet. Permissions are set via role_permission and
        role_permission_action tables.
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-x-auto">
      <div className="px-4 py-3 bg-gray-50">
        <h3 className="text-sm font-semibold">
          Permission Matrix — {roles.length} roles × {resources.length} resources
        </h3>
      </div>
      <table className="w-full text-xs">
        <thead className="bg-gray-50 text-gray-500 uppercase">
          <tr>
            <th className="px-3 py-2 text-left">Role</th>
            {resources.map((r) => (
              <th key={r} className="px-2 py-2 text-center whitespace-nowrap">
                {r}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {roles.map((role) => (
            <tr key={role} className="hover:bg-gray-50">
              <td className="px-3 py-2 font-mono font-medium">{role}</td>
              {resources.map((resource) => {
                const acts = getActions(role, resource);
                return (
                  <td key={resource} className="px-2 py-2 text-center">
                    {acts.length > 0 ? (
                      <span className="text-green-600 font-bold" title={acts.join(', ')}>
                        ✓
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UsersTab({ users }: { users: UserRow[] }) {
  if (users.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center text-gray-400 text-sm">
        No role assignments found in identity_role_assignment.
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 flex justify-between items-center">
        <h3 className="text-sm font-semibold">Users with Roles ({users.length})</h3>
        <span className="text-xs text-gray-400">From identity_role_assignment</span>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
          <tr>
            {['Email', 'Role', 'MFA', 'Last Login', 'Status', 'Assigned'].map((h) => (
              <th key={h} className="px-3 py-2 text-left">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {users.map((u) => (
            <tr key={u.id} className="hover:bg-gray-50">
              <td className="px-3 py-2 text-xs text-gray-700 font-medium">{u.email}</td>
              <td className="px-3 py-2">
                <Badge color="purple">{u.role}</Badge>
              </td>
              <td className="px-3 py-2">
                {u.mfa_enabled ? (
                  <Badge color="green">Enabled</Badge>
                ) : (
                  <Badge color="amber">Off</Badge>
                )}
              </td>
              <td className="px-3 py-2 text-xs text-gray-500">
                {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : 'Never'}
              </td>
              <td className="px-3 py-2">
                <Badge color={u.status === 'active' ? 'green' : 'gray'}>{u.status}</Badge>
              </td>
              <td className="px-3 py-2 text-xs text-gray-500">
                {new Date(u.assigned_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SessionsTab({ sessions }: { sessions: SessionRow[] }) {
  if (sessions.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center text-gray-400 text-sm">
        <p className="font-medium">No active sessions found</p>
        <p className="mt-1">
          The user_session table exists but contains no active (is_active=true) rows.
        </p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 flex justify-between items-center">
        <h3 className="text-sm font-semibold">Active Sessions ({sessions.length})</h3>
        <span className="text-xs text-gray-400">From user_session table</span>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
          <tr>
            {['User ID', 'Role', 'IP', 'Device', 'MFA', 'Last Seen'].map((h) => (
              <th key={h} className="px-3 py-2 text-left">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sessions.map((s) => (
            <tr key={s.id} className="hover:bg-gray-50">
              <td className="px-3 py-2 font-mono text-xs text-gray-500 truncate max-w-xs">
                {s.user_id.slice(0, 8)}…
              </td>
              <td className="px-3 py-2">
                <Badge color="purple">{s.user_role}</Badge>
              </td>
              <td className="px-3 py-2 font-mono text-xs text-gray-600">
                {s.ip_address ?? '—'}
              </td>
              <td className="px-3 py-2 text-xs text-gray-600">{s.device_info ?? '—'}</td>
              <td className="px-3 py-2">
                {s.mfa_verified ? (
                  <Badge color="green">✓</Badge>
                ) : (
                  <Badge color="amber">✗</Badge>
                )}
              </td>
              <td className="px-3 py-2 text-xs text-gray-500">
                {new Date(s.last_seen_at).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AuditTab() {
  return (
    <div className="border rounded-lg p-8 text-center text-gray-400 text-sm">
      <p className="font-medium">Audit log not wired yet</p>
      <p className="mt-1">
        Login/security events are stored in <code className="font-mono">login_audit_event</code>.
        Wire this tab to the audit API when needed.
      </p>
    </div>
  );
}

export default function RolesAdminPage() {
  const [tab, setTab] = useState<Tab>('Roles');
  const [data, setData] = useState<APIResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/roles');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as APIResponse;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load roles data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Roles &amp; Permissions (RBAC)</h1>
        <p className="text-sm text-gray-500 mt-1">
          User roles, permissions, sessions and identity management — live DB data
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
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

      {loading && <div className="text-center py-12 text-gray-400">Loading…</div>}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          {error}{' '}
          <button onClick={() => void load()} className="underline ml-2">
            Retry
          </button>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {tab === 'Roles' && <RolesTab roles={data.roles} />}
          {tab === 'Permissions' && <PermissionsTab permissions={data.permissions} />}
          {tab === 'Users' && <UsersTab users={data.users} />}
          {tab === 'Sessions' && <SessionsTab sessions={data.sessions} />}
          {tab === 'Audit' && <AuditTab />}
        </>
      )}
    </div>
  );
}
