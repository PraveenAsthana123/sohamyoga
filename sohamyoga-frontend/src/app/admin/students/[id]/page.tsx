"use client";
// Student 360 profile — real data from student + enrollment + the
// gamification tables (practice_journal, streak, achievement) already
// written by StreakUpdateJob/BadgeAwardJob/WellnessScoringJob. Previously
// a fully static mock (fixed "Priya Mehta" regardless of the route param)
// with fabricated loyalty points, membership tier, outstanding balance,
// and Frappe/Chatwoot/ERPNext IDs — none of that is reintroduced here.

import { useEffect, useState } from "react";

interface Student {
  id: string; display_name: string; email: string; phone: string | null; status: string;
  journey_phase: string; experience_level: string; yoga_style_preference: string[] | null;
  enrolled_at: string; first_class_at: string | null; last_class_at: string | null;
}
interface Enrollment { id: string; status: string; start_date: string; enrolled_at: string }
interface JournalEntry { entry_date: string; session_type: string; duration_minutes: number | null; mood_before: number | null; mood_after: number | null; energy_level: number | null; notes: string | null }
interface Streak { current_streak: number; longest_streak: number; last_activity_date: string | null; total_active_days: number }
interface Achievement { badge_id: string; earned_at: string; source: string }

export default function StudentDetailPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<{ student: Student; enrollment: Enrollment | null; journal: JournalEntry[]; streak: Streak | null; achievements: Achievement[] } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/admin/students/${params.id}`, { cache: "no-store" })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setData(d); })
      .catch(e => setError(e.message));
  }, [params.id]);

  if (error) return <div className="p-6 max-w-5xl mx-auto"><div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div></div>;
  if (!data) return <div className="p-6 text-sm text-gray-500">Loading…</div>;

  const { student, enrollment, journal, streak, achievements } = data;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="bg-white border rounded-xl p-5">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-700 text-xl flex-shrink-0">
            {student.display_name.split(" ").map(n => n[0]).join("").slice(0, 2)}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{student.display_name}</h1>
              <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium">{student.status}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${enrollment?.status === "active" ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-500"}`}>
                {enrollment?.status === "active" ? "Enrolled" : "Not enrolled"}
              </span>
            </div>
            <div className="text-sm text-gray-500 mt-0.5">{student.email}{student.phone ? ` · ${student.phone}` : ""}</div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center flex-shrink-0">
            <div>
              <div className="text-lg font-bold text-orange-500">{streak?.current_streak ?? 0}d</div>
              <div className="text-xs text-gray-400">Streak</div>
            </div>
            <div>
              <div className="text-lg font-bold text-indigo-600">{achievements.length}</div>
              <div className="text-xs text-gray-400">Badges</div>
            </div>
            <div>
              <div className="text-lg font-bold text-gray-700">{journal.length}</div>
              <div className="text-xs text-gray-400">Journal entries</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-3">Profile</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-gray-500">Experience</dt><dd className="capitalize">{student.experience_level}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Journey Phase</dt><dd className="capitalize">{student.journey_phase.replace(/_/g, " ")}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Style Preference</dt><dd>{student.yoga_style_preference?.join(", ") || "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Enrolled</dt><dd>{new Date(student.enrolled_at).toLocaleDateString()}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Last Class</dt><dd>{student.last_class_at ? new Date(student.last_class_at).toLocaleDateString() : "Never"}</dd></div>
          </dl>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-3">Streak & Activity</h3>
          {streak ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-gray-500">Current Streak</dt><dd className="font-medium">{streak.current_streak} days</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Longest Streak</dt><dd className="font-medium">{streak.longest_streak} days</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Total Active Days</dt><dd className="font-medium">{streak.total_active_days}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Last Activity</dt><dd>{streak.last_activity_date ? new Date(streak.last_activity_date).toLocaleDateString() : "—"}</dd></div>
            </dl>
          ) : <p className="text-sm text-gray-400">No streak record yet.</p>}
        </div>
      </div>

      <div className="bg-white border rounded-lg p-4">
        <h3 className="font-semibold text-gray-800 mb-3">Recent Practice Journal</h3>
        {journal.length === 0 ? (
          <p className="text-sm text-gray-400">No journal entries yet.</p>
        ) : (
          <div className="space-y-2">
            {journal.map((j, i) => (
              <div key={i} className="flex items-center gap-3 text-sm border-b last:border-0 pb-2 last:pb-0">
                <span className="text-xs text-gray-400 w-24">{new Date(j.entry_date).toLocaleDateString()}</span>
                <span className="flex-1 text-gray-700 capitalize">{j.session_type}{j.duration_minutes ? ` · ${j.duration_minutes} min` : ""}</span>
                {j.mood_before != null && j.mood_after != null && <span className="text-xs text-gray-400">mood {j.mood_before}→{j.mood_after}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white border rounded-lg p-4">
        <h3 className="font-semibold text-gray-800 mb-3">Badges Earned</h3>
        {achievements.length === 0 ? (
          <p className="text-sm text-gray-400">No badges earned yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {achievements.map((a, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-50 border border-yellow-200 text-yellow-700">
                🏅 {a.badge_id} <span className="text-gray-400">({new Date(a.earned_at).toLocaleDateString()})</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
