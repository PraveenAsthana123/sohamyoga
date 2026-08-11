'use client';
import { useState } from 'react';

const TABS = ['Overview', 'Students', 'Teachers', 'QR Scan', 'Late Check-in', 'Monthly', 'Reports'] as const;
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
  const c: Record<string, string> = { blue: 'bg-blue-100 text-blue-700', green: 'bg-green-100 text-green-700', amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700', gray: 'bg-gray-100 text-gray-600' };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c[color] ?? c.blue}`}>{children}</span>;
}

function OverviewTab() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Attendance Rate (Month)" value="78%"   sub="↑ 3% vs Jul"       color="green" />
        <KpiCard label="Students Present Today"  value="186"   sub="Of 240 booked"      color="blue" />
        <KpiCard label="No-shows Today"          value="12"    sub="5% of bookings"     color="rose" />
        <KpiCard label="Late Check-ins Today"    value="8"     sub="> 10 min late"      color="amber" />
        <KpiCard label="Teacher Attendance"      value="22/22" sub="All present"        color="green" />
        <KpiCard label="Avg Classes/Student"     value="4.2"   sub="Per month"          color="purple" />
        <KpiCard label="Streak ≥ 7 Days"         value="84"    sub="Active streak holders" color="teal" />
        <KpiCard label="At-risk Students"        value="31"    sub="No class > 14 days" color="amber" />
      </div>
      <div className="border rounded-lg p-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Attendance by Day — Last 14 Days</h3>
        <div className="flex items-end gap-1 h-24">
          {[74,80,78,86,83,90,87,93,89,96,92,98,95,101].map((v, i) => (
            <div key={i} className="flex-1 bg-teal-400 rounded-t" style={{ height: `${(v / 110) * 100}%` }} />
          ))}
        </div>
        <div className="text-xs text-gray-400 mt-1">Total check-ins per day</div>
      </div>
    </div>
  );
}

function StudentsTab() {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 flex justify-between">
        <h3 className="text-sm font-semibold">Student Attendance — Aug 2026</h3>
        <button className="text-xs text-blue-600 hover:underline">Export</button>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Student', 'Classes Attended', 'Booked', 'Rate', 'Last Seen', 'Streak', 'Status'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-gray-100">
          {[
            ['Aarav Shah',   18, 20, '90%', 'Today',   '12 days', 'Active'],
            ['Diya Patel',   14, 16, '87%', 'Today',   '7 days',  'Active'],
            ['Riya Gupta',   12, 15, '80%', 'Aug 3',   '3 days',  'Active'],
            ['Kiran Mehta',  8,  14, '57%', 'Jul 28',  '0 days',  'At Risk'],
            ['Sanjay Mehta', 3,  10, '30%', 'Jul 15',  '0 days',  'At Risk'],
          ].map(([s, att, booked, rate, last, streak, status]) => (
            <tr key={String(s)} className="hover:bg-gray-50">
              <td className="px-3 py-2 font-medium">{s}</td>
              <td className="px-3 py-2">{att}</td>
              <td className="px-3 py-2 text-gray-600">{booked}</td>
              <td className="px-3 py-2 font-medium">{rate}</td>
              <td className="px-3 py-2 text-gray-500 text-xs">{last}</td>
              <td className="px-3 py-2">{streak}</td>
              <td className="px-3 py-2"><Badge color={status === 'Active' ? 'green' : 'amber'}>{status}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TeachersTab() {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-50"><h3 className="text-sm font-semibold">Teacher Attendance — Aug 2026</h3></div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Teacher', 'Classes Taught', 'Scheduled', 'Attendance Rate', 'Cancellations', 'Avg Rating', 'Status'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-gray-100">
          {[
            ['Priya Sharma', 42, 44, '95%', 2, '4.8', 'Active'],
            ['Anita Mehta',  36, 36, '100%',0, '4.7', 'Active'],
            ['Raj Kumar',    38, 40, '95%', 2, '4.7', 'Active'],
            ['Meera Tiwari', 30, 32, '94%', 2, '4.6', 'Active'],
            ['Arjun Nair',   28, 28, '100%',0, '4.9', 'Active'],
          ].map(([t, taught, sched, rate, canc, rating, status]) => (
            <tr key={String(t)} className="hover:bg-gray-50">
              <td className="px-3 py-2 font-medium">{t}</td>
              <td className="px-3 py-2">{taught}</td>
              <td className="px-3 py-2 text-gray-600">{sched}</td>
              <td className="px-3 py-2 font-medium text-green-700">{rate}</td>
              <td className="px-3 py-2">{canc}</td>
              <td className="px-3 py-2 text-amber-600">★ {rating}</td>
              <td className="px-3 py-2"><Badge color="green">{status}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QRScanTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="QR Scans Today"   value="186" color="teal" />
        <KpiCard label="Failed Scans"     value="3"   sub="Invalid/expired QR" color="rose" />
        <KpiCard label="Manual Overrides" value="8"   color="amber" />
      </div>
      <div className="border rounded-lg p-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Recent QR Scan Activity</h3>
        <div className="space-y-2">
          {[
            { student: 'Aarav Shah',  class: 'Morning Flow', time: '06:58', status: 'success' },
            { student: 'Diya Patel',  class: 'Morning Flow', time: '07:02', status: 'success' },
            { student: 'Unknown QR',  class: '—',            time: '07:04', status: 'failed' },
            { student: 'Riya Gupta',  class: 'Yin Restore',  time: '08:57', status: 'success' },
            { student: 'Kiran Mehta', class: 'Yin Restore',  time: '09:14', status: 'late' },
          ].map((s, i) => (
            <div key={i} className="flex justify-between text-sm py-1.5 border-b border-gray-50">
              <span className="font-medium">{s.student}</span>
              <span className="text-gray-600">{s.class}</span>
              <span className="font-mono text-xs text-gray-500">{s.time}</span>
              <Badge color={s.status === 'success' ? 'green' : s.status === 'late' ? 'amber' : 'red'}>{s.status}</Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LateCheckInTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Late Today"    value="8"   sub="> 10 min"       color="amber" />
        <KpiCard label="Avg Lateness"  value="14min"                    color="blue" />
        <KpiCard label="Repeat Lates"  value="4"   sub="≥3 times/month" color="rose" />
      </div>
      <div className="border rounded-lg p-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Late Arrivals — Today</h3>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Student', 'Class', 'Booked', 'Arrived', 'Minutes Late', 'Allowed In'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">
            {[
              ['Kiran Mehta', 'Yin Restore',   '09:00', '09:14', '14', true],
              ['Rahul Gupta', 'Power Vinyasa', '11:00', '11:22', '22', false],
              ['Ananya Roy',  'Meditation',    '07:00', '07:08', '8',  true],
            ].map(([s, c, b, a, m, allowed]) => (
              <tr key={`${s}-${c}`} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{s}</td>
                <td className="px-3 py-2 text-gray-600">{c}</td>
                <td className="px-3 py-2 font-mono text-xs">{b}</td>
                <td className="px-3 py-2 font-mono text-xs">{a}</td>
                <td className="px-3 py-2 font-bold text-amber-600">{m}m</td>
                <td className="px-3 py-2"><Badge color={allowed ? 'green' : 'red'}>{allowed ? 'Yes' : 'Turned Away'}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 text-xs text-gray-500">Late admission policy: ≤ 15 minutes = allowed; &gt; 15 minutes = turned away (Yin/Meditation classes)</div>
      </div>
    </div>
  );
}

function MonthlyTab() {
  return (
    <div className="space-y-4">
      <div className="border rounded-lg p-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Monthly Attendance Heatmap — Aug 2026</h3>
        <div className="grid grid-cols-7 gap-1 text-xs text-center">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div key={d} className="text-gray-400 py-1">{d}</div>)}
          {[null, null, null, null, null, 78, 71, 83, 91, 88, 96, 93, 101, 98, 104, 112, 108, 116, 113, 119, 116, 121, 118, 125, 122, 128, 125, null, null, null, null].map((v, i) => (
            <div key={i} className={`py-2 rounded text-xs font-medium ${!v ? '' : v < 85 ? 'bg-green-100 text-green-800' : v < 100 ? 'bg-green-200 text-green-800' : v < 115 ? 'bg-green-400 text-white' : 'bg-green-700 text-white'}`}>
              {v ?? ''}
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-3 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-100 rounded" /> Low</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-300 rounded" /> Med</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500 rounded" /> High</span>
        </div>
      </div>
    </div>
  );
}

function ReportsTab() {
  return (
    <div className="grid md:grid-cols-3 gap-3">
      {[
        { title: 'Student Attendance Report',  desc: 'Per-student, per-period breakdown' },
        { title: 'Class Occupancy Report',     desc: 'Fill rate by class type and time' },
        { title: 'Teacher Attendance Log',     desc: 'Teacher punctuality and coverage' },
        { title: 'No-show Analysis',           desc: 'Patterns, by student and class' },
        { title: 'Late Arrival Report',        desc: 'Lateness trends, policy impact' },
        { title: 'Streak & Engagement',        desc: 'Streak distribution, at-risk alerts' },
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

export default function AttendanceAdminPage() {
  const [tab, setTab] = useState<Tab>('Overview');
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Attendance Management</h1>
        <p className="text-sm text-gray-500 mt-1">Student and teacher attendance, QR check-in, late arrivals</p>
      </div>
      <div className="border-b flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{t}</button>
        ))}
      </div>
      {tab === 'Overview'      && <OverviewTab />}
      {tab === 'Students'      && <StudentsTab />}
      {tab === 'Teachers'      && <TeachersTab />}
      {tab === 'QR Scan'       && <QRScanTab />}
      {tab === 'Late Check-in' && <LateCheckInTab />}
      {tab === 'Monthly'       && <MonthlyTab />}
      {tab === 'Reports'       && <ReportsTab />}
    </div>
  );
}
