'use client';

import { useCallback, useEffect, useState } from 'react';

interface SurveyRow {
  surveyId: string;
  title: string;
  type: string;
  totalResponses: number;
  completedResponses: number;
  completionRate: number;
  npsScore: number | null;
  npsCategory: string | null;
  csatScore: number | null;
  csatCategory: string | null;
  cesScore: number | null;
  cesCategory: string | null;
  calculatedAt: string;
}

interface ReviewRow {
  id: string;
  reviewer_name: string;
  reviewer_email: string;
  star_rating: number;
  comment: string;
  status: string;
  created_at: string;
}

interface CxData {
  surveys: SurveyRow[];
  overallNps: number | null;
  overallCsat: number | null;
  overallCes: number | null;
  cesTracked: boolean;
  tickets: { open: string; resolved_today: string; total: string };
  reviews: { avg_rating: string; total: string; pending: string; recent: ReviewRow[] };
  chat: { total: string; open: string; resolved: string };
  voice: { total: string; inbound: string; outbound: string };
}

type TabKey = 'Overview' | 'Reviews' | 'Support' | 'Chat' | 'Voice';
const TABS: TabKey[] = ['Overview', 'Reviews', 'Support', 'Chat', 'Voice'];

const CATEGORY_COLOR: Record<string, string> = {
  excellent: 'bg-green-100 text-green-700',
  good: 'bg-blue-100 text-blue-700',
  needs_improvement: 'bg-amber-100 text-amber-700',
  critical: 'bg-red-100 text-red-700',
  no_data: 'bg-gray-100 text-gray-500',
  low_effort: 'bg-green-100 text-green-700',
  moderate_effort: 'bg-amber-100 text-amber-700',
  high_effort: 'bg-red-100 text-red-700',
};

function KpiCard({
  label, value, sub, color = 'blue',
}: { label: string; value: string | number; sub?: string; color?: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    gray: 'bg-gray-50 border-gray-200 text-gray-600',
  };
  return (
    <div className={`rounded-xl border p-5 ${colors[color] ?? colors.blue}`}>
      <div className="text-3xl font-bold">{value}</div>
      <div className="mt-1 text-sm font-medium">{label}</div>
      {sub && <div className="mt-0.5 text-xs opacity-60">{sub}</div>}
    </div>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="text-amber-400">
      {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
    </span>
  );
}

export default function CxDashboardPage() {
  const [tab, setTab] = useState<TabKey>('Overview');
  const [data, setData] = useState<CxData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/cx-dashboard', { cache: 'no-store' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? `HTTP ${res.status}`);
      setData(d);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="p-6 text-center text-sm text-gray-400">Loading CX data…</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white px-6 py-4">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-xl font-bold text-gray-900">Customer Experience Dashboard</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            NPS / CSAT / CES from survey_analytics + live support tickets, reviews, chat, and voice.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-6 space-y-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard
            label="Overall NPS"
            value={data?.overallNps !== null && data?.overallNps !== undefined ? data.overallNps : '—'}
            sub="net promoter score"
            color="blue"
          />
          <KpiCard
            label="Avg Review Rating"
            value={data?.reviews?.avg_rating && Number(data.reviews.avg_rating) > 0 ? `${Number(data.reviews.avg_rating).toFixed(1)} / 5` : '—'}
            sub={`${data?.reviews?.total ?? 0} reviews total`}
            color="amber"
          />
          <KpiCard
            label="Open Tickets"
            value={data?.tickets?.open ?? '—'}
            sub={`${data?.tickets?.resolved_today ?? 0} resolved today`}
            color={Number(data?.tickets?.open) > 0 ? 'red' : 'green'}
          />
          <KpiCard
            label="Chat Sessions"
            value={data?.chat?.total ?? '—'}
            sub={`${data?.chat?.open ?? 0} open`}
            color="blue"
          />
        </div>

        <div className="flex gap-1 overflow-x-auto border-b">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'Overview' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-xl border bg-white p-5">
                <p className="mb-1 text-xs font-semibold uppercase text-gray-500">Overall NPS</p>
                <p className="text-4xl font-bold text-gray-900">
                  {data?.overallNps !== null && data?.overallNps !== undefined ? data.overallNps : '—'}
                </p>
                <p className="mt-1 text-xs text-gray-400">{(data?.surveys ?? []).filter(s => s.npsScore !== null).length} surveys with NPS data</p>
              </div>
              <div className="rounded-xl border bg-white p-5">
                <p className="mb-1 text-xs font-semibold uppercase text-gray-500">Overall CSAT</p>
                <p className="text-4xl font-bold text-gray-900">
                  {data?.overallCsat !== null && data?.overallCsat !== undefined ? `${data.overallCsat}%` : '—'}
                </p>
                <p className="mt-1 text-xs text-gray-400">{(data?.surveys ?? []).filter(s => s.csatScore !== null).length} surveys with CSAT data</p>
              </div>
              <div className={`rounded-xl border bg-white p-5 ${data?.cesTracked ? '' : 'opacity-60'}`}>
                <p className="mb-1 text-xs font-semibold uppercase text-gray-500">Overall CES</p>
                {data?.cesTracked
                  ? <p className="text-4xl font-bold text-gray-900">{data.overallCes}%</p>
                  : <p className="text-lg font-medium mt-1 text-gray-400">Not tracked yet</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-xl border bg-white p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">{data?.tickets?.total ?? '—'}</div>
                <div className="mt-1 text-xs font-medium text-gray-600">Support Tickets</div>
                <div className="mt-0.5 text-xs text-gray-400">{data?.tickets?.open} open</div>
              </div>
              <div className="rounded-xl border bg-white p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">{data?.reviews?.total ?? '—'}</div>
                <div className="mt-1 text-xs font-medium text-gray-600">Service Reviews</div>
                <div className="mt-0.5 text-xs text-gray-400">{data?.reviews?.pending} pending response</div>
              </div>
              <div className="rounded-xl border bg-white p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">{data?.chat?.total ?? '—'}</div>
                <div className="mt-1 text-xs font-medium text-gray-600">Chat Sessions</div>
                <div className="mt-0.5 text-xs text-gray-400">{data?.chat?.resolved} resolved</div>
              </div>
              <div className="rounded-xl border bg-white p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">{data?.voice?.total ?? '—'}</div>
                <div className="mt-1 text-xs font-medium text-gray-600">Voice Calls</div>
                <div className="mt-0.5 text-xs text-gray-400">{data?.voice?.inbound} inbound</div>
              </div>
            </div>

            {(data?.surveys ?? []).length > 0 && (
              <div className="rounded-xl border bg-white overflow-hidden">
                <div className="border-b bg-gray-50 px-4 py-3">
                  <h3 className="text-sm font-semibold text-gray-700">Survey Analytics</h3>
                </div>
                <table className="w-full text-sm">
                  <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      {['Survey', 'Type', 'Responses', 'NPS', 'CSAT', 'CES'].map(h => (
                        <th key={h} className="px-4 py-2 text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data?.surveys.map(s => (
                      <tr key={s.surveyId}>
                        <td className="px-4 py-2 font-medium">{s.title}</td>
                        <td className="px-4 py-2 text-gray-500">{s.type}</td>
                        <td className="px-4 py-2 text-gray-600">{s.completedResponses}/{s.totalResponses}</td>
                        <td className="px-4 py-2">
                          {s.npsScore !== null ? (
                            <span className={`rounded-full px-2 py-0.5 text-xs ${CATEGORY_COLOR[s.npsCategory ?? 'no_data']}`}>
                              {s.npsScore} ({s.npsCategory})
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-2">
                          {s.csatScore !== null ? (
                            <span className={`rounded-full px-2 py-0.5 text-xs ${CATEGORY_COLOR[s.csatCategory ?? 'no_data']}`}>
                              {s.csatScore}% ({s.csatCategory})
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-2">
                          {s.cesScore !== null ? (
                            <span className={`rounded-full px-2 py-0.5 text-xs ${CATEGORY_COLOR[s.cesCategory ?? 'no_data']}`}>
                              {s.cesScore}% ({s.cesCategory})
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : tab === 'Reviews' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <KpiCard label="Total Reviews" value={data?.reviews?.total ?? '—'} color="blue" />
              <KpiCard
                label="Avg Rating"
                value={Number(data?.reviews?.avg_rating) > 0 ? `${Number(data?.reviews?.avg_rating ?? 0).toFixed(1)} / 5` : '—'}
                color="amber"
              />
              <KpiCard label="Pending Response" value={data?.reviews?.pending ?? '—'} color="gray" />
            </div>
            <div className="rounded-xl border bg-white overflow-hidden">
              <div className="border-b bg-gray-50 px-4 py-3">
                <h3 className="text-sm font-semibold text-gray-700">Recent Reviews</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {(data?.reviews?.recent ?? []).map((r) => (
                  <div key={r.id} className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-gray-800">{r.reviewer_name}</span>
                        <span className="ml-2 text-xs text-gray-400">{r.reviewer_email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <StarRating rating={r.star_rating} />
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          r.status === 'published' ? 'bg-green-100 text-green-700' :
                          r.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                          'bg-gray-100 text-gray-500'
                        }`}>{r.status}</span>
                      </div>
                    </div>
                    {r.comment && <p className="mt-1 text-sm text-gray-600">{r.comment}</p>}
                    <p className="mt-1 text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString()}</p>
                  </div>
                ))}
                {!(data?.reviews?.recent ?? []).length && (
                  <p className="py-8 text-center text-sm text-gray-400">No reviews yet.</p>
                )}
              </div>
            </div>
          </div>
        ) : tab === 'Support' ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <KpiCard label="Total Tickets" value={data?.tickets?.total ?? '—'} color="blue" />
            <KpiCard label="Open Tickets" value={data?.tickets?.open ?? '—'} color={Number(data?.tickets?.open) > 0 ? 'red' : 'green'} />
            <KpiCard label="Resolved Today" value={data?.tickets?.resolved_today ?? '—'} color="green" />
            <div className="col-span-full rounded-xl border bg-white p-5 text-sm text-gray-600">
              <p className="mb-2 font-semibold text-gray-800">Manage Tickets</p>
              <p>
                Detailed ticket management (status updates, priority, full table with filters) is available on the{' '}
                <a href="/admin/support-tickets" className="text-indigo-600 hover:underline">Support Tickets</a>{' '}
                admin page. This tab shows live count summaries only.
              </p>
            </div>
          </div>
        ) : tab === 'Chat' ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <KpiCard label="Total Conversations" value={data?.chat?.total ?? '—'} color="blue" />
            <KpiCard label="Open / Active" value={data?.chat?.open ?? '—'} color="amber" />
            <KpiCard label="Resolved" value={data?.chat?.resolved ?? '—'} color="green" />
            <div className="col-span-full rounded-xl border bg-white p-5 text-sm text-gray-600">
              <p>
                Chat data sourced from chat_conversation. Detailed per-conversation management
                (messages, agents, bots, handoffs) is handled via the{' '}
                <a href="/admin/chat" className="text-indigo-600 hover:underline">Chat admin page</a>.
              </p>
            </div>
          </div>
        ) : (
          /* Voice tab */
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <KpiCard label="Total Calls" value={data?.voice?.total ?? '—'} color="blue" />
            <KpiCard label="Inbound" value={data?.voice?.inbound ?? '—'} color="green" />
            <KpiCard label="Outbound" value={data?.voice?.outbound ?? '—'} color="gray" />
            <div className="col-span-full rounded-xl border bg-white p-5 text-sm text-gray-600">
              <p>
                Voice call data sourced from voice_call_log. Detailed transcripts and qualification scoring
                are available on the{' '}
                <a href="/admin/voice-calls" className="text-indigo-600 hover:underline">Voice Calls admin page</a>.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
