'use client';
import { useState } from 'react';

const TABS = ['Overview', 'Revenue', 'Memberships', 'Operations', 'Teachers', 'Marketing', 'System'] as const;
type Tab = typeof TABS[number];

function KpiCard({ label, value, sub, color = 'blue', trend }: { label: string; value: string; sub?: string; color?: string; trend?: string }) {
  const c: Record<string, string> = { blue: 'bg-blue-50 border-blue-200 text-blue-700', green: 'bg-green-50 border-green-200 text-green-700', amber: 'bg-amber-50 border-amber-200 text-amber-700', purple: 'bg-purple-50 border-purple-200 text-purple-700', rose: 'bg-rose-50 border-rose-200 text-rose-700', teal: 'bg-teal-50 border-teal-200 text-teal-700' };
  return (
    <div className={`border rounded-lg p-4 ${c[color] ?? c.blue}`}>
      <div className="text-2xl font-bold">{value}</div>
      {trend && <div className="text-xs font-medium mt-0.5 opacity-80">{trend}</div>}
      <div className="text-sm font-medium mt-1">{label}</div>
      {sub && <div className="text-xs opacity-60 mt-0.5">{sub}</div>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{children}</h3>;
}

function MiniBar({ label, value, max, color = 'bg-blue-500' }: { label: string; value: number; max: number; color?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-28 text-gray-600 truncate">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full">
        <div className={`h-2 ${color} rounded-full`} style={{ width: `${Math.min((value / max) * 100, 100)}%` }} />
      </div>
      <span className="w-12 text-right font-medium">{value}</span>
    </div>
  );
}

function OverviewTab() {
  const kpis = [
    { label: 'Total Revenue (Aug)',   value: '$84,320', trend: '↑ 12% vs Jul', color: 'green' },
    { label: 'Active Members',        value: '2,847',   trend: '↑ 8% vs Jul',  color: 'blue' },
    { label: 'Classes Today',         value: '24',      sub: '18 confirmed, 6 pending', color: 'purple' },
    { label: 'Bookings Today',        value: '312',     trend: '↑ 5% vs yesterday',     color: 'teal' },
    { label: 'Pending Payments',      value: '$12,400', sub: '47 invoices outstanding', color: 'amber' },
    { label: 'Support Tickets',       value: '8',       sub: '3 high priority',         color: 'rose' },
    { label: 'New Leads This Week',   value: '184',     trend: '↑ 22% vs last week',    color: 'blue' },
    { label: 'Net Promoter Score',    value: '72',      sub: 'Excellent (>50)',          color: 'green' },
    { label: 'Teacher Availability',  value: '18/22',   sub: '4 unavailable today',     color: 'purple' },
    { label: 'Cancellation Rate',     value: '4.2%',    trend: '↓ 0.8% vs Jul',         color: 'teal' },
    { label: 'System Uptime',         value: '99.97%',  sub: 'Last 30 days',            color: 'green' },
    { label: 'Failed Integrations',   value: '2',       sub: 'Cal.com sync, ERPNext',   color: 'rose' },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {kpis.map(k => <KpiCard key={k.label} {...k} />)}
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="border rounded-lg p-4">
          <SectionTitle>Revenue by Channel (Aug)</SectionTitle>
          <div className="space-y-2">
            {[['Memberships','$51,200',61],['Drop-ins','$12,800',15],['Workshops','$9,600',11],['Corporate','$7,200',9],['Merchandise','$3,520',4]].map(([l,v,p]) => (
              <div key={String(l)} className="flex justify-between items-center text-sm">
                <span className="w-28 text-gray-600">{l}</span>
                <div className="flex-1 mx-3 h-2 bg-gray-100 rounded"><div className="h-2 bg-green-500 rounded" style={{ width: `${p}%` }} /></div>
                <span className="font-medium w-16 text-right">{v}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="border rounded-lg p-4">
          <SectionTitle>30-Day Activity Trend</SectionTitle>
          <div className="flex items-end gap-1 h-32">
            {[62,58,71,68,74,80,77,83,79,86,84,88,91,87,93,90,95,92,88,84,86,91,94,97,93,96,99,102,98,103].map((v, i) => (
              <div key={i} className="flex-1 bg-blue-400 rounded-t" style={{ height: `${(v / 110) * 100}%` }} />
            ))}
          </div>
          <div className="text-xs text-gray-400 mt-1">Daily bookings — Aug 1–30</div>
        </div>
      </div>
    </div>
  );
}

function RevenueTab() {
  const periods = [
    { p: 'Today',         rev: '$2,810',   vs: '+8%' },
    { p: 'This Week',     rev: '$18,400',  vs: '+11%' },
    { p: 'This Month',    rev: '$84,320',  vs: '+12%' },
    { p: 'Q3 2026',       rev: '$238,900', vs: '+18%' },
    { p: 'YTD 2026',      rev: '$621,400', vs: '+24%' },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {periods.map(p => <KpiCard key={p.p} label={p.p} value={p.rev} trend={p.vs} color="green" />)}
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="border rounded-lg p-4">
          <SectionTitle>Monthly Revenue — 2026</SectionTitle>
          <div className="flex items-end gap-2 h-40">
            {[{m:'Jan',v:68},{m:'Feb',v:71},{m:'Mar',v:74},{m:'Apr',v:78},{m:'May',v:82},{m:'Jun',v:79},{m:'Jul',v:75},{m:'Aug',v:84}].map(({m,v}) => (
              <div key={m} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full bg-green-500 rounded-t text-xs text-white text-center" style={{ height: `${(v/90)*100}%` }} />
                <span className="text-xs text-gray-500">{m}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="border rounded-lg p-4">
          <SectionTitle>Top Revenue Sources</SectionTitle>
          <div className="space-y-2">
            {[['Gold Membership','$28,400'],['Platinum Membership','$18,200'],['Workshop: Retreat','$9,600'],['Silver Membership','$8,100'],['Corporate Acme','$7,200'],['Drop-in Classes','$4,800']].map(([l, v]) => (
              <div key={String(l)} className="flex justify-between text-sm py-1 border-b border-gray-50">
                <span className="text-gray-700">{l}</span><span className="font-semibold text-green-700">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MembershipsTab() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Active Members"     value="2,847" trend="↑ 8%" color="green" />
        <KpiCard label="Expired This Month" value="142"   sub="10.2% churn" color="rose" />
        <KpiCard label="Renewals This Month"value="284"   trend="87% renewal rate" color="blue" />
        <KpiCard label="Trial Active"       value="96"    sub="Started last 30 days" color="amber" />
      </div>
      <div className="border rounded-lg p-4">
        <SectionTitle>Membership Tier Breakdown</SectionTitle>
        <div className="space-y-3">
          {[['Silver','1,240',44,'bg-gray-400'],['Gold','982',34,'bg-yellow-500'],['Platinum','392',14,'bg-purple-500'],['Trial','96',3,'bg-blue-400'],['Drop-in','137',5,'bg-teal-500']].map(([t,n,p,c]) => (
            <div key={String(t)}>
              <div className="flex justify-between text-sm mb-1"><span>{t}</span><span>{n} ({p}%)</span></div>
              <div className="h-2 bg-gray-100 rounded"><div className={`h-2 ${c} rounded`} style={{ width: `${p}%` }} /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OperationsTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Classes Today"       value="24"   sub="18 booked, 6 available" color="blue" />
        <KpiCard label="Avg Attendance Rate" value="78%"  trend="↑ 3% vs last month"  color="green" />
        <KpiCard label="Waitlist (Today)"    value="42"   sub="3 classes fully booked" color="amber" />
        <KpiCard label="QR Check-ins Today"  value="186"  sub="Manual: 12"             color="teal" />
      </div>
      <div className="border rounded-lg p-4">
        <SectionTitle>Today's Class Schedule</SectionTitle>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Time','Class','Teacher','Booked/Cap','Status'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">
            {[
              ['07:00','Morning Flow','Priya S.','15/15','Full'],
              ['09:00','Yin Restore','Anita M.','8/12','Available'],
              ['11:00','Power Vinyasa','Raj K.','12/15','Available'],
              ['17:00','Evening Hatha','Priya S.','10/15','Available'],
              ['19:00','Meditation','Meera T.','14/15','Almost Full'],
            ].map(([t, c, te, b, s]) => (
              <tr key={String(t)} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-xs">{t}</td>
                <td className="px-3 py-2 font-medium">{c}</td>
                <td className="px-3 py-2 text-gray-600">{te}</td>
                <td className="px-3 py-2">{b}</td>
                <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-xs ${s==='Full'?'bg-red-100 text-red-700':s==='Almost Full'?'bg-amber-100 text-amber-700':'bg-green-100 text-green-700'}`}>{s}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TeachersTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Active Teachers"   value="22"   color="blue" />
        <KpiCard label="Avg Rating"        value="4.7"  trend="↑ 0.1" color="green" />
        <KpiCard label="Avg Utilization"   value="74%"  color="purple" />
        <KpiCard label="Expiring Certs"    value="3"    sub="Within 30 days" color="amber" />
      </div>
      <div className="border rounded-lg p-4">
        <SectionTitle>Top 5 Teachers by Revenue (Aug)</SectionTitle>
        <div className="space-y-2">
          {[['Priya Sharma','$8,400',94],['Anita Mehta','$7,200',88],['Raj Kumar','$6,800',82],['Meera Tiwari','$5,600',71],['Arjun Nair','$4,900',62]].map(([n,r,p]) => (
            <div key={String(n)} className="flex items-center gap-3 text-sm">
              <span className="w-28 font-medium truncate">{n}</span>
              <div className="flex-1 h-2 bg-gray-100 rounded"><div className="h-2 bg-purple-500 rounded" style={{ width: `${p}%` }} /></div>
              <span className="font-semibold text-green-700 w-16 text-right">{r}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MarketingTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="New Leads (Week)"     value="184" trend="↑ 22%" color="blue" />
        <KpiCard label="Lead Conversion"      value="18%" trend="↑ 2%"  color="green" />
        <KpiCard label="Email Open Rate"      value="34%" sub="Industry avg: 21%" color="purple" />
        <KpiCard label="Referral Signups"     value="42"  sub="This month" color="teal" />
      </div>
      <div className="border rounded-lg p-4">
        <SectionTitle>Campaign Performance (Aug)</SectionTitle>
        <div className="space-y-2">
          {[['Back to Yoga Email','1,840 sent','34% open','8.2% click','18 conv.'],['WhatsApp Blast','920 sent','61% open','22% click','31 conv.'],['Instagram Reel Ad','$420 spend','4.2k reach','182 clicks','12 conv.'],['Referral Campaign','204 referred','—','—','42 paid']].map(([n,...cols]) => (
            <div key={String(n)} className="grid grid-cols-5 text-sm py-1.5 border-b border-gray-50">
              <span className="font-medium col-span-1">{n}</span>
              {cols.map((v, i) => <span key={i} className="text-gray-600 text-xs">{v}</span>)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SystemTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="System Uptime"    value="99.97%" color="green" />
        <KpiCard label="API Error Rate"   value="0.12%"  color="teal" />
        <KpiCard label="Failed Jobs"      value="3"      sub="2 retrying" color="amber" />
        <KpiCard label="Security Alerts"  value="1"      sub="Low priority" color="rose" />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {[
          { title: 'Service Health', items: [['Next.js Frontend','99.99%','green'],['PostgreSQL','100%','green'],['Redis','100%','green'],['Ollama (LLM)','99.8%','green'],['Cal.com Sync','98.1%','amber'],['ERPNext','96.4%','amber']] },
          { title: 'Recent Alerts', items: [['Cal.com webhook timeout','2h ago','amber'],['Redis memory >70%','6h ago','amber'],['Login spike from IN','1d ago','green'],['SSL cert renew (30d)','ongoing','blue']] },
        ].map(section => (
          <div key={section.title} className="border rounded-lg p-4">
            <SectionTitle>{section.title}</SectionTitle>
            <div className="space-y-2">
              {section.items.map(([l, v, c]) => (
                <div key={String(l)} className="flex justify-between text-sm">
                  <span className="text-gray-700">{l}</span>
                  <span className={`font-medium ${c==='green'?'text-green-600':c==='amber'?'text-amber-600':'text-blue-600'}`}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ExecutiveDashboardPage() {
  const [tab, setTab] = useState<Tab>('Overview');
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Executive Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">CEO / Owner — cross-module business overview</p>
      </div>
      <div className="border-b flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{t}</button>
        ))}
      </div>
      {tab === 'Overview'     && <OverviewTab />}
      {tab === 'Revenue'      && <RevenueTab />}
      {tab === 'Memberships'  && <MembershipsTab />}
      {tab === 'Operations'   && <OperationsTab />}
      {tab === 'Teachers'     && <TeachersTab />}
      {tab === 'Marketing'    && <MarketingTab />}
      {tab === 'System'       && <SystemTab />}
    </div>
  );
}
