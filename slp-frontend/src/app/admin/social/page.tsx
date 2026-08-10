"use client";
// Social Media Portal — provider config health, campaign queue, approvals, platform matrix,
// automation tier ladder, Quora queue.
//
// Provider status and campaign queue are fetched live from /api/social/setup and
// /api/marketing/automation — no synthetic accounts or publications are shown.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PLATFORM_CONFIG } from "@/domain/social/SocialAccount";

const PLATFORM_ICONS: Record<string, string> = {
  facebook: "f", instagram: "ig", linkedin: "in", x_twitter: "X",
  threads: "Th", tiktok: "Tk", youtube: "YT", reddit: "Re",
  pinterest: "Pi", bluesky: "Bk", mastodon: "Ma", discord: "Di",
  slack: "Sl", telegram: "Tg", whatsapp_business: "WA", google_business: "GB",
  quora_manual: "Qu",
};

// postiz_provider_status.provider_name (display case) → SocialPlatform key
const PROVIDER_TO_PLATFORM: Record<string, string> = {
  telegram: "telegram", discord: "discord", bluesky: "bluesky", reddit: "reddit",
  youtube: "youtube", facebook: "facebook", instagram: "instagram", threads: "threads",
  linkedin: "linkedin", x: "x_twitter", tiktok: "tiktok", pinterest: "pinterest",
  mastodon: "mastodon",
};

const QUEUE_STATUS_COLORS: Record<string, string> = {
  queued:          "bg-gray-100 text-gray-600",
  generating:      "bg-blue-100 text-blue-700",
  review_required: "bg-amber-100 text-amber-700",
  scheduled:       "bg-indigo-100 text-indigo-700",
  published:       "bg-green-100 text-green-700",
  failed:          "bg-red-100 text-red-700",
};

const CONNECTOR_BADGE: Record<string, { label: string; color: string }> = {
  postiz:           { label: "Postiz",   color: "bg-indigo-100 text-indigo-700" },
  custom_connector: { label: "Custom",   color: "bg-amber-100 text-amber-700" },
  manual_only:      { label: "Manual",   color: "bg-gray-100 text-gray-600" },
};

type ProviderRow = {
  provider_name: string; is_configured: boolean; review_required: boolean;
  missing_vars: string[]; checked_at: string;
};
type QueueRow = {
  id: string; title: string; industry: string; status: string; progress_percent: number;
  current_stage: string; channels: string[]; asset_types: string[]; scheduled_at?: string;
  asset_count: number;
};
type ManualQueueRow = { id: string; question: string; draft: string; status: string };
const QUORA_QUEUE: ManualQueueRow[] = [];

const MCP_TOOLS = [
  { name: "list_social_accounts",  tier: "auto",              risk: 1, description: "Reads connected account list from Postiz. Read-only." },
  { name: "create_content_draft",  tier: "auto",              risk: 1, description: "Creates a draft post/caption. Cannot publish." },
  { name: "adapt_content",         tier: "auto",              risk: 1, description: "Rewrites and resizes content to fit per-platform limits." },
  { name: "upload_media",          tier: "staff",             risk: 2, description: "Uploads an image or video asset to the Postiz media library." },
  { name: "preview_post",          tier: "auto",              risk: 1, description: "Renders how a post will look without publishing it." },
  { name: "request_approval",      tier: "staff",             risk: 2, description: "Marks a draft as ready for admin review." },
  { name: "schedule_post",         tier: "staff_approval",    risk: 3, description: "Schedules a reviewed post for future publish. Requires prior admin approval on the draft." },
  { name: "publish_post",          tier: "admin",             risk: 4, description: "Publishes immediately. Admin-only, fully logged." },
  { name: "get_post_status",       tier: "auto",              risk: 1, description: "Reads delivery/error status for a scheduled or published post." },
  { name: "retry_failed_post",     tier: "staff",             risk: 3, description: "Re-attempts a failed publish after the error has been investigated." },
  { name: "read_analytics",        tier: "auto",              risk: 1, description: "Reads engagement metrics. Read-only." },
  { name: "read_comments",         tier: "auto",              risk: 1, description: "Reads comments and mentions. Read-only." },
  { name: "draft_reply",           tier: "auto",              risk: 1, description: "Drafts a reply to a comment. A human posts it manually." },
  { name: "pause_campaign",        tier: "admin",             risk: 4, description: "Halts all remaining scheduled posts in a campaign." },
  { name: "disconnect_account",    tier: "admin_destructive", risk: 5, description: "Revokes an OAuth connection. Irreversible without re-authenticating." },
];

const TIER_COLORS: Record<string, string> = {
  auto:             "bg-green-100 text-green-700",
  staff:            "bg-blue-100 text-blue-700",
  staff_approval:   "bg-amber-100 text-amber-700",
  admin:            "bg-orange-100 text-orange-700",
  admin_destructive:"bg-red-100 text-red-700",
};

const AUTOMATION_LADDER = [
  { tier: "auto",              label: "Automatic",        requires: "No human step",        description: "Read-only or draft-only actions. Runs unattended on the 2-minute Ollama cron cycle." },
  { tier: "staff",              label: "Staff",            requires: "Any staff account",     description: "Prepares content for review — uploading media, requesting approval, retrying a known failure." },
  { tier: "staff_approval",     label: "Staff + approval",  requires: "Prior admin approval on the draft", description: "Commits to a schedule. Cannot run until the linked draft has passed review." },
  { tier: "admin",              label: "Admin",            requires: "Admin role",            description: "Irreversible-in-effect actions visible to the public — publishing, pausing a live campaign." },
  { tier: "admin_destructive",  label: "Admin — destructive", requires: "Admin role, logged",  description: "Revokes access. No automated path re-enables it." },
];

export default function SocialPortalPage() {
  const [tab, setTab] = useState<"overview" | "accounts" | "queue" | "platforms" | "approvals" | "automation">("overview");
  const [tenantId, setTenantId] = useState("");
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [message, setMessage] = useState("Enter a tenant UUID and load the campaign queue.");
  const [busy, setBusy] = useState(false);

  const loadProviders = useCallback(async () => {
    try {
      const res = await fetch("/api/social/setup", { cache: "no-store" });
      const data = await res.json();
      setProviders(data.providers || []);
    } catch { /* provider panel just shows "not connected" on failure */ }
  }, []);

  useEffect(() => {
    setTenantId(localStorage.getItem("marketingTenantId") || "");
    loadProviders();
  }, [loadProviders]);

  const loadQueue = useCallback(async () => {
    if (!tenantId) return;
    setBusy(true);
    localStorage.setItem("marketingTenantId", tenantId);
    try {
      const res = await fetch(`/api/marketing/automation?tenantId=${encodeURIComponent(tenantId)}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to load campaign queue");
      setQueue(data.requests || []);
      setMessage(`Campaign queue loaded — ${data.requests?.length ?? 0} requests.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Load failed");
    } finally { setBusy(false); }
  }, [tenantId]);

  const configuredCount = providers.filter(p => p.is_configured).length;
  const totalProviders = providers.length || 13;
  const pending = useMemo(() => queue.filter(q => q.status === "review_required"), [queue]);
  const inProgress = queue.filter(q => q.status === "queued" || q.status === "generating").length;
  const published = queue.filter(q => q.status === "published").length;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Social Media Portal</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Postiz publishing runtime — {configuredCount}/{totalProviders} providers configured
          </p>
        </div>
        <div className="flex gap-3 items-center">
          {pending.length > 0 && (
            <span className="bg-red-100 text-red-700 text-sm font-medium px-3 py-1.5 rounded-full animate-pulse">
              {pending.length} pending approval
            </span>
          )}
          <Link href="/admin/social/compose"
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
            + Create Content
          </Link>
        </div>
      </div>

      {/* Tenant + queue loader */}
      <div className="flex flex-col gap-2 rounded-lg border bg-white p-4 sm:flex-row mb-6">
        <input value={tenantId} onChange={e => setTenantId(e.target.value)} placeholder="Tenant UUID"
          className="flex-1 rounded-lg border px-3 py-2 text-sm" />
        <button disabled={!tenantId || busy} onClick={loadQueue}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white disabled:opacity-40">
          Load campaign queue
        </button>
        <span className="self-center text-xs text-gray-500">{message}</span>
      </div>

      <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        No synthetic connection or publication data is shown. Connect and verify accounts in{" "}
        <a href="http://127.0.0.1:15080" target="_blank" rel="noreferrer" className="font-medium underline">Postiz</a>,
        {" "}issue developer-app credentials in the <Link href="/admin/social/setup" className="font-medium underline">Developer App Setup</Link>,
        {" "}or use the <Link href="/admin/social/meta-setup" className="font-medium underline">Meta setup assistant</Link>.
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 border-b mb-6 flex-wrap">
        {(["overview","accounts","queue","platforms","approvals","automation"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-800"
            }`}>
            {t}{t === "approvals" && pending.length > 0 ? ` (${pending.length})` : ""}
          </button>
        ))}
      </div>

      {/* ─── Overview ───────────────────────────────────────────────────────── */}
      {tab === "overview" && (
        <div className="space-y-6">
          {/* KPI row */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Providers Configured", value: `${configuredCount}/${totalProviders}`, color: "text-green-600" },
              { label: "Campaigns In Progress", value: inProgress,                            color: "text-indigo-600" },
              { label: "Pending Approvals",     value: pending.length,                          color: "text-amber-600" },
              { label: "Published",             value: published,                               color: "text-blue-600" },
            ].map(k => (
              <div key={k.label} className="bg-white border rounded-lg p-4">
                <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
                <div className="text-sm text-gray-500">{k.label}</div>
              </div>
            ))}
          </div>

          {/* Architecture */}
          <div className="bg-white border rounded-lg p-5">
            <h2 className="font-semibold text-gray-800 mb-3">Architecture</h2>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="bg-indigo-50 rounded p-3">
                <div className="font-medium text-indigo-800 mb-1">Scheduling Layer</div>
                <div className="text-indigo-700 text-xs space-y-0.5">
                  <div>Postiz — 13 platforms via OAuth</div>
                  <div>OpenBao — protected app credentials</div>
                </div>
              </div>
              <div className="bg-amber-50 rounded p-3">
                <div className="font-medium text-amber-800 mb-1">Custom Connectors</div>
                <div className="text-amber-700 text-xs space-y-0.5">
                  <div>Telegram Bot API</div>
                  <div>WhatsApp Business API</div>
                  <div>Google Business Profile API</div>
                </div>
              </div>
              <div className="bg-gray-50 rounded p-3">
                <div className="font-medium text-gray-700 mb-1">Manual Queue</div>
                <div className="text-gray-600 text-xs space-y-0.5">
                  <div>Quora — AI draft only</div>
                  <div>Human reviews + posts</div>
                  <div>No automated scraping</div>
                </div>
              </div>
            </div>
          </div>

          {/* MCP Tools panel */}
          <div className="bg-white border rounded-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-800">MCP Tools (15 total)</h2>
              <button onClick={() => setTab("automation")} className="text-xs text-indigo-600 hover:underline">
                View full automation ladder →
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {MCP_TOOLS.map(t => (
                <div key={t.name} className="flex items-center gap-2">
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${TIER_COLORS[t.tier]}`}>
                    {t.tier === "admin_destructive" ? "destruct" : t.tier.replace("_", " ")}
                  </span>
                  <span className="font-mono text-xs text-gray-700 truncate">{t.name}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-amber-700 bg-amber-50 rounded p-2 mt-3">
              <strong>No autonomous publishing.</strong> schedule_post, publish_post, pause_campaign, and disconnect_account require human approval. draft_reply creates a draft only — human posts manually.
            </p>
          </div>
        </div>
      )}

      {/* ─── Accounts ───────────────────────────────────────────────────────── */}
      {tab === "accounts" && (
        <div className="space-y-3">
          {providers.map(p => {
            const platformKey = PROVIDER_TO_PLATFORM[p.provider_name.toLowerCase()] || p.provider_name.toLowerCase();
            const cfg = PLATFORM_CONFIG[platformKey as keyof typeof PLATFORM_CONFIG];
            return (
              <div key={p.provider_name} className="bg-white border rounded-lg p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-700 text-sm flex-shrink-0">
                  {PLATFORM_ICONS[platformKey] ?? p.provider_name.slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900">{cfg?.displayName ?? p.provider_name}</div>
                  <div className="text-sm text-gray-500">
                    {p.is_configured ? "Developer app credentials set" : "Not configured"}
                    {p.review_required && !p.is_configured ? " · needs Meta app review" : ""}
                    {!p.is_configured && p.missing_vars.length > 0 ? ` · missing: ${p.missing_vars.join(", ")}` : ""}
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${
                  p.is_configured ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                }`}>
                  {p.is_configured ? "configured" : "not connected"}
                </span>
              </div>
            );
          })}
          {providers.length === 0 && (
            <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-600">
              No provider status recorded yet. Complete{" "}
              <Link href="/admin/social/setup" className="text-indigo-700 underline">Developer App Setup</Link>
              {" "}or wait for the next postiz-provider-health cron pass.
            </div>
          )}
          <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center text-gray-500 hover:border-indigo-300 transition-colors">
            <a href="http://127.0.0.1:15080" target="_blank" rel="noreferrer" className="text-indigo-700 underline">Connect an account in Postiz</a>
            {" "}once its developer app is configured above.
          </div>
        </div>
      )}

      {/* ─── Queue ──────────────────────────────────────────────────────────── */}
      {tab === "queue" && (
        <div className="space-y-4">
          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr className="text-left text-xs text-gray-500">
                  <th className="p-3">Campaign</th><th>Assets</th><th>Channels</th><th>Stage</th><th>Progress</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {queue.map(r => (
                  <tr key={r.id} className="border-b">
                    <td className="p-3 font-medium">{r.title}<div className="text-xs text-gray-400">{r.industry}</div></td>
                    <td>{r.asset_types?.join(", ")}</td>
                    <td>
                      <div className="flex gap-1 flex-wrap">
                        {r.channels?.map(c => (
                          <span key={c} className="text-xs bg-gray-50 border rounded px-1.5 py-0.5 text-gray-600">{PLATFORM_ICONS[c] ?? c}</span>
                        ))}
                      </div>
                    </td>
                    <td className="text-xs">{r.current_stage}</td>
                    <td className="text-xs">{r.progress_percent}%</td>
                    <td>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${QUEUE_STATUS_COLORS[r.status] ?? "bg-gray-100"}`}>
                        {r.status.replace(/_/g, " ")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {queue.length === 0 && (
              <p className="p-6 text-sm text-gray-500 text-center">
                {tenantId ? "No campaigns for this tenant yet." : "Load a tenant's campaign queue above."}
              </p>
            )}
          </div>

          {/* Quora manual queue */}
          <div className="bg-white border border-gray-200 rounded-lg p-5 mt-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center font-bold text-red-700 text-sm">Qu</span>
              <div>
                <h3 className="font-semibold text-gray-800 text-sm">Quora — Manual Publishing Queue</h3>
                <p className="text-xs text-gray-500">AI drafts answers. Human reviews and posts manually. No automated API.</p>
              </div>
            </div>
            <div className="space-y-3">
              {QUORA_QUEUE.map(q => (
                <div key={q.id} className="bg-gray-50 rounded p-3">
                  <div className="text-sm font-medium text-gray-800 mb-1">{q.question}</div>
                  <div className="text-xs text-gray-600 line-clamp-2 mb-2">{q.draft}</div>
                </div>
              ))}
              {QUORA_QUEUE.length === 0 && <div className="text-sm text-gray-500">No manual drafts. This queue has no backing job yet.</div>}
            </div>
          </div>
        </div>
      )}

      {/* ─── Platforms ──────────────────────────────────────────────────────── */}
      {tab === "platforms" && (
        <div className="space-y-3">
          <div className="text-sm text-gray-500 mb-2">Platform coverage: 13 via Postiz · 3 custom connectors · 1 manual-only</div>
          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Platform</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Connector</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-700">Configured</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">Max chars</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-700">Scheduling</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {Object.values(PLATFORM_CONFIG).map(cfg => {
                  const badge = CONNECTOR_BADGE[cfg.postizSupport];
                  const providerRow = providers.find(p => (PROVIDER_TO_PLATFORM[p.provider_name.toLowerCase()] || p.provider_name.toLowerCase()) === cfg.platform);
                  return (
                    <tr key={cfg.platform} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900 flex items-center gap-2">
                        <span className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold flex-shrink-0">
                          {PLATFORM_ICONS[cfg.platform]}
                        </span>
                        {cfg.displayName}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.color}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {providerRow ? (
                          <span className={providerRow.is_configured ? "text-green-600" : "text-gray-400"}>
                            {providerRow.is_configured ? "✓" : "—"}
                          </span>
                        ) : <span className="text-gray-300">n/a</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 font-mono text-xs">
                        {cfg.maxCharacters ? cfg.maxCharacters.toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={cfg.supportsScheduling ? "text-green-600" : "text-gray-400"}>
                          {cfg.supportsScheduling ? "✓" : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">{cfg.notes}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
            <strong>Quora policy:</strong> Unofficial Quora APIs are fragile and may violate platform rules.
            AI drafts answers → human reviews → human posts manually. No automated publishing for Quora.
          </div>
        </div>
      )}

      {/* ─── Approvals ──────────────────────────────────────────────────────── */}
      {tab === "approvals" && (
        <div className="space-y-3">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            Showing generation requests with status <code>review_required</code>. In-app approve/reject actions are not
            wired yet — this list is read-only until that workflow ships.
          </div>
          {pending.map(r => (
            <div key={r.id} className="bg-white border border-amber-200 rounded-lg p-4">
              <div className="font-medium text-gray-900 mb-1">{r.title}</div>
              <div className="text-sm text-gray-500 mb-1">
                {r.scheduled_at ? `Scheduled for: ${r.scheduled_at} · ` : ""}Channels: {r.channels.map(c => PLATFORM_ICONS[c] ?? c).join(", ")}
              </div>
              <div className="text-xs text-gray-400">{r.asset_count} asset(s) generated · {r.industry}</div>
            </div>
          ))}
          {pending.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              {tenantId ? "No campaigns pending approval." : "Load a tenant's campaign queue to see pending approvals."}
            </div>
          )}
        </div>
      )}

      {/* ─── Automation ─────────────────────────────────────────────────────── */}
      {tab === "automation" && (
        <div className="space-y-6">
          <div className="bg-white border rounded-lg p-5">
            <h2 className="font-semibold text-gray-800 mb-1">Automation tier ladder</h2>
            <p className="text-xs text-gray-500 mb-4">Every MCP tool call is gated by risk level — higher tiers require a named human actor before they run.</p>
            <div className="space-y-2">
              {AUTOMATION_LADDER.map((step, i) => (
                <div key={step.tier} className="flex items-start gap-3 border rounded-lg p-3">
                  <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIER_COLORS[step.tier]}`}>{step.label}</span>
                      <span className="text-xs text-gray-400">requires: {step.requires}</span>
                    </div>
                    <p className="text-sm text-gray-700 mt-1">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr className="text-left text-xs text-gray-500">
                  <th className="px-4 py-3">Tool</th><th className="px-4 py-3">Tier</th><th className="px-4 py-3">Risk</th><th className="px-4 py-3">What it does</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {MCP_TOOLS.map(t => (
                  <tr key={t.name}>
                    <td className="px-4 py-3 font-mono text-xs text-gray-800">{t.name}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIER_COLORS[t.tier]}`}>
                        {t.tier === "admin_destructive" ? "destruct" : t.tier.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{"●".repeat(t.risk)}{"○".repeat(5 - t.risk)}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{t.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 text-sm text-indigo-900">
            <strong>Ollama generation pipeline:</strong> campaign briefs are queued from{" "}
            <Link href="/admin/marketing-command" className="underline font-medium">Marketing Automation</Link>,
            claimed by the <code>marketing-automation</code> cron job every 2 minutes, generated locally by
            Ollama (no cloud tokens), and land here as <code>review_required</code> once assets are written.
          </div>
        </div>
      )}
    </div>
  );
}
