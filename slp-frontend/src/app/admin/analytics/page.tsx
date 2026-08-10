"use client";
import { useState } from "react";

const TABS = ["overview", "events", "funnels", "sessions", "cohorts", "consent", "integrations"] as const;
type Tab = typeof TABS[number];

const TAB_LABELS: Record<Tab, string> = {
  overview: "Overview", events: "Events", funnels: "Funnels",
  sessions: "Sessions", cohorts: "Cohorts", consent: "Consent", integrations: "Integrations",
};

function KpiCard({ label, value, sub, color = "blue" }: { label: string; value: string | number; sub?: string; color?: string }) {
  const borders: Record<string, string> = {
    blue: "border-l-4 border-blue-500 bg-blue-50",
    green: "border-l-4 border-green-500 bg-green-50",
    amber: "border-l-4 border-amber-500 bg-amber-50",
    purple: "border-l-4 border-purple-500 bg-purple-50",
    teal: "border-l-4 border-teal-500 bg-teal-50",
    pink: "border-l-4 border-pink-500 bg-pink-50",
    red: "border-l-4 border-red-500 bg-red-50",
  };
  return (
    <div className={`rounded-lg p-4 ${borders[color] || borders.blue}`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>{label}</span>;
}

const MOCK_EVENTS = [
  { id: "ev-1", type: "page_view", name: "Page Viewed", url: "/classes", anon: "anon-abc", status: "collected", at: "10:02 AM" },
  { id: "ev-2", type: "click", name: "Book Now Clicked", url: "/classes/hatha", anon: "anon-abc", status: "collected", at: "10:04 AM" },
  { id: "ev-3", type: "booking_started", name: "Booking Started", url: "/booking", anon: "anon-abc", status: "collected", at: "10:05 AM" },
  { id: "ev-4", type: "payment_initiated", name: "Payment Initiated", url: "/checkout", anon: "anon-def", status: "masked", at: "10:08 AM" },
  { id: "ev-5", type: "booking_completed", name: "Booking Completed", url: "/thank-you", anon: "anon-def", status: "collected", at: "10:10 AM" },
  { id: "ev-6", type: "error", name: "API Error", url: "/api/bookings", anon: "anon-xyz", status: "collected", at: "10:15 AM" },
];
const EVENT_TYPE_COLORS: Record<string, string> = {
  page_view: "bg-blue-100 text-blue-700", click: "bg-gray-100 text-gray-600",
  form_start: "bg-indigo-100 text-indigo-700", booking_started: "bg-amber-100 text-amber-700",
  booking_completed: "bg-green-100 text-green-700", payment_initiated: "bg-orange-100 text-orange-700",
  payment_completed: "bg-green-200 text-green-800", subscription_started: "bg-emerald-100 text-emerald-700",
  error: "bg-red-100 text-red-700",
};
const STATUS_COLORS: Record<string, string> = {
  collected: "bg-green-100 text-green-700", masked: "bg-yellow-100 text-yellow-700",
  dropped: "bg-red-100 text-red-600", pending: "bg-gray-100 text-gray-600",
};
const MOCK_FUNNELS = [
  { id: "fn-1", name: "Booking Funnel", steps: 5, status: "active", convRate: 10 },
  { id: "fn-2", name: "Membership Signup", steps: 4, status: "active", convRate: 22 },
  { id: "fn-3", name: "Workshop Booking", steps: 3, status: "paused", convRate: 38 },
];
const FUNNEL_STEPS = [
  { step: "Landing page", count: 2000, conv: 100, drop: 0 },
  { step: "Services page", count: 1200, conv: 60, drop: 40 },
  { step: "Booking form", count: 800, conv: 66.7, drop: 33.3 },
  { step: "Payment", count: 400, conv: 50, drop: 50 },
  { step: "Confirmed", count: 200, conv: 50, drop: 50 },
];
const MOCK_SESSIONS = [
  { id: "sess-1", anon: "anon-abc", device: "desktop", browser: "Chrome", country: "CA", pages: 6, duration: "8m 40s", source: "google", replay: true },
  { id: "sess-2", anon: "anon-def", device: "mobile", browser: "Safari", country: "IN", pages: 3, duration: "3m 12s", source: "instagram", replay: false },
  { id: "sess-3", anon: "anon-xyz", device: "desktop", browser: "Firefox", country: "CA", pages: 1, duration: "0m 45s", source: "direct", replay: false },
  { id: "sess-4", anon: "anon-pqr", device: "tablet", browser: "Chrome", country: "US", pages: 4, duration: "5m 20s", source: "email", replay: true },
];
const TRAFFIC_SOURCES = [
  { source: "Direct", count: 1240, pct: 31 },
  { source: "Google Search", count: 1050, pct: 26 },
  { source: "Instagram", count: 830, pct: 21 },
  { source: "Email", count: 520, pct: 13 },
  { source: "Referral", count: 360, pct: 9 },
];
const CONSENT_DIST = [
  { level: "all", count: 1840, pct: 46 },
  { level: "analytics", count: 1200, pct: 30 },
  { level: "essential", count: 560, pct: 14 },
  { level: "none", count: 400, pct: 10 },
];
const CONSENT_COLORS: Record<string, string> = {
  all: "bg-green-500", analytics: "bg-blue-500", essential: "bg-yellow-400", none: "bg-gray-300",
};

function OverviewTab() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <KpiCard label="Unique Visitors" value="4,000" sub="This month" color="blue" />
        <KpiCard label="Total Sessions" value="5,840" sub="This month" color="teal" />
        <KpiCard label="Page Views" value="28,200" sub="This month" color="purple" />
        <KpiCard label="Avg Session" value="4.8 min" sub="Duration" color="amber" />
        <KpiCard label="Bounce Rate" value="38%" sub="Single-page" color="pink" />
        <KpiCard label="Conversions" value="200" sub="Bookings completed" color="green" />
        <KpiCard label="JS Errors" value="12" sub="Last 7 days" color="red" />
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-3">Traffic Sources</h3>
          {TRAFFIC_SOURCES.map(s => (
            <div key={s.source} className="flex items-center gap-3 mb-2">
              <span className="text-sm text-gray-700 w-28 flex-shrink-0">{s.source}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${s.pct}%` }} />
              </div>
              <span className="text-xs font-medium w-8 text-right">{s.pct}%</span>
              <span className="text-xs text-gray-400 w-14 text-right">{s.count.toLocaleString()}</span>
            </div>
          ))}
        </div>
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-3">Conversion Events (Today)</h3>
          {[
            { label: "Bookings Completed", count: 12, badge: "booking_completed" },
            { label: "Payments Completed", count: 11, badge: "payment_completed" },
            { label: "Subscriptions Started", count: 5, badge: "subscription_started" },
            { label: "Booking Started", count: 48, badge: "booking_started" },
          ].map(c => (
            <div key={c.label} className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-700">{c.label}</span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-900">{c.count}</span>
                <Badge label={c.badge} colorClass={EVENT_TYPE_COLORS[c.badge] || ""} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EventsTab() {
  const [typeFilter, setTypeFilter] = useState("all");
  const filtered = MOCK_EVENTS.filter(e => typeFilter === "all" || e.type === typeFilter);
  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap items-center">
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="border rounded px-3 py-2 text-sm">
          <option value="all">All Event Types</option>
          {Object.keys(EVENT_TYPE_COLORS).map(t => <option key={t}>{t}</option>)}
        </select>
        <div className="ml-auto text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          Sensitive fields automatically masked · IP never stored raw
        </div>
      </div>
      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {["Type", "Name", "URL", "Visitor", "Status", "Time"].map(h => (
                <th key={h} className="px-4 py-3 text-left font-medium text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map(e => (
              <tr key={e.id} className={`hover:bg-gray-50 ${e.type === "error" ? "bg-red-50" : ""}`}>
                <td className="px-4 py-3"><Badge label={e.type} colorClass={EVENT_TYPE_COLORS[e.type] || ""} /></td>
                <td className="px-4 py-3 font-medium">{e.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500 max-w-[180px] truncate">{e.url}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-400">{e.anon}</td>
                <td className="px-4 py-3"><Badge label={e.status} colorClass={STATUS_COLORS[e.status] || ""} /></td>
                <td className="px-4 py-3 text-gray-400 text-xs">{e.at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FunnelsTab() {
  const [sel, setSel] = useState(MOCK_FUNNELS[0].id);
  return (
    <div className="space-y-6">
      <div className="flex gap-3 flex-wrap">
        {MOCK_FUNNELS.map(f => (
          <button key={f.id} onClick={() => setSel(f.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${sel === f.id ? "bg-amber-500 text-white border-amber-500" : "border-gray-200 text-gray-600 hover:border-amber-300"}`}>
            {f.name}
          </button>
        ))}
        <button className="ml-auto bg-amber-500 text-white px-4 py-2 rounded text-sm font-medium">+ New Funnel</button>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        <KpiCard label="Entry Count" value="2,000" sub="Sessions entered" color="blue" />
        <KpiCard label="Completed" value="200" sub="Reached final step" color="green" />
        <KpiCard label="Overall Conv." value="10%" sub="Entry → Complete" color="amber" />
      </div>
      <div className="bg-white border rounded-lg p-6">
        <h3 className="font-semibold text-gray-800 mb-4">Booking Funnel — Step by Step</h3>
        <div className="space-y-4">
          {FUNNEL_STEPS.map((s, i) => (
            <div key={s.step}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                  <span className="text-sm font-medium">{s.step}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="font-bold">{s.count.toLocaleString()}</span>
                  {i > 0 && <span className="text-red-500 text-xs">−{s.drop}% drop</span>}
                  <span className="text-green-600 font-medium">{s.conv}%</span>
                </div>
              </div>
              <div className="bg-gray-100 rounded-full h-3 overflow-hidden">
                <div className="bg-gradient-to-r from-amber-400 to-amber-500 h-3 rounded-full" style={{ width: `${(s.count / 2000) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SessionsTab() {
  const DEVICE_ICONS: Record<string, string> = { desktop: "🖥️", mobile: "📱", tablet: "📟" };
  const SOURCE_COLORS: Record<string, string> = {
    google: "bg-blue-100 text-blue-700", instagram: "bg-pink-100 text-pink-700",
    direct: "bg-gray-100 text-gray-600", email: "bg-amber-100 text-amber-700",
  };
  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
        Sessions are anonymised. Session replay requires staff approval. No raw IP stored.
      </div>
      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {["Visitor", "Device", "Browser", "Country", "Pages", "Duration", "Source", "Replay"].map(h => (
                <th key={h} className="px-4 py-3 text-left font-medium text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {MOCK_SESSIONS.map(s => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-400">{s.anon}</td>
                <td className="px-4 py-3">{DEVICE_ICONS[s.device] || "?"} {s.device}</td>
                <td className="px-4 py-3">{s.browser}</td>
                <td className="px-4 py-3">{s.country}</td>
                <td className="px-4 py-3">{s.pages}</td>
                <td className="px-4 py-3">{s.duration}</td>
                <td className="px-4 py-3"><Badge label={s.source} colorClass={SOURCE_COLORS[s.source] || "bg-gray-100 text-gray-600"} /></td>
                <td className="px-4 py-3">
                  {s.replay
                    ? <button className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded hover:bg-purple-200">▶ Replay</button>
                    : <span className="text-gray-300 text-xs">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CohortsTab() {
  const WEEKS = ["W1", "W2", "W3", "W4", "W5", "W6"];
  const RETENTION = [[100,42,31,28,25,22],[100,45,33,30,27],[100,48,35,31],[100,50,38],[100,46],[100]];
  function heat(pct: number) {
    if (pct >= 80) return "bg-green-600 text-white";
    if (pct >= 50) return "bg-green-400 text-white";
    if (pct >= 30) return "bg-amber-300 text-gray-900";
    if (pct >= 15) return "bg-orange-200 text-gray-900";
    return "bg-gray-100 text-gray-500";
  }
  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-4 gap-4">
        <KpiCard label="New Users" value="1,200" sub="This month" color="blue" />
        <KpiCard label="Returning" value="2,800" sub="Came back" color="green" />
        <KpiCard label="Converted" value="200" sub="Completed booking" color="amber" />
        <KpiCard label="Wk2 Retention" value="46%" sub="Avg" color="purple" />
      </div>
      <div className="bg-white border rounded-lg p-4">
        <h3 className="font-semibold text-gray-800 mb-4">Retention Heatmap — August Cohorts</h3>
        <div className="overflow-x-auto">
          <table className="text-xs text-center">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left text-gray-500">Cohort</th>
                {WEEKS.map(w => <th key={w} className="px-3 py-2 text-gray-500">{w}</th>)}
              </tr>
            </thead>
            <tbody>
              {RETENTION.map((row, i) => (
                <tr key={i}>
                  <td className="px-3 py-2 text-left text-gray-600 font-medium">Aug W{i + 1}</td>
                  {row.map((pct, j) => (
                    <td key={j} className={`px-3 py-2 rounded font-medium ${heat(pct)}`}>{pct}%</td>
                  ))}
                  {Array.from({ length: WEEKS.length - row.length }, (_, k) => (
                    <td key={k} className="px-3 py-2 text-gray-200">—</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ConsentTab() {
  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-4 gap-4">
        {CONSENT_DIST.map(c => (
          <KpiCard key={c.level} label={`Level: ${c.level}`} value={`${c.pct}%`} sub={`${c.count.toLocaleString()} visitors`}
            color={c.level === "all" ? "green" : c.level === "analytics" ? "blue" : c.level === "essential" ? "amber" : "pink"} />
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-3">Consent Distribution</h3>
          {CONSENT_DIST.map(c => (
            <div key={c.level} className="flex items-center gap-3 mb-2">
              <span className="text-sm text-gray-700 capitalize w-20">{c.level}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-3">
                <div className={`${CONSENT_COLORS[c.level]} h-3 rounded-full`} style={{ width: `${c.pct}%` }} />
              </div>
              <span className="text-sm font-bold w-8 text-right">{c.pct}%</span>
            </div>
          ))}
        </div>
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-3">Always-Masked Fields</h3>
          <div className="space-y-1.5">
            {["name", "email", "phone", "password", "card / cvv", "health / diagnosis", "message", "address", "dob / ssn"].map(f => (
              <div key={f} className="flex items-center gap-2">
                <span className="text-red-400 text-xs">🔒</span>
                <code className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded font-mono">{f}</code>
                <span className="text-gray-400 text-xs">→ *** before storage</span>
              </div>
            ))}
          </div>
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-800">
            GDPR Art.5(2) · PIPEDA · DPDP Act 2023 · Right-to-erasure via delete_user_data MCP (admin_destructive)
          </div>
        </div>
      </div>
    </div>
  );
}

function IntegrationsTab() {
  const MCP_TOOLS = [
    { name: "get_dashboard", tier: "auto" }, { name: "list_events", tier: "auto" },
    { name: "get_session", tier: "staff" }, { name: "get_funnel", tier: "staff" },
    { name: "get_cohort", tier: "staff" }, { name: "get_heatmap", tier: "staff" },
    { name: "export_events", tier: "staff" }, { name: "get_user_journey", tier: "staff" },
    { name: "opt_out_tracking", tier: "customer_confirm" },
    { name: "get_session_replay", tier: "staff_approval" }, { name: "get_user_pii", tier: "staff_approval" },
    { name: "delete_user_data", tier: "admin_destructive" },
  ];
  const TIER_COLORS: Record<string, string> = {
    auto: "bg-green-100 text-green-700", staff: "bg-blue-100 text-blue-700",
    customer_confirm: "bg-amber-100 text-amber-700", staff_approval: "bg-orange-100 text-orange-700",
    admin_destructive: "bg-red-100 text-red-700",
  };
  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-3">MCP Tools (12)</h3>
          <div className="space-y-1.5">
            {MCP_TOOLS.map(t => (
              <div key={t.name} className="flex items-center justify-between">
                <code className="text-xs font-mono text-gray-700">{t.name}</code>
                <Badge label={t.tier} colorClass={TIER_COLORS[t.tier] || ""} />
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-3">External Systems</h3>
          {[
            { name: "PostHog", role: "Product analytics, funnels, heatmaps, error tracking" },
            { name: "OpenReplay", role: "Session replay — staff_approval gated; fields masked" },
            { name: "Umami", role: "Privacy-first traffic analytics; no cookies; GDPR by design" },
            { name: "GrowthBook", role: "Feature flags and A/B experiments" },
            { name: "OpenTelemetry", role: "API error and latency traces to Grafana / Tempo" },
          ].map(e => (
            <div key={e.name} className="flex gap-2 items-start border rounded p-2 text-xs mb-2">
              <span className="font-medium text-blue-700 w-24 flex-shrink-0">{e.name}</span>
              <span className="text-gray-500">{e.role}</span>
            </div>
          ))}
          <h3 className="font-semibold text-gray-800 mb-2 mt-4">DB Tables (9)</h3>
          <div className="flex flex-wrap gap-1">
            {["tracking_event","tracking_session","consent_record","funnel_definition","funnel_step","heatmap_event","analytics_retention","analytics_cohort","analytics_audit"].map(t => (
              <code key={t} className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono text-blue-700">{t}</code>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsAdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const TAB_CONTENT: Record<Tab, React.ReactElement> = {
    overview: <OverviewTab />, events: <EventsTab />, funnels: <FunnelsTab />,
    sessions: <SessionsTab />, cohorts: <CohortsTab />, consent: <ConsentTab />, integrations: <IntegrationsTab />,
  };
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">User Tracking & Analytics</h1>
            <p className="text-sm text-gray-500 mt-1">PostHog · OpenReplay · Umami · GrowthBook · Consent-first</p>
          </div>
          <div className="flex gap-2">
            <span className="bg-amber-100 text-amber-700 text-xs px-3 py-1 rounded-full font-medium">Wave 13</span>
            <span className="bg-green-100 text-green-700 text-xs px-3 py-1 rounded-full font-medium">GDPR · PIPEDA</span>
          </div>
        </div>
        <div className="flex gap-1 border-b overflow-x-auto">
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === tab ? "border-amber-500 text-amber-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>
        <div>{TAB_CONTENT[activeTab]}</div>
      </div>
    </div>
  );
}
