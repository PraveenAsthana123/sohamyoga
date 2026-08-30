"use client";
// Notification & Communication Center — omnichannel admin portal
// Tabs: Overview | Templates | Queue | Analytics | Channels | Preferences
//
// Previously every tab (541 lines) rendered hardcoded DEMO_* arrays with zero
// fetch() calls, despite a genuinely real backend existing behind it
// (notification_template/queue/history/analytics tables, NotificationDispatchJob).
// Now fetches real data from /api/admin/notifications/overview.

import { useEffect, useState } from "react";

const CHANNEL_COLORS: Record<string, string> = {
  email: "bg-blue-100 text-blue-700", sms: "bg-green-100 text-green-700", whatsapp: "bg-emerald-100 text-emerald-700",
  push: "bg-purple-100 text-purple-700", in_app: "bg-indigo-100 text-indigo-700", telegram: "bg-sky-100 text-sky-700",
  discord: "bg-violet-100 text-violet-700", slack: "bg-rose-100 text-rose-700", voice: "bg-amber-100 text-amber-700",
};
const CHANNEL_ICONS: Record<string, string> = {
  email: "✉", sms: "💬", whatsapp: "📱", push: "🔔", in_app: "🔔", telegram: "✈", discord: "🎮", slack: "💼", voice: "📞",
};
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600", approved: "bg-blue-100 text-blue-700", active: "bg-green-100 text-green-700",
  archived: "bg-gray-200 text-gray-500", pending: "bg-yellow-100 text-yellow-700", scheduled: "bg-indigo-100 text-indigo-700",
  processing: "bg-blue-100 text-blue-700", sent: "bg-green-100 text-green-700", failed: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-500",
};

const MCP_TOOLS = [
  { name: "send_notification", tier: "auto", risk: 1 }, { name: "schedule_notification", tier: "staff", risk: 2 },
  { name: "cancel_notification", tier: "staff_approval", risk: 3 }, { name: "retry_notification", tier: "staff", risk: 2 },
  { name: "get_notification_history", tier: "auto", risk: 1 }, { name: "get_notification_status", tier: "auto", risk: 1 },
  { name: "generate_email_content", tier: "auto", risk: 1 }, { name: "generate_sms_content", tier: "auto", risk: 1 },
  { name: "translate_message", tier: "auto", risk: 1 }, { name: "get_delivery_report", tier: "auto", risk: 1 },
  { name: "bulk_send_notification", tier: "admin", risk: 4 },
];
const TIER_COLORS: Record<string, string> = {
  auto: "bg-green-100 text-green-700", staff: "bg-blue-100 text-blue-700", customer_confirm: "bg-teal-100 text-teal-700",
  staff_approval: "bg-amber-100 text-amber-700", admin: "bg-orange-100 text-orange-700", admin_destructive: "bg-red-100 text-red-700",
};

const TABS = ["Overview", "Templates", "Queue", "Analytics", "Channels", "Preferences"] as const;
type Tab = typeof TABS[number];

function Chip({ label, colorClass }: { label: string; colorClass: string }) {
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>{label}</span>;
}

interface OverviewData {
  templates: Array<{ id: string; slug: string; name: string; channel: string; type: string; status: string; version: number }>;
  queue: Array<{ id: string; template_slug: string; channel: string; recipient_address: string; status: string; scheduled_at: string | null; retry_count: number; created_at: string }>;
  channelHealth: Array<{ channel: string; sent_7d: string; delivered_7d: string; failed_7d: string; delivery_rate_pct: string | null; open_rate_pct: string | null; click_rate_pct: string | null }>;
  topTemplates: Array<{ template_slug: string; channel: string; sent_30d: string; delivery_pct: string | null; open_pct: string | null }>;
  retryEligibleCount: number; todayPendingCount: number; todaySentCount: number; templateActiveCount: number;
}

async function fetchOverview(): Promise<OverviewData | null> {
  try {
    const res = await fetch('/api/admin/notifications/overview', { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

function OverviewTab({ data }: { data: OverviewData | null }) {
  const stats = [
    { label: "Sent today", value: String(data?.todaySentCount ?? 0), sub: "all channels" },
    { label: "Pending queue", value: String(data?.todayPendingCount ?? 0), sub: "waiting to send" },
    { label: "Retry-eligible", value: String(data?.retryEligibleCount ?? 0), sub: "failed, <3 retries" },
    { label: "Templates active", value: String(data?.templateActiveCount ?? 0), sub: "across all channels" },
  ];
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-lg p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-gray-900">{s.value}</div>
            <div className="text-xs font-medium text-gray-700 mt-1">{s.label}</div>
            <div className="text-xs text-gray-400 mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <h3 className="font-semibold text-gray-800 mb-4">MCP Tools — notification-mcp v1.0.0</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {MCP_TOOLS.map(t => (
            <div key={t.name} className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded px-3 py-2">
              <span className="font-mono text-xs text-gray-700">{t.name}</span>
              <div className="flex gap-1">
                <Chip label={t.tier} colorClass={TIER_COLORS[t.tier] ?? "bg-gray-100 text-gray-600"} />
                <Chip label={`r${t.risk}`} colorClass={t.risk >= 4 ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500"} />
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-3">
          cancel_notification (staff_approval) and bulk_send_notification (admin) require human approval.
          All AI generation tools run on local Ollama — no data sent to cloud AI.
        </p>
      </div>
    </div>
  );
}

function TemplatesTab({ data }: { data: OverviewData | null }) {
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterChannel, setFilterChannel] = useState<string>("all");
  const templates = data?.templates ?? [];
  const filtered = templates.filter(t => (filterStatus === "all" || t.status === filterStatus) && (filterChannel === "all" || t.channel === filterChannel));

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <select className="border border-gray-200 rounded px-3 py-1.5 text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">All statuses</option>
          {["draft", "approved", "active", "archived"].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="border border-gray-200 rounded px-3 py-1.5 text-sm" value={filterChannel} onChange={e => setFilterChannel(e.target.value)}>
          <option value="all">All channels</option>
          {["email", "sms", "push", "whatsapp", "in_app", "telegram"].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>{["Template", "Channel", "Type", "Status", "Version"].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(t => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="px-4 py-3"><div className="font-medium text-gray-900">{t.name}</div><div className="text-xs text-gray-400 font-mono">{t.slug}</div></td>
                <td className="px-4 py-3"><Chip label={`${CHANNEL_ICONS[t.channel] ?? ""} ${t.channel}`} colorClass={CHANNEL_COLORS[t.channel] ?? "bg-gray-100 text-gray-600"} /></td>
                <td className="px-4 py-3"><span className="text-xs text-gray-600">{t.type}</span></td>
                <td className="px-4 py-3"><Chip label={t.status} colorClass={STATUS_COLORS[t.status] ?? "bg-gray-100 text-gray-600"} /></td>
                <td className="px-4 py-3 text-gray-600">v{t.version}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="px-4 py-8 text-center text-gray-400 text-sm">No templates in the database match the selected filters.</div>}
      </div>
    </div>
  );
}

function QueueTab({ data }: { data: OverviewData | null }) {
  const queue = data?.queue ?? [];
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
        <h3 className="font-semibold text-gray-700 text-sm">Notification Queue</h3>
        <span className="text-xs text-gray-400">{queue.length} recent jobs</span>
      </div>
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>{["Template", "Channel", "Recipient", "Status", "Retries", "Created"].map(h => <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {queue.map(j => (
            <tr key={j.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-800 text-xs">{j.template_slug}</td>
              <td className="px-4 py-3"><Chip label={`${CHANNEL_ICONS[j.channel] ?? ""} ${j.channel}`} colorClass={CHANNEL_COLORS[j.channel] ?? "bg-gray-100 text-gray-600"} /></td>
              <td className="px-4 py-3 text-xs text-gray-500 font-mono">{j.recipient_address}</td>
              <td className="px-4 py-3"><Chip label={j.status} colorClass={STATUS_COLORS[j.status] ?? "bg-gray-100 text-gray-600"} /></td>
              <td className="px-4 py-3 text-center"><span className={`text-xs font-semibold ${j.retry_count > 0 ? "text-amber-600" : "text-gray-400"}`}>{j.retry_count}/3</span></td>
              <td className="px-4 py-3 text-xs text-gray-500">{new Date(j.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!queue.length && <div className="px-4 py-8 text-center text-gray-400 text-sm">No notification_queue rows yet.</div>}
    </div>
  );
}

function AnalyticsTab({ data }: { data: OverviewData | null }) {
  const top = data?.topTemplates ?? [];
  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50"><h3 className="font-semibold text-gray-700 text-sm">Top Templates — Last 30 Days</h3></div>
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>{["Template", "Channel", "Sent", "Delivery Rate", "Open Rate"].map(h => <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {top.map(row => (
              <tr key={`${row.template_slug}-${row.channel}`} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-700">{row.template_slug}</td>
                <td className="px-4 py-3"><Chip label={`${CHANNEL_ICONS[row.channel] ?? ""} ${row.channel}`} colorClass={CHANNEL_COLORS[row.channel] ?? "bg-gray-100 text-gray-600"} /></td>
                <td className="px-4 py-3 text-gray-700 font-medium">{row.sent_30d}</td>
                <td className="px-4 py-3 text-gray-600">{row.delivery_pct ?? '—'}%</td>
                <td className="px-4 py-3 text-gray-600">{row.open_pct ?? '—'}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!top.length && <div className="px-4 py-8 text-center text-gray-400 text-sm">No notification_analytics rows yet — this rolls up once real sends accumulate.</div>}
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
        <strong>AI Content Features (local Ollama only):</strong> generate_email_content, generate_sms_content, and translate_message
        all run on the self-hosted Ollama instance. All output is marked DRAFT — requires human review before saving to any template.
      </div>
    </div>
  );
}

function ChannelsTab({ data }: { data: OverviewData | null }) {
  const channels = data?.channelHealth ?? [];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {channels.map(ch => (
        <div key={ch.channel} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2"><span className="text-xl">{CHANNEL_ICONS[ch.channel]}</span><span className="font-semibold text-gray-900 capitalize">{ch.channel}</span></div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="text-center"><div className="font-bold text-gray-800">{ch.sent_7d}</div><div className="text-gray-400">sent 7d</div></div>
            <div className="text-center"><div className="font-bold text-gray-800">{ch.delivery_rate_pct ?? '—'}%</div><div className="text-gray-400">delivery rate</div></div>
            <div className="text-center"><div className={`font-bold ${Number(ch.failed_7d) > 0 ? "text-red-600" : "text-green-700"}`}>{ch.failed_7d}</div><div className="text-gray-400">failed 7d</div></div>
          </div>
        </div>
      ))}
      {!channels.length && <div className="col-span-2 px-4 py-8 text-center text-gray-400 text-sm bg-white border border-gray-200 rounded-lg">No notification_analytics rows yet for any channel — this populates once real notifications are dispatched.</div>}
    </div>
  );
}

function PreferencesTab() {
  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <h3 className="font-semibold text-gray-800 mb-4">Customer Self-Service Preferences (schema, not live counts)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="font-medium text-gray-700 mb-2">Channel Controls — real columns on notification_preference</div>
            <ul className="space-y-1 text-gray-600 text-xs">
              <li>email_enabled, sms_enabled, push_enabled, whatsapp_enabled, in_app_enabled, telegram_enabled</li>
            </ul>
          </div>
          <div>
            <div className="font-medium text-gray-700 mb-2">Personal Controls</div>
            <ul className="space-y-1 text-gray-600 text-xs">
              <li>language, timezone, quiet_hours_start/end, marketing_enabled, transactional_enabled (always-on)</li>
            </ul>
          </div>
        </div>
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <strong>Data policy:</strong> Preferences stored in <code className="bg-blue-100 px-1 rounded mx-1">notification_preference</code>.
        Consent stored in <code className="bg-blue-100 px-1 rounded mx-1">customer.email_opt_in</code> / <code className="bg-blue-100 px-1 rounded mx-1">customer.sms_opt_in</code>.
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchOverview().then(d => { setData(d); setLoading(false); }); }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-xl font-bold text-gray-900">Notification &amp; Communication Center</h1>
          <p className="text-sm text-gray-500 mt-0.5">Live data from notification_template/queue/analytics — Email · SMS · WhatsApp · Push · In-App · Telegram</p>
        </div>
      </div>
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="max-w-7xl mx-auto flex gap-1">
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>{tab}</button>
          ))}
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 py-6">
        {loading ? <div className="text-center text-sm text-gray-400 py-8">Loading live data…</div> : <>
          {activeTab === "Overview" && <OverviewTab data={data} />}
          {activeTab === "Templates" && <TemplatesTab data={data} />}
          {activeTab === "Queue" && <QueueTab data={data} />}
          {activeTab === "Analytics" && <AnalyticsTab data={data} />}
          {activeTab === "Channels" && <ChannelsTab data={data} />}
          {activeTab === "Preferences" && <PreferencesTab />}
        </>}
      </div>
    </div>
  );
}
