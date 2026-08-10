"use client";
import { useParams, useRouter } from "next/navigation";

const CAMPAIGN_DETAIL = {
  id: "c1",
  name: "August Free → Monthly Push",
  type: "one_time",
  channels: ["email", "whatsapp"],
  status: "RUNNING",
  audience: "Free Plan Users",
  audienceSize: 512,
  goalType: "membership_conversions",
  goalTarget: 50,
  subject: "Unlock unlimited yoga — 20% off this week only",
  scheduledAt: "2026-08-01",
  channelMetrics: [
    { channel: "email",    sent: 400, delivered: 380, opened: 190, clicked: 76, converted: 22 },
    { channel: "whatsapp", sent: 300, delivered: 295, opened: 250, clicked: 120, converted: 9 },
  ],
  conversions: 31,
  goalProgress: 62,
  revenueCAD: 1519,
  costCAD: 50,
  roiPercent: 2938,
  coupon: { code: "YOGA20", used: 31, total: 100 },
};

const CHANNEL_ICON: Record<string, string> = { email: "📧", whatsapp: "💬", sms: "📱", push: "🔔", in_app: "🏠" };

export default function CampaignDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const c = CAMPAIGN_DETAIL; // TODO: fetch by id

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-white text-sm">← Campaigns</button>
        </div>

        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold">{c.name}</h1>
            <p className="text-gray-400 text-sm mt-1">{c.type.replace("_"," ")} · {c.channels.map(ch => CHANNEL_ICON[ch]).join(" ")} · {c.audience} ({c.audienceSize})</p>
          </div>
          <span className="px-3 py-1 rounded-full text-sm bg-green-900 text-green-300">{c.status}</span>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Conversions", value: `${c.conversions}/${c.goalTarget}`, sub: `${c.goalProgress}% of goal` },
            { label: "Revenue", value: `$${c.revenueCAD.toLocaleString()}`, sub: `$${c.costCAD} cost` },
            { label: "ROI", value: `${c.roiPercent}%`, sub: "return on spend" },
            { label: "Coupon Uses", value: `${c.coupon.used}/${c.coupon.total}`, sub: c.coupon.code },
          ].map(k => (
            <div key={k.label} className="bg-gray-900 rounded-2xl p-4 text-center">
              <div className="text-2xl font-bold text-green-400">{k.value}</div>
              <div className="text-xs text-gray-400 mt-0.5">{k.label}</div>
              <div className="text-xs text-gray-500">{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Goal progress */}
        <div className="bg-gray-900 rounded-2xl p-5">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-300">Goal Progress: {c.goalType.replace(/_/g," ")}</span>
            <span className="text-gray-400">{c.conversions} / {c.goalTarget}</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-3">
            <div className={`h-3 rounded-full ${c.goalProgress >= 100 ? "bg-yellow-400" : "bg-green-500"}`}
                 style={{ width: `${c.goalProgress}%` }} />
          </div>
        </div>

        {/* Channel breakdown — one row per channel */}
        <div className="bg-gray-900 rounded-2xl p-5 space-y-4">
          <h2 className="font-semibold text-gray-300">Channel Breakdown</h2>
          {c.channelMetrics.map(ch => {
            const openRate = Math.round((ch.opened / ch.delivered) * 100);
            const clickRate = Math.round((ch.clicked / ch.opened) * 100);
            const convRate = Math.round((ch.converted / ch.sent) * 100);
            return (
              <div key={ch.channel} className="border-b border-gray-800 pb-4 last:border-0 last:pb-0">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">{CHANNEL_ICON[ch.channel]}</span>
                  <span className="font-medium capitalize">{ch.channel}</span>
                </div>
                <div className="grid grid-cols-5 gap-3 text-center text-sm">
                  {[
                    { label: "Sent", value: ch.sent },
                    { label: "Delivered", value: ch.delivered },
                    { label: "Opened", value: `${openRate}%` },
                    { label: "Clicked", value: `${clickRate}%` },
                    { label: "Converted", value: `${convRate}%` },
                  ].map(m => (
                    <div key={m.label} className="bg-gray-800 rounded-xl p-2">
                      <div className="font-bold text-white">{m.value}</div>
                      <div className="text-xs text-gray-400">{m.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
