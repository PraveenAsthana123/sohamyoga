'use client';
// /customer/bookings — real upcoming/past bookings. Replaces /student/calendar
// and /student/history, both hardcoded arrays with no backing table.

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Booking {
  id: string; status: string; class_name: string; teacher_name: string; session_date: string; start_time: string; duration_minutes: number; location: string | null; checked_in_at: string | null;
  my_rating: number | null;
}

export default function BookingsPage() {
  const [data, setData] = useState<{ upcoming: Booking[]; past: Booking[]; hasStudentRecord: boolean } | null>(null);

  const loadData = () => fetch('/api/customer/bookings', { cache: 'no-store' }).then(r => r.json()).then(setData);
  useEffect(() => { loadData(); }, []);

  if (!data) return <p className="text-sm text-white/40">Loading…</p>;
  if (!data.hasStudentRecord) {
    return <p className="text-sm text-white/60">Booking history is available once you're enrolled in a class. <Link href="/booking" className="text-blue-600 underline">Browse classes</Link>.</p>;
  }

  return (
    <div className="max-w-2xl space-y-6 text-white">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">My Bookings</h1>
          <p className="mt-1 text-sm text-white/60">Your real upcoming and past classes.</p>
        </div>
        <div className="flex gap-2">
          {data.upcoming.length > 0 && (
            <a href="/api/customer/bookings/ical" className="rounded border border-white/30 px-3 py-1.5 text-sm font-medium text-white/80 hover:bg-white/5">
              📅 Add to Calendar
            </a>
          )}
          <a href="/api/customer/bookings/export" className="rounded border border-white/30 px-3 py-1.5 text-sm font-medium text-white/80 hover:bg-white/5">
            ⬇ Export CSV
          </a>
          <Link href="/booking" className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white">Book a class</Link>
        </div>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-white/70">Upcoming ({data.upcoming.length})</h2>
        <div className="space-y-2 text-white">
          {data.upcoming.map(b => <BookingCard key={b.id} b={b} />)}
          {!data.upcoming.length && <p className="text-sm text-white/40">No upcoming bookings.</p>}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-white/70">Past ({data.past.length})</h2>
        <div className="space-y-2 text-white">
          {data.past.map(b => <BookingCard key={b.id} b={b} onRated={loadData} />)}
          {!data.past.length && <p className="text-sm text-white/40">No past bookings yet.</p>}
        </div>
      </section>
    </div>
  );
}

function BookingCard({ b, onRated }: { b: Booking; onRated?: () => void }) {
  return (
    <div className="rounded-lg border border-white/20 bg-slate-800/70 p-3 text-sm">
      <div className="flex justify-between">
        <span className="font-medium">{b.class_name}</span>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs capitalize">{b.status.replaceAll('_', ' ')}</span>
      </div>
      <p className="text-xs text-white/60">{new Date(b.session_date).toLocaleDateString()} · {b.start_time} · {b.duration_minutes}m with {b.teacher_name}{b.location ? ` · ${b.location}` : ''}</p>
      {b.status === 'checked_in' && <RatingWidget bookingId={b.id} teacherName={b.teacher_name} myRating={b.my_rating} onRated={onRated} />}
    </div>
  );
}

function RatingWidget({ bookingId, teacherName, myRating, onRated }: { bookingId: string; teacherName: string; myRating: number | null; onRated?: () => void }) {
  const [hover, setHover] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (myRating != null) {
    return (
      <p className="mt-2 text-xs text-amber-600">
        You rated {teacherName}: {'★'.repeat(myRating)}{'☆'.repeat(5 - myRating)}
      </p>
    );
  }

  async function submit(rating: number) {
    setSubmitting(true);
    setError(null);
    const res = await fetch('/api/customer/teacher-rating', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookingId, rating }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? 'Could not submit rating.');
      return;
    }
    onRated?.();
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <span className="text-xs text-white/60">Rate {teacherName}:</span>
      <div className="flex" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} type="button" disabled={submitting} onMouseEnter={() => setHover(n)} onClick={() => submit(n)}
            className="px-0.5 text-lg leading-none disabled:opacity-50" aria-label={`Rate ${n} stars`}>
            {n <= hover ? '★' : '☆'}
          </button>
        ))}
      </div>
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </div>
  );
}
