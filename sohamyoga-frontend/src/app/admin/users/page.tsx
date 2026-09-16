'use client';

import { useState, useEffect, useCallback } from 'react';

interface AppUser {
  id: string;
  email: string;
  display_name: string;
  role: string;
  status: string;
  created_at: string;
  last_login_at: string | null;
}

interface Summary {
  total: number;
  roleCounts: Record<string, number>;
  newThisWeek: number;
  active: number;
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-100 text-red-700',
  owner: 'bg-purple-100 text-purple-700',
  staff: 'bg-blue-100 text-blue-700',
  teacher: 'bg-green-100 text-green-700',
  student: 'bg-gray-100 text-gray-600',
  guest: 'bg-yellow-100 text-yellow-700',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  suspended: 'bg-red-100 text-red-700',
  deleted: 'bg-gray-100 text-gray-500',
};

const TABS = ['All Users', 'Admins', 'Students', 'Suspended', 'Stats'] as const;
type Tab = typeof TABS[number];

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function UsersPage() {
  const [tab, setTab] = useState<Tab>('All Users');
  const [users, setUsers] = useState<AppUser[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/users', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setUsers(data.users ?? []);
      setSummary(data.summary ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStatus = useCallback(async (id: string, status: string) => {
    setUpdating(id);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update user');
    } finally {
      setUpdating(null);
    }
  }, [load]);

  const filtered = users.filter(u => {
    if (tab === 'Admins') return u.role === 'admin' || u.role === 'owner';
    if (tab === 'Students') return u.role === 'student';
    if (tab === 'Suspended') return u.status === 'suspended';
    return true;
  }).filter(u =>
    !search || u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.display_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Platform Users</h1>
        <p className="text-gray-500 text-sm mt-1">Manage all app_user accounts — roles, status, and access.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="font-medium ml-4">Dismiss</button>
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Total Users" value={summary.total} />
          <KpiCard label="Active" value={summary.active} />
          <KpiCard label="New This Week" value={summary.newThisWeek} />
          <KpiCard label="Admins / Owners" value={(summary.roleCounts['admin'] ?? 0) + (summary.roleCounts['owner'] ?? 0)} />
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="flex gap-1 p-3 border-b border-gray-100 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                tab === t ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'Stats' ? (
          <div className="p-6">
            <h3 className="text-base font-semibold text-gray-800 mb-4">Users by Role</h3>
            {summary ? (
              <div className="space-y-3">
                {Object.entries(summary.roleCounts).map(([role, cnt]) => (
                  <div key={role} className="flex items-center gap-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium w-20 text-center ${ROLE_COLORS[role] ?? 'bg-gray-100 text-gray-600'}`}>{role}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-indigo-500 h-2 rounded-full"
                        style={{ width: `${summary.total ? (cnt / summary.total) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-700 w-8 text-right">{cnt}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-sm">No data.</p>
            )}
          </div>
        ) : (
          <>
            <div className="p-4 border-b border-gray-50">
              <input
                type="text"
                placeholder="Search by email or name..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full max-w-sm border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            {loading ? (
              <div className="p-8 text-center text-gray-400">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No users found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 text-xs border-b border-gray-100">
                      <th className="px-4 py-3 font-medium">User</th>
                      <th className="px-4 py-3 font-medium">Role</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Created</th>
                      <th className="px-4 py-3 font-medium">Last Login</th>
                      <th className="px-4 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(u => (
                      <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-sm">
                              {u.email.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{u.display_name}</p>
                              <p className="text-xs text-gray-400">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${ROLE_COLORS[u.role] ?? 'bg-gray-100 text-gray-600'}`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[u.status] ?? 'bg-gray-100 text-gray-500'}`}>
                            {u.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {u.status === 'active' ? (
                            <button
                              disabled={updating === u.id}
                              onClick={() => updateStatus(u.id, 'suspended')}
                              className="text-xs text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
                            >
                              {updating === u.id ? '...' : 'Suspend'}
                            </button>
                          ) : u.status === 'suspended' ? (
                            <button
                              disabled={updating === u.id}
                              onClick={() => updateStatus(u.id, 'active')}
                              className="text-xs text-green-600 hover:text-green-700 font-medium disabled:opacity-50"
                            >
                              {updating === u.id ? '...' : 'Reactivate'}
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
