"use client";
// Evidence Ledger — real audit trail for every classified claim this
// platform records (FACT/ESTIMATE/INFERENCE/HYPOTHESIS/UNKNOWN), each
// traceable to a real source. Backlog item #1 (priority 1) from the
// 2026-09-14 roadmap cross-check. Currently wired into one real producer
// (VoiceOfCustomerJob) — more producers get wired as later backlog items
// (KPI Engine, Opportunity Engine, Competitor Benchmark) are built on top
// of this ledger.

import { useEffect, useState } from "react";

const TYPE_COLORS: Record<string, string> = {
  FACT: "bg-green-100 text-green-700", ESTIMATE: "bg-blue-100 text-blue-700",
  INFERENCE: "bg-purple-100 text-purple-700", HYPOTHESIS: "bg-amber-100 text-amber-700",
  UNKNOWN: "bg-gray-100 text-gray-600",
};
const CONFIDENCE_COLORS: Record<string, string> = {
  HIGH: "bg-green-100 text-green-700", MEDIUM: "bg-yellow-100 text-yellow-700",
  LOW: "bg-orange-100 text-orange-700", UNKNOWN: "bg-gray-100 text-gray-600",
};

function Chip({ label, colorClass }: { label: string; colorClass: string }) {
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>{label}</span>;
}

interface EvidenceData {
  total: number;
  records: Array<{ id: string; subject_type: string; evidence_type: string; claim: string; confidence: string; source_type: string; source_ref: string; collected_at: string; valid_until: string | null }>;
  byType: Record<string, number>;
  bySubjectType: Record<string, number>;
}

export default function EvidencePage() {
  const [data, setData] = useState<EvidenceData | null>(null);

  useEffect(() => {
    fetch("/api/admin/evidence").then((r) => (r.ok ? r.json() : null)).then(setData).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-xl font-bold text-gray-900">Evidence Ledger</h1>
          <p className="text-sm text-gray-500 mt-0.5">Every classified claim this platform records, traced to a real source. No claim is stored without a real source_ref.</p>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {!data ? <div className="text-center text-sm text-gray-400 py-8">Loading…</div> : <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4 text-center shadow-sm">
              <div className="text-2xl font-bold text-gray-900">{data.total}</div>
              <div className="text-xs font-medium text-gray-700 mt-1">Total evidence records</div>
            </div>
            {Object.entries(data.byType).map(([type, n]) => (
              <div key={type} className="bg-white border border-gray-200 rounded-lg p-4 text-center shadow-sm">
                <div className="text-2xl font-bold text-gray-900">{n}</div>
                <div className="text-xs font-medium text-gray-700 mt-1">{type}</div>
              </div>
            ))}
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-4">Recent evidence (by subject type: {Object.entries(data.bySubjectType).map(([s, n]) => `${s} (${n})`).join(", ") || "none yet"})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-gray-500 uppercase border-b"><th className="py-2">Claim</th><th>Type</th><th>Confidence</th><th>Source</th><th>Collected</th></tr></thead>
                <tbody>
                  {data.records.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-gray-400">No evidence recorded yet.</td></tr>}
                  {data.records.map((r) => (
                    <tr key={r.id} className="border-b border-gray-100">
                      <td className="py-2 max-w-md">{r.claim}</td>
                      <td><Chip label={r.evidence_type} colorClass={TYPE_COLORS[r.evidence_type] ?? "bg-gray-100 text-gray-600"} /></td>
                      <td><Chip label={r.confidence} colorClass={CONFIDENCE_COLORS[r.confidence] ?? "bg-gray-100 text-gray-600"} /></td>
                      <td className="text-xs text-gray-500">{r.source_type}<br />{r.source_ref}</td>
                      <td>{new Date(r.collected_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
            <strong>Currently wired producers:</strong> VoiceOfCustomerJob (real Ollama theme-clustering over real inbound customer messages, INFERENCE type). Additional producers (competitor benchmarks, KPI engine, opportunity engine) get wired here as those backlog items are built.
          </div>
        </>}
      </div>
    </div>
  );
}
