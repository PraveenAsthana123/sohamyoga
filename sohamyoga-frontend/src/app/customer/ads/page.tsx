'use client';
import { useEffect, useState } from 'react';

interface CampaignSummary {
  id: string; name: string; platform: string; status: string;
  budget: number; impressions: number; clicks: number; conversions: number; spend: number;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) return null;
    return r.json();
  } catch { return null; }
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/30 p-8 text-center text-white/60 text-sm">
      {message}
    </div>
  );
}

const STATUS_BADGE: Record<string, string> = {
  active:  'bg-green-500/20 text-green-300',
  paused:  'bg-amber-500/20 text-amber-300',
  draft:   'bg-white/10 text-white/70',
  ended:   'bg-red-500/20 text-red-600',
};

const PLATFORM_LABELS: Record<string, string> = {
  google_ads:   'Google Ads',
  meta_ads:     'Meta Ads',
  tiktok_ads:   'TikTok Ads',
  linkedin_ads: 'LinkedIn Ads',
  other:        'Other',
};

export default function CustomerAdsPage() {
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJson<{ campaigns: CampaignSummary[] }>('/api/ads/campaigns?status=active')
      .then(d => { setCampaigns(d?.campaigns ?? []); setLoading(false); });
  }, []);

  const totalSpend = campaigns.reduce((a, c) => a + (c.spend ?? 0), 0);
  const totalClicks = campaigns.reduce((a, c) => a + (c.clicks ?? 0), 0);
  const totalConversions = campaigns.reduce((a, c) => a + (c.conversions ?? 0), 0);
  const estimatedROI = totalSpend > 0 ? ((totalConversions * 45 - totalSpend) / totalSpend * 100).toFixed(1) : '0';

  return (
    <div className="min-h-screen bg-white/5 p-6">
      <div className="max-w-5xl mx-auto space-y-6 text-white">

        <div>
          <h1 className="text-2xl font-bold text-white">My Ad Campaigns</h1>
          <p className="text-sm text-white/60 mt-1">Active campaigns running for your business</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Active Campaigns', value: String(campaigns.length), color: 'text-blue-600' },
            { label: 'Total Spend', value: `$${totalSpend.toFixed(2)}`, color: 'text-red-600' },
            { label: 'Leads Generated', value: String(totalConversions), color: 'text-green-600' },
            { label: 'Est. ROI', value: `${estimatedROI}%`, color: Number(estimatedROI) >= 0 ? 'text-green-600' : 'text-red-600' },
          ].map(k => (
            <div key={k.label} className="bg-slate-800/70 border border-white/20 rounded-2xl-xl p-4 shadow-sm border-gray-100">
              <p className="text-xs text-white/60">{k.label}</p>
              <p className={`text-2xl font-bold mt-1 ${k.color}`}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* Spend vs Budget */}
        {campaigns.length > 0 && (
          <div className="bg-slate-800/70 border border-white/20 rounded-2xl-xl shadow-sm border-gray-100 p-5">
            <h3 className="font-semibold text-white mb-4">Spend vs. Budget</h3>
            <div className="space-y-3 text-white">
              {campaigns.map(c => {
                const spendPct = c.budget > 0 ? Math.min((c.spend / (c.budget * 30)) * 100, 100) : 0;
                return (
                  <div key={c.id} className="flex items-center gap-3 text-sm">
                    <span className="w-48 text-white/80 truncate text-sm">{c.name}</span>
                    <div className="flex-1 bg-white/10 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full ${spendPct > 90 ? 'bg-red-400' : spendPct > 70 ? 'bg-amber-400' : 'bg-blue-400'}`}
                        style={{ width: `${spendPct}%` }}
                      />
                    </div>
                    <span className="text-xs text-white/60 w-28 text-right">${c.spend.toFixed(0)} of ${c.budget * 30}/mo</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Campaign List */}
        <div className="bg-slate-800/70 border border-white/20 rounded-2xl-xl shadow-sm border-gray-100 p-5">
          <h3 className="font-semibold text-white mb-4">Active Campaigns</h3>
          {loading ? <EmptyState message="Loading…" /> : campaigns.length === 0 ? (
            <EmptyState message="No active campaigns at the moment. Contact your account manager to launch a new campaign." />
          ) : (
            <div className="space-y-3 text-white">
              {campaigns.map(c => (
                <div key={c.id} className="border border-gray-100 rounded-xl p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-white">{c.name}</p>
                      <p className="text-xs text-white/60 mt-0.5">{PLATFORM_LABELS[c.platform] ?? c.platform}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[c.status] ?? 'bg-white/10 text-white/70'}`}>
                      {c.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div><p className="text-xs text-white/50">Budget/day</p><p className="font-semibold text-white/80">${c.budget}</p></div>
                    <div><p className="text-xs text-white/50">Impressions</p><p className="font-semibold text-white/80">{c.impressions?.toLocaleString() ?? '—'}</p></div>
                    <div><p className="text-xs text-white/50">Clicks</p><p className="font-semibold text-white/80">{c.clicks?.toLocaleString() ?? '—'}</p></div>
                    <div><p className="text-xs text-white/50">Leads</p><p className="font-semibold text-green-600">{c.conversions ?? 0}</p></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Performance Summary */}
        <div className="bg-slate-800/70 border border-white/20 rounded-2xl-xl shadow-sm border-gray-100 p-5">
          <h3 className="font-semibold text-white mb-3">Performance Summary</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{totalClicks.toLocaleString()}</p>
              <p className="text-xs text-white/60 mt-1">Total Clicks</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{totalConversions}</p>
              <p className="text-xs text-white/60 mt-1">Leads Generated</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-600">
                {totalClicks > 0 ? `${((totalConversions / totalClicks) * 100).toFixed(1)}%` : '0%'}
              </p>
              <p className="text-xs text-white/60 mt-1">Conversion Rate</p>
            </div>
          </div>
        </div>

        <div className="text-xs text-white/50 text-center">
          Campaign data updates every 6 hours. Contact your account manager to request changes.
        </div>

      </div>
    </div>
  );
}
