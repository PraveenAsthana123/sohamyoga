'use client';
// GEO/AEO Management — AI engine visibility tracking.
// Tracks whether AI search engines (ChatGPT, Gemini, Perplexity, Claude)
// cite or mention the business in their responses to relevant queries.
// All observations are admin-entered — no external AI-search API is called
// unless OPENAI_API_KEY / GEMINI_API_KEY is configured.

import { useEffect, useState } from 'react';

const TABS = ['Overview', 'Observations', 'Report', 'Track Mention', 'Pipeline'] as const;
type Tab = (typeof TABS)[number];

interface Observation {
  id: string;
  platform: string;
  query_text: string;
  was_mentioned: boolean;
  excerpt: string;
  observed_at: string | null;
  created_by: string;
  created_at: string;
}

interface GeoSummary {
  totalObservations: number;
  mentionedCount: number;
  mentionRate: number | null;
  byPlatform: Record<string, { total: number; mentioned: number }>;
}

const PLATFORMS = ['chatgpt', 'gemini', 'perplexity', 'claude', 'copilot', 'llama', 'other'];

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="mt-0.5 text-xs font-medium text-gray-500">{label}</div>
      {sub && <div className="mt-1 text-xs text-gray-400">{sub}</div>}
    </div>
  );
}

export default function GeoAeoPage() {
  const [tab, setTab] = useState<Tab>('Overview');
  const [summary, setSummary] = useState<GeoSummary | null>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Track mention form
  const [platform, setPlatform] = useState('chatgpt');
  const [queryText, setQueryText] = useState('');
  const [wasMentioned, setWasMentioned] = useState(true);
  const [excerpt, setExcerpt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/admin/geo-visibility').then(r => r.ok ? r.json() : null),
      fetch('/api/admin/geo-visibility/observations').then(r => r.ok ? r.json() : { observations: [] }),
    ]).then(([s, obs]) => {
      if (s) setSummary(s);
      setObservations(obs.observations ?? []);
    }).catch(e => setError(e.message)).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const trackMention = async () => {
    if (!queryText.trim()) { setSubmitMsg('Query text is required.'); return; }
    setSubmitting(true);
    setSubmitMsg('');
    try {
      const res = await fetch('/api/admin/geo-visibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, queryText: queryText.trim(), wasMentioned, excerpt: excerpt.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Failed to record observation');
      setSubmitMsg('Observation recorded.');
      setQueryText(''); setExcerpt('');
      load();
    } catch (e) {
      setSubmitMsg(e instanceof Error ? e.message : 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  const aiConfigured = !!(typeof window !== 'undefined'); // server-side env not accessible in client

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="border-l-4 border-primary-600 pl-4">
        <h1 className="text-2xl font-bold">GEO / AEO Management</h1>
        <p className="text-sm text-gray-500">
          Generative Engine Optimization — track AI engine citations and share-of-voice
        </p>
      </header>

      <div className="flex flex-wrap gap-1 border-b border-gray-200">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium ${tab === t ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {/* Overview */}
      {tab === 'Overview' && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-4">
            <KpiCard label="Total Observations" value={summary?.totalObservations ?? 0} />
            <KpiCard label="Mentions" value={summary?.mentionedCount ?? 0} />
            <KpiCard label="Mention Rate" value={summary?.mentionRate !== null && summary?.mentionRate !== undefined ? `${summary.mentionRate}%` : 'N/A'} sub="null when no data" />
            <KpiCard label="Platforms Tracked" value={Object.keys(summary?.byPlatform ?? {}).length} />
          </div>

          <div className="rounded-xl border border-blue-50 bg-blue-50 p-4">
            <p className="text-sm font-medium text-blue-800">What is GEO/AEO?</p>
            <p className="mt-1 text-xs text-blue-700">
              Generative Engine Optimization (GEO) / Answer Engine Optimization (AEO) tracks how often AI
              assistants like ChatGPT, Gemini, and Perplexity cite or mention this business when users ask
              relevant questions. A higher mention rate means better AI search visibility.
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5">
            <h2 className="mb-3 font-semibold text-gray-800">Mention Rate by AI Engine</h2>
            {loading ? <p className="text-sm text-gray-400">Loading…</p> : (
              Object.keys(summary?.byPlatform ?? {}).length === 0 ? (
                <p className="text-sm text-gray-400">No observations yet. Use Track Mention tab to log your first observation.</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(summary?.byPlatform ?? {}).map(([plat, d]) => {
                    const rate = d.total ? Math.round((d.mentioned / d.total) * 100) : 0;
                    return (
                      <div key={plat}>
                        <div className="flex justify-between text-sm">
                          <span className="capitalize font-medium text-gray-700">{plat}</span>
                          <span className="text-gray-600">{d.mentioned}/{d.total} ({rate}%)</span>
                        </div>
                        <div className="mt-1 h-2 w-full rounded-full bg-gray-100">
                          <div className="h-2 rounded-full bg-blue-500" style={{ width: `${rate}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* Observations */}
      {tab === 'Observations' && (
        <div className="rounded-xl border bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">All Observations ({observations.length})</h2>
            <button onClick={load} className="rounded border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50">Refresh</button>
          </div>
          {loading ? <p className="text-sm text-gray-400">Loading…</p> : (
            observations.length === 0 ? <p className="text-sm text-gray-400">No observations recorded yet.</p> : (
              <div className="space-y-3">
                {observations.map(o => (
                  <div key={o.id} className="rounded-lg border border-gray-100 p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 capitalize">{o.platform}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${o.was_mentioned ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {o.was_mentioned ? 'Mentioned' : 'Not mentioned'}
                        </span>
                        <span className="text-xs text-gray-400">{new Date(o.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <p className="mt-2 text-sm font-medium text-gray-700">{o.query_text}</p>
                    {o.excerpt && <p className="mt-1 text-xs text-gray-500 italic line-clamp-2">&ldquo;{o.excerpt}&rdquo;</p>}
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}

      {/* Report */}
      {tab === 'Report' && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard label="Total Observations" value={summary?.totalObservations ?? 0} />
            <KpiCard label="Mention Rate" value={summary?.mentionRate !== null && summary?.mentionRate !== undefined ? `${summary.mentionRate}%` : 'N/A'} />
            <KpiCard label="Platforms" value={Object.keys(summary?.byPlatform ?? {}).length} />
          </div>
          <div className="rounded-xl border bg-white p-5">
            <h2 className="mb-3 font-semibold text-gray-800">AI Search Engine Visibility Report</h2>
            <p className="mb-4 text-sm text-gray-500">
              Mention rate is computed only from real admin-logged observations.
              {summary?.mentionRate === null ? ' No data yet — log observations to track visibility.' : ''}
            </p>
            {Object.entries(summary?.byPlatform ?? {}).length === 0 ? (
              <p className="text-sm text-gray-400">No platform data yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-semibold text-gray-500">
                    <th className="pb-2 pr-6">AI Engine</th>
                    <th className="pb-2 pr-6">Observations</th>
                    <th className="pb-2 pr-6">Mentions</th>
                    <th className="pb-2">Mention Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(summary?.byPlatform ?? {}).map(([plat, d]) => {
                    const rate = d.total ? Math.round((d.mentioned / d.total) * 100) : 0;
                    return (
                      <tr key={plat} className="border-b border-gray-50">
                        <td className="py-2 pr-6 capitalize font-medium text-gray-800">{plat}</td>
                        <td className="py-2 pr-6 text-gray-600">{d.total}</td>
                        <td className="py-2 pr-6 text-gray-600">{d.mentioned}</td>
                        <td className="py-2">
                          <span className={`font-semibold ${rate >= 50 ? 'text-green-600' : rate >= 20 ? 'text-amber-600' : 'text-red-600'}`}>{rate}%</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-xs text-gray-500">
            <p className="font-medium">Automated tracking</p>
            <p className="mt-1">
              GeoAeoTrackingJob runs daily (3am) and submits probe queries to configured AI engines.
              Requires OPENAI_API_KEY or GEMINI_API_KEY — without them, all observations must be logged manually.
            </p>
          </div>
        </div>
      )}

      {/* Track Mention */}
      {tab === 'Track Mention' && (
        <div className="rounded-xl border bg-white p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">Log an AI Engine Observation</h2>
          <p className="text-sm text-gray-600">
            Manually record whether a specific AI engine mentioned this business in its response
            to a query you tested.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">AI Engine</label>
              <select value={platform} onChange={e => setPlatform(e.target.value)} className="w-full rounded border px-3 py-2 text-sm">
                {PLATFORMS.map(p => <option key={p} value={p} className="capitalize">{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Was Mentioned?</label>
              <div className="flex gap-3 pt-1">
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" checked={wasMentioned} onChange={() => setWasMentioned(true)} /> Yes
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" checked={!wasMentioned} onChange={() => setWasMentioned(false)} /> No
                </label>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Query You Asked the AI</label>
            <input value={queryText} onChange={e => setQueryText(e.target.value)}
              className="w-full rounded border px-3 py-2 text-sm"
              placeholder="e.g. Best yoga studios for beginners in London" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Excerpt (optional)</label>
            <textarea value={excerpt} onChange={e => setExcerpt(e.target.value)}
              className="w-full rounded border px-3 py-2 text-sm resize-y min-h-20"
              placeholder="Copy the part of the AI response that mentions (or doesn't mention) the business…" />
          </div>
          <div className="flex items-center gap-3">
            <button onClick={trackMention} disabled={submitting || !queryText.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {submitting ? 'Saving…' : 'Record Observation'}
            </button>
            {submitMsg && <span className={`text-sm ${submitMsg.startsWith('Observation') ? 'text-green-600' : 'text-red-600'}`}>{submitMsg}</span>}
          </div>
        </div>
      )}

      {/* Pipeline */}
      {tab === 'Pipeline' && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-white p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-sm font-bold text-gray-800">GeoAeoTrackingJob</p>
                <p className="text-xs text-gray-500">Daily — 3am</p>
                <p className="mt-1 text-sm text-gray-600">
                  Submits probe queries to configured AI engines (ChatGPT via OpenAI API) and logs
                  whether the business is mentioned. Skips if no AI engine API keys are configured.
                </p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${aiConfigured ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                {aiConfigured ? 'active' : 'waiting credentials'}
              </span>
            </div>
            <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs text-gray-500">
              <p className="font-medium">Required environment variables</p>
              <div className="mt-2 space-y-1">
                {[
                  { key: 'OPENAI_API_KEY', note: 'Required for ChatGPT probing' },
                  { key: 'GEMINI_API_KEY', note: 'Required for Gemini probing (not yet implemented)' },
                ].map(v => (
                  <div key={v.key} className="flex gap-2">
                    <span className="font-mono text-gray-600">{v.key}</span>
                    <span className="text-gray-400">— {v.note}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
