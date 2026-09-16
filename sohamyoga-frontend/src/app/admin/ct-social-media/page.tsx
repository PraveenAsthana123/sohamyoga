'use client';
import { useEffect, useState, useCallback } from 'react';

interface Kpi { label: string; value: number | string; target: number; trend: 'up' | 'down'; unit: string; }
interface ScheduledPost { id: number; platform?: string; content_preview?: string; scheduled_at?: string; status?: string; }
interface Platform { platform: string; posts: number; last_post?: string; }
interface CtData {
  health_score: number; traffic_light: 'red' | 'yellow' | 'green';
  kpis: Kpi[]; scheduled_posts: ScheduledPost[]; platforms: Platform[]; updated_at: string;
}

const TABS = ['Overview', 'Content Calendar', 'Platform Health', 'AI Advisor'] as const;
type Tab = typeof TABS[number];

const TL_BG = { red: 'bg-red-50 border-red-200', yellow: 'bg-amber-50 border-amber-200', green: 'bg-emerald-50 border-emerald-200' };
const TL_EMOJI = { red: '🔴', yellow: '🟡', green: '🟢' };

const PLATFORM_COLOR: Record<string, string> = {
  instagram: 'bg-pink-100 text-pink-800', facebook: 'bg-blue-100 text-blue-800',
  tiktok: 'bg-slate-800 text-white', youtube: 'bg-red-100 text-red-800',
  linkedin: 'bg-blue-800 text-white', twitter: 'bg-sky-100 text-sky-800',
};

function KpiCard({ kpi }: { kpi: Kpi }) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{kpi.label}</p>
      <p className="text-2xl font-bold mt-1">{kpi.value} <span className="text-sm text-gray-400">{kpi.unit}</span></p>
      <p className={`text-xs mt-2 font-medium ${kpi.trend === 'up' ? 'text-emerald-600' : 'text-red-500'}`}>
        {kpi.trend === 'up' ? '▲' : '▼'} Target: {kpi.target}
      </p>
    </div>
  );
}

export default function CtSocialMediaPage() {
  const [tab, setTab] = useState<Tab>('Overview');
  const [data, setData] = useState<CtData | null>(null);
  const [loading, setLoading] = useState(true);
  const [brief, setBrief] = useState('');
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/ct-social-media');
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const generateBrief = async () => {
    if (!data) return;
    setGenerating(true);
    setBrief('');
    try {
      const res = await fetch('/api/admin/ct-social-media/advisor', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ health_score: data.health_score, kpis: data.kpis }),
      });
      const json = await res.json();
      setBrief(json.brief ?? '');
    } finally { setGenerating(false); }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-gray-50"><p className="text-gray-500">Loading…</p></div>;

  const tl = data?.traffic_light ?? 'red';

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className={`rounded-xl border p-5 mb-6 ${TL_BG[tl]}`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Social Media Control Tower</h1>
              <p className="text-sm text-gray-500 mt-1">Posts · Accounts · TikTok Ads · Influencers · Community</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-4xl">{TL_EMOJI[tl]}</span>
              <div className="text-right">
                <p className="text-3xl font-bold">{data?.health_score ?? 0}<span className="text-base font-normal text-gray-400">/100</span></p>
                <p className="text-xs text-gray-400">Health Score</p>
              </div>
              <div className="text-right text-xs text-gray-400">
                <p>Last updated</p>
                <p>{data?.updated_at ? new Date(data.updated_at).toLocaleTimeString() : '—'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-1 mb-6 bg-white rounded-xl border p-1 w-fit">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              {t}
            </button>
          ))}
        </div>

        {tab === 'Overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {(data?.kpis ?? []).map(k => <KpiCard key={k.label} kpi={k} />)}
            </div>
            <div className="bg-white rounded-xl border p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Connected Platforms</h2>
              <div className="flex flex-wrap gap-2">
                {(data?.platforms ?? []).length === 0
                  ? <p className="text-sm text-gray-400">No platform data yet.</p>
                  : (data?.platforms ?? []).map(p => (
                      <span key={p.platform} className={`rounded-full px-3 py-1 text-xs font-semibold ${PLATFORM_COLOR[p.platform.toLowerCase()] ?? 'bg-gray-100 text-gray-700'}`}>
                        {p.platform} ({p.posts} posts)
                      </span>
                    ))
                }
              </div>
            </div>
          </div>
        )}

        {tab === 'Content Calendar' && (
          <div className="bg-white rounded-xl border p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Upcoming Scheduled Posts</h2>
            {(data?.scheduled_posts ?? []).length === 0
              ? <p className="text-sm text-gray-400">No scheduled posts found.</p>
              : <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-gray-400 border-b">
                    <th className="pb-2">Platform</th><th className="pb-2">Content Preview</th><th className="pb-2">Scheduled At</th><th className="pb-2">Status</th>
                  </tr></thead>
                  <tbody>
                    {(data?.scheduled_posts ?? []).map(p => (
                      <tr key={p.id} className="border-b last:border-0">
                        <td className="py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${PLATFORM_COLOR[(p.platform ?? '').toLowerCase()] ?? 'bg-gray-100 text-gray-700'}`}>{p.platform ?? '—'}</span></td>
                        <td className="py-2 max-w-xs truncate text-gray-600">{p.content_preview ?? '—'}</td>
                        <td className="py-2 text-gray-500">{p.scheduled_at ? new Date(p.scheduled_at).toLocaleString() : '—'}</td>
                        <td className="py-2"><span className="rounded-full px-2 py-0.5 text-xs bg-amber-100 text-amber-700">{p.status ?? 'scheduled'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            }
          </div>
        )}

        {tab === 'Platform Health' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(data?.platforms ?? []).length === 0
              ? <div className="col-span-3 bg-white rounded-xl border p-6 text-center text-gray-400 text-sm">No platform data yet. Posts in social_posts will appear here.</div>
              : (data?.platforms ?? []).map(p => (
                  <div key={p.platform} className="bg-white rounded-xl border p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${PLATFORM_COLOR[p.platform.toLowerCase()] ?? 'bg-gray-100 text-gray-700'}`}>{p.platform}</span>
                    </div>
                    <p className="text-2xl font-bold">{p.posts} <span className="text-sm text-gray-400">posts</span></p>
                    <p className="text-xs text-gray-400 mt-1">Last post: {p.last_post ? new Date(p.last_post).toLocaleDateString() : '—'}</p>
                  </div>
                ))
            }
          </div>
        )}

        {tab === 'AI Advisor' && (
          <div className="bg-white rounded-xl border p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-700">AI Social Media Advisor</h2>
                <p className="text-xs text-gray-400 mt-0.5">Powered by Ollama llama3.2</p>
              </div>
              <button onClick={generateBrief} disabled={generating}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-indigo-700">
                {generating ? 'Generating…' : 'Generate Analysis'}
              </button>
            </div>
            {brief
              ? <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">{brief}</div>
              : <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-400 text-sm">Click "Generate Analysis" to get AI-powered social media recommendations.</div>
            }
          </div>
        )}
      </div>
    </div>
  );
}
