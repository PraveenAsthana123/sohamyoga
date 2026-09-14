"use client";
// Customer Occasions — admin-level birthday/anniversary/festival/custom
// wish-card messaging. Admin-level only (no customer self-service
// surface, per explicit request). Real automated scan runs daily via
// the 'occasion-wish-scan' cron job (OccasionWishJob) -- this page also
// lets an admin trigger it on demand via the existing generic
// /api/admin/demo-hub/run-job endpoint, manage the festival calendar,
// and send a real one-off custom wish card. No LLM: every wish is a
// real standard template (WISH_TEMPLATES) or a real admin-typed
// message, never model-generated.

import { useEffect, useState } from "react";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700", SENT: "bg-green-100 text-green-700",
  OPENED: "bg-blue-100 text-blue-700", FAILED: "bg-red-100 text-red-700",
};
const OCCASION_ICONS: Record<string, string> = { birthday: "🎂", member_anniversary: "🌿", festival: "🪔", custom: "✉️" };

const TABS = ["Overview", "Festival Calendar", "Send Custom Wish", "Governance"] as const;
type Tab = typeof TABS[number];

interface OverviewData {
  kpis: { total: string; sent: string; pending: string; failed: string; with_dob: string; with_country: string };
  byOccasion: Record<string, number>;
  recent: Array<{ id: string; occasion: string; festival_code: string | null; title: string; channel: string; status: string; created_at: string; display_name: string }>;
  festivals: Array<{ id: string; code: string; name: string; occasion_date: string; country: string | null; is_active: boolean }>;
}
interface StudentOption { id: string; display_name: string; email: string }

function Chip({ label, colorClass }: { label: string; colorClass: string }) {
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>{label}</span>;
}

function OverviewTab({ data, onRunScan, running, runResult }: { data: OverviewData | null; onRunScan: () => void; running: boolean; runResult: string }) {
  if (!data) return <div className="text-center text-sm text-gray-400 py-8">Loading…</div>;
  const stats = [
    { label: "Total wish cards", value: data.kpis.total },
    { label: "Sent (enqueued for real dispatch)", value: data.kpis.sent },
    { label: "Pending", value: data.kpis.pending },
    { label: "Failed", value: data.kpis.failed },
    { label: "Students with real DOB on file", value: data.kpis.with_dob },
    { label: "Students with real country on file", value: data.kpis.with_country },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-lg p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-gray-900">{s.value}</div>
            <div className="text-xs font-medium text-gray-700 mt-1">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <h3 className="font-semibold text-gray-800 mb-2">Real daily scan</h3>
        <p className="text-sm text-gray-500 mb-4">Runs automatically at 05:30 UTC (cron job <code className="bg-gray-100 px-1 rounded">occasion-wish-scan</code>). Trigger it on demand below — this runs the exact same real job against the real database.</p>
        <button onClick={onRunScan} disabled={running} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md disabled:opacity-50">{running ? "Scanning…" : "Run Scan Now"}</button>
        {runResult && <p className="text-sm text-gray-600 mt-3">{runResult}</p>}
      </div>
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <h3 className="font-semibold text-gray-800 mb-4">Recent wish cards</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-gray-500 uppercase border-b"><th className="py-2">Student</th><th>Occasion</th><th>Title</th><th>Channel</th><th>Status</th><th>When</th></tr></thead>
            <tbody>
              {data.recent.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-gray-400">No wish cards yet.</td></tr>}
              {data.recent.map((r) => (
                <tr key={r.id} className="border-b border-gray-100">
                  <td className="py-2">{r.display_name}</td>
                  <td>{OCCASION_ICONS[r.occasion] ?? ""} {r.occasion}{r.festival_code ? ` (${r.festival_code})` : ""}</td>
                  <td>{r.title}</td>
                  <td>{r.channel}</td>
                  <td><Chip label={r.status} colorClass={STATUS_COLORS[r.status] ?? "bg-gray-100 text-gray-600"} /></td>
                  <td>{new Date(r.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FestivalTab({ data, reload }: { data: OverviewData | null; reload: () => void }) {
  const [form, setForm] = useState({ code: "", name: "", occasionDate: "", country: "" });
  const [error, setError] = useState("");
  const submit = async () => {
    if (!form.code.trim() || !form.name.trim() || !form.occasionDate) { setError("code, name, and date are required."); return; }
    setError("");
    const res = await fetch("/api/admin/occasions/festivals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: form.code, name: form.name, occasionDate: form.occasionDate, country: form.country || null }) });
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || `HTTP ${res.status}`); return; }
    setForm({ code: "", name: "", occasionDate: "", country: "" });
    reload();
  };
  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <h3 className="font-semibold text-gray-800 mb-4">Festival calendar (real, admin-managed)</h3>
        <p className="text-sm text-gray-500 mb-4">Lunar/shifting festivals (Diwali, Eid, etc.) are dated per real calendar year at entry time — not computed automatically, must be re-added each year.</p>
        <table className="w-full text-sm mb-4">
          <thead><tr className="text-left text-xs text-gray-500 uppercase border-b"><th className="py-2">Code</th><th>Name</th><th>Date</th><th>Country</th><th>Active</th></tr></thead>
          <tbody>
            {(data?.festivals ?? []).map((f) => (
              <tr key={f.id} className="border-b border-gray-100">
                <td className="py-2">{f.code}</td><td>{f.name}</td><td>{new Date(f.occasion_date).toLocaleDateString()}</td>
                <td>{f.country ?? "Global"}</td><td><Chip label={f.is_active ? "active" : "inactive"} colorClass={f.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <input className="border rounded px-2 py-1 text-sm" placeholder="code (e.g. diwali_2027)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <input className="border rounded px-2 py-1 text-sm" placeholder="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="border rounded px-2 py-1 text-sm" type="date" value={form.occasionDate} onChange={(e) => setForm({ ...form, occasionDate: e.target.value })} />
          <input className="border rounded px-2 py-1 text-sm" placeholder="country (blank = global)" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
        </div>
        <button onClick={submit} className="mt-3 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md">Add Festival</button>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </div>
    </div>
  );
}

function SendCustomTab({ reload }: { reload: () => void }) {
  const [search, setSearch] = useState("");
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [studentId, setStudentId] = useState("");
  const [channel, setChannel] = useState<"email" | "sms" | "whatsapp" | "push" | "in_app">("push");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    fetch("/api/admin/students").then((r) => (r.ok ? r.json() : { students: [] })).then((d) => setStudents(d.students || [])).catch(() => {});
  }, []);

  const filtered = search.trim() ? students.filter((s) => `${s.display_name} ${s.email}`.toLowerCase().includes(search.toLowerCase())).slice(0, 10) : [];

  const submit = async () => {
    if (!studentId) { setError("Select a student first."); return; }
    if (!title.trim() || !message.trim()) { setError("Title and message are required."); return; }
    setError(""); setSent(false);
    const res = await fetch("/api/admin/occasions/custom", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studentId, channel, title, message }) });
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || `HTTP ${res.status}`); return; }
    setSent(true); setTitle(""); setMessage(""); reload();
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm space-y-4">
      <h3 className="font-semibold text-gray-800">Send a real custom wish card</h3>
      <p className="text-sm text-gray-500">Never a template, never model-generated — enqueues a real notification_queue row through the same dispatch machinery as the automated scan.</p>
      <div>
        <label className="text-sm text-gray-600 block mb-1">Find student</label>
        <input className="border rounded px-2 py-1 text-sm w-full" placeholder="Search by name or email…" value={search} onChange={(e) => setSearch(e.target.value)} />
        {filtered.length > 0 && (
          <div className="border rounded mt-1 max-h-40 overflow-y-auto">
            {filtered.map((s) => (
              <div key={s.id} className={`px-2 py-1 text-sm cursor-pointer hover:bg-gray-50 ${studentId === s.id ? "bg-indigo-50" : ""}`} onClick={() => { setStudentId(s.id); setSearch(`${s.display_name} <${s.email}>`); }}>{s.display_name} — {s.email}</div>
            ))}
          </div>
        )}
      </div>
      <div>
        <label className="text-sm text-gray-600 block mb-1">Channel</label>
        <select className="border rounded px-2 py-1 text-sm" value={channel} onChange={(e) => setChannel(e.target.value as typeof channel)}>
          <option value="push">Push (real delivery if subscribed)</option>
          <option value="in_app">In-App (real delivery)</option>
          <option value="email">Email (attempts real Novu, may fail if unconfigured)</option>
          <option value="sms">SMS (attempts real Novu, may fail if unconfigured)</option>
          <option value="whatsapp">WhatsApp (attempts real Novu, may fail if unconfigured)</option>
        </select>
      </div>
      <div>
        <label className="text-sm text-gray-600 block mb-1">Title</label>
        <input className="border rounded px-2 py-1 text-sm w-full" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <label className="text-sm text-gray-600 block mb-1">Message</label>
        <textarea className="border rounded px-2 py-1 text-sm w-full" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
      </div>
      <button onClick={submit} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md">Send Wish Card</button>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {sent && <p className="text-sm text-green-600">Logged and enqueued for real dispatch.</p>}
    </div>
  );
}

function GovernanceTab() {
  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <h3 className="font-semibold text-gray-800 mb-2">Data lineage &amp; honesty boundary</h3>
        <p className="text-sm text-gray-600">Real, admin/import-entered fields only: <code className="bg-gray-100 px-1 rounded">student.date_of_birth</code>, <code className="bg-gray-100 px-1 rounded">student.enrolled_at</code>, <code className="bg-gray-100 px-1 rounded">student.country</code>. No LLM composes any occasion message — always <code className="bg-gray-100 px-1 rounded">WISH_TEMPLATES</code> (deterministic) or a real admin-typed custom message.</p>
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
        <strong>Real delivery boundary:</strong> push and in_app channels genuinely deliver through this codebase&apos;s existing real infrastructure (VAPID web-push / customer inbox). Email/SMS/WhatsApp attempt a real call to a self-hosted Novu instance and honestly record failure if it isn&apos;t configured/running — a wish_card &quot;SENT&quot; status means a real send attempt was enqueued, not a confirmed delivery. Same disclosed boundary as every other notification in this codebase.
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <strong>Scope:</strong> admin-level only, per explicit request — no customer self-service surface for this module.
      </div>
    </div>
  );
}

export default function OccasionsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [data, setData] = useState<OverviewData | null>(null);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState("");

  const reload = () => {
    fetch("/api/admin/occasions/overview").then((r) => (r.ok ? r.json() : null)).then(setData).catch(() => {});
  };
  useEffect(() => { reload(); }, []);

  const runScan = async () => {
    setRunning(true); setRunResult("");
    try {
      const res = await fetch("/api/admin/demo-hub/run-job", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "occasion-wish-scan" }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`);
      setRunResult(`Completed in ${d.durationMs}ms — status: ${d.status}.`);
      reload();
    } catch (e) { setRunResult(String(e)); } finally { setRunning(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-xl font-bold text-gray-900">Customer Occasions</h1>
          <p className="text-sm text-gray-500 mt-0.5">Birthday, anniversary, festival (location-based), and custom wish cards — admin-managed, deterministic (no AI-generated messages).</p>
        </div>
      </div>
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="max-w-7xl mx-auto flex gap-1">
          {TABS.map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? "border-indigo-500 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>{tab}</button>
          ))}
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 py-6">
        {activeTab === "Overview" && <OverviewTab data={data} onRunScan={runScan} running={running} runResult={runResult} />}
        {activeTab === "Festival Calendar" && <FestivalTab data={data} reload={reload} />}
        {activeTab === "Send Custom Wish" && <SendCustomTab reload={reload} />}
        {activeTab === "Governance" && <GovernanceTab />}
      </div>
    </div>
  );
}
