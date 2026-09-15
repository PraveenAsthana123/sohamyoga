"use client";
// Audience Segments — admin UI for the real, pre-existing AudienceSegment
// domain + SegmentEvaluator (src/domain/campaign/). Backlog item #5/30:
// the roadmap's original cross-check called this "NOT BUILT", which was
// wrong — a real criteria model, a real criteria-to-SQL evaluator (10
// supported fields, each with a documented real data source), and a real
// /api/crm/segments API all already existed with zero admin UI to use
// them. This page is the missing piece, not a new backend.

import { useEffect, useState } from "react";

const SUPPORTED_FIELDS = [
  "last_active_days", "signup_days_ago", "birthday_month", "preferred_style",
  "class_count", "has_referrals", "membership_plan", "total_spend_cad",
  "pose_score_avg", "challenge_completed",
] as const;
const OPERATORS = ["eq", "ne", "gt", "lt", "gte", "lte"] as const;

interface BuiltInSegment { name: string; count: number; desc: string; computed: boolean }
interface CustomSegment { id: string; name: string; desc: string; computed: boolean; count: number | null }

export default function SegmentsPage() {
  const [builtIn, setBuiltIn] = useState<BuiltInSegment[]>([]);
  const [custom, setCustom] = useState<CustomSegment[]>([]);
  const [form, setForm] = useState({ name: "", description: "", field: "last_active_days" as typeof SUPPORTED_FIELDS[number], operator: "lte" as typeof OPERATORS[number], value: "" });
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");

  const load = () => {
    fetch("/api/crm/segments").then((r) => (r.ok ? r.json() : { segments: [], customSegments: [] }))
      .then((d) => { setBuiltIn(d.segments || []); setCustom(d.customSegments || []); }).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.name.trim() || !form.value.trim()) { setError("name and value are required."); return; }
    setError(""); setWarning("");
    const res = await fetch("/api/crm/segments", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name, description: form.description, logic: "AND", criteria: [{ field: form.field, operator: form.operator, value: isNaN(Number(form.value)) ? form.value : Number(form.value) }] }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setError(d.error || `HTTP ${res.status}`); return; }
    if (d.computeWarning) setWarning(d.computeWarning);
    setForm({ ...form, name: "", description: "", value: "" }); load();
  };

  const recompute = async (segmentId: string) => {
    await fetch("/api/crm/segments", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ segmentId }) });
    load();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-xl font-bold text-gray-900">Audience Segments</h1>
          <p className="text-sm text-gray-500 mt-0.5">Real, computed segments — every count is a live query, never a placeholder. Unsupported criteria fields are rejected, not silently faked.</p>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-3">Built-in real segments</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {builtIn.map((s) => (
              <div key={s.name} className="bg-gray-50 rounded p-3">
                <div className="text-xl font-bold text-gray-900">{s.count}</div>
                <div className="text-sm font-medium text-gray-700">{s.name}</div>
                <div className="text-xs text-gray-500 mt-1">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-3">Create a custom segment</h3>
          <p className="text-xs text-gray-500 mb-3">Supported fields: {SUPPORTED_FIELDS.join(", ")}. Other fields (e.g. &quot;location&quot;) are real, confirmed as having no data source in this codebase — rejected, not faked.</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <input className="border rounded px-2 py-1 text-sm" placeholder="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="border rounded px-2 py-1 text-sm" placeholder="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <select className="border rounded px-2 py-1 text-sm" value={form.field} onChange={(e) => setForm({ ...form, field: e.target.value as typeof form.field })}>
              {SUPPORTED_FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <select className="border rounded px-2 py-1 text-sm" value={form.operator} onChange={(e) => setForm({ ...form, operator: e.target.value as typeof form.operator })}>
              {OPERATORS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <input className="border rounded px-2 py-1 text-sm" placeholder="value" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
          </div>
          <button onClick={create} className="mt-3 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md">Create Segment</button>
          {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
          {warning && <p className="text-sm text-amber-600 mt-2">Saved, but not computed: {warning}</p>}
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-3">Custom segments</h3>
          {custom.length === 0 && <p className="text-gray-400 text-center py-4">No custom segments yet.</p>}
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-gray-500 uppercase border-b"><th className="py-2">Name</th><th>Description</th><th>Count</th><th></th></tr></thead>
            <tbody>
              {custom.map((s) => (
                <tr key={s.id} className="border-b border-gray-100">
                  <td className="py-2">{s.name}</td>
                  <td>{s.desc}</td>
                  <td>{s.computed ? s.count : <span className="text-gray-400">not computed</span>}</td>
                  <td><button onClick={() => recompute(s.id)} className="text-indigo-600 text-xs font-medium">Recompute</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
