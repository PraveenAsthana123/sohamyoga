"use client";
import { useState, useEffect } from "react";
import { useAnalyticsContext } from "@/components/analytics/AnalyticsProvider";

interface YogaClass {
  id: string;
  title: string;
  teacher: string;
  dateTime: string;
  duration: number;
  level: "Beginner" | "Intermediate" | "Advanced";
  spotsLeft: number;
  totalSpots: number;
  style: string;
  price: number;
}

export default function BookingPage() {
  const { track } = useAnalyticsContext();
  const [classes, setClasses] = useState<YogaClass[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/classes", { cache: "no-store" })
      .then(r => r.ok ? r.json() : { classes: [] })
      .then(d => setClasses(d.classes ?? []))
      .finally(() => setLoading(false));
  }, []);

  const levels = ["all", "Beginner", "Intermediate", "Advanced"];
  const filtered = filter === "all" ? classes : classes.filter(c => c.level === filter);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Book a Class</h1>
          <p className="text-gray-600 mt-1">Find your perfect yoga session</p>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {levels.map(lvl => (
            <button key={lvl} onClick={() => setFilter(lvl)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                filter === lvl ? "bg-green-700 text-white" : "bg-white text-gray-600 hover:bg-green-50 border"
              }`}>
              {lvl === "all" ? "All Levels" : lvl}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading classes…</div>
        ) : (
          <div className="grid gap-4">
            {filtered.map(cls => (
              <div key={cls.id} className="bg-white rounded-xl shadow-sm border p-5 flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-semibold text-gray-900">{cls.title}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      cls.level === "Beginner" ? "bg-green-100 text-green-700" :
                      cls.level === "Intermediate" ? "bg-yellow-100 text-yellow-700" :
                      "bg-red-100 text-red-700"
                    }`}>{cls.level}</span>
                    <span className="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700">{cls.style}</span>
                  </div>
                  <p className="text-gray-500 text-sm">👩‍🏫 {cls.teacher} · ⏱ {cls.duration} min</p>
                  <p className="text-gray-600 text-sm mt-1">
                    📅 {new Date(cls.dateTime).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" })}
                    {" "} at {new Date(cls.dateTime).toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-1.5 max-w-32">
                      <div className="bg-green-500 h-1.5 rounded-full"
                           style={{ width: `${((cls.totalSpots - cls.spotsLeft) / cls.totalSpots) * 100}%` }} />
                    </div>
                    <span className="text-xs text-gray-500">{cls.spotsLeft} spots left</span>
                  </div>
                </div>
                <div className="ml-4 text-right">
                  <div className="text-xl font-bold text-gray-900">${cls.price}</div>
                  <a href={`/booking/${cls.id}`}
                     onClick={() => track({ name: 'booking_list_book_now_click', eventType: 'click', properties: { classId: cls.id, title: cls.title, style: cls.style, level: cls.level, price: cls.price } })}
                     className={`mt-2 block px-4 py-2 rounded-lg text-sm font-medium text-center transition-colors ${
                       cls.spotsLeft > 0
                         ? "bg-green-700 text-white hover:bg-green-800"
                         : "bg-gray-200 text-gray-400 cursor-not-allowed"
                     }`}>
                    {cls.spotsLeft > 0 ? "Book Now" : "Full"}
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
