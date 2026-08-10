"use client";
// Social Media Analytics — per-platform reach, engagement, follower growth

import { useState } from "react";

const PLATFORMS = [
  { key: "instagram",  label: "Instagram",    color: "bg-pink-500",    followers: 8200,  posts: 14, reach: 42000, engagement: 6.2, clicks: 1840, growth: 420  },
  { key: "facebook",   label: "Facebook",     color: "bg-blue-600",    followers: 3400,  posts: 12, reach: 18000, engagement: 3.1, clicks: 820,  growth: 85   },
  { key: "linkedin",   label: "LinkedIn",     color: "bg-blue-800",    followers: 1200,  posts: 6,  reach: 8400,  engagement: 4.8, clicks: 620,  growth: 110  },
  { key: "youtube",    label: "YouTube",      color: "bg-red-600",     followers: 900,   posts: 3,  reach: 12000, engagement: 5.1, clicks: 940,  growth: 62   },
  { key: "bluesky",    label: "Bluesky",      color: "bg-sky-500",     followers: 210,   posts: 8,  reach: 1800,  engagement: 2.4, clicks: 120,  growth: 48   },
  { key: "x_twitter",  label: "X / Twitter",  color: "bg-gray-900",    followers: 520,   posts: 10, reach: 6200,  engagement: 2.1, clicks: 380,  growth: -18  },
];

const OVERVIEW = [
  { label: "Total Reach (30d)",      value: "88.4k",  delta: "+14.2%" },
  { label: "Total Engagements",      value: "5,612",  delta: "+8.7%"  },
  { label: "Link Clicks",            value: "4,720",  delta: "+22.1%" },
  { label: "Avg. Engagement Rate",   value: "4.4%",   delta: "+0.6pp" },
];

export default function SocialAnalyticsPage() {
  const [range, setRange] = useState("30d");

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Social Analytics</h1>
          <p className="text-gray-500 text-sm">Powered by Postiz analytics API</p>
        </div>
        <div className="flex gap-2">
          {["7d","30d","90d"].map(r => (
            <button key={r} onClick={() => setRange(r)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${range === r ? "bg-indigo-600 text-white" : "border text-gray-600 hover:bg-gray-50"}`}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Overview KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {OVERVIEW.map(k => (
          <div key={k.label} className="bg-white border rounded-lg p-4">
            <div className="text-2xl font-bold text-gray-900">{k.value}</div>
            <div className="text-xs text-green-600 font-medium">{k.delta}</div>
            <div className="text-sm text-gray-500 mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Per-platform breakdown */}
      <h2 className="font-semibold text-gray-800 mb-4">Per-Platform Performance</h2>
      <div className="space-y-3">
        {PLATFORMS.map(p => {
          const maxReach = Math.max(...PLATFORMS.map(x => x.reach));
          const barW = Math.round((p.reach / maxReach) * 100);
          return (
            <div key={p.key} className="bg-white border rounded-lg p-4">
              <div className="flex items-center gap-4">
                <div className={`w-3 h-3 rounded-full ${p.color} flex-shrink-0`} />
                <div className="w-28 font-medium text-sm text-gray-800 flex-shrink-0">{p.label}</div>

                {/* Reach bar */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="text-xs text-gray-500 w-16">Reach</div>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div className={`${p.color} h-2 rounded-full transition-all`} style={{ width: `${barW}%` }} />
                    </div>
                    <div className="text-xs text-gray-700 w-16 text-right">{p.reach.toLocaleString()}</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-center flex-shrink-0">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{p.engagement}%</div>
                    <div className="text-xs text-gray-400">Eng. rate</div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{p.clicks.toLocaleString()}</div>
                    <div className="text-xs text-gray-400">Clicks</div>
                  </div>
                  <div>
                    <div className={`text-sm font-semibold ${p.growth >= 0 ? "text-green-600" : "text-red-500"}`}>
                      {p.growth >= 0 ? "+" : ""}{p.growth}
                    </div>
                    <div className="text-xs text-gray-400">Followers</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quora note */}
      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
        <strong>Quora:</strong> No automated publishing. AI drafts answers for human review and manual posting.
        Unofficial Quora APIs are unstable and may violate platform terms — not integrated.
      </div>
    </div>
  );
}
