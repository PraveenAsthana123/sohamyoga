'use client';
import { useState } from 'react';

const TABS = ['Overview', 'Pending', 'Approved', 'Rules', 'Approvers', 'History', 'Audit'] as const;
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

function OverviewTab() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Pending Approvals"   value="14"  sub="6 > 30 min old"    color="amber" />
        <KpiCard label="Approved Today"      value="28"  sub="Avg: 8 min SLA"    color="green" />
        <KpiCard label="Rejected Today"      value="3"   color="rose" />
        <KpiCard label="SLA Breaches (24h)"  value="2"   sub="> 30 min threshold" color="red" />
        <KpiCard label="Active Rules"        value="18"  sub="4 disabled"         color="blue" />
        <KpiCard label="Approvers Active"    value="6"   sub="2 super_admin"      color="purple" />
        <KpiCard label="Auto-approved"       value="840" sub="Via auto-tier"       color="teal" />
        <KpiCard label="Approval Rate"       value="90%" sub="Of resolved"         color="green" />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="border rounded-lg p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Approvals by Category</h3>
          {[['MCP Staff Approval', 6, 'bg-blue-400'], ['MCP Admin Destructive', 5, 'bg-red-400'], ['Refund Override', 2, 'bg-amber-400'], ['Enterprise Action', 1, 'bg-purple-400']].map(([l, n, c]) => (
            <div key={String(l)} className="flex items-center gap-3 text-sm mb-2">
              <span className="w-44 text-gray-600 text-xs">{l}</span>
              <div className="flex-1 h-2 bg-gray-100 rounded"><div className={`h-2 ${c} rounded`} style={{ width: `${(Number(n) / 6) * 100}%` }} /></div>
              <span className="w-4 text-right font-medium">{n}</span>
            </div>
          ))}
        </div>
        <div className="border rounded-lg p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">SLA Performance (Last 7 Days)</h3>
          <div className="flex items-end gap-2 h-20">
            {[{d:'Tue',met:12,missed:1},{d:'Wed',met:18,missed:0},{d:'Thu',met:14,missed:2},{d:'Fri',met:22,missed:1},{d:'Sat',met:8,missed:0},{d:'Sun',met:6,missed:0},{d:'Mon',met:28,missed:2}].map(({d, met, missed}) => (
              <div key={d} className="flex-1 flex flex-col items-center gap-0.5">
                <div className="w-full flex flex-col-reverse">
                  <div className="w-full bg-green-400 rounded-t" style={{ height: `${(met / 30) * 60}px` }} />
                  {missed > 0 && <div className="w-full bg-red-400" style={{ height: `${missed * 6}px` }} />}
                </div>
                <span className="text-xs text-gray-500">{d}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PendingTab() {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 flex justify-between">
        <h3 className="text-sm font-semibold">Pending Approvals — 14 items</h3>
        <button className="text-xs bg-amber-600 text-white px-3 py-1.5 rounded">Bulk Review</button>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['ID', 'Type', 'Description', 'Requestor', 'Priority', 'Waiting', 'Actions'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-gray-100">
          {[
            { id: 'WF-0184', type: 'MCP Admin Destructive', desc: 'terminate_franchise — FRN-0042', requestor: 'admin', priority: 'critical', wait: '8 min' },
            { id: 'WF-0183', type: 'Refund Override',       desc: 'Refund $360 — INV-0427',          requestor: 'manager', priority: 'high', wait: '24 min' },
            { id: 'WF-0182', type: 'MCP Admin Destructive', desc: 'bulk_delete_students — 12 records',requestor: 'manager', priority: 'critical', wait: '31 min' },
            { id: 'WF-0181', type: 'Enterprise Action',     desc: 'terminate_agreement — ACM-001',   requestor: 'admin', priority: 'high', wait: '42 min' },
            { id: 'WF-0180', type: 'MCP Staff Approval',    desc: 'cancel_membership — MBR-1842',    requestor: 'staff', priority: 'normal', wait: '51 min' },
          ].map(r => (
            <tr key={r.id} className={`hover:bg-gray-50 ${r.priority === 'critical' ? 'bg-red-50' : ''}`}>
              <td className="px-3 py-2 font-mono text-xs">{r.id}</td>
              <td className="px-3 py-2"><Badge color={r.type.includes('Destructive') ? 'red' : r.type.includes('Enterprise') ? 'purple' : 'amber'}>{r.type}</Badge></td>
              <td className="px-3 py-2 text-gray-700 text-xs">{r.desc}</td>
              <td className="px-3 py-2 text-gray-600">{r.requestor}</td>
              <td className="px-3 py-2"><Badge color={r.priority === 'critical' ? 'red' : r.priority === 'high' ? 'amber' : 'blue'}>{r.priority}</Badge></td>
              <td className="px-3 py-2 font-medium text-amber-600">{r.wait}</td>
              <td className="px-3 py-2 space-x-2">
                <button className="text-xs text-green-600 hover:underline">Approve</button>
                <button className="text-xs text-red-500 hover:underline">Reject</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ApprovedTab() {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-50"><h3 className="text-sm font-semibold">Approved Today</h3></div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['ID', 'Type', 'Description', 'Approved By', 'Time Taken', 'Time'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-gray-100">
          {[
            ['WF-0179', 'MCP Staff Approval', 'override_class_capacity', 'super_admin', '4 min', '10:02'],
            ['WF-0178', 'Refund Override',    'Refund $200 — RFN-047',   'admin',       '11 min','09:48'],
            ['WF-0177', 'MCP Admin',          'export_franchise_data',   'super_admin', '6 min', '09:31'],
          ].map(([id, type, desc, approver, time, ts]) => (
            <tr key={String(id)} className="hover:bg-gray-50">
              <td className="px-3 py-2 font-mono text-xs">{id}</td>
              <td className="px-3 py-2"><Badge color="green">{type}</Badge></td>
              <td className="px-3 py-2 text-xs text-gray-700">{desc}</td>
              <td className="px-3 py-2 font-medium">{approver}</td>
              <td className="px-3 py-2 text-green-600">{time}</td>
              <td className="px-3 py-2 font-mono text-xs text-gray-500">{ts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RulesTab() {
  return (
    <div className="space-y-3">
      <div className="flex justify-between">
        <p className="text-sm text-gray-500">18 active rules, 4 disabled</p>
        <button className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded">+ Add Rule</button>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Rule', 'Trigger', 'Approvers Required', 'SLA', 'Active'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">
            {[
              ['Admin destructive MCP', 'tier = admin_destructive', '2 super_admin', '15 min', true],
              ['Staff approval MCP',    'tier = staff_approval',    '1 admin+',      '30 min', true],
              ['Refund > $500',         'refund.amount > 500',      '1 finance',     '1 hour', true],
              ['Bulk data export',      'tool = export_*',          '1 admin',       '30 min', true],
              ['Terminate agreement',   'action = terminate',       '2 admin',       '15 min', true],
              ['GDPR deletion',         'gdpr.delete = true',       '1 super_admin', '24 hr',  false],
            ].map(([rule, trigger, approvers, sla, active]) => (
              <tr key={String(rule)} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{rule}</td>
                <td className="px-3 py-2 font-mono text-xs text-gray-600">{trigger}</td>
                <td className="px-3 py-2 text-gray-600">{approvers}</td>
                <td className="px-3 py-2">{sla}</td>
                <td className="px-3 py-2"><Badge color={active ? 'green' : 'gray'}>{active ? 'Active' : 'Disabled'}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ApproversTab() {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-50"><h3 className="text-sm font-semibold">Approval Panel</h3></div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Approver', 'Role', 'Can Approve', 'Pending', 'Approved Today', 'Avg Time', 'Status'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-gray-100">
          {[
            ['Ranjit Admin', 'super_admin', 'All tiers', 8, 14, '5m', 'Online'],
            ['Meera Admin',  'super_admin', 'All tiers', 6, 10, '7m', 'Online'],
            ['Finance Lead', 'finance',     'Refunds only', 2, 4, '12m', 'Away'],
            ['Ops Admin',    'admin',       'staff_approval+', 4, 8, '9m', 'Online'],
          ].map(([name, role, can, pending, approved, avg, status]) => (
            <tr key={String(name)} className="hover:bg-gray-50">
              <td className="px-3 py-2 font-medium">{name}</td>
              <td className="px-3 py-2"><Badge color="purple">{role}</Badge></td>
              <td className="px-3 py-2 text-xs text-gray-600">{can}</td>
              <td className="px-3 py-2 font-bold text-amber-600">{pending}</td>
              <td className="px-3 py-2">{approved}</td>
              <td className="px-3 py-2 text-green-600">{avg}</td>
              <td className="px-3 py-2"><Badge color={status === 'Online' ? 'green' : 'gray'}>{status}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HistoryTab() {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {['Today', 'Last 7 days', 'Last 30 days'].map(f => (
          <button key={f} className="text-xs px-3 py-1.5 border rounded hover:bg-gray-50">{f}</button>
        ))}
      </div>
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['ID', 'Type', 'Outcome', 'Approved By', 'Duration', 'Date'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">
            {[
              ['WF-0179', 'MCP Staff Approval',   'approved', 'super_admin', '4 min',  'Aug 5 10:02'],
              ['WF-0174', 'MCP Admin Destructive', 'rejected', 'super_admin', '6 min',  'Aug 5 09:10'],
              ['WF-0168', 'Refund Override',       'approved', 'finance',     '18 min', 'Aug 4 16:42'],
              ['WF-0161', 'Enterprise Action',     'approved', 'admin',       '11 min', 'Aug 4 14:18'],
            ].map(([id, type, outcome, approver, dur, date]) => (
              <tr key={String(id)} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-xs">{id}</td>
                <td className="px-3 py-2 text-xs">{type}</td>
                <td className="px-3 py-2"><Badge color={outcome === 'approved' ? 'green' : 'red'}>{outcome}</Badge></td>
                <td className="px-3 py-2 text-gray-600">{approver}</td>
                <td className="px-3 py-2 text-gray-600">{dur}</td>
                <td className="px-3 py-2 text-gray-500 text-xs">{date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AuditTab() {
  return (
    <div className="space-y-4">
      <div className="border rounded-lg p-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Approval Audit Log</h3>
        <div className="space-y-2">
          {[
            { action: 'APPROVE', wf: 'WF-0179', actor: 'Ranjit Admin', detail: 'MCP Staff Approval — override_class_capacity', time: '10:02:14' },
            { action: 'REJECT',  wf: 'WF-0174', actor: 'Ranjit Admin', detail: 'MCP Admin Destructive — reason: insufficient evidence', time: '09:10:42' },
            { action: 'APPROVE', wf: 'WF-0168', actor: 'Finance Lead',  detail: 'Refund Override $200 — INV-0427', time: 'Aug 4 16:42:08' },
          ].map((entry, i) => (
            <div key={i} className="flex items-start gap-3 text-xs py-2 border-b border-gray-50">
              <Badge color={entry.action === 'APPROVE' ? 'green' : 'red'}>{entry.action}</Badge>
              <div className="flex-1">
                <span className="font-medium">{entry.wf}</span> — {entry.detail}
                <div className="text-gray-500 mt-0.5">By {entry.actor} at {entry.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function WorkflowsAdminPage() {
  const [tab, setTab] = useState<Tab>('Overview');
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Workflows & Approvals</h1>
        <p className="text-sm text-gray-500 mt-1">Manage approval workflows, rules, SLA monitoring, and audit trail</p>
      </div>
      <div className="border-b flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{t}</button>
        ))}
      </div>
      {tab === 'Overview'   && <OverviewTab />}
      {tab === 'Pending'    && <PendingTab />}
      {tab === 'Approved'   && <ApprovedTab />}
      {tab === 'Rules'      && <RulesTab />}
      {tab === 'Approvers'  && <ApproversTab />}
      {tab === 'History'    && <HistoryTab />}
      {tab === 'Audit'      && <AuditTab />}
    </div>
  );
}
