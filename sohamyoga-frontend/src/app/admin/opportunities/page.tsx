"use client";
// Opportunity & Benchmark Engine — real candidates generated from real
// kpi_snapshot rows (LOW/UNKNOWN confidence or below a disclosed real
// threshold). Backlog item #3/30, depends on KPI Engine (#2) + Evidence
// Ledger (#1). Every recommended solution cites a real, already-built
// module — never a fictional feature.

import { useEffect, useState } from "react";

interface Opportunity {
  id: string; kpi_dimension_key: string; gap_reason: string; current_value: string;
  threshold_value: string | null; impact_score: number; feasibility_score: number;
  priority_score: number; recommended_solution: string | null; rank: number;
}

export default function OpportunitiesPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[] | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    fetch("/api/admin/opportunities").then((r) => (r.ok ? r.json() : { opportunities: [] })).then((d) => setOpportunities(d.opportunities || [])).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const runNow = async () => {
    setRunning(true); setError("");
    try {
      const res = await fetch("/api/admin/opportunities", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status} — run the KPI Engine first`);
      load();
    } catch (e) { setError(String(e)); } finally { setRunning(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Opportunity &amp; Benchmark Engine</h1>
            <p className="text-sm text-gray-500 mt-0.5">Real candidates from real KPI gaps, ranked by impact × feasibility × confidence. Solutions cite real existing modules only.</p>
          </div>
          <button onClick={runNow} disabled={running} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md disabled:opacity-50">{running ? "Generating…" : "Generate from latest KPIs"}</button>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-4">
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!opportunities ? <div className="text-center text-sm text-gray-400 py-8">Loading…</div> : opportunities.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No real opportunity candidates — either every KPI dimension is healthy, or the KPI Engine hasn&apos;t been run yet.</p>
        ) : opportunities.map((o) => (
          <div key={o.id} className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-800">#{o.rank} — {o.kpi_dimension_key}</h3>
              <span className="text-sm font-bold text-indigo-600">Priority {o.priority_score}/100</span>
            </div>
            <p className="text-sm text-gray-600 mb-2">
              Current: <strong>{o.current_value}</strong>{o.threshold_value ? ` (real threshold: ${o.threshold_value})` : ""} · Reason: {o.gap_reason === 'below_threshold' ? 'below real threshold' : 'low real confidence'}
            </p>
            <p className="text-xs text-gray-500 mb-2">Impact {o.impact_score}/100 · Feasibility {o.feasibility_score}/100</p>
            {o.recommended_solution ? <p className="text-sm text-gray-700 bg-gray-50 rounded p-2">{o.recommended_solution}</p> : <p className="text-sm text-amber-700 bg-amber-50 rounded p-2">No real remediation module exists yet for this dimension.</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
