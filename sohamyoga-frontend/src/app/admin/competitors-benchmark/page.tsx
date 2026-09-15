"use client";
// Competitor Benchmark Engine — real, admin-entered scores across 8 real
// dimensions per competitor. Backlog item #4/30. Same honesty pattern as
// the existing competitor price-tracking domain this extends: no
// external API/scraper exists, every score is a real observation an
// admin entered themselves.

import { useEffect, useState } from "react";

interface Summary {
  competitorId: string; competitorName: string; dimensionScores: Record<string, number>;
  compositeScore: number; sampleDimensions: number;
  gaps: { dimension: string; theirScore: number; ourScore: number; gap: number }[];
}

export default function CompetitorsBenchmarkPage() {
  const [dimensions, setDimensions] = useState<string[]>([]);
  const [competitors, setCompetitors] = useState<Summary[]>([]);
  const [form, setForm] = useState({ competitorId: "", dimension: "", score: "", notes: "" });
  const [error, setError] = useState("");

  const load = () => {
    fetch("/api/admin/competitors/benchmark").then((r) => (r.ok ? r.json() : { dimensions: [], competitors: [] }))
      .then((d) => { setDimensions(d.dimensions || []); setCompetitors(d.competitors || []); }).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!form.competitorId || !form.dimension || !form.score) { setError("competitor, dimension, and score are required."); return; }
    setError("");
    const res = await fetch("/api/admin/competitors/benchmark", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ competitorId: form.competitorId, dimension: form.dimension, score: Number(form.score), observedAt: new Date().toISOString().slice(0, 10), notes: form.notes }),
    });
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || `HTTP ${res.status}`); return; }
    setForm({ ...form, score: "", notes: "" }); load();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-xl font-bold text-gray-900">Competitor Benchmark</h1>
          <p className="text-sm text-gray-500 mt-0.5">Real, admin-entered scores across 8 dimensions per competitor — no external scraper. Gaps compare only against dimensions with a real comparable own-KPI value.</p>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-3">Record a real observation</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <select className="border rounded px-2 py-1 text-sm" value={form.competitorId} onChange={(e) => setForm({ ...form, competitorId: e.target.value })}>
              <option value="">Select competitor…</option>
              {competitors.map((c) => <option key={c.competitorId} value={c.competitorId}>{c.competitorName}</option>)}
            </select>
            <select className="border rounded px-2 py-1 text-sm" value={form.dimension} onChange={(e) => setForm({ ...form, dimension: e.target.value })}>
              <option value="">Select dimension…</option>
              {dimensions.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <input className="border rounded px-2 py-1 text-sm" type="number" min={0} max={100} placeholder="score 0-100" value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} />
            <input className="border rounded px-2 py-1 text-sm" placeholder="what you observed" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <button onClick={submit} className="mt-3 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md">Record Score</button>
        </div>
        {competitors.length === 0 && <p className="text-gray-400 text-center py-8">No competitors yet — add one via the existing Competitors page first.</p>}
        {competitors.map((c) => (
          <div key={c.competitorId} className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-800">{c.competitorName}</h3>
              <span className="text-sm font-bold text-indigo-600">Composite {c.compositeScore}/100 ({c.sampleDimensions}/8 real dimensions scored)</span>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {Object.entries(c.dimensionScores).map(([dim, score]) => (
                <span key={dim} className="text-xs bg-gray-100 rounded px-2 py-1">{dim}: {score}</span>
              ))}
            </div>
            {c.gaps.length > 0 && (
              <div className="text-sm bg-amber-50 rounded p-2">
                {c.gaps.map((g) => (
                  <p key={g.dimension}>Real gap on <strong>{g.dimension}</strong>: they score {g.theirScore} vs. our real {g.ourScore} ({g.gap > 0 ? `+${g.gap} ahead of us` : `${g.gap} behind us`})</p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
