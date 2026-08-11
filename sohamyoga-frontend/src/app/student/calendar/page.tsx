"use client";
import { useState } from "react";

interface BookedClass {
  id: string;
  title: string;
  teacher: string;
  style: string;
  dateTime: Date;
  durationMinutes: number;
  status: "upcoming" | "attended" | "cancelled";
  isOnline: boolean;
  joinLink?: string;
}

const BOOKED: BookedClass[] = [
  { id: "1", title: "Morning Hatha Flow",  teacher: "Priya Sharma", style: "Hatha",   dateTime: new Date("2026-08-06T07:00:00"), durationMinutes: 60, status: "upcoming",  isOnline: false },
  { id: "2", title: "Power Vinyasa",        teacher: "Raj Patel",    style: "Vinyasa", dateTime: new Date("2026-08-08T10:00:00"), durationMinutes: 75, status: "upcoming",  isOnline: true, joinLink: "https://zoom.us/j/example" },
  { id: "3", title: "Yin & Restore",        teacher: "Anita Mehta",  style: "Yin",     dateTime: new Date("2026-08-10T18:00:00"), durationMinutes: 90, status: "upcoming",  isOnline: false },
  { id: "4", title: "Morning Hatha Flow",  teacher: "Priya Sharma", style: "Hatha",   dateTime: new Date("2026-08-01T07:00:00"), durationMinutes: 60, status: "attended",  isOnline: false },
  { id: "5", title: "Power Vinyasa",        teacher: "Raj Patel",    style: "Vinyasa", dateTime: new Date("2026-07-29T10:00:00"), durationMinutes: 75, status: "attended",  isOnline: true },
  { id: "6", title: "Kundalini Awakening",  teacher: "Raj Patel",    style: "Kundalini",dateTime: new Date("2026-07-25T19:30:00"), durationMinutes: 90, status: "cancelled", isOnline: false },
];

const STATUS_STYLE: Record<string, string> = {
  upcoming:  "bg-green-900 text-green-300",
  attended:  "bg-blue-900 text-blue-300",
  cancelled: "bg-gray-800 text-gray-400",
};

function fmt(d: Date, opts: Intl.DateTimeFormatOptions) {
  return d.toLocaleDateString("en-CA", opts);
}

export default function StudentCalendarPage() {
  const [filter, setFilter] = useState<"all" | "upcoming" | "attended" | "cancelled">("all");

  const filtered = filter === "all" ? BOOKED : BOOKED.filter(b => b.status === filter);
  const upcoming = BOOKED.filter(b => b.status === "upcoming").sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">My Calendar</h1>
            <p className="text-gray-400 mt-1">All booked and past sessions</p>
          </div>
          <button className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors">
            + Sync Calendar
          </button>
        </div>

        {/* Next up */}
        {upcoming[0] && (
          <div className="bg-gradient-to-r from-green-900 to-green-800 rounded-2xl p-5 space-y-1">
            <p className="text-xs text-green-300 uppercase tracking-wider">Next Class</p>
            <h3 className="text-xl font-bold">{upcoming[0].title}</h3>
            <p className="text-green-200 text-sm">
              👩‍🏫 {upcoming[0].teacher} · {upcoming[0].style} · ⏱ {upcoming[0].durationMinutes} min
            </p>
            <p className="text-green-200 text-sm">
              📅 {fmt(upcoming[0].dateTime, { weekday: "long", month: "long", day: "numeric" })} at{" "}
              {upcoming[0].dateTime.toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit" })}
              {upcoming[0].isOnline && " · Online"}
            </p>
            {upcoming[0].joinLink && (
              <a href={upcoming[0].joinLink} target="_blank" rel="noopener noreferrer"
                className="inline-block mt-2 bg-green-500 hover:bg-green-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                Join Online →
              </a>
            )}
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-2">
          {(["all", "upcoming", "attended", "cancelled"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-full text-sm font-medium capitalize transition-colors ${
                filter === f ? "bg-green-700 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}>{f}</button>
          ))}
        </div>

        {/* One row per class */}
        <div className="space-y-3">
          {filtered.sort((a, b) => b.dateTime.getTime() - a.dateTime.getTime()).map(cls => (
            <div key={cls.id} className={`bg-gray-900 rounded-2xl p-5 flex justify-between items-center ${
              cls.status === "cancelled" ? "opacity-50" : ""
            }`}>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{cls.title}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_STYLE[cls.status]}`}>{cls.status}</span>
                  {cls.isOnline && <span className="px-2 py-0.5 rounded-full text-xs bg-blue-900 text-blue-300">Online</span>}
                </div>
                <p className="text-sm text-gray-400">👩‍🏫 {cls.teacher} · {cls.style} · ⏱ {cls.durationMinutes} min</p>
                <p className="text-sm text-gray-500">
                  {fmt(cls.dateTime, { weekday: "short", month: "short", day: "numeric" })} at{" "}
                  {cls.dateTime.toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>

              <div className="text-right shrink-0 ml-4 space-y-1">
                {cls.status === "upcoming" && (
                  <>
                    {cls.joinLink
                      ? <a href={cls.joinLink} target="_blank" rel="noopener noreferrer"
                          className="block px-3 py-1.5 bg-green-700 hover:bg-green-800 text-white rounded-lg text-xs font-medium transition-colors">
                          Join Online
                        </a>
                      : <span className="block text-xs text-gray-400">In Studio</span>
                    }
                    <button className="block w-full text-xs text-red-400 hover:text-red-300 transition-colors">Cancel</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
