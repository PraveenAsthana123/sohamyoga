'use client';
// /admin/customer-intelligence — Customer Intelligence & Social Insight Hub
// 7 tabs: Click Dashboard | Heatmap | UTM & Campaigns | Social Insights |
//         Review Command Center | Affiliate Tracking | Monitor Rules

import { useState, useEffect, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Overview {
  total_clicks: number;
  unique_visitors: number;
  pageviews: number;
  conversion_rate: string;
}
interface EventTypeRow { event_type: string; cnt: string }
interface PageRow { page_path: string; pageviews: string }
interface SourceRow { source: string; cnt: string }
interface CampaignRow { utm_campaign: string; utm_source: string; utm_medium: string; clicks: string }
interface DeviceRow { device_type: string; cnt: string }
interface Funnel { pageviews: number; cta_clicks: number; form_submits: number }
interface ReferrerRow { referrer_url: string; cnt: string }
interface DayRow { day: string; clicks: string }

interface AnalyticsData {
  overview: Overview;
  by_event_type: EventTypeRow[];
  top_pages: PageRow[];
  by_source: SourceRow[];
  by_campaign: CampaignRow[];
  by_device: DeviceRow[];
  funnel: Funnel;
  top_referrers: ReferrerRow[];
  daily_trend: DayRow[];
}

interface HeatmapElement { element_id: string; element_text: string; element_type: string; clicks: number }
interface HeatmapPage { page_path: string; clicks: number; top_elements: HeatmapElement[] }
interface HeatmapData { pages: HeatmapPage[]; top_pages_list: string[] }

interface SocialInsight {
  id: string; platform: string; insight_type: string; author_name: string;
  author_handle: string; content: string; rating: number | null;
  sentiment: string; sentiment_score: number; likes: number; replies: number;
  shares: number; is_responded: boolean; response_text: string | null;
  is_flagged: boolean; url: string | null; captured_at: string;
}
interface SentimentSummary { sentiment: string; count: number; pct: number }
interface PlatformStat { platform: string; cnt: string; avg_rating: string | null }
interface SocialData {
  insights: SocialInsight[];
  sentiment_summary: SentimentSummary[];
  platform_stats: PlatformStat[];
  total: number;
}

interface MonitorRule {
  id: string; rule_name: string; platforms: string[]; keywords: string[] | null;
  min_rating: number | null; alert_on: string[]; notify_email: string | null; is_active: boolean;
}

interface AffiliateRow {
  affiliate_code: string; affiliate_name: string; clicks: string;
  conversions: string; commission_earned: string; conv_rate_pct: string;
}
interface AffiliateOverview {
  total_clicks: number; conversions: number; conversion_rate: string; total_commission: string;
}
interface CountryRow { country: string; clicks: string; conversions: string }
interface AffiliateData {
  overview: AffiliateOverview;
  by_affiliate: AffiliateRow[];
  by_country: CountryRow[];
  daily_trend: DayRow[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'click-dashboard', label: 'Click Dashboard' },
  { key: 'heatmap', label: 'Click Heatmap' },
  { key: 'utm', label: 'UTM & Campaigns' },
  { key: 'social', label: 'Social Insights' },
  { key: 'reviews', label: 'Review Center' },
  { key: 'affiliate', label: 'Affiliate Tracking' },
  { key: 'monitor', label: 'Monitor Rules' },
] as const;
type TabKey = typeof TABS[number]['key'];

const SOCIAL_PLATFORMS = ['all','facebook','instagram','youtube','google','yelp','linkedin','tiktok','trustpilot'] as const;

const PLATFORM_COLORS: Record<string, string> = {
  facebook: 'bg-blue-100 text-blue-800',
  instagram: 'bg-pink-100 text-pink-800',
  youtube: 'bg-red-100 text-red-800',
  google: 'bg-green-100 text-green-800',
  yelp: 'bg-red-100 text-red-700',
  linkedin: 'bg-blue-100 text-blue-900',
  tiktok: 'bg-gray-800 text-white',
  trustpilot: 'bg-emerald-100 text-emerald-800',
  twitter: 'bg-sky-100 text-sky-800',
};

const SENTIMENT_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  positive: { label: 'Positive', color: 'bg-green-100 text-green-700', icon: ':)' },
  neutral:  { label: 'Neutral',  color: 'bg-gray-100 text-gray-600',   icon: ':-|' },
  negative: { label: 'Negative', color: 'bg-red-100 text-red-700',     icon: ':(' },
};

const SOURCE_COLORS: Record<string, string> = {
  organic: 'bg-green-500',
  social: 'bg-pink-500',
  direct: 'bg-blue-500',
  email: 'bg-yellow-500',
  paid: 'bg-purple-500',
  referral: 'bg-orange-500',
};

// ── Helper Components ─────────────────────────────────────────────────────────

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{String(value)}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function BarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const bars = Math.round(pct / 5);
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-28 text-gray-600 truncate">{label}</span>
      <span className={`h-4 rounded ${color}`} style={{ width: `${Math.max(bars * 8, 4)}px`, minWidth: 4 }} />
      <span className="text-gray-500 w-8 text-right">{pct}%</span>
      <span className="text-gray-400 text-xs">({value.toLocaleString()})</span>
    </div>
  );
}

function DayChart({ data }: { data: DayRow[] }) {
  if (!data.length) return <p className="text-gray-400 text-sm">No trend data yet.</p>;
  const max = Math.max(...data.map(d => parseInt(d.clicks, 10)), 1);
  return (
    <div className="flex items-end gap-1 h-24">
      {data.map((d, i) => {
        const h = Math.max(Math.round((parseInt(d.clicks, 10) / max) * 96), 2);
        return (
          <div key={i} className="flex flex-col items-center gap-1 flex-1">
            <div
              className="bg-blue-500 rounded-t w-full"
              style={{ height: h }}
              title={`${d.day}: ${d.clicks} clicks`}
            />
            <span className="text-gray-400" style={{ fontSize: 8 }}>
              {d.day.slice(5)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CustomerIntelligencePage() {
  const [tab, setTab] = useState<TabKey>('click-dashboard');
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null);
  const [selectedPage, setSelectedPage] = useState('');
  const [socialData, setSocialData] = useState<SocialData | null>(null);
  const [socialPlatform, setSocialPlatform] = useState<string>('all');
  const [socialSentiment, setSocialSentiment] = useState('');
  const [socialResponded, setSocialResponded] = useState('');
  const [captureLoading, setCaptureLoading] = useState(false);
  const [captureResult, setCaptureResult] = useState<string>('');
  const [rules, setRules] = useState<MonitorRule[]>([]);
  const [affiliateData, setAffiliateData] = useState<AffiliateData | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  // Respond modal
  const [respondingId, setRespondingId] = useState('');
  const [respondText, setRespondText] = useState('');
  const [respondLoading, setRespondLoading] = useState(false);

  // Monitor rule form
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [ruleForm, setRuleForm] = useState({ rule_name:'', platforms:[] as string[], keywords:'', min_rating:'', alert_on:[] as string[], notify_email:'' });

  // UTM builder
  const [utmBase, setUtmBase] = useState('https://sohamyoga.com');
  const [utmSource, setUtmSource] = useState('');
  const [utmMedium, setUtmMedium] = useState('');
  const [utmCampaign, setUtmCampaign] = useState('');
  const [utmContent, setUtmContent] = useState('');
  const [utmTerm, setUtmTerm] = useState('');
  const [utmGenerated, setUtmGenerated] = useState('');

  // Load analytics
  const loadAnalytics = useCallback(async () => {
    if (analytics) return;
    setLoading(true); setErr('');
    try {
      const res = await fetch('/api/admin/customer-intelligence');
      if (!res.ok) throw new Error(await res.text());
      setAnalytics(await res.json() as AnalyticsData);
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }, [analytics]);

  const loadHeatmap = useCallback(async (page?: string) => {
    setLoading(true); setErr('');
    try {
      const q = page ? `?page_path=${encodeURIComponent(page)}` : '';
      const res = await fetch(`/api/admin/customer-intelligence/heatmap${q}`);
      if (!res.ok) throw new Error(await res.text());
      setHeatmap(await res.json() as HeatmapData);
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }, []);

  const loadSocial = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const params = new URLSearchParams();
      if (socialPlatform !== 'all') params.set('platform', socialPlatform);
      if (socialSentiment) params.set('sentiment', socialSentiment);
      if (socialResponded) params.set('responded', socialResponded);
      const res = await fetch(`/api/admin/social-insights?${params}`);
      if (!res.ok) throw new Error(await res.text());
      setSocialData(await res.json() as SocialData);
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }, [socialPlatform, socialSentiment, socialResponded]);

  const loadRules = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/social-insights/monitor-rules');
      if (res.ok) setRules((await res.json() as { rules: MonitorRule[] }).rules);
    } catch { /* silent */ }
  }, []);

  const loadAffiliate = useCallback(async () => {
    if (affiliateData) return;
    setLoading(true); setErr('');
    try {
      const res = await fetch('/api/admin/affiliate-insights');
      if (!res.ok) throw new Error(await res.text());
      setAffiliateData(await res.json() as AffiliateData);
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }, [affiliateData]);

  useEffect(() => {
    if (tab === 'click-dashboard') loadAnalytics();
    if (tab === 'heatmap') loadHeatmap();
    if (tab === 'social' || tab === 'reviews') loadSocial();
    if (tab === 'monitor') { loadSocial(); loadRules(); }
    if (tab === 'affiliate') loadAffiliate();
  }, [tab, loadAnalytics, loadHeatmap, loadSocial, loadRules, loadAffiliate]);

  // Re-load social when filters change
  useEffect(() => {
    if (tab === 'social' || tab === 'reviews') loadSocial();
  }, [socialPlatform, socialSentiment, socialResponded, tab, loadSocial]);

  const handleCapture = async () => {
    setCaptureLoading(true); setCaptureResult('');
    try {
      const res = await fetch('/api/admin/social-insights/capture', { method: 'POST' });
      const data = await res.json() as { captured: number; by_platform: Record<string,number>; setup_notes: Record<string,string> };
      setCaptureResult(`Captured ${data.captured} insights. FB:${data.by_platform.facebook} YT:${data.by_platform.youtube} IG:${data.by_platform.instagram}`);
      await loadSocial();
    } catch (e) { setCaptureResult(String(e)); }
    finally { setCaptureLoading(false); }
  };

  const handleRespond = async (id: string) => {
    if (!respondText.trim()) return;
    setRespondLoading(true);
    try {
      const res = await fetch(`/api/admin/social-insights/${id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response_text: respondText }),
      });
      if (res.ok) {
        setRespondingId(''); setRespondText('');
        await loadSocial();
      }
    } catch { /* silent */ }
    finally { setRespondLoading(false); }
  };

  const handleFlag = async (id: string) => {
    try {
      await fetch(`/api/admin/social-insights/${id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response_text: '[FLAGGED]' }),
      });
      await loadSocial();
    } catch { /* silent */ }
  };

  const generateUtm = () => {
    const p = new URLSearchParams();
    if (utmSource) p.set('utm_source', utmSource);
    if (utmMedium) p.set('utm_medium', utmMedium);
    if (utmCampaign) p.set('utm_campaign', utmCampaign);
    if (utmContent) p.set('utm_content', utmContent);
    if (utmTerm) p.set('utm_term', utmTerm);
    setUtmGenerated(`${utmBase}?${p.toString()}`);
  };

  const submitRule = async () => {
    try {
      const res = await fetch('/api/admin/social-insights/monitor-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...ruleForm,
          keywords: ruleForm.keywords ? ruleForm.keywords.split(',').map(k => k.trim()) : [],
          min_rating: ruleForm.min_rating ? parseInt(ruleForm.min_rating, 10) : null,
        }),
      });
      if (res.ok) { setShowRuleForm(false); setRuleForm({ rule_name:'', platforms:[], keywords:'', min_rating:'', alert_on:[], notify_email:'' }); await loadRules(); }
    } catch { /* silent */ }
  };

  const toggleRuleActive = async (id: string, is_active: boolean) => {
    await fetch('/api/admin/social-insights/monitor-rules', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: !is_active }),
    });
    await loadRules();
  };

  const generateAiReply = async (content: string) => {
    try {
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3.2',
          prompt: `Write a short, professional, empathetic response to this customer review/comment for a yoga studio. Keep it under 100 words.\n\nCustomer said: "${content}"\n\nYour response:`,
          stream: false,
        }),
      });
      if (res.ok) {
        const data = await res.json() as { response?: string };
        setRespondText(data.response?.trim() ?? '');
      }
    } catch { setRespondText('Thank you for your feedback! We appreciate you taking the time to share your experience with us.'); }
  };

  // ── Source total for percentage calc
  const sourceTotal = analytics?.by_source.reduce((s, r) => s + parseInt(r.cnt, 10), 0) ?? 1;
  const deviceTotal = analytics?.by_device.reduce((s, r) => s + parseInt(r.cnt, 10), 0) ?? 1;

  // ── Unresponded negative count
  const negativeUnresponded = socialData?.insights.filter(i => i.sentiment === 'negative' && !i.is_responded).length ?? 0;
  const totalResponded = socialData?.insights.filter(i => i.is_responded).length ?? 0;
  const responseRate = socialData?.total ? Math.round((totalResponded / socialData.total) * 100) : 0;

  // ── Affiliate top performer
  const topAffiliate = affiliateData?.by_affiliate[0];

  // ── Funnel percentages
  const funnelPv = analytics?.funnel.pageviews ?? 0;
  const funnelCta = analytics?.funnel.cta_clicks ?? 0;
  const funnelForm = analytics?.funnel.form_submits ?? 0;
  const ctaPct = funnelPv > 0 ? Math.round((funnelCta / funnelPv) * 100) : 0;
  const formPct = funnelPv > 0 ? Math.round((funnelForm / funnelPv) * 100) : 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Customer Intelligence & Social Insight Hub</h1>
            <p className="text-sm text-gray-500">Click tracking, social listening, affiliate analytics — unified view</p>
          </div>
          <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full">LIVE</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-0 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                tab === t.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {err && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{err}</div>}
        {loading && <div className="mb-4 text-sm text-gray-500">Loading...</div>}

        {/* ── TAB 1: Click Dashboard ── */}
        {tab === 'click-dashboard' && analytics && (
          <div className="space-y-6">
            {/* KPI row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard label="Total Clicks (30d)" value={analytics.overview.total_clicks.toLocaleString()} />
              <KpiCard label="Unique Visitors" value={analytics.overview.unique_visitors.toLocaleString()} />
              <KpiCard label="Pageviews" value={analytics.overview.pageviews.toLocaleString()} />
              <KpiCard label="Conversion Rate" value={analytics.overview.conversion_rate} sub="pageviews → form submits" />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Traffic sources */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 mb-3">Traffic Sources</h3>
                <div className="space-y-2">
                  {analytics.by_source.map(s => (
                    <BarRow
                      key={s.source}
                      label={s.source}
                      value={parseInt(s.cnt, 10)}
                      max={sourceTotal}
                      color={SOURCE_COLORS[s.source] ?? 'bg-gray-400'}
                    />
                  ))}
                </div>
              </div>

              {/* Event type breakdown */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 mb-3">Events by Type</h3>
                <div className="space-y-2">
                  {analytics.by_event_type.map(e => (
                    <div key={e.event_type} className="flex justify-between text-sm">
                      <span className="text-gray-600 capitalize">{e.event_type.replace(/_/g,' ')}</span>
                      <span className="font-medium text-gray-800">{parseInt(e.cnt,10).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Daily trend */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-800 mb-3">14-Day Click Trend</h3>
              <DayChart data={analytics.daily_trend} />
            </div>

            {/* Top pages + device + funnel */}
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 mb-3">Top Pages (Pageviews)</h3>
                <div className="space-y-2">
                  {analytics.top_pages.map((p, i) => (
                    <div key={p.page_path} className="flex justify-between text-sm">
                      <span className="text-gray-600 truncate max-w-[160px]">{i+1}. {p.page_path}</span>
                      <span className="font-medium text-gray-800">{parseInt(p.pageviews,10).toLocaleString()}</span>
                    </div>
                  ))}
                  {!analytics.top_pages.length && <p className="text-gray-400 text-xs">No pageview events yet.</p>}
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 mb-3">Device Breakdown</h3>
                <div className="space-y-3">
                  {analytics.by_device.map(d => (
                    <BarRow
                      key={d.device_type}
                      label={d.device_type}
                      value={parseInt(d.cnt,10)}
                      max={deviceTotal}
                      color="bg-indigo-500"
                    />
                  ))}
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 mb-3">Conversion Funnel</h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Pageviews</span>
                      <span className="font-medium">{funnelPv.toLocaleString()}</span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded"><div className="h-3 bg-blue-500 rounded" style={{ width: '100%' }} /></div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">CTA Clicks</span>
                      <span className="font-medium">{funnelCta.toLocaleString()} ({ctaPct}%)</span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded"><div className="h-3 bg-blue-400 rounded" style={{ width: `${ctaPct}%` }} /></div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Forms Submitted</span>
                      <span className="font-medium">{funnelForm.toLocaleString()} ({formPct}%)</span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded"><div className="h-3 bg-green-500 rounded" style={{ width: `${formPct}%` }} /></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Top referrers */}
            {analytics.top_referrers.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 mb-3">Top Referrers</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-gray-500 uppercase border-b"><tr><th className="pb-2 text-left">URL</th><th className="pb-2 text-right">Clicks</th></tr></thead>
                    <tbody>{analytics.top_referrers.map(r => (
                      <tr key={r.referrer_url} className="border-b last:border-0">
                        <td className="py-2 text-gray-600 max-w-xs truncate">{r.referrer_url}</td>
                        <td className="py-2 text-right font-medium">{parseInt(r.cnt,10).toLocaleString()}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: Click Heatmap ── */}
        {tab === 'heatmap' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <select
                className="border border-gray-200 rounded px-3 py-2 text-sm"
                value={selectedPage}
                onChange={e => { setSelectedPage(e.target.value); loadHeatmap(e.target.value || undefined); }}
              >
                <option value="">All top pages</option>
                {(heatmap?.top_pages_list ?? []).map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <button
                onClick={() => loadHeatmap(selectedPage || undefined)}
                className="px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              >
                Refresh
              </button>
              {heatmap && (
                <a
                  href={`data:text/csv;charset=utf-8,${encodeURIComponent(
                    'page_path,element_id,element_text,element_type,clicks\n' +
                    (heatmap.pages ?? []).flatMap(p =>
                      (p.top_elements ?? []).map(e => `"${p.page_path}","${e.element_id}","${e.element_text}","${e.element_type}",${e.clicks}`)
                    ).join('\n')
                  )}`}
                  download="heatmap.csv"
                  className="px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200"
                >
                  Export CSV
                </a>
              )}
            </div>

            {heatmap && (
              <div className="space-y-4">
                {(heatmap.pages ?? []).length === 0 && (
                  <p className="text-gray-400 text-sm">No element click data yet. Start tracking with element_id in POST /api/customer/track.</p>
                )}
                {(heatmap.pages ?? []).map(page => (
                  <div key={page.page_path} className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-semibold text-gray-800">{page.page_path}</h3>
                      <span className="text-sm text-gray-500">{Number(page.clicks).toLocaleString()} total clicks</span>
                    </div>
                    <div className="space-y-2">
                      {(page.top_elements ?? []).slice(0, 10).map((el, idx) => (
                        <div key={el.element_id} className={`flex items-center gap-3 p-2 rounded text-sm ${idx === 0 ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
                          <span className="w-6 text-center text-xs text-gray-400 font-bold">{idx+1}</span>
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                            el.element_type === 'button' ? 'bg-blue-100 text-blue-700' :
                            el.element_type === 'link' ? 'bg-purple-100 text-purple-700' :
                            el.element_type === 'video' ? 'bg-red-100 text-red-700' :
                            el.element_type === 'form' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>{el.element_type || 'element'}</span>
                          <span className="text-gray-700 flex-1 truncate">{el.element_text || el.element_id}</span>
                          <span className="font-bold text-gray-800">{el.clicks.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: UTM & Campaigns ── */}
        {tab === 'utm' && (
          <div className="space-y-6">
            {/* Campaign table */}
            {analytics && (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 mb-3">UTM Campaign Performance (30d)</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-gray-500 uppercase border-b">
                      <tr>
                        <th className="pb-2 text-left">Campaign</th>
                        <th className="pb-2 text-left">Source</th>
                        <th className="pb-2 text-left">Medium</th>
                        <th className="pb-2 text-right">Clicks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.by_campaign.map((c, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-2 text-gray-800 font-medium">{c.utm_campaign || '—'}</td>
                          <td className="py-2 text-gray-600">{c.utm_source || '—'}</td>
                          <td className="py-2 text-gray-600">{c.utm_medium || '—'}</td>
                          <td className="py-2 text-right font-medium">{parseInt(c.clicks,10).toLocaleString()}</td>
                        </tr>
                      ))}
                      {!analytics.by_campaign.length && (
                        <tr><td colSpan={4} className="py-4 text-center text-gray-400 text-sm">No UTM data yet. Create UTM links and share them.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* UTM Builder */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-800 mb-4">UTM Link Builder</h3>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Base URL</label>
                  <input className="w-full border border-gray-200 rounded px-3 py-2 text-sm" value={utmBase} onChange={e => setUtmBase(e.target.value)} placeholder="https://sohamyoga.com/classes" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">utm_source *</label>
                  <input className="w-full border border-gray-200 rounded px-3 py-2 text-sm" value={utmSource} onChange={e => setUtmSource(e.target.value)} placeholder="instagram" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">utm_medium</label>
                  <input className="w-full border border-gray-200 rounded px-3 py-2 text-sm" value={utmMedium} onChange={e => setUtmMedium(e.target.value)} placeholder="social" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">utm_campaign</label>
                  <input className="w-full border border-gray-200 rounded px-3 py-2 text-sm" value={utmCampaign} onChange={e => setUtmCampaign(e.target.value)} placeholder="summer-sale-2026" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">utm_content</label>
                  <input className="w-full border border-gray-200 rounded px-3 py-2 text-sm" value={utmContent} onChange={e => setUtmContent(e.target.value)} placeholder="hero-cta-button" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">utm_term</label>
                  <input className="w-full border border-gray-200 rounded px-3 py-2 text-sm" value={utmTerm} onChange={e => setUtmTerm(e.target.value)} placeholder="yoga+beginners" />
                </div>
              </div>
              <button onClick={generateUtm} className="mt-3 px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
                Generate UTM URL
              </button>
              {utmGenerated && (
                <div className="mt-3 p-3 bg-gray-50 rounded border border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">Generated URL:</p>
                  <div className="flex items-start gap-2">
                    <code className="text-sm text-blue-700 break-all flex-1">{utmGenerated}</code>
                    <button
                      onClick={() => { void navigator.clipboard.writeText(utmGenerated); }}
                      className="text-xs px-2 py-1 bg-white border border-gray-200 rounded hover:bg-gray-50 shrink-0"
                    >
                      Copy
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">QR Code: Use a QR generator service (e.g. qr-code-generator.com) with the URL above for print materials.</p>
                </div>
              )}
            </div>

            {/* ROI calculator */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-800 mb-3">Campaign ROI Calculator</h3>
              <p className="text-xs text-gray-500 mb-3">Input ad spend to estimate revenue per click based on average order value.</p>
              <div className="flex items-center gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Ad Spend ($)</label>
                  <input id="rois" type="number" className="border border-gray-200 rounded px-3 py-2 text-sm w-32" defaultValue="500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Avg Order Value ($)</label>
                  <input id="roiaov" type="number" className="border border-gray-200 rounded px-3 py-2 text-sm w-32" defaultValue="89" />
                </div>
                <div className="mt-5">
                  <button
                    onClick={() => {
                      const spend = parseFloat((document.getElementById('rois') as HTMLInputElement).value);
                      const aov = parseFloat((document.getElementById('roiaov') as HTMLInputElement).value);
                      const clicks = analytics?.overview.total_clicks ?? 1;
                      const cvr = parseFloat(analytics?.overview.conversion_rate ?? '1') / 100;
                      const revenue = clicks * cvr * aov;
                      const roi = revenue - spend;
                      const rpc = revenue / Math.max(clicks, 1);
                      alert(`Estimated Revenue: $${revenue.toFixed(2)}\nROI: $${roi.toFixed(2)} (${((roi/spend)*100).toFixed(0)}%)\nRevenue per Click: $${rpc.toFixed(3)}`);
                    }}
                    className="px-4 py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700"
                  >
                    Calculate ROI
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 4: Social Insights ── */}
        {tab === 'social' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="bg-white border border-gray-200 rounded-lg p-3 flex flex-wrap gap-3 items-center">
              <div className="flex gap-1 flex-wrap">
                {SOCIAL_PLATFORMS.map(p => (
                  <button
                    key={p}
                    onClick={() => setSocialPlatform(p)}
                    className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                      socialPlatform === p ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
              <select
                className="border border-gray-200 rounded px-2 py-1 text-xs"
                value={socialSentiment}
                onChange={e => setSocialSentiment(e.target.value)}
              >
                <option value="">All Sentiments</option>
                <option value="positive">Positive</option>
                <option value="neutral">Neutral</option>
                <option value="negative">Negative</option>
              </select>
              <select
                className="border border-gray-200 rounded px-2 py-1 text-xs"
                value={socialResponded}
                onChange={e => setSocialResponded(e.target.value)}
              >
                <option value="">All</option>
                <option value="false">Unresponded</option>
                <option value="true">Responded</option>
              </select>
              <button
                onClick={handleCapture}
                disabled={captureLoading}
                className="ml-auto px-3 py-1.5 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50"
              >
                {captureLoading ? 'Capturing...' : 'Capture from Platforms'}
              </button>
            </div>
            {captureResult && <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded border border-gray-200">{captureResult}</div>}

            {/* Sentiment summary */}
            {socialData && (
              <div className="flex gap-4">
                {socialData.sentiment_summary.map(s => (
                  <div key={s.sentiment} className={`px-3 py-2 rounded text-sm font-medium ${SENTIMENT_CONFIG[s.sentiment]?.color ?? 'bg-gray-100'}`}>
                    {SENTIMENT_CONFIG[s.sentiment]?.icon} {SENTIMENT_CONFIG[s.sentiment]?.label}: {s.pct}% ({s.count})
                  </div>
                ))}
              </div>
            )}

            {/* Insight cards */}
            <div className="space-y-3">
              {socialData?.insights.map(insight => (
                <div
                  key={insight.id}
                  className={`bg-white border rounded-lg p-4 ${insight.is_flagged ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <div className="flex flex-wrap gap-2 mb-2">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium uppercase ${PLATFORM_COLORS[insight.platform] ?? 'bg-gray-100 text-gray-600'}`}>
                          {insight.platform}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">{insight.insight_type}</span>
                        {insight.rating && (
                          <span className="text-xs text-yellow-600">{'★'.repeat(insight.rating)}{'☆'.repeat(5-insight.rating)}</span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${SENTIMENT_CONFIG[insight.sentiment]?.color ?? 'bg-gray-100'}`}>
                          {SENTIMENT_CONFIG[insight.sentiment]?.icon} {insight.sentiment}
                        </span>
                        {insight.is_responded && <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">Responded</span>}
                        {insight.is_flagged && <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700">Flagged</span>}
                      </div>
                      <p className="text-sm font-medium text-gray-800">{insight.author_name || insight.author_handle}</p>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-3">{insight.content}</p>
                      <div className="flex gap-3 mt-2 text-xs text-gray-400">
                        <span>{new Date(insight.captured_at).toLocaleDateString()}</span>
                        {insight.likes > 0 && <span>{insight.likes} likes</span>}
                        {insight.replies > 0 && <span>{insight.replies} replies</span>}
                        {insight.url && <a href={insight.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">View Original</a>}
                      </div>
                      {insight.response_text && insight.response_text !== '[FLAGGED]' && (
                        <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-700">
                          <span className="font-medium">Your reply:</span> {insight.response_text}
                        </div>
                      )}
                      {/* Respond panel */}
                      {respondingId === insight.id && (
                        <div className="mt-3 space-y-2">
                          <textarea
                            className="w-full border border-gray-200 rounded p-2 text-sm"
                            rows={3}
                            placeholder="Type your reply..."
                            value={respondText}
                            onChange={e => setRespondText(e.target.value)}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleRespond(insight.id)}
                              disabled={respondLoading}
                              className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50"
                            >
                              Post Reply
                            </button>
                            <button
                              onClick={() => generateAiReply(insight.content ?? '')}
                              className="px-3 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700"
                            >
                              AI Reply (Ollama)
                            </button>
                            <button
                              onClick={() => { setRespondingId(''); setRespondText(''); }}
                              className="px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded hover:bg-gray-200"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      {!insight.is_responded && respondingId !== insight.id && (
                        <button
                          onClick={() => setRespondingId(insight.id)}
                          className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded border border-blue-200 hover:bg-blue-100"
                        >
                          Respond
                        </button>
                      )}
                      <button
                        onClick={() => handleFlag(insight.id)}
                        className="px-2 py-1 bg-red-50 text-red-600 text-xs rounded border border-red-200 hover:bg-red-100"
                      >
                        Flag
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {socialData && socialData.insights.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <p className="text-lg mb-2">No insights yet</p>
                  <p className="text-sm">Click "Capture from Platforms" or add insights manually via POST /api/admin/social-insights</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 5: Review Command Center ── */}
        {tab === 'reviews' && (
          <div className="space-y-6">
            {/* Response metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard label="Total Reviews/Comments" value={socialData?.total ?? 0} />
              <KpiCard label="Responded" value={totalResponded} />
              <KpiCard label="Response Rate" value={`${responseRate}%`} sub="Target: 90%" />
              <KpiCard label="Negative Unresponded" value={negativeUnresponded} sub="Needs attention" />
            </div>

            {/* Response rate gauge */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold text-gray-800">Response Rate</h3>
                <span className={`text-sm font-bold ${responseRate >= 90 ? 'text-green-600' : responseRate >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {responseRate}% of reviews responded to (target: 90%)
                </span>
              </div>
              <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-4 rounded-full transition-all ${responseRate >= 90 ? 'bg-green-500' : responseRate >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(responseRate, 100)}%` }}
                />
              </div>
            </div>

            {/* Platform leaderboard */}
            {socialData && socialData.platform_stats.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 mb-3">Platform Avg Rating Leaderboard</h3>
                <div className="space-y-2">
                  {[...socialData.platform_stats]
                    .filter(p => p.avg_rating)
                    .sort((a, b) => parseFloat(b.avg_rating ?? '0') - parseFloat(a.avg_rating ?? '0'))
                    .map((p, i) => (
                      <div key={p.platform} className="flex items-center gap-3">
                        <span className="w-5 text-xs font-bold text-gray-400">{i+1}</span>
                        <span className={`text-xs px-2 py-0.5 rounded font-medium uppercase ${PLATFORM_COLORS[p.platform] ?? 'bg-gray-100'}`}>{p.platform}</span>
                        <span className="text-yellow-500">{'★'.repeat(Math.round(parseFloat(p.avg_rating ?? '0')))}</span>
                        <span className="text-sm text-gray-600">{parseFloat(p.avg_rating ?? '0').toFixed(2)} / 5.0</span>
                        <span className="text-xs text-gray-400">({p.cnt} entries)</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Bulk AI reply */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <h3 className="font-semibold text-gray-800">AI Bulk Reply Center</h3>
                  <p className="text-xs text-gray-500">{negativeUnresponded} negative unresponded reviews need attention</p>
                </div>
                <button
                  onClick={async () => {
                    const unrespondedNeg = socialData?.insights.filter(i => i.sentiment === 'negative' && !i.is_responded) ?? [];
                    for (const insight of unrespondedNeg.slice(0, 5)) {
                      await generateAiReply(insight.content ?? '');
                      await handleRespond(insight.id);
                    }
                  }}
                  disabled={negativeUnresponded === 0}
                  className="px-4 py-2 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 disabled:opacity-40"
                >
                  AI Reply All Negative (Ollama)
                </button>
              </div>
            </div>

            {/* Unresponded feed */}
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-800">Unresponded Reviews</h3>
              {socialData?.insights
                .filter(i => !i.is_responded)
                .sort((a, b) => (a.sentiment === 'negative' ? -1 : 1) - (b.sentiment === 'negative' ? -1 : 1))
                .slice(0, 20)
                .map(insight => (
                  <div key={insight.id} className={`bg-white border rounded-lg p-4 ${insight.sentiment === 'negative' ? 'border-red-200' : 'border-gray-200'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex flex-wrap gap-2 mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${PLATFORM_COLORS[insight.platform] ?? 'bg-gray-100'}`}>{insight.platform}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${SENTIMENT_CONFIG[insight.sentiment]?.color ?? ''}`}>{SENTIMENT_CONFIG[insight.sentiment]?.icon} {insight.sentiment}</span>
                          {insight.rating && <span className="text-xs text-yellow-600">{'★'.repeat(insight.rating)}{'☆'.repeat(5-insight.rating)}</span>}
                        </div>
                        <p className="text-sm font-medium text-gray-800">{insight.author_name}</p>
                        <p className="text-sm text-gray-600">{insight.content?.slice(0,200)}{(insight.content?.length ?? 0) > 200 ? '...' : ''}</p>
                      </div>
                      <button
                        onClick={() => setRespondingId(insight.id)}
                        className="shrink-0 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                      >
                        Respond
                      </button>
                    </div>
                    {respondingId === insight.id && (
                      <div className="mt-3 space-y-2">
                        <textarea
                          className="w-full border border-gray-200 rounded p-2 text-sm"
                          rows={2}
                          placeholder="Type your reply..."
                          value={respondText}
                          onChange={e => setRespondText(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <button onClick={() => handleRespond(insight.id)} disabled={respondLoading} className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50">Post Reply</button>
                          <button onClick={() => generateAiReply(insight.content ?? '')} className="px-3 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700">AI Reply</button>
                          <button onClick={() => { setRespondingId(''); setRespondText(''); }} className="px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded">Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              {(socialData?.insights.filter(i => !i.is_responded).length ?? 0) === 0 && (
                <p className="text-center text-gray-400 py-6">All reviews have been responded to!</p>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 6: Affiliate Tracking ── */}
        {tab === 'affiliate' && (
          <div className="space-y-6">
            {affiliateData && (
              <>
                {/* KPI row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <KpiCard label="Total Clicks (30d)" value={affiliateData.overview.total_clicks.toLocaleString()} />
                  <KpiCard label="Conversions" value={affiliateData.overview.conversions.toLocaleString()} />
                  <KpiCard label="Conversion Rate" value={affiliateData.overview.conversion_rate} />
                  <KpiCard label="Commission Earned" value={`$${affiliateData.overview.total_commission}`} />
                </div>
                {topAffiliate && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                    Top Affiliate: <strong>{topAffiliate.affiliate_name || topAffiliate.affiliate_code}</strong> — {parseInt(topAffiliate.clicks,10)} clicks, {topAffiliate.conv_rate_pct}% CVR
                  </div>
                )}

                {/* Affiliate table */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 mb-3">Affiliate Performance</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-gray-500 uppercase border-b">
                        <tr>
                          <th className="pb-2 text-left">Code</th>
                          <th className="pb-2 text-left">Name</th>
                          <th className="pb-2 text-right">Clicks</th>
                          <th className="pb-2 text-right">Conversions</th>
                          <th className="pb-2 text-right">CVR</th>
                          <th className="pb-2 text-right">Commission</th>
                        </tr>
                      </thead>
                      <tbody>
                        {affiliateData.by_affiliate.map(a => (
                          <tr key={a.affiliate_code} className="border-b last:border-0">
                            <td className="py-2 font-mono text-xs text-blue-700">{a.affiliate_code}</td>
                            <td className="py-2 text-gray-700">{a.affiliate_name || '—'}</td>
                            <td className="py-2 text-right">{parseInt(a.clicks,10).toLocaleString()}</td>
                            <td className="py-2 text-right">{parseInt(a.conversions,10).toLocaleString()}</td>
                            <td className="py-2 text-right">{a.conv_rate_pct ?? '0'}%</td>
                            <td className="py-2 text-right text-green-700 font-medium">${parseFloat(a.commission_earned).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Funnel */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 mb-3">Click Funnel</h3>
                  <div className="space-y-2">
                    {[
                      { label: 'Clicked affiliate link', value: affiliateData.overview.total_clicks, pct: 100 },
                      { label: 'Reached landing page', value: Math.round(affiliateData.overview.total_clicks * 0.85), pct: 85 },
                      { label: 'Added to cart', value: Math.round(affiliateData.overview.total_clicks * 0.15), pct: 15 },
                      { label: 'Converted', value: affiliateData.overview.conversions, pct: parseFloat(affiliateData.overview.conversion_rate) },
                    ].map(step => (
                      <div key={step.label}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">{step.label}</span>
                          <span className="font-medium">{step.value.toLocaleString()} ({step.pct}%)</span>
                        </div>
                        <div className="h-3 bg-gray-100 rounded">
                          <div className="h-3 bg-orange-400 rounded" style={{ width: `${Math.min(step.pct, 100)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Geographic + trend */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-800 mb-3">Geographic Breakdown</h3>
                    {affiliateData.by_country.length ? (
                      <div className="space-y-2">
                        {affiliateData.by_country.map(c => (
                          <div key={c.country} className="flex justify-between text-sm">
                            <span className="text-gray-600">{c.country}</span>
                            <span className="font-medium">{parseInt(c.clicks,10)} clicks ({parseInt(c.conversions,10)} conv)</span>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-gray-400 text-sm">No geographic data yet.</p>}
                  </div>

                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-800 mb-3">30-Day Click Trend</h3>
                    <DayChart data={affiliateData.daily_trend} />
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-700">
                  Full affiliate management →{' '}
                  <a href="/admin/affiliates" className="underline font-medium">Admin Affiliates</a>
                </div>
              </>
            )}
            {!affiliateData && !loading && (
              <p className="text-gray-400 text-sm">Loading affiliate data...</p>
            )}
          </div>
        )}

        {/* ── TAB 7: Monitor Rules ── */}
        {tab === 'monitor' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-gray-800">Insight Monitor Rules</h3>
              <button
                onClick={() => setShowRuleForm(true)}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              >
                + Add Rule
              </button>
            </div>

            {/* Add rule form */}
            {showRuleForm && (
              <div className="bg-white border border-blue-200 rounded-lg p-4 space-y-3">
                <h4 className="font-medium text-gray-800">New Monitor Rule</h4>
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Rule Name *</label>
                    <input className="w-full border border-gray-200 rounded px-3 py-2 text-sm" value={ruleForm.rule_name} onChange={e => setRuleForm(f => ({ ...f, rule_name: e.target.value }))} placeholder="Negative Review Alert" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Notify Email</label>
                    <input className="w-full border border-gray-200 rounded px-3 py-2 text-sm" value={ruleForm.notify_email} onChange={e => setRuleForm(f => ({ ...f, notify_email: e.target.value }))} placeholder="admin@sohamyoga.com" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Platforms *</label>
                    <div className="flex flex-wrap gap-1">
                      {['facebook','instagram','youtube','google','yelp','linkedin','tiktok','trustpilot'].map(p => (
                        <button
                          key={p}
                          onClick={() => setRuleForm(f => ({ ...f, platforms: f.platforms.includes(p) ? f.platforms.filter(x => x !== p) : [...f.platforms, p] }))}
                          className={`text-xs px-2 py-1 rounded border ${ruleForm.platforms.includes(p) ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600'}`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Keywords (comma-separated)</label>
                    <input className="w-full border border-gray-200 rounded px-3 py-2 text-sm" value={ruleForm.keywords} onChange={e => setRuleForm(f => ({ ...f, keywords: e.target.value }))} placeholder="bad, refund, terrible" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Min Rating (alert if below)</label>
                    <input type="number" min={1} max={5} className="w-full border border-gray-200 rounded px-3 py-2 text-sm" value={ruleForm.min_rating} onChange={e => setRuleForm(f => ({ ...f, min_rating: e.target.value }))} placeholder="3" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Alert On</label>
                    <div className="flex gap-2">
                      {['negative','mention','low_rating'].map(a => (
                        <button
                          key={a}
                          onClick={() => setRuleForm(f => ({ ...f, alert_on: f.alert_on.includes(a) ? f.alert_on.filter(x => x !== a) : [...f.alert_on, a] }))}
                          className={`text-xs px-2 py-1 rounded border ${ruleForm.alert_on.includes(a) ? 'bg-red-600 text-white border-red-600' : 'border-gray-200 text-gray-600'}`}
                        >
                          {a}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={submitRule} className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">Save Rule</button>
                  <button onClick={() => setShowRuleForm(false)} className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded hover:bg-gray-200">Cancel</button>
                </div>
              </div>
            )}

            {/* Rule cards */}
            <div className="space-y-3">
              {rules.map(rule => (
                <div key={rule.id} className={`bg-white border rounded-lg p-4 ${rule.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-gray-800">{rule.rule_name}</h4>
                        <span className={`text-xs px-2 py-0.5 rounded ${rule.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {rule.is_active ? 'Active' : 'Paused'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {rule.platforms.map(p => (
                          <span key={p} className={`text-xs px-2 py-0.5 rounded ${PLATFORM_COLORS[p] ?? 'bg-gray-100 text-gray-600'}`}>{p}</span>
                        ))}
                      </div>
                      {rule.keywords && rule.keywords.length > 0 && (
                        <p className="text-xs text-gray-500">Keywords: {rule.keywords.join(', ')}</p>
                      )}
                      {rule.min_rating && (
                        <p className="text-xs text-gray-500">Alert if rating below {rule.min_rating}</p>
                      )}
                      {rule.notify_email && (
                        <p className="text-xs text-gray-400">Notify: {rule.notify_email}</p>
                      )}
                      <div className="flex gap-1 mt-1">
                        {rule.alert_on.map(a => (
                          <span key={a} className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded">{a}</span>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => toggleRuleActive(rule.id, rule.is_active)}
                      className={`shrink-0 px-3 py-1 text-xs rounded border ${rule.is_active ? 'border-gray-200 text-gray-600 hover:bg-gray-50' : 'border-green-200 text-green-700 hover:bg-green-50'}`}
                    >
                      {rule.is_active ? 'Pause' : 'Activate'}
                    </button>
                  </div>
                </div>
              ))}
              {rules.length === 0 && !showRuleForm && (
                <div className="text-center py-12 text-gray-400">
                  <p className="text-lg mb-2">No monitor rules yet</p>
                  <p className="text-sm">Create rules to get alerted on negative reviews, brand mentions, or low ratings.</p>
                </div>
              )}
            </div>

            {/* Recent insights summary as "alerts" */}
            {socialData && socialData.insights.filter(i => i.sentiment === 'negative').length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 mb-3">Recent Matched Alerts (Negative Sentiment)</h3>
                <div className="space-y-2">
                  {socialData.insights
                    .filter(i => i.sentiment === 'negative')
                    .slice(0, 20)
                    .map(i => (
                      <div key={i.id} className="flex items-center gap-3 p-2 bg-red-50 rounded text-sm">
                        <span className={`text-xs px-2 py-0.5 rounded ${PLATFORM_COLORS[i.platform] ?? 'bg-gray-100'}`}>{i.platform}</span>
                        <span className="text-gray-700 flex-1 truncate">{i.content?.slice(0,100)}</span>
                        <span className="text-xs text-gray-400 shrink-0">{new Date(i.captured_at).toLocaleDateString()}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${i.is_responded ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {i.is_responded ? 'Responded' : 'Pending'}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
