"use client";
// Student directory and enrollment — real data from the `student` table,
// created via POST /api/admin/students (real ASP.NET Identity Customer
// account + Postgres profile). Previously this page rendered a hardcoded
// DEMO_STUDENTS array with fabricated loyalty points, membership tiers,
// balances, and Frappe/Chatwoot integration flags — none of that is
// reintroduced here; "Enroll" creates a real `enrollment` row, the same
// one ChurnPredictionJob already reads.

import { useEffect, useState } from "react";
import Link from "next/link";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  inactive: "bg-gray-100 text-gray-500",
  suspended: "bg-red-100 text-red-700",
};

interface Student {
  id: string;
  user_id: string;
  display_name: string;
  email: string;
  status: string;
  journey_phase: string;
  experience_level: string;
  yoga_style_preference: string[] | null;
  enrolled_at: string;
  first_class_at: string | null;
  last_class_at: string | null;
  has_active_enrollment: boolean;
}

function AddStudentForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ displayName: "", email: "", password: "", experienceLevel: "beginner" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create student");
      setForm({ displayName: "", email: "", password: "", experienceLevel: "beginner" });
      setOpen(false);
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create student");
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
        + Add Student
      </button>
    );
  }

  return (
    <div className="bg-white border rounded-lg p-4 space-y-3 mb-6">
      <h2 className="font-semibold text-gray-900">Enroll a new student</h2>
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className="grid grid-cols-2 gap-3">
        <input placeholder="Full name" value={form.displayName} onChange={e => setForm({ ...form, displayName: e.target.value })} className="border rounded px-3 py-2 text-sm" />
        <input placeholder="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="border rounded px-3 py-2 text-sm" />
        <input placeholder="Password" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="border rounded px-3 py-2 text-sm" />
        <select value={form.experienceLevel} onChange={e => setForm({ ...form, experienceLevel: e.target.value })} className="border rounded px-3 py-2 text-sm">
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
      </div>
      <div className="flex gap-2">
        <button onClick={submit} disabled={saving} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
          {saving ? "Creating…" : "Create student account"}
        </button>
        <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
      </div>
    </div>
  );
}

function EnrollButton({ studentId, hasActive, onEnrolled }: { studentId: string; hasActive: boolean; onEnrolled: () => void }) {
  const [busy, setBusy] = useState(false);
  if (hasActive) return <span className="text-xs text-green-700">Enrolled</span>;
  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch(`/api/admin/students/${studentId}/enroll`, { method: "POST" });
        setBusy(false);
        onEnrolled();
      }}
      className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700 disabled:opacity-50"
    >
      {busy ? "Enrolling…" : "Enroll"}
    </button>
  );
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const load = () => fetch("/api/admin/students", { cache: "no-store" })
    .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setStudents(d.students); })
    .catch(e => setError(e.message));

  useEffect(() => { void load(); }, []);

  const visible = students.filter(s => {
    const matchSearch = !search || s.display_name.toLowerCase().includes(search.toLowerCase()) || s.email.includes(search);
    const matchStatus = statusFilter === "all" || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const kpi = [
    { label: "Active Students", value: students.filter(s => s.status === "active").length, color: "text-green-600" },
    { label: "Enrolled", value: students.filter(s => s.has_active_enrollment).length, color: "text-indigo-600" },
    { label: "Not Enrolled", value: students.filter(s => !s.has_active_enrollment).length, color: "text-amber-600" },
    { label: "Total", value: students.length, color: "text-gray-700" },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Students</h1>
          <p className="text-sm text-gray-500 mt-0.5">Real student accounts and enrollment status.</p>
        </div>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700 mb-4">{error}</div>}

      <div className="grid grid-cols-4 gap-4 mb-6">
        {kpi.map(k => (
          <div key={k.label} className="bg-white border rounded-lg p-4">
            <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
            <div className="text-sm text-gray-500">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="mb-4"><AddStudentForm onCreated={load} /></div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <input
          type="text" placeholder="Search by name or email..." value={search}
          onChange={e => setSearch(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm w-64"
        />
        <div className="flex gap-2">
          {["all", "active", "inactive", "suspended"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs rounded-full font-medium capitalize transition-colors ${statusFilter === s ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {visible.map(s => (
          <div key={s.id} className="bg-white border rounded-lg p-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-700 flex-shrink-0">
                {s.display_name.split(" ").map(n => n[0]).join("").slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link href={`/admin/students/${s.id}`} className="font-medium text-gray-900 hover:text-indigo-600">
                    {s.display_name}
                  </Link>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[s.status] ?? "bg-gray-100 text-gray-600"}`}>{s.status}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">{s.experience_level}</span>
                </div>
                <div className="text-sm text-gray-500 mt-0.5">
                  {s.email}{s.yoga_style_preference?.length ? ` · ${s.yoga_style_preference.join(", ")}` : ""}
                </div>
              </div>
              <div className="flex-shrink-0"><EnrollButton studentId={s.id} hasActive={s.has_active_enrollment} onEnrolled={load} /></div>
            </div>
          </div>
        ))}
        {visible.length === 0 && (
          <div className="text-center py-12 text-gray-400">No students yet — add one above.</div>
        )}
      </div>
    </div>
  );
}
