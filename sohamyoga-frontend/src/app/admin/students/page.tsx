"use client";
// Student management — list, search, 360 view, enrollment status, lifecycle

import { useState } from "react";
import Link from "next/link";

type LifecycleStatus = "applicant" | "active" | "on_hold" | "completed" | "dropped" | "alumni";

const LIFECYCLE_COLORS: Record<LifecycleStatus, string> = {
  applicant: "bg-blue-100 text-blue-700",
  active:    "bg-green-100 text-green-700",
  on_hold:   "bg-amber-100 text-amber-700",
  completed: "bg-indigo-100 text-indigo-700",
  dropped:   "bg-red-100 text-red-700",
  alumni:    "bg-purple-100 text-purple-700",
};

const DEMO_STUDENTS = [
  { id: "s1", enrollmentNumber: "SY-2026-0001", name: "Priya Mehta",      email: "priya@example.com",  status: "active",    style: "Hatha",    classes: 42, streak: 12, loyalty: 4200, balance: 0,    tier: "gold",   frappe: true,  chatwoot: true },
  { id: "s2", enrollmentNumber: "SY-2026-0002", name: "Rajan Sharma",     email: "rajan@example.com",  status: "active",    style: "Vinyasa",  classes: 18, streak: 3,  loyalty: 1800, balance: 120,  tier: "silver", frappe: true,  chatwoot: false },
  { id: "s3", enrollmentNumber: "SY-2026-0003", name: "Sunita Patel",     email: "sunita@example.com", status: "on_hold",   style: "Yin",      classes: 67, streak: 0,  loyalty: 6700, balance: 0,    tier: "platinum",frappe: true,  chatwoot: true },
  { id: "s4", enrollmentNumber: "SY-2026-0004", name: "David Kowalski",   email: "david@example.com",  status: "applicant", style: "Restorative",classes:0, streak: 0,  loyalty: 0,    balance: 0,    tier: "bronze", frappe: false, chatwoot: false },
  { id: "s5", enrollmentNumber: "SY-2026-0005", name: "Aisha Nwosu",      email: "aisha@example.com",  status: "active",    style: "Ashtanga", classes: 31, streak: 7,  loyalty: 3100, balance: 0,    tier: "gold",   frappe: true,  chatwoot: true },
  { id: "s6", enrollmentNumber: "SY-2026-0006", name: "Mark Thompson",    email: "mark@example.com",   status: "dropped",   style: "Hatha",    classes: 5,  streak: 0,  loyalty: 500,  balance: 0,    tier: "bronze", frappe: true,  chatwoot: false },
];

const KPI = [
  { label: "Active Students",    value: DEMO_STUDENTS.filter(s => s.status === "active").length,    color: "text-green-600" },
  { label: "Applicants",         value: DEMO_STUDENTS.filter(s => s.status === "applicant").length, color: "text-blue-600"  },
  { label: "On Hold",            value: DEMO_STUDENTS.filter(s => s.status === "on_hold").length,   color: "text-amber-600" },
  { label: "Outstanding Fees",   value: "$" + DEMO_STUDENTS.reduce((s, x) => s + x.balance, 0),    color: "text-red-600"   },
];

export default function StudentsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const visible = DEMO_STUDENTS.filter(s => {
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.email.includes(search) || s.enrollmentNumber.includes(search);
    const matchStatus = statusFilter === "all" || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Students</h1>
          <p className="text-sm text-gray-500 mt-0.5">Managed by Frappe Education · synced to ERPNext · support via Chatwoot</p>
        </div>
        <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
          + Enroll Student
        </button>
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {KPI.map(k => (
          <div key={k.label} className="bg-white border rounded-lg p-4">
            <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
            <div className="text-sm text-gray-500">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Integration status notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-800 flex items-center gap-2">
        <span>Connected: </span>
        <span className="bg-white border border-blue-300 rounded px-2 py-0.5 text-xs">Frappe Education</span>
        <span className="bg-white border border-blue-300 rounded px-2 py-0.5 text-xs">ERPNext</span>
        <span className="bg-white border border-blue-300 rounded px-2 py-0.5 text-xs">Chatwoot</span>
        <span className="bg-white border border-blue-300 rounded px-2 py-0.5 text-xs">PostHog</span>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <input
          type="text"
          placeholder="Search by name, email, or enrolment #..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm w-72"
        />
        <div className="flex gap-2">
          {["all","active","applicant","on_hold","alumni","dropped"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs rounded-full font-medium capitalize transition-colors ${statusFilter === s ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Student list */}
      <div className="space-y-3">
        {visible.map(s => {
          const tierColors = { bronze: "text-orange-700", silver: "text-gray-500", gold: "text-yellow-600", platinum: "text-indigo-600" };
          return (
            <div key={s.id} className="bg-white border rounded-lg p-4">
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-700 flex-shrink-0">
                  {s.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/admin/students/${s.id}`} className="font-medium text-gray-900 hover:text-indigo-600">
                      {s.name}
                    </Link>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${LIFECYCLE_COLORS[s.status as LifecycleStatus]}`}>{s.status}</span>
                    <span className={`text-xs font-medium ${tierColors[s.tier as keyof typeof tierColors]}`}>
                      {s.tier.charAt(0).toUpperCase() + s.tier.slice(1)}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">{s.enrollmentNumber} · {s.email} · {s.style}</div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-4 text-center flex-shrink-0 text-sm">
                  <div>
                    <div className="font-semibold text-gray-900">{s.classes}</div>
                    <div className="text-xs text-gray-400">Classes</div>
                  </div>
                  <div>
                    <div className={`font-semibold ${s.streak > 0 ? "text-orange-500" : "text-gray-400"}`}>{s.streak}d</div>
                    <div className="text-xs text-gray-400">Streak</div>
                  </div>
                  <div>
                    <div className="font-semibold text-yellow-600">{s.loyalty.toLocaleString()}</div>
                    <div className="text-xs text-gray-400">Points</div>
                  </div>
                  <div>
                    <div className={`font-semibold ${s.balance > 0 ? "text-red-500" : "text-gray-400"}`}>
                      {s.balance > 0 ? `$${s.balance}` : "—"}
                    </div>
                    <div className="text-xs text-gray-400">Balance</div>
                  </div>
                </div>

                {/* Integration badges */}
                <div className="flex gap-1 flex-shrink-0">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${s.frappe ? "bg-green-50 text-green-700 border border-green-200" : "bg-gray-50 text-gray-400"}`} title="Frappe Education">FE</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${s.chatwoot ? "bg-green-50 text-green-700 border border-green-200" : "bg-gray-50 text-gray-400"}`} title="Chatwoot">CW</span>
                </div>
              </div>
            </div>
          );
        })}
        {visible.length === 0 && (
          <div className="text-center py-12 text-gray-400">No students match your filter.</div>
        )}
      </div>
    </div>
  );
}
