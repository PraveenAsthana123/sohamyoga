'use client';

import { useCallback, useEffect, useState } from 'react';
import QrCheckInScanner from '@/components/auth/QrCheckInScanner';

const TABS = ['Overview', 'Schedule', 'Classes', 'Waitlists', 'Cancellations', 'QR Check-in', 'Integrations'] as const;
type Tab = typeof TABS[number];

interface ClassSession {
  id: string; class_name: string; teacher_name: string; session_date: string;
  start_time: string; duration_minutes: number; location: string | null;
  capacity: number; status: string; level: string | null; style: string | null;
  price: number; enrolled_count: number; cancelled_count: number; checked_in_count: number;
}

interface WaitlistEntry {
  id: string; student_id: string; student_name: string | null;
  class_name: string; session_date: string; created_at: string;
}

interface Summary {
  totalSessions: number; upcomingSessions: number; totalBookings: number;
  confirmedBookings: number; cancelledBookings: number; checkedIn: number;
  bookingsThisWeek: number; waitlisted: number;
}

interface ApiData {
  sessions: ClassSession[];
  waitlist: WaitlistEntry[];
  summary: Summary;
}

function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const c: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700', green: 'bg-green-50 border-green-200 text-green-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700', purple: 'bg-purple-50 border-purple-200 text-purple-700',
    rose: 'bg-rose-50 border-rose-200 text-rose-700', teal: 'bg-teal-50 border-teal-200 text-teal-700',
  };
  return (
    <div className={`border rounded-lg p-4 ${c[color] ?? c.blue}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm font-medium mt-1">{label}</div>
      {sub && <div className="text-xs opacity-60 mt-0.5">{sub}</div>}
    </div>
  );
}

function Badge({ children, color = 'blue' }: { children: React.ReactNode; color?: string }) {
  const c: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-700', green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700',
    purple: 'bg-purple-100 text-purple-700', gray: 'bg-gray-100 text-gray-600',
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c[color] ?? c.blue}`}>{children}</span>;
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

function QRCheckInTab() {
  const [data, setData] = useState<QrCheckinData | null>(null);
  const [selectedSession, setSelectedSession] = useState<string>('');

  const load = useCallback(() => {
    fetch('/api/admin/classes/qr-checkin', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then((d: QrCheckinData | null) => {
        setData(d);
        if (d?.sessions.length && !selectedSession) setSelectedSession(d.sessions[0].id);
      });
  }, [selectedSession]);

  useEffect(() => { load(); }, [load]);

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
          <p className="text-sm text-gray-400">No class sessions scheduled today.</p>
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
        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Recent Scans</h3>
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

export default function ClassesAdminPage() {
  const [tab, setTab] = useState<Tab>('Overview');
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/classes', { cache: 'no-store' })
      .then(r => r.json())
      .then((d: ApiData) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const s = data?.summary;
  const today = new Date().toISOString().split('T')[0];
  const todaySessions = (data?.sessions ?? []).filter(sess => sess.session_date === today);
  const upcomingSessions = (data?.sessions ?? []).filter(sess => sess.session_date > today && sess.status === 'scheduled');
  const cancelledSessions = (data?.sessions ?? []).filter(sess => sess.status === 'cancelled');

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Classes Management</h1>
        <p className="text-sm text-gray-500 mt-1">Manage class types, schedule, waitlists and check-in</p>
      </div>

      <div className="border-b flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab !== 'QR Check-in' && tab !== 'Integrations' && loading && (
        <div className="text-center py-16 text-gray-400 text-sm">Loading class data…</div>
      )}

      {(tab !== 'QR Check-in' && tab !== 'Integrations' && !loading) && (
        <>
          {tab === 'Overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Total Sessions" value={s?.totalSessions ?? 0} color="blue" />
                <KpiCard label="Upcoming Sessions" value={s?.upcomingSessions ?? 0} color="purple" />
                <KpiCard label="Confirmed Bookings" value={s?.confirmedBookings ?? 0} color="green" />
                <KpiCard label="Waitlisted" value={s?.waitlisted ?? 0} color="amber" />
                <KpiCard label="Checked In" value={s?.checkedIn ?? 0} color="teal" />
                <KpiCard label="Cancelled Bookings" value={s?.cancelledBookings ?? 0} color="rose" />
                <KpiCard label="This Week's Bookings" value={s?.bookingsThisWeek ?? 0} color="blue" />
                <KpiCard label="Today's Sessions" value={todaySessions.length} color="purple" />
              </div>

              {todaySessions.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50">
                    <h3 className="text-sm font-semibold text-gray-700">Today's Sessions ({todaySessions.length})</h3>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                      <tr>{['Time', 'Class', 'Teacher', 'Style', 'Enrolled/Cap', 'Status'].map(h =>
                        <th key={h} className="px-3 py-2 text-left">{h}</th>
                      )}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {todaySessions.map(sess => (
                        <tr key={sess.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-mono text-xs">{sess.start_time}</td>
                          <td className="px-3 py-2 font-medium">{sess.class_name}</td>
                          <td className="px-3 py-2 text-gray-600">{sess.teacher_name}</td>
                          <td className="px-3 py-2">{sess.style && <Badge color="purple">{sess.style}</Badge>}</td>
                          <td className="px-3 py-2">{sess.enrolled_count}/{sess.capacity}</td>
                          <td className="px-3 py-2">
                            <Badge color={sess.status === 'completed' ? 'green' : sess.status === 'cancelled' ? 'red' : 'blue'}>
                              {sess.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === 'Schedule' && (
            <div className="border rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 flex justify-between items-center">
                <h3 className="text-sm font-semibold text-gray-700">Upcoming Sessions ({upcomingSessions.length})</h3>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>{['Date', 'Time', 'Class', 'Teacher', 'Level', 'Enrolled/Cap', 'Status'].map(h =>
                    <th key={h} className="px-3 py-2 text-left">{h}</th>
                  )}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {upcomingSessions.slice(0, 50).map(sess => (
                    <tr key={sess.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-xs text-gray-600">{sess.session_date}</td>
                      <td className="px-3 py-2 font-mono text-xs">{sess.start_time}</td>
                      <td className="px-3 py-2 font-medium">{sess.class_name}</td>
                      <td className="px-3 py-2 text-gray-600">{sess.teacher_name}</td>
                      <td className="px-3 py-2">{sess.level && <Badge>{sess.level}</Badge>}</td>
                      <td className="px-3 py-2">
                        <span className={sess.enrolled_count >= sess.capacity ? 'text-red-600 font-semibold' : ''}>
                          {sess.enrolled_count}/{sess.capacity}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <Badge color={sess.status === 'scheduled' ? 'blue' : 'green'}>{sess.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {upcomingSessions.length === 0 && (
                <div className="text-center py-12 text-gray-400 text-sm">No upcoming sessions scheduled.</div>
              )}
            </div>
          )}

          {tab === 'Classes' && (
            <div className="border rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-700">All Sessions ({data?.sessions.length ?? 0})</h3>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>{['Class', 'Teacher', 'Date', 'Duration', 'Capacity', 'Enrolled', 'Status'].map(h =>
                    <th key={h} className="px-3 py-2 text-left">{h}</th>
                  )}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(data?.sessions ?? []).slice(0, 50).map(sess => (
                    <tr key={sess.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium">{sess.class_name}</td>
                      <td className="px-3 py-2 text-gray-600">{sess.teacher_name}</td>
                      <td className="px-3 py-2 text-xs text-gray-500">{sess.session_date}</td>
                      <td className="px-3 py-2 text-gray-500">{sess.duration_minutes}min</td>
                      <td className="px-3 py-2">{sess.capacity}</td>
                      <td className="px-3 py-2">{sess.enrolled_count}</td>
                      <td className="px-3 py-2">
                        <Badge color={sess.status === 'completed' ? 'green' : sess.status === 'cancelled' ? 'red' : 'blue'}>
                          {sess.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'Waitlists' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <KpiCard label="Total Waitlisted" value={s?.waitlisted ?? 0} color="amber" />
                <KpiCard label="Total Sessions" value={s?.totalSessions ?? 0} color="blue" />
                <KpiCard label="Upcoming Sessions" value={s?.upcomingSessions ?? 0} color="green" />
              </div>
              <div className="border rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-gray-50">
                  <h3 className="text-sm font-semibold">Active Waitlist Entries ({data?.waitlist.length ?? 0})</h3>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>{['Student', 'Class', 'Session Date', 'Wait Since'].map(h =>
                      <th key={h} className="px-3 py-2 text-left">{h}</th>
                    )}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(data?.waitlist ?? []).map(entry => (
                      <tr key={entry.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium">{entry.student_name ?? 'Unknown'}</td>
                        <td className="px-3 py-2">{entry.class_name}</td>
                        <td className="px-3 py-2 text-gray-500 text-xs">{entry.session_date}</td>
                        <td className="px-3 py-2 text-gray-400 text-xs">
                          {new Date(entry.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(data?.waitlist ?? []).length === 0 && (
                  <div className="text-center py-12 text-gray-400 text-sm">No waitlist entries.</div>
                )}
              </div>
            </div>
          )}

          {tab === 'Cancellations' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <KpiCard label="Cancelled Sessions" value={cancelledSessions.length} color="rose" />
                <KpiCard label="Cancelled Bookings" value={s?.cancelledBookings ?? 0} color="amber" />
                <KpiCard label="Total Sessions" value={s?.totalSessions ?? 0} color="blue" />
              </div>
              <div className="border rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-gray-50">
                  <h3 className="text-sm font-semibold">Cancelled Sessions ({cancelledSessions.length})</h3>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>{['Class', 'Teacher', 'Date', 'Enrolled at Cancellation'].map(h =>
                      <th key={h} className="px-3 py-2 text-left">{h}</th>
                    )}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {cancelledSessions.map(sess => (
                      <tr key={sess.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium">{sess.class_name}</td>
                        <td className="px-3 py-2 text-gray-600">{sess.teacher_name}</td>
                        <td className="px-3 py-2 text-xs text-gray-500">{sess.session_date}</td>
                        <td className="px-3 py-2 text-gray-500">{sess.enrolled_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {cancelledSessions.length === 0 && (
                  <div className="text-center py-12 text-gray-400 text-sm">No cancelled sessions.</div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'QR Check-in' && <QRCheckInTab />}

      {tab === 'Integrations' && (
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
      )}
    </div>
  );
}
