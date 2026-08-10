'use client';
import { useState } from 'react';

const TABS = ['Overview', 'Servers', 'Tools', 'Tool Calls', 'Approvals', 'Security', 'Analytics'] as const;
type Tab = typeof TABS[number];

function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string; sub?: string; color?: string }) {
  const c: Record<string, string> = { blue: 'bg-blue-50 border-blue-200 text-blue-700', green: 'bg-green-50 border-green-200 text-green-700', amber: 'bg-amber-50 border-amber-200 text-amber-700', purple: 'bg-purple-50 border-purple-200 text-purple-700', rose: 'bg-rose-50 border-rose-200 text-rose-700', teal: 'bg-teal-50 border-teal-200 text-teal-700', red: 'bg-red-50 border-red-200 text-red-700' };
  return (
    <div className={`border rounded-lg p-4 ${c[color] ?? c.blue}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm font-medium mt-1">{label}</div>
      {sub && <div className="text-xs opacity-60 mt-0.5">{sub}</div>}
    </div>
  );
}

function Badge({ children, color = 'blue' }: { children: React.ReactNode; color?: string }) {
  const c: Record<string, string> = { blue: 'bg-blue-100 text-blue-700', green: 'bg-green-100 text-green-700', amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700', purple: 'bg-purple-100 text-purple-700', gray: 'bg-gray-100 text-gray-600', teal: 'bg-teal-100 text-teal-700' };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c[color] ?? c.blue}`}>{children}</span>;
}

const TIER_COLOR: Record<string, string> = { auto: 'teal', staff: 'blue', customer_confirm: 'purple', staff_approval: 'amber', admin: 'red', admin_destructive: 'red' };

function OverviewTab() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Active MCP Servers" value="8"   sub="2 in maintenance"   color="green" />
        <KpiCard label="Total Tools"        value="104" sub="13 per server avg"  color="blue" />
        <KpiCard label="Calls (24h)"        value="1,842" sub="↑ 12% vs yesterday" color="purple" />
        <KpiCard label="Pending Approvals"  value="14"  sub="5 admin_destructive" color="amber" />
        <KpiCard label="Failed Calls (24h)" value="23"  sub="1.2% error rate"    color="rose" />
        <KpiCard label="Flagged for Review" value="3"   sub="1 injection suspect" color="red" />
        <KpiCard label="Avg Response Time"  value="84ms" sub="p95: 312ms"        color="teal" />
        <KpiCard label="Approval SLA Met"   value="94%"  sub="< 30 min target"   color="green" />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="border rounded-lg p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Calls by Tier (24h)</h3>
          {[['auto', 840, 'bg-teal-400'], ['staff', 620, 'bg-blue-400'], ['customer_confirm', 210, 'bg-purple-400'], ['staff_approval', 98, 'bg-amber-400'], ['admin', 62, 'bg-red-400'], ['admin_destructive', 12, 'bg-red-600']].map(([tier, n, color]) => (
            <div key={String(tier)} className="flex items-center gap-3 text-sm mb-2">
              <span className="w-36 text-gray-600 text-xs font-mono">{tier}</span>
              <div className="flex-1 h-2 bg-gray-100 rounded"><div className={`h-2 ${color} rounded`} style={{ width: `${(Number(n) / 840) * 100}%` }} /></div>
              <span className="w-10 text-right font-medium">{n}</span>
            </div>
          ))}
        </div>
        <div className="border rounded-lg p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Server Health</h3>
          {[['yoga-booking-mcp', 'online'], ['enterprise-mcp', 'online'], ['payment-mcp', 'online'], ['membership-mcp', 'online'], ['analytics-mcp', 'degraded'], ['community-mcp', 'online'], ['referral-mcp', 'maintenance'], ['coupon-mcp', 'online']].map(([name, status]) => (
            <div key={String(name)} className="flex justify-between text-sm py-1 border-b border-gray-50">
              <span className="font-mono text-xs">{name}</span>
              <Badge color={status === 'online' ? 'green' : status === 'degraded' ? 'amber' : 'red'}>{status}</Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ServersTab() {
  const servers = [
    { name: 'yoga-booking-mcp',  version: '1.4.2', tools: 13, status: 'online',      calls: 420, fails: 3 },
    { name: 'enterprise-mcp',    version: '1.2.0', tools: 13, status: 'online',      calls: 184, fails: 1 },
    { name: 'payment-mcp',       version: '2.1.1', tools: 13, status: 'online',      calls: 312, fails: 4 },
    { name: 'membership-mcp',    version: '1.3.0', tools: 13, status: 'online',      calls: 284, fails: 2 },
    { name: 'analytics-mcp',     version: '1.1.0', tools: 13, status: 'degraded',    calls: 180, fails: 12 },
    { name: 'community-mcp',     version: '1.0.1', tools: 13, status: 'online',      calls: 96,  fails: 0 },
    { name: 'referral-mcp',      version: '1.0.0', tools: 13, status: 'maintenance', calls: 0,   fails: 0 },
    { name: 'coupon-mcp',        version: '1.2.3', tools: 13, status: 'online',      calls: 366, fails: 1 },
  ];
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 flex justify-between">
        <h3 className="text-sm font-semibold">MCP Servers</h3>
        <button className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded">+ Register Server</button>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Server', 'Version', 'Tools', 'Status', 'Calls (1h)', 'Failures', 'Actions'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-gray-100">
          {servers.map(s => (
            <tr key={s.name} className="hover:bg-gray-50">
              <td className="px-3 py-2 font-mono text-xs font-medium">{s.name}</td>
              <td className="px-3 py-2 text-gray-500 text-xs">{s.version}</td>
              <td className="px-3 py-2">{s.tools}</td>
              <td className="px-3 py-2"><Badge color={s.status === 'online' ? 'green' : s.status === 'degraded' ? 'amber' : 'purple'}>{s.status}</Badge></td>
              <td className="px-3 py-2">{s.calls}</td>
              <td className="px-3 py-2 font-medium" style={{ color: s.fails > 5 ? '#dc2626' : s.fails > 0 ? '#d97706' : '#16a34a' }}>{s.fails}</td>
              <td className="px-3 py-2 space-x-2">
                <button className="text-xs text-blue-600 hover:underline">Health</button>
                <button className="text-xs text-amber-600 hover:underline">Maintain</button>
                <button className="text-xs text-red-500 hover:underline">Disable</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ToolsTab() {
  return (
    <div className="space-y-4">
      <div className="border rounded-lg p-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Tool Registry — MCP Safety Tiers</h3>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-4">
          {[['auto', 2, 'teal'], ['staff', 5, 'blue'], ['customer_confirm', 1, 'purple'], ['staff_approval', 2, 'amber'], ['admin', 2, 'red'], ['admin_destructive', 1, 'red']].map(([tier, count, color]) => (
            <div key={String(tier)} className={`border rounded-lg p-3 text-center bg-${color}-50 border-${color}-200`}>
              <div className="text-lg font-bold">{count}</div>
              <div className="text-xs font-mono mt-0.5" style={{ wordBreak: 'break-all' }}>{tier}</div>
            </div>
          ))}
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Tool Name', 'Server', 'Tier', 'Calls (24h)', 'Avg Latency', 'Errors'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">
            {[
              ['create_booking',           'yoga-booking-mcp', 'staff',             210, '64ms',  0],
              ['process_payment',          'payment-mcp',      'admin',             184, '312ms', 2],
              ['cancel_membership',        'membership-mcp',   'staff_approval',    42,  '88ms',  0],
              ['terminate_franchise',      'enterprise-mcp',   'admin_destructive', 1,   '210ms', 0],
              ['get_analytics_dashboard',  'analytics-mcp',    'auto',              420, '180ms', 8],
              ['apply_coupon',             'coupon-mcp',       'customer_confirm',  186, '72ms',  1],
            ].map(([tool, server, tier, calls, lat, err]) => (
              <tr key={`${tool}`} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-xs font-medium">{tool}</td>
                <td className="px-3 py-2 text-gray-600 font-mono text-xs">{server}</td>
                <td className="px-3 py-2"><Badge color={TIER_COLOR[String(tier)] ?? 'gray'}>{tier}</Badge></td>
                <td className="px-3 py-2">{calls}</td>
                <td className="px-3 py-2 font-mono text-xs">{lat}</td>
                <td className="px-3 py-2 font-medium" style={{ color: Number(err) > 5 ? '#dc2626' : Number(err) > 0 ? '#d97706' : '#16a34a' }}>{err}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ToolCallsTab() {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 flex justify-between">
        <h3 className="text-sm font-semibold">Recent Tool Calls</h3>
        <button className="text-xs text-blue-600 hover:underline">Export Audit Log</button>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Call ID', 'Tool', 'Tier', 'Actor', 'Status', 'Duration', 'Flagged', 'Time'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-gray-100">
          {[
            { id: 'MTC-9842', tool: 'create_booking',       tier: 'staff',             actor: 'admin',  status: 'success',          dur: '64ms',  flagged: false, time: '10:14:02' },
            { id: 'MTC-9841', tool: 'process_payment',      tier: 'admin',             actor: 'admin',  status: 'success',          dur: '288ms', flagged: false, time: '10:13:44' },
            { id: 'MTC-9840', tool: 'terminate_franchise',  tier: 'admin_destructive', actor: 'admin',  status: 'pending_approval', dur: '—',     flagged: false, time: '10:11:12' },
            { id: 'MTC-9839', tool: 'apply_coupon',         tier: 'customer_confirm',  actor: 'student',status: 'success',          dur: '72ms',  flagged: false, time: '10:09:33' },
            { id: 'MTC-9838', tool: 'get_analytics',        tier: 'auto',              actor: 'system', status: 'failed',           dur: '5000ms',flagged: true,  time: '10:08:01' },
          ].map(r => (
            <tr key={r.id} className={`hover:bg-gray-50 ${r.flagged ? 'bg-red-50' : ''}`}>
              <td className="px-3 py-2 font-mono text-xs">{r.id}</td>
              <td className="px-3 py-2 font-mono text-xs font-medium">{r.tool}</td>
              <td className="px-3 py-2"><Badge color={TIER_COLOR[r.tier] ?? 'gray'}>{r.tier}</Badge></td>
              <td className="px-3 py-2 text-gray-600">{r.actor}</td>
              <td className="px-3 py-2"><Badge color={r.status === 'success' ? 'green' : r.status === 'failed' ? 'red' : r.status === 'pending_approval' ? 'amber' : 'blue'}>{r.status}</Badge></td>
              <td className="px-3 py-2 font-mono text-xs">{r.dur}</td>
              <td className="px-3 py-2">{r.flagged ? <Badge color="red">Flagged</Badge> : <span className="text-gray-300">—</span>}</td>
              <td className="px-3 py-2 text-gray-500 text-xs font-mono">{r.time}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ApprovalsTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Pending Approvals"      value="14"  color="amber" />
        <KpiCard label="Admin Destructive"       value="5"   color="rose" />
        <KpiCard label="Avg Pending Time"        value="18min" color="blue" />
      </div>
      <div className="border rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-gray-50"><h3 className="text-sm font-semibold">Pending Approval Queue</h3></div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Call ID', 'Tool', 'Tier', 'Requested By', 'Waiting', 'Actions'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">
            {[
              { id: 'MTC-9840', tool: 'terminate_franchise',  tier: 'admin_destructive', actor: 'admin',   wait: '8 min' },
              { id: 'MTC-9822', tool: 'bulk_delete_students', tier: 'admin_destructive', actor: 'manager', wait: '24 min' },
              { id: 'MTC-9815', tool: 'cancel_membership',    tier: 'staff_approval',    actor: 'staff',   wait: '31 min' },
              { id: 'MTC-9801', tool: 'export_franchise_data',tier: 'admin',             actor: 'finance', wait: '42 min' },
            ].map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-xs">{r.id}</td>
                <td className="px-3 py-2 font-mono text-xs font-medium">{r.tool}</td>
                <td className="px-3 py-2"><Badge color={TIER_COLOR[r.tier] ?? 'gray'}>{r.tier}</Badge></td>
                <td className="px-3 py-2 text-gray-600">{r.actor}</td>
                <td className="px-3 py-2 font-medium text-amber-600">{r.wait}</td>
                <td className="px-3 py-2 space-x-2">
                  <button className="text-xs text-green-600 hover:underline">Approve</button>
                  <button className="text-xs text-red-500 hover:underline">Reject</button>
                  <button className="text-xs text-gray-400 hover:underline">Details</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SecurityTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Injection Suspects (7d)" value="2"  color="red" />
        <KpiCard label="Flagged Calls (Open)"    value="3"  color="amber" />
        <KpiCard label="Anomalous Patterns"      value="1"  sub="High-volume from IP" color="rose" />
      </div>
      <div className="border rounded-lg p-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Security Incidents</h3>
        {[
          { type: 'Prompt Injection Suspected', call: 'MTC-9838', severity: 'critical', time: '10:08:01', resolved: false },
          { type: 'High-volume API calls',      call: 'IP: 203.x.x.x', severity: 'warn', time: '09:44:12', resolved: false },
          { type: 'Prompt Injection Suspected', call: 'MTC-9712', severity: 'critical', time: 'Aug 4 15:22', resolved: true },
        ].map((inc, i) => (
          <div key={i} className={`p-3 rounded-lg border mb-2 ${inc.severity === 'critical' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
            <div className="flex justify-between items-start">
              <div>
                <span className={`text-xs font-semibold ${inc.severity === 'critical' ? 'text-red-700' : 'text-amber-700'}`}>{inc.type}</span>
                <div className="text-xs text-gray-600 mt-0.5">Ref: {inc.call} — {inc.time}</div>
              </div>
              <Badge color={inc.resolved ? 'green' : inc.severity === 'critical' ? 'red' : 'amber'}>{inc.resolved ? 'Resolved' : 'Open'}</Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalyticsTab() {
  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="border rounded-lg p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Call Volume — Last 7 Days</h3>
          <div className="flex items-end gap-2 h-24">
            {[{d:'Tue',v:1200},{d:'Wed',v:1380},{d:'Thu',v:1290},{d:'Fri',v:1520},{d:'Sat',v:980},{d:'Sun',v:820},{d:'Mon',v:1842}].map(({d,v}) => (
              <div key={d} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full bg-purple-400 rounded-t" style={{ height: `${(v / 2000) * 100}%` }} />
                <span className="text-xs text-gray-500">{d}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="border rounded-lg p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Top Tools by Call Volume (24h)</h3>
          {[['get_analytics_dashboard', 420], ['create_booking', 210], ['process_payment', 184], ['apply_coupon', 186], ['get_teacher_schedule', 168]].map(([t, n]) => (
            <div key={String(t)} className="flex items-center gap-3 text-sm mb-2">
              <span className="w-44 text-gray-600 font-mono text-xs truncate">{t}</span>
              <div className="flex-1 h-2 bg-gray-100 rounded"><div className="h-2 bg-purple-400 rounded" style={{ width: `${(Number(n) / 420) * 100}%` }} /></div>
              <span className="w-8 text-right font-medium">{n}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function McpAdminPage() {
  const [tab, setTab] = useState<Tab>('Overview');
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">MCP Control Centre</h1>
        <p className="text-sm text-gray-500 mt-1">Server health, tool calls, approval queue, prompt injection detection</p>
      </div>
      <div className="border-b flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{t}</button>
        ))}
      </div>
      {tab === 'Overview'   && <OverviewTab />}
      {tab === 'Servers'    && <ServersTab />}
      {tab === 'Tools'      && <ToolsTab />}
      {tab === 'Tool Calls' && <ToolCallsTab />}
      {tab === 'Approvals'  && <ApprovalsTab />}
      {tab === 'Security'   && <SecurityTab />}
      {tab === 'Analytics'  && <AnalyticsTab />}
    </div>
  );
}
