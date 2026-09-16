'use client';
// /admin/platform-scenarios — Platform Scenario Registry & Feature Gating
// Tabs: scenarios | feature-gating | run-history | reviews | feedback | insights

import { useEffect, useState, useCallback, useRef } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Scenario {
  id: string; platform: string; feature_type: string; scenario_name: string;
  scenario_description: string | null; actor: string; trigger_type: string;
  steps: Step[]; input_fields: Field[]; output_type: string | null;
  api_endpoints: string[]; has_analytics: boolean; has_customer_feedback: boolean;
  has_review_capability: boolean; estimated_duration_seconds: number;
}
interface Step { step: number; action: string; ui_element?: string; api_call?: string; expected?: string; }
interface Field { name: string; label: string; type: string; required?: boolean; options?: string[]; }

interface Permission {
  id: string; platform: string; feature_type: string; feature_label: string;
  admin_enabled: boolean; customer_enabled: boolean; requires_approval: boolean;
  approval_mode: string; customer_daily_limit: number | null; customer_monthly_limit: number | null;
  notes: string | null; updated_at: string;
}

interface ScenarioRun {
  id: string; scenario_id: string; platform: string; feature_type: string;
  actor_type: string; actor_id: string; status: string;
  input_data: Record<string, unknown>; output_data: Record<string, unknown>;
  error_message: string | null; duration_ms: number | null;
  requires_approval: boolean; approved_by: string | null; approved_at: string | null;
  created_at: string; scenario_name?: string;
}

interface Review {
  id: string; platform: string; reviewer_name: string | null; rating: number | null;
  title: string | null; body: string; sentiment: string | null;
  response_text: string | null; responded_at: string | null;
  is_flagged: boolean; published_at: string | null; likes_count: number; helpful_count: number;
}

interface ReviewKpi {
  total: string; avg_rating: string | null; responded: string; negative_count: string;
}

interface FeedbackRow {
  id: string; platform: string; external_post_id: string | null; feedback_type: string;
  feedback_count: number; top_comments: Array<{author:string;text:string;likes:number;is_negative:boolean}>;
  sentiment_breakdown: Record<string,number>; fetched_at: string;
}

interface Insight {
  id: string; platform: string; insight_type: string; period: string; title: string;
  summary: string | null; recommendations: Array<{action:string;priority:string;expected_impact:string}>;
  generated_by: string; model_used: string | null; created_at: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ALL_PLATFORMS = [
  'apple_podcasts','bluesky','dailymotion','discord','dribbble','facebook','github','gitlab',
  'google_business','instagram','kijiji','linkedin','mastodon','medium','patreon','pinterest',
  'quora_manual','reddit','slack','snapchat','soundcloud','spotify','stack_overflow','substack',
  'telegram','threads','tiktok','tripadvisor','trustpilot','tumblr','twitch','vimeo',
  'whatsapp_business','x_twitter','yelp','youtube',
];

const PLATFORM_LABELS: Record<string,string> = {
  facebook:'Facebook',instagram:'Instagram',linkedin:'LinkedIn',youtube:'YouTube',
  x_twitter:'X / Twitter',tiktok:'TikTok',discord:'Discord',telegram:'Telegram',
  twitter:'Twitter',reddit:'Reddit',pinterest:'Pinterest',whatsapp_business:'WhatsApp Business',
  google_business:'Google Business',trustpilot:'Trustpilot',github:'GitHub',
  medium:'Medium',substack:'Substack',patreon:'Patreon',vimeo:'Vimeo',twitch:'Twitch',
  slack:'Slack',snapchat:'Snapchat',threads:'Threads',bluesky:'Bluesky',
  mastodon:'Mastodon',gitlab:'GitLab',dribbble:'Dribbble',soundcloud:'SoundCloud',
  spotify:'Spotify',apple_podcasts:'Apple Podcasts',tumblr:'Tumblr',
  quora_manual:'Quora',stack_overflow:'Stack Overflow',kijiji:'Kijiji',
  tripadvisor:'Tripadvisor',yelp:'Yelp',dailymotion:'Dailymotion',
};

const PLATFORM_COLORS: Record<string,string> = {
  youtube:'bg-red-100 text-red-700',facebook:'bg-blue-100 text-blue-700',
  instagram:'bg-pink-100 text-pink-700',x_twitter:'bg-gray-100 text-gray-800',
  linkedin:'bg-blue-200 text-blue-900',tiktok:'bg-slate-800 text-white',
  discord:'bg-indigo-100 text-indigo-700',reddit:'bg-orange-100 text-orange-700',
  google_business:'bg-green-100 text-green-700',trustpilot:'bg-emerald-100 text-emerald-700',
  github:'bg-gray-200 text-gray-900',
};

const ACTOR_COLORS: Record<string,string> = {
  admin:'bg-blue-100 text-blue-700', customer:'bg-green-100 text-green-700',
  both:'bg-purple-100 text-purple-700', system:'bg-gray-100 text-gray-600',
};

const STATUS_COLORS: Record<string,string> = {
  started:'bg-blue-100 text-blue-700', completed:'bg-green-100 text-green-700',
  failed:'bg-red-100 text-red-700', pending_approval:'bg-yellow-100 text-yellow-800',
};

const SENTIMENT_COLORS: Record<string,string> = {
  positive:'bg-green-100 text-green-700', neutral:'bg-gray-100 text-gray-600',
  negative:'bg-red-100 text-red-700',
};

const PRIORITY_COLORS: Record<string,string> = {
  high:'bg-red-100 text-red-700', medium:'bg-yellow-100 text-yellow-800', low:'bg-green-100 text-green-700',
};

const FEATURE_TYPES = [
  'text_post','image_post','video_post','campaign','review','feedback','insight',
  'story','reel','live','poll','dm','thread','article','event','newsletter',
  'playlist','community_post','group_post','inbox','shopping_post','carousel',
  'collab','space','document','duet','stitch','template_message','broadcast',
  'catalog','pin','idea_pin','rich_pin','thread_post','award','release',
  'discussion','gist','gbp_post','gbp_event','gbp_offer','photo_upload',
  'qa_answer','review_invitation','review_response','video_upload','showcase',
  'review_link','title_update','clip_share','embed_message','announcement',
  'response','note','patron_post','tier_management',
];

const TABS = [
  { key: 'scenarios', label: 'Scenarios' },
  { key: 'feature-gating', label: 'Feature Gating' },
  { key: 'run-history', label: 'Run History' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'feedback', label: 'Feedback' },
  { key: 'insights', label: 'Insights' },
];

// ── Small reusable components ─────────────────────────────────────────────────

function PlatformBadge({ platform }: { platform: string }) {
  const cls = PLATFORM_COLORS[platform] ?? 'bg-gray-100 text-gray-600';
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{PLATFORM_LABELS[platform] ?? platform}</span>;
}

function Badge({ label, colorCls }: { label: string; colorCls?: string }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorCls ?? 'bg-gray-100 text-gray-600'}`}>{label}</span>;
}

function Stars({ rating }: { rating: number | null }) {
  if (rating == null) return <span className="text-gray-400 text-xs">No rating</span>;
  const full = Math.round(rating);
  return <span className="text-yellow-500 text-sm">{'★'.repeat(full)}{'☆'.repeat(5-full)} <span className="text-gray-500 text-xs ml-1">{rating}</span></span>;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? 'bg-green-500' : 'bg-gray-300'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : 'translate-x-1'}`} />
    </button>
  );
}

function JsonBlock({ data }: { data: unknown }) {
  return <pre className="text-xs bg-gray-50 rounded p-2 overflow-auto max-h-40 whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>;
}

// ── Tab 1: Scenarios ──────────────────────────────────────────────────────────

function ScenariosTab() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState('');
  const [platform, setPlatform] = useState('');
  const [featureType, setFeatureType] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [runInputs, setRunInputs] = useState<Record<string, string>>({});
  const [runMsg, setRunMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (platform) params.set('platform', platform);
    if (featureType) params.set('feature_type', featureType);
    const res = await fetch(`/api/admin/platform-scenarios?${params}`);
    const data = await res.json() as { scenarios: Scenario[]; total: number };
    setScenarios(data.scenarios ?? []);
    setLoading(false);
  }, [platform, featureType]);

  useEffect(() => { void load(); }, [load]);

  async function handleSeed() {
    setSeeding(true); setSeedMsg('');
    const res = await fetch('/api/admin/platform-scenarios/seed', { method: 'POST' });
    const data = await res.json() as { scenarios: number; permissions: number };
    setSeedMsg(`Seeded ${data.scenarios} scenarios, ${data.permissions} permission rows.`);
    setSeeding(false);
    void load();
  }

  async function handleRun(s: Scenario) {
    setRunMsg('');
    const res = await fetch('/api/admin/platform-scenarios/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario_id: s.id, platform: s.platform, feature_type: s.feature_type, input_data: runInputs }),
    });
    const data = await res.json() as { run_id: string; status: string };
    setRunMsg(`Run ${data.status}: ${data.run_id}`);
    setRunningId(null);
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Platform</label>
          <select value={platform} onChange={e => setPlatform(e.target.value)} className="border rounded px-2 py-1 text-sm">
            <option value="">All platforms</option>
            {ALL_PLATFORMS.map(p => <option key={p} value={p}>{PLATFORM_LABELS[p] ?? p}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Feature Type</label>
          <select value={featureType} onChange={e => setFeatureType(e.target.value)} className="border rounded px-2 py-1 text-sm">
            <option value="">All types</option>
            {FEATURE_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <button onClick={() => void load()} className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">Filter</button>
        <button onClick={() => void handleSeed()} disabled={seeding} className="px-3 py-1.5 bg-emerald-600 text-white rounded text-sm hover:bg-emerald-700 disabled:opacity-50">
          {seeding ? 'Seeding…' : 'Seed All Scenarios'}
        </button>
        {seedMsg && <span className="text-sm text-green-600">{seedMsg}</span>}
      </div>

      <p className="text-sm text-gray-500">{scenarios.length} scenario{scenarios.length !== 1 ? 's' : ''} shown</p>

      {loading && <p className="text-sm text-gray-400">Loading…</p>}

      <div className="space-y-2">
        {scenarios.map(s => (
          <div key={s.id} className="border rounded-lg overflow-hidden">
            <button
              onClick={() => setExpanded(expanded === s.id ? null : s.id)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
            >
              <PlatformBadge platform={s.platform} />
              <Badge label={s.feature_type} colorCls="bg-slate-100 text-slate-700" />
              <span className="flex-1 text-sm font-medium text-gray-800">{s.scenario_name}</span>
              <Badge label={s.actor} colorCls={ACTOR_COLORS[s.actor]} />
              <Badge label={s.trigger_type} colorCls="bg-amber-50 text-amber-700" />
              {s.has_analytics && <span title="Analytics" className="text-xs text-blue-500">📊</span>}
              {s.has_review_capability && <span title="Reviews" className="text-xs text-yellow-500">⭐</span>}
              {s.has_customer_feedback && <span title="Feedback" className="text-xs text-green-500">💬</span>}
              <span className="text-gray-400 text-xs">{expanded === s.id ? '▲' : '▼'}</span>
            </button>

            {expanded === s.id && (
              <div className="border-t px-4 py-4 bg-gray-50 space-y-4">
                {s.scenario_description && <p className="text-sm text-gray-600">{s.scenario_description}</p>}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Steps */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Steps</h4>
                    <ol className="space-y-1">
                      {(s.steps ?? []).map(step => (
                        <li key={step.step} className="flex gap-2 text-sm">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">{step.step}</span>
                          <span className="text-gray-700">{step.action}{step.api_call ? <code className="ml-1 text-xs text-purple-600">{step.api_call}</code> : ''}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  {/* Input Fields */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Input Fields</h4>
                    <table className="text-xs w-full">
                      <thead><tr className="text-left text-gray-400"><th className="pr-2">Name</th><th className="pr-2">Type</th><th>Required</th></tr></thead>
                      <tbody>
                        {(s.input_fields ?? []).map(f => (
                          <tr key={f.name} className="border-t border-gray-100">
                            <td className="py-0.5 pr-2 font-mono text-purple-700">{f.name}</td>
                            <td className="pr-2 text-gray-600">{f.type}</td>
                            <td>{f.required ? <span className="text-red-500">Yes</span> : <span className="text-gray-400">No</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {s.api_endpoints?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">API Endpoints</h4>
                    <div className="flex flex-wrap gap-1">
                      {s.api_endpoints.map(ep => <code key={ep} className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded">{ep}</code>)}
                    </div>
                  </div>
                )}

                {s.output_type && (
                  <p className="text-xs text-gray-500">Output: <code className="text-purple-600">{s.output_type}</code> · Duration: ~{s.estimated_duration_seconds}s</p>
                )}

                {/* Run Panel */}
                {runningId === s.id ? (
                  <div className="border rounded p-3 bg-white space-y-3">
                    <h4 className="text-sm font-semibold text-gray-700">Run Scenario</h4>
                    {(s.input_fields ?? []).map(f => (
                      <div key={f.name}>
                        <label className="block text-xs text-gray-500 mb-0.5">{f.label}{f.required ? ' *' : ''}</label>
                        {f.type === 'select' ? (
                          <select
                            value={runInputs[f.name] ?? ''}
                            onChange={e => setRunInputs(p => ({ ...p, [f.name]: e.target.value }))}
                            className="border rounded px-2 py-1 text-sm w-full"
                          >
                            <option value="">-- select --</option>
                            {(f.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : f.type === 'textarea' ? (
                          <textarea
                            value={runInputs[f.name] ?? ''}
                            onChange={e => setRunInputs(p => ({ ...p, [f.name]: e.target.value }))}
                            className="border rounded px-2 py-1 text-sm w-full h-20"
                          />
                        ) : (
                          <input
                            type={f.type === 'datetime' ? 'datetime-local' : f.type}
                            value={runInputs[f.name] ?? ''}
                            onChange={e => setRunInputs(p => ({ ...p, [f.name]: e.target.value }))}
                            className="border rounded px-2 py-1 text-sm w-full"
                          />
                        )}
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <button onClick={() => void handleRun(s)} className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">Execute</button>
                      <button onClick={() => { setRunningId(null); setRunMsg(''); }} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-sm">Cancel</button>
                    </div>
                    {runMsg && <p className="text-xs text-green-600">{runMsg}</p>}
                  </div>
                ) : (
                  <button
                    onClick={() => { setRunningId(s.id); setRunInputs({}); setRunMsg(''); }}
                    className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-sm hover:bg-blue-100"
                  >
                    Run Scenario
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
        {!loading && scenarios.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">No scenarios found. Click &quot;Seed All Scenarios&quot; to populate.</p>
        )}
      </div>
    </div>
  );
}

// ── Tab 2: Feature Gating ────────────────────────────────────────────────────

function FeatureGatingTab() {
  const [platform, setPlatform] = useState('facebook');
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [changes, setChanges] = useState<Record<string, Partial<Permission>>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/platform-scenarios/permissions?platform=${platform}`);
    const data = await res.json() as { permissions: Permission[] };
    setPermissions(data.permissions ?? []);
    setChanges({});
    setLoading(false);
  }, [platform]);

  useEffect(() => { void load(); }, [load]);

  function update(id: string, field: keyof Permission, value: unknown) {
    setPermissions(p => p.map(r => r.id === id ? { ...r, [field]: value } : r));
    setChanges(c => ({ ...c, [id]: { ...c[id], id, [field]: value } }));
  }

  async function saveAll() {
    setSaving(true); setSaveMsg('');
    const updates = Object.values(changes);
    if (!updates.length) { setSaveMsg('No changes to save.'); setSaving(false); return; }
    const res = await fetch('/api/admin/platform-scenarios/permissions/bulk-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates }),
    });
    const data = await res.json() as { updated: number };
    setSaveMsg(`Saved ${data.updated} permission row(s).`);
    setSaving(false);
    setChanges({});
  }

  const customerOn = permissions.filter(p => p.customer_enabled).length;
  const needApproval = permissions.filter(p => p.customer_enabled && p.requires_approval).length;
  const adminOnly = permissions.filter(p => !p.customer_enabled).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Platform</label>
          <select value={platform} onChange={e => setPlatform(e.target.value)} className="border rounded px-2 py-1 text-sm">
            {ALL_PLATFORMS.map(p => <option key={p} value={p}>{PLATFORM_LABELS[p] ?? p}</option>)}
          </select>
        </div>
        <button onClick={() => void load()} className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">Load</button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-green-700">{customerOn}</div>
          <div className="text-xs text-green-600 mt-0.5">Customer Features Enabled</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-yellow-700">{needApproval}</div>
          <div className="text-xs text-yellow-600 mt-0.5">Require Approval</div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-gray-700">{adminOnly}</div>
          <div className="text-xs text-gray-600 mt-0.5">Admin Only</div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-500">
        <span>🔒 Admin Only</span>
        <span>👥 Both Admin &amp; Customer</span>
        <span>✅ No Approval Required</span>
        <span>⏳ Needs Approval</span>
      </div>

      {loading && <p className="text-sm text-gray-400">Loading…</p>}

      {permissions.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="text-left px-3 py-2">Feature</th>
                <th className="px-3 py-2">Admin</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Approval</th>
                <th className="px-3 py-2">Approval Mode</th>
                <th className="px-3 py-2">Daily Limit</th>
                <th className="text-left px-3 py-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {permissions.map((p, i) => (
                <tr key={p.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-800">{p.feature_label}</div>
                    <div className="text-xs text-gray-400">{p.feature_type}</div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className="text-green-600 font-bold">✓</span>
                    <span className="text-xs text-gray-400 ml-1">Locked</span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Toggle checked={p.customer_enabled} onChange={v => update(p.id, 'customer_enabled', v)} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    {p.customer_enabled
                      ? <Toggle checked={p.requires_approval} onChange={v => update(p.id, 'requires_approval', v)} />
                      : <span className="text-gray-300 text-xs">N/A</span>}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {p.customer_enabled && p.requires_approval ? (
                      <select
                        value={p.approval_mode}
                        onChange={e => update(p.id, 'approval_mode', e.target.value)}
                        className="border rounded px-1 py-0.5 text-xs"
                      >
                        <option value="none">none</option>
                        <option value="auto">auto</option>
                        <option value="manual">manual</option>
                      </select>
                    ) : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="number"
                      value={p.customer_daily_limit ?? ''}
                      onChange={e => update(p.id, 'customer_daily_limit', e.target.value ? Number(e.target.value) : null)}
                      className="border rounded px-1 py-0.5 text-xs w-16 text-center"
                      placeholder="∞"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={p.notes ?? ''}
                      onChange={e => update(p.id, 'notes', e.target.value)}
                      className="border rounded px-2 py-0.5 text-xs w-full"
                      placeholder="Notes…"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {permissions.length > 0 && (
        <div className="flex gap-3 items-center">
          <button onClick={() => void saveAll()} disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save All Changes'}
          </button>
          {saveMsg && <span className="text-sm text-green-600">{saveMsg}</span>}
          {Object.keys(changes).length > 0 && <span className="text-xs text-yellow-600">{Object.keys(changes).length} unsaved change(s)</span>}
        </div>
      )}

      {!loading && permissions.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-8">No permission rows for this platform. Seed scenarios first.</p>
      )}
    </div>
  );
}

// ── Tab 3: Run History ───────────────────────────────────────────────────────

function RunHistoryTab() {
  const [runs, setRuns] = useState<ScenarioRun[]>([]);
  const [pending, setPending] = useState<ScenarioRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [actorFilter, setActorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (actorFilter) params.set('actor_type', actorFilter);
    if (statusFilter) params.set('status', statusFilter);
    const [runsRes, pendingRes] = await Promise.all([
      fetch(`/api/admin/platform-scenarios/runs?${params}`),
      fetch('/api/admin/platform-scenarios/runs/pending-approvals'),
    ]);
    const [runsData, pendingData] = await Promise.all([
      runsRes.json() as Promise<{ runs: ScenarioRun[] }>,
      pendingRes.json() as Promise<{ runs: ScenarioRun[] }>,
    ]);
    setRuns(runsData.runs ?? []);
    setPending(pendingData.runs ?? []);
    setLoading(false);
  }, [actorFilter, statusFilter]);

  useEffect(() => { void load(); }, [load]);

  async function approve(id: string) {
    await fetch(`/api/admin/platform-scenarios/runs/${id}/approve`, { method: 'POST' });
    void load();
  }

  async function reject(id: string) {
    await fetch(`/api/admin/platform-scenarios/runs/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: rejectReason || 'Rejected by admin' }),
    });
    setRejectReason('');
    void load();
  }

  return (
    <div className="space-y-4">
      {/* Pending approvals */}
      {pending.length > 0 && (
        <div className="border border-yellow-200 rounded-lg bg-yellow-50 p-4 space-y-3">
          <h3 className="font-semibold text-yellow-800">Pending Approvals ({pending.length})</h3>
          {pending.map(r => (
            <div key={r.id} className="bg-white border border-yellow-200 rounded-lg p-3 space-y-2">
              <div className="flex flex-wrap gap-2 items-center">
                <PlatformBadge platform={r.platform} />
                <Badge label={r.feature_type} colorCls="bg-slate-100 text-slate-700" />
                <span className="text-sm text-gray-700">{r.scenario_name ?? '—'}</span>
                <span className="text-xs text-gray-400">{new Date(r.created_at).toLocaleString()}</span>
              </div>
              <JsonBlock data={r.input_data} />
              <div className="flex gap-2 items-center">
                <button onClick={() => void approve(r.id)} className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700">Approve</button>
                <input
                  type="text"
                  placeholder="Rejection reason…"
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  className="border rounded px-2 py-1 text-xs flex-1"
                />
                <button onClick={() => void reject(r.id)} className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700">Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select value={actorFilter} onChange={e => setActorFilter(e.target.value)} className="border rounded px-2 py-1 text-sm">
          <option value="">All actors</option>
          <option value="admin">Admin</option>
          <option value="customer">Customer</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border rounded px-2 py-1 text-sm">
          <option value="">All statuses</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="pending_approval">Pending Approval</option>
          <option value="started">Started</option>
        </select>
        <button onClick={() => void load()} className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm">Filter</button>
      </div>

      {loading && <p className="text-sm text-gray-400">Loading…</p>}

      <div className="space-y-1">
        {runs.map(r => (
          <div key={r.id} className="border rounded-lg overflow-hidden">
            <button
              onClick={() => setExpanded(expanded === r.id ? null : r.id)}
              className="w-full flex flex-wrap gap-2 items-center px-4 py-2.5 text-left hover:bg-gray-50"
            >
              <span className="text-xs text-gray-400 w-32 flex-shrink-0">{new Date(r.created_at).toLocaleString()}</span>
              <PlatformBadge platform={r.platform} />
              <Badge label={r.feature_type} colorCls="bg-slate-100 text-slate-700" />
              <Badge label={r.actor_type} colorCls={ACTOR_COLORS[r.actor_type]} />
              <span className="flex-1 text-sm text-gray-700">{r.scenario_name ?? '—'}</span>
              <Badge label={r.status} colorCls={STATUS_COLORS[r.status] ?? 'bg-gray-100 text-gray-600'} />
              {r.duration_ms != null && <span className="text-xs text-gray-400">{r.duration_ms}ms</span>}
            </button>
            {expanded === r.id && (
              <div className="border-t px-4 py-3 bg-gray-50 space-y-2">
                <div className="grid grid-cols-2 gap-4">
                  <div><h4 className="text-xs font-semibold text-gray-500 mb-1">Input</h4><JsonBlock data={r.input_data} /></div>
                  <div><h4 className="text-xs font-semibold text-gray-500 mb-1">Output</h4><JsonBlock data={r.output_data} /></div>
                </div>
                {r.error_message && <p className="text-xs text-red-600">Error: {r.error_message}</p>}
                {r.approved_by && <p className="text-xs text-gray-500">Approved by: {r.approved_by} at {r.approved_at ? new Date(r.approved_at).toLocaleString() : '—'}</p>}
              </div>
            )}
          </div>
        ))}
        {!loading && runs.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No run history yet.</p>}
      </div>
    </div>
  );
}

// ── Tab 4: Reviews ────────────────────────────────────────────────────────────

function ReviewsTab() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [kpi, setKpi] = useState<ReviewKpi | null>(null);
  const [platform, setPlatform] = useState('');
  const [rating, setRating] = useState('');
  const [sentiment, setSentiment] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [responseText, setResponseText] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (platform) params.set('platform', platform);
    if (rating) params.set('rating', rating);
    if (sentiment) params.set('sentiment', sentiment);
    const res = await fetch(`/api/admin/platform-scenarios/reviews?${params}`);
    const data = await res.json() as { reviews: Review[]; kpi: ReviewKpi };
    setReviews(data.reviews ?? []);
    setKpi(data.kpi ?? null);
    setLoading(false);
  }, [platform, rating, sentiment]);

  useEffect(() => { void load(); }, [load]);

  async function syncReviews() {
    setSyncing(true);
    await fetch('/api/admin/platform-scenarios/sync-reviews', { method: 'POST' });
    setSyncing(false);
    void load();
  }

  async function publishResponse(reviewId: string) {
    setSubmitting(reviewId);
    await fetch('/api/admin/platform-scenarios/review-response', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ review_id: reviewId, response_text: responseText[reviewId] }),
    });
    setSubmitting('');
    void load();
  }

  const responseRate = kpi ? (Number(kpi.responded) / Math.max(1, Number(kpi.total)) * 100).toFixed(0) : '0';

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      {kpi && (
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-white border rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-gray-800">{kpi.avg_rating ?? '—'}</div>
            <div className="text-xs text-gray-500 mt-0.5">Avg Rating</div>
          </div>
          <div className="bg-white border rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-blue-700">{kpi.total}</div>
            <div className="text-xs text-gray-500 mt-0.5">Total Reviews</div>
          </div>
          <div className="bg-white border rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-700">{responseRate}%</div>
            <div className="text-xs text-gray-500 mt-0.5">Response Rate</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-red-700">{kpi.negative_count}</div>
            <div className="text-xs text-red-500 mt-0.5">Negative Reviews</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Platform</label>
          <select value={platform} onChange={e => setPlatform(e.target.value)} className="border rounded px-2 py-1 text-sm">
            <option value="">All platforms</option>
            {ALL_PLATFORMS.map(p => <option key={p} value={p}>{PLATFORM_LABELS[p] ?? p}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Rating</label>
          <select value={rating} onChange={e => setRating(e.target.value)} className="border rounded px-2 py-1 text-sm">
            <option value="">All</option>
            {[5,4,3,2,1].map(r => <option key={r} value={String(r)}>{r} stars</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Sentiment</label>
          <select value={sentiment} onChange={e => setSentiment(e.target.value)} className="border rounded px-2 py-1 text-sm">
            <option value="">All</option>
            <option value="positive">Positive</option>
            <option value="neutral">Neutral</option>
            <option value="negative">Negative</option>
          </select>
        </div>
        <button onClick={() => void load()} className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm">Filter</button>
        <button onClick={() => void syncReviews()} disabled={syncing} className="px-3 py-1.5 bg-purple-600 text-white rounded text-sm disabled:opacity-50">
          {syncing ? 'Syncing…' : 'Sync Reviews (AI)'}
        </button>
      </div>

      {loading && <p className="text-sm text-gray-400">Loading…</p>}

      <div className="space-y-2">
        {reviews.map(r => (
          <div key={r.id} className="border rounded-lg overflow-hidden">
            <button
              onClick={() => setExpanded(expanded === r.id ? null : r.id)}
              className="w-full flex flex-wrap gap-2 items-center px-4 py-3 text-left hover:bg-gray-50"
            >
              <PlatformBadge platform={r.platform} />
              {r.published_at && <span className="text-xs text-gray-400">{new Date(r.published_at).toLocaleDateString()}</span>}
              <span className="text-sm text-gray-700 font-medium">{r.reviewer_name ?? 'Anonymous'}</span>
              <Stars rating={r.rating} />
              {r.sentiment && <Badge label={r.sentiment} colorCls={SENTIMENT_COLORS[r.sentiment]} />}
              <span className="flex-1 text-sm text-gray-500 truncate">{r.body.substring(0, 100)}</span>
              <Badge
                label={r.response_text ? 'Responded' : 'Pending'}
                colorCls={r.response_text ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}
              />
            </button>
            {expanded === r.id && (
              <div className="border-t px-4 py-4 bg-gray-50 space-y-3">
                {r.title && <h4 className="font-semibold text-gray-800">{r.title}</h4>}
                <p className="text-sm text-gray-700">{r.body}</p>
                {r.response_text && (
                  <div className="bg-blue-50 border border-blue-200 rounded p-3">
                    <p className="text-xs font-semibold text-blue-700 mb-1">Our Response</p>
                    <p className="text-sm text-blue-800">{r.response_text}</p>
                    {r.responded_at && <p className="text-xs text-blue-400 mt-1">{new Date(r.responded_at).toLocaleString()}</p>}
                  </div>
                )}
                <div className="space-y-2">
                  <textarea
                    value={responseText[r.id] ?? ''}
                    onChange={e => setResponseText(p => ({ ...p, [r.id]: e.target.value }))}
                    placeholder="Write a response…"
                    className="w-full border rounded px-3 py-2 text-sm h-24"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => void publishResponse(r.id)}
                      disabled={submitting === r.id || !responseText[r.id]?.trim()}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                    >
                      {submitting === r.id ? 'Publishing…' : 'Publish Response'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        {!loading && reviews.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">No reviews yet. Click &quot;Sync Reviews&quot; or add test data.</p>
        )}
      </div>
    </div>
  );
}

// ── Tab 5: Feedback ────────────────────────────────────────────────────────────

function FeedbackTab() {
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [platform, setPlatform] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState('');
  const [analysisResult, setAnalysisResult] = useState<Record<string, unknown>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/platform-scenarios/feedback${platform ? `?platform=${platform}` : ''}`);
    const data = await res.json() as { feedback: FeedbackRow[] };
    setFeedback(data.feedback ?? []);
    setLoading(false);
  }, [platform]);

  useEffect(() => { void load(); }, [load]);

  async function analyzeFeedback(row: FeedbackRow) {
    if (!row.external_post_id) return;
    setAnalyzing(row.id);
    const res = await fetch('/api/admin/platform-scenarios/analyze-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: row.platform, external_post_id: row.external_post_id }),
    });
    const data = await res.json() as { analysis: Record<string, unknown> };
    setAnalysisResult(p => ({ ...p, [row.id]: data.analysis }));
    setAnalyzing('');
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Platform</label>
          <select value={platform} onChange={e => setPlatform(e.target.value)} className="border rounded px-2 py-1 text-sm">
            <option value="">All platforms</option>
            {ALL_PLATFORMS.map(p => <option key={p} value={p}>{PLATFORM_LABELS[p] ?? p}</option>)}
          </select>
        </div>
        <button onClick={() => void load()} className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm">Filter</button>
      </div>

      {loading && <p className="text-sm text-gray-400">Loading…</p>}

      <div className="space-y-2">
        {feedback.map(row => (
          <div key={row.id} className="border rounded-lg overflow-hidden">
            <button
              onClick={() => setExpanded(expanded === row.id ? null : row.id)}
              className="w-full flex flex-wrap gap-2 items-center px-4 py-3 text-left hover:bg-gray-50"
            >
              <PlatformBadge platform={row.platform} />
              <Badge label={row.feedback_type} colorCls="bg-slate-100 text-slate-700" />
              <span className="text-sm text-gray-600">Count: <strong>{row.feedback_count}</strong></span>
              {row.sentiment_breakdown && Object.entries(row.sentiment_breakdown).map(([k, v]) => (
                <span key={k} className="text-xs text-gray-500">{k}: {v as number}</span>
              ))}
              <span className="text-xs text-gray-400">{new Date(row.fetched_at).toLocaleDateString()}</span>
            </button>
            {expanded === row.id && (
              <div className="border-t px-4 py-4 bg-gray-50 space-y-3">
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 mb-2">Sentiment Breakdown</h4>
                  <div className="flex gap-3 text-sm">
                    {Object.entries(row.sentiment_breakdown ?? {}).map(([k, v]) => (
                      <span key={k} className={`px-2 py-0.5 rounded-full text-xs ${SENTIMENT_COLORS[k] ?? 'bg-gray-100 text-gray-600'}`}>{k}: {v as number}</span>
                    ))}
                  </div>
                </div>
                {(row.top_comments ?? []).length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 mb-2">Top Comments</h4>
                    <div className="space-y-2">
                      {row.top_comments.map((c, i) => (
                        <div key={i} className="flex gap-2 text-sm">
                          <span className="font-medium text-gray-700 flex-shrink-0">{c.author}:</span>
                          <span className={`flex-1 ${c.is_negative ? 'text-red-600' : 'text-gray-600'}`}>{c.text}</span>
                          <span className="text-xs text-gray-400 flex-shrink-0">👍 {c.likes}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-2 items-center">
                  <button
                    onClick={() => void analyzeFeedback(row)}
                    disabled={analyzing === row.id || !row.external_post_id}
                    className="px-3 py-1.5 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 disabled:opacity-50"
                  >
                    {analyzing === row.id ? 'Analyzing…' : 'AI Sentiment Analysis'}
                  </button>
                </div>
                {analysisResult[row.id] !== undefined && (
                  <div className="bg-purple-50 border border-purple-200 rounded p-3">
                    <p className="text-xs font-semibold text-purple-700 mb-1">AI Analysis</p>
                    <JsonBlock data={analysisResult[row.id] as Record<string, unknown>} />
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {!loading && feedback.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">No feedback data yet.</p>
        )}
      </div>
    </div>
  );
}

// ── Tab 6: Insights ────────────────────────────────────────────────────────────

function InsightsTab() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [genPlatform, setGenPlatform] = useState('facebook');
  const [genType, setGenType] = useState('content_performance');
  const [genPeriod, setGenPeriod] = useState('this_month');
  const [genMsg, setGenMsg] = useState('');
  const [filterPlatform, setFilterPlatform] = useState('');
  const [filterType, setFilterType] = useState('');

  const INSIGHT_TYPES = ['content_performance','audience_growth','best_time','competitor','hashtag','sentiment','roi'];

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterPlatform) params.set('platform', filterPlatform);
    if (filterType) params.set('insight_type', filterType);
    const res = await fetch(`/api/admin/platform-scenarios/insights?${params}`);
    const data = await res.json() as { insights: Insight[] };
    setInsights(data.insights ?? []);
    setLoading(false);
  }, [filterPlatform, filterType]);

  useEffect(() => { void load(); }, [load]);

  async function generate() {
    setGenerating(true); setGenMsg('');
    const res = await fetch('/api/admin/platform-scenarios/generate-insight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: genPlatform, insight_type: genType, period: genPeriod }),
    });
    const data = await res.json() as { insight: Insight; error?: string };
    if (data.error) { setGenMsg(`Error: ${data.error}`); } else { setGenMsg(`Generated: "${data.insight?.title}"`); }
    setGenerating(false);
    void load();
  }

  return (
    <div className="space-y-4">
      {/* Generate form */}
      <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
        <h3 className="font-semibold text-gray-700">Generate AI Insight</h3>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Platform</label>
            <select value={genPlatform} onChange={e => setGenPlatform(e.target.value)} className="border rounded px-2 py-1 text-sm w-full">
              {ALL_PLATFORMS.map(p => <option key={p} value={p}>{PLATFORM_LABELS[p] ?? p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Insight Type</label>
            <select value={genType} onChange={e => setGenType(e.target.value)} className="border rounded px-2 py-1 text-sm w-full">
              {INSIGHT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Period</label>
            <select value={genPeriod} onChange={e => setGenPeriod(e.target.value)} className="border rounded px-2 py-1 text-sm w-full">
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="quarter">This Quarter</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <button onClick={() => void generate()} disabled={generating} className="px-4 py-2 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 disabled:opacity-50">
            {generating ? 'Generating via AI…' : 'Generate via AI'}
          </button>
          {genMsg && <span className="text-sm text-green-600">{genMsg}</span>}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)} className="border rounded px-2 py-1 text-sm">
          <option value="">All platforms</option>
          {ALL_PLATFORMS.map(p => <option key={p} value={p}>{PLATFORM_LABELS[p] ?? p}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="border rounded px-2 py-1 text-sm">
          <option value="">All types</option>
          {INSIGHT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
        </select>
        <button onClick={() => void load()} className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm">Filter</button>
      </div>

      {loading && <p className="text-sm text-gray-400">Loading…</p>}

      <div className="space-y-2">
        {insights.map(ins => (
          <div key={ins.id} className="border rounded-lg overflow-hidden">
            <button
              onClick={() => setExpanded(expanded === ins.id ? null : ins.id)}
              className="w-full flex flex-wrap gap-2 items-center px-4 py-3 text-left hover:bg-gray-50"
            >
              <PlatformBadge platform={ins.platform} />
              <Badge label={ins.insight_type.replace(/_/g,' ')} colorCls="bg-purple-100 text-purple-700" />
              <Badge label={ins.period} colorCls="bg-blue-50 text-blue-700" />
              <span className="flex-1 text-sm font-medium text-gray-800">{ins.title}</span>
              <Badge
                label={ins.generated_by}
                colorCls={ins.generated_by === 'ollama' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}
              />
              <span className="text-xs text-gray-400">{new Date(ins.created_at).toLocaleDateString()}</span>
            </button>
            {expanded === ins.id && (
              <div className="border-t px-4 py-4 bg-gray-50 space-y-3">
                {ins.summary && <p className="text-sm text-gray-700">{ins.summary}</p>}
                {(ins.recommendations ?? []).length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Recommendations</h4>
                    <div className="space-y-2">
                      {ins.recommendations.map((rec, i) => (
                        <div key={i} className="flex gap-2 items-start">
                          <Badge label={rec.priority} colorCls={PRIORITY_COLORS[rec.priority] ?? 'bg-gray-100 text-gray-600'} />
                          <div className="flex-1">
                            <p className="text-sm text-gray-700">{rec.action}</p>
                            <p className="text-xs text-gray-500 mt-0.5">Expected: {rec.expected_impact}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {ins.model_used && <p className="text-xs text-gray-400">Model: {ins.model_used}</p>}
              </div>
            )}
          </div>
        ))}
        {!loading && insights.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">No insights yet. Generate one above.</p>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PlatformScenariosPage() {
  const [tab, setTab] = useState('scenarios');

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Platform Scenario Registry</h1>
            <p className="text-sm text-gray-500 mt-1">36 platforms · Scenario catalog · Customer feature gating · Reviews · Feedback · AI Insights</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex overflow-x-auto">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  tab === t.key
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="bg-white rounded-lg border p-6">
          {tab === 'scenarios' && <ScenariosTab />}
          {tab === 'feature-gating' && <FeatureGatingTab />}
          {tab === 'run-history' && <RunHistoryTab />}
          {tab === 'reviews' && <ReviewsTab />}
          {tab === 'feedback' && <FeedbackTab />}
          {tab === 'insights' && <InsightsTab />}
        </div>
      </div>
    </div>
  );
}
