"use client";
// Marketing / Content Calendar -- real CRUD over content_calendar_entry
// (src/domain/marketing/db-schema.sql). Prior audit: schema existed with
// 0 rows, no admin UI. This is the first real read/write surface for it.
// Distinct from /admin/social/calendar, which only aggregates social_post
// rows for the social scheduler -- this covers every content type the
// table supports (social_post, email, sms, blog, banner, event, workshop,
// retreat), optionally linked to a campaign_brief.
//
// Grid view + drag-drop reschedule + conflict detection added 2026-09-07
// (was the documented gap: "No month/week date-grid view... No drag-and-
// drop reschedule... No cross-channel conflict/overlap detection"). Reuses
// the same month-grid math /admin/social/calendar already established.

import { useEffect, useMemo, useState } from "react";

function monthGrid(year: number, month: number) {
  const first = new Date(Date.UTC(year, month, 1));
  const startWeekday = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (number | null)[] = Array(startWeekday).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const CONTENT_TYPES = ["social_post", "email", "sms", "blog", "banner", "event", "workshop", "retreat"];
const CHANNELS = [
  "facebook", "instagram", "linkedin", "x_twitter", "threads", "tiktok", "youtube", "pinterest",
  "reddit", "bluesky", "mastodon", "telegram", "discord", "whatsapp_business", "email", "sms", "push", "banner", "blog",
];

interface Entry {
  id: string;
  title: string;
  contentType: string;
  channel: string | null;
  scheduledAt: string;
  status: string;
  briefId: string | null;
  briefName: string | null;
  assignedTo: string | null;
  tags: string[];
  notes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface Brief { id: string; name: string }
interface StatusCode { code: string; label: string }

const STATUS_STYLE: Record<string, string> = {
  planned: "bg-gray-800 text-gray-300",
  in_production: "bg-blue-900 text-blue-300",
  ready: "bg-amber-900 text-amber-300",
  scheduled: "bg-purple-900 text-purple-300",
  published: "bg-green-900 text-green-300",
  cancelled: "bg-red-900 text-red-300",
};

const emptyForm = {
  title: "", contentType: "social_post", channel: "", scheduledAt: "",
  status: "planned", briefId: "", assignedTo: "", tags: "", notes: "",
};

export default function MarketingCalendarPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [statuses, setStatuses] = useState<StatusCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    fetch("/api/admin/marketing-calendar", { cache: "no-store" })
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Failed to load calendar.");
        setEntries(d.entries);
        setBriefs(d.briefs);
        setStatuses(d.statuses);
        setError("");
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(e: Entry) {
    setEditingId(e.id);
    setForm({
      title: e.title,
      contentType: e.contentType,
      channel: e.channel ?? "",
      scheduledAt: e.scheduledAt ? new Date(e.scheduledAt).toISOString().slice(0, 16) : "",
      status: e.status,
      briefId: e.briefId ?? "",
      assignedTo: e.assignedTo ?? "",
      tags: e.tags.join(", "),
      notes: e.notes ?? "",
    });
    setShowForm(true);
  }

  async function save() {
    if (!form.title.trim() || !form.scheduledAt) { setError("Title and scheduled date/time are required."); return; }
    setSaving(true);
    setError("");
    const payload = {
      title: form.title.trim(),
      contentType: form.contentType,
      channel: form.channel || null,
      scheduledAt: new Date(form.scheduledAt).toISOString(),
      status: form.status,
      briefId: form.briefId || null,
      assignedTo: form.assignedTo || null,
      tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
      notes: form.notes || null,
    };
    try {
      const url = editingId ? `/api/admin/marketing-calendar/${editingId}` : "/api/admin/marketing-calendar";
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Save failed.");
      setShowForm(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this calendar entry?")) return;
    const res = await fetch(`/api/admin/marketing-calendar/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  // Real drag-drop reschedule -- PATCH sets channel/briefId/etc via plain
  // (non-COALESCE) assignment server-side, so this must resend the entry's
  // full current field set with only scheduledAt changed, or a drag-only
  // reschedule would silently null out channel/brief/assignee/tags/notes.
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);
  const [rescheduling, setRescheduling] = useState<string | null>(null);
  async function rescheduleTo(entry: Entry, year: number, month: number, day: number) {
    const original = new Date(entry.scheduledAt);
    const next = new Date(Date.UTC(year, month, day, original.getUTCHours(), original.getUTCMinutes()));
    setRescheduling(entry.id);
    await fetch(`/api/admin/marketing-calendar/${entry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: entry.title, contentType: entry.contentType, channel: entry.channel,
        scheduledAt: next.toISOString(), status: entry.status, briefId: entry.briefId,
        assignedTo: entry.assignedTo, tags: entry.tags, notes: entry.notes,
      }),
    });
    setRescheduling(null);
    load();
  }

  const filtered = statusFilter === "ALL" ? entries : entries.filter(e => e.status === statusFilter);

  const [view, setView] = useState<"list" | "grid">("list");
  const now = new Date();
  const [gridYear, setGridYear] = useState(now.getUTCFullYear());
  const [gridMonth, setGridMonth] = useState(now.getUTCMonth());
  const cells = useMemo(() => monthGrid(gridYear, gridMonth), [gridYear, gridMonth]);
  const monthLabel = new Date(Date.UTC(gridYear, gridMonth, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

  const byDay = useMemo(() => {
    const map: Record<number, Entry[]> = {};
    for (const e of filtered) {
      const d = new Date(e.scheduledAt);
      if (d.getUTCFullYear() === gridYear && d.getUTCMonth() === gridMonth) {
        (map[d.getUTCDate()] ??= []).push(e);
      }
    }
    return map;
  }, [filtered, gridYear, gridMonth]);

  // Conflict = 2+ entries the same day sharing the same non-null channel --
  // real overlap detection, not a fabricated "no conflicts" placeholder.
  function conflictIds(dayEntries: Entry[]): Set<string> {
    const byChannel: Record<string, Entry[]> = {};
    for (const e of dayEntries) { if (e.channel) (byChannel[e.channel] ??= []).push(e); }
    const conflicting = new Set<string>();
    for (const group of Object.values(byChannel)) {
      if (group.length > 1) for (const e of group) conflicting.add(e.id);
    }
    return conflicting;
  }

  function shiftGridMonth(delta: number) {
    let m = gridMonth + delta, y = gridYear;
    if (m < 0) { m = 11; y -= 1; } else if (m > 11) { m = 0; y += 1; }
    setGridMonth(m); setGridYear(y);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold">Marketing / Content Calendar</h1>
            <p className="text-gray-400 text-sm mt-0.5">
              Unified editorial calendar across social, email, SMS, blog, banner, event, workshop and retreat content.
            </p>
          </div>
          <button onClick={openCreate}
            className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors">
            + New Entry
          </button>
        </div>

        {error && <div className="rounded-xl border border-red-800 bg-red-950/50 p-3 text-sm text-red-300">{error}</div>}

        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setStatusFilter("ALL")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${statusFilter === "ALL" ? "bg-green-700 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"}`}>
              All ({entries.length})
            </button>
            {statuses.map(s => (
              <button key={s.code} onClick={() => setStatusFilter(s.code)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${statusFilter === s.code ? "bg-green-700 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"}`}>
                {s.label} ({entries.filter(e => e.status === s.code).length})
              </button>
            ))}
          </div>
          <div className="flex gap-1 bg-gray-900 rounded-full p-1">
            <button onClick={() => setView("list")} className={`px-3 py-1 rounded-full text-xs font-medium ${view === "list" ? "bg-gray-700 text-white" : "text-gray-400"}`}>List</button>
            <button onClick={() => setView("grid")} className={`px-3 py-1 rounded-full text-xs font-medium ${view === "grid" ? "bg-gray-700 text-white" : "text-gray-400"}`}>Grid</button>
          </div>
        </div>

        {view === "grid" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <button onClick={() => shiftGridMonth(-1)} className="px-2 py-1 text-sm rounded border border-gray-700 hover:bg-gray-800">&larr;</button>
              <span className="text-sm font-medium">{monthLabel}</span>
              <button onClick={() => shiftGridMonth(1)} className="px-2 py-1 text-sm rounded border border-gray-700 hover:bg-gray-800">&rarr;</button>
            </div>
            <div className="grid grid-cols-7 gap-px bg-gray-800 border border-gray-800 rounded-xl overflow-hidden">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
                <div key={d} className="bg-gray-900 px-2 py-1.5 text-xs font-medium text-gray-400 text-center">{d}</div>
              ))}
              {cells.map((day, i) => {
                const dayEntries = day ? (byDay[day] ?? []) : [];
                const conflicts = conflictIds(dayEntries);
                return (
                  <div
                    key={i}
                    className={`bg-gray-950 min-h-[100px] p-1.5 align-top ${dragOverDay === day ? "ring-2 ring-inset ring-green-500" : ""}`}
                    onDragOver={e => { if (day) { e.preventDefault(); setDragOverDay(day); } }}
                    onDragLeave={() => setDragOverDay(null)}
                    onDrop={e => {
                      e.preventDefault();
                      setDragOverDay(null);
                      if (!day) return;
                      const entryId = e.dataTransfer.getData("text/plain");
                      const entry = entries.find(x => x.id === entryId);
                      if (entry) rescheduleTo(entry, gridYear, gridMonth, day);
                    }}
                  >
                    {day && (
                      <>
                        <p className="text-xs text-gray-500 mb-1">{day}</p>
                        <div className="space-y-1">
                          {dayEntries.slice(0, 4).map(e => (
                            <div
                              key={e.id}
                              draggable
                              onDragStart={ev => ev.dataTransfer.setData("text/plain", e.id)}
                              title={conflicts.has(e.id) ? `Channel conflict: another ${e.channel} item is scheduled the same day` : e.title}
                              className={`flex items-center gap-1 text-[10px] rounded px-1 py-0.5 truncate cursor-move ${
                                rescheduling === e.id ? "opacity-40" : ""
                              } ${conflicts.has(e.id) ? "bg-red-950 ring-1 ring-red-600 text-red-200" : "bg-gray-800 hover:bg-indigo-950 text-gray-200"}`}
                            >
                              {conflicts.has(e.id) && <span className="shrink-0">⚠</span>}
                              <span className="truncate">{e.title}</span>
                            </div>
                          ))}
                          {dayEntries.length > 4 && <p className="text-[10px] text-gray-500">+{dayEntries.length - 4} more</p>}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-gray-500">Drag any entry onto a different day to reschedule it (keeps its original time-of-day). Red items share a channel with another entry the same day.</p>
          </div>
        )}

        {view === "list" && (loading ? (
          <div className="text-center py-12 text-gray-500 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500 text-sm border border-dashed border-gray-800 rounded-2xl">
            {entries.length === 0
              ? "No calendar entries yet. This table exists with real schema but has never been populated -- create the first entry to get started."
              : "No entries match this filter."}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(e => (
              <div key={e.id} className="bg-gray-900 rounded-2xl p-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold truncate">{e.title}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs shrink-0 ${STATUS_STYLE[e.status] ?? "bg-gray-800 text-gray-300"}`}>
                      {statuses.find(s => s.code === e.status)?.label ?? e.status}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs bg-gray-800 text-gray-400 shrink-0 capitalize">
                      {e.contentType.replace("_", " ")}
                    </span>
                    {e.channel && <span className="px-2 py-0.5 rounded-full text-xs bg-gray-800 text-gray-400 shrink-0">{e.channel}</span>}
                  </div>
                  <p className="text-sm text-gray-400 mt-1">
                    {new Date(e.scheduledAt).toLocaleString()}
                    {e.briefName && <> · campaign: {e.briefName}</>}
                    {e.assignedTo && <> · assigned: {e.assignedTo}</>}
                    {e.tags.length > 0 && <> · {e.tags.join(", ")}</>}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => openEdit(e)} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs transition-colors">Edit</button>
                  <button onClick={() => remove(e.id)} className="px-3 py-1.5 bg-gray-800 hover:bg-red-900 rounded-lg text-xs transition-colors">Delete</button>
                </div>
              </div>
            ))}
          </div>
        ))}

        {showForm && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={() => setShowForm(false)}>
            <div className="bg-gray-900 rounded-2xl p-6 max-w-lg w-full space-y-3 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <h2 className="font-semibold text-lg">{editingId ? "Edit Calendar Entry" : "New Calendar Entry"}</h2>

              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Title"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500" />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Content Type</label>
                  <select value={form.contentType} onChange={e => setForm(f => ({ ...f, contentType: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm">
                    {CONTENT_TYPES.map(t => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Channel (optional)</label>
                  <select value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm">
                    <option value="">—</option>
                    {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Scheduled at</label>
                  <input type="datetime-local" value={form.scheduledAt}
                    onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm">
                    {statuses.map(s => <option key={s.code} value={s.code}>{s.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">Campaign brief (optional)</label>
                <select value={form.briefId} onChange={e => setForm(f => ({ ...f, briefId: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm">
                  <option value="">— none —</option>
                  {briefs.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                {briefs.length === 0 && <p className="text-xs text-gray-500 mt-1">No campaign briefs exist yet.</p>}
              </div>

              <input value={form.assignedTo} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))}
                placeholder="Assigned to (name or email, optional)"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 text-sm" />

              <input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                placeholder="Tags, comma-separated (optional)"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 text-sm" />

              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Notes (optional)" rows={3}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 text-sm resize-none" />

              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm transition-colors">Cancel</button>
                <button onClick={save} disabled={saving}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors">
                  {saving ? "Saving…" : editingId ? "Save Changes" : "Create Entry"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
