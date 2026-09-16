'use client';
// /admin/platforms — All Platforms Hub
// Visual directory of all 32 platforms grouped by priority.
// Each card shows emoji, connector badge, content types, setup status,
// and live content count from unified_content_item.

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { PLATFORM_META, PLATFORM_SPECIFIC_TABS, type PlatformMeta } from '@/lib/platform-tab-config';

type SetupStatus = 'Connected' | 'Missing Credentials' | 'Manual Only';

interface PlatformStats {
  platform: string;
  contentCount: number;
  setupStatus: SetupStatus;
}

const PRIORITY_CONFIG = {
  high: { label: 'High Priority', color: 'bg-red-50 border-red-200', dot: 'bg-red-500', badge: 'text-red-700 bg-red-100' },
  medium: { label: 'Medium Priority', color: 'bg-orange-50 border-orange-200', dot: 'bg-orange-500', badge: 'text-orange-700 bg-orange-100' },
  low: { label: 'Low Priority', color: 'bg-yellow-50 border-yellow-200', dot: 'bg-yellow-500', badge: 'text-yellow-700 bg-yellow-100' },
} as const;

const CONNECTOR_BADGE: Record<string, string> = {
  Postiz: 'bg-blue-100 text-blue-700',
  Custom: 'bg-purple-100 text-purple-700',
  Manual: 'bg-gray-100 text-gray-600',
};

export default function AllPlatformsPage() {
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState<Record<string, PlatformStats>>({});
  const [loadingStats, setLoadingStats] = useState(true);
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  useEffect(() => {
    fetch('/api/admin/platforms/stats')
      .then((r) => r.json())
      .then((d: { stats: PlatformStats[] }) => {
        const map: Record<string, PlatformStats> = {};
        for (const s of d.stats ?? []) map[s.platform] = s;
        setStats(map);
      })
      .catch(() => {
        // Stats unavailable — show zeros
      })
      .finally(() => setLoadingStats(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return PLATFORM_META.filter((p) => {
      const matchesSearch = !q || p.displayName.toLowerCase().includes(q) || p.key.includes(q) || p.contentTypes.some((c) => c.includes(q));
      const matchesPriority = priorityFilter === 'all' || p.priority === priorityFilter;
      return matchesSearch && matchesPriority;
    });
  }, [search, priorityFilter]);

  const grouped = useMemo(() => {
    const groups: Record<'high' | 'medium' | 'low', PlatformMeta[]> = { high: [], medium: [], low: [] };
    for (const p of filtered) groups[p.priority].push(p);
    return groups;
  }, [filtered]);

  const totalPlatforms = PLATFORM_META.length;
  const totalConfigured = PLATFORM_META.filter((p) => p.connector === 'Postiz' || p.connector === 'Custom').length;
  const totalTabsDefined = PLATFORM_META.reduce((acc, p) => acc + (PLATFORM_SPECIFIC_TABS[p.key]?.length ?? 0), 0);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <header className="border-l-4 border-indigo-600 pl-4">
          <h1 className="text-3xl font-bold text-gray-900">All Platforms</h1>
          <p className="text-sm text-gray-500 mt-1">
            {totalPlatforms} platforms · {totalConfigured} with Postiz/Custom connector · {totalTabsDefined} platform-specific tabs defined
          </p>
        </header>

        {/* Summary KPIs */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Platforms', value: totalPlatforms },
            { label: 'High Priority', value: PLATFORM_META.filter((p) => p.priority === 'high').length },
            { label: 'Postiz Connected', value: PLATFORM_META.filter((p) => p.connector === 'Postiz').length },
            { label: 'Platform Tabs Defined', value: totalTabsDefined },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs text-gray-500">{kpi.label}</p>
              <p className="text-2xl font-bold mt-1 text-indigo-600">{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Search + filter */}
        <div className="flex gap-3 items-center">
          <input
            type="text"
            placeholder="Search platforms, content types…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <div className="flex gap-1">
            {(['all', 'high', 'medium', 'low'] as const).map((p) => (
              <button key={p} onClick={() => setPriorityFilter(p)}
                className={`px-3 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${priorityFilter === p ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
                {p === 'all' ? 'All' : `${p === 'high' ? '🔴' : p === 'medium' ? '🟠' : '🟡'} ${p}`}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400">No platforms match your search.</div>
        )}

        {/* Priority-grouped cards */}
        {(['high', 'medium', 'low'] as const).map((priority) => {
          const platforms = grouped[priority];
          if (platforms.length === 0) return null;
          const cfg = PRIORITY_CONFIG[priority];
          return (
            <section key={priority}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                <h2 className="text-base font-semibold text-gray-700">{cfg.label}</h2>
                <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${cfg.badge}`}>{platforms.length}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {platforms.map((p) => {
                  const stat = stats[p.key];
                  const tabCount = PLATFORM_SPECIFIC_TABS[p.key]?.length ?? 0;
                  const setupStatus: SetupStatus = stat?.setupStatus ?? (
                    p.connector === 'Manual' ? 'Manual Only' : 'Missing Credentials'
                  );
                  const statusColor =
                    setupStatus === 'Connected' ? 'text-green-600 bg-green-50' :
                    setupStatus === 'Manual Only' ? 'text-gray-500 bg-gray-50' :
                    'text-amber-600 bg-amber-50';

                  return (
                    <div key={p.key} className={`rounded-xl border p-4 bg-white shadow-sm hover:shadow-md transition-shadow flex flex-col gap-3`}>
                      {/* Platform header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl" role="img" aria-label={p.displayName}>{p.emoji}</span>
                          <div>
                            <p className="font-semibold text-gray-900 text-sm leading-tight">{p.displayName}</p>
                            <p className="text-xs text-gray-400">{p.key}</p>
                          </div>
                        </div>
                        <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${CONNECTOR_BADGE[p.connector] ?? 'bg-gray-100 text-gray-600'}`}>
                          {p.connector}
                        </span>
                      </div>

                      {/* Content types */}
                      <div className="flex flex-wrap gap-1">
                        {p.contentTypes.map((ct) => (
                          <span key={ct} className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">{ct}</span>
                        ))}
                      </div>

                      {/* Stats row */}
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{tabCount} feature tab{tabCount !== 1 ? 's' : ''}</span>
                        <span>
                          {loadingStats ? '…' : `${stat?.contentCount ?? 0} items`}
                        </span>
                      </div>

                      {/* Setup status */}
                      <div className={`text-xs rounded-lg px-2 py-1 font-medium ${statusColor}`}>
                        {setupStatus === 'Connected' ? '✓ ' : setupStatus === 'Manual Only' ? '○ ' : '⚠ '}{setupStatus}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 mt-auto">
                        <Link href={`/admin/social/${p.key}`}
                          className="flex-1 text-center text-sm bg-indigo-600 text-white rounded-lg py-1.5 hover:bg-indigo-700 transition-colors">
                          Open →
                        </Link>
                        <Link href={`/admin/platform-setup?platform=${p.key}`}
                          className="text-sm border border-gray-200 text-gray-600 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors whitespace-nowrap">
                          Setup
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
