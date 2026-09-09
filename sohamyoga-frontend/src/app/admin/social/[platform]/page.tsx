'use client';
// /admin/social/[platform] — per-platform admin page with the mandatory
// 10-tab Operational Portal standard (Manual/Pipeline/Agentic/Monitoring/
// Dashboard/Report/Governance/User Story/Testing/Log & Tracking), per the
// user's explicit requirement: "each social media should have separate
// page with list of tabs and each tab should have separate feature ...
// mandatory." One shared template serves every platform in PLATFORM_CONFIG
// (and beyond) with zero per-platform code.

import { Fragment, useEffect, useState } from 'react';

const TABS = ['manual', 'pipeline', 'agentic', 'monitoring', 'dashboard', 'report', 'governance', 'user-story', 'testing', 'log-tracking'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = {
  manual: 'Manual', pipeline: 'Pipeline', agentic: 'Agentic', monitoring: 'Monitoring',
  dashboard: 'Dashboard', report: 'Report', governance: 'Governance', 'user-story': 'User Story',
  testing: 'Testing', 'log-tracking': 'Log & Tracking',
};

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="mb-6 pb-5 border-b border-gray-100 last:border-none"><h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">{title}</h4>{children}</div>;
}
function Kpi({ label, value }: { label: string; value: string | number }) {
  return <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"><p className="text-xs text-gray-500">{label}</p><p className="text-2xl font-bold mt-1 text-blue-600">{value}</p></div>;
}

export default function PlatformSocialPage({ params }: { params: { platform: string } }) {
  const { platform } = params;
  const [activeTab, setActiveTab] = useState<Tab>('manual');
  const platformLabel = platform.charAt(0).toUpperCase() + platform.slice(1).replace(/_/g, ' ');

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="border-l-4 border-primary-600 pl-4">
          <h1 className="text-2xl font-bold">{platformLabel}</h1>
          <p className="text-sm text-gray-500">Manual / Pipeline (deterministic) / Agentic (local LLM) execution modes, real data throughout.</p>
        </header>

        <div className="flex gap-1 bg-white rounded-lg p-1 shadow-sm border border-gray-200 overflow-x-auto">
          {TABS.map((t) => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${activeTab === t ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {activeTab === 'manual' && <ManualTab platform={platform} platformLabel={platformLabel} />}
        {activeTab === 'pipeline' && <PipelineTab platform={platform} />}
        {activeTab === 'agentic' && <AgenticTab platform={platform} />}
        {activeTab === 'monitoring' && <MonitoringTab platform={platform} />}
        {activeTab === 'dashboard' && <DashboardTab platform={platform} />}
        {activeTab === 'report' && <ReportTab platform={platform} />}
        {activeTab === 'governance' && <GovernanceTab platformLabel={platformLabel} />}
        {activeTab === 'user-story' && <UserStoryTab platformLabel={platformLabel} />}
        {activeTab === 'testing' && <TestingTab platform={platform} />}
        {activeTab === 'log-tracking' && <LogTrackingTab platform={platform} />}
      </div>
    </div>
  );
}

// ── Manual ──────────────────────────────────────────────────────────────
interface DraftVariant { draft_id: string; platform: string; adapted_text: string; status: string }
interface Draft { id: string; master_text: string; status: string; generated_with_ai: boolean; created_at: string; variants: DraftVariant[] }

function ManualTab({ platform, platformLabel }: { platform: string; platformLabel: string }) {
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [connectedAccounts, setConnectedAccounts] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/social/drafts').then((r) => r.json()),
      fetch(`/api/admin/social/${platform}/dashboard`).then((r) => r.json()),
    ])
      .then(([d, dash]) => {
        setDrafts((d.drafts as Draft[]).filter((dr) => dr.variants.some((v) => v.platform === platform)));
        setConnectedAccounts(dash.kpis?.connectedAccounts ?? 0);
      })
      .catch((e) => setError(String(e)));
  }, [platform]);

  return (
    <div>
      <SubSection title="Goal & objective">
        <p className="text-sm text-gray-600">Manage {platformLabel} content end-to-end: review drafts, approve for publish, manage connected accounts — real human-controlled operation.</p>
      </SubSection>
      <SubSection title="Checklist">
        <ul className="text-sm text-gray-600 list-disc pl-5"><li>Connect at least one {platformLabel} account via Postiz OAuth</li><li>Review AI-generated or manually-written drafts before approval</li><li>Run Pipeline or Agentic for automated support</li></ul>
      </SubSection>
      <SubSection title="Input / Process / Output">
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <Kpi label="Connected Accounts" value={connectedAccounts ?? '…'} />
          <Kpi label={`Drafts targeting ${platformLabel}`} value={drafts?.length ?? '…'} />
        </div>
        {drafts && drafts.length === 0 && <p className="text-sm text-gray-500">No drafts target this platform yet. Create one via <a href="/admin/social/compose" className="text-blue-600 hover:underline">Compose</a>.</p>}
        {drafts && drafts.length > 0 && (
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr>{['Text', 'AI-generated', 'Status', 'Created'].map((h) => <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-50">
                {drafts.map((d) => (
                  <tr key={d.id}>
                    <td className="px-4 py-2 max-w-md truncate">{d.master_text}</td>
                    <td className="px-4 py-2">{d.generated_with_ai ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-2">{d.status}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">{new Date(d.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-gray-400 mt-3">Full approve/reject actions live on the <a href="/admin/social" className="text-blue-600 hover:underline">Social Portal</a> Approvals tab.</p>
      </SubSection>
    </div>
  );
}

// ── Pipeline (real deterministic: viral detection output + trending hashtags) ──
interface Signal { postId: string; excerpt: string | null; url: string | null; shareVelocity: number; likeVelocity: number; commentVelocity: number; zScore: number | null; viralScore: number; isViral: boolean; aiNote: string | null; computedAt: string }
interface Hashtag { hashtag: string; viralPostCount: number; avgViralScore: number }

function PipelineTab({ platform }: { platform: string }) {
  const [data, setData] = useState<{ connectedAccounts: number; publishedPosts: number; signals: Signal[] } | null>(null);
  const [hashtags, setHashtags] = useState<Hashtag[] | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/admin/social/${platform}/viral-signals`, { cache: 'no-store' })
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setData(d); })
      .catch((e) => setError(e.message));
  }, [platform]);

  const runHashtagDiscovery = async () => {
    setRunning(true); setError('');
    try {
      const res = await fetch(`/api/admin/social/${platform}/pipeline`, { method: 'POST' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setHashtags(body.hashtags);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setRunning(false); }
  };

  return (
    <div>
      <SubSection title="Goal & objective">
        <p className="text-sm text-gray-600">Real deterministic automation: viral-signal detection (ViralDetectionJob, statistical velocity vs. baseline) and trending-hashtag discovery, both computed from this platform&apos;s own real posts — no LLM involved.</p>
      </SubSection>
      <SubSection title="Trending hashtags (real, from this platform's viral posts)">
        <button onClick={runHashtagDiscovery} disabled={running} className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-md disabled:opacity-50">{running ? 'Running…' : 'Run Pipeline'}</button>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        {hashtags && (
          <div className="mt-3">
            {hashtags.length === 0 ? <p className="text-sm text-gray-500">No trending hashtags yet — needs at least one real viral-flagged post with hashtags.</p> : (
              <ul className="text-sm text-gray-700 space-y-1">{hashtags.map((h) => <li key={h.hashtag}>#{h.hashtag} — {h.viralPostCount} viral post(s), avg score {h.avgViralScore}</li>)}</ul>
            )}
          </div>
        )}
      </SubSection>
      {!data ? <p className="text-sm text-gray-500">Loading viral signals…</p> : (
        <SubSection title="Viral-signal detection output (real, computed daily)">
          {data.signals.length === 0 ? (
            <p className="text-sm text-gray-500">No posts with 2+ analytics snapshots yet — ViralDetectionJob needs real, repeated engagement data before it can compute a velocity.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-white">
              <table className="w-full text-sm">
                <thead className="bg-gray-50"><tr>{['Post', 'Share Vel/hr', 'Like Vel/hr', 'Z-Score', 'Score', 'Status'].map((h) => <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {data.signals.map((s) => (
                    <tr key={s.postId} className={s.isViral ? 'bg-green-50' : ''}>
                      <td className="px-4 py-2 max-w-xs truncate">{s.excerpt ?? s.postId.slice(0, 8)}</td>
                      <td className="px-4 py-2">{s.shareVelocity.toFixed(2)}</td>
                      <td className="px-4 py-2">{s.likeVelocity.toFixed(2)}</td>
                      <td className="px-4 py-2">{s.zScore !== null ? s.zScore.toFixed(1) : 'baseline pending'}</td>
                      <td className="px-4 py-2 font-semibold">{s.viralScore}</td>
                      <td className="px-4 py-2">{s.isViral ? <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Viral</span> : <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">Normal</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SubSection>
      )}
    </div>
  );
}

// ── Agentic (real: engagement advisor + existing amplify/lead-check) ──
function AgenticTab({ platform }: { platform: string }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ kpis: Record<string, number>; recommendation: string } | null>(null);
  const [error, setError] = useState('');

  const run = async () => {
    setRunning(true); setError(''); setResult(null);
    try {
      const res = await fetch(`/api/admin/social/${platform}/agentic`, { method: 'POST' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setResult(body);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setRunning(false); }
  };

  return (
    <div>
      <SubSection title="Goal & objective">
        <p className="text-sm text-gray-600">Real single-agent loop: reuses real KPIs (accounts, posts, viral count, avg clicks/impressions) as its &quot;search&quot; step, then a local Ollama model (llama3.2:3b) drafts one concrete engagement recommendation. Advisory only — never posts or edits anything automatically.</p>
      </SubSection>
      <SubSection title="Run engagement advisor">
        <button onClick={run} disabled={running} className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-md disabled:opacity-50">{running ? 'Agent running (up to 60s)…' : 'Run Agent'}</button>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        {result && (
          <div className="mt-4 rounded-xl border bg-white p-4">
            <p className="text-xs text-gray-500 mb-2">Real KPIs used: {JSON.stringify(result.kpis)}</p>
            <p className="text-sm text-gray-800">{result.recommendation}</p>
          </div>
        )}
      </SubSection>
      <SubSection title="Other real agentic features on this platform">
        <p className="text-sm text-gray-600">Viral amplification hooks and lead-correlation checks are available per-post from the <b>Pipeline</b> tab&apos;s viral-signal table on the original page layout, or via <a href="/admin/social" className="text-blue-600 hover:underline">the Social Portal</a>.</p>
      </SubSection>
    </div>
  );
}

// ── Monitoring ──
interface MonitoringData {
  ollama: { reachable: boolean; latencyMs: number; checkedAt: string };
  runs: { id: string; operation_type: string; operation_name: string; status: string; started_at: string }[];
  summary: { totalRuns: number; byType: Record<string, number>; runningNow: number };
  crisisSignal: { note: string; recentCrisisDays7d: number };
}
function MonitoringTab({ platform }: { platform: string }) {
  const [data, setData] = useState<MonitoringData | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    fetch(`/api/admin/social/${platform}/monitoring`).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setData(d); }).catch((e) => setError(String(e)));
  }, [platform]);
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-sm text-gray-500">Loading…</p>;
  return (
    <div>
      <SubSection title="Ollama health (live-pinged)">
        <p className="text-sm text-gray-600">{data.ollama.reachable ? `Reachable, ${data.ollama.latencyMs}ms` : 'Unreachable'} — checked {new Date(data.ollama.checkedAt).toLocaleString()}</p>
      </SubSection>
      <SubSection title="Operation runs">
        <div className="grid grid-cols-3 gap-4"><Kpi label="Total runs" value={data.summary.totalRuns} /><Kpi label="Running now" value={data.summary.runningNow} /><Kpi label="Recent site-wide crises (7d)" value={data.crisisSignal.recentCrisisDays7d} /></div>
        <p className="text-xs text-gray-400 mt-2">{data.crisisSignal.note}</p>
      </SubSection>
      <SubSection title="Recent runs">
        <table className="w-full text-sm"><thead><tr>{['When', 'Type', 'Operation', 'Status'].map((h) => <th key={h} className="text-left text-xs text-gray-500 px-2 py-1">{h}</th>)}</tr></thead>
          <tbody>{data.runs.slice(0, 20).map((r) => <tr key={r.id} className="border-t border-gray-50"><td className="px-2 py-1">{new Date(r.started_at).toLocaleString()}</td><td className="px-2 py-1">{r.operation_type}</td><td className="px-2 py-1">{r.operation_name}</td><td className="px-2 py-1">{r.status}</td></tr>)}</tbody>
        </table>
        {data.runs.length === 0 && <p className="text-sm text-gray-500">No operations logged yet.</p>}
      </SubSection>
    </div>
  );
}

// ── Dashboard ──
interface DashboardData { kpis: { connectedAccounts: number; publishedPosts: number; viralPosts30d: number; avgClicksPerPost: number; avgImpressionsPerPost: number; totalConversions: number; totalOperationRuns: number }; sentiment30d: Record<string, number> }
function DashboardTab({ platform }: { platform: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    fetch(`/api/admin/social/${platform}/dashboard`).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setData(d); }).catch((e) => setError(String(e)));
  }, [platform]);
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-sm text-gray-500">Loading…</p>;
  return (
    <div>
      <SubSection title="Volume & engagement">
        <div className="grid grid-cols-3 gap-4">
          <Kpi label="Connected Accounts" value={data.kpis.connectedAccounts} />
          <Kpi label="Published Posts" value={data.kpis.publishedPosts} />
          <Kpi label="Viral Posts (30d)" value={data.kpis.viralPosts30d} />
          <Kpi label="Avg Clicks/Post" value={data.kpis.avgClicksPerPost} />
          <Kpi label="Avg Impressions/Post" value={data.kpis.avgImpressionsPerPost} />
          <Kpi label="Total Conversions" value={data.kpis.totalConversions} />
        </div>
      </SubSection>
      <SubSection title="Customer sentiment (30d, real sentiment_log)">
        <div className="grid grid-cols-3 gap-4"><Kpi label="Positive" value={data.sentiment30d.positive ?? 0} /><Kpi label="Neutral" value={data.sentiment30d.neutral ?? 0} /><Kpi label="Negative" value={data.sentiment30d.negative ?? 0} /></div>
      </SubSection>
    </div>
  );
}

// ── Report ──
interface ReportRow { postId: string; excerpt: string | null; publishedAt: string | null; impressions: number; reach: number; clicks: number; likes: number; comments: number; shares: number; saves: number; conversions: number; followerDelta: number }
function ReportTab({ platform }: { platform: string }) {
  const [data, setData] = useState<{ generatedAt: string; totalRows: number; posts: ReportRow[] } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    fetch(`/api/admin/social/${platform}/report`).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setData(d); }).catch((e) => setError(String(e)));
  }, [platform]);
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-sm text-gray-500">Loading…</p>;
  return (
    <SubSection title={`Post analytics report — ${data.totalRows} row(s)`}>
      <p className="text-xs text-gray-400 mb-2">Generated {new Date(data.generatedAt).toLocaleString()}</p>
      {data.posts.length === 0 ? <p className="text-sm text-gray-500">No analytics snapshots yet.</p> : (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr>{['Post', 'Impressions', 'Reach', 'Clicks', 'Likes', 'Comments', 'Shares', 'Saves', 'Conversions', 'Follower Δ'].map((h) => <th key={h} className="px-3 py-2 text-left text-xs text-gray-500">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-50">
              {data.posts.map((p) => (
                <tr key={p.postId}><td className="px-3 py-2 max-w-xs truncate">{p.excerpt ?? p.postId.slice(0, 8)}</td><td className="px-3 py-2">{p.impressions}</td><td className="px-3 py-2">{p.reach}</td><td className="px-3 py-2">{p.clicks}</td><td className="px-3 py-2">{p.likes}</td><td className="px-3 py-2">{p.comments}</td><td className="px-3 py-2">{p.shares}</td><td className="px-3 py-2">{p.saves}</td><td className="px-3 py-2">{p.conversions}</td><td className="px-3 py-2">{p.followerDelta}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SubSection>
  );
}

// ── Governance ──
function GovernanceTab({ platformLabel }: { platformLabel: string }) {
  const [sub, setSub] = useState('resai');
  const SUBS: { id: string; label: string; content: React.ReactNode }[] = [
    { id: 'resai', label: 'ResAI', content: <p>The Agentic tab drafts an engagement recommendation from real, live-queried KPIs. Viral amplification and lead-correlation are separately real (see ViralAmplificationGenerator.ts, viral/[postId]/leads route).</p> },
    { id: 'expai', label: 'ExpAI', content: <p>Model: llama3.2:3b (engagement advisor) / configurable strong-tier model for amplification hooks, via local Ollama (cron/OllamaClient.ts). No cloud tokens consumed.</p> },
    { id: 'govai', label: 'GovAI', content: <p>All AI calls logged via the real observability infra (operation_run/operation_event/model_invocation) under component_key=&apos;soham-social&apos;, registered 2026-09-09.</p> },
    { id: 'fairness', label: 'Fairness AI', content: <p>Not applicable in a people-scoring sense — this pipeline scores post/platform performance, not individuals. No bias vector identified.</p> },
    { id: 'accountable', label: 'Accountable AI', content: <p>Every run records a real actor_id (admin principal). Draft-to-publish requires human approval (ContentDraft state machine, social_mcp_approval_log) — no AI-generated content publishes without a human step.</p> },
    { id: 'decision', label: 'Decision AI', content: <p>The Pipeline tab&apos;s viral-signal table shows the real statistical inputs (share/like/comment velocity, z-score) behind every viral classification — fully transparent, not a black box.</p> },
    { id: 'compliance', label: 'Compliance AI', content: <p>sentiment_log can contain real customer text (reviews, comments, DMs) — a real PII consideration. No formal retention policy verified for this table.</p> },
    { id: 'regulation', label: 'Regulation AI', content: <p>Not implemented — no jurisdiction-aware handling for {platformLabel} content or sentiment data.</p> },
    { id: 'risk', label: 'Risk AI', content: <p>Known gap: crisis_signal has no platform column, so platform-specific crisis detection is not possible with current schema — disclosed honestly in the Monitoring tab rather than fabricated.</p> },
  ];
  return (
    <div>
      <div className="flex gap-1 flex-wrap mb-4">{SUBS.map((s) => <button key={s.id} onClick={() => setSub(s.id)} className={`px-3 py-1 rounded text-xs font-medium ${sub === s.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{s.label}</button>)}</div>
      <div className="text-sm text-gray-700 bg-white rounded-xl border p-4">{SUBS.find((s) => s.id === sub)?.content}</div>
    </div>
  );
}

// ── User Story ──
function UserStoryTab({ platformLabel }: { platformLabel: string }) {
  const STORIES = [
    { role: 'Content Editor', want: `to see all drafts targeting ${platformLabel} and their approval status`, so: 'I know what is pending review', status: 'Built — Manual tab' },
    { role: 'Growth/Marketing', want: 'real trending hashtags and viral-signal detection specific to this platform', so: 'I can act on what is actually working, not a guess', status: 'Built — Pipeline tab' },
    { role: 'Growth/Marketing', want: 'an AI agent to recommend a next action from this platform\'s real performance data', so: 'I get a fast, grounded suggestion', status: 'Built — Agentic tab' },
    { role: 'Admin', want: 'real-time Ollama health and operation history for this platform', so: 'I know the automation is actually working', status: 'Built — Monitoring tab' },
  ];
  return (
    <SubSection title="User stories">
      {STORIES.map((s, i) => (
        <div key={i} className="bg-white rounded-xl border p-4 mb-3">
          <p className="text-sm text-gray-700"><b>As a</b> {s.role}, <b>I want</b> {s.want}, <b>so that</b> {s.so}.</p>
          <p className="text-xs text-gray-400 mt-1">{s.status}</p>
        </div>
      ))}
    </SubSection>
  );
}

// ── Testing ──
interface TestRun { id: string; operation_name: string; status: string; started_at: string }
function TestingTab({ platform }: { platform: string }) {
  const [runs, setRuns] = useState<TestRun[] | null>(null);
  useEffect(() => {
    fetch(`/api/admin/social/${platform}/log-tracking`).then((r) => r.json()).then((d) => setRuns((d.runs || []).filter((r: { operation_type: string }) => r.operation_type === 'test'))).catch(() => setRuns([]));
  }, [platform]);
  return (
    <SubSection title="Test executions">
      <p className="text-sm text-gray-600 mb-3">No dedicated test_execution table exists in this codebase yet — live verification runs are tagged operation_type=&apos;test&apos; in the shared operation_run table and shown here.</p>
      {runs === null && <p className="text-sm text-gray-500">Loading…</p>}
      {runs && runs.length === 0 && <p className="text-sm text-gray-500">No tagged test runs yet for this platform.</p>}
      {runs && runs.length > 0 && (
        <table className="w-full text-sm"><thead><tr>{['When', 'Case', 'Status'].map((h) => <th key={h} className="text-left text-xs text-gray-500 px-2 py-1">{h}</th>)}</tr></thead>
          <tbody>{runs.map((r) => <tr key={r.id} className="border-t border-gray-50"><td className="px-2 py-1">{new Date(r.started_at).toLocaleString()}</td><td className="px-2 py-1">{r.operation_name}</td><td className="px-2 py-1">{r.status}</td></tr>)}</tbody>
        </table>
      )}
    </SubSection>
  );
}

// ── Log & Tracking ──
interface LogRun { id: string; operation_type: string; operation_name: string; status: string; started_at: string; completed_at: string | null; duration_ms: string | null; errorMessage: string | null; events: { severity: string; message: string; occurred_at: string }[] }
function LogTrackingTab({ platform }: { platform: string }) {
  const [runs, setRuns] = useState<LogRun[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    fetch(`/api/admin/social/${platform}/log-tracking`).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setRuns(d.runs); }).catch((e) => setError(String(e)));
  }, [platform]);
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!runs) return <p className="text-sm text-gray-500">Loading…</p>;
  return (
    <SubSection title="Operation log & audit trail">
      {runs.length === 0 && <p className="text-sm text-gray-500">No operations logged yet.</p>}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr>{['When', 'Type', 'Operation', 'Status', 'Duration', 'Error'].map((h) => <th key={h} className="px-3 py-2 text-left text-xs text-gray-500">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-50">
            {runs.map((r) => (
              <Fragment key={r.id}>
                <tr>
                  <td className="px-3 py-2">{new Date(r.started_at).toLocaleString()}</td>
                  <td className="px-3 py-2">{r.operation_type}</td>
                  <td className="px-3 py-2">{r.operation_name}</td>
                  <td className="px-3 py-2">{r.status}</td>
                  <td className="px-3 py-2">{r.duration_ms ? `${r.duration_ms}ms` : '—'}</td>
                  <td className="px-3 py-2 text-red-600">{r.errorMessage ?? '—'}</td>
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </SubSection>
  );
}
