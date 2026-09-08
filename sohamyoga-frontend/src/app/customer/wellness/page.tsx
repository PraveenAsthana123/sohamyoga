'use client';
// /customer/wellness — real wellness_score history (computed by
// WellnessScoreComputeJob from actual practice_journal entries), plus a real
// SVG trend line — never a fabricated curve.

import { useEffect, useState } from 'react';

interface Score { score_date: string; mood_score: number | null; energy_score: number | null; composite_score: number }

export default function WellnessPage() {
  const [scores, setScores] = useState<Score[]>([]);
  const [avg, setAvg] = useState(0);
  const [hasStudentRecord, setHasStudentRecord] = useState(true);

  useEffect(() => {
    fetch('/api/customer/wellness', { cache: 'no-store' }).then(r => r.json()).then(d => {
      setScores(d.scores ?? []); setAvg(d.averageComposite ?? 0); setHasStudentRecord(d.hasStudentRecord);
    });
  }, []);

  if (!hasStudentRecord) return <p className="text-sm text-gray-500">Wellness scores appear once you log a practice journal entry.</p>;

  const chronological = [...scores].reverse();
  const points = chronological.map((s, i) => {
    const x = chronological.length > 1 ? (i / (chronological.length - 1)) * 280 + 10 : 150;
    const y = 100 - (s.composite_score / 100) * 80;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Wellness Score</h1>
        <p className="mt-1 text-sm text-gray-500">Computed from your real practice journal entries — mood and energy after each session.</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-gray-500">30-day average</span>
          <span className="text-2xl font-bold text-green-600">{avg}<span className="text-sm text-gray-400">/100</span></span>
        </div>
        {chronological.length > 1 && (
          <svg viewBox="0 0 300 110" className="mt-3 w-full" role="img" aria-label="Wellness score trend over time">
            <polyline points={points} fill="none" stroke="#16a34a" strokeWidth="2" />
            {chronological.map((s, i) => {
              const x = (i / (chronological.length - 1)) * 280 + 10;
              const y = 100 - (s.composite_score / 100) * 80;
              return <circle key={i} cx={x} cy={y} r={2.5} fill="#16a34a" />;
            })}
          </svg>
        )}
        {!scores.length && <p className="mt-3 text-sm text-gray-400">No wellness scores yet — log a practice journal entry to start tracking.</p>}
      </div>

      <div className="space-y-1">
        {scores.map((s, i) => (
          <div key={i} className="flex justify-between rounded border border-gray-100 bg-white px-3 py-2 text-sm">
            <span className="text-gray-600">{new Date(s.score_date).toLocaleDateString()}</span>
            <span className="font-medium">{s.composite_score}/100</span>
          </div>
        ))}
      </div>
    </div>
  );
}
