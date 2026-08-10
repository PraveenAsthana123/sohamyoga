'use client';
// /admin/social/tenants — Connection matrix for 100+ customers.
// Shows which platforms each tenant has connected.
// Uses Postiz/Nango API in production; demo data here.

import { useState, useMemo } from 'react';

const PLATFORMS = [
  { key: 'telegram',  label: 'Tg',  color: 'bg-sky-100 text-sky-700'     },
  { key: 'discord',   label: 'Di',  color: 'bg-indigo-100 text-indigo-700'},
  { key: 'bluesky',   label: 'Bk',  color: 'bg-blue-100 text-blue-600'   },
  { key: 'reddit',    label: 'Re',  color: 'bg-orange-100 text-orange-700'},
  { key: 'youtube',   label: 'YT',  color: 'bg-red-100 text-red-700'     },
  { key: 'facebook',  label: 'Fb',  color: 'bg-blue-100 text-blue-800'   },
  { key: 'instagram', label: 'Ig',  color: 'bg-pink-100 text-pink-700'   },
  { key: 'threads',   label: 'Th',  color: 'bg-gray-100 text-gray-700'   },
  { key: 'linkedin',  label: 'In',  color: 'bg-blue-100 text-blue-900'   },
  { key: 'x',         label: 'X',   color: 'bg-gray-100 text-gray-900'   },
  { key: 'tiktok',    label: 'Tk',  color: 'bg-pink-100 text-pink-800'   },
  { key: 'pinterest', label: 'Pi',  color: 'bg-rose-100 text-rose-700'   },
];

type ConnectionStatus = 'connected' | 'expired' | 'pending' | 'not_connected';

interface Tenant {
  id:          string;
  name:        string;
  plan:        'starter' | 'pro' | 'enterprise';
  joinedAt:    string;
  connections: Record<string, ConnectionStatus>;
}

// Demo data — in production fetched from /api/social/tenants
function genTenants(): Tenant[] {
  const names = [
    'Sunrise Yoga Studio', 'Zen Flow Toronto', 'Inner Peace Wellness', 'Flow State Yoga',
    'Breathe Deep Studio', 'Radiant Roots Yoga', 'Shakti Power Yoga', 'Calm Mind Centre',
    'Harmony Hatha Studio', 'Lotus Path Yoga', 'Urban Om Studio', 'Mountain Pose Fitness',
    'Coastal Vinyasa', 'Sacred Space Yoga', 'Mindful Motion Studio', 'Earth & Sky Yoga',
    'River Flow Wellness', 'Centered Soul Studio', 'New Dawn Yoga', 'Prana Fire Yoga',
  ];
  const statuses: ConnectionStatus[] = ['connected', 'connected', 'connected', 'expired', 'not_connected'];
  return names.map((name, i) => {
    const connections: Record<string, ConnectionStatus> = {};
    PLATFORMS.forEach(p => {
      connections[p.key] = statuses[Math.floor(Math.abs(Math.sin(i * 13 + p.key.charCodeAt(0))) * statuses.length)];
    });
    return {
      id: `t${i + 1}`, name,
      plan: i < 3 ? 'enterprise' : i < 10 ? 'pro' : 'starter',
      joinedAt: `2025-0${(i % 9) + 1}-${(i % 28) + 1}`.padEnd(10, '0'),
      connections,
    };
  });
}

const DEMO_TENANTS = genTenants();

const STATUS_CELL: Record<ConnectionStatus, string> = {
  connected:     'bg-green-400',
  expired:       'bg-amber-400',
  pending:       'bg-blue-300',
  not_connected: 'bg-gray-100',
};

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connected:     'Connected',
  expired:       'Token expired',
  pending:       'OAuth pending',
  not_connected: 'Not connected',
};

export default function SocialTenantsPage() {
  const [search, setSearch]     = useState('');
  const [planFilter, setPlan]   = useState<string>('all');
  const [statusFilter, setStatus] = useState<string>('all');
  const [selectedTenant, setSelected] = useState<Tenant | null>(null);

  const filtered = useMemo(() => DEMO_TENANTS.filter(t => {
    const matchSearch = t.name.toLowerCase().includes(search.toLowerCase());
    const matchPlan   = planFilter === 'all' || t.plan === planFilter;
    const matchStatus = statusFilter === 'all'
      || (statusFilter === 'incomplete' && Object.values(t.connections).some(s => s !== 'connected'))
      || (statusFilter === 'expired'    && Object.values(t.connections).some(s => s === 'expired'))
      || (statusFilter === 'full'       && Object.values(t.connections).every(s => s === 'connected'));
    return matchSearch && matchPlan && matchStatus;
  }), [search, planFilter, statusFilter]);

  const connectedCount  = DEMO_TENANTS.reduce((n, t) => n + Object.values(t.connections).filter(s => s === 'connected').length, 0);
  const expiredCount    = DEMO_TENANTS.reduce((n, t) => n + Object.values(t.connections).filter(s => s === 'expired').length, 0);
  const totalPossible   = DEMO_TENANTS.length * PLATFORMS.length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tenant Social Connections</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {DEMO_TENANTS.length} customers · {connectedCount}/{totalPossible} connections active · {expiredCount} expired tokens
          </p>
        </div>
        <a
          href="/admin/social/setup"
          className="text-sm bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Platform Setup
        </a>
      </div>

      <div className="mb-6 rounded-lg border-2 border-amber-400 bg-amber-50 p-4 text-sm text-amber-900" role="status">
        <strong>SYNTHETIC DEMO DATA:</strong> the tenant names, plans, connection states, and totals on this screen are generated examples. They are not real customers or live OAuth connections.
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-700">{Math.round(connectedCount / totalPossible * 100)}%</div>
          <div className="text-sm text-green-600">Overall connection rate</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-amber-700">{expiredCount}</div>
          <div className="text-sm text-amber-600">Expired tokens (need re-auth)</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-700">{DEMO_TENANTS.filter(t => Object.values(t.connections).every(s => s === 'connected')).length}</div>
          <div className="text-sm text-blue-600">Fully connected tenants</div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-700">{DEMO_TENANTS.filter(t => Object.values(t.connections).every(s => s === 'not_connected')).length}</div>
          <div className="text-sm text-gray-600">Not started yet</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input
          type="text" placeholder="Search tenant name…" value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-200 rounded px-3 py-2 text-sm flex-1 max-w-xs"
        />
        <select value={planFilter} onChange={e => setPlan(e.target.value)} className="border border-gray-200 rounded px-3 py-2 text-sm">
          <option value="all">All plans</option>
          <option value="starter">Starter</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
        </select>
        <select value={statusFilter} onChange={e => setStatus(e.target.value)} className="border border-gray-200 rounded px-3 py-2 text-sm">
          <option value="all">All tenants</option>
          <option value="incomplete">Incomplete</option>
          <option value="expired">Has expired tokens</option>
          <option value="full">Fully connected</option>
        </select>
        <button
          onClick={() => {/* POST /api/social/tenants/remind-all */}}
          className="ml-auto text-sm bg-amber-100 text-amber-800 border border-amber-200 px-4 py-2 rounded hover:bg-amber-200"
        >
          Send reminder to incomplete tenants
        </button>
      </div>

      {/* Matrix table */}
      <div className="border border-gray-200 rounded-lg overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-semibold text-gray-700 sticky left-0 bg-gray-50">Tenant</th>
              <th className="text-left px-3 py-3 font-medium text-gray-500">Plan</th>
              <th className="text-right px-3 py-3 font-medium text-gray-500">Score</th>
              {PLATFORMS.map(p => (
                <th key={p.key} className="px-2 py-3 text-center">
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${p.color}`}>
                    {p.label}
                  </span>
                </th>
              ))}
              <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(tenant => {
              const connectedN  = Object.values(tenant.connections).filter(s => s === 'connected').length;
              const expiredN    = Object.values(tenant.connections).filter(s => s === 'expired').length;
              const score       = Math.round(connectedN / PLATFORMS.length * 100);
              return (
                <tr
                  key={tenant.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelected(tenant)}
                >
                  <td className="px-4 py-3 sticky left-0 bg-white font-medium text-gray-900">{tenant.name}</td>
                  <td className="px-3 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      tenant.plan === 'enterprise' ? 'bg-purple-100 text-purple-700'
                      : tenant.plan === 'pro'      ? 'bg-blue-100 text-blue-700'
                      :                              'bg-gray-100 text-gray-600'
                    }`}>{tenant.plan}</span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span className={`text-xs font-semibold ${score === 100 ? 'text-green-600' : score >= 60 ? 'text-amber-600' : 'text-red-500'}`}>
                      {score}%
                    </span>
                    {expiredN > 0 && <span className="ml-1 text-xs text-amber-500">⚠ {expiredN}</span>}
                  </td>
                  {PLATFORMS.map(p => (
                    <td key={p.key} className="px-2 py-3 text-center">
                      <div
                        title={`${p.key}: ${STATUS_LABEL[tenant.connections[p.key]]}`}
                        className={`w-3 h-3 rounded-full mx-auto ${STATUS_CELL[tenant.connections[p.key]]}`}
                      />
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={e => { e.stopPropagation(); /* POST /api/social/tenants/${tenant.id}/remind */ }}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Remind
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center text-gray-400 py-12">No tenants match the filter.</div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 mt-3 text-xs text-gray-500">
        {Object.entries(STATUS_CELL).map(([s, cls]) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded-full ${cls} border border-gray-200`} />
            {STATUS_LABEL[s as ConnectionStatus]}
          </span>
        ))}
      </div>

      {/* Tenant detail drawer */}
      {selectedTenant && (
        <div className="fixed inset-0 bg-black/30 flex justify-end z-50" onClick={() => setSelected(null)}>
          <div className="bg-white w-96 shadow-xl h-full overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="font-bold text-gray-900 text-lg">{selectedTenant.name}</div>
                <div className="text-sm text-gray-500">ID: {selectedTenant.id} · Joined {selectedTenant.joinedAt}</div>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>

            <div className="space-y-2">
              {PLATFORMS.map(p => {
                const s = selectedTenant.connections[p.key];
                return (
                  <div key={p.key} className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${p.color}`}>
                      {p.label}
                    </span>
                    <span className="flex-1 text-sm font-medium text-gray-700 capitalize">{p.key}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      s === 'connected'     ? 'bg-green-100 text-green-700'  :
                      s === 'expired'       ? 'bg-amber-100 text-amber-700'  :
                      s === 'pending'       ? 'bg-blue-100 text-blue-700'    :
                                             'bg-gray-100 text-gray-500'
                    }`}>{STATUS_LABEL[s]}</span>
                    {s === 'expired' && (
                      <button className="text-xs text-amber-600 hover:underline">Re-auth</button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex gap-2">
              <button className="flex-1 text-sm bg-blue-100 text-blue-700 py-2 rounded hover:bg-blue-200">
                Send connect reminder
              </button>
              <button className="flex-1 text-sm bg-gray-100 text-gray-700 py-2 rounded hover:bg-gray-200">
                View account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
