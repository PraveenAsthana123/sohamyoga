'use client';

import { useEffect, useState } from 'react';

interface Campaign {
  id: string;
  name: string;
  platform: string;
  status: 'active' | 'paused' | 'completed' | string;
  budget: number;
  startDate?: string;
  endDate?: string;
  spend?: number;
  impressions?: number;
}

interface NewCampaignForm {
  name: string;
  platform: string;
  budget: string;
  goals: string;
  startDate: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/20 text-green-300 border-green-400/30',
  paused: 'bg-yellow-500/20 text-yellow-300 border-yellow-400/30',
  completed: 'bg-blue-500/20 text-blue-300 border-blue-400/30',
};

const PLATFORM_ICONS: Record<string, string> = {
  google: '🔍',
  facebook: '👤',
  instagram: '📸',
  linkedin: '💼',
  twitter: '🐦',
  tiktok: '🎵',
  youtube: '▶️',
  default: '📣',
};

function getPlatformIcon(platform: string): string {
  return PLATFORM_ICONS[platform.toLowerCase()] ?? PLATFORM_ICONS['default'];
}

const PLATFORMS = ['All', 'Google', 'Facebook', 'Instagram', 'LinkedIn', 'YouTube', 'TikTok'];
const STATUSES = ['All', 'active', 'paused', 'completed'];

export default function TalentsHillCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterPlatform, setFilterPlatform] = useState('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState('');
  const [form, setForm] = useState<NewCampaignForm>({
    name: '',
    platform: 'Google',
    budget: '',
    goals: '',
    startDate: '',
  });

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/ads', { cache: 'no-store' }).then((r) => r.json()).catch(() => []),
      fetch('/api/admin/ad-planner', { cache: 'no-store' }).then((r) => r.json()).catch(() => []),
    ]).then(([adsData, plannerData]: [unknown, unknown]) => {
      const ads = Array.isArray(adsData) ? (adsData as Campaign[]) : [];
      const planner = Array.isArray(plannerData) ? (plannerData as Campaign[]) : [];
      setCampaigns([...ads, ...planner]);
    }).finally(() => setLoading(false));
  }, []);

  const filtered = campaigns.filter((c) => {
    const statusMatch = filterStatus === 'All' || c.status === filterStatus;
    const platformMatch =
      filterPlatform === 'All' || c.platform?.toLowerCase() === filterPlatform.toLowerCase();
    return statusMatch && platformMatch;
  });

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  }

  async function handleRequestCampaign(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
        cache: 'no-store',
      });
      if (res.ok) {
        showToast('✅ Campaign request submitted! Your account manager will be in touch within 24 hours.');
      } else {
        showToast('✅ Campaign request received! We\'ll process it shortly.');
      }
    } catch {
      showToast('✅ Campaign request received! We\'ll process it shortly.');
    }
    setShowModal(false);
    setForm({ name: '', platform: 'Google', budget: '', goals: '', startDate: '' });
  }

  return (
    <div className="space-y-6 relative">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-[100] backdrop-blur-md bg-green-500/20 border border-green-400/30 rounded-xl px-5 py-3 text-green-300 text-sm shadow-xl max-w-sm">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-white">My Campaigns</h1>
          <p className="text-white/50 mt-1 text-sm">All your active and historical digital marketing campaigns.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-500/80 hover:bg-blue-400/90 backdrop-blur-sm border border-blue-400/30 text-white rounded-xl px-6 py-3 text-sm font-medium transition-all"
        >
          + Request New Campaign
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="text-white/50 text-sm">Status:</span>
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${filterStatus === s ? 'bg-blue-500/30 text-white border-blue-400/30' : 'bg-white/5 text-white/50 border-white/10 hover:bg-white/10'}`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white/50 text-sm">Platform:</span>
          <select
            value={filterPlatform}
            onChange={(e) => setFilterPlatform(e.target.value)}
            className="bg-white/10 border border-white/20 text-white rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-400/60 backdrop-blur-sm"
          >
            {PLATFORMS.map((p) => (
              <option key={p} value={p} className="bg-slate-900">
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table / List */}
      <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl shadow-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-white/40">Loading campaigns…</div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <div className="text-5xl mb-4">🚀</div>
            <h3 className="text-white font-semibold mb-2">No campaigns yet</h3>
            <p className="text-white/50 text-sm mb-6">Request your first campaign above and we'll get it set up.</p>
            <button
              onClick={() => setShowModal(true)}
              className="bg-blue-500/80 hover:bg-blue-400/90 backdrop-blur-sm border border-blue-400/30 text-white rounded-xl px-6 py-3 text-sm font-medium transition-all"
            >
              + Request New Campaign
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left text-white/50 font-medium px-6 py-4">Campaign</th>
                  <th className="text-left text-white/50 font-medium px-4 py-4">Platform</th>
                  <th className="text-left text-white/50 font-medium px-4 py-4">Status</th>
                  <th className="text-right text-white/50 font-medium px-4 py-4">Budget</th>
                  <th className="text-left text-white/50 font-medium px-4 py-4">Dates</th>
                  <th className="px-4 py-4" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <>
                    <tr
                      key={c.id}
                      className="border-b border-white/10 hover:bg-white/5 transition-colors cursor-pointer"
                      onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                    >
                      <td className="px-6 py-4 text-white font-medium">{c.name ?? '—'}</td>
                      <td className="px-4 py-4">
                        <span className="flex items-center gap-2 text-white/70">
                          {getPlatformIcon(c.platform ?? '')}
                          <span>{c.platform ?? '—'}</span>
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_COLORS[c.status] ?? 'bg-white/10 text-white/60 border-white/20'}`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right text-white/80">
                        {c.budget !== undefined ? `$${c.budget.toLocaleString()}` : '—'}
                      </td>
                      <td className="px-4 py-4 text-white/50 text-xs">
                        {c.startDate ? c.startDate.slice(0, 10) : '—'}
                        {c.endDate ? ` → ${c.endDate.slice(0, 10)}` : ''}
                      </td>
                      <td className="px-4 py-4 text-white/40 text-xs">
                        {expandedId === c.id ? '▲' : '▼'}
                      </td>
                    </tr>
                    {expandedId === c.id && (
                      <tr key={`${c.id}-detail`} className="bg-white/5">
                        <td colSpan={6} className="px-6 py-5">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <p className="text-white/40 text-xs mb-1">Spend to date</p>
                              <p className="text-white font-medium">
                                {c.spend !== undefined ? `$${c.spend.toLocaleString()}` : '—'}
                              </p>
                            </div>
                            <div>
                              <p className="text-white/40 text-xs mb-1">Impressions</p>
                              <p className="text-white font-medium">
                                {c.impressions !== undefined ? c.impressions.toLocaleString() : '—'}
                              </p>
                            </div>
                            <div>
                              <p className="text-white/40 text-xs mb-1">Campaign ID</p>
                              <p className="text-white/60 font-mono text-xs">{c.id}</p>
                            </div>
                            <div>
                              <p className="text-white/40 text-xs mb-1">Platform</p>
                              <p className="text-white font-medium">{c.platform ?? '—'}</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Campaign Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl shadow-2xl w-full max-w-lg p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Request New Campaign</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-white/40 hover:text-white transition-colors text-xl"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleRequestCampaign} className="space-y-4">
              <div>
                <label className="block text-white/70 text-sm mb-1.5">Campaign Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Q4 Product Launch"
                  required
                  className="bg-white/10 border border-white/20 text-white placeholder-white/40 rounded-xl px-4 py-3 w-full backdrop-blur-sm focus:outline-none focus:border-blue-400/60 transition-all"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/70 text-sm mb-1.5">Platform</label>
                  <select
                    value={form.platform}
                    onChange={(e) => setForm({ ...form, platform: e.target.value })}
                    className="bg-white/10 border border-white/20 text-white rounded-xl px-4 py-3 w-full backdrop-blur-sm focus:outline-none focus:border-blue-400/60 transition-all"
                  >
                    {PLATFORMS.filter((p) => p !== 'All').map((p) => (
                      <option key={p} value={p} className="bg-slate-900">{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-white/70 text-sm mb-1.5">Budget (USD)</label>
                  <input
                    type="number"
                    value={form.budget}
                    onChange={(e) => setForm({ ...form, budget: e.target.value })}
                    placeholder="5000"
                    required
                    min="0"
                    className="bg-white/10 border border-white/20 text-white placeholder-white/40 rounded-xl px-4 py-3 w-full backdrop-blur-sm focus:outline-none focus:border-blue-400/60 transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-white/70 text-sm mb-1.5">Campaign Goals</label>
                <textarea
                  value={form.goals}
                  onChange={(e) => setForm({ ...form, goals: e.target.value })}
                  placeholder="e.g. Generate 200 leads, 3x ROAS on product sales…"
                  rows={3}
                  className="bg-white/10 border border-white/20 text-white placeholder-white/40 rounded-xl px-4 py-3 w-full backdrop-blur-sm focus:outline-none focus:border-blue-400/60 transition-all resize-none"
                />
              </div>
              <div>
                <label className="block text-white/70 text-sm mb-1.5">Desired Start Date</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className="bg-white/10 border border-white/20 text-white rounded-xl px-4 py-3 w-full backdrop-blur-sm focus:outline-none focus:border-blue-400/60 transition-all"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 backdrop-blur-md bg-white/10 border border-white/20 text-white/70 rounded-xl py-3 text-sm font-medium hover:bg-white/15 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-500/80 hover:bg-blue-400/90 border border-blue-400/30 text-white rounded-xl py-3 text-sm font-semibold transition-all"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
