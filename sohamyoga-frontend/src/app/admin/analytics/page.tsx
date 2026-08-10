"use client";
import { useEffect, useState } from "react";

const TABS = ["overview", "events", "funnels", "attribution", "sessions", "cohorts", "consent", "integrations"] as const;
type Tab = typeof TABS[number];

const TAB_LABELS: Record<Tab, string> = {
  overview: "Overview", events: "Events", funnels: "Funnels", attribution: "Attribution",
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

function EmptyState({ message }: { message: string }) {
  return <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-500 text-sm">{message}</div>;
}

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
const CONSENT_COLORS: Record<string, string> = {
  all: "bg-green-500", analytics: "bg-blue-500", essential: "bg-yellow-400", none: "bg-gray-300",
};

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

interface DashboardData {
  kpis: { uniqueVisitors: number; totalSessions: number; pageViews: number; avgSessionMinutes: number; bounceRatePct: number; jsErrors7d: number };
  trafficSources: { source: string; count: number; pct: number }[];
  conversionsToday: Record<string, number>;
}

function OverviewTab() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetchJson<DashboardData>("/api/analytics/dashboard").then(d => { setData(d); setLoading(false); }); }, []);

  if (loading) return <EmptyState message="Loading…" />;
  if (!data) return <EmptyState message="Analytics data is unavailable right now." />;
  const { kpis } = data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <KpiCard label="Unique Visitors" value={kpis.uniqueVisitors.toLocaleString()} sub="Last 30 days" color="blue" />
        <KpiCard label="Total Sessions" value={kpis.totalSessions.toLocaleString()} sub="Last 30 days" color="teal" />
        <KpiCard label="Page Views" value={kpis.pageViews.toLocaleString()} sub="Last 30 days" color="purple" />
        <KpiCard label="Avg Session" value={`${kpis.avgSessionMinutes.toFixed(1)} min`} sub="Duration" color="amber" />
        <KpiCard label="Bounce Rate" value={`${kpis.bounceRatePct}%`} sub="Single-page" color="pink" />
        <KpiCard label="Conversions" value={data.conversionsToday.booking_completed ?? 0} sub="Bookings completed today" color="green" />
        <KpiCard label="JS Errors" value={kpis.jsErrors7d} sub="Last 7 days" color="red" />
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-3">Traffic Sources</h3>
          {data.trafficSources.length === 0 && <EmptyState message="No sessions recorded yet." />}
          {data.trafficSources.map(s => (
            <div key={s.source} className="flex items-center gap-3 mb-2">
              <span className="text-sm text-gray-700 w-28 flex-shrink-0 capitalize">{s.source}</span>
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
            { label: "Bookings Completed", key: "booking_completed" },
            { label: "Payments Completed", key: "payment_completed" },
            { label: "Subscriptions Started", key: "subscription_started" },
            { label: "Booking Started", key: "booking_started" },
          ].map(c => (
            <div key={c.key} className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-700">{c.label}</span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-900">{data.conversionsToday[c.key] ?? 0}</span>
                <Badge label={c.key} colorClass={EVENT_TYPE_COLORS[c.key] || ""} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface EventRow { id: string; event_type: string; name: string; url: string; anonymous_id: string; status: string; created_at: string }

function EventsTab() {
  const [typeFilter, setTypeFilter] = useState("all");
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    const qs = typeFilter === "all" ? "" : `?type=${typeFilter}`;
    fetchJson<{ events: EventRow[] }>(`/api/analytics/events${qs}`).then(d => { setEvents(d?.events ?? []); setLoading(false); });
  }, [typeFilter]);

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap items-center">
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="border rounded px-3 py-2 text-sm">
          <option value="all">All Event Types</option>
          {Object.keys(EVENT_TYPE_COLORS).map(t => <option key={t}>{t}</option>)}
        </select>
        <div className="ml-auto text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          Sensitive fields automatically masked · IP never stored
        </div>
      </div>
      {loading ? <EmptyState message="Loading…" /> : events.length === 0 ? (
        <EmptyState message="No events collected yet." />
      ) : (
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
              {events.map(e => (
                <tr key={e.id} className={`hover:bg-gray-50 ${e.event_type === "error" ? "bg-red-50" : ""}`}>
                  <td className="px-4 py-3"><Badge label={e.event_type} colorClass={EVENT_TYPE_COLORS[e.event_type] || ""} /></td>
                  <td className="px-4 py-3 font-medium">{e.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500 max-w-[180px] truncate">{e.url}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">{e.anonymous_id}</td>
                  <td className="px-4 py-3"><Badge label={e.status} colorClass={STATUS_COLORS[e.status] || ""} /></td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{new Date(e.created_at).toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface FunnelData {
  id: string; name: string; status: string; entryCount: number; completedCount: number; overallConvPct: number;
  steps: { name: string; count: number; convPct: number; dropPct: number }[];
}

function FunnelsTab() {
  const [funnels, setFunnels] = useState<FunnelData[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetchJson<{ funnels: FunnelData[] }>("/api/analytics/funnels").then(d => {
      setFunnels(d?.funnels ?? []); setSel(d?.funnels?.[0]?.id ?? null); setLoading(false);
    });
  }, []);

  if (loading) return <EmptyState message="Loading…" />;
  if (funnels.length === 0) return <EmptyState message="No funnels defined yet. Create one to start tracking conversion steps." />;
  const active = funnels.find(f => f.id === sel) ?? funnels[0];

  return (
    <div className="space-y-6">
      <div className="flex gap-3 flex-wrap">
        {funnels.map(f => (
          <button key={f.id} onClick={() => setSel(f.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${active.id === f.id ? "bg-amber-500 text-white border-amber-500" : "border-gray-200 text-gray-600 hover:border-amber-300"}`}>
            {f.name}
          </button>
        ))}
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        <KpiCard label="Entry Count" value={active.entryCount.toLocaleString()} sub="Sessions entered" color="blue" />
        <KpiCard label="Completed" value={active.completedCount.toLocaleString()} sub="Reached final step" color="green" />
        <KpiCard label="Overall Conv." value={`${active.overallConvPct}%`} sub="Entry → Complete" color="amber" />
      </div>
      <div className="bg-white border rounded-lg p-6">
        <h3 className="font-semibold text-gray-800 mb-4">{active.name} — Step by Step</h3>
        <div className="space-y-4">
          {active.steps.map((s, i) => (
            <div key={s.name}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                  <span className="text-sm font-medium">{s.name}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="font-bold">{s.count.toLocaleString()}</span>
                  {i > 0 && <span className="text-red-500 text-xs">−{s.dropPct}% drop</span>}
                  <span className="text-green-600 font-medium">{s.convPct}%</span>
                </div>
              </div>
              <div className="bg-gray-100 rounded-full h-3 overflow-hidden">
                <div className="bg-gradient-to-r from-amber-400 to-amber-500 h-3 rounded-full" style={{ width: `${Math.min(100, s.convPct)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface AttributionData {
  windowDays: number; totalConversions: number;
  byChannel: { channel: string; conversions: number; uniqueSessions: number; pct: number }[];
  byCampaign: { campaign: string; source: string; conversions: number }[];
  byEventType: Record<string, number>;
}

function AttributionTab() {
  const [data, setData] = useState<AttributionData | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    fetchJson<AttributionData>(`/api/analytics/attribution?days=${days}`).then(d => { setData(d); setLoading(false); });
  }, [days]);

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {[7, 30, 90].map(d => (
          <button key={d} onClick={() => setDays(d)}
            className={`text-xs px-3 py-1.5 border rounded hover:bg-gray-50 ${days === d ? "bg-blue-50 border-blue-300 text-blue-700" : ""}`}>Last {d} days</button>
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total Conversions" value={data?.totalConversions ?? 0} sub={`Last ${days} days`} color="green" />
        <KpiCard label="Bookings"      value={data?.byEventType.booking_completed ?? 0} color="blue" />
        <KpiCard label="Payments"      value={data?.byEventType.payment_completed ?? 0} color="purple" />
        <KpiCard label="Subscriptions" value={data?.byEventType.subscription_started ?? 0} color="teal" />
      </div>
      <div className="bg-white border rounded-lg p-4">
        <h3 className="font-semibold text-gray-800 mb-3">Conversions by Channel (last-touch)</h3>
        {loading ? <EmptyState message="Loading…" /> : !data?.byChannel.length ? (
          <EmptyState message="No conversions with linked sessions in this window yet." />
        ) : data.byChannel.map(c => (
          <div key={c.channel} className="flex items-center gap-3 text-sm mb-2">
            <span className="w-24 text-gray-600 capitalize">{c.channel}</span>
            <div className="flex-1 bg-gray-100 rounded-full h-2"><div className="bg-blue-500 h-2 rounded-full" style={{ width: `${c.pct}%` }} /></div>
            <span className="w-10 text-right font-medium">{c.pct}%</span>
            <span className="w-20 text-right text-xs text-gray-400">{c.conversions} conv.</span>
          </div>
        ))}
      </div>
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b"><h3 className="text-sm font-semibold">Top UTM Campaigns</h3></div>
        {!data?.byCampaign.length ? (
          <p className="p-6 text-sm text-gray-500 text-center">No UTM-tagged conversions yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b text-xs text-gray-500"><tr><th className="px-4 py-2 text-left">Campaign</th><th className="px-4 py-2 text-left">Source</th><th className="px-4 py-2 text-right">Conversions</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {data.byCampaign.map((c, i) => (
                <tr key={i}><td className="px-4 py-2">{c.campaign}</td><td className="px-4 py-2 text-gray-500">{c.source}</td><td className="px-4 py-2 text-right font-medium">{c.conversions}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

interface SessionRow { id: string; anon: string; device: string; browser: string; country: string; pages: number; durationLabel: string; source: string; replay: boolean }

function SessionsTab() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetchJson<{ sessions: SessionRow[] }>("/api/analytics/sessions").then(d => { setSessions(d?.sessions ?? []); setLoading(false); }); }, []);

  const DEVICE_ICONS: Record<string, string> = { desktop: "🖥️", mobile: "📱", tablet: "📟" };
  const SOURCE_COLORS: Record<string, string> = {
    search: "bg-blue-100 text-blue-700", social: "bg-pink-100 text-pink-700",
    direct: "bg-gray-100 text-gray-600", email: "bg-amber-100 text-amber-700", referral: "bg-purple-100 text-purple-700", paid: "bg-orange-100 text-orange-700",
  };
  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
        Sessions are anonymised. Session replay requires staff approval. No raw IP stored.
      </div>
      {loading ? <EmptyState message="Loading…" /> : sessions.length === 0 ? (
        <EmptyState message="No sessions recorded yet." />
      ) : (
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
              {sessions.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">{s.anon}</td>
                  <td className="px-4 py-3">{DEVICE_ICONS[s.device] || "?"} {s.device}</td>
                  <td className="px-4 py-3">{s.browser}</td>
                  <td className="px-4 py-3">{s.country}</td>
                  <td className="px-4 py-3">{s.pages}</td>
                  <td className="px-4 py-3">{s.durationLabel}</td>
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
      )}
    </div>
  );
}

interface CohortData {
  totals: { newUsers: number; returning: number; converted: number; churned: number };
  heatmap: { cohortWeek: string; points: { period: string; rate: number }[] }[];
}

function CohortsTab() {
  const [data, setData] = useState<CohortData | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetchJson<CohortData>("/api/analytics/cohorts").then(d => { setData(d); setLoading(false); }); }, []);

  function heat(pct: number) {
    if (pct >= 80) return "bg-green-600 text-white";
    if (pct >= 50) return "bg-green-400 text-white";
    if (pct >= 30) return "bg-amber-300 text-gray-900";
    if (pct >= 15) return "bg-orange-200 text-gray-900";
    return "bg-gray-100 text-gray-500";
  }
  if (loading) return <EmptyState message="Loading…" />;
  if (!data) return <EmptyState message="Cohort data is unavailable right now." />;
  const avgWk2 = data.heatmap.length
    ? Math.round(data.heatmap.reduce((sum, c) => sum + (c.points[0]?.rate ?? 0), 0) / data.heatmap.length)
    : 0;

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-4 gap-4">
        <KpiCard label="New Users" value={data.totals.newUsers.toLocaleString()} sub="Last 90 days" color="blue" />
        <KpiCard label="Returning" value={data.totals.returning.toLocaleString()} sub="Came back" color="green" />
        <KpiCard label="Converted" value={data.totals.converted.toLocaleString()} sub="Completed booking" color="amber" />
        <KpiCard label="Wk2 Retention" value={`${avgWk2}%`} sub="Avg" color="purple" />
      </div>
      <div className="bg-white border rounded-lg p-4">
        <h3 className="font-semibold text-gray-800 mb-4">Retention Heatmap</h3>
        {data.heatmap.length === 0 ? <EmptyState message="No retention data computed yet." /> : (
          <div className="overflow-x-auto">
            <table className="text-xs text-center">
              <thead><tr><th className="px-3 py-2 text-left text-gray-500">Cohort</th>
                {data.heatmap[0].points.map((_, i) => <th key={i} className="px-3 py-2 text-gray-500">Wk{i + 1}</th>)}
              </tr></thead>
              <tbody>
                {data.heatmap.map(row => (
                  <tr key={row.cohortWeek}>
                    <td className="px-3 py-2 text-left text-gray-600 font-medium">{row.cohortWeek}</td>
                    {row.points.map((p, j) => (
                      <td key={j} className={`px-3 py-2 rounded font-medium ${heat(p.rate)}`}>{p.rate}%</td>
                    ))}
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

interface ConsentData { distribution: { level: string; count: number; pct: number }[] }

function ConsentTab() {
  const [data, setData] = useState<ConsentData | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetchJson<ConsentData>("/api/analytics/consent").then(d => { setData(d); setLoading(false); }); }, []);

  if (loading) return <EmptyState message="Loading…" />;
  const dist = data?.distribution ?? [];

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-4 gap-4">
        {dist.length === 0 && <EmptyState message="No consent records yet." />}
        {dist.map(c => (
          <KpiCard key={c.level} label={`Level: ${c.level}`} value={`${c.pct}%`} sub={`${c.count.toLocaleString()} visitors`}
            color={c.level === "all" ? "green" : c.level === "analytics" ? "blue" : c.level === "essential" ? "amber" : "pink"} />
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-3">Consent Distribution</h3>
          {dist.map(c => (
            <div key={c.level} className="flex items-center gap-3 mb-2">
              <span className="text-sm text-gray-700 capitalize w-20">{c.level}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-3">
                <div className={`${CONSENT_COLORS[c.level] ?? "bg-gray-300"} h-3 rounded-full`} style={{ width: `${c.pct}%` }} />
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
    overview: <OverviewTab />, events: <EventsTab />, funnels: <FunnelsTab />, attribution: <AttributionTab />,
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
