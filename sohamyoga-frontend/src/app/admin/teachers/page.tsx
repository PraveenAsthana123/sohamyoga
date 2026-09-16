"use client";

import { useEffect, useState, useCallback } from "react";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  trainee: "bg-blue-100 text-blue-700",
  on_leave: "bg-amber-100 text-amber-700",
  retired: "bg-gray-100 text-gray-500",
  terminated: "bg-red-100 text-red-700",
};

interface Teacher {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  bio: string | null;
  status: string;
  contract_type: string;
  specializations: string[];
  hire_date: string;
  avg_rating: number;
  rating_count: number;
  cert_count: number;
  session_count: number;
}

interface Kpi {
  total: number;
  active: number;
  avg_rating: number;
  certs_issued: number;
}

interface RatingRow {
  teacher_name: string;
  rating_count: number;
  avg_rating: number;
  latest_at: string;
}

interface CertRow {
  id: string;
  teacher_id: string;
  teacher_name: string;
  cert_type: string;
  issued_at: string;
  expires_at: string | null;
  status: string;
}

const TABS = ['Overview', 'Teacher List', 'Ratings', 'Certifications', 'Schedule'] as const;
type Tab = typeof TABS[number];

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function Stars({ n }: { n: number }) {
  const rounded = Math.round(n);
  return <span className="text-amber-500">{'★'.repeat(rounded)}{'☆'.repeat(5 - rounded)}</span>;
}

function AddTeacherForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", specializations: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/admin/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, specializations: form.specializations.split(",").map(s => s.trim()).filter(Boolean) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create teacher");
      setForm({ firstName: "", lastName: "", email: "", password: "", specializations: "" });
      setOpen(false);
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return (
    <button onClick={() => setOpen(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
      + Add Teacher
    </button>
  );

  return (
    <div className="bg-white border rounded-lg p-4 space-y-3 mb-4">
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
  const [tab, setTab] = useState<Tab>('Overview');
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [kpi, setKpi] = useState<Kpi | null>(null);
  const [ratings, setRatings] = useState<RatingRow[]>([]);
  const [certifications, setCertifications] = useState<CertRow[]>([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/admin/teachers", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setTeachers(d.teachers ?? []);
      setKpi(d.kpi ?? null);
      setRatings(d.ratings ?? []);
      setCertifications(d.certifications ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const updateStatus = useCallback(async (id: string, status: string) => {
    setUpdating(id);
    try {
      const res = await fetch("/api/admin/teachers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setUpdating(null);
    }
  }, [load]);

  const visible = teachers.filter(t => {
    const name = `${t.first_name} ${t.last_name}`;
    const matchSearch = !search || name.toLowerCase().includes(search.toLowerCase()) || t.email.includes(search);
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Teacher Management</h1>
        <p className="text-sm text-gray-500 mt-1">teacher_profile with ratings, certifications, and schedule data.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError("")} className="font-medium ml-4">Dismiss</button>
        </div>
      )}

      {kpi && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Total Teachers" value={kpi.total} />
          <KpiCard label="Active" value={kpi.active} />
          <KpiCard label="Avg Rating" value={`${Number(kpi.avg_rating).toFixed(1)} / 5`} />
          <KpiCard label="Certifications Issued" value={kpi.certs_issued} />
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="flex gap-1 p-3 border-b border-gray-100 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                tab === t ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'Overview' && (
          <div className="p-6 space-y-4">
            <h3 className="text-base font-semibold text-gray-800 mb-2">Teachers by Status</h3>
            {['active', 'trainee', 'on_leave', 'retired', 'terminated'].map(s => {
              const n = teachers.filter(t => t.status === s).length;
              return (
                <div key={s} className="flex items-center gap-3">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium w-24 text-center ${STATUS_COLORS[s] ?? 'bg-gray-100 text-gray-600'}`}>{s.replace('_', ' ')}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${teachers.length ? (n / teachers.length) * 100 : 0}%` }} />
                  </div>
                  <span className="text-sm text-gray-700 w-6 text-right">{n}</span>
                </div>
              );
            })}
            {teachers.length === 0 && <p className="text-gray-400 text-sm">No teachers onboarded yet.</p>}
          </div>
        )}

        {tab === 'Teacher List' && (
          <>
            <div className="p-4 border-b border-gray-50 flex gap-3 flex-wrap items-center">
              <input
                type="text" placeholder="Search name or email..." value={search}
                onChange={e => setSearch(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 w-64"
              />
              {["all", "active", "trainee", "on_leave", "retired"].map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 text-xs rounded-full font-medium capitalize ${statusFilter === s ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  {s.replace("_", " ")}
                </button>
              ))}
              <AddTeacherForm onCreated={load} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-4">
              {visible.map(t => (
                <div key={t.id} className="border border-gray-100 rounded-xl p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-700 flex-shrink-0">
                      {t.first_name[0]}{t.last_name[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{t.first_name} {t.last_name}</p>
                      <p className="text-xs text-gray-400 truncate">{t.email}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[t.status]}`}>{t.status}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{t.contract_type}</span>
                    {t.specializations.slice(0, 2).map(sp => (
                      <span key={sp} className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{sp}</span>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-center mb-3">
                    <div><div className="font-semibold text-gray-800">{Number(t.avg_rating).toFixed(1)}</div><div className="text-gray-400">rating</div></div>
                    <div><div className="font-semibold text-gray-800">{t.cert_count}</div><div className="text-gray-400">certs</div></div>
                    <div><div className="font-semibold text-gray-800">{t.session_count}</div><div className="text-gray-400">upcoming</div></div>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {['active', 'on_leave', 'terminated'].filter(s => s !== t.status).map(s => (
                      <button key={s} disabled={updating === t.id} onClick={() => updateStatus(t.id, s)}
                        className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                        {updating === t.id ? '...' : s.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {visible.length === 0 && <div className="col-span-3 text-center py-12 text-gray-400">No teachers found.</div>}
            </div>
          </>
        )}

        {tab === 'Ratings' && (
          <div className="overflow-x-auto">
            {ratings.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No ratings yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 text-xs border-b border-gray-100">
                    <th className="px-4 py-3 font-medium">Teacher</th>
                    <th className="px-4 py-3 font-medium">Avg Rating</th>
                    <th className="px-4 py-3 font-medium">Reviews</th>
                    <th className="px-4 py-3 font-medium">Latest Review</th>
                  </tr>
                </thead>
                <tbody>
                  {ratings.map(r => (
                    <tr key={r.teacher_name} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{r.teacher_name}</td>
                      <td className="px-4 py-3"><Stars n={Math.round(Number(r.avg_rating))} /> <span className="text-xs text-gray-500 ml-1">{Number(r.avg_rating).toFixed(1)}</span></td>
                      <td className="px-4 py-3 text-gray-600">{r.rating_count}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{new Date(r.latest_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'Certifications' && (
          <div className="overflow-x-auto">
            {certifications.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No certifications issued yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 text-xs border-b border-gray-100">
                    <th className="px-4 py-3 font-medium">Teacher</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Issued</th>
                    <th className="px-4 py-3 font-medium">Expires</th>
                  </tr>
                </thead>
                <tbody>
                  {certifications.map(c => (
                    <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{c.teacher_name}</td>
                      <td className="px-4 py-3 text-gray-600">{c.cert_type}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{c.status}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{new Date(c.issued_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{c.expires_at ? new Date(c.expires_at).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'Schedule' && (
          <div className="p-6 text-sm text-gray-500">
            <p>Teacher schedules are managed via <span className="font-mono text-xs bg-gray-100 px-1 rounded">teacher_schedule</span> and <span className="font-mono text-xs bg-gray-100 px-1 rounded">class_session</span> tables.</p>
            <p className="mt-2">Go to <strong>Admin › Classes</strong> to view and manage upcoming class sessions by teacher.</p>
          </div>
        )}
      </div>
    </div>
  );
}
