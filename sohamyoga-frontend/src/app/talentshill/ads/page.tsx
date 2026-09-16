'use client';

import { useEffect, useState } from 'react';

interface AdGroup {
  id?: string;
  name?: string;
  campaignName?: string;
  platform?: string;
  status?: string;
  budget?: number;
  spend?: number;
  impressions?: number;
  clicks?: number;
  conversions?: number;
  roas?: number;
  ctr?: number;
  [key: string]: unknown;
}

interface PaidAdsApiResponse {
  adGroups?: AdGroup[];
  campaigns?: AdGroup[];
  [key: string]: unknown;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/20 text-green-300 border-green-400/30',
  paused: 'bg-yellow-500/20 text-yellow-300 border-yellow-400/30',
  completed: 'bg-blue-500/20 text-blue-300 border-blue-400/30',
  ended: 'bg-gray-500/20 text-gray-300 border-gray-400/30',
};

const PLATFORM_ICONS: Record<string, string> = {
  google: '🔍',
  facebook: '👤',
  instagram: '📸',
  linkedin: '💼',
  youtube: '▶️',
  tiktok: '🎵',
  default: '📣',
};

function fmt(n: number | undefined, prefix = '', suffix = ''): string {
  if (n === undefined || n === null) return '—';
  if (n >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(1)}M${suffix}`;
  if (n >= 1_000) return `${prefix}${(n / 1_000).toFixed(1)}K${suffix}`;
  return `${prefix}${n.toLocaleString()}${suffix}`;
}

const STATIC_ADS: AdGroup[] = [
  { id: '1', name: 'Brand Awareness — Google Display', campaignName: 'Q4 Brand', platform: 'Google', status: 'active', budget: 3000, spend: 1840, impressions: 240000, clicks: 8400, conversions: 142, roas: 4.1, ctr: 3.5 },
  { id: '2', name: 'Retargeting — Facebook', campaignName: 'Retargeting', platform: 'Facebook', status: 'active', budget: 2000, spend: 1120, impressions: 98000, clicks: 4200, conversions: 88, roas: 3.2, ctr: 4.3 },
  { id: '3', name: 'Lead Gen — LinkedIn', campaignName: 'B2B Lead Gen', platform: 'LinkedIn', status: 'paused', budget: 1500, spend: 980, impressions: 42000, clicks: 1200, conversions: 32, roas: 2.2, ctr: 2.9 },
  { id: '4', name: 'Video Views — YouTube', campaignName: 'Video Awareness', platform: 'YouTube', status: 'active', budget: 1800, spend: 1450, impressions: 95000, clicks: 2600, conversions: 58, roas: 3.6, ctr: 2.7 },
  { id: '5', name: 'Summer Sale — Instagram', campaignName: 'Summer Sale', platform: 'Instagram', status: 'completed', budget: 2500, spend: 2490, impressions: 180000, clicks: 7800, conversions: 204, roas: 4.8, ctr: 4.3 },
];

export default function TalentsHillAdsPage() {
  const [adGroups, setAdGroups] = useState<AdGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/paid-ads', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data: PaidAdsApiResponse | AdGroup[]) => {
        if (Array.isArray(data)) {
          setAdGroups(data);
        } else if (data.adGroups) {
          setAdGroups(data.adGroups);
        } else if (data.campaigns) {
          setAdGroups(data.campaigns);
        }
      })
      .catch(() => setAdGroups([]))
      .finally(() => setLoading(false));
  }, []);

  const displayAds = adGroups.length > 0 ? adGroups : STATIC_ADS;

  const totalSpend = displayAds.reduce((s, a) => s + (a.spend ?? 0), 0);
  const totalImpressions = displayAds.reduce((s, a) => s + (a.impressions ?? 0), 0);
  const totalConversions = displayAds.reduce((s, a) => s + (a.conversions ?? 0), 0);
  const avgRoas = displayAds.length > 0
    ? displayAds.reduce((s, a) => s + (a.roas ?? 0), 0) / displayAds.length
    : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Paid Ads Performance</h1>
        <p className="text-white/50 mt-1 text-sm">Your active and historical paid advertising campaigns across all platforms.</p>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Spend', value: fmt(totalSpend, '$'), icon: '💰' },
          { label: 'Impressions', value: fmt(totalImpressions), icon: '👁️' },
          { label: 'Conversions', value: fmt(totalConversions), icon: '✅' },
          { label: 'Avg ROAS', value: `${avgRoas.toFixed(1)}x`, icon: '📈' },
        ].map(({ label, value, icon }) => (
          <div key={label} className="bg-slate-800/70 border border-white/20 rounded-2xl shadow-xl p-5 text-center">
            <div className="text-2xl mb-2">{icon}</div>
            <div className="text-xl font-bold text-white">{value}</div>
            <div className="text-white/50 text-xs mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Ad Groups Table */}
      <div className="bg-slate-800/70 border border-white/20 rounded-2xl shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Campaign / Ad Groups</h2>
        </div>
        {loading ? (
          <div className="p-12 text-center text-white/40">Loading ads data…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left text-white/50 font-medium px-6 py-3">Ad Group</th>
                  <th className="text-left text-white/50 font-medium px-4 py-3">Platform</th>
                  <th className="text-left text-white/50 font-medium px-4 py-3">Status</th>
                  <th className="text-right text-white/50 font-medium px-4 py-3">Budget</th>
                  <th className="text-right text-white/50 font-medium px-4 py-3">Spend</th>
                  <th className="text-right text-white/50 font-medium px-4 py-3">Impressions</th>
                  <th className="text-right text-white/50 font-medium px-4 py-3">Clicks</th>
                  <th className="text-right text-white/50 font-medium px-4 py-3">Conv.</th>
                  <th className="text-right text-white/50 font-medium px-6 py-3">ROAS</th>
                </tr>
              </thead>
              <tbody>
                {displayAds.map((ad, i) => (
                  <tr key={ad.id ?? i} className="border-b border-white/10 hover:bg-white/5 transition-colors last:border-0">
                    <td className="px-6 py-4">
                      <div className="text-white font-medium text-sm">{ad.name ?? '—'}</div>
                      {ad.campaignName && (
                        <div className="text-white/40 text-xs mt-0.5">{ad.campaignName}</div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className="flex items-center gap-1.5 text-white/70 text-sm">
                        {PLATFORM_ICONS[(ad.platform ?? '').toLowerCase()] ?? PLATFORM_ICONS['default']}
                        {ad.platform ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_COLORS[ad.status ?? ''] ?? 'bg-white/10 text-white/60 border-white/20'}`}>
                        {ad.status ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right text-white/70">{fmt(ad.budget, '$')}</td>
                    <td className="px-4 py-4 text-right text-white/80">{fmt(ad.spend, '$')}</td>
                    <td className="px-4 py-4 text-right text-white/70">{fmt(ad.impressions)}</td>
                    <td className="px-4 py-4 text-right text-white/70">{fmt(ad.clicks)}</td>
                    <td className="px-4 py-4 text-right text-white/70">{fmt(ad.conversions)}</td>
                    <td className="px-6 py-4 text-right">
                      <span className={`font-bold ${ad.roas !== undefined && ad.roas >= 3 ? 'text-cyan-400' : 'text-white/70'}`}>
                        {ad.roas !== undefined ? `${ad.roas}x` : '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
