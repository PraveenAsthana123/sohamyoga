'use client';
// /customer/bookings — real upcoming/past bookings. Replaces /student/calendar
// and /student/history, both hardcoded arrays with no backing table.

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Booking {
  id: string; status: string; class_name: string; teacher_name: string; session_date: string; start_time: string; duration_minutes: number; location: string | null; checked_in_at: string | null;
}

export default function BookingsPage() {
  const [data, setData] = useState<{ upcoming: Booking[]; past: Booking[]; hasStudentRecord: boolean } | null>(null);

  useEffect(() => {
    fetch('/api/customer/bookings', { cache: 'no-store' }).then(r => r.json()).then(setData);
  }, []);

  if (!data) return <p className="text-sm text-gray-400">Loading…</p>;
  if (!data.hasStudentRecord) {
    return <p className="text-sm text-gray-500">Booking history is available once you're enrolled in a class. <Link href="/booking" className="text-blue-600 underline">Browse classes</Link>.</p>;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Bookings</h1>
          <p className="mt-1 text-sm text-gray-500">Your real upcoming and past classes.</p>
        </div>
        <div className="flex gap-2">
          {data.upcoming.length > 0 && (
            <a href="/api/customer/bookings/ical" className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
              📅 Add to Calendar
            </a>
          )}
          <a href="/api/customer/bookings/export" className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
            ⬇ Export CSV
          </a>
          <Link href="/booking" className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white">Book a class</Link>
        </div>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-600">Upcoming ({data.upcoming.length})</h2>
        <div className="space-y-2">
          {data.upcoming.map(b => <BookingCard key={b.id} b={b} />)}
          {!data.upcoming.length && <p className="text-sm text-gray-400">No upcoming bookings.</p>}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-600">Past ({data.past.length})</h2>
        <div className="space-y-2">
          {data.past.map(b => <BookingCard key={b.id} b={b} />)}
          {!data.past.length && <p className="text-sm text-gray-400">No past bookings yet.</p>}
        </div>
      </section>
    </div>
  );
}

function BookingCard({ b }: { b: Booking }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
      <div className="flex justify-between">
        <span className="font-medium">{b.class_name}</span>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs capitalize">{b.status.replaceAll('_', ' ')}</span>
      </div>
      <p className="text-xs text-gray-500">{new Date(b.session_date).toLocaleDateString()} · {b.start_time} · {b.duration_minutes}m with {b.teacher_name}{b.location ? ` · ${b.location}` : ''}</p>
    </div>
  );
}
