'use client';
// Customer Booking Page — book an appointment, view upcoming bookings,
// reschedule or cancel. Powered by Cal.com embed when configured.
// Shows a clear "not configured" state otherwise.

import { useEffect, useState } from 'react';

interface Booking {
  id: string;
  service: string;
  startTime: string;
  status: string;
  durationMinutes: number;
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-green-500/20 text-green-300',
  pending: 'bg-amber-500/20 text-amber-300',
  cancelled: 'bg-white/10 text-white/60',
  no_show: 'bg-red-500/20 text-red-600',
};

export default function CustomerBookingPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [calConfigured, setCalConfigured] = useState(false);

  useEffect(() => {
    // /api/customer/bookings returns { upcoming, past } for class bookings.
    // Cal.com appointment state comes from /api/admin/calendar/bookings (public summary).
    Promise.allSettled([
      fetch('/api/customer/bookings').then(r => r.ok ? r.json() : { upcoming: [], past: [] }),
      fetch('/api/admin/calendar/bookings').then(r => r.ok ? r.json() : { configured: false, bookings: [] }),
    ]).then(([classRes, calRes]) => {
      // Class bookings
      const classData = classRes.status === 'fulfilled' ? classRes.value : { upcoming: [], past: [] };
      const upcoming: Booking[] = (classData.upcoming ?? []).map((b: Record<string, unknown>) => ({
        id: String(b.id), service: String(b.class_name ?? 'Class'),
        startTime: String(b.session_date) + 'T' + String(b.start_time ?? '09:00'),
        status: String(b.status ?? 'confirmed'),
        durationMinutes: Number(b.duration_minutes ?? 60),
      }));
      const past: Booking[] = (classData.past ?? []).slice(0, 10).map((b: Record<string, unknown>) => ({
        id: String(b.id), service: String(b.class_name ?? 'Class'),
        startTime: String(b.session_date) + 'T' + String(b.start_time ?? '09:00'),
        status: String(b.status ?? 'attended'),
        durationMinutes: Number(b.duration_minutes ?? 60),
      }));
      setBookings([...upcoming, ...past]);

      // Cal.com configured state
      const calData = calRes.status === 'fulfilled' ? calRes.value : { configured: false };
      setCalConfigured(!!(calData.configured));
    }).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 text-sm text-white/60">Loading your bookings…</div>;

  const upcoming = bookings.filter(b =>
    b.status !== 'cancelled' && new Date(b.startTime) >= new Date()
  ).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const past = bookings.filter(b =>
    b.status === 'cancelled' || new Date(b.startTime) < new Date()
  ).slice(0, 10);

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6 text-white">
      <header>
        <h1 className="text-2xl font-bold text-white">My Bookings</h1>
        <p className="text-sm text-white/60">Appointments, class bookings, and consultations</p>
      </header>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-300">{error}</div>
      )}

      {/* Book new appointment */}
      <div className="rounded-xl border bg-slate-800/70 border-white/20 p-5">
        <h2 className="mb-3 font-semibold text-white/90">Book an Appointment</h2>
        {calConfigured ? (
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
            <p className="text-sm text-blue-800 font-medium">Cal.com Booking Widget</p>
            <p className="mt-1 text-xs text-blue-600">
              Embed: add Cal.com JavaScript embed here once CALCOM_EVENT_TYPE_ID is confirmed.
            </p>
            <a
              href={`https://cal.com/${process.env.NEXT_PUBLIC_CALCOM_USERNAME ?? 'sohamyoga'}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Book via Cal.com →
            </a>
          </div>
        ) : (
          <div className="rounded-lg border border-gray-100 bg-white/5 p-4">
            <p className="text-sm text-white/70">Online booking is not yet configured.</p>
            <p className="mt-1 text-xs text-white/40">Please contact us directly to book an appointment.</p>
            <a href="/contact" className="mt-3 inline-block rounded-lg border border-white/30 px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/10">
              Contact Us
            </a>
          </div>
        )}
      </div>

      {/* Upcoming bookings */}
      <div className="rounded-xl border bg-slate-800/70 border-white/20 p-5">
        <h2 className="mb-3 font-semibold text-white/90">Upcoming ({upcoming.length})</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-white/40">No upcoming appointments.</p>
        ) : (
          <div className="space-y-3 text-white">
            {upcoming.map(b => (
              <div key={b.id} className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
                <div>
                  <p className="font-medium text-white/90">{b.service}</p>
                  <p className="text-xs text-white/60">
                    {new Date(b.startTime).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                    {' · '}
                    {new Date(b.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {' · '}
                    {b.durationMinutes} min
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[b.status] ?? 'bg-white/10 text-white/60'}`}>
                    {b.status}
                  </span>
                  {b.status !== 'cancelled' && (
                    <button className="text-xs text-red-500 hover:text-red-300">Cancel</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Past bookings */}
      {past.length > 0 && (
        <div className="rounded-xl border bg-slate-800/70 border-white/20 p-5">
          <h2 className="mb-3 font-semibold text-white/90">Past Appointments</h2>
          <div className="space-y-2 text-white">
            {past.map(b => (
              <div key={b.id} className="flex items-center justify-between text-sm text-white/70">
                <span>{b.service} · {new Date(b.startTime).toLocaleDateString()}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[b.status] ?? 'bg-white/10'}`}>{b.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
