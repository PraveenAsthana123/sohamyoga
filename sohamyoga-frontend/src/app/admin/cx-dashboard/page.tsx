'use client';
// CX Dashboard -- combines the three real, already-computed metrics
// (NpsCalculationJob, CsatCalculationJob, CesCalculationJob) into one view.

import { useEffect, useState } from 'react';

interface SurveyRow {
  surveyId: string; title: string; type: string; totalResponses: number; completedResponses: number;
  completionRate: number; npsScore: number | null; npsCategory: string | null;
  csatScore: number | null; csatCategory: string | null;
  cesScore: number | null; cesCategory: string | null; calculatedAt: string;
}

const CATEGORY_COLOR: Record<string, string> = {
  excellent: 'bg-green-100 text-green-700', good: 'bg-blue-100 text-blue-700',
  needs_improvement: 'bg-amber-100 text-amber-700', critical: 'bg-red-100 text-red-700', no_data: 'bg-gray-100 text-gray-500',
  low_effort: 'bg-green-100 text-green-700', moderate_effort: 'bg-amber-100 text-amber-700', high_effort: 'bg-red-100 text-red-700',
};

export default function CxDashboardPage() {
  const [data, setData] = useState<{ surveys: SurveyRow[]; overallNps: number | null; overallCsat: number | null; overallCes: number | null; cesTracked: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/cx-dashboard', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null).then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 text-sm text-gray-500">Loading…</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Customer Experience Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Real NPS, CSAT, and CES scores (NpsCalculationJob, CsatCalculationJob, CesCalculationJob), aggregated.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border rounded-xl p-5">
          <p className="text-xs text-gray-500 uppercase">Overall NPS</p>
          <p className="text-3xl font-bold mt-1 text-gray-900">{data?.overallNps ?? '—'}</p>
        </div>
        <div className="bg-white border rounded-xl p-5">
          <p className="text-xs text-gray-500 uppercase">Overall CSAT</p>
          <p className="text-3xl font-bold mt-1 text-gray-900">{data?.overallCsat !== null && data?.overallCsat !== undefined ? `${data.overallCsat}%` : '—'}</p>
        </div>
        <div className={`bg-white border rounded-xl p-5 ${data?.cesTracked ? '' : 'opacity-60'}`}>
          <p className="text-xs text-gray-500 uppercase">Overall CES</p>
          {data?.cesTracked
            ? <p className="text-3xl font-bold mt-1 text-gray-900">{data.overallCes}%</p>
            : <p className="text-lg font-medium mt-1 text-gray-400">Not tracked yet</p>}
        </div>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>{['Survey', 'Type', 'Responses', 'Completion', 'NPS', 'CSAT', 'CES'].map(h => <th key={h} className="px-4 py-2 text-left">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">
            {(data?.surveys ?? []).map(s => (
              <tr key={s.surveyId}>
                <td className="px-4 py-2 font-medium">{s.title}</td>
                <td className="px-4 py-2 text-gray-500">{s.type}</td>
                <td className="px-4 py-2 text-gray-600">{s.completedResponses}/{s.totalResponses}</td>
                <td className="px-4 py-2 text-gray-600">{s.completionRate}%</td>
                <td className="px-4 py-2">
                  {s.npsScore !== null ? <span className={`text-xs px-2 py-0.5 rounded-full ${CATEGORY_COLOR[s.npsCategory ?? 'no_data']}`}>{s.npsScore} ({s.npsCategory})</span> : '—'}
                </td>
                <td className="px-4 py-2">
                  {s.csatScore !== null ? <span className={`text-xs px-2 py-0.5 rounded-full ${CATEGORY_COLOR[s.csatCategory ?? 'no_data']}`}>{s.csatScore}% ({s.csatCategory})</span> : '—'}
                </td>
                <td className="px-4 py-2">
                  {s.cesScore !== null ? <span className={`text-xs px-2 py-0.5 rounded-full ${CATEGORY_COLOR[s.cesCategory ?? 'no_data']}`}>{s.cesScore}% ({s.cesCategory})</span> : '—'}
                </td>
              </tr>
            ))}
            {!data?.surveys.length && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No survey analytics computed yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
