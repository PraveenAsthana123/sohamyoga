"use client";
// Teacher onboarding and directory — real data from teacher_profile
// (migration 075), created via POST /api/admin/teachers (real ASP.NET
// Identity account + Postgres profile). Previously this page rendered a
// hardcoded DEMO_TEACHERS array with fabricated ratings, class/student
// counts, and Frappe HR / Cal.com / Moodle / Paperless-ngx integration
// badges — none of those systems are deployed, so those fields are not
// reintroduced here.

import { useEffect, useState } from "react";
import Link from "next/link";

const STATUS_COLORS: Record<string, string> = {
  active:     "bg-green-100 text-green-700",
  trainee:    "bg-blue-100 text-blue-700",
  on_leave:   "bg-amber-100 text-amber-700",
  retired:    "bg-gray-100 text-gray-500",
  terminated: "bg-red-100 text-red-700",
};

interface Teacher {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  bio: string | null;
  status: string;
  contract_type: string;
  specializations: string[];
  hire_date: string;
  created_at: string;
}

function AddTeacherForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", specializations: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          specializations: form.specializations.split(",").map(s => s.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create teacher");
      setForm({ firstName: "", lastName: "", email: "", password: "", specializations: "" });
      setOpen(false);
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create teacher");
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
        + Add Teacher
      </button>
    );
  }

  return (
    <div className="bg-white border rounded-lg p-4 space-y-3 mb-6">
      <h2 className="font-semibold text-gray-900">Onboard a new teacher</h2>
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className="grid grid-cols-2 gap-3">
        <input placeholder="First name" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} className="border rounded px-3 py-2 text-sm" />
        <input placeholder="Last name" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} className="border rounded px-3 py-2 text-sm" />
        <input placeholder="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="border rounded px-3 py-2 text-sm" />
        <input placeholder="Password" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="border rounded px-3 py-2 text-sm" />
        <input placeholder="Specializations (comma-separated)" value={form.specializations} onChange={e => setForm({ ...form, specializations: e.target.value })} className="col-span-2 border rounded px-3 py-2 text-sm" />
      </div>
      <div className="flex gap-2">
        <button onClick={submit} disabled={saving} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
          {saving ? "Creating…" : "Create teacher account"}
        </button>
        <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
      </div>
    </div>
  );
}

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const load = () => fetch("/api/admin/teachers", { cache: "no-store" })
    .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setTeachers(d.teachers); })
    .catch(e => setError(e.message));

  useEffect(() => { void load(); }, []);

  const visible = teachers.filter(t => {
    const name = `${t.first_name} ${t.last_name}`;
    const matchSearch = !search || name.toLowerCase().includes(search.toLowerCase()) || t.email.includes(search);
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const kpi = [
    { label: "Active Teachers", value: teachers.filter(t => t.status === "active").length, color: "text-green-600" },
    { label: "Trainees", value: teachers.filter(t => t.status === "trainee").length, color: "text-blue-600" },
    { label: "On Leave", value: teachers.filter(t => t.status === "on_leave").length, color: "text-amber-600" },
    { label: "Total", value: teachers.length, color: "text-gray-700" },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Teachers</h1>
          <p className="text-sm text-gray-500 mt-0.5">Real onboarded teacher accounts — creating one here creates an actual login.</p>
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

      <div className="mb-4"><AddTeacherForm onCreated={load} /></div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <input
          type="text" placeholder="Search by name or email..." value={search}
          onChange={e => setSearch(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm w-64"
        />
        <div className="flex gap-2">
          {["all", "active", "trainee", "on_leave", "retired"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs rounded-full font-medium capitalize transition-colors ${statusFilter === s ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {s.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {visible.map(t => (
          <div key={t.id} className="bg-white border rounded-lg p-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-700 flex-shrink-0">
                {t.first_name[0]}{t.last_name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link href={`/admin/teachers/${t.id}`} className="font-medium text-gray-900 hover:text-indigo-600">
                    {t.first_name} {t.last_name}
                  </Link>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[t.status]}`}>{t.status}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{t.contract_type}</span>
                </div>
                <div className="text-sm text-gray-500 mt-0.5">{t.email}{t.specializations.length ? ` · ${t.specializations.join(", ")}` : ""}</div>
              </div>
              <div className="text-xs text-gray-400 flex-shrink-0">Hired {new Date(t.hire_date).toLocaleDateString()}</div>
            </div>
          </div>
        ))}
        {visible.length === 0 && (
          <div className="text-center py-12 text-gray-400">No teachers yet — onboard one above.</div>
        )}
      </div>
    </div>
  );
}
