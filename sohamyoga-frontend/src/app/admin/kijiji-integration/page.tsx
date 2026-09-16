'use client';
import { useEffect, useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface KijijiListing {
  id: number;
  title: string;
  category: string;
  subcategory?: string;
  price?: number;
  price_type: string;
  description?: string;
  location_city?: string;
  location_province: string;
  images?: string[];
  contact_method: string;
  phone?: string;
  status: string;
  kijiji_url?: string;
  kijiji_ad_id?: string;
  views_count: number;
  responses_count: number;
  posted_at?: string;
  expires_at?: string;
  auto_renew: boolean;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

interface KijijiLead {
  id: number;
  listing_id: number;
  listing_title?: string;
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
  response_channel: string;
  status: string;
  created_at: string;
}

interface Stats {
  total_listings: number;
  by_status: { draft: number; ready: number; posted: number; expired: number };
  by_category: { category: string; count: number }[];
  total_leads: number;
  leads_by_status: { new: number; contacted: number; qualified: number; lost: number };
  top_listing: { title: string; views_count: number; responses_count: number } | null;
  avg_response_rate: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Real Estate', 'Jobs', 'For Sale', 'Services', 'Pets',
  'Community', 'Buy & Sell', 'Cars & Vehicles',
];

const PROVINCES = ['AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT'];

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  ready: 'bg-blue-100 text-blue-700',
  posted: 'bg-green-100 text-green-700',
  expired: 'bg-red-100 text-red-700',
  paused: 'bg-yellow-100 text-yellow-700',
};

const LEAD_STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  contacted: 'bg-yellow-100 text-yellow-800',
  qualified: 'bg-green-100 text-green-700',
  lost: 'bg-red-100 text-red-700',
};

type Tab = 'dashboard' | 'listings' | 'leads' | 'ai-copy' | 'guide';

const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'listings',  label: 'Listings'  },
  { id: 'leads',     label: 'Leads'     },
  { id: 'ai-copy',   label: 'AI Copy Generator' },
  { id: 'guide',     label: 'Posting Guide' },
];

// ─── Blank form helpers ───────────────────────────────────────────────────────

function blankListing() {
  return {
    title: '', category: 'For Sale', subcategory: '',
    price: '', price_type: 'fixed', description: '',
    location_city: '', location_province: 'ON',
    contact_method: 'email', phone: '',
    tags: '', status: 'draft', auto_renew: false,
  };
}

function blankLead() {
  return { listing_id: '', name: '', email: '', phone: '', message: '', response_channel: 'email' };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-20 text-gray-600">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
        <div className={`h-3 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-16 text-right text-gray-700 font-medium">{value} ({pct}%)</span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function KijijiIntegrationPage() {
  const [tab, setTab] = useState<Tab>('dashboard');

  // Global data
  const [stats, setStats] = useState<Stats | null>(null);
  const [listings, setListings] = useState<KijijiListing[]>([]);
  const [listingStats, setListingStats] = useState({ total: 0, draft: 0, ready: 0, posted: 0, expired: 0 });
  const [leads, setLeads] = useState<KijijiLead[]>([]);

  // Listing filters
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterSearch, setFilterSearch] = useState('');

  // Lead filters
  const [filterLeadListing, setFilterLeadListing] = useState('all');
  const [filterLeadStatus, setFilterLeadStatus] = useState('all');

  // Modals
  const [showAddListing, setShowAddListing] = useState(false);
  const [editListing, setEditListing] = useState<KijijiListing | null>(null);
  const [showPublishModal, setShowPublishModal] = useState<KijijiListing | null>(null);
  const [publishUrl, setPublishUrl] = useState('');
  const [publishAdId, setPublishAdId] = useState('');
  const [showAddLead, setShowAddLead] = useState(false);

  // Forms
  const [listingForm, setListingForm] = useState(blankListing());
  const [leadForm, setLeadForm] = useState(blankLead());

  // AI copy
  const [aiForm, setAiForm] = useState({ title: '', category: 'For Sale', key_features: '', price: '', location: '' });
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiCopied, setAiCopied] = useState(false);

  // Saving
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  // ── Data loaders ─────────────────────────────────────────────────────────

  const loadStats = useCallback(() => {
    fetch('/api/admin/kijiji-integration/stats')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setStats(d); });
  }, []);

  const loadListings = useCallback(() => {
    const p = new URLSearchParams();
    if (filterStatus !== 'all') p.set('status', filterStatus);
    if (filterCategory !== 'all') p.set('category', filterCategory);
    if (filterSearch) p.set('search', filterSearch);
    fetch(`/api/admin/kijiji-integration?${p}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        setListings(d.listings ?? []);
        setListingStats(d.stats ?? { total: 0, draft: 0, ready: 0, posted: 0, expired: 0 });
      });
  }, [filterStatus, filterCategory, filterSearch]);

  const loadLeads = useCallback(() => {
    const p = new URLSearchParams();
    if (filterLeadListing !== 'all') p.set('listing_id', filterLeadListing);
    if (filterLeadStatus !== 'all') p.set('status', filterLeadStatus);
    fetch(`/api/admin/kijiji-integration/leads?${p}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setLeads(d.leads ?? []); });
  }, [filterLeadListing, filterLeadStatus]);

  useEffect(() => { loadStats(); loadListings(); loadLeads(); }, [loadStats, loadListings, loadLeads]);

  // ── Listing CRUD ──────────────────────────────────────────────────────────

  const openEdit = (l: KijijiListing) => {
    setEditListing(l);
    setListingForm({
      title: l.title, category: l.category, subcategory: l.subcategory ?? '',
      price: l.price != null ? String(l.price) : '', price_type: l.price_type,
      description: l.description ?? '', location_city: l.location_city ?? '',
      location_province: l.location_province, contact_method: l.contact_method,
      phone: l.phone ?? '', tags: (l.tags ?? []).join(', '),
      status: l.status, auto_renew: l.auto_renew,
    });
    setShowAddListing(true);
  };

  const saveListing = async () => {
    setSaving(true);
    setMsg('');
    const payload = {
      title: listingForm.title,
      category: listingForm.category,
      subcategory: listingForm.subcategory || undefined,
      price: listingForm.price ? Number(listingForm.price) : undefined,
      price_type: listingForm.price_type,
      description: listingForm.description || undefined,
      location_city: listingForm.location_city || undefined,
      location_province: listingForm.location_province,
      contact_method: listingForm.contact_method,
      phone: listingForm.phone || undefined,
      status: listingForm.status,
      auto_renew: listingForm.auto_renew,
      tags: listingForm.tags ? listingForm.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    };
    const url = editListing
      ? `/api/admin/kijiji-integration/${editListing.id}`
      : '/api/admin/kijiji-integration';
    const method = editListing ? 'PUT' : 'POST';
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    setSaving(false);
    if (r.ok) {
      setMsg(editListing ? 'Listing updated.' : 'Listing created.');
      setShowAddListing(false);
      setEditListing(null);
      setListingForm(blankListing());
      loadListings();
      loadStats();
    } else {
      const d = await r.json();
      setMsg(d.error ?? 'Error saving listing.');
    }
  };

  const deleteListing = async (id: number) => {
    if (!confirm('Delete this listing?')) return;
    await fetch(`/api/admin/kijiji-integration/${id}`, { method: 'DELETE' });
    loadListings();
    loadStats();
  };

  const publishListing = async () => {
    if (!showPublishModal) return;
    setSaving(true);
    const r = await fetch(`/api/admin/kijiji-integration/${showPublishModal.id}/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kijiji_url: publishUrl || undefined, kijiji_ad_id: publishAdId || undefined }),
    });
    setSaving(false);
    if (r.ok) {
      setShowPublishModal(null);
      setPublishUrl('');
      setPublishAdId('');
      loadListings();
      loadStats();
    }
  };

  // ── Lead CRUD ─────────────────────────────────────────────────────────────

  const saveLead = async () => {
    setSaving(true);
    setMsg('');
    const r = await fetch('/api/admin/kijiji-integration/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        listing_id: Number(leadForm.listing_id),
        name: leadForm.name || undefined,
        email: leadForm.email || undefined,
        phone: leadForm.phone || undefined,
        message: leadForm.message || undefined,
        response_channel: leadForm.response_channel,
      }),
    });
    setSaving(false);
    if (r.ok) {
      setMsg('Lead logged.');
      setShowAddLead(false);
      setLeadForm(blankLead());
      loadLeads();
      loadStats();
      loadListings();
    } else {
      const d = await r.json();
      setMsg(d.error ?? 'Error saving lead.');
    }
  };

  const updateLeadStatus = async (id: number, status: string) => {
    await fetch('/api/admin/kijiji-integration/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    loadLeads();
  };

  // ── AI Copy ───────────────────────────────────────────────────────────────

  const generateCopy = async () => {
    setAiLoading(true);
    setAiResult('');
    setAiError('');
    const r = await fetch('/api/admin/kijiji-integration/generate-copy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: aiForm.title,
        category: aiForm.category,
        key_features: aiForm.key_features,
        price: aiForm.price ? Number(aiForm.price) : undefined,
        location: aiForm.location,
      }),
    });
    setAiLoading(false);
    const d = await r.json();
    if (d.error) setAiError(d.error);
    else setAiResult(d.description ?? '');
  };

  const copyToClipboard = async () => {
    if (!aiResult) return;
    await navigator.clipboard.writeText(aiResult);
    setAiCopied(true);
    setTimeout(() => setAiCopied(false), 2000);
  };

  const useGeneratedCopy = () => {
    if (!aiResult) return;
    setListingForm({ ...blankListing(), title: aiForm.title, category: aiForm.category, description: aiResult, location_city: aiForm.location });
    setEditListing(null);
    setShowAddListing(true);
    setTab('listings');
  };

  // ── Render helpers ────────────────────────────────────────────────────────

  const lf = (k: keyof typeof listingForm) => (
    <input
      className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full"
      value={String(listingForm[k])}
      onChange={e => setListingForm(prev => ({ ...prev, [k]: e.target.value }))}
    />
  );

  const posted = listings.filter(l => l.status === 'posted');

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">Kijiji.ca Integration</h1>
        <p className="text-sm text-gray-500 mt-0.5">Listing management, lead tracking, and AI-powered ad copy for Canada&apos;s largest classifieds platform.</p>
      </div>

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        {msg && (
          <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-4 py-2 text-sm">
            {msg}
          </div>
        )}

        {/* ══════════════════════ TAB 1 — DASHBOARD ══════════════════════ */}
        {tab === 'dashboard' && (
          <div className="space-y-6">
            {/* Stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Listings', value: listingStats.total, color: 'text-gray-900' },
                { label: 'Posted Live', value: listingStats.posted, color: 'text-green-700' },
                { label: 'Total Leads', value: stats?.total_leads ?? 0, color: 'text-blue-700' },
                { label: 'Avg Response Rate', value: `${stats?.avg_response_rate ?? 0}%`, color: 'text-purple-700' },
              ].map(c => (
                <div key={c.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">{c.label}</p>
                  <p className={`text-3xl font-bold mt-1 ${c.color}`}>{c.value}</p>
                </div>
              ))}
            </div>

            {/* Status breakdown */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Listings by Status</h2>
              <div className="space-y-3">
                <StatusBar label="Draft" value={listingStats.draft} total={listingStats.total} color="bg-gray-400" />
                <StatusBar label="Ready" value={listingStats.ready} total={listingStats.total} color="bg-blue-500" />
                <StatusBar label="Posted" value={listingStats.posted} total={listingStats.total} color="bg-green-500" />
                <StatusBar label="Expired" value={listingStats.expired} total={listingStats.total} color="bg-red-400" />
              </div>
            </div>

            {/* Category breakdown + top listing */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h2 className="font-semibold text-gray-900 mb-3">Listings by Category</h2>
                {(stats?.by_category ?? []).length === 0 ? (
                  <p className="text-sm text-gray-400">No listings yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {(stats?.by_category ?? []).map(c => (
                      <li key={c.category} className="flex justify-between text-sm">
                        <span className="text-gray-700">{c.category}</span>
                        <span className="font-semibold text-gray-900">{c.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h2 className="font-semibold text-gray-900 mb-3">Top Performing Listing</h2>
                {stats?.top_listing ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-900">{stats.top_listing.title}</p>
                    <p className="text-sm text-gray-600">Views: <strong>{stats.top_listing.views_count}</strong></p>
                    <p className="text-sm text-gray-600">Responses: <strong>{stats.top_listing.responses_count}</strong></p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">No posted listings yet.</p>
                )}
              </div>
            </div>

            {/* Quick actions */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h2 className="font-semibold text-gray-900 mb-3">Quick Actions</h2>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => { setTab('listings'); setShowAddListing(true); }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                  + Create Listing
                </button>
                <button
                  onClick={() => { setTab('leads'); setShowAddLead(true); }}
                  className="bg-slate-700 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                  Log Lead
                </button>
                {posted.length > 0 && (
                  <span className="text-sm text-gray-500 self-center">
                    {posted.length} listing{posted.length > 1 ? 's' : ''} currently live on Kijiji
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════ TAB 2 — LISTINGS ══════════════════════ */}
        {tab === 'listings' && (
          <div className="space-y-4">
            {/* Filters + Add */}
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div className="flex flex-wrap gap-2">
                <select
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                >
                  <option value="all">All Statuses</option>
                  <option value="draft">Draft</option>
                  <option value="ready">Ready</option>
                  <option value="posted">Posted</option>
                  <option value="expired">Expired</option>
                </select>
                <select
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={filterCategory}
                  onChange={e => setFilterCategory(e.target.value)}
                >
                  <option value="all">All Categories</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-48"
                  placeholder="Search title..."
                  value={filterSearch}
                  onChange={e => setFilterSearch(e.target.value)}
                />
              </div>
              <button
                onClick={() => { setEditListing(null); setListingForm(blankListing()); setShowAddListing(true); }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                + Add Listing
              </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Title', 'Category', 'Price', 'Location', 'Status', 'Views', 'Responses', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left font-medium text-gray-600 text-xs uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {listings.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-gray-400">No listings found.</td>
                    </tr>
                  ) : listings.map(l => (
                    <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900 max-w-xs">
                        <div className="truncate">{l.title}</div>
                        {l.kijiji_url && (
                          <div className="text-xs text-blue-600 truncate mt-0.5">{l.kijiji_url}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {l.category}
                        {l.subcategory && <span className="text-gray-400"> / {l.subcategory}</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {l.price_type === 'free' ? 'Free'
                          : l.price_type === 'please_contact' ? 'Contact'
                          : l.price != null ? `$${Number(l.price).toLocaleString('en-CA', { minimumFractionDigits: 0 })}`
                          : '—'}
                        {l.price_type === 'negotiable' && l.price != null && <span className="text-gray-400 text-xs ml-1">(OBO)</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {[l.location_city, l.location_province].filter(Boolean).join(', ') || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[l.status] ?? 'bg-gray-100 text-gray-700'}`}>
                          {l.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{l.views_count}</td>
                      <td className="px-4 py-3 text-gray-600">{l.responses_count}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEdit(l)}
                            className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                          >
                            Edit
                          </button>
                          {l.status !== 'posted' && (
                            <button
                              onClick={() => { setShowPublishModal(l); setPublishUrl(''); setPublishAdId(''); }}
                              className="text-green-600 hover:text-green-800 text-xs font-medium"
                            >
                              Mark Posted
                            </button>
                          )}
                          <button
                            onClick={() => deleteListing(l.id)}
                            className="text-red-500 hover:text-red-700 text-xs font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══════════════════════ TAB 3 — LEADS ══════════════════════ */}
        {tab === 'leads' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div className="flex flex-wrap gap-2">
                <select
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={filterLeadListing}
                  onChange={e => setFilterLeadListing(e.target.value)}
                >
                  <option value="all">All Listings</option>
                  {listings.map(l => <option key={l.id} value={String(l.id)}>{l.title}</option>)}
                </select>
                <select
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={filterLeadStatus}
                  onChange={e => setFilterLeadStatus(e.target.value)}
                >
                  <option value="all">All Statuses</option>
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="qualified">Qualified</option>
                  <option value="lost">Lost</option>
                </select>
              </div>
              <button
                onClick={() => setShowAddLead(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                + Log Lead
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Name', 'Email', 'Phone', 'Listing', 'Message', 'Channel', 'Status', 'Date'].map(h => (
                      <th key={h} className="px-4 py-3 text-left font-medium text-gray-600 text-xs uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leads.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-gray-400">No leads yet.</td>
                    </tr>
                  ) : leads.map(lead => (
                    <tr key={lead.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{lead.name ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-[140px] truncate">{lead.email ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{lead.phone ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-700 max-w-[160px] truncate">{lead.listing_title ?? `#${lead.listing_id}`}</td>
                      <td className="px-4 py-3 text-gray-500 max-w-[180px] truncate" title={lead.message ?? ''}>
                        {lead.message ? (lead.message.length > 50 ? lead.message.slice(0, 50) + '…' : lead.message) : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 capitalize">{lead.response_channel}</td>
                      <td className="px-4 py-3">
                        <select
                          className={`text-xs font-medium px-2 py-1 rounded-full border-0 ${LEAD_STATUS_COLORS[lead.status] ?? 'bg-gray-100 text-gray-700'}`}
                          value={lead.status}
                          onChange={e => updateLeadStatus(lead.id, e.target.value)}
                        >
                          <option value="new">New</option>
                          <option value="contacted">Contacted</option>
                          <option value="qualified">Qualified</option>
                          <option value="lost">Lost</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {new Date(lead.created_at).toLocaleDateString('en-CA')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══════════════════════ TAB 4 — AI COPY ══════════════════════ */}
        {tab === 'ai-copy' && (
          <div className="max-w-2xl space-y-5">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
              <h2 className="font-semibold text-gray-900">Generate Optimized Kijiji Ad Copy</h2>
              <p className="text-sm text-gray-500">Powered by Ollama llama3.2 running locally — no data leaves your machine.</p>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Ad Title *</label>
                  <input
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full"
                    placeholder="e.g. iPhone 14 Pro Max 256GB Deep Purple"
                    value={aiForm.title}
                    onChange={e => setAiForm(p => ({ ...p, title: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Category *</label>
                    <select
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full"
                      value={aiForm.category}
                      onChange={e => setAiForm(p => ({ ...p, category: e.target.value }))}
                    >
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Price (CAD)</label>
                    <input
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full"
                      placeholder="e.g. 850"
                      value={aiForm.price}
                      onChange={e => setAiForm(p => ({ ...p, price: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">City / Location</label>
                  <input
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full"
                    placeholder="e.g. Toronto, ON"
                    value={aiForm.location}
                    onChange={e => setAiForm(p => ({ ...p, location: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Key Features (describe what makes this listing great)</label>
                  <textarea
                    rows={4}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full resize-none"
                    placeholder="e.g. Excellent condition, original box, no scratches, battery health 97%, includes charger and case"
                    value={aiForm.key_features}
                    onChange={e => setAiForm(p => ({ ...p, key_features: e.target.value }))}
                  />
                </div>
              </div>

              <button
                onClick={generateCopy}
                disabled={aiLoading || !aiForm.title}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                {aiLoading ? 'Generating…' : 'Generate Ad Copy'}
              </button>

              {aiError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2 text-sm">
                  {aiError === 'Ollama unavailable'
                    ? 'Ollama is not running or llama3.2 is not installed. Start Ollama and run: ollama pull llama3.2'
                    : aiError}
                </div>
              )}
            </div>

            {aiResult && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Generated Ad Description</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={copyToClipboard}
                      className="bg-slate-700 hover:bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-medium"
                    >
                      {aiCopied ? 'Copied!' : 'Copy to Clipboard'}
                    </button>
                    <button
                      onClick={useGeneratedCopy}
                      className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium"
                    >
                      Use This Description
                    </button>
                  </div>
                </div>
                <textarea
                  rows={14}
                  readOnly
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 resize-none font-mono"
                  value={aiResult}
                />
                <p className="text-xs text-gray-400">{aiResult.split(/\s+/).length} words · {aiResult.length} characters</p>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════ TAB 5 — GUIDE ══════════════════════ */}
        {tab === 'guide' && (
          <div className="max-w-3xl space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
              <h2 className="font-bold text-gray-900 text-lg">How to Post on Kijiji.ca — Step-by-Step</h2>
              <ol className="space-y-3 text-sm text-gray-700 list-decimal list-inside">
                <li>Go to <strong>kijiji.ca</strong> and sign in to your account (or create a free account).</li>
                <li>Click <strong>&quot;Post Your Ad&quot;</strong> (top right of the homepage).</li>
                <li>Select the appropriate <strong>category and subcategory</strong> for your listing.</li>
                <li>Choose your <strong>location</strong> (province, city, and postal code).</li>
                <li>Fill in the <strong>ad title</strong> — use the AI Copy Generator to create the description first, then paste it here.</li>
                <li>Set your <strong>price</strong> and price type (fixed, negotiable, free, or &quot;Please contact&quot;).</li>
                <li>Upload <strong>at least 3 photos</strong> — main photo first (front view, good lighting).</li>
                <li>Enter your <strong>contact preferences</strong> (email/phone, reply-to settings).</li>
                <li>Review the preview, then click <strong>&quot;Post Your Ad&quot;</strong>.</li>
                <li>Copy the Kijiji URL and Ad ID, then come back here to <strong>Mark as Posted</strong> so leads are tracked.</li>
              </ol>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
              <h2 className="font-bold text-gray-900">Best Practices</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
                <div className="space-y-2">
                  <h3 className="font-semibold text-gray-900">Timing</h3>
                  <ul className="space-y-1 list-disc list-inside text-gray-600">
                    <li>Best days: <strong>Tuesday – Thursday</strong></li>
                    <li>Best times: <strong>10:00 AM – 2:00 PM</strong> local time</li>
                    <li>Avoid posting late Friday / weekends (low traffic)</li>
                    <li>Renew every 2-3 days to stay on page 1</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-gray-900">Title Tips</h3>
                  <ul className="space-y-1 list-disc list-inside text-gray-600">
                    <li>Include the city name in the title</li>
                    <li>Include price in the title (e.g., &quot;$850 OBO&quot;)</li>
                    <li>Be specific: brand, model, size, condition</li>
                    <li>Max 100 characters — use all of them</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-gray-900">Photos</h3>
                  <ul className="space-y-1 list-disc list-inside text-gray-600">
                    <li>Minimum 3 photos (ideally 8-10)</li>
                    <li>Use natural daylight, not flash</li>
                    <li>Show all sides, any flaws, and accessories</li>
                    <li>First photo = your best selling shot</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-gray-900">Pricing</h3>
                  <ul className="space-y-1 list-disc list-inside text-gray-600">
                    <li>Price 5-10% above your floor to allow negotiation</li>
                    <li>Check recent sold listings for market rate</li>
                    <li>Use &quot;OBO&quot; (Or Best Offer) to signal flexibility</li>
                    <li>Free items always get responses — consider bundling</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
              <h2 className="font-bold text-gray-900">Kijiji Category URLs (Ontario)</h2>
              <p className="text-sm text-gray-500">Copy these paths and navigate manually on kijiji.ca — displayed as text to avoid redirection issues.</p>
              <div className="space-y-2 text-sm">
                {[
                  { label: 'For Sale (Ontario)', path: '/b-for-sale/ontario/c10l9004' },
                  { label: 'Real Estate (Ontario)', path: '/b-real-estate/ontario/c34l9004' },
                  { label: 'Jobs (Ontario)', path: '/b-jobs/ontario/k0c45l9004' },
                  { label: 'Services (Ontario)', path: '/b-services/ontario/c72l9004' },
                  { label: 'Cars & Vehicles (Ontario)', path: '/b-cars-trucks/ontario/c174l9004' },
                  { label: 'Pets (Ontario)', path: '/b-pets/ontario/c112l9004' },
                  { label: 'Community (Ontario)', path: '/b-community/ontario/c1l9004' },
                  { label: 'Buy & Sell (Toronto)', path: '/b-buy-sell-trade/toronto/c10l1700273' },
                ].map(item => (
                  <div key={item.path} className="flex items-start gap-3 bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-gray-700 font-medium w-48 shrink-0">{item.label}</span>
                    <span className="font-mono text-xs text-gray-500 break-all">kijiji.ca{item.path}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-800 rounded-xl p-6 text-white space-y-3">
              <h2 className="font-bold text-lg">Pro Tips</h2>
              <ul className="space-y-2 text-sm text-slate-200">
                <li><strong className="text-white">Top Ad feature:</strong> For high-value items ($500+), Kijiji&apos;s paid &quot;Top Ad&quot; keeps your listing at the top of search results for 7 days — ROI is strong for electronics, vehicles, and real estate.</li>
                <li><strong className="text-white">Respond within 2 hours:</strong> Kijiji&apos;s algorithm rewards active sellers with better placement. Leads that don&apos;t get a reply within 2 hours have a 60%+ drop-off rate.</li>
                <li><strong className="text-white">Safety tip:</strong> Meet in public places (police station parking lots are a common safe exchange spot in Canada). Never share your home address before meeting.</li>
                <li><strong className="text-white">Price anchoring:</strong> If you post multiple items in the same category, your higher-priced listing makes your mid-tier items look like better value.</li>
                <li><strong className="text-white">Urgent language:</strong> Phrases like &quot;moving sale,&quot; &quot;must go this weekend,&quot; and &quot;serious inquiries only&quot; consistently outperform neutral listings.</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════ MODAL: Add/Edit Listing ══════════════════════ */}
      {showAddListing && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-start justify-center z-50 pt-10 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">{editListing ? 'Edit Listing' : 'Add New Listing'}</h2>
              <button onClick={() => { setShowAddListing(false); setEditListing(null); setListingForm(blankListing()); }} className="text-gray-400 hover:text-gray-600 text-xl font-bold">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Title *</label>
                {lf('title')}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Category *</label>
                  <select
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full"
                    value={listingForm.category}
                    onChange={e => setListingForm(p => ({ ...p, category: e.target.value }))}
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Subcategory</label>
                  {lf('subcategory')}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Price (CAD)</label>
                  {lf('price')}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Price Type</label>
                  <select
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full"
                    value={listingForm.price_type}
                    onChange={e => setListingForm(p => ({ ...p, price_type: e.target.value }))}
                  >
                    <option value="fixed">Fixed</option>
                    <option value="negotiable">Negotiable</option>
                    <option value="free">Free</option>
                    <option value="please_contact">Please Contact</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  rows={6}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full resize-none"
                  value={listingForm.description}
                  onChange={e => setListingForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Use AI Copy Generator tab to auto-generate a compelling description..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">City</label>
                  {lf('location_city')}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Province</label>
                  <select
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full"
                    value={listingForm.location_province}
                    onChange={e => setListingForm(p => ({ ...p, location_province: e.target.value }))}
                  >
                    {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Contact Method</label>
                  <select
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full"
                    value={listingForm.contact_method}
                    onChange={e => setListingForm(p => ({ ...p, contact_method: e.target.value }))}
                  >
                    <option value="email">Email</option>
                    <option value="phone">Phone</option>
                    <option value="both">Both</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                  {lf('phone')}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Tags (comma-separated)</label>
                {lf('tags')}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                  <select
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full"
                    value={listingForm.status}
                    onChange={e => setListingForm(p => ({ ...p, status: e.target.value }))}
                  >
                    <option value="draft">Draft</option>
                    <option value="ready">Ready</option>
                    <option value="paused">Paused</option>
                  </select>
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={listingForm.auto_renew}
                      onChange={e => setListingForm(p => ({ ...p, auto_renew: e.target.checked }))}
                      className="rounded"
                    />
                    Auto-renew listing
                  </label>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => { setShowAddListing(false); setEditListing(null); setListingForm(blankListing()); }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={saveListing}
                disabled={saving || !listingForm.title || !listingForm.category}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-5 py-2 rounded-lg text-sm font-medium"
              >
                {saving ? 'Saving…' : editListing ? 'Update Listing' : 'Create Listing'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════ MODAL: Mark as Posted ══════════════════════ */}
      {showPublishModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Mark as Posted on Kijiji</h2>
              <button onClick={() => setShowPublishModal(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">×</button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Listing: <strong>{showPublishModal.title}</strong>
              </p>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Kijiji Listing URL (optional)</label>
                <input
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full"
                  placeholder="e.g. https://www.kijiji.ca/v-for-sale/toronto/..."
                  value={publishUrl}
                  onChange={e => setPublishUrl(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Kijiji Ad ID (optional)</label>
                <input
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full"
                  placeholder="e.g. 1234567890"
                  value={publishAdId}
                  onChange={e => setPublishAdId(e.target.value)}
                />
              </div>
              <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg px-3 py-2 text-xs">
                This will set status to &quot;Posted&quot;, record the post time, and set expiry to 30 days from now.
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowPublishModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button
                onClick={publishListing}
                disabled={saving}
                className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg text-sm font-medium"
              >
                {saving ? 'Saving…' : 'Confirm — Mark as Posted'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════ MODAL: Log Lead ══════════════════════ */}
      {showAddLead && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Log Kijiji Lead</h2>
              <button onClick={() => setShowAddLead(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">×</button>
            </div>
            <div className="p-6 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Listing *</label>
                <select
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full"
                  value={leadForm.listing_id}
                  onChange={e => setLeadForm(p => ({ ...p, listing_id: e.target.value }))}
                >
                  <option value="">Select listing…</option>
                  {listings.map(l => <option key={l.id} value={String(l.id)}>{l.title}</option>)}
                </select>
              </div>
              {(['name', 'email', 'phone'] as const).map(f => (
                <div key={f}>
                  <label className="block text-xs font-medium text-gray-700 mb-1 capitalize">{f}</label>
                  <input
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full"
                    value={leadForm[f]}
                    onChange={e => setLeadForm(p => ({ ...p, [f]: e.target.value }))}
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Message</label>
                <textarea
                  rows={3}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full resize-none"
                  value={leadForm.message}
                  onChange={e => setLeadForm(p => ({ ...p, message: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Response Channel</label>
                <select
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full"
                  value={leadForm.response_channel}
                  onChange={e => setLeadForm(p => ({ ...p, response_channel: e.target.value }))}
                >
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                  <option value="kijiji_chat">Kijiji Chat</option>
                  <option value="sms">SMS</option>
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowAddLead(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button
                onClick={saveLead}
                disabled={saving || !leadForm.listing_id}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-5 py-2 rounded-lg text-sm font-medium"
              >
                {saving ? 'Saving…' : 'Log Lead'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
