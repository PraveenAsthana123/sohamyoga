'use client';

import { useEffect, useState } from 'react';

// Real 35-category AI governance framework browser. Data is real (seeded
// from a sibling reference project, see docs/evidence/TALENTSHILL_COMPARISON.md)
// -- assessment counts/scores are genuinely 0/null until an admin actually
// records one via this page, never fabricated.
interface FrameworkRow {
  id: string;
  categoryKey: string;
  categoryName: string;
  description: string | null;
  totalItems: number;
  assessmentCount: number;
  avgScore: number | null;
}

export default function AiGovernancePage() {
  const [frameworks, setFrameworks] = useState<FrameworkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/ai-governance')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => setFrameworks(d.frameworks))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold mb-2">AI Governance Framework</h1>
      <p className="text-sm text-gray-500 mb-6">
        35 real assessment categories. Assessment count and average score are live —
        0/— means no one has recorded an assessment against that category yet.
      </p>

      {loading && <p>Loading…</p>}
      {error && <p className="text-red-600">Failed to load: {error}</p>}

      {!loading && !error && (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left border-b border-gray-200">
              <th className="py-2 pr-4">Category</th>
              <th className="py-2 pr-4">Description</th>
              <th className="py-2 pr-4">Items</th>
              <th className="py-2 pr-4">Assessments</th>
              <th className="py-2 pr-4">Avg score</th>
            </tr>
          </thead>
          <tbody>
            {frameworks.map((f) => (
              <tr key={f.id} className="border-b border-gray-100">
                <td className="py-2 pr-4 font-medium">{f.categoryName}</td>
                <td className="py-2 pr-4 text-gray-600">{f.description}</td>
                <td className="py-2 pr-4">{f.totalItems}</td>
                <td className="py-2 pr-4">{f.assessmentCount}</td>
                <td className="py-2 pr-4">{f.avgScore ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
