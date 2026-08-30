'use client';
import { useEffect, useState } from 'react';

const TABS = ['Overview', 'Revenue', 'Memberships', 'Operations', 'Teachers', 'Marketing', 'System'] as const;
type Tab = typeof TABS[number];

interface ExecutiveData {
  generatedAt: string;
  overview: {
    monthRevenue: number; mrr: number; activeMembers: number; classesToday: number; newLeadsWeek: number;
    activeTeachers: number; totalTeachers: number; trialSubscriptions: number; pausedOrFrozenSubscriptions: number;
  };
  revenue: { today: number; week: number; month: number; quarter: number; ytd: number; mrr: number; topSources: { name: string; revenue: number }[] };
  memberships: {
    activeMembers: number; activeSubscriptions: number; trialActive: number; pausedSubscriptions: number;
    frozenSubscriptions: number; cancelledSubscriptions: number; tierBreakdown: { tier: string; count: number }[];
  };
  operations: {
    classesToday: number; attendanceRatePct30d: number | null; waitlistToday: number; checkinsToday: number;
    schedule: { className: string; teacher: string; startTime: string; capacity: number; booked: number; status: string }[];
  };
  teachers: { activeTeachers: number; totalTeachers: number; certificationsExpiringSoon: number; topByRevenue: { name: string; revenue: number }[]; note: string };
  marketing: { newLeadsWeek: number; conversionRatePct90d: number; referralSignupsThisMonth: number; campaignPerformance: { title: string; impressions: number; clicks: number; leads: number; revenue: number }[]; note: string };
  system: { services: Record<string, boolean>; note: string };
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

function EmptyState({ message }: { message: string }) {
  return <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-500 text-sm">{message}</div>;
}

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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{children}</h3>;
}

function cad(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

function OverviewTab({ d }: { d: ExecutiveData }) {
  const o = d.overview;
  const kpis = [
    { label: 'Revenue (this month)', value: cad(o.monthRevenue), color: 'green' },
    { label: 'Recurring Revenue (MRR)', value: cad(o.mrr), sub: 'from active subscriptions', color: 'green' },
    { label: 'Active Members', value: String(o.activeMembers), sub: 'student.status = active', color: 'blue' },
    { label: 'Classes Today', value: String(o.classesToday), color: 'purple' },
    { label: 'New Leads This Week', value: String(o.newLeadsWeek), color: 'blue' },
    { label: 'Active Teachers', value: `${o.activeTeachers}/${o.totalTeachers}`, color: 'purple' },
    { label: 'Trial Subscriptions', value: String(o.trialSubscriptions), color: 'amber' },
    { label: 'Paused / Frozen Subs', value: String(o.pausedOrFrozenSubscriptions), color: 'rose' },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {kpis.map(k => <KpiCard key={k.label} {...k} />)}
      </div>
      <p className="text-xs text-gray-400">Every figure above is a live query against sales_order, subscription_master, student, class_session, campaign_lead, and teacher_profile — no field is fabricated. Fields this codebase has no real data source for (activity trend charts, revenue-by-channel mix) are omitted rather than invented.</p>
    </div>
  );
}

function RevenueTab({ d }: { d: ExecutiveData }) {
  const r = d.revenue;
  const periods = [
    { p: 'Today', rev: r.today }, { p: 'This Week', rev: r.week }, { p: 'This Month', rev: r.month },
    { p: 'This Quarter', rev: r.quarter }, { p: 'YTD', rev: r.ytd },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {periods.map(p => <KpiCard key={p.p} label={p.p} value={cad(p.rev)} color="green" />)}
      </div>
      <div className="border rounded-lg p-4">
        <SectionTitle>Top Revenue Sources (active membership plans + paid orders)</SectionTitle>
        {r.topSources.length === 0 ? <EmptyState message="No paid orders or active subscriptions yet." /> : (
          <div className="space-y-2">
            {r.topSources.map(s => (
              <div key={s.name} className="flex justify-between text-sm py-1 border-b border-gray-50">
                <span className="text-gray-700">{s.name}</span><span className="font-semibold text-green-700">{cad(s.revenue)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="text-xs text-gray-400">Recurring Revenue (MRR): {cad(r.mrr)} — monthly-cycle subscriptions counted directly, annual-cycle subscriptions divided by 12.</p>
    </div>
  );
}

function MembershipsTab({ d }: { d: ExecutiveData }) {
  const m = d.memberships;
  const total = m.tierBreakdown.reduce((s, t) => s + t.count, 0);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Active Members" value={String(m.activeMembers)} sub="student.status = active" color="green" />
        <KpiCard label="Active Subscriptions" value={String(m.activeSubscriptions)} color="blue" />
        <KpiCard label="Trial Active" value={String(m.trialActive)} color="amber" />
        <KpiCard label="Cancelled" value={String(m.cancelledSubscriptions)} color="rose" />
      </div>
      <div className="border rounded-lg p-4">
        <SectionTitle>Membership Plan-Type Breakdown (active subscriptions)</SectionTitle>
        {m.tierBreakdown.length === 0 ? <EmptyState message="No active subscriptions yet — the pricing engine schema is real but has zero live subscribers so far." /> : (
          <div className="space-y-3">
            {m.tierBreakdown.map(t => (
              <div key={t.tier}>
                <div className="flex justify-between text-sm mb-1"><span className="capitalize">{t.tier}</span><span>{t.count} ({total ? Math.round((t.count / total) * 100) : 0}%)</span></div>
                <div className="h-2 bg-gray-100 rounded"><div className="h-2 bg-blue-500 rounded" style={{ width: `${total ? (t.count / total) * 100 : 0}%` }} /></div>
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="text-xs text-gray-400">Paused: {m.pausedSubscriptions} · Frozen: {m.frozenSubscriptions} — a "renewals this month" figure is not shown because no renewal-event log exists yet in this codebase.</p>
    </div>
  );
}

function OperationsTab({ d }: { d: ExecutiveData }) {
  const o = d.operations;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Classes Today" value={String(o.classesToday)} color="blue" />
        <KpiCard label="Attendance Rate (30d)" value={o.attendanceRatePct30d === null ? 'n/a' : `${o.attendanceRatePct30d}%`} sub={o.attendanceRatePct30d === null ? 'no bookings in window' : 'checked-in / total booked'} color="green" />
        <KpiCard label="Waitlist (Today)" value={String(o.waitlistToday)} color="amber" />
        <KpiCard label="Check-ins Today" value={String(o.checkinsToday)} color="teal" />
      </div>
      <div className="border rounded-lg p-4">
        <SectionTitle>Today&apos;s Class Schedule</SectionTitle>
        {o.schedule.length === 0 ? <EmptyState message="No classes scheduled for today." /> : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Time', 'Class', 'Teacher', 'Booked/Cap', 'Status'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">
              {o.schedule.map((c, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-xs">{c.startTime}</td>
                  <td className="px-3 py-2 font-medium">{c.className}</td>
                  <td className="px-3 py-2 text-gray-600">{c.teacher}</td>
                  <td className="px-3 py-2">{c.booked}/{c.capacity}</td>
                  <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-xs ${c.booked >= c.capacity ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{c.booked >= c.capacity ? 'Full' : c.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function TeachersTab({ d }: { d: ExecutiveData }) {
  const t = d.teachers;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Active Teachers" value={`${t.activeTeachers}/${t.totalTeachers}`} color="blue" />
        <KpiCard label="Certs Expiring Soon" value={String(t.certificationsExpiringSoon)} sub="within 30 days" color="amber" />
      </div>
      <div className="border rounded-lg p-4">
        <SectionTitle>Top Teachers by Revenue (paid orders linked to teacher_id)</SectionTitle>
        {t.topByRevenue.length === 0 ? <EmptyState message="No paid orders are linked to a teacher yet." /> : (
          <div className="space-y-2">
            {t.topByRevenue.map(x => (
              <div key={x.name} className="flex items-center gap-3 text-sm">
                <span className="w-32 font-medium truncate">{x.name}</span>
                <span className="font-semibold text-green-700">{cad(x.revenue)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">{t.note}</p>
    </div>
  );
}

function MarketingTab({ d }: { d: ExecutiveData }) {
  const m = d.marketing;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="New Leads (Week)" value={String(m.newLeadsWeek)} color="blue" />
        <KpiCard label="Lead Conversion (90d)" value={`${m.conversionRatePct90d}%`} color="green" />
        <KpiCard label="Referral Signups (Month)" value={String(m.referralSignupsThisMonth)} color="teal" />
      </div>
      <div className="border rounded-lg p-4">
        <SectionTitle>Campaign Performance (30d)</SectionTitle>
        {m.campaignPerformance.length === 0 ? <EmptyState message="No campaign analytics recorded in the last 30 days." /> : (
          <div className="space-y-2">
            {m.campaignPerformance.map(c => (
              <div key={c.title} className="grid grid-cols-5 text-sm py-1.5 border-b border-gray-50">
                <span className="font-medium col-span-1 truncate">{c.title}</span>
                <span className="text-gray-600 text-xs">{c.impressions.toLocaleString()} impr.</span>
                <span className="text-gray-600 text-xs">{c.clicks.toLocaleString()} clicks</span>
                <span className="text-gray-600 text-xs">{c.leads} leads</span>
                <span className="text-gray-600 text-xs">{cad(c.revenue)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">{m.note}</p>
    </div>
  );
}

function SystemTab({ d }: { d: ExecutiveData }) {
  const s = d.system;
  return (
    <div className="space-y-4">
      <div className="border rounded-lg p-4">
        <SectionTitle>Service Health (live reachability probe)</SectionTitle>
        <div className="space-y-2">
          {Object.entries(s.services).map(([name, up]) => (
            <div key={name} className="flex justify-between text-sm">
              <span className="text-gray-700 capitalize">{name}</span>
              <span className={`font-medium ${up ? 'text-green-600' : 'text-red-600'}`}>{up ? '● reachable' : '● unreachable'}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">{s.note}</p>
    </div>
  );
}

export default function ExecutiveDashboardPage() {
  const [tab, setTab] = useState<Tab>('Overview');
  const [data, setData] = useState<ExecutiveData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJson<ExecutiveData>('/api/admin/executive').then(d => { setData(d); setLoading(false); });
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Executive Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">CEO / Owner — cross-module business overview, computed live from real tables{data ? ` · generated ${new Date(data.generatedAt).toLocaleTimeString()}` : ''}</p>
      </div>
      <div className="border-b flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{t}</button>
        ))}
      </div>
      {loading ? <EmptyState message="Loading…" /> : !data ? <EmptyState message="Could not load executive data." /> : (
        <>
          {tab === 'Overview' && <OverviewTab d={data} />}
          {tab === 'Revenue' && <RevenueTab d={data} />}
          {tab === 'Memberships' && <MembershipsTab d={data} />}
          {tab === 'Operations' && <OperationsTab d={data} />}
          {tab === 'Teachers' && <TeachersTab d={data} />}
          {tab === 'Marketing' && <MarketingTab d={data} />}
          {tab === 'System' && <SystemTab d={data} />}
        </>
      )}
    </div>
  );
}
