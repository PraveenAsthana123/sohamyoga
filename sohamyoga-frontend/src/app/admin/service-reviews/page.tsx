'use client';

import { useEffect, useState, useCallback } from 'react';

interface ReviewRow {
  id: string;
  reviewer_name: string;
  reviewer_email: string;
  star_rating: number;
  comment: string;
  status: string;
  staff_response: string | null;
  responded_at: string | null;
  created_at: string;
  service_name: string | null;
}

interface RatingBucket { star_rating: number; cnt: number }

interface Kpi {
  total: number;
  avg_rating: number;
  five_star: number;
  published: number;
}

const STATUS_COLORS: Record<string, string> = {
  published: 'bg-green-100 text-green-700',
  pending: 'bg-amber-100 text-amber-700',
  hidden: 'bg-gray-100 text-gray-500',
};

const TABS = ['Overview', 'All Reviews', 'Published', 'Hidden', 'Analytics'] as const;
type Tab = typeof TABS[number];

function Stars({ n }: { n: number }) {
  return <span className="text-amber-500">{'★'.repeat(n)}{'☆'.repeat(5 - n)}</span>;
}

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function RespondBox({ id, onDone }: { id: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState('');

  async function submit() {
    setBusy(true);
    await fetch(`/api/service-reviews/${id}/respond`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ staffResponse: text }),
    });
    setBusy(false); setOpen(false); setText(''); onDone();
  }

  async function draftWithAi() {
    setDrafting(true); setDraftError('');
    const res = await fetch(`/api/service-reviews/${id}/draft-response`, { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    setDrafting(false);
    if (!res.ok) { setDraftError(body.error || 'Failed to draft a response.'); return; }
    setText(body.draft);
  }

  if (!open) return <button onClick={() => setOpen(true)} className="text-xs text-indigo-600 hover:underline">Respond</button>;
  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-2">
        <input value={text} onChange={e => setText(e.target.value)} placeholder="Staff response…" className="flex-1 border rounded px-2 py-1 text-xs" />
        <button onClick={draftWithAi} disabled={drafting} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs disabled:opacity-50">{drafting ? 'Drafting…' : 'Draft with AI'}</button>
        <button onClick={submit} disabled={busy || !text.trim()} className="px-2 py-1 bg-indigo-600 text-white rounded text-xs disabled:opacity-50">Send</button>
      </div>
      {draftError && <p className="text-xs text-red-600">{draftError}</p>}
    </div>
  );
}

export default function ServiceReviewsAdmin() {
  const [tab, setTab] = useState<Tab>('Overview');
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [kpi, setKpi] = useState<Kpi | null>(null);
  const [byRating, setByRating] = useState<RatingBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/service-reviews', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setReviews(d.reviews ?? []);
      setKpi(d.kpi ?? null);
      setByRating(d.byRating ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load reviews');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const updateStatus = useCallback(async (id: string, status: string) => {
    setUpdating(id);
    try {
      const res = await fetch('/api/admin/service-reviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update review');
    } finally {
      setUpdating(null);
    }
  }, [load]);

  const displayed = reviews.filter(r => {
    if (tab === 'Published') return r.status === 'published';
    if (tab === 'Hidden') return r.status === 'hidden';
    return true;
  }).filter(r =>
    !search || r.reviewer_name.toLowerCase().includes(search.toLowerCase()) ||
    r.reviewer_email.toLowerCase().includes(search.toLowerCase()) ||
    r.comment.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Service Reviews</h1>
        <p className="text-gray-500 text-sm mt-1">On-site review moderation — real reviews from real checked-in bookings.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="font-medium ml-4">Dismiss</button>
        </div>
      )}

      {kpi && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Total Reviews" value={kpi.total} />
          <KpiCard label="Avg Rating" value={`${Number(kpi.avg_rating).toFixed(1)} / 5`} />
          <KpiCard label="5-Star Reviews" value={kpi.five_star} />
          <KpiCard label="Published" value={kpi.published} />
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="flex gap-1 p-3 border-b border-gray-100 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                tab === t ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'Analytics' ? (
          <div className="p-6 space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Rating Distribution</h3>
              {byRating.length > 0 ? (
                <div className="space-y-3">
                  {[5, 4, 3, 2, 1].map(star => {
                    const bucket = byRating.find(b => b.star_rating === star);
                    const n = bucket?.cnt ?? 0;
                    const total = kpi?.total ?? 1;
                    return (
                      <div key={star} className="flex items-center gap-3">
                        <span className="text-amber-500 w-20 text-sm">{'★'.repeat(star)}{'☆'.repeat(5 - star)}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-3">
                          <div className="bg-amber-400 h-3 rounded-full" style={{ width: `${total ? (n / total) * 100 : 0}%` }} />
                        </div>
                        <span className="text-sm text-gray-700 w-8 text-right">{n}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-400 text-sm">No reviews yet.</p>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Status Breakdown</h3>
              {kpi && (
                <div className="flex gap-4 text-sm">
                  <div className="text-center"><div className="text-lg font-bold text-green-700">{kpi.published}</div><div className="text-xs text-gray-400">published</div></div>
                  <div className="text-center"><div className="text-lg font-bold text-amber-600">{kpi.total - kpi.published}</div><div className="text-xs text-gray-400">pending/hidden</div></div>
                </div>
              )}
            </div>
          </div>
        ) : tab === 'Overview' ? (
          <div className="p-6 space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Recent Reviews (latest 5)</h3>
            {reviews.slice(0, 5).map(r => (
              <div key={r.id} className="border border-gray-100 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-gray-800">{r.reviewer_name} <Stars n={r.star_rating} /></p>
                    <p className="text-xs text-gray-400">{r.reviewer_email} · {new Date(r.created_at).toLocaleDateString()}</p>
                    {r.comment && <p className="text-sm text-gray-700 mt-2 line-clamp-2">{r.comment}</p>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status] ?? 'bg-gray-100 text-gray-600'}`}>{r.status}</span>
                </div>
              </div>
            ))}
            {reviews.length === 0 && <p className="text-gray-400 text-sm">No reviews yet.</p>}
          </div>
        ) : (
          <>
            <div className="p-4 border-b border-gray-50">
              <input
                type="text"
                placeholder="Search reviewer, email, or comment..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full max-w-sm border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            {loading ? (
              <div className="p-8 text-center text-gray-400">Loading...</div>
            ) : displayed.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No reviews in this category.</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {displayed.map(r => (
                  <div key={r.id} className="p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-900">{r.reviewer_name}</span>
                          <Stars n={r.star_rating} />
                          <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status] ?? 'bg-gray-100 text-gray-600'}`}>{r.status}</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{r.reviewer_email} · {new Date(r.created_at).toLocaleDateString()}</p>
                        {r.comment && <p className="text-sm text-gray-700 mt-2">{r.comment}</p>}
                        {r.staff_response && (
                          <p className="text-xs text-indigo-700 bg-indigo-50 rounded p-2 mt-2">Staff: {r.staff_response}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-3 mt-3 items-center">
                      {r.status !== 'published' && (
                        <button
                          disabled={updating === r.id}
                          onClick={() => updateStatus(r.id, 'published')}
                          className="text-xs text-green-600 hover:underline disabled:opacity-50"
                        >
                          {updating === r.id ? '...' : 'Publish'}
                        </button>
                      )}
                      {r.status !== 'hidden' && (
                        <button
                          disabled={updating === r.id}
                          onClick={() => updateStatus(r.id, 'hidden')}
                          className="text-xs text-gray-400 hover:underline disabled:opacity-50"
                        >
                          {updating === r.id ? '...' : 'Hide'}
                        </button>
                      )}
                      {!r.staff_response && <RespondBox id={r.id} onDone={load} />}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
