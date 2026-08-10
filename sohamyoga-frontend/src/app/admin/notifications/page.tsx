"use client";
// Notification & Communication Center — omnichannel admin portal
// Tabs: Overview | Templates | Queue | Analytics | Channels | Preferences

import { useState } from "react";

// ── Static types ──────────────────────────────────────────────────────────────

type Channel = "email" | "sms" | "whatsapp" | "push" | "in_app" | "telegram" | "discord" | "slack" | "voice";
type TemplateStatus = "draft" | "approved" | "active" | "archived";
type JobStatus = "pending" | "scheduled" | "processing" | "sent" | "failed" | "cancelled";

// ── Color maps ────────────────────────────────────────────────────────────────

const CHANNEL_COLORS: Record<Channel, string> = {
  email:    "bg-blue-100 text-blue-700",
  sms:      "bg-green-100 text-green-700",
  whatsapp: "bg-emerald-100 text-emerald-700",
  push:     "bg-purple-100 text-purple-700",
  in_app:   "bg-indigo-100 text-indigo-700",
  telegram: "bg-sky-100 text-sky-700",
  discord:  "bg-violet-100 text-violet-700",
  slack:    "bg-rose-100 text-rose-700",
  voice:    "bg-amber-100 text-amber-700",
};

const CHANNEL_ICONS: Record<Channel, string> = {
  email:    "✉",
  sms:      "💬",
  whatsapp: "📱",
  push:     "🔔",
  in_app:   "🔔",
  telegram: "✈",
  discord:  "🎮",
  slack:    "💼",
  voice:    "📞",
};

const STATUS_COLORS: Record<TemplateStatus | JobStatus, string> = {
  draft:      "bg-gray-100 text-gray-600",
  approved:   "bg-blue-100 text-blue-700",
  active:     "bg-green-100 text-green-700",
  archived:   "bg-gray-200 text-gray-500",
  pending:    "bg-yellow-100 text-yellow-700",
  scheduled:  "bg-indigo-100 text-indigo-700",
  processing: "bg-blue-100 text-blue-700",
  sent:       "bg-green-100 text-green-700",
  failed:     "bg-red-100 text-red-700",
  cancelled:  "bg-gray-100 text-gray-500",
};

const TIER_COLORS: Record<string, string> = {
  auto:              "bg-green-100 text-green-700",
  staff:             "bg-blue-100 text-blue-700",
  customer_confirm:  "bg-teal-100 text-teal-700",
  staff_approval:    "bg-amber-100 text-amber-700",
  admin:             "bg-orange-100 text-orange-700",
  admin_destructive: "bg-red-100 text-red-700",
};

// ── Demo data ─────────────────────────────────────────────────────────────────

const DEMO_TEMPLATES = [
  { id: "t1", slug: "booking_confirmation_email",  name: "Booking Confirmation",   channel: "email",  type: "transactional", status: "active",   version: 3, lastSent: "1h ago" },
  { id: "t2", slug: "otp_verification_sms",        name: "OTP Verification",       channel: "sms",    type: "otp",           status: "active",   version: 1, lastSent: "5m ago" },
  { id: "t3", slug: "booking_reminder_email",      name: "Booking Reminder",       channel: "email",  type: "reminder",      status: "active",   version: 2, lastSent: "30m ago" },
  { id: "t4", slug: "promotional_offer_email",     name: "Promotional Offer",      channel: "email",  type: "marketing",     status: "draft",    version: 1, lastSent: "—" },
  { id: "t5", slug: "birthday_wishes_email",       name: "Birthday Wishes",        channel: "email",  type: "marketing",     status: "approved", version: 1, lastSent: "2d ago" },
  { id: "t6", slug: "booking_reminder_sms",        name: "Booking Reminder SMS",   channel: "sms",    type: "reminder",      status: "active",   version: 1, lastSent: "1h ago" },
  { id: "t7", slug: "class_cancellation_alert",    name: "Class Cancellation Alert",channel: "push",  type: "alert",         status: "active",   version: 2, lastSent: "3d ago" },
  { id: "t8", slug: "workshop_invitation_email",   name: "Workshop Invitation",    channel: "email",  type: "marketing",     status: "archived", version: 1, lastSent: "—" },
];

const DEMO_QUEUE = [
  { id: "j1", template: "Booking Reminder",       channel: "email", recipient: "priya@example.com",  status: "scheduled",  scheduledAt: "Tomorrow 8:00 AM",  retries: 0 },
  { id: "j2", template: "OTP Verification",        channel: "sms",   recipient: "+1-xxx-xxx-3456",    status: "sent",       scheduledAt: "Just now",          retries: 0 },
  { id: "j3", template: "Birthday Wishes",         channel: "email", recipient: "rajan@example.com",  status: "processing", scheduledAt: "Sending...",        retries: 0 },
  { id: "j4", template: "Promotional Offer Email", channel: "email", recipient: "segment:silver",     status: "pending",    scheduledAt: "In queue",          retries: 0 },
  { id: "j5", template: "Push Alert",              channel: "push",  recipient: "device:abc-xyz",     status: "failed",     scheduledAt: "—",                 retries: 2 },
];

const DEMO_CHANNELS = [
  { channel: "email",    provider: "Postal (self-hosted SMTP)",    status: "healthy", dailyLimit: 50000, sent24h: 1248, failRate: "0.3%" },
  { channel: "sms",      provider: "Twilio (configured gateway)",  status: "healthy", dailyLimit: 5000,  sent24h: 312,  failRate: "0.1%" },
  { channel: "whatsapp", provider: "WhatsApp Business API",        status: "degraded",dailyLimit: 1000,  sent24h: 48,   failRate: "4.2%" },
  { channel: "push",     provider: "ntfy (self-hosted)",           status: "healthy", dailyLimit: 100000,sent24h: 5200, failRate: "0.0%" },
  { channel: "in_app",   provider: "Portal WebSocket + Novu",      status: "healthy", dailyLimit: -1,    sent24h: 8340, failRate: "0.0%" },
  { channel: "telegram", provider: "Apprise / Bot API",            status: "healthy", dailyLimit: 30000, sent24h: 890,  failRate: "0.0%" },
];

const DEMO_ANALYTICS = [
  { channel: "email",    sent: 1248, delivered: 1231, failed: 17, openRate: "38%", clickRate: "12%", bounceRate: "0.3%" },
  { channel: "sms",      sent: 312,  delivered: 309,  failed: 3,  openRate: "—",   clickRate: "—",   bounceRate: "1.0%" },
  { channel: "push",     sent: 5200, delivered: 5198, failed: 2,  openRate: "—",   clickRate: "—",   bounceRate: "0.0%" },
  { channel: "in_app",   sent: 8340, delivered: 8340, failed: 0,  openRate: "—",   clickRate: "—",   bounceRate: "0.0%" },
  { channel: "telegram", sent: 890,  delivered: 887,  failed: 3,  openRate: "—",   clickRate: "—",   bounceRate: "0.3%" },
];

const MCP_TOOLS = [
  { name: "send_notification",       tier: "auto",             risk: 1 },
  { name: "schedule_notification",   tier: "staff",            risk: 2 },
  { name: "cancel_notification",     tier: "staff_approval",   risk: 3 },
  { name: "retry_notification",      tier: "staff",            risk: 2 },
  { name: "get_notification_history",tier: "auto",             risk: 1 },
  { name: "get_notification_status", tier: "auto",             risk: 1 },
  { name: "generate_email_content",  tier: "auto",             risk: 1 },
  { name: "generate_sms_content",    tier: "auto",             risk: 1 },
  { name: "translate_message",       tier: "auto",             risk: 1 },
  { name: "get_delivery_report",     tier: "auto",             risk: 1 },
  { name: "bulk_send_notification",  tier: "admin",            risk: 4 },
];

const TABS = ["Overview", "Templates", "Queue", "Analytics", "Channels", "Preferences"] as const;
type Tab = typeof TABS[number];

// ── Chip ──────────────────────────────────────────────────────────────────────

function Chip({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
      {label}
    </span>
  );
}

// ── Overview tab ──────────────────────────────────────────────────────────────

function OverviewTab() {
  const stats = [
    { label: "Sent today",      value: "15,990", sub: "all channels" },
    { label: "Delivery rate",   value: "99.1%",  sub: "email + push" },
    { label: "Open rate",       value: "38.0%",  sub: "email only" },
    { label: "Pending queue",   value: "4",      sub: "waiting to send" },
    { label: "Retry queue",     value: "1",      sub: "failed, eligible" },
    { label: "Templates active",value: "5",      sub: "across all channels" },
  ];

  return (
    <div className="space-y-8">
      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-lg p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-gray-900">{s.value}</div>
            <div className="text-xs font-medium text-gray-700 mt-1">{s.label}</div>
            <div className="text-xs text-gray-400 mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Architecture */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <h3 className="font-semibold text-gray-800 mb-4">Architecture — Data Residency Guarantee</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="font-semibold text-blue-800 mb-2">Local (Always)</div>
            <ul className="space-y-1 text-blue-700 text-xs">
              <li>• Templates + version history</li>
              <li>• Job queue + delivery log</li>
              <li>• Customer preferences</li>
              <li>• Analytics aggregates</li>
              <li>• Suppression lists</li>
              <li>• AI draft output</li>
            </ul>
          </div>
          <div className="bg-amber-50 rounded-lg p-4">
            <div className="font-semibold text-amber-800 mb-2">Adapters (Self-hosted)</div>
            <ul className="space-y-1 text-amber-700 text-xs">
              <li>• Novu — orchestration</li>
              <li>• Listmonk — newsletters</li>
              <li>• Postal — SMTP relay</li>
              <li>• ntfy — push server</li>
              <li>• Apprise — multi-channel</li>
              <li>• Ollama — AI generation</li>
            </ul>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="font-semibold text-green-800 mb-2">Sent to External APIs Only</div>
            <ul className="space-y-1 text-green-700 text-xs">
              <li>• Rendered message text</li>
              <li>• Recipient address</li>
              <li>• Provider API token</li>
              <li className="text-red-600 font-medium">• NO customer profiles</li>
              <li className="text-red-600 font-medium">• NO health data</li>
              <li className="text-red-600 font-medium">• NO PII beyond address</li>
            </ul>
          </div>
        </div>
      </div>

      {/* MCP tools */}
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

// ── Templates tab ─────────────────────────────────────────────────────────────

function TemplatesTab() {
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterChannel, setFilterChannel] = useState<string>("all");

  const filtered = DEMO_TEMPLATES.filter(t =>
    (filterStatus  === "all" || t.status  === filterStatus) &&
    (filterChannel === "all" || t.channel === filterChannel)
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <select
          className="border border-gray-200 rounded px-3 py-1.5 text-sm"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="all">All statuses</option>
          {["draft","approved","active","archived"].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          className="border border-gray-200 rounded px-3 py-1.5 text-sm"
          value={filterChannel}
          onChange={e => setFilterChannel(e.target.value)}
        >
          <option value="all">All channels</option>
          {["email","sms","push","whatsapp","in_app","telegram"].map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <button className="ml-auto bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-blue-700">
          + New Template
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["Template", "Channel", "Type", "Status", "Version", "Last Sent", "Actions"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(t => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{t.name}</div>
                  <div className="text-xs text-gray-400 font-mono">{t.slug}</div>
                </td>
                <td className="px-4 py-3">
                  <Chip
                    label={`${CHANNEL_ICONS[t.channel as Channel] ?? ""} ${t.channel}`}
                    colorClass={CHANNEL_COLORS[t.channel as Channel] ?? "bg-gray-100 text-gray-600"}
                  />
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-gray-600">{t.type}</span>
                </td>
                <td className="px-4 py-3">
                  <Chip label={t.status} colorClass={STATUS_COLORS[t.status as TemplateStatus] ?? "bg-gray-100 text-gray-600"} />
                </td>
                <td className="px-4 py-3 text-gray-600">v{t.version}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{t.lastSent}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button className="text-xs text-blue-600 hover:underline">Edit</button>
                    {t.status === "draft"    && <button className="text-xs text-green-600 hover:underline">Approve</button>}
                    {t.status === "approved" && <button className="text-xs text-blue-600 hover:underline">Activate</button>}
                    {t.status !== "archived" && <button className="text-xs text-gray-500 hover:underline">Archive</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="px-4 py-8 text-center text-gray-400 text-sm">No templates match the selected filters.</div>
        )}
      </div>
    </div>
  );
}

// ── Queue tab ─────────────────────────────────────────────────────────────────

function QueueTab() {
  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
          <h3 className="font-semibold text-gray-700 text-sm">Notification Queue</h3>
          <span className="text-xs text-gray-400">{DEMO_QUEUE.length} jobs</span>
        </div>
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {["Template", "Channel", "Recipient", "Status", "Scheduled", "Retries", "Actions"].map(h => (
                <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {DEMO_QUEUE.map(j => (
              <tr key={j.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800 text-xs">{j.template}</td>
                <td className="px-4 py-3">
                  <Chip
                    label={`${CHANNEL_ICONS[j.channel as Channel] ?? ""} ${j.channel}`}
                    colorClass={CHANNEL_COLORS[j.channel as Channel] ?? "bg-gray-100 text-gray-600"}
                  />
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 font-mono">{j.recipient}</td>
                <td className="px-4 py-3">
                  <Chip label={j.status} colorClass={STATUS_COLORS[j.status as JobStatus] ?? "bg-gray-100 text-gray-600"} />
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{j.scheduledAt}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs font-semibold ${j.retries > 0 ? "text-amber-600" : "text-gray-400"}`}>
                    {j.retries}/{3}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    {j.status === "failed"    && <button className="text-xs text-amber-600 hover:underline">Retry</button>}
                    {["pending","scheduled"].includes(j.status) && (
                      <button className="text-xs text-red-500 hover:underline">Cancel</button>
                    )}
                    <button className="text-xs text-gray-400 hover:underline">Details</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Analytics tab ─────────────────────────────────────────────────────────────

function AnalyticsTab() {
  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="font-semibold text-gray-700 text-sm">Last 24 Hours — Channel Performance</h3>
        </div>
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {["Channel", "Sent", "Delivered", "Failed", "Open Rate", "Click Rate", "Bounce Rate"].map(h => (
                <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {DEMO_ANALYTICS.map(row => (
              <tr key={row.channel} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Chip
                    label={`${CHANNEL_ICONS[row.channel as Channel] ?? ""} ${row.channel}`}
                    colorClass={CHANNEL_COLORS[row.channel as Channel] ?? "bg-gray-100 text-gray-600"}
                  />
                </td>
                <td className="px-4 py-3 text-gray-700 font-medium">{row.sent.toLocaleString()}</td>
                <td className="px-4 py-3 text-green-700">{row.delivered.toLocaleString()}</td>
                <td className="px-4 py-3 text-red-600">{row.failed}</td>
                <td className="px-4 py-3 text-gray-600">{row.openRate}</td>
                <td className="px-4 py-3 text-gray-600">{row.clickRate}</td>
                <td className="px-4 py-3 text-gray-600">{row.bounceRate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
        <strong>AI Content Features (local Ollama only):</strong> generate_email_content, generate_sms_content,
        and translate_message all run on the self-hosted Ollama instance.
        All output is marked DRAFT — requires human review before saving to any template.
        No customer data is sent to cloud AI services.
      </div>
    </div>
  );
}

// ── Channels tab ──────────────────────────────────────────────────────────────

function ChannelsTab() {
  const healthColor: Record<string, string> = {
    healthy:  "bg-green-100 text-green-700",
    degraded: "bg-amber-100 text-amber-700",
    down:     "bg-red-100 text-red-700",
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {DEMO_CHANNELS.map(ch => (
          <div key={ch.channel} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">{CHANNEL_ICONS[ch.channel as Channel]}</span>
                <span className="font-semibold text-gray-900 capitalize">{ch.channel}</span>
              </div>
              <Chip label={ch.status} colorClass={healthColor[ch.status] ?? "bg-gray-100 text-gray-600"} />
            </div>
            <div className="text-xs text-gray-500 mb-3">{ch.provider}</div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="text-center">
                <div className="font-bold text-gray-800">{ch.sent24h.toLocaleString()}</div>
                <div className="text-gray-400">sent 24h</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-gray-800">{ch.dailyLimit === -1 ? "∞" : ch.dailyLimit.toLocaleString()}</div>
                <div className="text-gray-400">daily limit</div>
              </div>
              <div className="text-center">
                <div className={`font-bold ${parseFloat(ch.failRate) > 2 ? "text-red-600" : "text-green-700"}`}>{ch.failRate}</div>
                <div className="text-gray-400">fail rate</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Preferences tab ───────────────────────────────────────────────────────────

function PreferencesTab() {
  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <h3 className="font-semibold text-gray-800 mb-4">Customer Self-Service Preferences</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="font-medium text-gray-700 mb-2">Channel Controls</div>
            <ul className="space-y-1 text-gray-600 text-xs">
              <li>✅ Email opt-in/opt-out (per type: marketing/transactional/reminder)</li>
              <li>✅ SMS opt-in/opt-out (requires explicit consent — default OFF)</li>
              <li>✅ Push notification enable/disable</li>
              <li>✅ WhatsApp Business opt-in (default OFF)</li>
              <li>✅ In-app notification bell toggle</li>
              <li>✅ Telegram bot opt-in</li>
            </ul>
          </div>
          <div>
            <div className="font-medium text-gray-700 mb-2">Personal Controls</div>
            <ul className="space-y-1 text-gray-600 text-xs">
              <li>✅ Preferred language (en, fr, hi, ...)</li>
              <li>✅ Timezone for scheduling</li>
              <li>✅ Quiet hours (e.g. 22:00–08:00 — overnight window supported)</li>
              <li>✅ Marketing enabled toggle</li>
              <li>✅ Transactional always-on (OTP, booking, payment)</li>
              <li>✅ Full notification history with read/archive/delete</li>
            </ul>
          </div>
        </div>
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <strong>Data policy:</strong> All notification preferences are stored in the local
        <code className="bg-blue-100 px-1 rounded mx-1">notification_preference</code>
        table. Consent data (marketing opt-in/opt-out) is stored in
        <code className="bg-blue-100 px-1 rounded mx-1">customer.email_opt_in</code> and
        <code className="bg-blue-100 px-1 rounded mx-1">customer.sms_opt_in</code>.
        No preference data is shared with external providers.
      </div>
    </div>
  );
}

// ── Page root ─────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Overview");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-xl font-bold text-gray-900">Notification & Communication Center</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Omnichannel — Email · SMS · WhatsApp · Push · In-App · Telegram · Discord · Slack · Voice
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="max-w-7xl mx-auto flex gap-1">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {activeTab === "Overview"     && <OverviewTab />}
        {activeTab === "Templates"    && <TemplatesTab />}
        {activeTab === "Queue"        && <QueueTab />}
        {activeTab === "Analytics"    && <AnalyticsTab />}
        {activeTab === "Channels"     && <ChannelsTab />}
        {activeTab === "Preferences"  && <PreferencesTab />}
      </div>
    </div>
  );
}
