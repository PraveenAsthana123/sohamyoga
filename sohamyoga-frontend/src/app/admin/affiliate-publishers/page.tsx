'use client';
import { useEffect, useState, useCallback } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────

type Publisher = {
  id: string; company_name: string | null; contact_name: string;
  contact_email: string | null; contact_phone: string | null;
  website_url: string | null; social_profiles: Record<string, string>;
  publisher_type: string; niche: string[]; audience_size: number | null;
  monthly_traffic: number | null; geo_focus: string[];
  proposed_commission_pct: string | null; status: string; tier: string | null;
  performance_score: number; notes: string | null; recruited_by: string | null;
  approved_at: string | null; created_at: string;
};

type Application = {
  id: string; publisher_id: string; application_text: string | null;
  portfolio_url: string | null; monthly_traffic_claimed: number | null;
  audience_description: string | null; promotion_plan: string | null;
  status: string; reviewer_notes: string | null;
  reviewed_by: string | null; reviewed_at: string | null; created_at: string;
  // Joined fields when loaded with publisher name
  contact_name?: string; company_name?: string; publisher_type?: string;
};

type ProspectCard = {
  archetype: string; style: string; why_they_convert: string;
  audience_size_range: string; how_to_find: string;
};

type PageData = {
  publishers: Publisher[];
  pipelineStats: Record<string, number>;
};

// ─── Constants ─────────────────────────────────────────────────────────────

const TABS = ['pipeline', 'directory', 'outreach', 'applications', 'discovery'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = {
  pipeline: 'Pipeline',
  directory: 'Publisher Directory',
  outreach: 'Outreach',
  applications: 'Applications',
  discovery: 'Discovery',
};

const STATUS_ORDER = ['prospect', 'contacted', 'application_sent', 'approved', 'active', 'paused'];
const STATUS_LABELS: Record<string, string> = {
  prospect: 'Prospect', contacted: 'Contacted', application_sent: 'Applied',
  approved: 'Approved', active: 'Active', paused: 'Paused', rejected: 'Rejected',
};
const STATUS_COLORS: Record<string, string> = {
  prospect: 'bg-gray-100 text-gray-600',
  contacted: 'bg-blue-100 text-blue-700',
  application_sent: 'bg-purple-100 text-purple-700',
  approved: 'bg-green-100 text-green-700',
  active: 'bg-emerald-100 text-emerald-700',
  paused: 'bg-amber-100 text-amber-700',
  rejected: 'bg-red-100 text-red-700',
};
const TIER_COLORS: Record<string, string> = {
  bronze: 'bg-orange-100 text-orange-700',
  silver: 'bg-gray-100 text-gray-600',
  gold: 'bg-yellow-100 text-yellow-700',
  platinum: 'bg-purple-100 text-purple-700',
};
const APP_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  more_info_needed: 'bg-blue-100 text-blue-700',
};
const TYPE_OPTIONS = ['blogger', 'influencer', 'comparison_site', 'cashback', 'email_list', 'social_media', 'podcast', 'news_site'];
const GEO_OPTIONS = ['US', 'CA', 'GB', 'AU', 'IN', 'SG', 'NZ', 'JP', 'DE', 'FR'];

const PARTNER_NETWORKS = [
  { name: 'ShareASale', desc: 'One of the largest affiliate networks with 4,500+ merchants', best_for: 'Physical & digital products, broad niche reach', link: 'https://www.shareasale.com' },
  { name: 'CJ Affiliate', desc: 'Enterprise-grade affiliate marketing platform by Conversant', best_for: 'Large brands, high-volume publishers', link: 'https://www.cj.com' },
  { name: 'Impact', desc: 'Full-funnel partnership management platform', best_for: 'SaaS, D2C brands, influencer partnerships', link: 'https://impact.com' },
  { name: 'Rakuten Advertising', desc: 'Global performance marketing with premium publisher network', best_for: 'International reach, premium publishers', link: 'https://rakutenadvertising.com' },
  { name: 'PartnerStack', desc: 'B2B-focused partnership platform for SaaS and software', best_for: 'B2B referrals, reseller programs', link: 'https://partnerstack.com' },
];

const DIRECTORIES = [
  { name: 'Influencer.co', desc: 'Discovery platform for influencers across all niches', link: 'https://influencer.co' },
  { name: 'AspireIQ', desc: 'Influencer marketing platform with creator marketplace', link: 'https://aspire.io' },
  { name: 'Grin', desc: 'Creator management platform for e-commerce brands', link: 'https://grin.co' },
  { name: 'Creator.co', desc: 'Marketplace connecting brands with content creators', link: 'https://creator.co' },
];

function fmt(n: number | null | undefined): string {
  if (!n) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}
function timeAgo(dt: string): string {
  const diff = Date.now() - new Date(dt).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return 'Today';
  if (d === 1) return 'Yesterday';
  return `${d}d ago`;
}

// ─── Add Publisher Modal ────────────────────────────────────────────────────

function AddPublisherModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({
    contact_name: '', company_name: '', contact_email: '', website_url: '',
    publisher_type: 'blogger', niche: '', audience_size: '', proposed_commission_pct: '', notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function submit() {
    setLoading(true); setErr('');
    try {
      const res = await fetch('/api/admin/affiliate-publishers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          niche: form.niche ? form.niche.split(',').map(s => s.trim()).filter(Boolean) : [],
          audience_size: form.audience_size ? parseInt(form.audience_size) : null,
          proposed_commission_pct: form.proposed_commission_pct ? parseFloat(form.proposed_commission_pct) : null,
        }),
      });
      if (!res.ok) { const d = await res.json() as { error?: string }; setErr(d.error || 'Failed'); setLoading(false); return; }
      onDone();
    } catch { setErr('Network error'); setLoading(false); }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg max-h-screen overflow-y-auto">
        <h3 className="font-bold text-lg mb-4">Add Publisher</h3>
        {err && <div className="mb-3 text-red-600 text-sm">{err}</div>}
        <div className="space-y-3">
          {[
            { label: 'Contact Name *', key: 'contact_name', placeholder: 'Jane Smith' },
            { label: 'Company / Channel Name', key: 'company_name', placeholder: 'Wellness Blog Co' },
            { label: 'Contact Email', key: 'contact_email', placeholder: 'jane@example.com' },
            { label: 'Website URL', key: 'website_url', placeholder: 'https://example.com' },
            { label: 'Niche (comma-separated)', key: 'niche', placeholder: 'yoga, wellness, fitness' },
            { label: 'Audience Size', key: 'audience_size', placeholder: '50000' },
            { label: 'Commission % (proposed)', key: 'proposed_commission_pct', placeholder: '12' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs text-gray-500 mb-1">{f.label}</label>
              <input
                value={form[f.key as keyof typeof form]}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder={f.placeholder}
              />
            </div>
          ))}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Publisher Type</label>
            <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.publisher_type} onChange={e => setForm(p => ({ ...p, publisher_type: e.target.value }))}>
              {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} />
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={loading || !form.contact_name.trim()} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {loading ? 'Adding...' : 'Add Publisher'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function AffiliatePublishersPage() {
  const [tab, setTab] = useState<Tab>('pipeline');
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // Directory filters
  const [dirFilters, setDirFilters] = useState({ type: '', tier: '', status: '', search: '' });
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Outreach state
  const [outreachPubId, setOutreachPubId] = useState('');
  const [outreachTone, setOutreachTone] = useState<'formal' | 'friendly'>('formal');
  const [outreachResult, setOutreachResult] = useState<{ subject: string; body: string } | null>(null);
  const [outreachLoading, setOutreachLoading] = useState(false);
  const [outreachErr, setOutreachErr] = useState('');

  // Applications state
  const [applications, setApplications] = useState<Application[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [selectedApps, setSelectedApps] = useState<Set<string>>(new Set());

  // Discovery state
  const [discoverForm, setDiscoverForm] = useState({ niche: 'yoga, wellness', publisher_type: 'blogger', geo: 'US' });
  const [prospects, setProspects] = useState<ProspectCard[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [addingProspect, setAddingProspect] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const res = await fetch('/api/admin/affiliate-publishers');
      if (!res.ok) throw new Error('Failed');
      const d = await res.json() as PageData;
      setData(d);
      if (!outreachPubId && d.publishers.length) setOutreachPubId(d.publishers[0].id);
    } catch { setErr('Failed to load publisher data'); }
    setLoading(false);
  }, [outreachPubId]);

  const fetchApplications = useCallback(async () => {
    if (!data) return;
    setAppsLoading(true);
    try {
      // Load all applications by loading each publisher's details
      const appsList: Application[] = [];
      for (const pub of data.publishers) {
        try {
          const res = await fetch(`/api/admin/affiliate-publishers/${pub.id}`);
          if (res.ok) {
            const d = await res.json() as { applications: Application[] };
            for (const app of d.applications || []) {
              appsList.push({ ...app, contact_name: pub.contact_name, company_name: pub.company_name || undefined, publisher_type: pub.publisher_type });
            }
          }
        } catch { /* continue */ }
      }
      setApplications(appsList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    } catch { /* silently fail */ }
    setAppsLoading(false);
  }, [data]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { if (tab === 'applications' && data) fetchApplications(); }, [tab, data, fetchApplications]);

  async function moveStatus(pubId: string, newStatus: string) {
    try {
      await fetch(`/api/admin/affiliate-publishers/${pubId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchData();
    } catch { /* ignore */ }
  }

  async function approvePublisher(pubId: string) {
    try {
      await fetch(`/api/admin/affiliate-publishers/${pubId}/approve`, { method: 'POST' });
      fetchData();
    } catch { /* ignore */ }
  }

  async function generateOutreach() {
    setOutreachLoading(true); setOutreachErr(''); setOutreachResult(null);
    try {
      const res = await fetch('/api/admin/affiliate-publishers/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publisher_id: outreachPubId, tone: outreachTone }),
      });
      if (!res.ok) { const d = await res.json() as { error?: string }; setOutreachErr(d.error || 'Failed'); setOutreachLoading(false); return; }
      const d = await res.json() as { subject: string; body: string };
      setOutreachResult(d);
    } catch { setOutreachErr('Network error'); }
    setOutreachLoading(false);
  }

  async function reviewApplication(appId: string, pubId: string, status: string) {
    try {
      await fetch(`/api/admin/affiliate-publishers/${pubId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: status === 'approved' ? 'approved' : 'prospect' }),
      });
      // Update application via publisher detail endpoint
      setApplications(prev => prev.map(a => a.id === appId ? { ...a, status } : a));
    } catch { /* ignore */ }
  }

  async function discoverPublishers() {
    setDiscoverLoading(true); setProspects([]);
    try {
      const res = await fetch('/api/admin/affiliate-publishers/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(discoverForm),
      });
      if (!res.ok) { setDiscoverLoading(false); return; }
      const d = await res.json() as { prospects: ProspectCard[] };
      setProspects(d.prospects || []);
    } catch { /* ignore */ }
    setDiscoverLoading(false);
  }

  async function addProspectToPipeline(card: ProspectCard) {
    setAddingProspect(card.archetype);
    try {
      await fetch('/api/admin/affiliate-publishers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_name: card.archetype,
          company_name: card.archetype,
          publisher_type: discoverForm.publisher_type,
          niche: discoverForm.niche.split(',').map(s => s.trim()),
          geo_focus: [discoverForm.geo],
          notes: `Discovered via AI: ${card.style}. Find via: ${card.how_to_find}`,
          status: 'prospect',
        }),
      });
      fetchData();
    } catch { /* ignore */ }
    setAddingProspect(null);
  }

  // ─── Pipeline Tab ──────────────────────────────────────────────────────────

  function renderPipeline() {
    const publishers = data?.publishers || [];
    const stats = data?.pipelineStats || {};
    const activeCount = parseInt(String(stats['active'] || 0));
    const totalCount = parseInt(String(stats['total'] || 0));
    const prospectCount = parseInt(String(stats['prospect'] || 0));
    const convRate = totalCount > 0 && prospectCount < totalCount
      ? Math.round(((totalCount - prospectCount) / totalCount) * 100) : 0;

    return (
      <div className="space-y-5">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Total Publishers', value: totalCount },
            { label: 'Active Partners', value: activeCount, color: 'text-emerald-600' },
            { label: 'Prospect → Active', value: `${convRate}%`, color: 'text-blue-600' },
            { label: 'Avg Commission', value: publishers.length ? `${(publishers.reduce((s, p) => s + parseFloat(p.proposed_commission_pct || '0'), 0) / publishers.length).toFixed(1)}%` : '—' },
            { label: 'Top Publisher', value: publishers.filter(p => p.tier === 'platinum').length > 0 ? 'Platinum' : 'Gold', color: 'text-purple-600' },
          ].map((kpi, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
              <div className="text-xs text-gray-500 mb-1">{kpi.label}</div>
              <div className={`text-xl font-bold ${kpi.color || 'text-gray-800'}`}>{kpi.value}</div>
            </div>
          ))}
        </div>

        {/* Kanban */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {STATUS_ORDER.map(status => {
            const statusPubs = publishers.filter(p => p.status === status);
            return (
              <div key={status} className="bg-gray-50 rounded-xl p-3 min-h-48">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{STATUS_LABELS[status]}</span>
                  <span className="text-xs bg-gray-200 text-gray-600 rounded-full px-2 py-0.5">{statusPubs.length}</span>
                </div>
                <div className="space-y-2">
                  {statusPubs.map(pub => {
                    const currentIdx = STATUS_ORDER.indexOf(pub.status);
                    const prevStatus = currentIdx > 0 ? STATUS_ORDER[currentIdx - 1] : null;
                    const nextStatus = currentIdx < STATUS_ORDER.length - 1 ? STATUS_ORDER[currentIdx + 1] : null;
                    return (
                      <div key={pub.id} className="bg-white rounded-lg border border-gray-200 p-2.5 shadow-sm">
                        <div className="text-xs font-medium text-gray-800 truncate">{pub.company_name || pub.contact_name}</div>
                        <div className="text-xs text-gray-400 truncate">{pub.publisher_type.replace(/_/g, ' ')}</div>
                        {pub.niche && pub.niche.length > 0 && (
                          <div className="flex flex-wrap gap-0.5 mt-1">
                            {pub.niche.slice(0, 2).map((n, i) => (
                              <span key={i} className="text-xs bg-indigo-50 text-indigo-600 px-1.5 rounded">{n}</span>
                            ))}
                          </div>
                        )}
                        {pub.tier && <span className={`inline-block mt-1 text-xs px-1.5 py-0.5 rounded-full ${TIER_COLORS[pub.tier] || ''}`}>{pub.tier}</span>}
                        <div className="text-xs text-gray-400 mt-1">{fmt(pub.audience_size)} audience</div>
                        <div className="flex gap-1 mt-2">
                          {prevStatus && <button onClick={() => moveStatus(pub.id, prevStatus)} className="text-xs border px-1.5 rounded hover:bg-gray-50">←</button>}
                          {nextStatus && <button onClick={() => moveStatus(pub.id, nextStatus)} className="text-xs border px-1.5 rounded hover:bg-gray-50">→</button>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── Directory Tab ─────────────────────────────────────────────────────────

  function renderDirectory() {
    const publishers = data?.publishers || [];
    const filtered = publishers.filter(p => {
      if (dirFilters.type && p.publisher_type !== dirFilters.type) return false;
      if (dirFilters.tier && p.tier !== dirFilters.tier) return false;
      if (dirFilters.status && p.status !== dirFilters.status) return false;
      if (dirFilters.search) {
        const q = dirFilters.search.toLowerCase();
        if (!((p.company_name || '').toLowerCase().includes(q) || p.contact_name.toLowerCase().includes(q) || (p.contact_email || '').toLowerCase().includes(q))) return false;
      }
      return true;
    });

    return (
      <div className="space-y-4">
        {/* Filters + Add */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-end justify-between">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Search</label>
              <input className="border rounded-lg px-3 py-1.5 text-sm w-40" placeholder="Name or email..." value={dirFilters.search} onChange={e => setDirFilters(p => ({ ...p, search: e.target.value }))} />
            </div>
            {[
              { label: 'Type', key: 'type', options: TYPE_OPTIONS },
              { label: 'Tier', key: 'tier', options: ['bronze', 'silver', 'gold', 'platinum'] },
              { label: 'Status', key: 'status', options: STATUS_ORDER },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs text-gray-500 mb-1">{f.label}</label>
                <select className="border rounded-lg px-3 py-1.5 text-sm" value={dirFilters[f.key as keyof typeof dirFilters]} onChange={e => setDirFilters(p => ({ ...p, [f.key]: e.target.value }))}>
                  <option value="">All</option>
                  {f.options.map(o => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
            ))}
          </div>
          <button onClick={() => setShowAddModal(true)} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">+ Add Publisher</button>
        </div>
        <div className="text-xs text-gray-500">{filtered.length} of {publishers.length} publishers</div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>{['Company', 'Type', 'Niche', 'Audience', 'Traffic', 'Commission', 'Tier', 'Status', 'Score', 'Actions'].map(h => (
                <th key={h} className="text-left px-3 py-2 text-xs text-gray-500 font-medium">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {filtered.map(pub => (
                <>
                  <tr key={pub.id} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <div className="font-medium truncate max-w-32">{pub.company_name || pub.contact_name}</div>
                      <div className="text-xs text-gray-400">{pub.contact_email}</div>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">{pub.publisher_type.replace(/_/g, ' ')}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-0.5">
                        {(pub.niche || []).slice(0, 2).map((n, i) => <span key={i} className="text-xs bg-gray-100 text-gray-600 px-1.5 rounded">{n}</span>)}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs">{fmt(pub.audience_size)}</td>
                    <td className="px-3 py-2 text-xs">{fmt(pub.monthly_traffic)}</td>
                    <td className="px-3 py-2 text-xs">{pub.proposed_commission_pct ? `${pub.proposed_commission_pct}%` : '—'}</td>
                    <td className="px-3 py-2">{pub.tier ? <span className={`text-xs px-2 py-0.5 rounded-full ${TIER_COLORS[pub.tier] || ''}`}>{pub.tier}</span> : <span className="text-xs text-gray-300">—</span>}</td>
                    <td className="px-3 py-2"><span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[pub.status] || ''}`}>{pub.status}</span></td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <div className="w-12 bg-gray-100 rounded-full h-1.5">
                          <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${pub.performance_score}%` }} />
                        </div>
                        <span className="text-xs text-gray-500">{pub.performance_score}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        {pub.contact_email && <a href={`mailto:${pub.contact_email}`} className="text-xs border px-2 py-0.5 rounded hover:bg-gray-50">Contact</a>}
                        {pub.status !== 'approved' && pub.status !== 'active' && (
                          <button onClick={() => approvePublisher(pub.id)} className="text-xs border border-green-300 text-green-600 px-2 py-0.5 rounded hover:bg-green-50">Approve</button>
                        )}
                        <button onClick={() => setExpandedRow(expandedRow === pub.id ? null : pub.id)} className="text-xs border px-2 py-0.5 rounded hover:bg-gray-50">{expandedRow === pub.id ? 'Less' : 'More'}</button>
                      </div>
                    </td>
                  </tr>
                  {expandedRow === pub.id && (
                    <tr key={`${pub.id}-exp`} className="bg-indigo-50">
                      <td colSpan={10} className="px-4 py-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div><span className="text-xs text-gray-400">Website</span><div>{pub.website_url ? <a href={pub.website_url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline text-xs">{pub.website_url}</a> : '—'}</div></div>
                          <div><span className="text-xs text-gray-400">Geo Focus</span><div className="text-xs">{(pub.geo_focus || []).join(', ') || '—'}</div></div>
                          <div><span className="text-xs text-gray-400">Social</span><div className="text-xs">{Object.entries(pub.social_profiles || {}).map(([k, v]) => `${k}: ${v}`).join(', ') || '—'}</div></div>
                          <div><span className="text-xs text-gray-400">Approved</span><div className="text-xs">{pub.approved_at ? timeAgo(pub.approved_at) : '—'}</div></div>
                          {pub.notes && <div className="md:col-span-4"><span className="text-xs text-gray-400">Notes</span><div className="text-xs text-gray-600">{pub.notes}</div></div>}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="text-center py-8 text-gray-400 text-sm">No publishers match the current filters.</div>}
        </div>
        {showAddModal && <AddPublisherModal onClose={() => setShowAddModal(false)} onDone={() => { setShowAddModal(false); fetchData(); }} />}
      </div>
    );
  }

  // ─── Outreach Tab ──────────────────────────────────────────────────────────

  const OUTREACH_TEMPLATES = [
    { label: 'Cold Outreach', subject: 'Partnership Opportunity — Soham Yoga Affiliate Program', body: 'Dear {name},\n\nI came across your platform and believe there is a great opportunity to work together...' },
    { label: 'Warm Follow-up', subject: 'Following up — Soham Yoga Partnership', body: 'Hi {name},\n\nI wanted to follow up on my previous message about our affiliate program...' },
    { label: 'Final Nudge', subject: 'Last chance to join our affiliate program — Soham Yoga', body: 'Hi {name},\n\nThis is my final outreach regarding our affiliate partnership opportunity...' },
  ];

  function renderOutreach() {
    const publishers = data?.publishers || [];
    const selectedPub = publishers.find(p => p.id === outreachPubId);

    return (
      <div className="space-y-5">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-4">Generate AI Outreach Email</h3>
          <div className="flex flex-wrap gap-4 items-end mb-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Publisher</label>
              <select className="border rounded-lg px-3 py-2 text-sm min-w-48" value={outreachPubId} onChange={e => { setOutreachPubId(e.target.value); setOutreachResult(null); }}>
                {publishers.map(p => <option key={p.id} value={p.id}>{p.company_name || p.contact_name} ({p.publisher_type.replace(/_/g, ' ')})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tone</label>
              <div className="flex rounded-lg border overflow-hidden">
                {(['formal', 'friendly'] as const).map(t => (
                  <button key={t} onClick={() => setOutreachTone(t)} className={`px-4 py-2 text-sm font-medium capitalize ${outreachTone === t ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{t}</button>
                ))}
              </div>
            </div>
            <button onClick={generateOutreach} disabled={outreachLoading || !outreachPubId} className="px-5 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {outreachLoading ? 'Generating...' : 'Generate Outreach'}
            </button>
          </div>
          {selectedPub && (
            <div className="mb-4 text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
              To: <strong>{selectedPub.contact_name}</strong> · {selectedPub.publisher_type.replace(/_/g, ' ')} ·
              Audience: <strong>{fmt(selectedPub.audience_size)}</strong> ·
              Niche: {(selectedPub.niche || []).join(', ')} ·
              Commission: {selectedPub.proposed_commission_pct ? `${selectedPub.proposed_commission_pct}%` : 'to be agreed'}
            </div>
          )}
          {outreachErr && <div className="text-red-600 text-sm mb-3">{outreachErr}</div>}
          {outreachResult && (
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-gray-600">Subject</label>
                  <button onClick={() => navigator.clipboard.writeText(outreachResult.subject)} className="text-xs border border-gray-200 px-2 py-0.5 rounded hover:bg-gray-50">Copy</button>
                </div>
                <input readOnly value={outreachResult.subject} className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-gray-600">Body</label>
                  <div className="flex gap-2">
                    <button onClick={() => navigator.clipboard.writeText(outreachResult.body)} className="text-xs border border-gray-200 px-2 py-0.5 rounded hover:bg-gray-50">Copy</button>
                    <a
                      href={`mailto:${selectedPub?.contact_email || ''}?subject=${encodeURIComponent(outreachResult.subject)}&body=${encodeURIComponent(outreachResult.body)}`}
                      className="text-xs border border-indigo-200 text-indigo-600 px-2 py-0.5 rounded hover:bg-indigo-50"
                    >Send via Email</a>
                  </div>
                </div>
                <textarea readOnly value={outreachResult.body} className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 min-h-48" />
              </div>
            </div>
          )}
        </div>

        {/* Templates */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-3">Saved Templates</h3>
          <div className="space-y-3">
            {OUTREACH_TEMPLATES.map((t, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-3">
                <div className="font-medium text-sm mb-1">{t.label}</div>
                <div className="text-xs text-gray-500 mb-2">{t.subject}</div>
                <div className="flex gap-2">
                  <button onClick={() => setOutreachResult({ subject: t.subject, body: t.body })} className="text-xs border border-indigo-200 text-indigo-600 px-2 py-0.5 rounded hover:bg-indigo-50">Use Template</button>
                  <button onClick={() => navigator.clipboard.writeText(`Subject: ${t.subject}\n\n${t.body}`)} className="text-xs border border-gray-200 px-2 py-0.5 rounded hover:bg-gray-50">Copy</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Outreach History */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-3">Recent Outreach (from notes)</h3>
          <div className="space-y-2">
            {(data?.publishers || []).filter(p => p.notes && p.notes.includes('Outreach email generated')).map(pub => (
              <div key={pub.id} className="border border-gray-100 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">{pub.company_name || pub.contact_name}</div>
                  <div className="text-xs text-gray-400">Status: {pub.status}</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[pub.status] || ''}`}>{STATUS_LABELS[pub.status] || pub.status}</span>
              </div>
            ))}
            {(data?.publishers || []).filter(p => p.notes && p.notes.includes('Outreach email generated')).length === 0 && (
              <div className="text-sm text-gray-400">No outreach history yet. Generate your first email above.</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── Applications Tab ──────────────────────────────────────────────────────

  function renderApplications() {
    return (
      <div className="space-y-4">
        {/* Bulk Actions */}
        {selectedApps.size > 0 && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex items-center justify-between">
            <span className="text-sm text-indigo-700">{selectedApps.size} selected</span>
            <button
              onClick={async () => {
                for (const appId of selectedApps) {
                  const app = applications.find(a => a.id === appId);
                  if (app) await reviewApplication(appId, app.publisher_id, 'approved');
                }
                setSelectedApps(new Set());
              }}
              className="px-3 py-1 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Approve Selected
            </button>
          </div>
        )}
        {appsLoading && <div className="text-center py-8 text-gray-400">Loading applications...</div>}
        <div className="space-y-3">
          {applications.map(app => (
            <div key={app.id} className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedApps.has(app.id)}
                    onChange={e => setSelectedApps(prev => { const n = new Set(prev); e.target.checked ? n.add(app.id) : n.delete(app.id); return n; })}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-medium text-sm">{app.company_name || app.contact_name}</span>
                      <span className="text-xs text-gray-400">{app.publisher_type?.replace(/_/g, ' ')}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${APP_STATUS_COLORS[app.status] || 'bg-gray-100 text-gray-600'}`}>{app.status.replace(/_/g, ' ')}</span>
                      <span className="text-xs text-gray-300">{timeAgo(app.created_at)}</span>
                    </div>
                    {app.monthly_traffic_claimed && (
                      <div className="text-xs text-gray-500 mb-1">Claimed Traffic: <strong>{fmt(app.monthly_traffic_claimed)}</strong>/mo</div>
                    )}
                    {app.application_text && <p className="text-sm text-gray-700 mb-2">{app.application_text}</p>}
                    {app.portfolio_url && <a href={app.portfolio_url} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline block mb-1">Portfolio: {app.portfolio_url}</a>}
                    {app.promotion_plan && (
                      <div className="text-xs text-gray-500"><strong>Promotion Plan:</strong> {app.promotion_plan}</div>
                    )}
                    {app.audience_description && (
                      <div className="text-xs text-gray-500"><strong>Audience:</strong> {app.audience_description}</div>
                    )}
                  </div>
                </div>
                {/* Review Panel */}
                {app.status === 'pending' && (
                  <div className="mt-3 border-t border-gray-100 pt-3 flex items-start gap-3">
                    <input
                      value={reviewNotes[app.id] || ''}
                      onChange={e => setReviewNotes(p => ({ ...p, [app.id]: e.target.value }))}
                      placeholder="Reviewer notes..."
                      className="flex-1 border rounded-lg px-3 py-1.5 text-sm"
                    />
                    <button onClick={() => reviewApplication(app.id, app.publisher_id, 'approved')} className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">Approve</button>
                    <button onClick={() => reviewApplication(app.id, app.publisher_id, 'rejected')} className="px-3 py-1.5 text-sm bg-red-100 text-red-600 rounded-lg hover:bg-red-200">Reject</button>
                    <button onClick={() => reviewApplication(app.id, app.publisher_id, 'more_info_needed')} className="px-3 py-1.5 text-sm bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200">More Info</button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {!appsLoading && applications.length === 0 && (
            <div className="text-center py-12 text-gray-400">No applications yet.</div>
          )}
        </div>
      </div>
    );
  }

  // ─── Discovery Tab ─────────────────────────────────────────────────────────

  function renderDiscovery() {
    return (
      <div className="space-y-5">
        {/* Discovery Form */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-4">AI Publisher Discovery</h3>
          <div className="flex flex-wrap gap-4 items-end mb-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Niche</label>
              <input value={discoverForm.niche} onChange={e => setDiscoverForm(p => ({ ...p, niche: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm w-48" placeholder="yoga, wellness" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Publisher Type</label>
              <select value={discoverForm.publisher_type} onChange={e => setDiscoverForm(p => ({ ...p, publisher_type: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm">
                {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Geography</label>
              <select value={discoverForm.geo} onChange={e => setDiscoverForm(p => ({ ...p, geo: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm">
                {GEO_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <button onClick={discoverPublishers} disabled={discoverLoading} className="px-5 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {discoverLoading ? 'Discovering...' : 'Discover Publishers'}
            </button>
          </div>

          {prospects.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {prospects.map((card, i) => (
                <div key={i} className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="font-medium text-sm text-gray-800">{card.archetype}</h4>
                    <button
                      onClick={() => addProspectToPipeline(card)}
                      disabled={addingProspect === card.archetype}
                      className="px-2 py-0.5 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap"
                    >
                      {addingProspect === card.archetype ? '...' : '+ Pipeline'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-600 mb-2">{card.style}</p>
                  <div className="text-xs mb-1"><strong>Why converts:</strong> {card.why_they_convert}</div>
                  <div className="text-xs mb-1"><strong>Audience:</strong> {card.audience_size_range}</div>
                  <div className="text-xs text-indigo-600"><strong>Find via:</strong> {card.how_to_find}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Partner Networks */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-3">Affiliate Partner Networks</h3>
          <div className="space-y-3">
            {PARTNER_NETWORKS.map((n, i) => (
              <div key={i} className="flex items-start gap-3 border border-gray-100 rounded-lg p-3">
                <div className="flex-1">
                  <div className="font-medium text-sm">{n.name}</div>
                  <div className="text-xs text-gray-500 mb-1">{n.desc}</div>
                  <div className="text-xs text-gray-400"><strong>Best for:</strong> {n.best_for}</div>
                </div>
                <a href={n.link} target="_blank" rel="noreferrer" className="text-xs border border-indigo-200 text-indigo-600 px-3 py-1 rounded-lg hover:bg-indigo-50 whitespace-nowrap">Apply →</a>
              </div>
            ))}
          </div>
        </div>

        {/* Directories */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-3">Influencer Directories</h3>
          <div className="grid grid-cols-2 gap-3">
            {DIRECTORIES.map((d, i) => (
              <div key={i} className="border border-gray-100 rounded-lg p-3">
                <div className="font-medium text-sm mb-1">{d.name}</div>
                <div className="text-xs text-gray-500 mb-2">{d.desc}</div>
                <a href={d.link} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline">Visit →</a>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading publisher data...</div>;
  if (err) return <div className="p-8 text-center text-red-600">{err} <button onClick={fetchData} className="ml-2 underline">Retry</button></div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Publisher Recruitment Hub</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage affiliate publisher pipeline, outreach, and partner discovery</p>
        </div>
        <button onClick={fetchData} className="text-sm border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50">Refresh</button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {tab === 'pipeline' && renderPipeline()}
      {tab === 'directory' && renderDirectory()}
      {tab === 'outreach' && renderOutreach()}
      {tab === 'applications' && renderApplications()}
      {tab === 'discovery' && renderDiscovery()}
    </div>
  );
}
