"use client";
import { useEffect, useState } from "react";

const TABS = ["Overview", "Email", "SMS", "Push", "AI Advisor"] as const;
type Tab = typeof TABS[number];

interface CommData {
  health_score: number;
  alerts: string[];
  channels_active: number;
  messages_today: number;
  response_rate: number;
  avg_response_minutes: number;
  email?: { sent: number; delivered: number; opened: number; clicked: number; bounced: number };
  sms?: { sent: number; delivered: number; failed: number; opt_outs: number };
  push?: { sent: number; delivered: number; opened: number; dismissed: number };
}

const FALLBACK: CommData = {
  health_score: 72,
  alerts: ["Email bounce rate elevated at 4.2%", "SMS delivery lag detected"],
  channels_active: 4,
  messages_today: 847,
  response_rate: 68,
  avg_response_minutes: 23,
  email: { sent: 412, delivered: 394, opened: 198, clicked: 87, bounced: 18 },
  sms: { sent: 263, delivered: 251, failed: 12, opt_outs: 3 },
  push: { sent: 172, delivered: 165, opened: 49, dismissed: 116 },
};

function HealthGauge({ score }: { score: number }) {
  const color = score >= 80 ? "text-green-600" : score >= 60 ? "text-yellow-600" : "text-red-600";
  const bg = score >= 80 ? "bg-green-100" : score >= 60 ? "bg-yellow-100" : "bg-red-100";
  return (
    <div className={`${bg} rounded-2xl p-6 text-center`}>
      <p className="text-sm text-gray-500 mb-1">Health Score</p>
      <p className={`text-5xl font-bold ${color}`}>{score}</p>
      <p className="text-sm text-gray-400 mt-1">/ 100</p>
      <div className="mt-3 h-2 bg-gray-200 rounded-full">
        <div className={`h-2 rounded-full ${score >= 80 ? "bg-green-500" : score >= 60 ? "bg-yellow-500" : "bg-red-500"}`}
          style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
      <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function StatBar({ label, val, total }: { label: string; val: number; total: number }) {
  const pct = total > 0 ? Math.round((val / total) * 100) : 0;
  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="text-gray-900 font-medium">{val.toLocaleString()} ({pct}%)</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full">
        <div className="h-2 bg-indigo-400 rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function CtCommunicationPage() {
  const [tab, setTab] = useState<Tab>("Overview");
  const [data, setData] = useState<CommData | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    fetch("/api/admin/ct-communication", { cache: "no-store" })
      .then(r => r.ok ? r.json() : null)
      .catch(() => null)
      .then(d => { setData(d ?? FALLBACK); setLoading(false); });
  }, []);

  const runAi = async () => {
    if (!aiPrompt.trim() || !data) return;
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `Communication metrics: health=${data.health_score}, messages_today=${data.messages_today}, response_rate=${data.response_rate}%, avg_response=${data.avg_response_minutes}min. Question: ${aiPrompt}`,
        }),
      });
      const d = await res.json();
      setAiResult(d.result || d.text || JSON.stringify(d));
    } catch {
      setAiResult("Unable to reach AI service. Please try again.");
    }
    setAiLoading(false);
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading…</div>;

  const d = data!;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Communication Control Tower</h1>
        <p className="text-gray-500 mb-6">Unified channel health and performance dashboard</p>

        <div className="flex gap-1 mb-6 border-b border-gray-200">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${tab === t ? "bg-white border border-b-white border-gray-200 text-indigo-600" : "text-gray-500 hover:text-gray-700"}`}>
              {t}
            </button>
          ))}
        </div>

        {tab === "Overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-5 gap-4">
              <HealthGauge score={d.health_score} />
              <KpiCard label="Channels Active" value={d.channels_active} />
              <KpiCard label="Messages Today" value={d.messages_today.toLocaleString()} />
              <KpiCard label="Response Rate" value={`${d.response_rate}%`} />
              <KpiCard label="Avg Response Time" value={`${d.avg_response_minutes}m`} sub="minutes" />
            </div>
            {d.alerts.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <h3 className="font-semibold text-yellow-800 mb-2">⚠ Active Alerts</h3>
                <ul className="space-y-1">
                  {d.alerts.map((a, i) => <li key={i} className="text-sm text-yellow-700">• {a}</li>)}
                </ul>
              </div>
            )}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Email", icon: "📧", status: d.health_score >= 70 ? "Healthy" : "Warning" },
                { label: "SMS", icon: "📱", status: d.health_score >= 70 ? "Healthy" : "Degraded" },
                { label: "Push", icon: "🔔", status: "Active" },
              ].map(ch => (
                <div key={ch.label} className="bg-white rounded-xl p-4 border border-gray-100 flex items-center gap-3">
                  <span className="text-2xl">{ch.icon}</span>
                  <div>
                    <p className="font-medium text-gray-800">{ch.label}</p>
                    <p className={`text-xs ${ch.status === "Healthy" || ch.status === "Active" ? "text-green-600" : ch.status === "Warning" ? "text-yellow-600" : "text-red-500"}`}>{ch.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "Email" && d.email && (
          <div className="bg-white rounded-xl p-6 border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800 mb-5">Email Delivery Stats</h2>
            <StatBar label="Delivered" val={d.email.delivered} total={d.email.sent} />
            <StatBar label="Opened" val={d.email.opened} total={d.email.sent} />
            <StatBar label="Clicked" val={d.email.clicked} total={d.email.sent} />
            <StatBar label="Bounced" val={d.email.bounced} total={d.email.sent} />
            <div className="mt-4 grid grid-cols-3 gap-4">
              <KpiCard label="Total Sent" value={d.email.sent} />
              <KpiCard label="Open Rate" value={`${Math.round((d.email.opened / d.email.sent) * 100)}%`} />
              <KpiCard label="Click Rate" value={`${Math.round((d.email.clicked / d.email.sent) * 100)}%`} />
            </div>
          </div>
        )}

        {tab === "SMS" && d.sms && (
          <div className="bg-white rounded-xl p-6 border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800 mb-5">SMS Stats</h2>
            <StatBar label="Delivered" val={d.sms.delivered} total={d.sms.sent} />
            <StatBar label="Failed" val={d.sms.failed} total={d.sms.sent} />
            <div className="mt-4 grid grid-cols-3 gap-4">
              <KpiCard label="Total Sent" value={d.sms.sent} />
              <KpiCard label="Delivery Rate" value={`${Math.round((d.sms.delivered / d.sms.sent) * 100)}%`} />
              <KpiCard label="Opt-Outs" value={d.sms.opt_outs} sub="this period" />
            </div>
          </div>
        )}

        {tab === "Push" && d.push && (
          <div className="bg-white rounded-xl p-6 border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800 mb-5">Push Notification Stats</h2>
            <StatBar label="Delivered" val={d.push.delivered} total={d.push.sent} />
            <StatBar label="Opened" val={d.push.opened} total={d.push.sent} />
            <StatBar label="Dismissed" val={d.push.dismissed} total={d.push.sent} />
            <div className="mt-4 grid grid-cols-2 gap-4">
              <KpiCard label="Total Sent" value={d.push.sent} />
              <KpiCard label="Open Rate" value={`${Math.round((d.push.opened / d.push.sent) * 100)}%`} />
            </div>
          </div>
        )}

        {tab === "AI Advisor" && (
          <div className="bg-white rounded-xl p-6 border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">AI Communication Advisor</h2>
            <p className="text-sm text-gray-500 mb-4">Ask for recommendations based on your current communication metrics.</p>
            <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm h-24 resize-none mb-3"
              placeholder="e.g. How can I improve email open rates? What time should I send SMS?" />
            <button onClick={runAi} disabled={aiLoading}
              className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
              {aiLoading ? "Analyzing…" : "Get Recommendation"}
            </button>
            {aiResult && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{aiResult}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
