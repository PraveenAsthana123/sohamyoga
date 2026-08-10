"use client";
// Admin Feature Flags management — switch ON/OFF any platform feature

import { useState, useEffect } from "react";
import { invalidateFeatureCache } from "@/hooks/useFeatureFlags";

interface Flag {
  key: string;
  name: string;
  description: string;
  category: string;
  scope: string;
  enabled: boolean;
  rolloutPercent: number;
  updatedBy?: string;
  updatedAt?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  booking: "bg-blue-100 text-blue-700",
  ai: "bg-purple-100 text-purple-700",
  wellness: "bg-green-100 text-green-700",
  community: "bg-yellow-100 text-yellow-700",
  gamification: "bg-orange-100 text-orange-700",
  campaign: "bg-pink-100 text-pink-700",
  notification: "bg-indigo-100 text-indigo-700",
  payment: "bg-emerald-100 text-emerald-700",
  integration: "bg-gray-100 text-gray-700",
  content: "bg-teal-100 text-teal-700",
  membership: "bg-red-100 text-red-700",
  analytics: "bg-cyan-100 text-cyan-700",
};

export default function FeaturesPage() {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [toggling, setToggling] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const categories = ["all", "booking", "ai", "wellness", "community", "gamification", "campaign", "notification", "payment", "integration", "content"];

  useEffect(() => {
    fetch("/api/features")
      .then(r => r.json())
      .then(d => { setFlags(d.flags || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function toggle(key: string, current: boolean) {
    setToggling(key);
    const res = await fetch("/api/features", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, enabled: !current, updatedBy: "admin" }),
    });
    if (res.ok) {
      const { flag } = await res.json();
      setFlags(prev => prev.map(f => f.key === key ? { ...f, enabled: flag.enabled } : f));
      invalidateFeatureCache();
    }
    setToggling(null);
  }

  const visible = flags.filter(f => {
    const matchCat = filter === "all" || f.category === filter;
    const matchSearch = !search || f.name.toLowerCase().includes(search.toLowerCase()) || f.key.includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const enabledCount = flags.filter(f => f.enabled).length;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Feature Flags</h1>
        <p className="text-gray-500 mt-1">Toggle platform features on/off. Changes take effect immediately.</p>
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-900">{flags.length}</div>
          <div className="text-sm text-gray-500">Total Features</div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-2xl font-bold text-green-600">{enabledCount}</div>
          <div className="text-sm text-gray-500">Enabled</div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-2xl font-bold text-red-500">{flags.length - enabledCount}</div>
          <div className="text-sm text-gray-500">Disabled</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap items-center">
        <input
          type="text"
          placeholder="Search features..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm w-64"
        />
        <div className="flex gap-2 flex-wrap">
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors ${filter === c ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading feature flags...</div>
      ) : (
        <div className="space-y-3">
          {visible.map(flag => (
            <div key={flag.key} className={`bg-white border rounded-lg p-4 flex items-center justify-between gap-4 transition-opacity ${toggling === flag.key ? "opacity-60" : ""}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-gray-900">{flag.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[flag.category] || "bg-gray-100 text-gray-700"}`}>
                    {flag.category}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{flag.scope}</span>
                  {flag.rolloutPercent < 100 && flag.enabled && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{flag.rolloutPercent}% rollout</span>
                  )}
                </div>
                <div className="text-xs text-gray-400 mt-0.5 font-mono">{flag.key}</div>
              </div>

              {/* Toggle */}
              <button
                onClick={() => toggle(flag.key, flag.enabled)}
                disabled={toggling === flag.key}
                aria-label={flag.enabled ? "Disable" : "Enable"}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${flag.enabled ? "bg-green-500" : "bg-gray-300"}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${flag.enabled ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>
          ))}

          {visible.length === 0 && (
            <div className="text-center py-12 text-gray-400">No features match your filter.</div>
          )}
        </div>
      )}
    </div>
  );
}
