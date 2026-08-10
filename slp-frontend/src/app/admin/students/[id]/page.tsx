"use client";
// Student 360 profile — enrollment, attendance, wellness, plan, loyalty, support

import { useState } from "react";
import { MASTERY_LABELS, MASTERY_COLORS } from "@/domain/yoga/PoseProgress";

type Tab = "overview" | "enrollment" | "wellness" | "plan" | "support" | "loyalty";

const DEMO_STUDENT = {
  id: "s1", enrollmentNumber: "SY-2026-0001", name: "Priya Mehta",
  email: "priya@example.com", phone: "+1 604 555 0182", timezone: "America/Vancouver",
  status: "active", primaryStyle: "Hatha", experienceYears: 3,
  goals: ["stress_relief", "flexibility"], healthClearance: "cleared",
  totalClasses: 42, totalAbsences: 3, currentStreak: 12, loyaltyPoints: 4200, tier: "gold",
  outstandingBalance: 0, frappe: "STU-2026-00042", chatwoot: "CW-1084", erpnext: "CUST-00312",
  enrolledAt: "Jan 15, 2026",
};

const DEMO_POSES = [
  { name: "Tadasana",            level: "master",       avgScore: 94, attempts: 28, trend: "plateau"   },
  { name: "Adho Mukha Svanasana",level: "advanced",     avgScore: 82, attempts: 35, trend: "improving" },
  { name: "Virabhadrasana I",    level: "intermediate", avgScore: 67, attempts: 22, trend: "improving" },
  { name: "Vrksasana",           level: "beginner",     avgScore: 51, attempts: 14, trend: "improving" },
  { name: "Sirsasana",           level: "novice",       avgScore: 28, attempts: 6,  trend: "insufficient_data" },
];

const DEMO_JOURNAL = [
  { date: "Aug 4", type: "class",    mood: "4→5", energy: "low→high",  title: "Morning Hatha",      milestone: true  },
  { date: "Aug 3", type: "self",     mood: "3→4", energy: "mod→high",  title: "Home practice 30min", milestone: false },
  { date: "Aug 2", type: "class",    mood: "2→4", energy: "low→mod",   title: "Yin Yoga evening",    milestone: false },
];

export default function StudentDetailPage({ params }: { params: { id: string } }) {
  const [tab, setTab] = useState<Tab>("overview");

  const s = DEMO_STUDENT;
  const tabs: Tab[] = ["overview","enrollment","wellness","plan","support","loyalty"];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-white border rounded-xl p-5 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-700 text-xl flex-shrink-0">
            PM
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{s.name}</h1>
              <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium">{s.status}</span>
              <span className="bg-yellow-50 text-yellow-700 text-xs px-2 py-0.5 rounded-full font-medium border border-yellow-200">Gold</span>
            </div>
            <div className="text-sm text-gray-500 mt-0.5">{s.enrollmentNumber} · {s.email} · {s.timezone}</div>
            <div className="flex gap-3 mt-2 text-xs">
              {s.frappe  && <span className="bg-blue-50 border border-blue-200 text-blue-700 px-2 py-0.5 rounded">Frappe: {s.frappe}</span>}
              {s.chatwoot && <span className="bg-teal-50 border border-teal-200 text-teal-700 px-2 py-0.5 rounded">Chatwoot: {s.chatwoot}</span>}
              {s.erpnext  && <span className="bg-orange-50 border border-orange-200 text-orange-700 px-2 py-0.5 rounded">ERPNext: {s.erpnext}</span>}
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3 text-center flex-shrink-0">
            {[
              { label: "Classes",  value: s.totalClasses,            color: "text-indigo-600" },
              { label: "Streak",   value: `${s.currentStreak}d`,     color: "text-orange-500" },
              { label: "Points",   value: s.loyaltyPoints.toLocaleString(), color: "text-yellow-600" },
              { label: "Balance",  value: `$${s.outstandingBalance}`, color: s.outstandingBalance > 0 ? "text-red-500" : "text-gray-400" },
            ].map(k => (
              <div key={k.label}>
                <div className={`text-lg font-bold ${k.color}`}>{k.value}</div>
                <div className="text-xs text-gray-400">{k.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b mb-6">
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${tab === t ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-800"}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === "overview" && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white border rounded-lg p-4">
            <h3 className="font-semibold text-gray-800 mb-3">Quick Info</h3>
            <dl className="space-y-2 text-sm">
              {[
                ["Style",       s.primaryStyle],
                ["Experience",  `${s.experienceYears} years`],
                ["Goals",       s.goals.join(", ").replace(/_/g," ")],
                ["Enrolled",    s.enrolledAt],
                ["Attendance",  `${Math.round((42/(42+3))*100)}%`],
                ["Health",      s.healthClearance],
              ].map(([k,v]) => (
                <div key={k as string} className="flex justify-between">
                  <dt className="text-gray-500">{k}</dt>
                  <dd className="font-medium text-gray-800 capitalize">{v as string}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <h3 className="font-semibold text-gray-800 mb-3">Practice Journal (recent)</h3>
            <div className="space-y-2">
              {DEMO_JOURNAL.map((j, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="text-xs text-gray-400 w-12">{j.date}</span>
                  <span className="flex-1 text-gray-700">{j.title}</span>
                  {j.milestone && <span className="text-xs">🌟</span>}
                  <span className="text-xs text-gray-400">{j.mood}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Wellness / Pose Progress */}
      {tab === "wellness" && (
        <div>
          <h2 className="font-semibold text-gray-800 mb-4">Pose Mastery Progress</h2>
          <div className="space-y-3">
            {DEMO_POSES.map(p => {
              const color = MASTERY_COLORS[p.level as keyof typeof MASTERY_COLORS] ?? "bg-gray-100 text-gray-600";
              const label = MASTERY_LABELS[p.level as keyof typeof MASTERY_LABELS] ?? p.level;
              const trendIcon = p.trend === "improving" ? "↑" : p.trend === "declining" ? "↓" : "→";
              const trendColor = p.trend === "improving" ? "text-green-600" : p.trend === "declining" ? "text-red-500" : "text-gray-400";
              return (
                <div key={p.name} className="bg-white border rounded-lg p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="font-medium text-gray-800">{p.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>{label}</span>
                        <span className={`text-xs font-medium ${trendColor}`}>{trendIcon} {p.trend.replace(/_/g," ")}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${p.avgScore}%` }} />
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-lg font-bold text-gray-900">{p.avgScore}</div>
                      <div className="text-xs text-gray-400">{p.attempts} attempts</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Placeholder tabs */}
      {["enrollment","plan","support","loyalty"].includes(tab) && (
        <div className="bg-white border rounded-lg p-8 text-center text-gray-400">
          <div className="text-4xl mb-2">
            {tab === "enrollment" ? "📋" : tab === "plan" ? "🗺️" : tab === "support" ? "💬" : "🏅"}
          </div>
          <div className="font-medium text-gray-600 capitalize">{tab}</div>
          <div className="text-sm mt-1">
            {tab === "enrollment" && "Enrollment and attendance data synced from Frappe Education"}
            {tab === "plan"       && "Personalized practice plan assigned by teacher or AI"}
            {tab === "support"    && "Support conversations from Chatwoot inbox"}
            {tab === "loyalty"    && "Loyalty point history and reward redemptions from ERPNext"}
          </div>
        </div>
      )}
    </div>
  );
}
