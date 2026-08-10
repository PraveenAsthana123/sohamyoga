'use client';

import { useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'certifications' | 'schedules' | 'performance' | 'hr' | 'analytics' | 'integrations';

interface KpiCard { label: string; value: string; sub?: string; color?: string; }

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview',        label: 'Overview' },
  { key: 'certifications',  label: 'Certifications' },
  { key: 'schedules',       label: 'Schedules' },
  { key: 'performance',     label: 'Performance' },
  { key: 'hr',              label: 'HR & Payroll' },
  { key: 'analytics',       label: 'Analytics' },
  { key: 'integrations',    label: 'Integrations' },
];

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color = 'bg-white' }: KpiCard) {
  return (
    <div className={`${color} rounded-xl border border-gray-100 p-5 shadow-sm`}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab() {
  const kpis: KpiCard[] = [
    { label: 'Active Teachers',      value: '24',  sub: '3 on leave' },
    { label: 'Verified Certs',       value: '89',  sub: 'across all types' },
    { label: 'Expiring Soon',        value: '6',   sub: 'within 30 days', color: 'bg-amber-50' },
    { label: 'Classes This Week',    value: '142', sub: '↑8% vs last week' },
    { label: 'Avg Rating',           value: '4.7', sub: 'out of 5.0' },
    { label: 'Pending Verifications',value: '4',   sub: 'certs under review', color: 'bg-blue-50' },
  ];
  const statusRows = [
    { name: 'Active',      count: 24, pct: 75, color: 'bg-green-500' },
    { name: 'On Leave',    count: 3,  pct: 9,  color: 'bg-amber-500' },
    { name: 'Trainee',     count: 4,  pct: 13, color: 'bg-blue-500' },
    { name: 'Retired',     count: 1,  pct: 3,  color: 'bg-gray-400' },
  ];
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        {kpis.map(k => <KpiCard key={k.label} {...k} />)}
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Teacher Status Distribution</h3>
          <div className="space-y-3">
            {statusRows.map(r => (
              <div key={r.name}>
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>{r.name}</span><span>{r.count}</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100">
                  <div className={`h-2 rounded-full ${r.color}`} style={{ width: `${r.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Specialization Breakdown</h3>
          <div className="space-y-2">
            {[
              { style: 'Hatha Yoga',     count: 18 },
              { style: 'Vinyasa Flow',   count: 14 },
              { style: 'Yin Yoga',       count: 8 },
              { style: 'Prenatal Yoga',  count: 5 },
              { style: 'Kids Yoga',      count: 4 },
              { style: 'Aerial Yoga',    count: 3 },
            ].map(s => (
              <div key={s.style} className="flex justify-between text-sm text-gray-700 border-b border-gray-50 pb-1">
                <span>{s.style}</span>
                <span className="font-medium">{s.count} teachers</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Certifications Tab ────────────────────────────────────────────────────────

function CertificationsTab() {
  const certTypes = [
    { type: 'RYT 200',          verified: 22, pending: 1, expired: 2 },
    { type: 'RYT 500',          verified: 8,  pending: 0, expired: 1 },
    { type: 'CPR + First Aid',  verified: 18, pending: 2, expired: 4 },
    { type: 'Child Protection', verified: 20, pending: 1, expired: 3 },
    { type: 'Prenatal Yoga',    verified: 5,  pending: 0, expired: 0 },
    { type: 'Kids Yoga',        verified: 4,  pending: 0, expired: 1 },
  ];
  const expiring = [
    { teacher: 'Meera Sharma',   type: 'CPR + First Aid',  expires: '2026-08-30', days: 25 },
    { teacher: 'Arjun Patel',    type: 'Child Protection', expires: '2026-09-05', days: 31 },
    { teacher: 'Priya Nair',     type: 'CPR + First Aid',  expires: '2026-09-10', days: 36 },
  ];
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Certification Status by Type</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b">
                <th className="pb-2 font-medium">Type</th>
                <th className="pb-2 font-medium text-green-600">Verified</th>
                <th className="pb-2 font-medium text-amber-600">Pending</th>
                <th className="pb-2 font-medium text-red-600">Expired</th>
              </tr>
            </thead>
            <tbody>
              {certTypes.map(c => (
                <tr key={c.type} className="border-b border-gray-50">
                  <td className="py-2 text-gray-800">{c.type}</td>
                  <td className="py-2 font-medium text-green-700">{c.verified}</td>
                  <td className="py-2 font-medium text-amber-700">{c.pending}</td>
                  <td className="py-2 font-medium text-red-700">{c.expired}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="rounded-xl border border-amber-100 bg-amber-50 p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-amber-800 mb-4">Expiring Within 30 Days</h3>
        <div className="space-y-3">
          {expiring.map(e => (
            <div key={e.teacher} className="flex items-center justify-between bg-white rounded-lg p-3 shadow-sm">
              <div>
                <p className="text-sm font-medium text-gray-800">{e.teacher}</p>
                <p className="text-xs text-gray-500">{e.type}</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold text-amber-700">{e.days} days</span>
                <p className="text-xs text-gray-400">{e.expires}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Schedules Tab ─────────────────────────────────────────────────────────────

function SchedulesTab() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const slots: Record<string, number> = {
    Mon: 6, Tue: 5, Wed: 7, Thu: 5, Fri: 6, Sat: 9, Sun: 4,
  };
  const blockedTypes = [
    { type: 'Vacation',         count: 3, color: 'bg-blue-400' },
    { type: 'Sick Leave',       count: 2, color: 'bg-red-400' },
    { type: 'Training / CPD',   count: 4, color: 'bg-purple-400' },
    { type: 'Mandatory Meeting',count: 1, color: 'bg-gray-400' },
  ];
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Weekly Slots per Day (Active Schedules)</h3>
        <div className="grid grid-cols-7 gap-2">
          {days.map(d => (
            <div key={d} className="text-center">
              <p className="text-xs text-gray-500 mb-2">{d}</p>
              <div className="rounded-lg bg-purple-100 p-3">
                <p className="text-2xl font-bold text-purple-700">{slots[d]}</p>
                <p className="text-xs text-purple-500">slots</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Blocked Periods (Active)</h3>
          <div className="space-y-3">
            {blockedTypes.map(b => (
              <div key={b.type} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${b.color}`} />
                  <span className="text-sm text-gray-700">{b.type}</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">{b.count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Schedule Status</h3>
          <div className="space-y-3">
            {[
              { status: 'Active',   count: 20, color: 'bg-green-500' },
              { status: 'Draft',    count: 4,  color: 'bg-gray-400' },
              { status: 'Archived', count: 12, color: 'bg-slate-300' },
            ].map(s => (
              <div key={s.status} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${s.color}`} />
                  <span className="text-sm text-gray-700">{s.status}</span>
                </div>
                <span className="text-sm font-semibold">{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Performance Tab ───────────────────────────────────────────────────────────

function PerformanceTab() {
  const top = [
    { name: 'Meera Sharma',   rating: 4.9, classes: 48, nps: 72, retention: '91%' },
    { name: 'Arjun Patel',    rating: 4.8, classes: 52, nps: 68, retention: '88%' },
    { name: 'Priya Nair',     rating: 4.7, classes: 41, nps: 65, retention: '85%' },
    { name: 'Kavita Reddy',   rating: 4.7, classes: 38, nps: 61, retention: '83%' },
    { name: 'Suresh Menon',   rating: 4.6, classes: 35, nps: 58, retention: '80%' },
  ];
  const npsLabels = [
    { label: 'Promoters (9-10)',  pct: 62, color: 'bg-green-500' },
    { label: 'Passives (7-8)',    pct: 25, color: 'bg-yellow-400' },
    { label: 'Detractors (0-6)', pct: 13, color: 'bg-red-500' },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Studio NPS"       value="67"  sub="industry avg: 45" />
        <KpiCard label="Avg Class Rating" value="4.7" sub="last 90 days" />
        <KpiCard label="Cancellation Rate"value="4.2%"sub="target: <5%" />
        <KpiCard label="Retention Rate"   value="84%" sub="90-day return" />
      </div>
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Top Teachers by Rating</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b">
                <th className="pb-2 font-medium">Teacher</th>
                <th className="pb-2 font-medium">Rating</th>
                <th className="pb-2 font-medium">Classes</th>
                <th className="pb-2 font-medium">NPS</th>
                <th className="pb-2 font-medium">Retention</th>
              </tr>
            </thead>
            <tbody>
              {top.map((t, i) => (
                <tr key={t.name} className="border-b border-gray-50">
                  <td className="py-2">
                    <span className="mr-2 text-gray-400 text-xs">#{i+1}</span>
                    <span className="font-medium text-gray-800">{t.name}</span>
                  </td>
                  <td className="py-2">
                    <span className="text-amber-500">★</span> {t.rating}
                  </td>
                  <td className="py-2 text-gray-600">{t.classes}</td>
                  <td className="py-2 font-medium text-blue-700">{t.nps}</td>
                  <td className="py-2 text-green-700">{t.retention}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">NPS Breakdown</h3>
        <div className="space-y-3">
          {npsLabels.map(n => (
            <div key={n.label}>
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>{n.label}</span><span>{n.pct}%</span>
              </div>
              <div className="h-3 rounded-full bg-gray-100">
                <div className={`h-3 rounded-full ${n.color}`} style={{ width: `${n.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── HR & Payroll Tab ──────────────────────────────────────────────────────────

function HrTab() {
  const leaveData = [
    { type: 'Vacation',   approved: 12, pending: 3 },
    { type: 'Sick Leave', approved: 8,  pending: 1 },
    { type: 'Training',   approved: 6,  pending: 2 },
    { type: 'Personal',   approved: 4,  pending: 0 },
  ];
  const payrollSummary = [
    { teacher: 'Meera Sharma',  type: 'Salaried',  amount: '$4,200', status: 'Processed' },
    { teacher: 'Arjun Patel',   type: 'Per-Class', amount: '$3,640', status: 'Processed' },
    { teacher: 'Priya Nair',    type: 'Per-Class', amount: '$3,280', status: 'Pending' },
    { teacher: 'Kavita Reddy',  type: 'Commission',amount: '$2,950', status: 'Pending' },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Total Payroll (Aug)" value="$89,400" sub="4 teachers pending" />
        <KpiCard label="Leave Requests"      value="6"       sub="3 pending approval" color="bg-amber-50" />
        <KpiCard label="Open Positions"      value="2"       sub="yoga + prenatal" />
        <KpiCard label="Avg Tenure"          value="2.4 yr"  sub="across active staff" />
      </div>
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700">Payroll Summary — August 2026</h3>
          <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700 font-medium">
            Sensitive — Staff Approval Required
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b">
                <th className="pb-2 font-medium">Teacher</th>
                <th className="pb-2 font-medium">Type</th>
                <th className="pb-2 font-medium">Amount</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {payrollSummary.map(p => (
                <tr key={p.teacher} className="border-b border-gray-50">
                  <td className="py-2 font-medium text-gray-800">{p.teacher}</td>
                  <td className="py-2 text-gray-600">{p.type}</td>
                  <td className="py-2 font-semibold text-gray-900">{p.amount}</td>
                  <td className="py-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                      p.status === 'Processed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}>{p.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Leave Requests (via Frappe HR)</h3>
        <div className="space-y-3">
          {leaveData.map(l => (
            <div key={l.type} className="flex items-center justify-between text-sm">
              <span className="text-gray-700">{l.type}</span>
              <div className="flex gap-4">
                <span className="text-green-700 font-medium">{l.approved} approved</span>
                {l.pending > 0 && <span className="text-amber-600 font-medium">{l.pending} pending</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Analytics Tab ─────────────────────────────────────────────────────────────

function AnalyticsTab() {
  const weeklyClasses = [38, 41, 45, 42, 47, 52, 48];
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const maxClasses = Math.max(...weeklyClasses);
  const trends = [
    { metric: 'New Certifications (30d)',    value: 8,    delta: '+3' },
    { metric: 'Certs Verified',             value: 7,    delta: '+2' },
    { metric: 'Avg Rating Trend',           value: '4.7',delta: '+0.1' },
    { metric: 'Substitute Requests (30d)',  value: 6,    delta: '-2' },
    { metric: 'Classes Cancelled (30d)',    value: 3,    delta: '-1' },
    { metric: 'New Schedule Activations',   value: 4,    delta: '+1' },
  ];
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Classes per Day (This Week)</h3>
        <div className="flex items-end gap-2 h-32">
          {weeklyClasses.map((v, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-purple-400"
                style={{ height: `${(v / maxClasses) * 100}%` }}
              />
              <span className="text-xs text-gray-500">{weekDays[i]}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">30-Day Trends</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {trends.map(t => (
            <div key={t.metric} className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
              <span className="text-sm text-gray-700">{t.metric}</span>
              <div className="text-right">
                <span className="text-base font-bold text-gray-900">{t.value}</span>
                <span className={`ml-2 text-xs font-medium ${t.delta.startsWith('+') ? 'text-green-600' : 'text-red-500'}`}>
                  {t.delta}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Integrations Tab ──────────────────────────────────────────────────────────

const MCP_TOOLS = [
  { name: 'get_teacher_directory',   tier: 'auto',              desc: 'Public directory (no PII)' },
  { name: 'get_teacher_schedule',    tier: 'auto',              desc: 'Availability calendar' },
  { name: 'get_teacher_profile',     tier: 'staff',             desc: 'Full profile + certs' },
  { name: 'update_teacher_status',   tier: 'staff',             desc: 'Activate / suspend' },
  { name: 'add_certification',       tier: 'staff',             desc: 'Add RYT / CPR cert' },
  { name: 'get_performance_report',  tier: 'staff',             desc: 'Ratings + cancellation' },
  { name: 'assign_substitute',       tier: 'staff',             desc: 'Flowable substitute workflow' },
  { name: 'book_private_session',    tier: 'customer_confirm',  desc: 'BOOK_PRIVATE required' },
  { name: 'get_payroll_data',        tier: 'staff_approval',    desc: 'Financial PII — approval + audit' },
  { name: 'export_teacher_data',     tier: 'staff_approval',    desc: 'Full export — de-identify first' },
  { name: 'set_commission_rate',     tier: 'admin',             desc: 'Commission %' },
  { name: 'bulk_performance_report', tier: 'admin',             desc: 'Cross-teacher analytics' },
  { name: 'delete_teacher_profile',  tier: 'admin_destructive', desc: 'DELETE_TEACHER + approval' },
];

const TIER_COLOURS: Record<string, string> = {
  auto:              'bg-green-100 text-green-700',
  staff:             'bg-blue-100 text-blue-700',
  customer_confirm:  'bg-yellow-100 text-yellow-700',
  staff_approval:    'bg-orange-100 text-orange-700',
  admin:             'bg-purple-100 text-purple-700',
  admin_destructive: 'bg-red-100 text-red-700',
};

const DB_TABLES = [
  { table: 'teacher_certification',  desc: 'Cert lifecycle — 14 types, state machine' },
  { table: 'teacher_schedule',       desc: 'Schedule header — draft/active/archived' },
  { table: 'teacher_weekly_slot',    desc: 'Per-day HH:MM time slots' },
  { table: 'teacher_blocked_period', desc: 'Vacation / sick leave / training blocks' },
  { table: 'teacher_audit',          desc: 'Immutable action log' },
  { table: 'ref_certification_type', desc: '14 cert types — RYT, CPR, insurance, specialist' },
  { table: 'ref_certification_status',desc: '5 status codes' },
  { table: 'ref_block_type',         desc: '6 block types' },
  { table: 'ref_day_of_week',        desc: 'Monday–Sunday with ISO number' },
  { table: 'ref_schedule_status',    desc: 'draft / active / archived' },
];

const SERVICES = [
  { name: 'Authentik',      role: 'Identity (OIDC/SAML)',        status: 'planned' },
  { name: 'Cal.com',        role: 'Schedule → booking sync',     status: 'configured' },
  { name: 'LibreBooking',   role: 'Studio resource booking',     status: 'configured' },
  { name: 'Rocket.Chat',    role: 'Staff internal chat',         status: 'active' },
  { name: 'Wiki.js',        role: 'Teacher knowledge base',      status: 'active' },
  { name: 'Paperless-ngx',  role: 'Certification document vault',status: 'configured' },
  { name: 'Moodle',         role: 'CPD / LMS courses',           status: 'planned' },
  { name: 'LimeSurvey',     role: 'Feedback & NPS surveys',      status: 'active' },
  { name: 'ERPNext',        role: 'Payroll / HR (Frappe HR)',    status: 'planned' },
  { name: 'Akaunting',      role: 'Commission accounting',       status: 'planned' },
  { name: 'Flowable',       role: 'Substitute + cert workflows', status: 'configured' },
  { name: 'Jitsi Meet',     role: 'Video consultations',         status: 'planned' },
  { name: 'Nextcloud',      role: 'Lesson plan file sharing',   status: 'planned' },
  { name: 'Ollama',         role: 'AI flow gen / assistant',     status: 'active' },
];

const STATUS_CHIP: Record<string, string> = {
  active:     'bg-green-100 text-green-700',
  configured: 'bg-blue-100 text-blue-700',
  planned:    'bg-gray-100 text-gray-500',
};

function IntegrationsTab() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">
          MCP Tool Registry <span className="ml-2 text-xs text-gray-400 font-normal">13 tools — 2/5/1/2/2/1</span>
        </h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {MCP_TOOLS.map(t => (
            <div key={t.name} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
              <div>
                <p className="text-xs font-mono font-semibold text-gray-800">{t.name}</p>
                <p className="text-xs text-gray-500">{t.desc}</p>
              </div>
              <span className={`ml-2 shrink-0 rounded px-2 py-0.5 text-xs font-medium ${TIER_COLOURS[t.tier]}`}>
                {t.tier}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">DB Tables (Wave 18)</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {DB_TABLES.map(t => (
            <div key={t.table} className="rounded-lg bg-gray-50 px-3 py-2">
              <p className="text-xs font-mono font-semibold text-blue-700">{t.table}</p>
              <p className="text-xs text-gray-500">{t.desc}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Open-Source Services</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {SERVICES.map(s => (
            <div key={s.name} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
              <div>
                <p className="text-xs font-semibold text-gray-800">{s.name}</p>
                <p className="text-xs text-gray-500">{s.role}</p>
              </div>
              <span className={`ml-2 shrink-0 rounded px-2 py-0.5 text-xs font-medium ${STATUS_CHIP[s.status]}`}>
                {s.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TeacherAdminPage() {
  const [tab, setTab] = useState<Tab>('overview');

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Teacher Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Wave 18 — DDD + TDD · 8 test suites · 239 tests · tenant-driven + table-driven + API-driven
          </p>
        </div>

        <div className="mb-6 flex flex-wrap gap-1 border-b border-gray-200">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium rounded-t transition-colors ${
                tab === t.key
                  ? 'border-b-2 border-purple-600 text-purple-700 bg-white'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'overview'       && <OverviewTab />}
        {tab === 'certifications' && <CertificationsTab />}
        {tab === 'schedules'      && <SchedulesTab />}
        {tab === 'performance'    && <PerformanceTab />}
        {tab === 'hr'             && <HrTab />}
        {tab === 'analytics'      && <AnalyticsTab />}
        {tab === 'integrations'   && <IntegrationsTab />}
      </div>
    </div>
  );
}
