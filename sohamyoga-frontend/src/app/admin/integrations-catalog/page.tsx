'use client';

import { useEffect, useState, useCallback } from 'react';

interface CatalogRow {
  integration_id: string;
  name: string;
  category: string;
  status: string;
  description: string;
  docs_url: string;
}

interface ApiKeyRow {
  id: number;
  integration_id: string;
  key_preview: string;
  last_updated: string;
  status: string;
}

interface WebhookRow {
  id: number;
  integration_id: string;
  url_masked: string;
  events: string[];
  is_active: boolean;
  last_triggered: string | null;
  success_rate: string;
}

interface HealthRow {
  integration_id: string;
  last_checked: string;
  response_ms: number;
  status: string;
  uptime_pct: string;
}

interface Summary {
  total: number;
  connected: number;
  pending: number;
  failed: number;
}

interface PageData {
  catalog: CatalogRow[];
  api_keys: ApiKeyRow[];
  webhooks: WebhookRow[];
  health: HealthRow[];
  summary: Summary;
}

const CATEGORY_COLORS: Record<string, string> = {
  'AI/ML': 'bg-purple-100 text-purple-800',
  'Video': 'bg-red-100 text-red-800',
  'Email': 'bg-blue-100 text-blue-800',
  'CRM': 'bg-green-100 text-green-800',
  'Payment': 'bg-yellow-100 text-yellow-800',
  'Social': 'bg-pink-100 text-pink-800',
  'Analytics': 'bg-indigo-100 text-indigo-800',
  'Storage': 'bg-orange-100 text-orange-800',
  'Communication': 'bg-teal-100 text-teal-800',
  'Search': 'bg-gray-100 text-gray-800',
};

const STATUS_BADGE: Record<string, string> = {
  connected: 'bg-green-100 text-green-800',
  not_configured: 'bg-gray-100 text-gray-700',
  error: 'bg-red-100 text-red-800',
  deprecated: 'bg-orange-100 text-orange-700',
};

const HEALTH_COLOR: Record<string, string> = {
  ok: 'text-green-600',
  degraded: 'text-yellow-600',
  down: 'text-red-600',
};

function avatarLetter(name: string, category: string) {
  const colors = ['bg-purple-500','bg-blue-500','bg-green-500','bg-red-500',
    'bg-yellow-500','bg-pink-500','bg-indigo-500','bg-teal-500'];
  const idx = name.charCodeAt(0) % colors.length;
  return (
    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm ${colors[idx]}`}>
      {name[0]}
    </div>
  );
}

const TABS = ['All', 'By Category', 'API Keys', 'Webhooks', 'Health'] as const;
type Tab = typeof TABS[number];

export default function IntegrationsCatalogPage() {
  const [tab, setTab] = useState<Tab>('All');
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/integrations-catalog');
      if (!r.ok) throw new Error(await r.text());
      setData(await r.json());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (integration_id: string, status: string) => {
    await fetch('/api/admin/integrations-catalog', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'integration', integration_id, status }),
    });
    setStatusMsg(`Status updated for ${integration_id}`);
    load();
  };

  if (loading) return <div className="p-8 text-gray-500">Loading integrations...</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!data) return null;

  const { catalog, api_keys, webhooks, health, summary } = data;
  const categories = [...new Set(catalog.map(r => r.category))].sort();

  const statsCards = [
    { label: 'Total Integrations', value: summary.total, color: 'bg-blue-50 border-blue-200' },
    { label: 'Connected', value: summary.connected, color: 'bg-green-50 border-green-200' },
    { label: 'Pending Config', value: summary.pending, color: 'bg-yellow-50 border-yellow-200' },
    { label: 'Failed / Deprecated', value: summary.failed, color: 'bg-red-50 border-red-200' },
  ];

  const IntegrationCard = ({ item }: { item: CatalogRow }) => (
    <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        {avatarLetter(item.name, item.category)}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-900 truncate">{item.name}</div>
          <span className={`text-xs px-2 py-0.5 rounded-full ${CATEGORY_COLORS[item.category] || 'bg-gray-100 text-gray-700'}`}>
            {item.category}
          </span>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_BADGE[item.status] || 'bg-gray-100 text-gray-700'}`}>
          {item.status.replace('_', ' ')}
        </span>
      </div>
      <p className="text-sm text-gray-500 line-clamp-2">{item.description}</p>
      <div className="flex gap-2">
        <a href={item.docs_url} target="_blank" rel="noreferrer"
          className="text-xs text-blue-600 hover:underline">Docs</a>
        <button onClick={() => updateStatus(item.integration_id,
          item.status === 'connected' ? 'not_configured' : 'connected')}
          className="ml-auto text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700">
          Configure
        </button>
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Integrations Catalog</h1>
        <p className="text-gray-500 text-sm mt-1">Manage all third-party and open-source integrations</p>
      </div>

      {statusMsg && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded text-sm">
          {statusMsg}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map(s => (
          <div key={s.label} className={`border rounded-lg p-4 ${s.color}`}>
            <div className="text-2xl font-bold text-gray-900">{s.value}</div>
            <div className="text-sm text-gray-600 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1 overflow-x-auto">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab === t ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {t}
            </button>
          ))}
        </nav>
      </div>

      {/* All */}
      {tab === 'All' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {catalog.map(item => <IntegrationCard key={item.integration_id} item={item} />)}
        </div>
      )}

      {/* By Category */}
      {tab === 'By Category' && (
        <div className="space-y-6">
          {categories.map(cat => (
            <div key={cat}>
              <h2 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-xs ${CATEGORY_COLORS[cat] || 'bg-gray-100 text-gray-700'}`}>{cat}</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {catalog.filter(r => r.category === cat).map(item =>
                  <IntegrationCard key={item.integration_id} item={item} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* API Keys */}
      {tab === 'API Keys' && (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                <tr>
                  {['Integration', 'Key Preview', 'Last Updated', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {api_keys.map(k => (
                  <tr key={k.id} className="bg-white hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{k.integration_id}</td>
                    <td className="px-4 py-3 font-mono text-gray-500">{k.key_preview}</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(k.last_updated).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${k.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {k.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button className="text-xs text-red-500 hover:text-red-700">Revoke</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Webhooks */}
      {tab === 'Webhooks' && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                {['Integration', 'URL', 'Events', 'Status', 'Last Triggered', 'Success Rate'].map(h => (
                  <th key={h} className="px-4 py-3 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {webhooks.map(w => (
                <tr key={w.id} className="bg-white hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{w.integration_id}</td>
                  <td className="px-4 py-3 font-mono text-gray-500 text-xs">{w.url_masked}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(w.events || []).map(e => (
                        <span key={e} className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-xs">{e}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${w.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {w.is_active ? 'active' : 'inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {w.last_triggered ? new Date(w.last_triggered).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={Number(w.success_rate) > 95 ? 'text-green-600' : 'text-yellow-600'}>
                      {w.success_rate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Health */}
      {tab === 'Health' && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                {['Integration', 'Last Ping', 'Response (ms)', 'Status', 'Uptime %'].map(h => (
                  <th key={h} className="px-4 py-3 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {health.map(h => (
                <tr key={h.integration_id} className="bg-white hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{h.integration_id}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(h.last_checked).toLocaleString()}</td>
                  <td className="px-4 py-3">{h.response_ms}ms</td>
                  <td className="px-4 py-3">
                    <span className={`font-medium ${HEALTH_COLOR[h.status] || 'text-gray-600'}`}>
                      {h.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-1.5 max-w-24">
                        <div className="bg-green-500 h-1.5 rounded-full"
                          style={{ width: `${h.uptime_pct}%` }} />
                      </div>
                      <span className="text-xs text-gray-600">{h.uptime_pct}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
