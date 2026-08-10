"use client";
// Teacher management — HR overview, schedule, certs, CPD, linked system IDs

import { useState } from "react";
import Link from "next/link";

const STATUS_COLORS: Record<string, string> = {
  active:     "bg-green-100 text-green-700",
  trainee:    "bg-blue-100 text-blue-700",
  on_leave:   "bg-amber-100 text-amber-700",
  retired:    "bg-gray-100 text-gray-500",
  terminated: "bg-red-100 text-red-700",
};

const CONTRACT_COLORS: Record<string, string> = {
  employee:   "bg-indigo-50 text-indigo-700",
  contractor: "bg-purple-50 text-purple-700",
  volunteer:  "bg-teal-50 text-teal-700",
};

const DEMO_TEACHERS = [
  { id: "t1", name: "Sunita Patel",    email: "sunita@sohamyoga.com", status: "active",   contract: "employee",   spec: ["Hatha","Yin"],         rating: 4.9, classes: 312, students: 84,  cpdPct: 85, cert: "RYT-500", frappeHR: true, calcom: true, moodle: true,  paperless: true  },
  { id: "t2", name: "Arjun Mehta",     email: "arjun@sohamyoga.com",  status: "active",   contract: "employee",   spec: ["Vinyasa","Ashtanga"],   rating: 4.7, classes: 198, students: 62,  cpdPct: 60, cert: "RYT-200", frappeHR: true, calcom: true, moodle: true,  paperless: true  },
  { id: "t3", name: "Maria Santos",    email: "maria@sohamyoga.com",  status: "active",   contract: "contractor", spec: ["Prenatal","Restorative"],rating:4.8, classes: 88,  students: 33,  cpdPct: 100,cert: "RYT-200", frappeHR: true, calcom: true, moodle: false, paperless: true  },
  { id: "t4", name: "David Kim",       email: "david@sohamyoga.com",  status: "trainee",  contract: "intern",     spec: ["Hatha"],                rating: 0,  classes: 4,   students: 12,  cpdPct: 30, cert: "—",       frappeHR: true, calcom: false,moodle: true,  paperless: false },
  { id: "t5", name: "Priya Krishnan",  email: "priya@sohamyoga.com",  status: "on_leave", contract: "employee",   spec: ["Kundalini","Meditation"],rating:4.6,classes:145,  students: 48,  cpdPct: 75, cert: "RYT-500", frappeHR: true, calcom: false,moodle: true,  paperless: true  },
];

const KPI = [
  { label: "Active Teachers",  value: DEMO_TEACHERS.filter(t => t.status === "active").length, color: "text-green-600"  },
  { label: "Trainees",         value: DEMO_TEACHERS.filter(t => t.status === "trainee").length,color: "text-blue-600"   },
  { label: "On Leave",         value: DEMO_TEACHERS.filter(t => t.status === "on_leave").length,color: "text-amber-600" },
  { label: "Avg Rating",       value: (DEMO_TEACHERS.filter(t=>t.rating>0).reduce((s,t)=>s+t.rating,0)/DEMO_TEACHERS.filter(t=>t.rating>0).length).toFixed(1) + " ★", color: "text-yellow-600" },
];

export default function TeachersPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const visible = DEMO_TEACHERS.filter(t => {
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.email.includes(search);
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Teachers</h1>
          <p className="text-sm text-gray-500 mt-0.5">HR via Frappe HR · Scheduling via Cal.com · Training via Moodle · Certs via Paperless-ngx</p>
        </div>
        <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
          + Add Teacher
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {KPI.map(k => (
          <div key={k.label} className="bg-white border rounded-lg p-4">
            <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
            <div className="text-sm text-gray-500">{k.label}</div>
          </div>
        ))}
      </div>

      {/* System integration status */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 mb-5 text-sm text-indigo-800">
        <span className="font-medium">Platform connections: </span>
        {["Frappe HR","Cal.com","Moodle LMS","Paperless-ngx","ERPNext Payroll"].map(s => (
          <span key={s} className="bg-white border border-indigo-200 rounded px-2 py-0.5 text-xs mx-1">{s}</span>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm w-64"
        />
        <div className="flex gap-2">
          {["all","active","trainee","on_leave","retired"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs rounded-full font-medium capitalize transition-colors ${statusFilter === s ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {s.replace("_"," ")}
            </button>
          ))}
        </div>
      </div>

      {/* Teacher list */}
      <div className="space-y-3">
        {visible.map(t => (
          <div key={t.id} className="bg-white border rounded-lg p-4">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-700 flex-shrink-0">
                {t.name.split(" ").map(n => n[0]).join("").slice(0,2)}
              </div>

              {/* Main info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link href={`/admin/teachers/${t.id}`} className="font-medium text-gray-900 hover:text-indigo-600">
                    {t.name}
                  </Link>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[t.status]}`}>{t.status}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${CONTRACT_COLORS[t.contract]}`}>{t.contract}</span>
                  {t.cert !== "—" && <span className="text-xs bg-yellow-50 border border-yellow-200 text-yellow-700 px-2 py-0.5 rounded">{t.cert}</span>}
                </div>
                <div className="text-sm text-gray-500 mt-0.5">{t.email} · {t.spec.join(", ")}</div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-4 gap-4 text-center flex-shrink-0">
                <div>
                  <div className="text-sm font-semibold text-yellow-500">{t.rating > 0 ? `${t.rating}★` : "—"}</div>
                  <div className="text-xs text-gray-400">Rating</div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900">{t.classes}</div>
                  <div className="text-xs text-gray-400">Classes</div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-indigo-600">{t.students}</div>
                  <div className="text-xs text-gray-400">Students</div>
                </div>
                <div>
                  <div className={`text-sm font-semibold ${t.cpdPct >= 100 ? "text-green-600" : t.cpdPct < 50 ? "text-red-500" : "text-amber-600"}`}>{t.cpdPct}%</div>
                  <div className="text-xs text-gray-400">CPD</div>
                </div>
              </div>

              {/* System badges */}
              <div className="flex gap-1 flex-shrink-0">
                <span className={`text-xs px-1.5 py-0.5 rounded ${t.frappeHR ? "bg-orange-50 border border-orange-200 text-orange-700" : "bg-gray-50 text-gray-300"}`} title="Frappe HR">HR</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${t.calcom ? "bg-blue-50 border border-blue-200 text-blue-700" : "bg-gray-50 text-gray-300"}`} title="Cal.com">Cal</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${t.moodle ? "bg-green-50 border border-green-200 text-green-700" : "bg-gray-50 text-gray-300"}`} title="Moodle">LMS</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${t.paperless ? "bg-purple-50 border border-purple-200 text-purple-700" : "bg-gray-50 text-gray-300"}`} title="Paperless-ngx">Doc</span>
              </div>
            </div>
          </div>
        ))}
        {visible.length === 0 && (
          <div className="text-center py-12 text-gray-400">No teachers match your filter.</div>
        )}
      </div>
    </div>
  );
}
