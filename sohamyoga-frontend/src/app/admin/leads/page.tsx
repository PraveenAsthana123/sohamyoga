"use client";
// Explainable Lead Scoring + Next-Best-Action — admin UI for the real,
// pre-existing LeadNurturingJob (weekly Ollama scoring, real Mautic
// warm/hot triggers). Backlog item #6/30: the roadmap cross-check said
// "not independently confirmed built" -- investigation found a fully
// real, scheduled, working job with zero admin UI to view its output.
// This page is the missing piece; next_action (stored as
// lead_score_reason) IS the real Next-Best-Action the roadmap asked for
// — the model's own explanation for the score, not a separate AI call.

import { useEffect, useState } from "react";

const TEMP_COLORS: Record<string, string> = {
  hot: "bg-red-100 text-red-700", warm: "bg-orange-100 text-orange-700", cold: "bg-blue-100 text-blue-700",
};

interface Lead {
  id: string; name: string; email: string; source: string; stage: string;
  score: number | null; temperature: string | null; scoreReason: string | null; added: string;
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  const load = () => {
    fetch("/api/crm/leads").then((r) => (r.ok ? r.json() : { leads: [] })).then((d) => setLeads(d.leads || [])).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const runScoring = async () => {
    setRunning(true); setError(""); setResult("");
    try {
      const res = await fetch("/api/admin/demo-hub/run-job", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "lead-nurturing" }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`);
      setResult(`Completed in ${d.durationMs}ms.`);
      load();
    } catch (e) { setError(String(e)); } finally { setRunning(false); }
  };

  const scored = (leads ?? []).filter((l) => l.score !== null);
  const unscored = (leads ?? []).filter((l) => l.score === null);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Lead Scoring &amp; Next-Best-Action</h1>
            <p className="text-sm text-gray-500 mt-0.5">Real Ollama scoring (weekly, or on demand below). Reason = the model&apos;s own real explanation for the score, not a separate call.</p>
          </div>
          <button onClick={runScoring} disabled={running} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md disabled:opacity-50">{running ? "Scoring…" : "Run Scoring Now"}</button>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-4">
        {error && <p className="text-sm text-red-600">{error}</p>}
        {result && <p className="text-sm text-green-600">{result}</p>}
        {!leads ? <div className="text-center text-sm text-gray-400 py-8">Loading…</div> : <>
          <p className="text-sm text-gray-500">{scored.length} real scored leads, {unscored.length} not yet scored (run scoring above, or wait for the real weekly job).</p>
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-gray-500 uppercase border-b bg-gray-50"><th className="py-2 px-3">Lead</th><th>Source</th><th>Stage</th><th>Score</th><th>Temp</th><th>Next-Best-Action</th></tr></thead>
              <tbody>
                {leads.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-gray-400">No active leads.</td></tr>}
                {leads.map((l) => (
                  <tr key={l.id} className="border-b border-gray-100">
                    <td className="py-2 px-3">{l.name}<br /><span className="text-xs text-gray-400">{l.email}</span></td>
                    <td>{l.source}</td>
                    <td>{l.stage}</td>
                    <td className="font-bold">{l.score ?? "—"}</td>
                    <td>{l.temperature ? <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${TEMP_COLORS[l.temperature] ?? "bg-gray-100"}`}>{l.temperature}</span> : "—"}</td>
                    <td className="text-xs max-w-xs">{l.scoreReason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>}
      </div>
    </div>
  );
}
