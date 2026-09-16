'use client';
import { useEffect, useState, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────
interface MetaPost {
  id: string; page_id: string; post_id: string; post_type: string;
  message: string; full_picture: string | null; permalink_url: string | null;
  platform: string; status: string; likes: number; comments: number;
  shares: number; reach: number; impressions: number; video_views: number;
  created_time: string; created_at: string;
}
interface MetaCampaign {
  id: string; campaign_id: string; campaign_name: string; objective: string;
  status: string; daily_budget: number | null; lifetime_budget: number | null;
  spend: number; impressions: number; clicks: number; ctr: number | null;
  cpm: number | null; cpc: number | null; conversions: number;
  cost_per_conversion: number | null; roas: number | null;
  start_date: string | null; end_date: string | null;
}
interface MetaReview {
  id: string; review_id: string; page_id: string; reviewer_name: string;
  rating: number; review_text: string; created_time: string; platform: string;
  sentiment: string; response_text: string | null; responded_at: string | null;
}
interface MetaKpi {
  totalPosts: number; totalReach: number; activeCampaigns: number;
  totalSpend: number; avgRating: number; unrespondedReviews: number;
}
interface MetaData {
  demo: boolean; appId: string; connected: boolean;
  pages: Record<string, unknown>[]; posts: MetaPost[];
  campaigns: MetaCampaign[]; reviews: MetaReview[];
  kpi: MetaKpi;
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const borders: Record<string, string> = {
    blue: 'border-l-4 border-blue-500 bg-blue-50',
    green: 'border-l-4 border-green-500 bg-green-50',
    amber: 'border-l-4 border-amber-500 bg-amber-50',
    purple: 'border-l-4 border-purple-500 bg-purple-50',
    red: 'border-l-4 border-red-500 bg-red-50',
    teal: 'border-l-4 border-teal-500 bg-teal-50',
  };
  return (
    <div className={`rounded-lg p-4 ${borders[color] || borders.blue}`}>
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${colorClass}`}>{label}</span>;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="text-amber-400">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i}>{i < rating ? '★' : '☆'}</span>
      ))}
    </span>
  );
}

// ─── Tab Components ───────────────────────────────────────────────────────────
function DashboardTab({ data, onSync }: { data: MetaData; onSync: () => void }) {
  const { kpi, connected, appId, posts, demo } = data;
  const redirectUri = typeof window !== 'undefined'
    ? `${window.location.origin}/api/admin/meta-integration/oauth-callback`
    : '';
  const oauthUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=pages_manage_posts,pages_read_engagement,ads_management,pages_manage_metadata`;

  return (
    <div className="space-y-6">
      {demo && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          Demo mode — showing seeded data. Connect a Meta page to load live data.
        </div>
      )}
      <div className="bg-white rounded-lg border p-4 flex items-center justify-between">
        <div>
          <p className="font-semibold text-gray-700">Meta Business Connection</p>
          <p className="text-sm text-gray-500 mt-1">App ID: <code className="bg-gray-100 px-1 rounded">{appId}</code></p>
          <p className="mt-2">
            {connected
              ? <Badge label="Page Connected" colorClass="bg-green-100 text-green-700" />
              : <Badge label="Page Not Connected" colorClass="bg-red-100 text-red-700" />}
          </p>
        </div>
        <div className="flex gap-2">
          {!connected && (
            <a href={oauthUrl} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              Connect Page
            </a>
          )}
          <button onClick={onSync} className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm font-medium hover:bg-gray-800">
            Sync All
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard label="Total Posts" value={kpi.totalPosts} color="blue" />
        <KpiCard label="Total Reach" value={kpi.totalReach.toLocaleString()} color="purple" />
        <KpiCard label="Active Campaigns" value={kpi.activeCampaigns} color="green" />
        <KpiCard label="Ad Spend" value={`$${kpi.totalSpend.toFixed(0)}`} color="amber" />
        <KpiCard label="Avg Rating" value={`${kpi.avgRating} ★`} color="teal" />
        <KpiCard label="Unresponded Reviews" value={kpi.unrespondedReviews} color={kpi.unrespondedReviews > 0 ? 'red' : 'green'} />
      </div>

      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b"><h3 className="font-semibold">Recent Posts</h3></div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['Platform', 'Type', 'Message', 'Likes', 'Comments', 'Reach', 'Date'].map(h => (
                <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {posts.slice(0, 5).map((p) => (
              <tr key={p.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-2">
                  <Badge label={p.platform} colorClass={p.platform === 'facebook' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'} />
                </td>
                <td className="px-4 py-2 text-gray-600 capitalize">{p.post_type}</td>
                <td className="px-4 py-2 max-w-xs">
                  <span className="line-clamp-1 text-gray-700">{p.message}</span>
                </td>
                <td className="px-4 py-2">{p.likes.toLocaleString()}</td>
                <td className="px-4 py-2">{p.comments.toLocaleString()}</td>
                <td className="px-4 py-2">{p.reach.toLocaleString()}</td>
                <td className="px-4 py-2 text-gray-400 whitespace-nowrap">{new Date(p.created_time || p.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PostsTab({ posts }: { posts: MetaPost[] }) {
  const [filter, setFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ platform: 'facebook', post_type: 'feed', message: '', image_url: '' });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const filtered = posts.filter(p => {
    if (filter !== 'all' && p.platform !== filter) return false;
    if (typeFilter !== 'all' && p.post_type !== typeFilter) return false;
    return true;
  });

  const maxChars = form.platform === 'facebook' ? 63206 : 2200;

  async function handlePublish(saveAsDraft = false) {
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/meta-integration/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, save_as_draft: saveAsDraft }),
      });
      const data = await res.json() as Record<string, unknown>;
      setResult(data);
      if (!data.warning) setShowModal(false);
    } catch { setResult({ error: 'Request failed' }); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2">
          {['all', 'facebook', 'instagram'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded text-sm font-medium ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {f === 'all' ? 'All Platforms' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
          <span className="text-gray-300">|</span>
          {['all', 'feed', 'reel', 'story', 'ad'].map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-3 py-1 rounded text-sm ${typeFilter === t ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          + New Post
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((p) => (
          <div key={p.id} className="bg-white rounded-lg border p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Badge label={p.platform} colorClass={p.platform === 'facebook' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'} />
                <Badge label={p.post_type} colorClass="bg-gray-100 text-gray-600" />
                <Badge label={p.status} colorClass={p.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'} />
              </div>
              {p.permalink_url && (
                <a href={p.permalink_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">View Post</a>
              )}
            </div>
            {p.full_picture && (
              <div className="h-24 bg-gray-100 rounded overflow-hidden">
                <img src={p.full_picture} alt="Post" className="h-full w-full object-cover" />
              </div>
            )}
            <p className="text-sm text-gray-700 line-clamp-2">{p.message}</p>
            <div className="flex gap-4 text-sm text-gray-500">
              <span>👍 {p.likes.toLocaleString()}</span>
              <span>💬 {p.comments.toLocaleString()}</span>
              <span>🔁 {p.shares.toLocaleString()}</span>
              <span>👁 {p.reach.toLocaleString()}</span>
            </div>
            <p className="text-xs text-gray-400">{new Date(p.created_time || p.created_at).toLocaleString()}</p>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-2 border border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-500 text-sm">
            No posts match these filters.
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">New Post</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
              <div className="flex gap-2">
                {['facebook', 'instagram'].map(pl => (
                  <button key={pl} onClick={() => setForm(f => ({ ...f, platform: pl }))}
                    className={`flex-1 py-2 rounded text-sm font-medium border ${form.platform === pl ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}>
                    {pl.charAt(0).toUpperCase() + pl.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Post Type</label>
              <select value={form.post_type} onChange={e => setForm(f => ({ ...f, post_type: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm">
                {['feed', 'reel', 'story'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Message <span className="text-gray-400">({form.message.length}/{maxChars})</span>
              </label>
              <textarea rows={4} maxLength={maxChars}
                value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder={`Write your ${form.platform} post...`} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Image URL (optional)</label>
              <input type="url" value={form.image_url}
                onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm" placeholder="https://..." />
            </div>
            {result?.warning ? (
              <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-800">
                {String(result.warning)}
                {result.manual_url ? (
                  <a href={String(result.manual_url)} target="_blank" rel="noopener noreferrer"
                    className="block mt-1 text-blue-600 underline">Open Meta Business Manager</a>
                ) : null}
              </div>
            ) : null}
            {result?.error ? (
              <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">{String(result.error)}</div>
            ) : null}
            <div className="flex gap-2">
              <button onClick={() => handlePublish(false)} disabled={submitting || !form.message}
                className="flex-1 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {submitting ? 'Publishing...' : 'Publish Now'}
              </button>
              <button onClick={() => handlePublish(true)} disabled={submitting || !form.message}
                className="flex-1 py-2 bg-gray-200 text-gray-700 rounded text-sm font-medium hover:bg-gray-300 disabled:opacity-50">
                Save Draft
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdsTab({ campaigns }: { campaigns: MetaCampaign[] }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ campaign_name: '', objective: 'LEADS', daily_budget: '', start_date: '', end_date: '' });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');

  const OBJECTIVES = ['AWARENESS', 'TRAFFIC', 'ENGAGEMENT', 'LEADS', 'SALES', 'APP_PROMOTION', 'CONVERSIONS'];
  const objColors: Record<string, string> = {
    AWARENESS: 'bg-blue-100 text-blue-700', TRAFFIC: 'bg-cyan-100 text-cyan-700',
    ENGAGEMENT: 'bg-purple-100 text-purple-700', LEADS: 'bg-green-100 text-green-700',
    SALES: 'bg-amber-100 text-amber-700', APP_PROMOTION: 'bg-pink-100 text-pink-700',
    CONVERSIONS: 'bg-orange-100 text-orange-700',
  };

  const totalSpend = campaigns.reduce((s, c) => s + (Number(c.spend) || 0), 0);
  const totalImpressions = campaigns.reduce((s, c) => s + (Number(c.impressions) || 0), 0);
  const totalClicks = campaigns.reduce((s, c) => s + (Number(c.clicks) || 0), 0);
  const totalConversions = campaigns.reduce((s, c) => s + (Number(c.conversions) || 0), 0);
  const avgCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00';
  const maxSpend = Math.max(...campaigns.map(c => Number(c.spend) || 0), 1);

  async function handleCreate() {
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/meta-integration/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, daily_budget: Number(form.daily_budget) || undefined }),
      });
      const data = await res.json() as Record<string, unknown>;
      setMsg(data.warning ? String(data.warning) : 'Campaign created successfully');
      if (!data.error) setShowForm(false);
    } catch { setMsg('Failed to create campaign'); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiCard label="Total Spend" value={`$${totalSpend.toFixed(0)}`} color="amber" />
        <KpiCard label="Impressions" value={totalImpressions.toLocaleString()} color="blue" />
        <KpiCard label="Avg CTR" value={`${avgCtr}%`} color="green" />
        <KpiCard label="Conversions" value={totalConversions} color="purple" />
        <KpiCard label="Campaigns" value={campaigns.length} color="teal" />
      </div>

      <div className="bg-white rounded-lg border p-4">
        <h3 className="font-semibold mb-4 text-gray-700">Ad Spend by Campaign</h3>
        <div className="space-y-2">
          {campaigns.map(c => {
            const pct = Math.round((Number(c.spend) / maxSpend) * 100);
            const isOverBudget = c.lifetime_budget && Number(c.spend) / Number(c.lifetime_budget) > 0.9;
            return (
              <div key={c.id} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className={isOverBudget ? 'text-red-600 font-medium' : 'text-gray-700'}>{c.campaign_name}</span>
                  <span className="text-gray-500">${Number(c.spend).toFixed(2)}{isOverBudget && ' ⚠️'}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full">
                  <div className={`h-2 rounded-full ${isOverBudget ? 'bg-red-500' : 'bg-blue-500'}`}
                    style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-700">All Campaigns</h3>
        <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          + New Campaign
        </button>
      </div>

      {msg && <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-800">{msg}</div>}

      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>{['Campaign', 'Objective', 'Status', 'Daily Budget', 'Spend', 'Impressions', 'Clicks', 'CTR', 'ROAS'].map(h => (
              <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 whitespace-nowrap">{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {campaigns.map(c => {
              const isAlert = c.lifetime_budget && Number(c.spend) / Number(c.lifetime_budget) > 0.9;
              return (
                <tr key={c.id} className={`border-t hover:bg-gray-50 ${isAlert ? 'bg-red-50' : ''}`}>
                  <td className="px-4 py-2 font-medium text-gray-800">{c.campaign_name}</td>
                  <td className="px-4 py-2"><Badge label={c.objective} colorClass={objColors[c.objective] || 'bg-gray-100 text-gray-600'} /></td>
                  <td className="px-4 py-2"><Badge label={c.status} colorClass={c.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'} /></td>
                  <td className="px-4 py-2">{c.daily_budget ? `$${Number(c.daily_budget).toFixed(2)}` : '—'}</td>
                  <td className="px-4 py-2 font-medium">${Number(c.spend).toFixed(2)}</td>
                  <td className="px-4 py-2">{Number(c.impressions).toLocaleString()}</td>
                  <td className="px-4 py-2">{Number(c.clicks).toLocaleString()}</td>
                  <td className="px-4 py-2">{c.ctr ? `${(Number(c.ctr) * 100).toFixed(2)}%` : '—'}</td>
                  <td className="px-4 py-2">{c.roas ? `${Number(c.roas).toFixed(2)}x` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">New Campaign</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name</label>
              <input value={form.campaign_name} onChange={e => setForm(f => ({ ...f, campaign_name: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm" placeholder="e.g. Autumn Enrollment Drive" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Objective</label>
              <select value={form.objective} onChange={e => setForm(f => ({ ...f, objective: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm">
                {OBJECTIVES.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Daily Budget ($)</label>
              <input type="number" value={form.daily_budget}
                onChange={e => setForm(f => ({ ...f, daily_budget: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm" placeholder="25.00" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input type="date" value={form.start_date}
                  onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input type="date" value={form.end_date}
                  onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm" />
              </div>
            </div>
            <button onClick={handleCreate} disabled={submitting || !form.campaign_name}
              className="w-full py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {submitting ? 'Creating...' : 'Create Campaign'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewsTab({ reviews }: { reviews: MetaReview[] }) {
  const [filter, setFilter] = useState('all');
  const [ratingFilter, setRatingFilter] = useState(0);
  const [replyId, setReplyId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [aiLoading, setAiLoading] = useState<string | null>(null);

  const filtered = reviews.filter(r => {
    if (filter === 'unresponded' && r.response_text) return false;
    if (filter === 'responded' && !r.response_text) return false;
    if (ratingFilter > 0 && r.rating !== ratingFilter) return false;
    return true;
  });

  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : '0.0';

  const dist = [5, 4, 3, 2, 1].map(n => ({
    n, count: reviews.filter(r => r.rating === n).length,
    pct: reviews.length ? Math.round((reviews.filter(r => r.rating === n).length / reviews.length) * 100) : 0,
  }));

  async function postReply(reviewId: string) {
    setSubmitting(true);
    try {
      await fetch('/api/admin/meta-integration/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review_id: reviewId, response_text: replyText }),
      });
      setReplyId(null);
      setReplyText('');
    } catch { /* noop */ }
    finally { setSubmitting(false); }
  }

  async function generateAiReply(reviewText: string, rid: string) {
    setAiLoading(rid);
    setReplyId(rid);
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: `Write a professional, empathetic response to this Facebook review: "${reviewText}"` }),
      });
      const data = await res.json() as { text?: string };
      if (data.text) setReplyText(data.text);
    } catch { setReplyText('Thank you for your feedback! We truly appreciate you sharing your experience with us.'); }
    finally { setAiLoading(null); }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-start gap-6">
          <div className="text-center">
            <p className="text-4xl font-bold text-amber-500">{avgRating}</p>
            <StarRating rating={Math.round(Number(avgRating))} />
            <p className="text-xs text-gray-500 mt-1">{reviews.length} reviews</p>
          </div>
          <div className="flex-1 space-y-2">
            {dist.map(d => (
              <div key={d.n} className="flex items-center gap-2 text-sm">
                <span className="w-4 text-gray-600">{d.n}★</span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full">
                  <div className="h-2 bg-amber-400 rounded-full" style={{ width: `${d.pct}%` }} />
                </div>
                <span className="w-8 text-gray-500 text-xs">{d.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {['all', 'unresponded', 'responded'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded text-sm font-medium ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <span className="text-gray-300">|</span>
        {[0, 5, 4, 3, 2, 1].map(r => (
          <button key={r} onClick={() => setRatingFilter(r)}
            className={`px-3 py-1 rounded text-sm ${ratingFilter === r ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {r === 0 ? 'All Ratings' : `${r}★`}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filtered.map((r) => (
          <div key={r.id} className="bg-white rounded-lg border p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-gray-800">{r.reviewer_name}</p>
                <StarRating rating={r.rating} />
                <p className="text-xs text-gray-400 mt-1">{new Date(r.created_time).toLocaleDateString()}</p>
              </div>
              <div className="flex gap-2">
                <Badge
                  label={r.sentiment}
                  colorClass={r.sentiment === 'positive' ? 'bg-green-100 text-green-700' : r.sentiment === 'negative' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}
                />
                {r.response_text && <Badge label="Responded" colorClass="bg-blue-100 text-blue-700" />}
              </div>
            </div>
            <p className="text-sm text-gray-700">{r.review_text}</p>
            {r.response_text && (
              <div className="bg-blue-50 rounded p-2 text-sm text-blue-800">
                <span className="font-medium">Your response: </span>{r.response_text}
              </div>
            )}
            {!r.response_text && (
              <div className="flex gap-2">
                <button onClick={() => { setReplyId(r.review_id); setReplyText(''); }}
                  className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200">
                  Reply
                </button>
                <button onClick={() => generateAiReply(r.review_text, r.review_id)} disabled={aiLoading === r.review_id}
                  className="px-3 py-1 bg-purple-100 text-purple-700 rounded text-sm hover:bg-purple-200 disabled:opacity-50">
                  {aiLoading === r.review_id ? 'Generating...' : 'AI Response'}
                </button>
              </div>
            )}
            {replyId === r.review_id && (
              <div className="space-y-2">
                <textarea rows={3} value={replyText} onChange={e => setReplyText(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm" placeholder="Write your response..." />
                <div className="flex gap-2">
                  <button onClick={() => postReply(r.review_id)} disabled={submitting || !replyText}
                    className="px-4 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50">
                    {submitting ? 'Sending...' : 'Send Response'}
                  </button>
                  <button onClick={() => setReplyId(null)} className="px-4 py-1 bg-gray-200 text-gray-700 rounded text-sm">Cancel</button>
                </div>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="border border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-500 text-sm">
            No reviews match these filters.
          </div>
        )}
      </div>
    </div>
  );
}

function InstagramTab({ data }: { data: MetaData }) {
  const igPosts = data.posts.filter(p => p.platform === 'instagram');
  const reels = igPosts.filter(p => p.post_type === 'reel');
  const stories = igPosts.filter(p => p.post_type === 'story');
  const feed = igPosts.filter(p => p.post_type === 'feed');

  const totalLikes = igPosts.reduce((s, p) => s + p.likes, 0);
  const totalComments = igPosts.reduce((s, p) => s + p.comments, 0);
  const totalImpressions = igPosts.reduce((s, p) => s + p.impressions, 0);
  const avgEngagement = igPosts.length > 0
    ? (((totalLikes + totalComments) / Math.max(totalImpressions, 1)) * 100).toFixed(2)
    : '0.00';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="IG Posts" value={igPosts.length} color="pink" />
        <KpiCard label="Total Likes" value={totalLikes.toLocaleString()} color="purple" />
        <KpiCard label="Total Comments" value={totalComments.toLocaleString()} color="blue" />
        <KpiCard label="Avg Engagement" value={`${avgEngagement}%`} color="green" />
      </div>

      {reels.length > 0 && (
        <div className="bg-white rounded-lg border p-4">
          <h3 className="font-semibold mb-3 text-gray-700">Reels</h3>
          <div className="space-y-2">
            {reels.map(r => (
              <div key={r.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                <div>
                  <p className="text-sm text-gray-700 line-clamp-1">{r.message}</p>
                  <p className="text-xs text-gray-400">{new Date(r.created_time || r.created_at).toLocaleDateString()}</p>
                </div>
                <div className="text-sm text-gray-500 flex gap-3 whitespace-nowrap">
                  <span>▶ {r.video_views.toLocaleString()}</span>
                  <span>❤️ {r.likes.toLocaleString()}</span>
                  <span>💬 {r.comments.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {stories.length > 0 && (
        <div className="bg-white rounded-lg border p-4">
          <h3 className="font-semibold mb-3 text-gray-700">Stories</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {stories.map(s => (
              <div key={s.id} className="bg-gradient-to-b from-pink-100 to-purple-100 rounded-lg p-3 text-sm">
                <p className="text-gray-700 line-clamp-2 text-xs">{s.message}</p>
                <p className="text-xs text-gray-500 mt-2">👁 {s.impressions.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {feed.length > 0 && (
        <div className="bg-white rounded-lg border p-4">
          <h3 className="font-semibold mb-3 text-gray-700">Feed Posts</h3>
          <div className="grid grid-cols-3 gap-3">
            {feed.map(p => (
              <div key={p.id} className="aspect-square bg-gray-100 rounded-lg relative overflow-hidden">
                {p.full_picture
                  ? <img src={p.full_picture} alt="Post" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs p-2 text-center">{p.message.slice(0, 50)}</div>}
                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 flex gap-2">
                  <span>❤️ {p.likes}</span>
                  <span>💬 {p.comments}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-center">
        <a href="/admin/meta-integration?tab=posts"
          className="px-6 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg text-sm font-medium hover:opacity-90">
          Post to Instagram
        </a>
      </div>
    </div>
  );
}

function SetupTab({ appId }: { appId: string }) {
  const steps = [
    { done: true, label: 'Facebook App ID configured', detail: `App ID: ${appId}` },
    { done: false, label: 'Create a Facebook Page', detail: 'Go to facebook.com/pages/create', link: 'https://www.facebook.com/pages/create' },
    { done: false, label: 'Connect to Meta Business Suite', detail: 'business.facebook.com → Add Assets → Pages', link: 'https://business.facebook.com' },
    { done: false, label: 'Generate Page Access Token', detail: 'In Meta Business Suite → System Users → Generate Token. Set META_PAGE_ID and META_PAGE_ACCESS_TOKEN.' },
    { done: false, label: 'Set Ad Account (optional)', detail: 'Set META_AD_ACCOUNT_ID for campaign sync.' },
    { done: false, label: 'Create Meta Pixel (optional)', detail: 'Events Manager → Create Pixel → Set NEXT_PUBLIC_META_PIXEL_ID.' },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-white rounded-lg border p-6">
        <h3 className="font-semibold text-gray-700 mb-4">Meta Business Setup Guide</h3>
        <div className="space-y-4">
          {steps.map((s, i) => (
            <div key={i} className="flex gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${s.done ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                {s.done ? '✓' : i + 1}
              </div>
              <div>
                <p className={`font-medium ${s.done ? 'text-green-700' : 'text-gray-700'}`}>{s.label}</p>
                <p className="text-sm text-gray-500">{s.detail}</p>
                {s.link && (
                  <a href={s.link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">{s.link}</a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg border p-6">
        <h3 className="font-semibold text-gray-700 mb-4">Webhook Setup</h3>
        <p className="text-sm text-gray-600 mb-3">Register the webhook in your Meta App Dashboard to receive real-time updates for page events:</p>
        <div className="bg-gray-50 rounded p-3 font-mono text-sm">
          POST /api/admin/meta-integration/webhook
        </div>
        <p className="text-sm text-gray-500 mt-2">Subscribe to: <code className="bg-gray-100 px-1 rounded">feed</code>, <code className="bg-gray-100 px-1 rounded">ratings</code>, <code className="bg-gray-100 px-1 rounded">messages</code></p>
        <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer"
          className="inline-block mt-3 text-sm text-blue-600 hover:underline">
          Open Meta App Dashboard
        </a>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const TABS = ['dashboard', 'posts', 'ads', 'reviews', 'instagram', 'setup'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = {
  dashboard: 'Dashboard', posts: 'Posts & Publishing', ads: 'Facebook Ads',
  reviews: 'Reviews & Ratings', instagram: 'Instagram', setup: 'Setup & Webhooks',
};

export default function MetaIntegrationPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [data, setData] = useState<MetaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/meta-integration', { cache: 'no-store' });
      if (res.ok) setData(await res.json() as MetaData);
    } catch { /* noop */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSync() {
    setSyncing(true);
    setSyncMsg('');
    try {
      const res = await fetch('/api/admin/meta-integration/sync', { method: 'POST' });
      const result = await res.json() as { synced: { posts: number; reviews: number; campaigns: number }; warnings: string[] };
      setSyncMsg(`Synced: ${result.synced.posts} posts, ${result.synced.reviews} reviews, ${result.synced.campaigns} campaigns.${result.warnings?.length ? ' Warnings: ' + result.warnings.join('; ') : ''}`);
      await load();
    } catch { setSyncMsg('Sync failed — check console'); }
    finally { setSyncing(false); }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading Meta Integration Hub...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-500">Failed to load Meta data. Check your database connection.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Meta / Facebook Integration Hub</h1>
            <p className="text-sm text-gray-500 mt-0.5">Facebook Pages · Instagram · Meta Ads · Reviews</p>
          </div>
          {syncing && <div className="text-sm text-blue-600">Syncing...</div>}
        </div>
        {syncMsg && (
          <div className="mt-2 bg-blue-50 border border-blue-200 rounded p-2 text-sm text-blue-800">{syncMsg}</div>
        )}
      </div>

      <div className="flex">
        {/* Left Nav */}
        <div className="w-52 min-h-screen bg-white border-r flex-shrink-0">
          <nav className="p-3 space-y-1">
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`w-full text-left px-3 py-2 rounded text-sm font-medium transition-colors ${tab === t ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                {TAB_LABELS[t]}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 p-6">
          {tab === 'dashboard' && <DashboardTab data={data} onSync={handleSync} />}
          {tab === 'posts' && <PostsTab posts={data.posts} />}
          {tab === 'ads' && <AdsTab campaigns={data.campaigns} />}
          {tab === 'reviews' && <ReviewsTab reviews={data.reviews} />}
          {tab === 'instagram' && <InstagramTab data={data} />}
          {tab === 'setup' && <SetupTab appId={data.appId} />}
        </div>
      </div>
    </div>
  );
}
