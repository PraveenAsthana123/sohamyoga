'use client';
import { useState } from 'react';

const TABS = ['Overview', 'Leads', 'Pipeline', 'Segmentation', 'CLV', 'Churn', 'Campaigns'] as const;
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
  const c: Record<string, string> = { blue: 'bg-blue-100 text-blue-700', green: 'bg-green-100 text-green-700', amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700', purple: 'bg-purple-100 text-purple-700', gray: 'bg-gray-100 text-gray-600', teal: 'bg-teal-100 text-teal-700' };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c[color] ?? c.blue}`}>{children}</span>;
}

function OverviewTab() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total Contacts"       value="3,284" sub="↑ 8% vs Jul"         color="blue" />
        <KpiCard label="Active Leads"         value="184"   sub="↑ 22% vs last week"  color="green" />
        <KpiCard label="Conversion Rate"      value="18%"   sub="↑ 2% vs last month"  color="teal" />
        <KpiCard label="Avg CLV"              value="$840"  sub="Per active member"    color="purple" />
        <KpiCard label="Churn Rate (Month)"   value="4.2%"  sub="↓ 0.8% vs Jul"       color="amber" />
        <KpiCard label="NPS Score"            value="72"    sub="Excellent"            color="green" />
        <KpiCard label="Email Open Rate"      value="34%"   sub="Industry avg: 21%"   color="blue" />
        <KpiCard label="Referral Signups"     value="42"    sub="This month"           color="teal" />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="border rounded-lg p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Lead Sources (Aug)</h3>
          {[['Organic Search', 48, 'bg-blue-400'], ['Referral', 23, 'bg-green-400'], ['Instagram', 14, 'bg-pink-400'], ['WhatsApp', 9, 'bg-teal-400'], ['Direct', 6, 'bg-gray-400']].map(([l, p, c]) => (
            <div key={String(l)} className="flex items-center gap-3 text-sm mb-2">
              <span className="w-28 text-gray-600 text-xs">{l}</span>
              <div className="flex-1 h-2 bg-gray-100 rounded"><div className={`h-2 ${c} rounded`} style={{ width: `${p}%` }} /></div>
              <span className="w-8 text-right font-medium">{p}%</span>
            </div>
          ))}
        </div>
        <div className="border rounded-lg p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Customer Journey (Funnel)</h3>
          {[['Website Visitors', 4200], ['Leads', 184], ['Trial Started', 96], ['Converted', 33], ['Retained 3mo', 28]].map(([stage, n]) => (
            <div key={String(stage)} className="flex justify-between items-center text-sm mb-1.5">
              <span className="text-gray-600">{stage}</span>
              <div className="flex items-center gap-2">
                <div className="w-32 h-1.5 bg-gray-100 rounded"><div className="h-1.5 bg-blue-400 rounded" style={{ width: `${(Number(n) / 4200) * 100}%` }} /></div>
                <span className="w-12 text-right font-medium">{n.toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LeadsTab() {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 flex justify-between">
        <h3 className="text-sm font-semibold">Active Leads (184)</h3>
        <button className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded">+ Add Lead</button>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Name', 'Email', 'Source', 'Stage', 'Score', 'Owner', 'Added'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-gray-100">
          {[
            ['Priya Kapoor',  'priya.k@email.com', 'Instagram',  'trial',      84, 'Meera', 'Aug 4'],
            ['Arjun Mehta',   'arjun.m@email.com', 'Referral',   'contacted',  72, 'Ranjit', 'Aug 4'],
            ['Sneha Patel',   'sneha.p@email.com', 'Organic',    'new',        61, 'Auto',  'Aug 5'],
            ['Vikas Sharma',  'vikas.s@email.com', 'WhatsApp',   'demo_scheduled', 91, 'Meera', 'Aug 3'],
            ['Anjali Roy',    'anjali.r@email.com','Direct',     'trial',      78, 'Ranjit', 'Aug 2'],
          ].map(([name, email, source, stage, score, owner, added]) => (
            <tr key={String(email)} className="hover:bg-gray-50">
              <td className="px-3 py-2 font-medium">{name}</td>
              <td className="px-3 py-2 text-gray-600 text-xs">{email}</td>
              <td className="px-3 py-2"><Badge color="blue">{source}</Badge></td>
              <td className="px-3 py-2"><Badge color={stage === 'demo_scheduled' ? 'purple' : stage === 'trial' ? 'teal' : 'gray'}>{stage}</Badge></td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-1">
                  <div className="w-12 h-1.5 bg-gray-100 rounded"><div className={`h-1.5 ${Number(score) > 80 ? 'bg-green-500' : Number(score) > 60 ? 'bg-amber-400' : 'bg-gray-400'} rounded`} style={{ width: `${score}%` }} /></div>
                  <span className="text-xs font-medium">{score}</span>
                </div>
              </td>
              <td className="px-3 py-2 text-gray-600">{owner}</td>
              <td className="px-3 py-2 text-gray-500 text-xs">{added}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PipelineTab() {
  const stages = [
    { name: 'New',          leads: 42, color: 'bg-gray-100 border-gray-300' },
    { name: 'Contacted',    leads: 38, color: 'bg-blue-100 border-blue-300' },
    { name: 'Trial',        leads: 28, color: 'bg-purple-100 border-purple-300' },
    { name: 'Demo Scheduled', leads: 12, color: 'bg-amber-100 border-amber-300' },
    { name: 'Proposal',     leads: 8,  color: 'bg-teal-100 border-teal-300' },
    { name: 'Converted',    leads: 33, color: 'bg-green-100 border-green-300' },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Total in Pipeline" value="161"  color="blue" />
        <KpiCard label="Converted (Month)" value="33"   sub="18% conversion" color="green" />
        <KpiCard label="Avg Deal Time"     value="12 days" color="purple" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        {stages.map(stage => (
          <div key={stage.name} className={`border-2 rounded-lg p-3 ${stage.color}`}>
            <div className="text-lg font-bold text-gray-800">{stage.leads}</div>
            <div className="text-xs font-medium text-gray-600 mt-0.5">{stage.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SegmentationTab() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Customer Segments</h3>
        <button className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded">+ Create Segment</button>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        {[
          { name: 'High-Value Members',      count: 392, desc: 'Platinum tier, CLV > $1,200',          color: 'purple' },
          { name: 'At-Risk Members',         count: 184, desc: 'No class > 14 days, active membership',color: 'rose' },
          { name: 'Highly Engaged',          count: 620, desc: '8+ classes/month, NPS > 8',             color: 'green' },
          { name: 'Win-Back Candidates',     count: 248, desc: 'Lapsed > 60 days, previously Gold+',   color: 'amber' },
          { name: 'Corporate Prospects',     count: 42,  desc: 'B2B contacts, no contract yet',         color: 'blue' },
          { name: 'Referral Champions',      count: 84,  desc: 'Made ≥ 2 successful referrals',        color: 'teal' },
        ].map(seg => (
          <div key={seg.name} className="border rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-semibold text-sm">{seg.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">{seg.desc}</div>
              </div>
              <span className={`text-lg font-bold ${seg.color === 'purple' ? 'text-purple-600' : seg.color === 'green' ? 'text-green-600' : seg.color === 'rose' ? 'text-rose-600' : 'text-blue-600'}`}>{seg.count}</span>
            </div>
            <div className="flex gap-2 mt-3">
              <button className="text-xs text-blue-600 hover:underline">View</button>
              <button className="text-xs text-purple-600 hover:underline">Campaign</button>
              <button className="text-xs text-gray-500 hover:underline">Export</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CLVTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Avg CLV"         value="$840"   sub="Per active member" color="purple" />
        <KpiCard label="Top 10% CLV"     value="$3,200" sub="Platinum members"  color="green" />
        <KpiCard label="CLV / CAC Ratio" value="8.4x"   sub="Target: > 3x"      color="teal" />
      </div>
      <div className="border rounded-lg p-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">CLV Distribution by Tier</h3>
        {[['Silver', '$320', '$480', '$610'], ['Gold', '$680', '$920', '$1,240'], ['Platinum', '$1,800', '$2,400', '$3,800'], ['Drop-in', '$80', '$120', '$200']].map(([tier, p25, median, p90]) => (
          <div key={String(tier)} className="py-2 border-b border-gray-50 text-sm">
            <div className="flex justify-between">
              <span className="font-medium w-20">{tier}</span>
              <span className="text-gray-500 text-xs">P25: {p25}</span>
              <span className="font-semibold text-purple-700">Median: {median}</span>
              <span className="text-gray-500 text-xs">P90: {p90}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChurnTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Churn Rate (Month)"   value="4.2%"  sub="↓ 0.8% vs Jul" color="green" />
        <KpiCard label="Members Churned"      value="142"   sub="142 this month" color="amber" />
        <KpiCard label="Revenue Lost"         value="$11,280" sub="From churned" color="rose" />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="border rounded-lg p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Churn Reasons (Exit Survey)</h3>
          {[['Too expensive', 28], ['Not using enough', 22], ['Moved location', 18], ['Health reasons', 12], ['Schedule conflict', 11], ['Other', 9]].map(([reason, pct]) => (
            <div key={String(reason)} className="flex items-center gap-3 text-sm mb-2">
              <span className="w-36 text-gray-600 text-xs">{reason}</span>
              <div className="flex-1 h-2 bg-gray-100 rounded"><div className="h-2 bg-rose-400 rounded" style={{ width: `${pct}%` }} /></div>
              <span className="w-8 text-right font-medium">{pct}%</span>
            </div>
          ))}
        </div>
        <div className="border rounded-lg p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">At-Risk — Early Warning</h3>
          {[
            { name: 'Sanjay Mehta', last: '18 days ago', tier: 'Gold',   risk: 'High' },
            { name: 'Pooja Sharma', last: '14 days ago', tier: 'Silver', risk: 'High' },
            { name: 'Rahul Nair',   last: '12 days ago', tier: 'Gold',   risk: 'Medium' },
            { name: 'Kavya Singh',  last: '10 days ago', tier: 'Platinum',risk: 'Low' },
          ].map(({ name, last, tier, risk }) => (
            <div key={name} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50">
              <div><div className="font-medium">{name}</div><div className="text-xs text-gray-500">Last class: {last}</div></div>
              <div className="flex items-center gap-2">
                <Badge color="blue">{tier}</Badge>
                <Badge color={risk === 'High' ? 'red' : risk === 'Medium' ? 'amber' : 'green'}>{risk}</Badge>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CampaignsTab() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <h3 className="text-sm font-semibold">CRM Campaigns</h3>
        <button className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded">+ New Campaign</button>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Campaign', 'Segment', 'Sent', 'Open Rate', 'CTR', 'Conversions', 'Status'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">
            {[
              ['Win-Back Aug', 'Win-Back Candidates', 248, '28%', '6.4%', 14, 'active'],
              ['Platinum Upgrade', 'Gold + High CLV', 186, '42%', '12%', 22, 'active'],
              ['Re-engage At-Risk', 'At-Risk Members', 184, '24%', '4.2%', 8, 'active'],
              ['Corporate Outreach', 'Corporate Prospects', 42, '38%', '18%', 6, 'draft'],
              ['Referral Drive', 'Highly Engaged', 620, '44%', '22%', 42, 'completed'],
            ].map(([name, segment, sent, open, ctr, conv, status]) => (
              <tr key={String(name)} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{name}</td>
                <td className="px-3 py-2 text-xs text-gray-600">{segment}</td>
                <td className="px-3 py-2">{sent}</td>
                <td className="px-3 py-2 font-medium">{open}</td>
                <td className="px-3 py-2">{ctr}</td>
                <td className="px-3 py-2 font-bold text-green-700">{conv}</td>
                <td className="px-3 py-2"><Badge color={status === 'active' ? 'green' : status === 'completed' ? 'blue' : 'gray'}>{status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function CRMAdminPage() {
  const [tab, setTab] = useState<Tab>('Overview');
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">CRM & Lifecycle</h1>
        <p className="text-sm text-gray-500 mt-1">Leads, pipeline, segmentation, CLV, churn analysis and campaigns</p>
      </div>
      <div className="border-b flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{t}</button>
        ))}
      </div>
      {tab === 'Overview'      && <OverviewTab />}
      {tab === 'Leads'         && <LeadsTab />}
      {tab === 'Pipeline'      && <PipelineTab />}
      {tab === 'Segmentation'  && <SegmentationTab />}
      {tab === 'CLV'           && <CLVTab />}
      {tab === 'Churn'         && <ChurnTab />}
      {tab === 'Campaigns'     && <CampaignsTab />}
    </div>
  );
}
