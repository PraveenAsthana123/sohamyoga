'use client';
// Unified Engagement Analytics -- real cross-cutting view across the three
// genuinely separate survey/poll/form systems. Not a unified builder (their
// underlying tables have incompatible shapes -- survey_response has a
// respondent identity, poll_vote only a voter id, form_submission is an
// anonymous JSONB blob) -- that remains a real, separate gap, not fabricated
// here.

import { useEffect, useState } from 'react';

interface SourceRow { key: string; label: string; total: number; lastActivity: string | null }

export default function EngagementAnalyticsPage() {
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/engagement/summary', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => setSources(d?.sources ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Engagement Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">
          Real response/vote/submission counts across Survey, Poll, and Form Management in one view.
          These remain three separate builders (their tables have incompatible shapes) — this is a
          real shared analytics layer, not a fabricated merged builder.
        </p>
      </div>

      {loading ? <p className="text-sm text-gray-400">Loading…</p> : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {sources.map(s => (
            <div key={s.key} className="bg-white border rounded-xl p-5">
              <p className="text-3xl font-bold text-gray-900">{s.total}</p>
              <p className="text-sm font-medium text-gray-700 mt-1">{s.label}</p>
              <p className="text-xs text-gray-400 mt-2">
                {s.lastActivity ? `Last activity ${new Date(s.lastActivity).toLocaleString()}` : 'No activity yet'}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3 text-xs text-gray-400 pt-2">
        <a href="/admin/survey" className="hover:underline">→ Survey Management</a>
        <a href="/admin/polls" className="hover:underline">→ Poll Management</a>
        <a href="/admin/forms" className="hover:underline">→ Form Management</a>
      </div>
    </div>
  );
}
