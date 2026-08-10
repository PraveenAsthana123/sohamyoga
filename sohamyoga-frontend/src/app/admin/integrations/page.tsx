'use client';
import { useState } from 'react';

const TABS = ['Overview', 'Connections', 'Webhooks', 'API Keys', 'Logs', 'Health', 'Settings'] as const;
type Tab = typeof TABS[number];

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

const CONNECTIONS = [
  { name: 'Cal.com',       category: 'Scheduling', status: 'connected', health: 98, calls: 420, errors: 2 },
  { name: 'Stripe',        category: 'Payments',   status: 'connected', health: 99, calls: 312, errors: 0 },
  { name: 'Zoom',          category: 'Video',      status: 'connected', health: 100,calls: 42,  errors: 0 },
  { name: 'Mattermost',    category: 'Chat',       status: 'connected', health: 100,calls: 186, errors: 0 },
  { name: 'ERPNext',       category: 'ERP',        status: 'partial',   health: 72, calls: 84,  errors: 8 },
  { name: 'PostHog',       category: 'Analytics',  status: 'connected', health: 100,calls: 1842,errors: 0 },
  { name: 'Novu',          category: 'Notify',     status: 'connected', health: 99, calls: 624, errors: 2 },
  { name: 'MediaCMS',      category: 'Video',      status: 'partial',   health: 84, calls: 96,  errors: 4 },
  { name: 'Keycloak',      category: 'Auth',       status: 'connected', health: 100,calls: 284, errors: 0 },
  { name: 'Gotenberg',     category: 'PDF',        status: 'connected', health: 100,calls: 48,  errors: 0 },
  { name: 'Meilisearch',   category: 'Search',     status: 'connected', health: 100,calls: 942, errors: 0 },
  { name: 'Qdrant',        category: 'Vector DB',  status: 'connected', health: 100,calls: 284, errors: 0 },
  { name: 'Typeform',      category: 'Surveys',    status: 'disconnected', health: 0, calls: 0, errors: 0 },
  { name: 'Metabase',      category: 'BI',         status: 'connected', health: 99, calls: 84,  errors: 1 },
];

function OverviewTab() {
  const connected = CONNECTIONS.filter(c => c.status === 'connected').length;
  const partial   = CONNECTIONS.filter(c => c.status === 'partial').length;
  const down      = CONNECTIONS.filter(c => c.status === 'disconnected').length;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Connected"     value={String(connected)} sub="Fully operational"    color="green" />
        <KpiCard label="Partial Issues" value={String(partial)}  sub="Degraded connection"  color="amber" />
        <KpiCard label="Disconnected"  value={String(down)}     sub="Needs attention"       color="rose" />
        <KpiCard label="API Calls (24h)" value="5,284"          sub="Across all services"   color="blue" />
        <KpiCard label="Total Errors"  value="17"               sub="0.3% error rate"       color="amber" />
        <KpiCard label="Webhooks Active" value="24"             sub="8 services"            color="purple" />
        <KpiCard label="API Keys"      value="12"               sub="3 expiring in 30 days" color="teal" />
        <KpiCard label="Last Incident" value="6h ago"           sub="Cal.com timeout"       color="blue" />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="border rounded-lg p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Service Status Summary</h3>
          {CONNECTIONS.slice(0, 8).map(c => (
            <div key={c.name} className="flex justify-between text-sm py-1 border-b border-gray-50">
              <span className="font-medium">{c.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{c.health}%</span>
                <Badge color={c.status === 'connected' ? 'green' : c.status === 'partial' ? 'amber' : 'red'}>{c.status}</Badge>
              </div>
            </div>
          ))}
        </div>
        <div className="border rounded-lg p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">API Calls by Service (24h)</h3>
          {[...CONNECTIONS].sort((a, b) => b.calls - a.calls).slice(0, 6).map(c => (
            <div key={c.name} className="flex items-center gap-3 text-sm mb-2">
              <span className="w-24 text-gray-600 text-xs truncate">{c.name}</span>
              <div className="flex-1 h-2 bg-gray-100 rounded"><div className="h-2 bg-blue-400 rounded" style={{ width: `${(c.calls / 1842) * 100}%` }} /></div>
              <span className="w-12 text-right font-medium text-xs">{c.calls}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ConnectionsTab() {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 flex justify-between">
        <h3 className="text-sm font-semibold">All Integrations ({CONNECTIONS.length})</h3>
        <button className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded">+ Add Integration</button>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Service', 'Category', 'Status', 'Health', 'Calls (24h)', 'Errors', 'Actions'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-gray-100">
          {CONNECTIONS.map(c => (
            <tr key={c.name} className="hover:bg-gray-50">
              <td className="px-3 py-2 font-medium">{c.name}</td>
              <td className="px-3 py-2"><Badge color="blue">{c.category}</Badge></td>
              <td className="px-3 py-2"><Badge color={c.status === 'connected' ? 'green' : c.status === 'partial' ? 'amber' : 'red'}>{c.status}</Badge></td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-gray-100 rounded"><div className={`h-1.5 ${c.health > 90 ? 'bg-green-500' : c.health > 70 ? 'bg-amber-400' : 'bg-red-400'} rounded`} style={{ width: `${c.health}%` }} /></div>
                  <span className="text-xs">{c.health}%</span>
                </div>
              </td>
              <td className="px-3 py-2">{c.calls}</td>
              <td className="px-3 py-2 font-medium" style={{ color: c.errors > 5 ? '#dc2626' : c.errors > 0 ? '#d97706' : '#16a34a' }}>{c.errors}</td>
              <td className="px-3 py-2 space-x-2">
                <button className="text-xs text-blue-600 hover:underline">Configure</button>
                <button className="text-xs text-gray-500 hover:underline">Logs</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WebhooksTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Active Webhooks"  value="24" color="green" />
        <KpiCard label="Failed (24h)"     value="3"  color="amber" />
        <KpiCard label="Delivery Rate"    value="98.7%" color="teal" />
      </div>
      <div className="border rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 flex justify-between"><h3 className="text-sm font-semibold">Webhook Endpoints</h3><button className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded">+ Add Webhook</button></div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Service', 'Event', 'Endpoint', 'Deliveries (24h)', 'Status'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">
            {[
              ['Stripe',    'payment.succeeded',  '/api/webhooks/stripe',    142, 'healthy'],
              ['Cal.com',   'booking.created',    '/api/webhooks/cal',       84,  'degraded'],
              ['Novu',      'notification.sent',  '/api/webhooks/novu',      312, 'healthy'],
              ['PostHog',   'event.tracked',      '/api/webhooks/posthog',   820, 'healthy'],
              ['Mattermost','message.created',    '/api/webhooks/mattermost',186, 'healthy'],
            ].map(([svc, event, url, del, status]) => (
              <tr key={`${svc}-${event}`} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{svc}</td>
                <td className="px-3 py-2 font-mono text-xs text-gray-600">{event}</td>
                <td className="px-3 py-2 font-mono text-xs text-blue-600">{url}</td>
                <td className="px-3 py-2">{del}</td>
                <td className="px-3 py-2"><Badge color={status === 'healthy' ? 'green' : 'amber'}>{status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function APIKeysTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Active API Keys"   value="12"  color="blue" />
        <KpiCard label="Expiring (30 days)" value="3"  sub="Renew soon" color="amber" />
        <KpiCard label="Revoked (Month)"   value="1"   color="gray" />
      </div>
      <div className="border rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 flex justify-between"><h3 className="text-sm font-semibold">API Keys</h3><button className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded">+ Generate Key</button></div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Name', 'Service', 'Created', 'Expires', 'Last Used', 'Status', 'Actions'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">
            {[
              ['stripe-prod',    'Stripe',     'Jan 1', 'Dec 31', 'Today',      'active'],
              ['posthog-prod',   'PostHog',    'Jan 1', 'Sep 3',  'Today',      'expiring'],
              ['cal-webhook',    'Cal.com',    'Feb 1', 'Aug 31', 'Today',      'expiring'],
              ['novu-api',       'Novu',       'Mar 1', 'Dec 31', 'Yesterday',  'active'],
              ['meilisearch-key','Meilisearch','Apr 1', 'Dec 31', 'Today',      'active'],
            ].map(([name, svc, created, expires, lastUsed, status]) => (
              <tr key={String(name)} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-xs font-medium">{name}</td>
                <td className="px-3 py-2">{svc}</td>
                <td className="px-3 py-2 text-gray-500 text-xs">{created}</td>
                <td className="px-3 py-2 text-gray-500 text-xs">{expires}</td>
                <td className="px-3 py-2 text-gray-500 text-xs">{lastUsed}</td>
                <td className="px-3 py-2"><Badge color={status === 'active' ? 'green' : status === 'expiring' ? 'amber' : 'red'}>{status}</Badge></td>
                <td className="px-3 py-2 space-x-2">
                  <button className="text-xs text-blue-600 hover:underline">Rotate</button>
                  <button className="text-xs text-red-500 hover:underline">Revoke</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LogsTab() {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 flex justify-between"><h3 className="text-sm font-semibold">Integration Logs (Recent)</h3><button className="text-xs text-blue-600 hover:underline">Export</button></div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Time', 'Service', 'Event', 'Status', 'Duration', 'Details'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-gray-100">
          {[
            ['10:14:02', 'Stripe',    'payment.succeeded',  'success', '212ms', 'TXN-4821'],
            ['10:13:44', 'Cal.com',   'booking.confirmed',  'success', '184ms', 'BOK-8821'],
            ['10:11:12', 'Novu',      'email.delivered',    'success', '88ms',  'NTF-1242'],
            ['10:08:01', 'ERPNext',   'sync.accounts',      'failed',  '5000ms','Timeout'],
            ['10:06:44', 'PostHog',   'event.pageview',     'success', '42ms',  'analytics'],
          ].map(([time, svc, event, status, dur, detail]) => (
            <tr key={`${time}-${svc}`} className={`hover:bg-gray-50 ${status === 'failed' ? 'bg-red-50' : ''}`}>
              <td className="px-3 py-2 font-mono text-xs">{time}</td>
              <td className="px-3 py-2 font-medium">{svc}</td>
              <td className="px-3 py-2 font-mono text-xs text-gray-600">{event}</td>
              <td className="px-3 py-2"><Badge color={status === 'success' ? 'green' : 'red'}>{status}</Badge></td>
              <td className="px-3 py-2 font-mono text-xs">{dur}</td>
              <td className="px-3 py-2 text-xs text-gray-500">{detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HealthTab() {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {CONNECTIONS.map(c => (
        <div key={c.name} className={`border rounded-lg p-4 ${c.status === 'connected' ? '' : c.status === 'partial' ? 'border-amber-200 bg-amber-50' : 'border-red-200 bg-red-50'}`}>
          <div className="flex justify-between items-start mb-2">
            <div>
              <div className="font-semibold text-sm">{c.name}</div>
              <div className="text-xs text-gray-500">{c.category}</div>
            </div>
            <Badge color={c.status === 'connected' ? 'green' : c.status === 'partial' ? 'amber' : 'red'}>{c.status}</Badge>
          </div>
          <div className="flex gap-4 text-xs">
            <div><span className="text-gray-500">Health:</span> <span className="font-medium">{c.health}%</span></div>
            <div><span className="text-gray-500">Calls:</span> <span className="font-medium">{c.calls}</span></div>
            <div><span className="text-gray-500">Errors:</span> <span className={`font-medium ${c.errors > 0 ? 'text-red-600' : 'text-green-600'}`}>{c.errors}</span></div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SettingsTab() {
  return (
    <div className="border rounded-lg p-4">
      <h3 className="text-xs font-semibold text-gray-500 uppercase mb-4">Integration Settings</h3>
      <div className="space-y-4">
        {[
          { label: 'Webhook retry attempts', value: '3', type: 'number' },
          { label: 'Webhook retry delay', value: '60s', type: 'text' },
          { label: 'API key rotation reminder', value: '30 days before expiry', type: 'text' },
          { label: 'Health check interval', value: 'Every 5 minutes', type: 'text' },
          { label: 'Integration timeout', value: '30 seconds', type: 'text' },
          { label: 'Max integration failures before alert', value: '5', type: 'number' },
        ].map(({ label, value }) => (
          <div key={label} className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm font-medium">{label}</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-blue-700 font-semibold">{value}</span>
              <button className="text-xs text-gray-400 hover:text-gray-700">Edit</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function IntegrationsAdminPage() {
  const [tab, setTab] = useState<Tab>('Overview');
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
        <p className="text-sm text-gray-500 mt-1">Manage connected services, webhooks, API keys, and health monitoring</p>
      </div>
      <div className="border-b flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{t}</button>
        ))}
      </div>
      {tab === 'Overview'     && <OverviewTab />}
      {tab === 'Connections'  && <ConnectionsTab />}
      {tab === 'Webhooks'     && <WebhooksTab />}
      {tab === 'API Keys'     && <APIKeysTab />}
      {tab === 'Logs'         && <LogsTab />}
      {tab === 'Health'       && <HealthTab />}
      {tab === 'Settings'     && <SettingsTab />}
    </div>
  );
}
