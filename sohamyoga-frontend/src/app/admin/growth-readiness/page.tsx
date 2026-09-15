"use client";
// Growth Readiness Score — backlog item #7/30. Rolls the real 8 KPI
// dimensions (item #2) into one real headline score, confidence-
// weighted, over only the dimensions on a real comparable 0-100 scale.
// Count/currency dimensions (acquisition, referral_growth, revenue) are
// shown as raw context, never force-normalized into a fabricated 0-100.

import { useEffect, useState } from "react";

interface Report {
  growthReadinessScore: number | null;
  includedDimensions: string[]; excludedDimensions: string[];
  dimensions: Array<{ dimension_key: string; value: number; unit: string; confidence: string; sample_size: number; explanation: string }>;
  topOpportunities: Array<{ kpi_dimension_key: string; priority_score: number; recommended_solution: string | null }>;
  customerOnePager: { headline: string; topOpportunity: string | null };
}

export default function GrowthReadinessPage() {
  const [report, setReport] = useState<Report | null>(null);

  useEffect(() => {
    fetch("/api/admin/growth-readiness").then((r) => (r.ok ? r.json() : null)).then(setReport).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-xl font-bold text-gray-900">Growth Readiness Score</h1>
          <p className="text-sm text-gray-500 mt-0.5">Real, confidence-weighted composite over the 8 real KPI dimensions — run KPI Engine + Opportunity Engine first for a complete picture.</p>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {!report ? <div className="text-center text-sm text-gray-400 py-8">Loading…</div> : <>
          <div className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm text-center">
            {report.growthReadinessScore !== null ? (
              <div className="text-5xl font-bold text-indigo-600">{report.growthReadinessScore}<span className="text-2xl text-gray-400">/100</span></div>
            ) : (
              <p className="text-gray-400">Not enough real data yet to compute a score — run the KPI Engine first.</p>
            )}
            <p className="text-sm text-gray-500 mt-2">{report.customerOnePager.headline}</p>
            {report.customerOnePager.topOpportunity && <p className="text-sm text-gray-700 bg-gray-50 rounded p-3 mt-3">Top opportunity: {report.customerOnePager.topOpportunity}</p>}
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-3">Internal deep report — all 8 real dimensions</h3>
            <p className="text-xs text-gray-500 mb-3">Included in score: {report.includedDimensions.join(", ") || "none"}. Excluded (no honest 0-100 scale for count/currency units): {report.excludedDimensions.join(", ") || "none"}.</p>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-gray-500 uppercase border-b"><th className="py-2">Dimension</th><th>Value</th><th>Confidence</th><th>Sample</th></tr></thead>
              <tbody>
                {report.dimensions.map((d) => (
                  <tr key={d.dimension_key} className="border-b border-gray-100">
                    <td className="py-2">{d.dimension_key}{report.includedDimensions.includes(d.dimension_key) ? "" : " (excluded)"}</td>
                    <td>{d.value} {d.unit}</td>
                    <td>{d.confidence}</td>
                    <td>{d.sample_size}</td>
                  </tr>
                ))}
                {report.dimensions.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-gray-400">No KPI snapshots yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </>}
      </div>
    </div>
  );
}
