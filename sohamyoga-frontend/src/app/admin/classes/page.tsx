'use client';
import { useState, useEffect } from 'react';
import QrCheckInScanner from '@/components/auth/QrCheckInScanner';

const TABS = ['Overview', 'Schedule', 'Classes', 'Waitlists', 'Cancellations', 'QR Check-in', 'Integrations'] as const;
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
  const c: Record<string, string> = { blue: 'bg-blue-100 text-blue-700', green: 'bg-green-100 text-green-700', amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700', purple: 'bg-purple-100 text-purple-700' };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c[color] ?? c.blue}`}>{children}</span>;
}

function OverviewTab() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Active Class Types"    value="18"   sub="6 new this quarter" color="blue" />
        <KpiCard label="Classes This Week"     value="84"   sub="Avg 12/day"         color="purple" />
        <KpiCard label="Avg Attendance Rate"   value="78%"  sub="↑ 3% vs last month" color="green" />
        <KpiCard label="Waitlisted Students"   value="124"  sub="Across 8 classes"   color="amber" />
        <KpiCard label="Cancellation Rate"     value="4.2%" sub="↓ 0.8% vs last mo." color="teal" />
        <KpiCard label="QR Check-ins (Today)"  value="186"  sub="Manual: 12"         color="blue" />
        <KpiCard label="Classes Fully Booked"  value="11"   sub="Out of 24 today"    color="purple" />
        <KpiCard label="Avg Rating"            value="4.7"  sub="Based on 312 reviews" color="green" />
      </div>
      <div className="border rounded-lg p-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Attendance Trend (Last 14 Days)</h3>
        <div className="flex items-end gap-1 h-24">
          {[68,74,72,80,77,85,82,88,84,91,87,93,90,95].map((v, i) => (
            <div key={i} className="flex-1 bg-blue-400 rounded-t" style={{ height: `${(v / 100) * 100}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ScheduleTab() {
  const schedule = [
    { time: '06:00', name: 'Early Flow',    teacher: 'Priya S.', type: 'Hatha',   cap: 12, booked: 10, status: 'Available' },
    { time: '07:00', name: 'Morning Yoga',  teacher: 'Anita M.', type: 'Vinyasa', cap: 15, booked: 15, status: 'Full' },
    { time: '09:00', name: 'Yin Restore',   teacher: 'Raj K.',   type: 'Yin',     cap: 12, booked: 8,  status: 'Available' },
    { time: '11:00', name: 'Power Vinyasa', teacher: 'Priya S.', type: 'Power',   cap: 15, booked: 12, status: 'Available' },
    { time: '17:00', name: 'Evening Hatha', teacher: 'Meera T.', type: 'Hatha',   cap: 15, booked: 14, status: 'Almost Full' },
    { time: '19:00', name: 'Meditation',    teacher: 'Arjun N.', type: 'Meditation', cap: 20, booked: 18, status: 'Almost Full' },
  ];
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 flex justify-between items-center">
        <h3 className="text-sm font-semibold text-gray-700">Today's Schedule — Mon 4 Aug 2026</h3>
        <button className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded">+ Add Class</button>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
          <tr>{['Time', 'Class', 'Teacher', 'Type', 'Booked/Cap', 'Status', 'Actions'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {schedule.map(row => (
            <tr key={row.time} className="hover:bg-gray-50">
              <td className="px-3 py-2 font-mono text-xs">{row.time}</td>
              <td className="px-3 py-2 font-medium">{row.name}</td>
              <td className="px-3 py-2 text-gray-600">{row.teacher}</td>
              <td className="px-3 py-2"><Badge color="purple">{row.type}</Badge></td>
              <td className="px-3 py-2">{row.booked}/{row.cap}</td>
              <td className="px-3 py-2">
                <Badge color={row.status === 'Full' ? 'red' : row.status === 'Almost Full' ? 'amber' : 'green'}>{row.status}</Badge>
              </td>
              <td className="px-3 py-2">
                <button className="text-xs text-blue-600 hover:underline mr-2">Edit</button>
                <button className="text-xs text-red-500 hover:underline">Cancel</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClassesTab() {
  const classes = [
    { name: 'Morning Flow Hatha',   level: 'Beginner', duration: '60 min', capacity: 15, rating: 4.8, active: true },
    { name: 'Power Vinyasa',        level: 'Advanced', duration: '75 min', capacity: 15, rating: 4.7, active: true },
    { name: 'Yin Restorative',      level: 'All',      duration: '90 min', capacity: 12, rating: 4.9, active: true },
    { name: 'Evening Meditation',   level: 'All',      duration: '45 min', capacity: 20, rating: 4.6, active: true },
    { name: 'Prenatal Yoga',        level: 'Beginner', duration: '60 min', capacity: 8,  rating: 4.9, active: true },
    { name: 'Kids Yoga (6-12)',     level: 'Kids',     duration: '45 min', capacity: 10, rating: 4.7, active: true },
    { name: 'Advanced Inversions',  level: 'Advanced', duration: '90 min', capacity: 8,  rating: 4.8, active: false },
  ];
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{classes.length} class types</p>
        <button className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded">+ New Class Type</button>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>{['Name', 'Level', 'Duration', 'Capacity', 'Rating', 'Status', 'Actions'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {classes.map(c => (
              <tr key={c.name} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{c.name}</td>
                <td className="px-3 py-2"><Badge color="purple">{c.level}</Badge></td>
                <td className="px-3 py-2 text-gray-600">{c.duration}</td>
                <td className="px-3 py-2">{c.capacity}</td>
                <td className="px-3 py-2 text-amber-600 font-medium">★ {c.rating}</td>
                <td className="px-3 py-2"><Badge color={c.active ? 'green' : 'red'}>{c.active ? 'Active' : 'Inactive'}</Badge></td>
                <td className="px-3 py-2">
                  <button className="text-xs text-blue-600 hover:underline mr-2">Edit</button>
                  <button className="text-xs text-gray-500 hover:underline">{c.active ? 'Deactivate' : 'Activate'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WaitlistsTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Total Waitlisted" value="124" color="amber" />
        <KpiCard label="Avg Wait Time"    value="3.2 days" color="blue" />
        <KpiCard label="Auto-promoted"    value="42"  sub="This month" color="green" />
      </div>
      <div className="border rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-gray-50"><h3 className="text-sm font-semibold">Active Waitlists</h3></div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Class', 'Date/Time', 'Waitlisted', 'Position 1 Student', 'Wait Since'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">
            {[
              ['Morning Flow', 'Mon 07:00', 18, 'Aarav Shah', '2 days ago'],
              ['Power Vinyasa', 'Wed 18:00', 12, 'Diya Patel', '1 day ago'],
              ['Yin Restore', 'Fri 10:00', 9, 'Kavya Nair', '3 days ago'],
            ].map(([c, dt, n, s, w]) => (
              <tr key={String(c)} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{c}</td>
                <td className="px-3 py-2 text-gray-600">{dt}</td>
                <td className="px-3 py-2 font-bold text-amber-600">{n}</td>
                <td className="px-3 py-2">{s}</td>
                <td className="px-3 py-2 text-gray-500 text-xs">{w}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CancellationsTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Cancellations (Month)" value="84"   color="rose" />
        <KpiCard label="Late Cancellations"    value="18"   sub="<24hr notice" color="amber" />
        <KpiCard label="Teacher Cancellations" value="4"    sub="Cover found for 3" color="purple" />
      </div>
      <div className="border rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-gray-50"><h3 className="text-sm font-semibold">Recent Cancellations</h3></div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Class', 'Student', 'Notice', 'Reason', 'Refund'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">
            {[
              ['Morning Flow', 'Aarav Shah',  '36 hrs', 'Illness', 'Full'],
              ['Meditation',   'Diya Patel',  '2 hrs',  'Work conflict', 'Credit'],
              ['Power Vinyasa','Riya Gupta',  '48 hrs', 'Travel', 'Full'],
              ['Yin Restore',  'Kiran Mehta', '1 hr',   'Emergency', 'Credit'],
            ].map(([c, s, n, r, ref]) => (
              <tr key={`${c}-${s}`} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{c}</td>
                <td className="px-3 py-2">{s}</td>
                <td className="px-3 py-2"><Badge color={parseInt(String(n)) < 24 ? 'amber' : 'green'}>{n}</Badge></td>
                <td className="px-3 py-2 text-gray-600">{r}</td>
                <td className="px-3 py-2"><Badge color={ref === 'Full' ? 'green' : 'blue'}>{ref}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface QrSession { id: string; className: string; teacherName: string; startTime: string }
interface QrScanLogRow { scannedBy: string; result: string; scannedAt: string; studentName: string }
interface QrCheckinData {
  sessions: QrSession[];
  stats: { qrCheckins: number; manualCheckins: number; failedScans: number };
  recentScans: QrScanLogRow[];
}

const SCAN_RESULT_COLOR: Record<string, string> = {
  valid: 'green', already_scanned: 'amber', wrong_class: 'red', too_early: 'amber',
  cancelled: 'red', unknown_token: 'red', manual_override: 'purple',
};

// Real QR check-in tab -- was 100% hardcoded mock data (fake "186" check-ins,
// a fake scanner-status list, a fake manual-override log) despite a fully
// real backend (/api/checkin/validate: registration_token/
// registration_token_scan/attendance_record, with loyalty-points
// integration) and a real camera-based QrCheckInScanner component already
// existing -- neither was ever wired into any page (grep-confirmed: zero
// imports of QrCheckInScanner anywhere in src/app before this).
function QRCheckInTab() {
  const [data, setData] = useState<QrCheckinData | null>(null);
  const [selectedSession, setSelectedSession] = useState<string>('');

  const load = () => {
    fetch('/api/admin/classes/qr-checkin', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then((d: QrCheckinData | null) => {
        setData(d);
        if (d?.sessions.length && !selectedSession) setSelectedSession(d.sessions[0].id);
      });
  };
  useEffect(load, []);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="QR Check-ins Today" value={String(data?.stats.qrCheckins ?? '—')} color="teal" />
        <KpiCard label="Manual Check-ins" value={String(data?.stats.manualCheckins ?? '—')} color="blue" />
        <KpiCard label="Failed QR Scans" value={String(data?.stats.failedScans ?? '—')} color="rose" />
      </div>

      <div className="border rounded-lg p-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Scan for a Session</h3>
        {!data ? <p className="text-sm text-gray-400">Loading…</p> : data.sessions.length === 0 ? (
          <p className="text-sm text-gray-400">No class sessions scheduled today -- nothing to scan into.</p>
        ) : (
          <>
            <select value={selectedSession} onChange={e => setSelectedSession(e.target.value)} className="border rounded-lg px-3 py-2 text-sm mb-3 w-full max-w-sm">
              {data.sessions.map(s => <option key={s.id} value={s.id}>{s.startTime} — {s.className} ({s.teacherName})</option>)}
            </select>
            {selectedSession && <QrCheckInScanner classId={selectedSession} />}
          </>
        )}
      </div>

      <div className="border rounded-lg p-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Recent Scans (real registration_token_scan log)</h3>
        {!data?.recentScans.length ? (
          <p className="text-sm text-gray-400">No scans recorded yet.</p>
        ) : data.recentScans.map((r, i) => (
          <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-gray-50">
            <span><span className="font-medium">{r.studentName}</span><span className="text-gray-500"> — scanned by {r.scannedBy}</span></span>
            <span className="flex items-center gap-2">
              <Badge color={SCAN_RESULT_COLOR[r.result] ?? 'blue'}>{r.result.replace(/_/g, ' ')}</Badge>
              <span className="text-gray-400">{new Date(r.scannedAt).toLocaleTimeString()}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function IntegrationsTab() {
  return (
    <div className="space-y-4">
      <div className="border rounded-lg p-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Connected Services</h3>
        {[
          ['Cal.com', 'Scheduling & calendar sync', 'Connected', 'green'],
          ['Zoom', 'Virtual class streaming', 'Connected', 'green'],
          ['Google Calendar', 'Teacher schedule sync', 'Connected', 'green'],
          ['Mattermost', 'Class notifications', 'Connected', 'green'],
          ['MediaCMS', 'Class video library', 'Partial', 'amber'],
          ['Novu (notifications)', 'Booking confirmations', 'Connected', 'green'],
        ].map(([svc, desc, status, color]) => (
          <div key={String(svc)} className="flex items-center justify-between py-2 border-b border-gray-50 text-sm">
            <div><span className="font-medium">{svc}</span><span className="text-gray-500 ml-2 text-xs">{desc}</span></div>
            <Badge color={color}>{status}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ClassesAdminPage() {
  const [tab, setTab] = useState<Tab>('Overview');
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Classes Management</h1>
        <p className="text-sm text-gray-500 mt-1">Manage class types, schedule, waitlists and check-in</p>
      </div>
      <div className="border-b flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{t}</button>
        ))}
      </div>
      {tab === 'Overview'       && <OverviewTab />}
      {tab === 'Schedule'       && <ScheduleTab />}
      {tab === 'Classes'        && <ClassesTab />}
      {tab === 'Waitlists'      && <WaitlistsTab />}
      {tab === 'Cancellations'  && <CancellationsTab />}
      {tab === 'QR Check-in'    && <QRCheckInTab />}
      {tab === 'Integrations'   && <IntegrationsTab />}
    </div>
  );
}
