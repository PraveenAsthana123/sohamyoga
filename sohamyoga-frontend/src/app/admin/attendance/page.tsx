'use client';
// Real attendance overview -- previously this entire page (all 7 tabs) was
// 100% hardcoded mock data with zero API calls anywhere (found live during
// a 2026-09-01 end-to-end demo, which also uncovered the deeper root
// cause: attendance_record was structurally unreachable until that same
// session fixed enrollment_id's NOT NULL constraint and wired the real
// check-in route to actually write to it). Overview and Students are now
// real, from real attendance_record/booking/streak data.
//
// QR Scan corrected 2026-09-08: a real QR check-in system (registration_
// token/registration_token_scan, /api/checkin/validate, QrCheckInScanner.tsx)
// already existed but was never wired into any page -- it's now live at
// /admin/classes' QR Check-in tab, so this tab links there instead of
// claiming "no QR code system" (which was true when first written, not
// anymore).
//
// Late Check-in built 2026-09-08: attendance_record.attended_at and
// class_session.session_date/start_time were already real -- only a
// configurable threshold (new attendance_policy table) and the actual
// minutes-late arithmetic were missing. Teacher ratings genuinely still
// have no backing schema anywhere in this app -- honestly labeled "not
// yet available" rather than left as convincing fake numbers.

import { useEffect, useState } from 'react';

const TABS = ['Overview', 'Students', 'Teachers', 'QR Scan', 'Late Check-in', 'Monthly', 'Reports'] as const;
type Tab = typeof TABS[number];

interface StudentRow { display_name: string; classes_attended: number; classes_booked: number; last_seen: string | null; current_streak: number }
interface LateArrival { studentName: string; className: string; sessionDate: string; minutesLate: number }
interface OverviewData {
  kpis: { attendanceRateMonth: number; studentsPresentToday: number; noShowsToday: number; totalBookedToday: number; streakHolders7Plus: number };
  students: StudentRow[];
  latePolicy: { thresholdMinutes: number };
  lateArrivals: LateArrival[];
}

function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string; sub?: string; color?: string }) {
  const c: Record<string, string> = { blue: 'bg-blue-50 border-blue-200 text-blue-700', green: 'bg-green-50 border-green-200 text-green-700', amber: 'bg-amber-50 border-amber-200 text-amber-700', rose: 'bg-rose-50 border-rose-200 text-rose-700' };
  return (
    <div className={`border rounded-lg p-4 ${c[color] ?? c.blue}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm font-medium mt-1">{label}</div>
      {sub && <div className="text-xs opacity-60 mt-0.5">{sub}</div>}
    </div>
  );
}

function NotYetAvailable({ reason }: { reason: string }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
      <p className="text-sm font-medium text-gray-500">Not yet available</p>
      <p className="mt-1 text-xs text-gray-400">{reason}</p>
    </div>
  );
}

function OverviewTab({ data }: { data: OverviewData | null }) {
  if (!data) return <p className="text-sm text-gray-400">Loading…</p>;
  const k = data.kpis;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Attendance Rate (Month)" value={`${k.attendanceRateMonth}%`} color="green" />
        <KpiCard label="Students Present Today" value={String(k.studentsPresentToday)} sub={`Of ${k.totalBookedToday} booked`} color="blue" />
        <KpiCard label="No-shows (Past)" value={String(k.noShowsToday)} sub="Confirmed but never checked in" color="rose" />
        <KpiCard label="Streak ≥ 7 Days" value={String(k.streakHolders7Plus)} sub="Active streak holders" color="amber" />
      </div>
    </div>
  );
}

function StudentsTab({ data }: { data: OverviewData | null }) {
  if (!data) return <p className="text-sm text-gray-400">Loading…</p>;
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-50"><h3 className="text-sm font-semibold">Real Student Attendance</h3></div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Student', 'Classes Attended', 'Booked', 'Rate', 'Last Seen', 'Streak'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-gray-100">
          {data.students.map(s => (
            <tr key={s.display_name} className="hover:bg-gray-50">
              <td className="px-3 py-2 font-medium">{s.display_name}</td>
              <td className="px-3 py-2">{s.classes_attended}</td>
              <td className="px-3 py-2 text-gray-600">{s.classes_booked}</td>
              <td className="px-3 py-2 font-medium">{s.classes_booked > 0 ? Math.round((s.classes_attended / s.classes_booked) * 100) : 0}%</td>
              <td className="px-3 py-2 text-gray-500 text-xs">{s.last_seen ? new Date(s.last_seen).toLocaleDateString() : 'Never'}</td>
              <td className="px-3 py-2">{s.current_streak}d</td>
            </tr>
          ))}
          {!data.students.length && <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-400">No students with bookings yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function LateCheckinTab({ data, onPolicyChanged }: { data: OverviewData | null; onPolicyChanged: () => void }) {
  const [threshold, setThreshold] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (data) setThreshold(String(data.latePolicy.thresholdMinutes)); }, [data?.latePolicy.thresholdMinutes]);

  async function savePolicy() {
    setSaving(true);
    await fetch('/api/admin/attendance-overview', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ thresholdMinutes: Number(threshold) }),
    });
    setSaving(false);
    onPolicyChanged();
  }

  if (!data) return <p className="text-sm text-gray-400">Loading…</p>;
  return (
    <div className="space-y-4">
      <div className="border rounded-lg p-4 flex items-center gap-3">
        <label className="text-sm font-medium">Late threshold:</label>
        <input type="number" min={0} max={120} value={threshold} onChange={e => setThreshold(e.target.value)}
          className="w-20 border rounded px-2 py-1 text-sm" />
        <span className="text-sm text-gray-500">minutes after class start</span>
        <button onClick={savePolicy} disabled={saving} className="ml-auto px-3 py-1.5 bg-blue-600 text-white rounded text-sm disabled:opacity-50">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-gray-50"><h3 className="text-sm font-semibold">Real Late Arrivals (real attended_at vs. real class start_time)</h3></div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Student', 'Class', 'Date', 'Minutes Late'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">
            {data.lateArrivals.map((r, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{r.studentName}</td>
                <td className="px-3 py-2">{r.className}</td>
                <td className="px-3 py-2 text-gray-500 text-xs">{new Date(r.sessionDate).toLocaleDateString()}</td>
                <td className="px-3 py-2 font-medium text-rose-600">{r.minutesLate} min</td>
              </tr>
            ))}
            {!data.lateArrivals.length && <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-400">No late arrivals past the {data.latePolicy.thresholdMinutes}-minute threshold.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AttendanceAdminPage() {
  const [tab, setTab] = useState<Tab>('Overview');
  const [data, setData] = useState<OverviewData | null>(null);

  const loadData = () => fetch('/api/admin/attendance-overview', { cache: 'no-store' }).then(r => r.json()).then(setData);
  useEffect(() => { loadData(); }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Attendance Management</h1>
        <p className="text-sm text-gray-500 mt-1">Real student attendance from attendance_record/booking, real QR check-in (via /admin/classes), and a real late-arrival policy. Teacher ratings still need schema this app doesn't have yet.</p>
      </div>
      <div className="border-b flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{t}</button>
        ))}
      </div>
      {tab === 'Overview' && <OverviewTab data={data} />}
      {tab === 'Students' && <StudentsTab data={data} />}
      {tab === 'Teachers' && <NotYetAvailable reason="No teacher rating/coverage schema exists in this app yet." />}
      {tab === 'QR Scan' && (
        <div className="rounded-lg border border-dashed border-blue-300 bg-blue-50 p-8 text-center">
          <p className="text-sm font-medium text-blue-700">Real QR check-in is live -- just not on this page</p>
          <p className="mt-1 text-xs text-blue-600">
            Scan students in per class session at <a href="/admin/classes" className="underline font-medium">/admin/classes</a> (QR Check-in tab) --
            it writes to this same real attendance_record data.
          </p>
        </div>
      )}
      {tab === 'Late Check-in' && <LateCheckinTab data={data} onPolicyChanged={loadData} />}
      {tab === 'Monthly' && <NotYetAvailable reason="A real monthly heatmap is buildable from attendance_record.attended_at but hasn't been wired up yet." />}
      {tab === 'Reports' && <NotYetAvailable reason="Report generation for this domain hasn't been built yet." />}
    </div>
  );
}
