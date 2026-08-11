'use client';
// /admin/growth/funnel — Customer Funnel Stage Engine. The spine of the
// growth-loop architecture: real per-stage counts and stage-to-stage
// conversion rates computed weekly by FunnelStageAnalysisJob from
// tracking_event/campaign_lead/booking/survey data. Scoped to what this
// platform actually tracks — there is no ad-impression/reach data (no ad
// platform connected), so the funnel starts at real on-site engagement.

import { useEffect, useState } from 'react';

interface Stage { stage: string; stage_order: number; unique_count: number }
interface Transition { from_stage: string; to_stage: string; from_count: number; to_count: number; conversion_rate: string; is_leak: boolean; ai_diagnosis: string | null }

const STAGE_LABELS: Record<string, string> = {
  engagement: 'Engagement', interest: 'Interest', intent: 'Intent', lead: 'Lead',
  conversion: 'Conversion', experience: 'Experience', advocacy: 'Advocacy',
};

export default function FunnelPage() {
  const [data, setData] = useState<{ hasData: boolean; periodStart?: string; periodEnd?: string; stages: Stage[]; transitions: Transition[] } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/growth/funnel', { cache: 'no-store' })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setData(d); })
      .catch(e => setError(e.message));
  }, []);

  if (error) return <div className="mx-auto max-w-5xl p-6"><div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div></div>;
  if (!data) return <div className="p-6 text-sm text-gray-500">Loading…</div>;

  const maxCount = Math.max(1, ...data.stages.map(s => s.unique_count));

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="border-l-4 border-primary-600 pl-4">
        <h1 className="text-2xl font-bold">Customer Funnel</h1>
        <p className="text-sm text-gray-500">
          Real weekly stage counts and conversion rates from tracking_event/campaign_lead/booking/survey data.
          {data.hasData && ` Period: ${new Date(data.periodStart!).toLocaleDateString()} – ${new Date(data.periodEnd!).toLocaleDateString()}.`}
        </p>
      </header>

      {!data.hasData ? (
        <div className="rounded-xl border bg-white p-6 text-sm text-gray-500">
          No funnel snapshot yet — run "funnel-stage-analysis" from the Demo Hub's Use Case Catalog.
        </div>
      ) : (
        <>
          <section className="rounded-xl border bg-white p-5">
            <h2 className="mb-4 font-semibold">Stages</h2>
            <div className="space-y-3">
              {data.stages.map(s => (
                <div key={s.stage} className="flex items-center gap-3">
                  <div className="w-28 shrink-0 text-sm text-gray-600">{STAGE_LABELS[s.stage] ?? s.stage}</div>
                  <div className="flex-1 rounded bg-gray-100">
                    <div
                      className="rounded bg-primary-600 py-1.5 text-right text-xs text-white"
                      style={{ width: `${Math.max(4, (s.unique_count / maxCount) * 100)}%` }}
                    >
                      <span className="px-2">{s.unique_count}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border bg-white p-5">
            <h2 className="mb-4 font-semibold">Stage-to-Stage Transitions</h2>
            <div className="space-y-3">
              {data.transitions.map((t, i) => (
                <div key={i} className={`rounded-lg border p-3 ${t.is_leak ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{STAGE_LABELS[t.from_stage]} → {STAGE_LABELS[t.to_stage]}</span>
                    <span className={`font-semibold ${t.is_leak ? 'text-red-700' : 'text-gray-700'}`}>
                      {t.conversion_rate}% ({t.from_count} → {t.to_count})
                    </span>
                  </div>
                  {t.is_leak && <span className="mt-1 inline-block rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Leak</span>}
                  {t.ai_diagnosis && <p className="mt-2 text-sm text-gray-600">{t.ai_diagnosis}</p>}
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
