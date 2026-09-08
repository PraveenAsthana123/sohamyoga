"use client";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useAnalyticsContext } from "@/components/analytics/AnalyticsProvider";

interface ClassDetail {
  id: string; title: string; teacher: string; dateTime: string; duration: number;
  level: string | null; style: string | null; price: number; spotsLeft: number; totalSpots: number;
}

export default function ClassDetailPage() {
  const { classId } = useParams<{ classId: string }>();
  const router = useRouter();
  const { trackConversion } = useAnalyticsContext();
  const [cls, setCls] = useState<ClassDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState(false);
  const [waitlisted, setWaitlisted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/classes/${classId}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => d ? setCls(d) : setNotFound(true));
  }, [classId]);

  if (notFound) return <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">Class not found.</div>;
  if (!cls) return <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center text-gray-500">Loading…</div>;

  async function handleBook() {
    setBooking(true);
    setError('');
    trackConversion('booking_started', { classId, title: cls!.title, style: cls!.style, level: cls!.level, price: cls!.price });
    const r = await fetch('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ classSessionId: classId }) });
    const j = await r.json();
    setBooking(false);
    if (!r.ok) { setError(j.error || 'Booking failed.'); return; }
    if (j.outcome === 'waitlisted') {
      setWaitlisted(true);
      trackConversion('booking_waitlisted', { classId, title: cls!.title });
      return;
    }
    setBooked(true);
    trackConversion('booking_completed', { classId, title: cls!.title, style: cls!.style, level: cls!.level, price: cls!.price });
    setTimeout(() => router.push("/booking/confirmation"), 1000);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 p-6">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => router.back()} className="text-green-700 hover:text-green-900 text-sm mb-6 flex items-center gap-1">
          ← Back to classes
        </button>

        <div className="bg-white rounded-2xl shadow-sm p-8 space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">{cls.level}</span>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">{cls.style}</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">{cls.title}</h1>
            <p className="text-gray-500 mt-2">{cls.spotsLeft} of {cls.totalSpots} spots left.</p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="text-gray-400 mb-1">Teacher</div>
              <div className="font-semibold text-gray-900">👩‍🏫 {cls.teacher}</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="text-gray-400 mb-1">Duration</div>
              <div className="font-semibold text-gray-900">⏱ {cls.duration} min</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="text-gray-400 mb-1">Date & Time</div>
              <div className="font-semibold text-gray-900">
                📅 {new Date(cls.dateTime).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" })} at{" "}
                {new Date(cls.dateTime).toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="text-gray-400 mb-1">Price</div>
              <div className="font-semibold text-gray-900 text-xl">${cls.price}</div>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {waitlisted && <p className="text-sm text-amber-700">This class is full — you've been added to the waitlist and will be notified if a spot opens up.</p>}

          <button
            onClick={handleBook}
            disabled={booking || booked || waitlisted}
            className={`w-full py-4 rounded-xl font-semibold text-white text-lg transition-colors ${
              booked ? "bg-green-500" : waitlisted ? "bg-amber-500" : "bg-green-600 hover:bg-green-700"
            }`}
          >
            {booked ? "Booked!" : waitlisted ? "Waitlisted" : booking ? "Booking…" : `Book Now — $${cls.price}`}
          </button>
          <p className="text-center text-xs text-gray-400">Cancel up to 2 hours before class for a full refund.</p>
        </div>
      </div>
    </div>
  );
}
