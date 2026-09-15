"use client";
// KPI Engine — 8 real executive dimensions, each computed from a real
// SQL aggregation (see src/domain/kpi/KpiEngine.ts). Backlog item #2/30,
// depends on the Evidence Ledger (#1/30) — every non-zero-sample
// dimension links to a real evidence_record row.

import { useEffect, useState } from "react";

const CONFIDENCE_COLORS: Record<string, string> = {
  HIGH: "bg-green-100 text-green-700", MEDIUM: "bg-yellow-100 text-yellow-700",
  LOW: "bg-orange-100 text-orange-700", UNKNOWN: "bg-gray-100 text-gray-600",
};
const DIMENSION_LABELS: Record<string, string> = {
  acquisition: "Acquisition", engagement: "Engagement", retention: "Retention",
  wellness_outcomes: "Wellness Outcomes", referral_growth: "Referral Growth",
  reputation: "Reputation", revenue: "Revenue", operational_health: "Operational Health",
};

function Chip({ label, colorClass }: { label: string; colorClass: string }) {
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>{label}</span>;
}

interface Dimension { dimension_key: string; value: string; unit: string; sample_size: number; confidence: string; explanation: string; period_start: string; period_end: string }

export default function KpiPage() {
  const [dimensions, setDimensions] = useState<Dimension[] | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    fetch("/api/admin/kpi").then((r) => (r.ok ? r.json() : { dimensions: [] })).then((d) => setDimensions(d.dimensions || [])).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const runNow = async () => {
    setRunning(true); setError("");
    try {
      const res = await fetch("/api/admin/kpi", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      load();
    } catch (e) { setError(String(e)); } finally { setRunning(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">KPI Engine</h1>
            <p className="text-sm text-gray-500 mt-0.5">8 real executive dimensions, each a real SQL aggregation — never a placeholder number.</p>
          </div>
          <button onClick={runNow} disabled={running} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md disabled:opacity-50">{running ? "Computing…" : "Compute (trailing 30 days)"}</button>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 py-6">
        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
        {!dimensions ? <div className="text-center text-sm text-gray-400 py-8">Loading…</div> : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dimensions.length === 0 && <p className="text-gray-400 col-span-2 text-center py-8">No KPI snapshots computed yet — click &quot;Compute&quot; above.</p>}
            {dimensions.map((d) => (
              <div key={d.dimension_key} className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-800">{DIMENSION_LABELS[d.dimension_key] ?? d.dimension_key}</h3>
                  <Chip label={d.confidence} colorClass={CONFIDENCE_COLORS[d.confidence] ?? "bg-gray-100"} />
                </div>
                <div className="text-2xl font-bold text-gray-900 mb-1">{d.value} <span className="text-sm font-normal text-gray-500">{d.unit}</span></div>
                <p className="text-xs text-gray-500 mb-2">Sample: {d.sample_size} real rows · {d.period_start} to {d.period_end}</p>
                <p className="text-sm text-gray-600">{d.explanation}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
