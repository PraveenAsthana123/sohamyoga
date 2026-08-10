'use client';
import { useState } from 'react';

const TABS = ['Overview', 'Today', 'Upcoming', 'Waitlist', 'No-shows', 'Rules', 'Reports'] as const;
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
        <KpiCard label="Total Bookings (Month)" value="2,184" sub="↑ 9% vs Jul"        color="blue" />
        <KpiCard label="Confirmed Today"         value="312"   sub="92% confirmation rate" color="green" />
        <KpiCard label="Pending Confirmations"   value="28"    sub="~2hr avg lag"         color="amber" />
        <KpiCard label="Cancellations (Month)"   value="84"    sub="3.8% rate"            color="rose" />
        <KpiCard label="No-shows (Month)"        value="37"    sub="1.7% rate"            color="rose" />
        <KpiCard label="Waitlist Conversions"    value="42"    sub="34% waitlist success" color="teal" />
        <KpiCard label="Online Bookings"         value="88%"   sub="App + Web"            color="purple" />
        <KpiCard label="Avg Lead Time"           value="2.4d"  sub="Before class"         color="blue" />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="border rounded-lg p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Booking Channel Split</h3>
          {[['Mobile App', 58, 'bg-blue-500'], ['Web Portal', 30, 'bg-purple-500'], ['Front Desk', 8, 'bg-amber-500'], ['Phone', 4, 'bg-gray-400']].map(([label, pct, color]) => (
            <div key={String(label)} className="flex items-center gap-3 text-sm mb-2">
              <span className="w-24 text-gray-600">{label}</span>
              <div className="flex-1 h-2 bg-gray-100 rounded"><div className={`h-2 ${color} rounded`} style={{ width: `${pct}%` }} /></div>
              <span className="w-8 text-right font-medium">{pct}%</span>
            </div>
          ))}
        </div>
        <div className="border rounded-lg p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Daily Bookings — Last 14 Days</h3>
          <div className="flex items-end gap-1 h-24">
            {[84,91,88,96,93,99,102,98,104,101,108,105,110,107].map((v, i) => (
              <div key={i} className="flex-1 bg-blue-400 rounded-t" style={{ height: `${(v / 115) * 100}%` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TodayTab() {
  const bookings = [
    { time: '07:00', class: 'Morning Flow',  student: 'Aarav Shah',  status: 'confirmed', method: 'App' },
    { time: '07:00', class: 'Morning Flow',  student: 'Diya Patel',  status: 'checked_in', method: 'QR' },
    { time: '09:00', class: 'Yin Restore',   student: 'Riya Gupta',  status: 'confirmed', method: 'Web' },
    { time: '09:00', class: 'Yin Restore',   student: 'Kiran Mehta', status: 'no_show',   method: 'App' },
    { time: '11:00', class: 'Power Vinyasa', student: 'Priya Roy',   status: 'confirmed', method: 'App' },
    { time: '17:00', class: 'Eve. Hatha',    student: 'Arjun Singh',  status: 'pending',   method: 'Phone' },
  ];
  const statusColor: Record<string, string> = { confirmed: 'green', checked_in: 'blue', no_show: 'red', pending: 'amber' };
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 flex justify-between items-center">
        <h3 className="text-sm font-semibold">Today — Tue 5 Aug 2026</h3>
        <span className="text-xs text-gray-500">312 bookings</span>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Time', 'Class', 'Student', 'Status', 'Channel', 'Actions'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-gray-100">
          {bookings.map((b, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="px-3 py-2 font-mono text-xs">{b.time}</td>
              <td className="px-3 py-2 font-medium">{b.class}</td>
              <td className="px-3 py-2">{b.student}</td>
              <td className="px-3 py-2"><Badge color={statusColor[b.status]}>{b.status.replace('_', ' ')}</Badge></td>
              <td className="px-3 py-2 text-gray-600 text-xs">{b.method}</td>
              <td className="px-3 py-2">
                <button className="text-xs text-blue-600 hover:underline mr-2">Check In</button>
                <button className="text-xs text-red-500 hover:underline">Cancel</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UpcomingTab() {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {['Next 24 hrs', 'Next 7 days', 'Next 30 days'].map(f => (
          <button key={f} className="text-xs px-3 py-1.5 border rounded hover:bg-gray-50">{f}</button>
        ))}
      </div>
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Date', 'Time', 'Class', 'Teacher', 'Booked', 'Available', 'Status'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">
            {[
              ['Wed Aug 6', '07:00', 'Morning Flow',  'Priya S.', 14, 1, 'Almost Full'],
              ['Wed Aug 6', '09:00', 'Yin Restore',   'Raj K.',   6, 6, 'Available'],
              ['Thu Aug 7', '07:00', 'Morning Flow',  'Anita M.', 10, 5, 'Available'],
              ['Thu Aug 7', '19:00', 'Meditation',    'Meera T.', 17, 3, 'Almost Full'],
              ['Fri Aug 8', '11:00', 'Power Vinyasa', 'Priya S.', 15, 0, 'Full'],
            ].map(([d, t, c, te, b, av, s]) => (
              <tr key={`${d}-${t}`} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{d}</td>
                <td className="px-3 py-2 font-mono text-xs">{t}</td>
                <td className="px-3 py-2">{c}</td>
                <td className="px-3 py-2 text-gray-600">{te}</td>
                <td className="px-3 py-2">{b}</td>
                <td className="px-3 py-2">{av}</td>
                <td className="px-3 py-2"><Badge color={s === 'Full' ? 'red' : s === 'Almost Full' ? 'amber' : 'green'}>{s}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WaitlistTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="On Waitlist"       value="124" color="amber" />
        <KpiCard label="Promoted Today"    value="8"   color="green" />
        <KpiCard label="Expired Today"     value="3"   color="rose" />
      </div>
      <div className="border rounded-lg p-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Waitlist Queue</h3>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Class', 'Student', 'Position', 'Joined', 'Notify Method'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">
            {[
              ['Morning Flow Mon', 'Aarav Shah',  '#1', '3 days ago', 'SMS + Email'],
              ['Morning Flow Mon', 'Diya Patel',  '#2', '2 days ago', 'App push'],
              ['Power Vinyasa Wed','Riya Gupta',  '#1', '1 day ago',  'Email'],
              ['Meditation Thu',   'Kiran Mehta', '#1', '4 hrs ago',  'SMS'],
            ].map(([cls, student, pos, joined, method]) => (
              <tr key={`${cls}-${student}`} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{cls}</td>
                <td className="px-3 py-2">{student}</td>
                <td className="px-3 py-2 font-bold text-amber-600">{pos}</td>
                <td className="px-3 py-2 text-gray-500 text-xs">{joined}</td>
                <td className="px-3 py-2 text-gray-600 text-xs">{method}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NoShowsTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="No-shows (Month)" value="37"   color="rose" />
        <KpiCard label="Strike Warnings"  value="8"    sub="3 on final warning" color="amber" />
        <KpiCard label="Suspensions"      value="2"    sub="From repeat no-shows" color="red" />
      </div>
      <div className="border rounded-lg p-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">No-show Log — Aug 2026</h3>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Student', 'Class', 'Date', 'Strikes', 'Action'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">
            {[
              ['Sanjay Mehta', 'Morning Flow', 'Aug 2', 3, 'Suspended'],
              ['Pooja Shah',   'Power Vinyasa','Aug 3', 2, 'Warning #2'],
              ['Rahul Gupta',  'Yin Restore',  'Aug 4', 1, 'Warning #1'],
              ['Ananya Roy',   'Meditation',   'Aug 5', 1, 'Warning #1'],
            ].map(([s, c, d, str, a]) => (
              <tr key={`${s}-${d}`} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{s}</td>
                <td className="px-3 py-2 text-gray-600">{c}</td>
                <td className="px-3 py-2 text-gray-500">{d}</td>
                <td className="px-3 py-2 font-bold">{str}</td>
                <td className="px-3 py-2"><Badge color={String(a).includes('Suspend') ? 'red' : 'amber'}>{a}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RulesTab() {
  return (
    <div className="space-y-4">
      <div className="border rounded-lg p-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-4">Booking Policy Rules</h3>
        <div className="space-y-3">
          {[
            { rule: 'Cancellation window', value: '24 hours', note: 'Full credit if ≥ 24 hrs' },
            { rule: 'Late cancellation', value: '< 24 hours', note: 'Credit only (no cash refund)' },
            { rule: 'No-show policy', value: '3 strikes', note: 'Strike 3 = 2-week booking suspend' },
            { rule: 'Waitlist auto-promote', value: '2 hours before', note: 'Auto-promote + notify' },
            { rule: 'Advance booking limit', value: '14 days', note: 'Members; 7 days for drop-ins' },
            { rule: 'Max concurrent bookings', value: '3 classes/day', note: 'Per student per day' },
          ].map(({ rule, value, note }) => (
            <div key={rule} className="flex justify-between items-start py-2 border-b border-gray-50">
              <div>
                <div className="text-sm font-medium">{rule}</div>
                <div className="text-xs text-gray-500 mt-0.5">{note}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-blue-700">{value}</span>
                <button className="text-xs text-gray-400 hover:text-gray-700">Edit</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReportsTab() {
  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-3 gap-3">
        {[
          { title: 'Booking Volume Report', desc: 'Daily/weekly/monthly bookings with trend' },
          { title: 'Cancellation Analysis', desc: 'Rates, reasons, by class type' },
          { title: 'No-show Report', desc: 'Students, classes, patterns' },
          { title: 'Waitlist Performance', desc: 'Conversion rates, wait times' },
          { title: 'Channel Attribution', desc: 'App vs web vs phone vs desk' },
          { title: 'Revenue Impact', desc: 'Lost revenue from cancellations/no-shows' },
        ].map(r => (
          <div key={r.title} className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer">
            <div className="text-sm font-semibold">{r.title}</div>
            <div className="text-xs text-gray-500 mt-1">{r.desc}</div>
            <button className="mt-3 text-xs text-blue-600 hover:underline">Generate →</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BookingAdminPage() {
  const [tab, setTab] = useState<Tab>('Overview');
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Booking Management</h1>
        <p className="text-sm text-gray-500 mt-1">Monitor bookings, waitlists, no-shows and cancellation rules</p>
      </div>
      <div className="border-b flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{t}</button>
        ))}
      </div>
      {tab === 'Overview'  && <OverviewTab />}
      {tab === 'Today'     && <TodayTab />}
      {tab === 'Upcoming'  && <UpcomingTab />}
      {tab === 'Waitlist'  && <WaitlistTab />}
      {tab === 'No-shows'  && <NoShowsTab />}
      {tab === 'Rules'     && <RulesTab />}
      {tab === 'Reports'   && <ReportsTab />}
    </div>
  );
}
