'use client';
import { useEffect, useState } from 'react';

type Tab = 'overview' | 'campaigns' | 'adgroups' | 'creatives' | 'health' | 'analytics' | 'ai' | 'pixels' | 'integrations';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview',      label: 'Overview'      },
  { id: 'campaigns',     label: 'Campaigns'     },
  { id: 'adgroups',      label: 'Ad Groups'     },
  { id: 'creatives',     label: 'Creatives'     },
  { id: 'health',        label: 'Health'        },
  { id: 'analytics',     label: 'Analytics'     },
  { id: 'ai',            label: 'AI Engine'     },
  { id: 'pixels',        label: 'Pixels'        },
  { id: 'integrations',  label: 'Integrations'  },
];

interface PixelRow { platform: 'meta_pixel' | 'ga4'; pixel_id: string | null; enabled: boolean; updated_at: string }

function PixelsTab() {
  const [rows, setRows] = useState<PixelRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { pixelId: string; enabled: boolean }>>({
    meta_pixel: { pixelId: '', enabled: false },
    ga4: { pixelId: '', enabled: false },
  });
  const [saving, setSaving] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = () => {
    fetch('/api/admin/tracking-pixels').then(r => r.ok ? r.json() : null).then(d => {
      if (!d?.config) return;
      setRows(d.config);
      const next = { ...drafts };
      for (const row of d.config as PixelRow[]) next[row.platform] = { pixelId: row.pixel_id ?? '', enabled: row.enabled };
      setDrafts(next);
      setLoaded(true);
    });
  };
  useEffect(() => { load(); }, []);

  const save = async (platform: 'meta_pixel' | 'ga4') => {
    setSaving(platform);
    await fetch('/api/admin/tracking-pixels', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, pixelId: drafts[platform].pixelId, enabled: drafts[platform].enabled }),
    });
    load();
    setSaving(null);
  };

  const platforms: { key: 'meta_pixel' | 'ga4'; label: string; placeholder: string }[] = [
    { key: 'meta_pixel', label: 'Meta Pixel (Facebook/Instagram retargeting)', placeholder: 'e.g. 1234567890123456' },
    { key: 'ga4', label: 'Google Analytics 4 (GA4 Measurement ID)', placeholder: 'e.g. G-XXXXXXXXXX' },
  ];

  return (
    <div className="space-y-5">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        Real embed, no fabrication: nothing fires on the public site unless (1) a real ID is saved and enabled here, AND
        (2) the visitor has given <strong>marketing</strong>-level consent in the cookie banner. Before this, `grep`-ing the
        codebase for `fbq(` / `gtag(&apos;config&apos;` returned zero hits anywhere.
      </div>
      {platforms.map(p => {
        const row = rows.find(r => r.platform === p.key);
        return (
          <div key={p.key} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-3">
            <h3 className="font-semibold text-gray-900">{p.label}</h3>
            <div className="flex gap-3 items-center flex-wrap">
              <input
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 min-w-[220px]"
                placeholder={p.placeholder}
                value={drafts[p.key]?.pixelId ?? ''}
                onChange={e => setDrafts({ ...drafts, [p.key]: { ...drafts[p.key], pixelId: e.target.value } })}
              />
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={drafts[p.key]?.enabled ?? false}
                  onChange={e => setDrafts({ ...drafts, [p.key]: { ...drafts[p.key], enabled: e.target.checked } })}
                />
                Enabled
              </label>
              <button
                className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white disabled:opacity-50"
                disabled={saving === p.key}
                onClick={() => save(p.key)}
              >
                {saving === p.key ? 'Saving…' : 'Save'}
              </button>
            </div>
            {loaded && (
              <div className="text-xs text-gray-500">
                {row?.enabled && row.pixel_id
                  ? `Live: embeds on every public page once a visitor consents to marketing tracking. Last updated ${new Date(row.updated_at).toLocaleString()}.`
                  : 'Not configured — no script embeds today.'}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface DashboardData {
  kpis: { activeCampaigns: number; totalSpend: number; totalImpressions: number; totalClicks: number; conversions: number; avgCtrPct: number; avgCpc: number; avgCpm: number; avgCpa: number };
  funnel: { impressions: number; clicks: number; conversions: number };
  spendByType: { type: string; spend: number; pct: number }[];
  aiEngine: { adsGenerated: number; keywordCount: number; healthFindings: number };
}
interface AttributionData {
  windowDays: number;
  byChannel: { channel: string; conversions: number; pct: number }[];
}
interface CampaignRow { id: string; name: string; type: string; platform: string; status: string; budget: number; startDate: string | null; endDate: string | null; impressions: number; clicks: number; ctr: number; cpc: number }

const PLATFORM_LABELS: Record<string, string> = {
  google_ads: 'Google Ads', meta_ads: 'Meta Ads', tiktok_ads: 'TikTok Ads',
  linkedin_ads: 'LinkedIn Ads', snapchat_ads: 'Snapchat Ads', other: 'Other',
};
interface AudienceRow { id: string; audienceType: string; segmentKey: string; segmentValue: string; bidAdjustment: number | null; isExcluded: boolean }
interface AdGroupRow { id: string; name: string; campaign: string; status: string; keywords: number; ads: number; bid: number; ctr: number }
interface CreativeRow { id: string; name: string; type: string; status: string; ai: boolean; impressions: number; clicks: number; ctr: number; cpc: number }
interface HealthFinding {
  id: string; campaignId: string; campaignName: string; findingKey: string; severity: string;
  summary: string; recommendedAction: string; status: string; createdAt: string;
}

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  warning:  'bg-amber-100 text-amber-700',
  info:     'bg-blue-100 text-blue-700',
};

const HEALTH_FLOW = [
  { label: '1. Hourly audit', sub: 'CampaignHealthAuditJob queries active campaigns', color: 'bg-gray-50 border-gray-200 text-gray-800' },
  { label: '2. Compute facts', sub: 'SQL only — no ad groups, no targeting, expired, bid > budget', color: 'bg-blue-50 border-blue-200 text-blue-800' },
  { label: '3. Ollama explains', sub: 'Writes summary from given facts only, never invents a metric', color: 'bg-amber-50 border-amber-200 text-amber-800' },
  { label: '4. Finding created', sub: "status='open', one per issue per campaign", color: 'bg-purple-50 border-purple-200 text-purple-800' },
  { label: '5. Admin reviews', sub: 'Acknowledge or resolve — auto-resolves if fixed next run', color: 'bg-green-50 border-green-200 text-green-800' },
];

function ProcessFlow({ steps }: { steps: { label: string; sub: string; color: string }[] }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <h3 className="font-semibold text-gray-900 mb-4">Process Flow</h3>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-sm text-center">
        {steps.map((n, i) => (
          <div key={n.label} className="flex flex-col items-center gap-1">
            <div className={`w-full border rounded-xl p-3 ${n.color}`}>
              <p className="font-semibold text-xs">{n.label}</p>
              <p className="text-xs opacity-70 mt-0.5">{n.sub}</p>
            </div>
            {i < steps.length - 1 && <span className="text-gray-300 hidden md:block text-xs">→</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function HealthTab() {
  const [findings, setFindings] = useState<HealthFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);

  const load = () => {
    setLoading(true);
    fetchJson<{ findings: HealthFinding[] }>(`/api/ads/health-findings?status=${showResolved ? 'all' : 'open'}`)
      .then(d => { setFindings(d?.findings ?? []); setLoading(false); });
  };
  useEffect(load, [showResolved]);

  async function decide(id: string, action: 'acknowledge' | 'resolve') {
    await fetch(`/api/ads/health-findings/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
    });
    load();
  }

  return (
    <div className="space-y-4">
      <ProcessFlow steps={HEALTH_FLOW} />
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Automated config audit (runs hourly) — structural problems only, no fabricated performance data.
        </p>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={showResolved} onChange={e => setShowResolved(e.target.checked)} />
          Show acknowledged/resolved
        </label>
      </div>

      {loading ? <EmptyState message="Loading…" /> : findings.length === 0 ? (
        <EmptyState message="No open health findings — every active campaign passed the structural audit." />
      ) : (
        <div className="space-y-3">
          {findings.map(f => (
            <div key={f.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_BADGE[f.severity] ?? 'bg-gray-100 text-gray-600'}`}>{f.severity}</span>
                    <span className="text-xs text-gray-400 font-mono">{f.findingKey}</span>
                    <span className="text-xs text-gray-400">·</span>
                    <span className="text-xs text-gray-500 font-medium">{f.campaignName}</span>
                    {f.status !== 'open' && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{f.status}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-800">{f.summary}</p>
                  <p className="text-xs text-gray-500 mt-1">→ {f.recommendedAction}</p>
                </div>
                {f.status === 'open' && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => decide(f.id, 'acknowledge')} className="rounded border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50">Acknowledge</button>
                    <button onClick={() => decide(f.id, 'resolve')} className="rounded bg-green-700 px-3 py-1 text-xs font-medium text-white hover:bg-green-800">Resolve</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

function EmptyState({ message }: { message: string }) {
  return <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-500 text-sm">{message}</div>;
}

const STATUS_BADGE: Record<string, string> = {
  active:       'bg-green-100 text-green-700',
  paused:       'bg-amber-100 text-amber-700',
  draft:        'bg-gray-100 text-gray-600',
  archived:     'bg-gray-100 text-gray-500',
  ended:        'bg-red-100 text-red-600',
  removed:      'bg-red-100 text-red-600',
  under_review: 'bg-blue-100 text-blue-700',
};

const TYPE_BADGE: Record<string, string> = {
  search:           'bg-blue-50 text-blue-700',
  display:          'bg-purple-50 text-purple-700',
  video:            'bg-rose-50 text-rose-700',
  shopping:         'bg-amber-50 text-amber-700',
  app:              'bg-teal-50 text-teal-700',
  responsive_search:'bg-blue-50 text-blue-700',
  banner:           'bg-purple-50 text-purple-700',
  image:            'bg-green-50 text-green-700',
};

// ── Component ─────────────────────────────────────────────────────────────────

const AUDIENCE_TYPES = ['geo', 'device', 'language', 'interest', 'custom', 'lookalike'];

// Real audience-targeting rules per campaign -- ad_audience previously had
// zero API routes or UI referencing it despite existing in the schema.
// Manual rule entry only; no lookalike-modeling computation and no
// ad-platform sync (no connected account in this environment).
const MATCH_TYPES = ['broad', 'phrase', 'exact'];

interface KeywordRow { id: string; text: string; matchType: string; bidAdjustmentPercent: number | null; isNegative: boolean }

// Real Keyword Management -- ad_keyword existed in the schema with zero
// create/edit routes anywhere (only ever read for a dashboard count).
// Manual keyword entry only -- no keyword-research/search-volume data
// source is connected in this environment.
function KeywordManagementModal({ adGroup, onClose }: { adGroup: AdGroupRow; onClose: () => void }) {
  const [keywords, setKeywords] = useState<KeywordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [matchType, setMatchType] = useState('broad');
  const [isNegative, setIsNegative] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    fetchJson<{ keywords: KeywordRow[] }>(`/api/ads/adgroups/${adGroup.id}/keywords`)
      .then(d => setKeywords(d?.keywords ?? [])).finally(() => setLoading(false));
  };
  useEffect(load, [adGroup.id]);

  async function addKeyword() {
    setError('');
    const res = await fetch(`/api/ads/adgroups/${adGroup.id}/keywords`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, matchType, isNegative }),
    });
    const body = await res.json();
    if (!res.ok) { setError(body.error || 'Failed to add keyword.'); return; }
    setText(''); setIsNegative(false);
    load();
  }

  async function removeKeyword(keywordId: string) {
    await fetch(`/api/ads/adgroups/${adGroup.id}/keywords/${keywordId}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-lg space-y-3 rounded-xl bg-white p-5 shadow-lg">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-gray-900">Keywords — {adGroup.name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="flex gap-2">
          <input placeholder="keyword" value={text} onChange={e => setText(e.target.value)} className="flex-1 rounded border p-2 text-sm" />
          <select value={matchType} onChange={e => setMatchType(e.target.value)} className="rounded border p-2 text-sm">
            {MATCH_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <label className="flex items-center gap-1 text-xs text-gray-600">
            <input type="checkbox" checked={isNegative} onChange={e => setIsNegative(e.target.checked)} /> negative
          </label>
          <button onClick={addKeyword} disabled={!text.trim()} className="rounded bg-amber-500 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Add</button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {loading ? <p className="text-sm text-gray-400">Loading…</p> : (
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {keywords.map(k => (
              <div key={k.id} className="flex justify-between items-center rounded border p-2 text-sm">
                <span>
                  {k.isNegative && <span className="text-red-500 mr-1">−</span>}
                  {k.text} <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 ml-1">{k.matchType}</span>
                </span>
                <button onClick={() => removeKeyword(k.id)} className="text-xs text-red-500 hover:underline">Remove</button>
              </div>
            ))}
            {!keywords.length && <p className="text-xs text-gray-400">No keywords yet — add one above.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

interface BudgetEventRow { id: string; eventType: string; amountCents: number; dailyBudgetCents: number | null; recordedBy: string; createdAt: string }

// Real Budget Allocation -- ad_budget_event existed with zero writers.
// Each event both logs the change AND actually updates the campaign's real
// daily_budget_cents in the same DB transaction.
function BudgetModal({ campaign, onClose, onChanged }: { campaign: CampaignRow; onClose: () => void; onChanged: () => void }) {
  const [events, setEvents] = useState<BudgetEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventType, setEventType] = useState<'budget_increase' | 'budget_decrease'>('budget_increase');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    fetchJson<{ events: BudgetEventRow[] }>(`/api/ads/campaigns/${campaign.id}/budget-events`)
      .then(d => setEvents(d?.events ?? [])).finally(() => setLoading(false));
  };
  useEffect(load, [campaign.id]);

  async function submit() {
    setError('');
    const res = await fetch(`/api/ads/campaigns/${campaign.id}/budget-events`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType, amountCents: Math.round(Number(amount) * 100) }),
    });
    const body = await res.json();
    if (!res.ok) { setError(body.error || 'Failed to record budget event.'); return; }
    setAmount('');
    load();
    onChanged();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-lg space-y-3 rounded-xl bg-white p-5 shadow-lg">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-gray-900">Budget — {campaign.name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <p className="text-sm text-gray-600">Current daily budget: ₹{campaign.budget}</p>
        <div className="flex gap-2">
          <select value={eventType} onChange={e => setEventType(e.target.value as typeof eventType)} className="rounded border p-2 text-sm">
            <option value="budget_increase">Increase</option>
            <option value="budget_decrease">Decrease</option>
          </select>
          <input type="number" min="0.01" step="0.01" placeholder="Amount" value={amount} onChange={e => setAmount(e.target.value)} className="flex-1 rounded border p-2 text-sm" />
          <button onClick={submit} disabled={!amount || Number(amount) <= 0} className="rounded bg-amber-500 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Apply</button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {loading ? <p className="text-sm text-gray-400">Loading…</p> : (
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {events.map(e => (
              <div key={e.id} className="flex justify-between items-center rounded border p-2 text-sm">
                <span>
                  <span className={`text-xs px-1.5 py-0.5 rounded mr-2 ${e.eventType === 'budget_increase' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{e.eventType}</span>
                  ₹{(e.amountCents / 100).toFixed(2)} by {e.recordedBy}
                </span>
                <span className="text-xs text-gray-400">{new Date(e.createdAt).toLocaleString()}</span>
              </div>
            ))}
            {!events.length && <p className="text-xs text-gray-400">No budget events yet.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

const BIDDING_STRATEGIES = ['manual_cpc', 'target_cpa', 'target_roas', 'maximize_clicks', 'maximize_conversions'] as const;
const DEVICE_TARGETS = ['desktop', 'mobile', 'tablet', 'tv'] as const;

function BiddingPlacementModal({ campaign, onClose }: { campaign: CampaignRow; onClose: () => void }) {
  const [biddingStrategy, setBiddingStrategy] = useState<string>('manual_cpc');
  const [deviceTargets, setDeviceTargets] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchJson<{ biddingStrategy: string; deviceTargets: string[] }>(`/api/ads/campaigns/${campaign.id}/settings`)
      .then(d => { if (d) { setBiddingStrategy(d.biddingStrategy); setDeviceTargets(d.deviceTargets); } })
      .finally(() => setLoading(false));
  }, [campaign.id]);

  function toggleDevice(d: string) {
    setDeviceTargets(list => list.includes(d) ? list.filter(x => x !== d) : [...list, d]);
  }

  async function save() {
    setError(''); setSaved(false);
    const res = await fetch(`/api/ads/campaigns/${campaign.id}/settings`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ biddingStrategy, deviceTargets }),
    });
    const body = await res.json();
    if (!res.ok) { setError(body.error || 'Failed to save.'); return; }
    setSaved(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-lg space-y-3 rounded-xl bg-white p-5 shadow-lg">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-gray-900">Bidding & Placement — {campaign.name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        {loading ? <p className="text-sm text-gray-400">Loading…</p> : (
          <>
            <div>
              <label className="text-xs font-medium text-gray-500">Bidding strategy</label>
              <select value={biddingStrategy} onChange={e => setBiddingStrategy(e.target.value)} className="mt-1 w-full rounded border p-2 text-sm">
                {BIDDING_STRATEGIES.map(s => <option key={s} value={s}>{s.replaceAll('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Device placement</label>
              <div className="mt-1 flex gap-3 flex-wrap">
                {DEVICE_TARGETS.map(d => (
                  <label key={d} className="flex items-center gap-1.5 text-sm">
                    <input type="checkbox" checked={deviceTargets.includes(d)} onChange={() => toggleDevice(d)} />
                    {d}
                  </label>
                ))}
              </div>
              {!deviceTargets.length && <p className="mt-1 text-xs text-amber-600">No devices selected — ads will not show on any placement.</p>}
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex items-center gap-2">
              <button onClick={save} className="rounded bg-amber-500 px-3 py-2 text-sm font-medium text-white">Save</button>
              {saved && <span className="text-xs text-green-600">Saved.</span>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AudienceTargetingModal({ campaign, onClose }: { campaign: CampaignRow; onClose: () => void }) {
  const [audiences, setAudiences] = useState<AudienceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [audienceType, setAudienceType] = useState('geo');
  const [segmentKey, setSegmentKey] = useState('');
  const [segmentValue, setSegmentValue] = useState('');
  const [error, setError] = useState('');
  const [rtUrlPattern, setRtUrlPattern] = useState('');
  const [rtReach, setRtReach] = useState<number | null>(null);
  const [rtChecking, setRtChecking] = useState(false);

  const load = () => {
    setLoading(true);
    fetchJson<{ audiences: AudienceRow[] }>(`/api/ads/campaigns/${campaign.id}/audiences`)
      .then(d => setAudiences(d?.audiences ?? [])).finally(() => setLoading(false));
  };
  useEffect(load, [campaign.id]);

  async function addRule() {
    setError('');
    const res = await fetch(`/api/ads/campaigns/${campaign.id}/audiences`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audienceType, segmentKey, segmentValue }),
    });
    const body = await res.json();
    if (!res.ok) { setError(body.error || 'Failed to add rule.'); return; }
    setSegmentKey(''); setSegmentValue('');
    load();
  }

  async function removeRule(audienceId: string) {
    await fetch(`/api/ads/campaigns/${campaign.id}/audiences/${audienceId}`, { method: 'DELETE' });
    load();
  }

  async function previewReach() {
    if (!rtUrlPattern.trim()) return;
    setRtChecking(true);
    const d = await fetchJson<{ reach: number }>(`/api/ads/retargeting/preview?urlPattern=${encodeURIComponent(rtUrlPattern.trim())}&days=30`);
    setRtReach(d?.reach ?? 0);
    setRtChecking(false);
  }

  async function saveRetargeting() {
    setError('');
    const res = await fetch(`/api/ads/campaigns/${campaign.id}/audiences`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audienceType: 'custom', segmentKey: 'site_visitor_url', segmentValue: rtUrlPattern.trim() }),
    });
    const body = await res.json();
    if (!res.ok) { setError(body.error || 'Failed to save retargeting audience.'); return; }
    setRtUrlPattern(''); setRtReach(null);
    load();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-lg space-y-3 rounded-xl bg-white p-5 shadow-lg">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-gray-900">Audience Targeting — {campaign.name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="flex gap-2">
          <select value={audienceType} onChange={e => setAudienceType(e.target.value)} className="rounded border p-2 text-sm">
            {AUDIENCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input placeholder="key (e.g. city)" value={segmentKey} onChange={e => setSegmentKey(e.target.value)} className="flex-1 rounded border p-2 text-sm" />
          <input placeholder="value (e.g. Vancouver)" value={segmentValue} onChange={e => setSegmentValue(e.target.value)} className="flex-1 rounded border p-2 text-sm" />
          <button onClick={addRule} disabled={!segmentKey.trim() || !segmentValue.trim()} className="rounded bg-amber-500 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Add</button>
        </div>

        <div className="rounded-lg border border-dashed border-gray-300 p-3 space-y-2">
          <p className="text-sm font-medium text-gray-700">Retargeting — build from real site visitors</p>
          <div className="flex gap-2">
            <input placeholder="URL path, e.g. /booking" value={rtUrlPattern} onChange={e => { setRtUrlPattern(e.target.value); setRtReach(null); }} className="flex-1 rounded border p-2 text-sm" />
            <button onClick={previewReach} disabled={!rtUrlPattern.trim() || rtChecking} className="rounded bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 disabled:opacity-50">
              {rtChecking ? 'Checking…' : 'Preview reach'}
            </button>
          </div>
          {rtReach !== null && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">{rtReach} distinct visitor{rtReach === 1 ? '' : 's'} to matching URLs in the last 30 days.</span>
              <button onClick={saveRetargeting} disabled={rtReach === 0} className="rounded bg-amber-500 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">Save as audience</button>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {loading ? <p className="text-sm text-gray-400">Loading…</p> : (
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {audiences.map(a => (
              <div key={a.id} className="flex justify-between items-center rounded border p-2 text-sm">
                <span><span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 mr-2">{a.audienceType}</span>{a.segmentKey} = {a.segmentValue}{a.isExcluded ? ' (excluded)' : ''}</span>
                <button onClick={() => removeRule(a.id)} className="text-xs text-red-500 hover:underline">Remove</button>
              </div>
            ))}
            {!audiences.length && <p className="text-xs text-gray-400">No targeting rules yet — add one above.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdsAdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [statusFilter, setStatusFilter] = useState('all');

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [attribution, setAttribution] = useState<AttributionData | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [adGroups, setAdGroups] = useState<AdGroupRow[]>([]);
  const [creatives, setCreatives] = useState<CreativeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [newCampaign, setNewCampaign] = useState({ name: '', campaignType: 'search', platform: 'google_ads', dailyBudget: '50', startDate: '', endDate: '' });
  const [createError, setCreateError] = useState('');
  const [targetingCampaign, setTargetingCampaign] = useState<CampaignRow | null>(null);
  const [keywordAdGroup, setKeywordAdGroup] = useState<AdGroupRow | null>(null);
  const [budgetCampaign, setBudgetCampaign] = useState<CampaignRow | null>(null);
  const [biddingCampaign, setBiddingCampaign] = useState<CampaignRow | null>(null);

  useEffect(() => {
    Promise.all([
      fetchJson<DashboardData>('/api/ads/dashboard'),
      fetchJson<{ adGroups: AdGroupRow[] }>('/api/ads/adgroups'),
      fetchJson<{ creatives: CreativeRow[] }>('/api/ads/creatives'),
      fetchJson<AttributionData>('/api/analytics/attribution?days=30'),
    ]).then(([dash, groups, cre, attr]) => {
      setDashboard(dash);
      setAdGroups(groups?.adGroups ?? []);
      setCreatives(cre?.creatives ?? []);
      setAttribution(attr);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const qs = statusFilter === 'all' ? '' : `?status=${statusFilter}`;
    fetchJson<{ campaigns: CampaignRow[] }>(`/api/ads/campaigns${qs}`).then(d => setCampaigns(d?.campaigns ?? []));
  }, [statusFilter]);

  const filteredCampaigns = campaigns;
  const kpis = dashboard?.kpis;

  async function createCampaign(e: React.FormEvent) {
    e.preventDefault();
    setCreateError('');
    const res = await fetch('/api/ads/campaigns', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newCampaign.name, campaignType: newCampaign.campaignType, platform: newCampaign.platform, dailyBudget: Number(newCampaign.dailyBudget),
        startDate: newCampaign.startDate || undefined, endDate: newCampaign.endDate || undefined,
      }),
    });
    const body = await res.json();
    if (!res.ok) { setCreateError(body.error || 'Failed to create campaign.'); return; }
    setShowNewCampaign(false);
    setNewCampaign({ name: '', campaignType: 'search', platform: 'google_ads', dailyBudget: '50', startDate: '', endDate: '' });
    const qs = statusFilter === 'all' ? '' : `?status=${statusFilter}`;
    fetchJson<{ campaigns: CampaignRow[] }>(`/api/ads/campaigns${qs}`).then(d => setCampaigns(d?.campaigns ?? []));
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Ads Management</h1>
            <p className="text-sm text-gray-500 mt-1">
              Wave 15 · Revive Adserver · Prebid.js · PostHog · Ollama · ComfyUI · GrowthBook
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowNewCampaign(true)} className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors">
              + New Campaign
            </button>
            <button disabled title="Not built yet — no image-generation service (e.g. ComfyUI) is connected in this environment." className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg font-medium opacity-40 cursor-not-allowed">
              AI Generate Ad
            </button>
          </div>
        </div>

        {showNewCampaign && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
            <form onSubmit={createCampaign} className="w-full max-w-md space-y-3 rounded-xl bg-white p-5 shadow-lg">
              <h3 className="font-semibold text-gray-900">New Campaign</h3>
              <label className="block text-sm">Name
                <input required className="mt-1 w-full rounded border p-2" value={newCampaign.name} onChange={e => setNewCampaign({ ...newCampaign, name: e.target.value })} />
              </label>
              <label className="block text-sm">Type
                <select className="mt-1 w-full rounded border p-2" value={newCampaign.campaignType} onChange={e => setNewCampaign({ ...newCampaign, campaignType: e.target.value })}>
                  {['search', 'display', 'video', 'shopping', 'app'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label className="block text-sm">Platform
                <select className="mt-1 w-full rounded border p-2" value={newCampaign.platform} onChange={e => setNewCampaign({ ...newCampaign, platform: e.target.value })}>
                  {Object.entries(PLATFORM_LABELS).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                </select>
              </label>
              <label className="block text-sm">Daily budget (USD)
                <input required type="number" min="1" step="0.01" className="mt-1 w-full rounded border p-2" value={newCampaign.dailyBudget} onChange={e => setNewCampaign({ ...newCampaign, dailyBudget: e.target.value })} />
              </label>
              <div className="flex gap-2">
                <label className="block text-sm flex-1">Start date
                  <input type="date" className="mt-1 w-full rounded border p-2" value={newCampaign.startDate} onChange={e => setNewCampaign({ ...newCampaign, startDate: e.target.value })} />
                </label>
                <label className="block text-sm flex-1">End date (optional)
                  <input type="date" min={newCampaign.startDate || undefined} className="mt-1 w-full rounded border p-2" value={newCampaign.endDate} onChange={e => setNewCampaign({ ...newCampaign, endDate: e.target.value })} />
                </label>
              </div>
              {createError && <p className="text-sm text-red-600">{createError}</p>}
              <p className="text-xs text-gray-400">Creates a real draft campaign. No ad-platform account is connected in this environment, so it will not launch to Google/Meta/TikTok — it is a real local record you can review and extend.</p>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowNewCampaign(false)} className="rounded px-3 py-1.5 text-sm text-gray-500">Cancel</button>
                <button type="submit" className="rounded bg-amber-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-600">Create draft</button>
              </div>
            </form>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-xl shadow-sm p-1 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Overview ── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {[
                { label: 'Active Campaigns',  value: String(kpis?.activeCampaigns ?? 0), color: 'text-amber-600' },
                { label: 'Total Spend',       value: `₹${(kpis?.totalSpend ?? 0).toLocaleString()}`, color: 'text-red-600' },
                { label: 'Total Impressions', value: (kpis?.totalImpressions ?? 0).toLocaleString(), color: 'text-blue-600' },
                { label: 'Total Clicks',      value: (kpis?.totalClicks ?? 0).toLocaleString(), sub: `Avg CTR ${kpis?.avgCtrPct ?? 0}%`, color: 'text-green-600' },
                { label: 'Conversions',       value: (kpis?.conversions ?? 0).toLocaleString(), color: 'text-purple-600' },
                { label: 'Avg CPC',           value: `₹${kpis?.avgCpc ?? 0}`, color: 'text-indigo-600' },
              ].map(k => (
                <div key={k.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <p className="text-xs text-gray-500">{k.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${k.color}`}>{k.value}</p>
                  {k.sub && <p className="text-xs text-gray-400 mt-1">{k.sub}</p>}
                </div>
              ))}
            </div>

            {/* Architecture flow */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Architecture — Ads Flow</h3>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-3 text-sm text-center">
                {[
                  { label: 'Campaign Manager', sub: 'Next.js admin', color: 'bg-blue-50 border-blue-200 text-blue-800' },
                  { label: 'Ad Server',         sub: 'Revive Adserver', color: 'bg-amber-50 border-amber-200 text-amber-800' },
                  { label: 'Header Bidding',    sub: 'Prebid.js + Prebid Server', color: 'bg-purple-50 border-purple-200 text-purple-800' },
                  { label: 'AI Generation',     sub: 'Ollama + ComfyUI', color: 'bg-green-50 border-green-200 text-green-800' },
                  { label: 'Analytics',         sub: 'PostHog', color: 'bg-rose-50 border-rose-200 text-rose-800' },
                  { label: 'A/B Testing',       sub: 'GrowthBook', color: 'bg-teal-50 border-teal-200 text-teal-800' },
                ].map((n, i) => (
                  <div key={n.label} className="flex flex-col items-center gap-1">
                    <div className={`w-full border rounded-xl p-3 ${n.color}`}>
                      <p className="font-semibold text-xs">{n.label}</p>
                      <p className="text-xs opacity-70 mt-0.5">{n.sub}</p>
                    </div>
                    {i < 5 && <span className="text-gray-300 hidden md:block text-xs">→</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Spend by campaign type */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Spend by Campaign Type</h3>
              {!dashboard?.spendByType.length ? <EmptyState message={loading ? 'Loading…' : 'No ad spend recorded yet.'} /> : (
              <div className="space-y-3">
                {dashboard.spendByType.map(s => (
                  <div key={s.type} className="flex items-center gap-3 text-sm">
                    <span className="w-16 text-gray-600 capitalize">{s.type}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                      <div className="bg-amber-400 h-2.5 rounded-full" style={{ width: `${s.pct}%` }} />
                    </div>
                    <span className="text-gray-700 w-20 text-right">₹{s.spend.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              )}
            </div>
          </div>
        )}

        {/* ── Campaigns ── */}
        {activeTab === 'campaigns' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex gap-3">
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300">
                <option value="all">All Statuses</option>
                {['active','paused','draft','archived','ended'].map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>

            {filteredCampaigns.length === 0 ? <EmptyState message="No campaigns match this filter." /> : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>{['ID','Name','Type','Platform','Status','Schedule','Budget/day','Impressions','Clicks','CTR','CPC','Targeting'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredCampaigns.map(c => (
                    <tr key={c.id} className="hover:bg-amber-50/30 transition-colors cursor-pointer">
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.id.slice(0, 8)}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_BADGE[c.type] ?? 'bg-gray-100 text-gray-600'}`}>{c.type}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">{PLATFORM_LABELS[c.platform] ?? c.platform}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[c.status] ?? 'bg-gray-100 text-gray-600'}`}>{c.status}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {c.startDate ? new Date(c.startDate).toLocaleDateString() : '—'}
                        {c.endDate ? ` – ${new Date(c.endDate).toLocaleDateString()}` : ''}
                      </td>
                      <td className="px-4 py-3">₹{c.budget}</td>
                      <td className="px-4 py-3">{c.impressions ? c.impressions.toLocaleString() : '—'}</td>
                      <td className="px-4 py-3">{c.clicks ? c.clicks.toLocaleString() : '—'}</td>
                      <td className="px-4 py-3">{c.ctr ? `${c.ctr}%` : '—'}</td>
                      <td className="px-4 py-3">{c.cpc ? `₹${c.cpc}` : '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => setTargetingCampaign(c)} className="text-xs text-amber-600 hover:underline">Targeting</button>
                          <button onClick={() => setBudgetCampaign(c)} className="text-xs text-blue-600 hover:underline">Budget</button>
                          <button onClick={() => setBiddingCampaign(c)} className="text-xs text-purple-600 hover:underline">Bidding</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
            {budgetCampaign && (
              <BudgetModal
                campaign={budgetCampaign}
                onClose={() => setBudgetCampaign(null)}
                onChanged={() => {
                  const qs = statusFilter === 'all' ? '' : `?status=${statusFilter}`;
                  fetchJson<{ campaigns: CampaignRow[] }>(`/api/ads/campaigns${qs}`).then(d => setCampaigns(d?.campaigns ?? []));
                }}
              />
            )}
          </div>
        )}
        {targetingCampaign && <AudienceTargetingModal campaign={targetingCampaign} onClose={() => setTargetingCampaign(null)} />}
        {biddingCampaign && <BiddingPlacementModal campaign={biddingCampaign} onClose={() => setBiddingCampaign(null)} />}

        {/* ── Ad Groups ── */}
        {activeTab === 'adgroups' && (
          adGroups.length === 0 ? <EmptyState message={loading ? 'Loading…' : 'No ad groups yet.'} /> :
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>{['ID','Ad Group','Campaign','Status','Keywords','Ads','Default Bid','CTR',''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {adGroups.map(g => (
                  <tr key={g.id} className="hover:bg-amber-50/30 transition-colors cursor-pointer">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{g.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{g.name}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{g.campaign}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[g.status] ?? 'bg-gray-100 text-gray-600'}`}>{g.status}</span>
                    </td>
                    <td className="px-4 py-3">{g.keywords}</td>
                    <td className="px-4 py-3">{g.ads}</td>
                    <td className="px-4 py-3">₹{g.bid}</td>
                    <td className="px-4 py-3">{g.ctr}%</td>
                    <td className="px-4 py-3">
                      <button onClick={() => setKeywordAdGroup(g)} className="text-xs text-amber-600 hover:underline">Keywords</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {keywordAdGroup && <KeywordManagementModal adGroup={keywordAdGroup} onClose={() => setKeywordAdGroup(null)} />}

        {/* ── Creatives ── */}
        {activeTab === 'creatives' && (
          <div className="space-y-4">
          <DynamicAdBuilder adGroups={adGroups} onCreated={() => fetchJson<{ creatives: CreativeRow[] }>('/api/ads/creatives').then(d => setCreatives(d?.creatives ?? []))} />
          {creatives.length === 0 ? <EmptyState message={loading ? 'Loading…' : 'No ad creatives yet.'} /> :
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {creatives.map(ad => (
              <div key={ad.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{ad.name}</p>
                    <div className="flex gap-1.5 mt-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${TYPE_BADGE[ad.type] ?? 'bg-gray-100 text-gray-600'}`}>{ad.type}</span>
                      {ad.ai && <span className="text-xs px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-medium">AI</span>}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[ad.status]}`}>{ad.status}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-xs text-gray-500">Impressions</p><p className="font-semibold">{ad.impressions ? ad.impressions.toLocaleString() : '—'}</p></div>
                  <div><p className="text-xs text-gray-500">Clicks</p><p className="font-semibold">{ad.clicks ? ad.clicks.toLocaleString() : '—'}</p></div>
                  <div><p className="text-xs text-gray-500">CTR</p><p className={`font-semibold ${ad.ctr > 3 ? 'text-green-600' : 'text-gray-700'}`}>{ad.ctr ? `${ad.ctr}%` : '—'}</p></div>
                  <div><p className="text-xs text-gray-500">CPC</p><p className="font-semibold">{ad.cpc ? `₹${ad.cpc}` : '—'}</p></div>
                </div>
              </div>
            ))}
          </div>
          }
          </div>
        )}

        {/* ── Health ── */}
        {activeTab === 'health' && <HealthTab />}

        {/* ── Analytics ── */}
        {activeTab === 'analytics' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Avg CTR', value: `${kpis?.avgCtrPct ?? 0}%`,    color: 'text-blue-600'   },
                { label: 'Avg CPC', value: `₹${kpis?.avgCpc ?? 0}`,       color: 'text-green-600'  },
                { label: 'Avg CPM', value: `₹${dashboard?.kpis.avgCpm ?? 0}`, color: 'text-purple-600' },
                { label: 'Avg CPA', value: `₹${dashboard?.kpis.avgCpa ?? 0}`, color: 'text-amber-600'  },
              ].map(m => (
                <div key={m.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <p className="text-xs text-gray-500">{m.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${m.color}`}>{m.value}</p>
                </div>
              ))}
            </div>

            {/* Conversion funnel — real advertisement impression/click/conversion sums.
                No "landing page" / "add to cart" step: no ad-click-to-page-visit link
                exists without a connected ad platform, so only what's actually
                measurable end-to-end is shown. */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Conversion Funnel — All Time</h3>
              {!dashboard?.funnel.impressions ? (
                <EmptyState message={loading ? 'Loading…' : 'No impression data yet — connect an ad platform to populate this funnel.'} />
              ) : (
                <div className="space-y-2">
                  {(() => {
                    const { impressions, clicks, conversions } = dashboard.funnel;
                    return [
                      { step: 'Impressions', count: impressions, pct: 100 },
                      { step: 'Clicks',      count: clicks,      pct: impressions ? Math.round((clicks / impressions) * 10000) / 100 : 0 },
                      { step: 'Converted',   count: conversions, pct: impressions ? Math.round((conversions / impressions) * 10000) / 100 : 0 },
                    ];
                  })().map(f => (
                    <div key={f.step} className="flex items-center gap-3 text-sm">
                      <span className="text-gray-600 w-40 flex-shrink-0">{f.step}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-3">
                        <div className="bg-amber-400 h-3 rounded-full" style={{ width: `${f.pct}%` }} />
                      </div>
                      <span className="text-gray-500 w-20 text-right">{f.count.toLocaleString()}</span>
                      <span className="text-gray-400 w-12 text-right text-xs">{f.pct}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Attribution — real site-wide conversion attribution (tracking_event
                joined to tracking_session.traffic_source), the same data source as
                the Marketing Attribution tab under Analytics. Ad-specific per-channel
                spend is already shown above in Overview → Spend by Campaign Type. */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-1">Site-Wide Conversion Attribution</h3>
              <p className="text-xs text-gray-400 mb-4">Last {attribution?.windowDays ?? 30} days · booking/payment/subscription conversions by traffic source</p>
              {!attribution?.byChannel.length ? (
                <EmptyState message={loading ? 'Loading…' : 'No conversion events recorded yet.'} />
              ) : (
                <div className="space-y-2">
                  {attribution.byChannel.map(a => (
                    <div key={a.channel} className="flex items-center gap-3 text-sm">
                      <span className="text-gray-600 w-16 capitalize">{a.channel}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-3">
                        <div className="bg-green-400 h-3 rounded-full" style={{ width: `${a.pct}%` }} />
                      </div>
                      <span className="text-gray-500 w-20 text-right">{a.conversions} conv</span>
                      <span className="text-gray-400 w-12 text-right text-xs">{a.pct}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── AI Engine ── */}
        {activeTab === 'ai' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  tool: 'Campaign Health Audit', engine: 'Ollama (fast tier)', connected: true,
                  desc: 'Hourly structural config audit — no ad groups/targeting, expired-but-active, bid exceeding budget',
                  count: `${dashboard?.aiEngine.healthFindings ?? 0} findings generated`,
                },
                {
                  tool: 'Ad Copy Generation', engine: 'Ollama', connected: (dashboard?.aiEngine.adsGenerated ?? 0) > 0,
                  desc: 'Generate RSA headlines, descriptions, and CTAs for an ad group',
                  count: `${dashboard?.aiEngine.adsGenerated ?? 0} ads generated`,
                },
                {
                  tool: 'Keyword Inventory', engine: 'Manual entry', connected: (dashboard?.aiEngine.keywordCount ?? 0) > 0,
                  desc: 'Ad group keywords configured for search targeting (no AI-suggestion path is wired yet)',
                  count: `${dashboard?.aiEngine.keywordCount ?? 0} keywords configured`,
                },
                {
                  tool: 'Banner Image Generation', engine: 'ComfyUI (SDXL)', connected: false,
                  desc: 'Generate display and banner images from text prompts',
                  count: 'Not connected',
                },
                {
                  tool: 'A/B Testing', engine: 'GrowthBook', connected: false,
                  desc: 'Split-test ad variants, budgets, and landing page CTAs',
                  count: 'Not connected',
                },
              ].map(t => (
                <div key={t.tool} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-gray-900">{t.tool}</p>
                      <p className="text-xs text-amber-600 font-medium mt-0.5">{t.engine}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.connected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {t.connected ? 'active' : 'not connected'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">{t.desc}</p>
                  <p className="text-xs text-gray-400 mt-2">{t.count}</p>
                </div>
              ))}
            </div>

            <AdCreativeGeneratorPanel adGroups={adGroups} onGenerated={() => fetchJson<{ creatives: CreativeRow[] }>('/api/ads/creatives').then(d => setCreatives(d?.creatives ?? []))} />

            {/* Safety note */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-amber-800 mb-1">AI Safety — Ads</p>
              <ul className="text-xs text-amber-700 space-y-1 list-disc ml-4">
                <li>All AI-generated ad copy is marked <code className="bg-amber-100 px-1 rounded">ai_generated=true</code> and requires human review before activation</li>
                <li>ComfyUI images must be reviewed for brand compliance and offensive content before publishing</li>
                <li>GrowthBook A/B tests require minimum 100 impressions before declaring winner</li>
                <li>Keyword suggestions are recommendations only — negative keywords must be added manually</li>
              </ul>
            </div>
          </div>
        )}

        {/* ── Pixels ── */}
        {activeTab === 'pixels' && <PixelsTab />}

        {/* ── Integrations ── */}
        {activeTab === 'integrations' && (
          <div className="space-y-5">
            {/* MCP Tools */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">MCP Tool Registry — 13 Tools</h3>
              <div className="space-y-2">
                {[
                  { name: 'get_campaigns',          tier: 'auto',              desc: 'List all campaigns with status and budget summary' },
                  { name: 'get_campaign_summary',   tier: 'auto',              desc: 'Aggregate CTR, CPC, spend, impressions across active campaigns' },
                  { name: 'get_campaign',           tier: 'staff',             desc: 'Full campaign + ad groups + keywords + targeting' },
                  { name: 'create_campaign',        tier: 'staff',             desc: 'Create campaign with type, budget, targeting, bidding' },
                  { name: 'update_campaign',        tier: 'staff',             desc: 'Update name, budget, status, geo/device targets' },
                  { name: 'pause_campaign',         tier: 'staff',             desc: 'Pause active campaign — all ads stop serving' },
                  { name: 'get_ad_performance',     tier: 'staff',             desc: 'Per-ad CTR, CPC, conversions for a campaign' },
                  { name: 'opt_out_ad_targeting',   tier: 'customer_confirm',  desc: 'Opt out of personalized targeting [OPT_OUT_ADS]' },
                  { name: 'get_audience_data',      tier: 'staff_approval',    desc: 'Access audience segments — PII-adjacent, audit-logged' },
                  { name: 'export_campaign_report', tier: 'staff_approval',    desc: 'Export full campaign performance CSV with attribution data' },
                  { name: 'set_campaign_budget',    tier: 'admin',             desc: 'Override daily or total budget — affects live serving' },
                  { name: 'get_billing_analytics',  tier: 'admin',             desc: 'Total spend, billing history, ROAS across all campaigns' },
                  { name: 'delete_campaign_data',   tier: 'admin_destructive', desc: 'Permanent delete [GDPR] — campaigns, ads, analytics, audiences' },
                ].map(t => {
                  const tierColor: Record<string, string> = {
                    auto:              'bg-gray-100 text-gray-600',
                    staff:             'bg-blue-100 text-blue-700',
                    customer_confirm:  'bg-yellow-100 text-yellow-700',
                    staff_approval:    'bg-orange-100 text-orange-700',
                    admin:             'bg-purple-100 text-purple-700',
                    admin_destructive: 'bg-red-100 text-red-700',
                  };
                  return (
                    <div key={t.name} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                      <code className="text-xs font-mono text-gray-800 w-52 flex-shrink-0">{t.name}</code>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${tierColor[t.tier]}`}>{t.tier}</span>
                      <span className="text-xs text-gray-500">{t.desc}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Stack */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h3 className="font-semibold text-gray-900 mb-3">Open-Source Stack</h3>
                <div className="space-y-2 text-sm">
                  {[
                    { layer: 'Ad Server',        tool: 'Revive Adserver',  note: 'self-hosted serving' },
                    { layer: 'Header Bidding',   tool: 'Prebid.js',        note: 'browser-side' },
                    { layer: 'Bidding Server',   tool: 'Prebid Server',    note: 'server-side' },
                    { layer: 'AI Copywriting',   tool: 'Ollama (llama3)',  note: 'local LLM' },
                    { layer: 'Image Generation', tool: 'ComfyUI (SDXL)',   note: 'local diffusion' },
                    { layer: 'A/B Testing',      tool: 'GrowthBook',       note: 'experiments' },
                    { layer: 'Email Marketing',  tool: 'Listmonk',         note: 'campaigns' },
                    { layer: 'Social Media',     tool: 'Postiz',           note: '14+ platforms' },
                    { layer: 'Automation',       tool: 'Activepieces',     note: 'budget rules, alerts' },
                    { layer: 'Analytics',        tool: 'PostHog',          note: 'events + funnels' },
                    { layer: 'Dashboard',        tool: 'Grafana',          note: 'ROAS, spend, CTR' },
                  ].map(s => (
                    <div key={s.layer} className="flex items-start gap-2">
                      <span className="text-gray-500 w-32 flex-shrink-0">{s.layer}</span>
                      <span className="font-medium text-gray-800">{s.tool}</span>
                      <span className="text-gray-400">· {s.note}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h3 className="font-semibold text-gray-900 mb-3">DB Tables</h3>
                <div className="flex flex-wrap gap-1.5">
                  {['ad_campaign','advertisement','ad_group','ad_keyword','ad_analytics','ad_audience','ad_budget_event','ad_audit'].map(t => (
                    <span key={t} className="text-xs font-mono bg-gray-50 border border-gray-200 text-gray-600 px-2 py-0.5 rounded">{t}</span>
                  ))}
                </div>
                <h3 className="font-semibold text-gray-900 mb-3 mt-5">DB Views</h3>
                <div className="flex flex-wrap gap-1.5">
                  {['v_campaign_summary','v_ad_performance','v_daily_roas'].map(v => (
                    <span key={v} className="text-xs font-mono bg-blue-50 border border-blue-200 text-blue-700 px-2 py-0.5 rounded">{v}</span>
                  ))}
                </div>
                <h3 className="font-semibold text-gray-900 mb-3 mt-5">Google Ads API Clients</h3>
                <div className="flex flex-wrap gap-1.5">
                  {['PHP','Java','Python','.NET','Ruby'].map(l => (
                    <span key={l} className="text-xs bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 rounded font-medium">{l}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// Real Dynamic Ad Builder -- manual RSA-style multi-headline/description
// creative composition. The advertisement table already stored these as
// arrays but only the AI generator (below) or a seeder could write one;
// this is the first manual authoring path, combining N headlines x M
// descriptions the way Google/Meta responsive ads actually serve variants.
function DynamicAdBuilder({ adGroups, onCreated }: { adGroups: AdGroupRow[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [adGroupId, setAdGroupId] = useState('');
  const [name, setName] = useState('');
  const [adType, setAdType] = useState('responsive_search');
  const [finalUrl, setFinalUrl] = useState('');
  const [callToAction, setCallToAction] = useState('');
  const [headlines, setHeadlines] = useState(['']);
  const [descriptions, setDescriptions] = useState(['']);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const cleanHeadlines = headlines.map(h => h.trim()).filter(Boolean);
  const cleanDescriptions = descriptions.map(d => d.trim()).filter(Boolean);
  const variantCount = cleanHeadlines.length * cleanDescriptions.length;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    const res = await fetch('/api/ads/creatives', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adGroupId, name, adType, finalUrl, callToAction: callToAction || undefined, headlines: cleanHeadlines, descriptions: cleanDescriptions }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) { setError(body.error || 'Failed to create ad.'); return; }
    setOpen(false);
    setName(''); setFinalUrl(''); setCallToAction(''); setHeadlines(['']); setDescriptions(['']);
    onCreated();
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-gray-900 text-sm">Dynamic Ad Builder</p>
          <p className="text-xs text-gray-500 mt-0.5">Compose multiple headlines and descriptions — variants are combined and served responsively, RSA-style.</p>
        </div>
        <button onClick={() => setOpen(o => !o)} className="px-3 py-1.5 text-sm bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium">
          {open ? 'Cancel' : '+ Build Ad'}
        </button>
      </div>
      {open && (
        <form onSubmit={submit} className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">Ad group
              <select required className="mt-1 w-full rounded border p-2" value={adGroupId} onChange={e => setAdGroupId(e.target.value)}>
                <option value="">Select…</option>
                {adGroups.map(g => <option key={g.id} value={g.id}>{g.name} ({g.campaign})</option>)}
              </select>
            </label>
            <label className="block text-sm">Ad type
              <select className="mt-1 w-full rounded border p-2" value={adType} onChange={e => setAdType(e.target.value)}>
                {['responsive_search', 'display', 'banner', 'video', 'image', 'dynamic', 'call'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
          </div>
          <label className="block text-sm">Internal name
            <input required className="mt-1 w-full rounded border p-2" value={name} onChange={e => setName(e.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">Final URL
              <input required type="url" className="mt-1 w-full rounded border p-2" value={finalUrl} onChange={e => setFinalUrl(e.target.value)} />
            </label>
            <label className="block text-sm">Call to action (optional)
              <input className="mt-1 w-full rounded border p-2" value={callToAction} onChange={e => setCallToAction(e.target.value)} placeholder="Book a class" />
            </label>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700">Headlines (1–15)</p>
            {headlines.map((h, i) => (
              <div key={i} className="flex gap-2 mt-1.5">
                <input maxLength={30} className="flex-1 rounded border p-2 text-sm" value={h}
                  onChange={e => setHeadlines(hs => hs.map((x, j) => j === i ? e.target.value : x))} placeholder={`Headline ${i + 1}`} />
                {headlines.length > 1 && <button type="button" onClick={() => setHeadlines(hs => hs.filter((_, j) => j !== i))} className="text-xs text-red-500 px-2">Remove</button>}
              </div>
            ))}
            {headlines.length < 15 && <button type="button" onClick={() => setHeadlines(hs => [...hs, ''])} className="text-xs text-amber-600 font-medium mt-2">+ Add headline</button>}
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700">Descriptions (1–4)</p>
            {descriptions.map((d, i) => (
              <div key={i} className="flex gap-2 mt-1.5">
                <input maxLength={90} className="flex-1 rounded border p-2 text-sm" value={d}
                  onChange={e => setDescriptions(ds => ds.map((x, j) => j === i ? e.target.value : x))} placeholder={`Description ${i + 1}`} />
                {descriptions.length > 1 && <button type="button" onClick={() => setDescriptions(ds => ds.filter((_, j) => j !== i))} className="text-xs text-red-500 px-2">Remove</button>}
              </div>
            ))}
            {descriptions.length < 4 && <button type="button" onClick={() => setDescriptions(ds => [...ds, ''])} className="text-xs text-amber-600 font-medium mt-2">+ Add description</button>}
          </div>

          <p className="text-xs text-gray-500">{variantCount > 0 ? `${variantCount} possible headline × description combinations will be available to serve.` : 'Add at least one headline and one description.'}</p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end">
            <button type="submit" disabled={saving || variantCount === 0} className="rounded bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50">
              {saving ? 'Creating…' : 'Create ad'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// Real generation, closing the gap the "Ad Copy Generation" tile above has
// always described but never implemented (adsGenerated was 0 before this).
// Prompt-based, targeting-aware -- a distinct idea from generic ad copy,
// named explicitly in a ChatGPT platform-blueprint conversation 2026-09-01.
function AdCreativeGeneratorPanel({ adGroups, onGenerated }: { adGroups: AdGroupRow[]; onGenerated: () => void }) {
  const [adGroupId, setAdGroupId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [businessType, setBusinessType] = useState('yoga studio');
  const [ageGroup, setAgeGroup] = useState('25-40');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ headline: string; description: string }[] | null>(null);
  const [error, setError] = useState('');

  const generate = async () => {
    setGenerating(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/admin/ads/generate-creative', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adGroupId, prompt, businessType, ageGroup, count: 3 }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Generation failed.'); return; }
      setResult(data.variants);
      onGenerated();
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <p className="font-semibold text-gray-900 mb-1">Generate Ad Creative (Prompt-Based, Targeting-Aware)</p>
      <p className="text-sm text-gray-500 mb-4">One prompt + a business type + age group produces distinct, age-appropriate headline/description variants — real Ollama generation, saved as ai_generated=true, requiring review before activation.</p>
      {adGroups.length === 0 ? (
        <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3">No ad groups exist yet — create one under the Ad Groups tab first.</p>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <select value={adGroupId} onChange={e => setAdGroupId(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
              <option value="">Select ad group…</option>
              {adGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <input value={businessType} onChange={e => setBusinessType(e.target.value)} placeholder="Business type" className="border rounded-lg px-3 py-2 text-sm" />
            <select value={ageGroup} onChange={e => setAgeGroup(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
              {['18-24', '25-40', '40-60', '60+'].map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={2} placeholder="Campaign brief, e.g. 'Promote our new evening Vinyasa class'"
            className="w-full border rounded-lg px-3 py-2 text-sm" />
          <button onClick={generate} disabled={generating || !adGroupId || !prompt.trim()} className="bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
            {generating ? 'Generating…' : 'Generate 3 Variants'}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {result && (
            <div className="space-y-2 mt-2">
              {result.map((v, i) => (
                <div key={i} className="border rounded-lg p-3 text-sm">
                  <p className="font-semibold text-gray-800">{v.headline}</p>
                  <p className="text-gray-500">{v.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
