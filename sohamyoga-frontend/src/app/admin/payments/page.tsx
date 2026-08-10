'use client';
import { useState } from 'react';

const TABS = ['Overview', 'Transactions', 'Invoices', 'Refunds', 'Commissions', 'Tax', 'Reports'] as const;
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
        <KpiCard label="Revenue (Aug)"         value="$84,320" sub="↑ 12% vs Jul"        color="green" />
        <KpiCard label="Collected Today"        value="$2,810"  sub="48 transactions"       color="green" />
        <KpiCard label="Outstanding Invoices"   value="$12,400" sub="47 unpaid"            color="amber" />
        <KpiCard label="Overdue (>30 days)"     value="$3,200"  sub="12 invoices"          color="rose" />
        <KpiCard label="Refunds Pending"        value="$840"    sub="6 pending requests"   color="amber" />
        <KpiCard label="Teacher Commissions"    value="$18,200" sub="Payable Aug 31"       color="purple" />
        <KpiCard label="GST/Tax Collected"      value="$8,432"  sub="5% HST (Canada)"     color="teal" />
        <KpiCard label="Payment Failure Rate"   value="1.8%"    sub="↓ 0.4% vs Jul"       color="blue" />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="border rounded-lg p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Payment Method Split</h3>
          {[['Card (Stripe)', 68, 'bg-blue-500'], ['UPI / GPay', 18, 'bg-green-500'], ['Wallet Credits', 8, 'bg-purple-500'], ['Cash', 4, 'bg-amber-500'], ['Cheque', 2, 'bg-gray-400']].map(([l, p, c]) => (
            <div key={String(l)} className="flex items-center gap-3 text-sm mb-2">
              <span className="w-28 text-gray-600 truncate">{l}</span>
              <div className="flex-1 h-2 bg-gray-100 rounded"><div className={`h-2 ${c} rounded`} style={{ width: `${p}%` }} /></div>
              <span className="w-8 text-right font-medium">{p}%</span>
            </div>
          ))}
        </div>
        <div className="border rounded-lg p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Revenue — Last 7 Days</h3>
          <div className="flex items-end gap-2 h-24">
            {[{d:'Tue',v:2200},{d:'Wed',v:2640},{d:'Thu',v:2480},{d:'Fri',v:3100},{d:'Sat',v:3800},{d:'Sun',v:2900},{d:'Mon',v:2810}].map(({d,v}) => (
              <div key={d} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full bg-green-400 rounded-t" style={{ height: `${(v/4000)*100}%` }} />
                <span className="text-xs text-gray-500">{d}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TransactionsTab() {
  const txns = [
    { id: 'TXN-4821', student: 'Aarav Shah',   amount: '$120', type: 'Membership',  method: 'Card', status: 'success',  date: 'Aug 5 10:14' },
    { id: 'TXN-4820', student: 'Diya Patel',   amount: '$25',  type: 'Drop-in',     method: 'UPI',  status: 'success',  date: 'Aug 5 09:42' },
    { id: 'TXN-4819', student: 'Riya Gupta',   amount: '$200', type: 'Workshop',    method: 'Card', status: 'success',  date: 'Aug 5 09:11' },
    { id: 'TXN-4818', student: 'Kiran Mehta',  amount: '$80',  type: 'Membership',  method: 'Card', status: 'failed',   date: 'Aug 5 08:55' },
    { id: 'TXN-4817', student: 'Priya Roy',    amount: '$120', type: 'Membership',  method: 'Card', status: 'success',  date: 'Aug 4 18:22' },
  ];
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 flex justify-between">
        <h3 className="text-sm font-semibold">Recent Transactions</h3>
        <button className="text-xs text-blue-600 hover:underline">Export CSV</button>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Txn ID', 'Student', 'Amount', 'Type', 'Method', 'Status', 'Date'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-gray-100">
          {txns.map(t => (
            <tr key={t.id} className="hover:bg-gray-50">
              <td className="px-3 py-2 font-mono text-xs text-gray-500">{t.id}</td>
              <td className="px-3 py-2 font-medium">{t.student}</td>
              <td className="px-3 py-2 font-semibold text-green-700">{t.amount}</td>
              <td className="px-3 py-2 text-gray-600">{t.type}</td>
              <td className="px-3 py-2"><Badge color="blue">{t.method}</Badge></td>
              <td className="px-3 py-2"><Badge color={t.status === 'success' ? 'green' : 'red'}>{t.status}</Badge></td>
              <td className="px-3 py-2 text-gray-500 text-xs">{t.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InvoicesTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Total Outstanding" value="$12,400" color="amber" />
        <KpiCard label="Overdue > 30 days" value="$3,200"  color="rose" />
        <KpiCard label="Sent This Month"   value="312"      color="blue" />
      </div>
      <div className="border rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 flex justify-between">
          <h3 className="text-sm font-semibold">Outstanding Invoices</h3>
          <button className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded">+ Create Invoice</button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Invoice #', 'Client', 'Amount', 'Due Date', 'Status', 'Actions'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">
            {[
              ['INV-0428', 'Acme Corp (B2B)', '$2,400', 'Aug 15', 'pending'],
              ['INV-0427', 'Aarav Shah',      '$360',   'Aug 10', 'overdue'],
              ['INV-0426', 'TechCorp B2B',    '$4,800', 'Aug 20', 'pending'],
              ['INV-0425', 'Diya Patel',      '$120',   'Jul 25', 'overdue'],
            ].map(([inv, cl, am, due, st]) => (
              <tr key={String(inv)} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-xs">{inv}</td>
                <td className="px-3 py-2 font-medium">{cl}</td>
                <td className="px-3 py-2 font-semibold">{am}</td>
                <td className="px-3 py-2 text-gray-600">{due}</td>
                <td className="px-3 py-2"><Badge color={st === 'overdue' ? 'red' : 'amber'}>{st}</Badge></td>
                <td className="px-3 py-2">
                  <button className="text-xs text-blue-600 hover:underline mr-2">Send Reminder</button>
                  <button className="text-xs text-gray-500 hover:underline">Mark Paid</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RefundsTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Pending Refunds"   value="6"    color="amber" />
        <KpiCard label="Refunded (Month)"  value="$840" color="rose" />
        <KpiCard label="Avg Processing"    value="2.1d" color="blue" />
      </div>
      <div className="border rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-gray-50"><h3 className="text-sm font-semibold">Refund Requests</h3></div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Request', 'Student', 'Amount', 'Reason', 'Requested', 'Status', 'Actions'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">
            {[
              ['RFN-048', 'Aarav Shah',  '$120', 'Illness — medical cert attached', 'Aug 4', 'pending'],
              ['RFN-047', 'Riya Gupta',  '$200', 'Workshop cancelled',              'Aug 3', 'approved'],
              ['RFN-046', 'Kiran Mehta', '$80',  'Duplicate payment',               'Aug 2', 'processing'],
            ].map(([r, s, a, reason, req, st]) => (
              <tr key={String(r)} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-xs">{r}</td>
                <td className="px-3 py-2 font-medium">{s}</td>
                <td className="px-3 py-2 font-semibold">{a}</td>
                <td className="px-3 py-2 text-gray-600 text-xs max-w-xs truncate">{reason}</td>
                <td className="px-3 py-2 text-gray-500 text-xs">{req}</td>
                <td className="px-3 py-2"><Badge color={st === 'approved' ? 'green' : st === 'processing' ? 'blue' : 'amber'}>{st}</Badge></td>
                <td className="px-3 py-2">
                  <button className="text-xs text-green-600 hover:underline mr-2">Approve</button>
                  <button className="text-xs text-red-500 hover:underline">Decline</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CommissionsTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Total Commissions Due" value="$18,200" sub="Payable Aug 31" color="purple" />
        <KpiCard label="Paid YTD"              value="$82,400"                      color="green" />
        <KpiCard label="Avg Commission Rate"   value="21.6%"  sub="Of teacher revenue" color="blue" />
      </div>
      <div className="border rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 flex justify-between"><h3 className="text-sm font-semibold">Teacher Commissions — Aug 2026</h3><button className="text-xs text-blue-600 hover:underline">Export</button></div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Teacher', 'Classes', 'Students', 'Revenue', 'Rate', 'Commission', 'Status'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">
            {[
              ['Priya Sharma','42','580','$8,400','22%','$1,848','pending'],
              ['Anita Mehta', '36','420','$7,200','22%','$1,584','pending'],
              ['Raj Kumar',   '38','460','$6,800','20%','$1,360','pending'],
              ['Meera Tiwari','30','380','$5,600','20%','$1,120','pending'],
            ].map(([t, cl, st, rev, rate, comm, status]) => (
              <tr key={String(t)} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{t}</td>
                <td className="px-3 py-2">{cl}</td>
                <td className="px-3 py-2">{st}</td>
                <td className="px-3 py-2 font-semibold text-green-700">{rev}</td>
                <td className="px-3 py-2">{rate}</td>
                <td className="px-3 py-2 font-bold text-purple-700">{comm}</td>
                <td className="px-3 py-2"><Badge color="amber">{status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TaxTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Tax Collected (Aug)" value="$8,432" sub="5% HST Canada"    color="teal" />
        <KpiCard label="Tax Collected YTD"   value="$38,400"                       color="green" />
        <KpiCard label="Next Remittance"     value="Sep 15" sub="CRA quarterly"    color="amber" />
      </div>
      <div className="border rounded-lg p-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Tax Breakdown by Category</h3>
        {[['Membership Fees', '$51,200', '$2,560', 'HST 5%'], ['Workshop Fees', '$9,600', '$480', 'HST 5%'], ['Corporate B2B', '$7,200', '$360', 'HST 5%'], ['Drop-in Classes', '$12,800', '$640', 'HST 5%']].map(([cat, rev, tax, rate]) => (
          <div key={String(cat)} className="flex justify-between text-sm py-2 border-b border-gray-50">
            <span className="text-gray-700 w-40">{cat}</span>
            <span className="text-gray-600">{rev}</span>
            <span className="font-semibold text-teal-700">{tax}</span>
            <span className="text-gray-400 text-xs">{rate}</span>
          </div>
        ))}
        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
          Note: Tax configuration and remittance must be reviewed by a qualified accountant before filing. This dashboard is for operational tracking only.
        </div>
      </div>
    </div>
  );
}

function ReportsTab() {
  return (
    <div className="grid md:grid-cols-3 gap-3">
      {[
        { title: 'Revenue Statement', desc: 'P&L by month/quarter/year' },
        { title: 'Transaction Log', desc: 'Full audit trail, exportable' },
        { title: 'Outstanding AR Report', desc: 'Aging analysis of invoices' },
        { title: 'Commission Statement', desc: 'Per-teacher, per-period' },
        { title: 'Tax Summary', desc: 'GST/HST collected, remittance-ready' },
        { title: 'Refund Analysis', desc: 'Trends, reasons, impact' },
        { title: 'Payment Failure Report', desc: 'Declined transactions, retry success' },
        { title: 'Membership Revenue', desc: 'Recurring vs one-time breakdown' },
        { title: 'Churn Revenue Impact', desc: 'Lost MRR from cancellations' },
      ].map(r => (
        <div key={r.title} className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer">
          <div className="text-sm font-semibold">{r.title}</div>
          <div className="text-xs text-gray-500 mt-1">{r.desc}</div>
          <button className="mt-3 text-xs text-blue-600 hover:underline">Generate →</button>
        </div>
      ))}
    </div>
  );
}

export default function PaymentsAdminPage() {
  const [tab, setTab] = useState<Tab>('Overview');
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Payments & Finance</h1>
        <p className="text-sm text-gray-500 mt-1">Transactions, invoices, refunds, commissions, and tax reporting</p>
      </div>
      <div className="border-b flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{t}</button>
        ))}
      </div>
      {tab === 'Overview'      && <OverviewTab />}
      {tab === 'Transactions'  && <TransactionsTab />}
      {tab === 'Invoices'      && <InvoicesTab />}
      {tab === 'Refunds'       && <RefundsTab />}
      {tab === 'Commissions'   && <CommissionsTab />}
      {tab === 'Tax'           && <TaxTab />}
      {tab === 'Reports'       && <ReportsTab />}
    </div>
  );
}
