"use client";
import { useState } from "react";
import Link from "next/link";

type CStatus = "DRAFT" | "SCHEDULED" | "RUNNING" | "PAUSED" | "COMPLETED" | "CANCELLED";

interface Campaign {
  id: string;
  name: string;
  type: string;
  channels: string[];
  status: CStatus;
  audience: string;
  audienceSize: number;
  goalType: string;
  goalTarget: number;
  conversions: number;
  revenueCAD: number;
  scheduledAt?: string;
  createdAt: string;
}

const SEED_CAMPAIGNS: Campaign[] = [
  { id: "c1", name: "August Free → Monthly Push", type: "one_time", channels: ["email", "whatsapp"], status: "RUNNING", audience: "Free Plan Users", audienceSize: 512, goalType: "membership_conversions", goalTarget: 50, conversions: 31, revenueCAD: 1519, scheduledAt: "2026-08-01", createdAt: "2026-07-28" },
  { id: "c2", name: "Birthday Wishes — August", type: "trigger", channels: ["whatsapp", "in_app"], status: "RUNNING", audience: "Birthday This Month", audienceSize: 41, goalType: "re_engagement", goalTarget: 30, conversions: 18, revenueCAD: 0, createdAt: "2026-08-01" },
  { id: "c3", name: "Re-engage Dormant Students", type: "drip", channels: ["email"], status: "SCHEDULED", audience: "At-Risk Churn", audienceSize: 97, goalType: "re_engagement", goalTarget: 20, conversions: 0, revenueCAD: 0, scheduledAt: "2026-08-06", createdAt: "2026-08-03" },
  { id: "c4", name: "Summer Annual Upgrade", type: "one_time", channels: ["email", "push"], status: "COMPLETED", audience: "Active Members", audienceSize: 284, goalType: "membership_conversions", goalTarget: 30, conversions: 34, revenueCAD: 4914, createdAt: "2026-07-15" },
  { id: "c5", name: "Referral Drive", type: "referral", channels: ["whatsapp", "email"], status: "DRAFT", audience: "High-Value Annual Members", audienceSize: 63, goalType: "referrals", goalTarget: 25, conversions: 0, revenueCAD: 0, createdAt: "2026-08-04" },
];

const STATUS_STYLE: Record<CStatus, string> = {
  DRAFT:     "bg-gray-800 text-gray-300",
  SCHEDULED: "bg-blue-900 text-blue-300",
  RUNNING:   "bg-green-900 text-green-300",
  PAUSED:    "bg-yellow-900 text-yellow-300",
  COMPLETED: "bg-purple-900 text-purple-300",
  CANCELLED: "bg-red-900 text-red-300",
};

const CHANNEL_ICON: Record<string, string> = {
  email: "📧", whatsapp: "💬", sms: "📱", push: "🔔", in_app: "🏠", social: "📲",
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState(SEED_CAMPAIGNS);
  const [filter, setFilter] = useState<CStatus | "ALL">("ALL");

  const filtered = filter === "ALL" ? campaigns : campaigns.filter(c => c.status === filter);

  const totalRevenue = campaigns.reduce((s, c) => s + c.revenueCAD, 0);
  const running = campaigns.filter(c => c.status === "RUNNING").length;
  const totalConversions = campaigns.reduce((s, c) => s + c.conversions, 0);

  function toggleStatus(id: string) {
    setCampaigns(prev => prev.map(c => {
      if (c.id !== id) return c;
      if (c.status === "RUNNING") return { ...c, status: "PAUSED" as CStatus };
      if (c.status === "PAUSED")  return { ...c, status: "RUNNING" as CStatus };
      if (c.status === "DRAFT")   return { ...c, status: "RUNNING" as CStatus };
      return c;
    }));
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold">Campaigns</h1>
            <p className="text-gray-400 text-sm mt-0.5">Build, schedule, and track marketing campaigns</p>
          </div>
          <Link href="/admin/campaigns/new"
            className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors">
            + New Campaign
          </Link>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Running", value: running, color: "text-green-400" },
            { label: "Total Conversions", value: totalConversions, color: "text-purple-400" },
            { label: "Total Revenue", value: `$${totalRevenue.toLocaleString()}`, color: "text-yellow-400" },
            { label: "Avg Conversion Rate", value: `${Math.round((totalConversions / campaigns.reduce((s,c)=>s+c.audienceSize,0))*100)}%`, color: "text-blue-400" },
          ].map(k => (
            <div key={k.label} className="bg-gray-900 rounded-2xl p-4 text-center">
              <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
              <div className="text-xs text-gray-400 mt-1">{k.label}</div>
            </div>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex flex-wrap gap-2">
          {(["ALL", "DRAFT", "SCHEDULED", "RUNNING", "PAUSED", "COMPLETED"] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter === s ? "bg-green-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}>{s === "ALL" ? "All" : s}</button>
          ))}
        </div>

        {/* ONE ROW PER CAMPAIGN */}
        <div className="space-y-3">
          {filtered.map(c => {
            const goalPct = Math.min(100, Math.round((c.conversions / c.goalTarget) * 100));
            return (
              <div key={c.id} className="bg-gray-900 rounded-2xl p-5 space-y-3">
                {/* Row 1: name + status + channels */}
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">{c.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_STYLE[c.status]}`}>{c.status}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs bg-gray-800 text-gray-400 capitalize">{c.type.replace("_", " ")}</span>
                    </div>
                    <p className="text-sm text-gray-400 mt-0.5">
                      👥 {c.audience} ({c.audienceSize.toLocaleString()}) ·
                      {c.channels.map(ch => ` ${CHANNEL_ICON[ch]}`).join("")} {c.channels.join(", ")}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {["RUNNING", "PAUSED", "DRAFT"].includes(c.status) && (
                      <button onClick={() => toggleStatus(c.id)}
                        className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs transition-colors">
                        {c.status === "RUNNING" ? "Pause" : "Launch"}
                      </button>
                    )}
                    <Link href={`/admin/campaigns/${c.id}`}
                      className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs transition-colors">
                      Details →
                    </Link>
                  </div>
                </div>

                {/* Row 2: goal progress + revenue */}
                <div className="flex items-center gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>Goal: {c.goalType.replace(/_/g, " ")} — {c.conversions}/{c.goalTarget}</span>
                      <span>{goalPct}%</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full transition-all ${goalPct >= 100 ? "bg-yellow-400" : "bg-green-500"}`}
                           style={{ width: `${goalPct}%` }} />
                    </div>
                  </div>
                  {c.revenueCAD > 0 && (
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-yellow-400">${c.revenueCAD.toLocaleString()}</div>
                      <div className="text-xs text-gray-500">revenue</div>
                    </div>
                  )}
                  {c.scheduledAt && (
                    <div className="text-right shrink-0 text-xs text-gray-400">
                      {c.status === "SCHEDULED" ? "Scheduled" : "Started"}: {c.scheduledAt}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
