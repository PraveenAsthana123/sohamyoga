"use client";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useAnalyticsContext } from "@/components/analytics/AnalyticsProvider";

const CLASS_DATA: Record<string, { title: string; teacher: string; dateTime: string; duration: number; level: string; style: string; price: number; description: string }> = {
  "1": { title: "Morning Flow", teacher: "Priya Sharma", dateTime: "2026-08-06T07:00:00", duration: 60, level: "Beginner", style: "Hatha", price: 15, description: "Gentle morning sequence to awaken the body and set a peaceful tone for your day." },
  "2": { title: "Power Vinyasa", teacher: "Raj Patel", dateTime: "2026-08-06T10:00:00", duration: 75, level: "Intermediate", style: "Vinyasa", price: 18, description: "Energising flow linking breath with movement. Builds strength and flexibility." },
  "3": { title: "Yin & Restore", teacher: "Anita Mehta", dateTime: "2026-08-06T18:00:00", duration: 90, level: "Beginner", style: "Yin", price: 15, description: "Deep, slow stretches held for 3-5 minutes. Ideal for stress relief and recovery." },
  "4": { title: "Advanced Inversions", teacher: "Priya Sharma", dateTime: "2026-08-07T08:00:00", duration: 60, level: "Advanced", style: "Ashtanga", price: 22, description: "Headstands, handstands, and forearm balance. Safe, structured progression." },
};

export default function ClassDetailPage() {
  const { classId } = useParams<{ classId: string }>();
  const router = useRouter();
  const { trackConversion } = useAnalyticsContext();
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState(false);

  const cls = CLASS_DATA[classId];
  if (!cls) return <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">Class not found.</div>;

  async function handleBook() {
    setBooking(true);
    trackConversion('booking_started', { classId, title: cls.title, style: cls.style, level: cls.level, price: cls.price });
    await new Promise(r => setTimeout(r, 800));
    setBooked(true);
    setBooking(false);
    trackConversion('booking_completed', { classId, title: cls.title, style: cls.style, level: cls.level, price: cls.price });
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
            <p className="text-gray-500 mt-2">{cls.description}</p>
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

          <button
            onClick={handleBook}
            disabled={booking || booked}
            className={`w-full py-4 rounded-xl font-semibold text-white text-lg transition-colors ${
              booked ? "bg-green-500" : "bg-green-600 hover:bg-green-700"
            }`}
          >
            {booked ? "Booked!" : booking ? "Booking…" : `Book Now — $${cls.price}`}
          </button>
          <p className="text-center text-xs text-gray-400">Cancel up to 2 hours before class for a full refund.</p>
        </div>
      </div>
    </div>
  );
}
