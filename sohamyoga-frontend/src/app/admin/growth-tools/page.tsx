'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface LookalikeAudience {
  id: string; name: string; platform: string; source_type: string;
  source_size: number | null; lookalike_size_pct: string; country: string;
  estimated_reach: number | null; status: string; campaign_linked: string | null;
  performance_json: { impressions?: number; clicks?: number; conversions?: number; cpa?: number };
  created_at: string;
}
interface LookalikeKpi { total: number; active: number; totalReach: number; bestPlatform: string; }

interface SeoLocation {
  id: string; business_name: string; address: string | null; city: string | null;
  province: string | null; postal_code: string | null; phone: string | null;
  website_url: string | null; google_business_url: string | null;
  nap_consistent: boolean; google_rating: string | null; google_review_count: number;
  yelp_rating: string | null; primary_category: string | null; citation_score: number;
  last_audit_at: string | null;
}
interface SeoCitation {
  id: string; location_id: string; directory_name: string; status: string;
  nap_correct: boolean | null; listing_url: string | null;
}
interface SeoSummary { napIssues: number; avgCitation: number; totalListed: number; unverified: number; avgRating: string; totalLocations: number; }
interface AuditResult { citationScore: number; napIssues: string[]; aiRecommendations: string[]; directoriesMissing: string[]; auditedAt: string; }

interface ChatbotConfig {
  id: string; name: string; business_type: string | null; greeting_message: string;
  fallback_message: string; collect_name: boolean; collect_email: boolean;
  collect_phone: boolean; collect_appointment: boolean; appointment_link: string | null;
  ai_model: string; system_prompt: string | null; is_active: boolean;
  embed_code: string | null; widget_color: string; widget_position: string;
}
interface ChatbotStats { confirmed: string; completed: string; cancelled: string; no_show: string; rescheduled: string; upcoming: string; total: string; }
interface AppointmentRow {
  id: string; customer_name: string | null; customer_email: string | null;
  customer_phone: string | null; appointment_type: string | null;
  appointment_at: string; location: string | null; meeting_url: string | null;
  reminder_sent_24h: boolean; reminder_sent_1h: boolean; status: string; notes: string | null;
}
interface ChatMessage { role: 'user' | 'bot'; text: string; ts: string; bookingLink?: string | null; }

interface Sponsor {
  id: string; event_name: string | null; company_name: string; contact_name: string | null;
  contact_email: string | null; contact_phone: string | null; sponsorship_tier: string;
  sponsorship_amount_cad: string | null; benefits_json: { benefit: string; delivered: boolean }[];
  status: string; pitch_date: string | null; decision_date: string | null;
  notes: string | null; logo_url: string | null; created_at: string;
}
interface TierStat { sponsorship_tier: string; count: string; total_cad: string; }
interface SponsorKpi { total: number; confirmed: number; totalRevenue: number; pipeline: number; avgDeal: number; }

// ── Constants ─────────────────────────────────────────────────────────────────
const TOP_TABS = ['Lookalike Audiences', 'Local SEO', 'Chatbot & Appointments', 'Sponsor Acquisition'] as const;
type TopTab = typeof TOP_TABS[number];

const PLATFORMS = ['facebook', 'google', 'linkedin', 'tiktok', 'pinterest'];
const SOURCE_TYPES = ['customer_list', 'website_visitors', 'app_users', 'engagement', 'video_viewers', 'lead_form'];
const COUNTRIES: Record<string, number> = { CA: 38_000_000, US: 335_000_000, GB: 67_000_000, AU: 26_000_000 };

const PLATFORM_BADGE: Record<string, string> = {
  facebook: 'bg-blue-100 text-blue-800',
  google: 'bg-red-100 text-red-800',
  linkedin: 'bg-sky-100 text-sky-800',
  tiktok: 'bg-pink-100 text-pink-800',
  pinterest: 'bg-rose-100 text-rose-800',
};
const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  creating: 'bg-blue-100 text-blue-800',
  ready: 'bg-green-100 text-green-800',
  active: 'bg-green-200 text-green-900',
  archived: 'bg-stone-100 text-stone-600',
  prospect: 'bg-slate-100 text-slate-700',
  pitched: 'bg-amber-100 text-amber-800',
  negotiating: 'bg-orange-100 text-orange-800',
  confirmed: 'bg-green-100 text-green-800',
  invoiced: 'bg-teal-100 text-teal-800',
  paid: 'bg-emerald-200 text-emerald-900',
  completed: 'bg-cyan-100 text-cyan-800',
  cancelled: 'bg-red-100 text-red-800',
  rescheduled: 'bg-yellow-100 text-yellow-800',
  no_show: 'bg-red-200 text-red-900',
  not_listed: 'bg-red-100 text-red-700',
  listed: 'bg-green-100 text-green-800',
  needs_update: 'bg-amber-100 text-amber-800',
  verified: 'bg-teal-100 text-teal-800',
};
const TIER_BADGE: Record<string, string> = {
  title: 'bg-yellow-200 text-yellow-900',
  platinum: 'bg-slate-200 text-slate-900',
  gold: 'bg-amber-200 text-amber-900',
  silver: 'bg-gray-200 text-gray-800',
  bronze: 'bg-orange-100 text-orange-800',
  in_kind: 'bg-purple-100 text-purple-800',
};
const SPONSOR_STATUSES = ['prospect', 'pitched', 'negotiating', 'confirmed', 'invoiced', 'paid', 'completed'] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number) { return n.toLocaleString('en-CA'); }
function fmtCad(n: number) { return `$${n.toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`; }
function fmtDate(s: string) { return new Date(s).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }); }
function fmtTime(s: string) { return new Date(s).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }

function Badge({ text, cls }: { text: string; cls: string }) {
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>{text}</span>;
}

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Tab 1 — Lookalike Audiences
// ══════════════════════════════════════════════════════════════════════════════
function LookalikeTab() {
  const [audiences, setAudiences] = useState<LookalikeAudience[]>([]);
  const [kpi, setKpi] = useState<LookalikeKpi>({ total: 0, active: 0, totalReach: 0, bestPlatform: '' });
  const [platformFilter, setPlatformFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', platform: 'facebook', source_type: 'customer_list', source_size: '', lookalike_size_pct: 1, country: 'CA', campaign_linked: '' });

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await fetch('/api/admin/growth-tools/lookalike');
      if (!r.ok) throw new Error('Failed to load');
      const d = await r.json() as { audiences: LookalikeAudience[]; kpi: LookalikeKpi };
      setAudiences(d.audiences); setKpi(d.kpi);
    } catch { setError('Failed to load audiences'); }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visible = platformFilter === 'all' ? audiences : audiences.filter(a => a.platform === platformFilter);

  const estReach = () => {
    const ss = parseInt(form.source_size) || 0;
    const pop = COUNTRIES[form.country] || 38_000_000;
    return Math.round(ss * (pop * form.lookalike_size_pct / 100) / ss || pop * form.lookalike_size_pct / 100);
  };

  const handleCreate = async () => {
    const r = await fetch('/api/admin/growth-tools/lookalike', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, source_size: parseInt(form.source_size) || null, estimated_reach: estReach() }),
    });
    if (r.ok) { setShowCreate(false); void load(); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this audience?')) return;
    await fetch(`/api/admin/growth-tools/lookalike/${id}`, { method: 'DELETE' });
    void load();
  };

  const SETUP_GUIDES: Record<string, { steps: string[]; icon: string }> = {
    facebook: { icon: 'fb', steps: ['Open Meta Ads Manager', 'Audiences → Create Audience → Lookalike Audience', 'Select your Custom Audience as source', 'Choose country and similarity percentage (1–10%)', 'Create — available in 6–24 hours'] },
    google: { icon: 'g', steps: ['Google Ads → Tools → Audience Manager', 'Similar Segments are auto-generated from your remarketing lists', 'Requires 100+ users in the source list', 'Available after 1–7 days of processing'] },
    linkedin: { icon: 'li', steps: ['LinkedIn Campaign Manager → Plan → Audiences', 'Create Audience → Matched Audience → Lookalike', 'Upload a CSV or select an existing matched audience', 'Minimum 300 members to generate lookalike'] },
    tiktok: { icon: 'tt', steps: ['TikTok Ads Manager → Assets → Audiences', 'Create Audience → Lookalike Audience', 'Select a Custom Audience as seed (min 1,000 users)', 'Choose country and audience size (narrow/balanced/broad)'] },
    pinterest: { icon: 'p', steps: ['Pinterest Ads → Audiences → Create Actalike', 'Upload a customer list or select an engagement audience', 'Minimum 100 users in source list', 'Actalike audiences update monthly'] },
  };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total Audiences" value={kpi.total} />
        <KpiCard label="Active" value={kpi.active} />
        <KpiCard label="Est. Total Reach" value={fmt(kpi.totalReach)} />
        <KpiCard label="Best Platform" value={kpi.bestPlatform || '—'} />
      </div>

      {/* Filters + Create */}
      <div className="flex flex-wrap gap-2 items-center">
        {['all', ...PLATFORMS].map(p => (
          <button key={p} onClick={() => setPlatformFilter(p)}
            className={`px-3 py-1 rounded text-sm font-medium border ${platformFilter === p ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
            {p === 'all' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
        <button onClick={() => setShowCreate(true)} className="ml-auto bg-indigo-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-indigo-700">+ Create Audience</button>
      </div>

      {/* Table */}
      {loading ? <p className="text-gray-500">Loading…</p> : error ? <p className="text-red-600">{error}</p> : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>{['Name', 'Platform', 'Source', 'Source Size', 'Similarity', 'Est. Reach', 'Status', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-2 text-xs text-gray-500 font-medium uppercase">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visible.map(a => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900">{a.name}</td>
                  <td className="px-4 py-2"><Badge text={a.platform} cls={PLATFORM_BADGE[a.platform] || 'bg-gray-100 text-gray-700'} /></td>
                  <td className="px-4 py-2 text-gray-600 capitalize">{a.source_type.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-2 text-gray-600">{a.source_size ? fmt(a.source_size) : '—'}</td>
                  <td className="px-4 py-2 text-gray-700">{a.lookalike_size_pct}%</td>
                  <td className="px-4 py-2 text-gray-700">{a.estimated_reach ? fmt(a.estimated_reach) : '—'}</td>
                  <td className="px-4 py-2"><Badge text={a.status} cls={STATUS_BADGE[a.status] || 'bg-gray-100 text-gray-700'} /></td>
                  <td className="px-4 py-2">
                    <button onClick={() => handleDelete(a.id)} className="text-red-500 hover:text-red-700 text-xs">Delete</button>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-400">No audiences found</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Setup guides */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {PLATFORMS.map(p => (
          <div key={p} className="bg-white rounded-lg border border-gray-200 p-4">
            <h4 className="font-semibold text-gray-800 capitalize mb-2">{p} Setup Guide</h4>
            <ol className="space-y-1">
              {SETUP_GUIDES[p]?.steps.map((s, i) => (
                <li key={i} className="text-xs text-gray-600 flex gap-1.5"><span className="text-indigo-500 font-bold">{i + 1}.</span>{s}</li>
              ))}
            </ol>
          </div>
        ))}
      </div>

      {showCreate && (
        <Modal title="Create Lookalike Audience" onClose={() => setShowCreate(false)}>
          <div className="space-y-3">
            <div><label className="text-xs text-gray-600">Name</label><input className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm mt-0.5" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><label className="text-xs text-gray-600">Platform</label>
              <select className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm mt-0.5" value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}>
                {PLATFORMS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
            <div><label className="text-xs text-gray-600">Source Type</label>
              <select className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm mt-0.5" value={form.source_type} onChange={e => setForm(f => ({ ...f, source_type: e.target.value }))}>
                {SOURCE_TYPES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div><label className="text-xs text-gray-600">Source Audience Size</label><input type="number" className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm mt-0.5" value={form.source_size} onChange={e => setForm(f => ({ ...f, source_size: e.target.value }))} /></div>
            <div>
              <label className="text-xs text-gray-600">Lookalike % (1–10): <span className="font-medium">{form.lookalike_size_pct}%</span></label>
              <input type="range" min={1} max={10} step={0.5} className="w-full mt-0.5" value={form.lookalike_size_pct} onChange={e => setForm(f => ({ ...f, lookalike_size_pct: parseFloat(e.target.value) }))} />
            </div>
            <div><label className="text-xs text-gray-600">Country</label>
              <select className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm mt-0.5" value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))}>
                {Object.keys(COUNTRIES).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><label className="text-xs text-gray-600">Campaign Linked (optional)</label><input className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm mt-0.5" value={form.campaign_linked} onChange={e => setForm(f => ({ ...f, campaign_linked: e.target.value }))} /></div>
            <p className="text-xs text-gray-500">Estimated Reach: <strong>{fmt(estReach())}</strong></p>
            <button onClick={handleCreate} className="w-full bg-indigo-600 text-white py-2 rounded text-sm font-medium hover:bg-indigo-700">Create</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Tab 2 — Local SEO
// ══════════════════════════════════════════════════════════════════════════════
function LocalSeoTab() {
  const [locations, setLocations] = useState<SeoLocation[]>([]);
  const [citations, setCitations] = useState<SeoCitation[]>([]);
  const [summary, setSummary] = useState<SeoSummary>({ napIssues: 0, avgCitation: 0, totalListed: 0, unverified: 0, avgRating: '0.0', totalLocations: 0 });
  const [loading, setLoading] = useState(true);
  const [auditing, setAuditing] = useState<string | null>(null);
  const [auditResults, setAuditResults] = useState<Record<string, AuditResult>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ business_name: '', address: '', city: '', province: '', postal_code: '', phone: '', website_url: '', primary_category: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/admin/growth-tools/local-seo');
    if (r.ok) {
      const d = await r.json() as { locations: SeoLocation[]; citations: SeoCitation[]; summary: SeoSummary };
      setLocations(d.locations); setCitations(d.citations); setSummary(d.summary);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const runAudit = async (id: string) => {
    setAuditing(id);
    const r = await fetch(`/api/admin/growth-tools/local-seo/${id}/audit`, { method: 'POST' });
    if (r.ok) {
      const d = await r.json() as AuditResult;
      setAuditResults(prev => ({ ...prev, [id]: d }));
      void load();
    }
    setAuditing(null);
  };

  const handleAdd = async () => {
    const r = await fetch('/api/admin/growth-tools/local-seo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(addForm) });
    if (r.ok) { setShowAdd(false); void load(); }
  };

  const citScore = (score: number) => {
    if (score >= 70) return 'bg-green-500';
    if (score >= 40) return 'bg-amber-400';
    return 'bg-red-500';
  };

  if (loading) return <p className="text-gray-500">Loading…</p>;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard label="Locations" value={summary.totalLocations} />
        <KpiCard label="Avg Citation Score" value={`${summary.avgCitation}%`} />
        <KpiCard label="Directories Listed" value={summary.totalListed} />
        <KpiCard label="NAP Issues" value={summary.napIssues} />
        <KpiCard label="Avg Google Rating" value={`★ ${summary.avgRating}`} />
        <KpiCard label="Need Update" value={summary.unverified} />
      </div>

      <div className="flex justify-end">
        <button onClick={() => setShowAdd(true)} className="bg-indigo-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-indigo-700">+ Add Location</button>
      </div>

      {/* Location cards */}
      {locations.map(loc => {
        const locCits = citations.filter(c => c.location_id === loc.id);
        const audit = auditResults[loc.id];
        return (
          <div key={loc.id} className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
            <div className="flex flex-wrap gap-4 items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 text-lg">{loc.business_name}</h3>
                <p className={`text-sm mt-0.5 ${!loc.nap_consistent ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                  {loc.address} {loc.city && `, ${loc.city}`} {loc.province} {loc.postal_code}
                  {!loc.nap_consistent && ' ⚠ NAP mismatch'}
                </p>
                <p className="text-sm text-gray-500">{loc.phone}</p>
              </div>
              <div className="flex gap-3 items-center flex-wrap">
                {loc.google_rating && <span className="text-sm font-medium text-gray-700">Google ★ {loc.google_rating} ({loc.google_review_count})</span>}
                {loc.yelp_rating && <span className="text-sm font-medium text-gray-700">Yelp ★ {loc.yelp_rating}</span>}
                <button onClick={() => void runAudit(loc.id)} disabled={auditing === loc.id}
                  className="bg-indigo-600 text-white px-3 py-1 rounded text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                  {auditing === loc.id ? 'Auditing…' : 'Run Audit'}
                </button>
              </div>
            </div>

            {/* Citation score */}
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Citation Score</span>
                <span>{loc.citation_score}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${citScore(loc.citation_score)}`} style={{ width: `${loc.citation_score}%` }} />
              </div>
            </div>

            {/* Citations table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-gray-500">
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-1.5 pr-4">Directory</th>
                    <th className="text-left py-1.5 pr-4">Status</th>
                    <th className="text-left py-1.5 pr-4">NAP Correct</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {locCits.map(c => (
                    <tr key={c.id}>
                      <td className="py-1.5 pr-4 font-medium text-gray-800">{c.directory_name}</td>
                      <td className="py-1.5 pr-4"><Badge text={c.status.replace(/_/g, ' ')} cls={STATUS_BADGE[c.status] || 'bg-gray-100 text-gray-700'} /></td>
                      <td className="py-1.5 pr-4">
                        {c.nap_correct === true ? <span className="text-green-600 font-bold">✓</span> : c.nap_correct === false ? <span className="text-red-500 font-bold">✗</span> : <span className="text-gray-400">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Audit results */}
            {audit && (
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex gap-4 text-sm">
                  <span className="font-medium text-gray-700">Citation Score: <strong className={audit.citationScore >= 70 ? 'text-green-700' : audit.citationScore >= 40 ? 'text-amber-700' : 'text-red-700'}>{audit.citationScore}%</strong></span>
                  {audit.napIssues.length > 0 && <span className="text-red-600 font-medium">{audit.napIssues.length} NAP issue(s)</span>}
                </div>
                {audit.directoriesMissing.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-1">Missing from:</p>
                    <div className="flex flex-wrap gap-1">{audit.directoriesMissing.map(d => <span key={d} className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded">{d}</span>)}</div>
                  </div>
                )}
                {audit.aiRecommendations.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-1">AI Recommendations (Ollama):</p>
                    <ul className="space-y-1">{audit.aiRecommendations.map((r, i) => <li key={i} className="text-xs text-gray-700">{r}</li>)}</ul>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Top directories reference */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h4 className="font-semibold text-gray-800 mb-3">Top Directories to List In</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm text-gray-700">
          {['Google Business Profile', 'Yelp', 'Bing Places', 'Apple Maps', 'Facebook', 'Yellow Pages Canada', 'Foursquare', 'Better Business Bureau', 'Houzz (home services)', 'Healthgrades (health)', 'TripAdvisor (hospitality)'].map(d => (
            <div key={d} className="flex items-center gap-1.5"><span className="text-indigo-400">›</span>{d}</div>
          ))}
        </div>
      </div>

      {showAdd && (
        <Modal title="Add Location" onClose={() => setShowAdd(false)}>
          <div className="space-y-3">
            {(['business_name', 'address', 'city', 'province', 'postal_code', 'phone', 'website_url', 'primary_category'] as const).map(f => (
              <div key={f}><label className="text-xs text-gray-600 capitalize">{f.replace(/_/g, ' ')}</label>
                <input className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm mt-0.5" value={addForm[f]} onChange={e => setAddForm(p => ({ ...p, [f]: e.target.value }))} /></div>
            ))}
            <button onClick={handleAdd} className="w-full bg-indigo-600 text-white py-2 rounded text-sm font-medium hover:bg-indigo-700">Add</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Tab 3 — Chatbot & Appointments
// ══════════════════════════════════════════════════════════════════════════════
function ChatbotTab() {
  const [configs, setConfigs] = useState<ChatbotConfig[]>([]);
  const [stats, setStats] = useState<ChatbotStats | null>(null);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [selConfig, setSelConfig] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [genPromptText, setGenPromptText] = useState('');
  const [reminderResult, setReminderResult] = useState<{ sent_24h: number; sent_1h: number; warnings: string[] } | null>(null);
  const [copied, setCopied] = useState('');
  const [showAddAppt, setShowAddAppt] = useState(false);
  const [apptForm, setApptForm] = useState({ customer_name: '', customer_email: '', customer_phone: '', appointment_type: '', appointment_at: '', location: '', notes: '' });
  const chatBottom = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const [cr, ar] = await Promise.all([
      fetch('/api/admin/growth-tools/chatbot'),
      fetch('/api/admin/growth-tools/appointments'),
    ]);
    if (cr.ok) { const d = await cr.json() as { configs: ChatbotConfig[]; stats: ChatbotStats }; setConfigs(d.configs); setStats(d.stats); if (d.configs[0] && !selConfig) setSelConfig(d.configs[0].id); }
    if (ar.ok) { const d = await ar.json() as { appointments: AppointmentRow[] }; setAppointments(d.appointments); }
  }, [selConfig]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { chatBottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const activeConfig = configs.find(c => c.id === selConfig);

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput.trim(); setChatInput('');
    setMessages(prev => [...prev, { role: 'user', text: msg, ts: new Date().toISOString() }]);
    setChatLoading(true);
    try {
      const r = await fetch('/api/admin/growth-tools/chatbot/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config_id: selConfig, user_message: msg }) });
      if (r.ok) {
        const d = await r.json() as { response: string; shouldShowBookingLink: boolean; bookingLink: string | null };
        setMessages(prev => [...prev, { role: 'bot', text: d.response, ts: new Date().toISOString(), bookingLink: d.shouldShowBookingLink ? d.bookingLink : null }]);
      }
    } catch { setMessages(prev => [...prev, { role: 'bot', text: 'Error connecting to chatbot.', ts: new Date().toISOString() }]); }
    setChatLoading(false);
  };

  const genSystemPrompt = async () => {
    if (!activeConfig) return;
    setGenLoading(true);
    const r = await fetch('/api/admin/growth-tools/chatbot/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config_id: selConfig, user_message: `Write a chatbot system prompt for a ${activeConfig.business_type || 'business'} business. Goals: book appointments, answer FAQs, collect leads. Tone: friendly and professional. Return ONLY the system prompt text.` }) });
    if (r.ok) { const d = await r.json() as { response: string }; setGenPromptText(d.response); }
    setGenLoading(false);
  };

  const sendReminders = async () => {
    const r = await fetch('/api/admin/growth-tools/appointments/reminders', { method: 'POST' });
    if (r.ok) setReminderResult(await r.json() as { sent_24h: number; sent_1h: number; warnings: string[] });
  };

  const copyEmbed = (code: string) => { void navigator.clipboard.writeText(code); setCopied(code); setTimeout(() => setCopied(''), 2000); };

  const handleAddAppt = async () => {
    const r = await fetch('/api/admin/growth-tools/appointments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(apptForm) });
    if (r.ok) { setShowAddAppt(false); void load(); }
  };

  const today = appointments.filter(a => { const d = new Date(a.appointment_at); const n = new Date(); return d.toDateString() === n.toDateString(); });
  const upcoming = appointments.filter(a => new Date(a.appointment_at) > new Date()).slice(0, 12);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard label="Total Appts" value={stats?.total || 0} />
        <KpiCard label="Confirmed" value={stats?.confirmed || 0} />
        <KpiCard label="Completed" value={stats?.completed || 0} />
        <KpiCard label="Upcoming" value={stats?.upcoming || 0} />
        <KpiCard label="No Show" value={stats?.no_show || 0} />
        <KpiCard label="Rescheduled" value={stats?.rescheduled || 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left — Chatbot */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
          <h3 className="font-semibold text-gray-900">Chatbot Configurator</h3>
          <select className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm" value={selConfig} onChange={e => { setSelConfig(e.target.value); setMessages([]); }}>
            {configs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          {activeConfig && (
            <>
              {/* Chat test */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-3 py-2 text-xs font-medium text-gray-600 flex justify-between">
                  <span>Test Chatbot</span>
                  <span className="text-gray-400">{OLLAMA_MODEL_LABEL(activeConfig.ai_model)}</span>
                </div>
                <div className="h-48 overflow-y-auto p-3 space-y-2">
                  {messages.length === 0 && <p className="text-xs text-gray-400 italic">Type a message to test the bot…</p>}
                  {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] px-3 py-1.5 rounded-lg text-sm ${m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                        {m.text}
                        {m.bookingLink && <a href={m.bookingLink} target="_blank" rel="noreferrer" className="block mt-1 text-xs underline text-indigo-200">Book now →</a>}
                      </div>
                    </div>
                  ))}
                  {chatLoading && <div className="flex justify-start"><div className="bg-gray-100 px-3 py-1.5 rounded-lg text-sm text-gray-500">…</div></div>}
                  <div ref={chatBottom} />
                </div>
                <div className="border-t border-gray-100 flex">
                  <input className="flex-1 px-3 py-2 text-sm outline-none" placeholder="Type a message…" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void sendChat(); }} />
                  <button onClick={() => void sendChat()} className="px-3 text-indigo-600 font-medium text-sm">Send</button>
                </div>
              </div>

              {/* Config display */}
              <div className="text-xs text-gray-600 space-y-1">
                <p><strong>Greeting:</strong> {activeConfig.greeting_message}</p>
                <p><strong>Collect:</strong> {[activeConfig.collect_name && 'Name', activeConfig.collect_email && 'Email', activeConfig.collect_phone && 'Phone'].filter(Boolean).join(', ') || 'None'}</p>
                {activeConfig.appointment_link && <p><strong>Booking link:</strong> <a href={activeConfig.appointment_link} target="_blank" rel="noreferrer" className="text-indigo-600 underline">{activeConfig.appointment_link}</a></p>}
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: activeConfig.widget_color }} />
                  <span>Position: {activeConfig.widget_position.replace(/_/g, ' ')}</span>
                </div>
              </div>

              {/* AI generate prompt */}
              <button onClick={() => void genSystemPrompt()} disabled={genLoading} className="w-full border border-indigo-200 text-indigo-700 py-1.5 rounded text-sm font-medium hover:bg-indigo-50 disabled:opacity-50">
                {genLoading ? 'Generating…' : '✨ Generate System Prompt (Ollama)'}
              </button>
              {genPromptText && (
                <div className="bg-gray-50 rounded p-3 text-xs text-gray-700 whitespace-pre-wrap">{genPromptText}</div>
              )}

              {/* Embed code */}
              {activeConfig.embed_code && (
                <div>
                  <p className="text-xs text-gray-600 mb-1 font-medium">Embed Code:</p>
                  <div className="relative">
                    <code className="block bg-gray-900 text-green-400 text-xs p-3 rounded overflow-x-auto">{activeConfig.embed_code}</code>
                    <button onClick={() => copyEmbed(activeConfig.embed_code!)} className="absolute top-2 right-2 text-xs bg-gray-700 text-white px-2 py-0.5 rounded hover:bg-gray-600">
                      {copied === activeConfig.embed_code ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right — Appointments */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Appointment Manager</h3>
            <div className="flex gap-2">
              <button onClick={() => void sendReminders()} className="text-xs bg-amber-100 text-amber-800 px-3 py-1 rounded hover:bg-amber-200">Send Reminders Now</button>
              <button onClick={() => setShowAddAppt(true)} className="text-xs bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700">+ Add</button>
            </div>
          </div>

          {reminderResult && (
            <div className="bg-green-50 border border-green-200 rounded p-3 text-xs text-green-800">
              Sent {reminderResult.sent_24h} 24h reminder(s), {reminderResult.sent_1h} 1h reminder(s).
              {reminderResult.warnings.map((w, i) => <p key={i} className="text-amber-700 mt-1">⚠ {w}</p>)}
            </div>
          )}

          {/* Today */}
          {today.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase mb-2">Today</p>
              <div className="grid grid-cols-1 gap-2">
                {today.slice(0, 3).map(a => (
                  <div key={a.id} className="border border-gray-100 rounded-lg p-3 flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{a.customer_name}</p>
                      <p className="text-xs text-gray-500">{a.appointment_type} · {fmtTime(a.appointment_at)}</p>
                    </div>
                    <Badge text={a.status} cls={STATUS_BADGE[a.status] || 'bg-gray-100 text-gray-700'} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming week strip */}
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase mb-2">Upcoming Week</p>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 7 }, (_, i) => {
                const d = new Date(); d.setDate(d.getDate() + i);
                const count = upcoming.filter(a => new Date(a.appointment_at).toDateString() === d.toDateString()).length;
                return (
                  <div key={i} className={`rounded p-1.5 text-center ${count > 0 ? 'bg-indigo-50 border border-indigo-200' : 'bg-gray-50 border border-gray-100'}`}>
                    <p className="text-xs text-gray-500">{d.toLocaleDateString('en-CA', { weekday: 'short' })}</p>
                    <p className="text-xs font-bold text-gray-800">{d.getDate()}</p>
                    {count > 0 && <p className="text-xs text-indigo-600 font-medium">{count}</p>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Full table */}
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="text-gray-500 sticky top-0 bg-white">
                <tr className="border-b border-gray-100">
                  <th className="text-left py-1.5 pr-3">Customer</th>
                  <th className="text-left py-1.5 pr-3">Type</th>
                  <th className="text-left py-1.5 pr-3">When</th>
                  <th className="text-left py-1.5 pr-3">Status</th>
                  <th className="text-left py-1.5">Reminders</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {appointments.map(a => (
                  <tr key={a.id}>
                    <td className="py-1.5 pr-3 font-medium text-gray-900">{a.customer_name || '—'}</td>
                    <td className="py-1.5 pr-3 text-gray-600">{a.appointment_type || '—'}</td>
                    <td className="py-1.5 pr-3 text-gray-600">{fmtDate(a.appointment_at)}</td>
                    <td className="py-1.5 pr-3"><Badge text={a.status} cls={STATUS_BADGE[a.status] || 'bg-gray-100 text-gray-700'} /></td>
                    <td className="py-1.5 text-gray-500">
                      <span className={a.reminder_sent_24h ? 'text-green-600' : 'text-gray-300'}>24h{a.reminder_sent_24h ? ' ✓' : ' –'}</span>
                      {' '}<span className={a.reminder_sent_1h ? 'text-green-600' : 'text-gray-300'}>1h{a.reminder_sent_1h ? ' ✓' : ' –'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showAddAppt && (
        <Modal title="Add Appointment" onClose={() => setShowAddAppt(false)}>
          <div className="space-y-3">
            {(['customer_name', 'customer_email', 'customer_phone', 'appointment_type', 'location', 'notes'] as const).map(f => (
              <div key={f}><label className="text-xs text-gray-600 capitalize">{f.replace(/_/g, ' ')}</label>
                <input className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm mt-0.5" value={apptForm[f]} onChange={e => setApptForm(p => ({ ...p, [f]: e.target.value }))} /></div>
            ))}
            <div><label className="text-xs text-gray-600">Appointment Date/Time</label>
              <input type="datetime-local" className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm mt-0.5" value={apptForm.appointment_at} onChange={e => setApptForm(p => ({ ...p, appointment_at: e.target.value }))} /></div>
            <button onClick={handleAddAppt} className="w-full bg-indigo-600 text-white py-2 rounded text-sm font-medium hover:bg-indigo-700">Add Appointment</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function OLLAMA_MODEL_LABEL(m: string) { return m.replace('ollama_', '').replace('_', ' '); }

// ══════════════════════════════════════════════════════════════════════════════
// Tab 4 — Sponsor Acquisition
// ══════════════════════════════════════════════════════════════════════════════
function SponsorTab() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [tierStats, setTierStats] = useState<TierStat[]>([]);
  const [kpi, setKpi] = useState<SponsorKpi>({ total: 0, confirmed: 0, totalRevenue: 0, pipeline: 0, avgDeal: 0 });
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [pitching, setPitching] = useState<string | null>(null);
  const [pitchResults, setPitchResults] = useState<Record<string, { subject: string; body: string }>>({});
  const [copiedPitch, setCopiedPitch] = useState('');
  const [addForm, setAddForm] = useState({ event_name: '', company_name: '', contact_name: '', contact_email: '', contact_phone: '', sponsorship_tier: 'bronze', sponsorship_amount_cad: '', notes: '' });
  const [benefits, setBenefits] = useState<string[]>(['']);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/admin/growth-tools/sponsors');
    if (r.ok) {
      const d = await r.json() as { sponsors: Sponsor[]; tierStats: TierStat[]; kpi: SponsorKpi };
      setSponsors(d.sponsors); setTierStats(d.tierStats); setKpi(d.kpi);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const genPitch = async (s: Sponsor) => {
    setPitching(s.id);
    const r = await fetch('/api/admin/growth-tools/sponsors/pitch', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_name: s.company_name, event_name: s.event_name, tier: s.sponsorship_tier, amount_cad: s.sponsorship_amount_cad }),
    });
    if (r.ok) { const d = await r.json() as { subject: string; body: string }; setPitchResults(prev => ({ ...prev, [s.id]: d })); }
    setPitching(null);
  };

  const handleStatusChange = async (id: string, status: string) => {
    await fetch(`/api/admin/growth-tools/sponsors/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    void load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete sponsor?')) return;
    await fetch(`/api/admin/growth-tools/sponsors/${id}`, { method: 'DELETE' });
    void load();
  };

  const handleAdd = async () => {
    const benefitsJson = benefits.filter(b => b.trim()).map(b => ({ benefit: b, delivered: false }));
    const r = await fetch('/api/admin/growth-tools/sponsors', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...addForm, benefits_json: benefitsJson }),
    });
    if (r.ok) { setShowAdd(false); void load(); }
  };

  const copyPitch = (text: string, key: string) => { void navigator.clipboard.writeText(text); setCopiedPitch(key); setTimeout(() => setCopiedPitch(''), 2000); };

  const TIER_BENEFITS_TABLE = [
    { tier: 'Title', price: '$10k+', benefits: 'Naming rights, logo everywhere, speaking slot' },
    { tier: 'Platinum', price: '$5k', benefits: 'Logo on all materials, VIP table, social mention' },
    { tier: 'Gold', price: '$2.5k', benefits: 'Logo on materials, mention, 2 tickets' },
    { tier: 'Silver', price: '$1k', benefits: 'Logo on website, 1 ticket' },
    { tier: 'Bronze', price: '$500', benefits: 'Name on sponsor list' },
    { tier: 'In-Kind', price: 'Product/Service', benefits: 'Name on sponsor list' },
  ];

  if (loading) return <p className="text-gray-500">Loading…</p>;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <KpiCard label="Total Sponsors" value={kpi.total} />
        <KpiCard label="Confirmed" value={kpi.confirmed} />
        <KpiCard label="Total Revenue" value={fmtCad(kpi.totalRevenue)} />
        <KpiCard label="Pipeline" value={fmtCad(kpi.pipeline)} />
        <KpiCard label="Avg Deal" value={fmtCad(kpi.avgDeal)} />
      </div>

      <div className="flex justify-end">
        <button onClick={() => setShowAdd(true)} className="bg-indigo-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-indigo-700">+ Add Sponsor</button>
      </div>

      {/* Kanban board */}
      <div className="overflow-x-auto">
        <div className="flex gap-3 min-w-max pb-2">
          {SPONSOR_STATUSES.map(col => {
            const cards = sponsors.filter(s => s.status === col);
            return (
              <div key={col} className="w-52 flex-shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-600 uppercase">{col}</span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-1.5 rounded">{cards.length}</span>
                </div>
                <div className="space-y-2">
                  {cards.map(s => (
                    <div key={s.id} className="bg-white rounded-lg border border-gray-200 p-3 space-y-1.5">
                      <div className="flex justify-between items-start">
                        <p className="text-xs font-semibold text-gray-900 leading-tight">{s.company_name}</p>
                        <Badge text={s.sponsorship_tier} cls={TIER_BADGE[s.sponsorship_tier] || 'bg-gray-100 text-gray-700'} />
                      </div>
                      {s.sponsorship_amount_cad && <p className="text-xs text-gray-600 font-medium">{fmtCad(parseFloat(s.sponsorship_amount_cad))}</p>}
                      {s.contact_name && <p className="text-xs text-gray-400">{s.contact_name}</p>}
                      <div className="flex gap-1 flex-wrap">
                        {['pitched', 'negotiating', 'confirmed'].includes(col) && (
                          <button onClick={() => void genPitch(s)} disabled={pitching === s.id} className="text-xs text-indigo-600 hover:underline disabled:opacity-40">
                            {pitching === s.id ? '…' : '✨ Pitch'}
                          </button>
                        )}
                        <button onClick={() => handleDelete(s.id)} className="text-xs text-red-400 hover:underline">Del</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Full table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>{['Company', 'Tier', 'Amount', 'Status', 'Contact', 'Event', 'Actions'].map(h => (
              <th key={h} className="text-left px-4 py-2 text-xs text-gray-500 font-medium uppercase">{h}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sponsors.map(s => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-medium text-gray-900">{s.company_name}</td>
                <td className="px-4 py-2"><Badge text={s.sponsorship_tier} cls={TIER_BADGE[s.sponsorship_tier] || 'bg-gray-100 text-gray-700'} /></td>
                <td className="px-4 py-2 text-gray-700">{s.sponsorship_amount_cad ? fmtCad(parseFloat(s.sponsorship_amount_cad)) : '—'}</td>
                <td className="px-4 py-2">
                  <select className="text-xs border border-gray-200 rounded px-1 py-0.5" value={s.status} onChange={e => void handleStatusChange(s.id, e.target.value)}>
                    {SPONSOR_STATUSES.map(st => <option key={st} value={st}>{st}</option>)}
                  </select>
                </td>
                <td className="px-4 py-2 text-gray-600 text-xs">{s.contact_name}<br />{s.contact_email}</td>
                <td className="px-4 py-2 text-gray-500 text-xs">{s.event_name || '—'}</td>
                <td className="px-4 py-2 flex gap-2">
                  <button onClick={() => void genPitch(s)} disabled={pitching === s.id} className="text-indigo-600 hover:underline text-xs disabled:opacity-40">{pitching === s.id ? '…' : '✨ Pitch'}</button>
                  <button onClick={() => handleDelete(s.id)} className="text-red-500 hover:underline text-xs">Del</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pitch results */}
      {Object.entries(pitchResults).map(([id, pitch]) => {
        const s = sponsors.find(sp => sp.id === id);
        return (
          <div key={id} className="bg-white rounded-lg border border-indigo-200 p-5 space-y-3">
            <h4 className="font-semibold text-gray-900">Pitch for {s?.company_name}</h4>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">{pitch.subject}</p>
              <button onClick={() => copyPitch(pitch.subject, `${id}-sub`)} className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600 hover:bg-gray-200">{copiedPitch === `${id}-sub` ? 'Copied!' : 'Copy Subject'}</button>
            </div>
            <div className="bg-gray-50 rounded p-3 text-sm text-gray-700 whitespace-pre-wrap">{pitch.body}</div>
            <button onClick={() => copyPitch(pitch.body, `${id}-body`)} className="text-xs bg-indigo-100 text-indigo-700 px-3 py-1 rounded hover:bg-indigo-200">{copiedPitch === `${id}-body` ? 'Copied!' : 'Copy Email Body'}</button>
          </div>
        );
      })}

      {/* Revenue by tier */}
      {tierStats.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h4 className="font-semibold text-gray-800 mb-3">Revenue by Tier (Confirmed+)</h4>
          <div className="flex flex-wrap gap-3">
            {tierStats.map(ts => (
              <div key={ts.sponsorship_tier} className="flex items-center gap-2">
                <Badge text={ts.sponsorship_tier} cls={TIER_BADGE[ts.sponsorship_tier] || 'bg-gray-100 text-gray-700'} />
                <span className="text-sm text-gray-700 font-medium">{fmtCad(parseFloat(ts.total_cad))}</span>
                <span className="text-xs text-gray-400">({ts.count})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tier benefits reference */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h4 className="font-semibold text-gray-800 mb-3">Tier Benefits Reference</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-gray-500 border-b border-gray-100">
              <tr><th className="text-left py-1.5 pr-4">Tier</th><th className="text-left py-1.5 pr-4">Typical Price</th><th className="text-left py-1.5">Key Benefits</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {TIER_BENEFITS_TABLE.map(row => (
                <tr key={row.tier}>
                  <td className="py-2 pr-4"><Badge text={row.tier.toLowerCase()} cls={TIER_BADGE[row.tier.toLowerCase()] || 'bg-gray-100 text-gray-700'} /></td>
                  <td className="py-2 pr-4 font-medium text-gray-700">{row.price}</td>
                  <td className="py-2 text-gray-600">{row.benefits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && (
        <Modal title="Add Sponsor" onClose={() => setShowAdd(false)}>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            {(['event_name', 'company_name', 'contact_name', 'contact_email', 'contact_phone', 'notes'] as const).map(f => (
              <div key={f}><label className="text-xs text-gray-600 capitalize">{f.replace(/_/g, ' ')}</label>
                <input className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm mt-0.5" value={addForm[f]} onChange={e => setAddForm(p => ({ ...p, [f]: e.target.value }))} /></div>
            ))}
            <div><label className="text-xs text-gray-600">Tier</label>
              <select className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm mt-0.5" value={addForm.sponsorship_tier} onChange={e => setAddForm(p => ({ ...p, sponsorship_tier: e.target.value }))}>
                {['title', 'platinum', 'gold', 'silver', 'bronze', 'in_kind'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><label className="text-xs text-gray-600">Amount (CAD)</label>
              <input type="number" className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm mt-0.5" value={addForm.sponsorship_amount_cad} onChange={e => setAddForm(p => ({ ...p, sponsorship_amount_cad: e.target.value }))} /></div>
            <div>
              <label className="text-xs text-gray-600">Benefits</label>
              {benefits.map((b, i) => (
                <div key={i} className="flex gap-1 mt-1">
                  <input className="flex-1 border border-gray-200 rounded px-3 py-1.5 text-sm" value={b} onChange={e => setBenefits(prev => prev.map((x, j) => j === i ? e.target.value : x))} placeholder={`Benefit ${i + 1}`} />
                  <button onClick={() => setBenefits(prev => prev.filter((_, j) => j !== i))} className="text-red-400 px-2">×</button>
                </div>
              ))}
              <button onClick={() => setBenefits(prev => [...prev, ''])} className="text-xs text-indigo-600 mt-1 hover:underline">+ Add benefit</button>
            </div>
            <button onClick={handleAdd} className="w-full bg-indigo-600 text-white py-2 rounded text-sm font-medium hover:bg-indigo-700">Add Sponsor</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Root Page
// ══════════════════════════════════════════════════════════════════════════════
export default function GrowthToolsPage() {
  const [activeTab, setActiveTab] = useState<TopTab>('Lookalike Audiences');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1400px] mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Growth Tools</h1>
          <p className="text-sm text-gray-500 mt-0.5">Lookalike audiences, local SEO, AI chatbot, and sponsor acquisition</p>
        </div>

        {/* Top tabs */}
        <div className="flex gap-1 bg-white rounded-lg border border-gray-200 p-1 mb-6 overflow-x-auto">
          {TOP_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-shrink-0 px-4 py-2 rounded text-sm font-medium transition-colors ${activeTab === tab ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === 'Lookalike Audiences' && <LookalikeTab />}
        {activeTab === 'Local SEO' && <LocalSeoTab />}
        {activeTab === 'Chatbot & Appointments' && <ChatbotTab />}
        {activeTab === 'Sponsor Acquisition' && <SponsorTab />}
      </div>
    </div>
  );
}
