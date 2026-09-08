"use client";
// UTM / Campaign Parameter Tracking -- real CRUD over utm_link
// (src/domain/marketing/db-schema.sql). Prior audit (module_registry
// module_key='utm-tracking', 2026-09-01) found the table had a real
// schema and a real reader (analytics/attribution route, plus
// AnalyticsAggregationJob's click_count SUM) but 0 rows and no admin UI:
// nothing had ever created a link. This is the first real read/write
// surface for it, plus a real public click-tracking hop at /utm/[id]
// (see src/app/utm/[id]/route.ts) that increments click_count -- so the
// column analytics already summed stops being a permanent zero.

import { useEffect, useState } from "react";

interface Link {
  id: string;
  briefId: string | null;
  briefName: string | null;
  baseUrl: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string | null;
  utmTerm: string | null;
  fullUrl: string;
  trackingUrl: string;
  clickCount: number;
  botClickCount: number;
  leadsCount: number;
  convertedCount: number;
  createdBy: string;
  createdAt: string;
}

interface Brief { id: string; name: string }
interface LandingPage { id: string; slug: string; title: string; url: string }

const emptyForm = {
  destinationMode: "landing" as "landing" | "custom",
  landingPageId: "",
  baseUrl: "",
  utmSource: "",
  utmMedium: "",
  utmCampaign: "",
  utmContent: "",
  utmTerm: "",
  briefId: "",
};

export default function UtmTrackingPage() {
  const [links, setLinks] = useState<Link[]>([]);
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [landingPages, setLandingPages] = useState<LandingPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ fullUrl: string; trackingUrl: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => { setOrigin(window.location.origin); }, []);

  function load() {
    setLoading(true);
    fetch("/api/admin/utm-tracking", { cache: "no-store" })
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Failed to load UTM links.");
        setLinks(d.links);
        setBriefs(d.briefs);
        setLandingPages(d.landingPages);
        setError("");
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  function openCreate() {
    setForm(emptyForm);
    setCreated(null);
    setShowForm(true);
  }

  async function save() {
    if (!form.utmSource.trim() || !form.utmMedium.trim() || !form.utmCampaign.trim()) {
      setError("Source, medium, and campaign are required.");
      return;
    }
    if (form.destinationMode === "landing" && !form.landingPageId) {
      setError("Pick a landing page, or switch to a custom path.");
      return;
    }
    if (form.destinationMode === "custom" && !form.baseUrl.trim()) {
      setError("Enter a path (must start with /).");
      return;
    }
    setSaving(true);
    setError("");
    const payload = {
      landingPageId: form.destinationMode === "landing" ? form.landingPageId : undefined,
      baseUrl: form.destinationMode === "custom" ? form.baseUrl.trim() : undefined,
      utmSource: form.utmSource.trim(),
      utmMedium: form.utmMedium.trim(),
      utmCampaign: form.utmCampaign.trim(),
      utmContent: form.utmContent.trim() || null,
      utmTerm: form.utmTerm.trim() || null,
      briefId: form.briefId || null,
    };
    try {
      const res = await fetch("/api/admin/utm-tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Save failed.");
      setCreated({ fullUrl: d.fullUrl, trackingUrl: d.trackingUrl });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this UTM link? Any copies of it already shared will stop resolving.")) return;
    const res = await fetch(`/api/admin/utm-tracking/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  function copy(text: string, id: string) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(prev => (prev === id ? null : prev)), 1500);
    });
  }

  const totalClicks = links.reduce((s, l) => s + l.clickCount, 0);
  const totalLeads = links.reduce((s, l) => s + l.leadsCount, 0);
  const totalConverted = links.reduce((s, l) => s + l.convertedCount, 0);

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold">UTM / Campaign Parameter Tracking</h1>
            <p className="text-gray-400 text-sm mt-0.5">
              Build UTM-tagged links for any landing page or portal path, and see real click → lead → conversion counts per link.
            </p>
          </div>
          <button onClick={openCreate}
            className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors">
            + New UTM Link
          </button>
        </div>

        {error && <div className="rounded-xl border border-red-800 bg-red-950/50 p-3 text-sm text-red-300">{error}</div>}

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-900 rounded-2xl p-4">
            <p className="text-xs text-gray-500">Total links</p>
            <p className="text-2xl font-semibold mt-1">{links.length}</p>
          </div>
          <div className="bg-gray-900 rounded-2xl p-4">
            <p className="text-xs text-gray-500">Total clicks (via /utm/[id] redirect)</p>
            <p className="text-2xl font-semibold mt-1">{totalClicks}</p>
          </div>
          <div className="bg-gray-900 rounded-2xl p-4">
            <p className="text-xs text-gray-500">Leads / converted (campaign_lead join)</p>
            <p className="text-2xl font-semibold mt-1">{totalLeads} / {totalConverted}</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500 text-sm">Loading…</div>
        ) : links.length === 0 ? (
          <div className="text-center py-12 text-gray-500 text-sm border border-dashed border-gray-800 rounded-2xl space-y-2">
            <p>No UTM links yet. This table (utm_link) exists with a real schema but has never been populated -- create the first tagged link to get started.</p>
            <p className="text-xs text-gray-600">Clicks are counted only for links generated here and shared as their /utm/[id] tracking URL -- pasting the raw tagged URL directly skips the click counter (but still carries utm_ params to Matomo/PostHog on the landing page itself).</p>
          </div>
        ) : (
          <div className="space-y-2">
            {links.map(l => (
              <div key={l.id} className="bg-gray-900 rounded-2xl p-4 space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded-full text-xs bg-blue-900 text-blue-300">{l.utmSource}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs bg-purple-900 text-purple-300">{l.utmMedium}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs bg-gray-800 text-gray-300">{l.utmCampaign}</span>
                      {l.utmContent && <span className="px-2 py-0.5 rounded-full text-xs bg-gray-800 text-gray-500">content: {l.utmContent}</span>}
                      {l.utmTerm && <span className="px-2 py-0.5 rounded-full text-xs bg-gray-800 text-gray-500">term: {l.utmTerm}</span>}
                      {l.briefName && <span className="px-2 py-0.5 rounded-full text-xs bg-green-900 text-green-300">campaign: {l.briefName}</span>}
                    </div>
                    <p className="text-sm text-gray-400 mt-1 truncate">{l.baseUrl}</p>
                  </div>
                  <button onClick={() => remove(l.id)} className="px-3 py-1.5 bg-gray-800 hover:bg-red-900 rounded-lg text-xs transition-colors shrink-0">Delete</button>
                </div>

                <div className="grid grid-cols-4 gap-3 text-sm">
                  <div><span className="text-gray-500">Clicks:</span> <span className="font-semibold">{l.clickCount}</span></div>
                  <div title="UA-matched bots/crawlers/preview-fetchers -- redirected but not counted as real clicks"><span className="text-gray-500">Bot hits:</span> <span className="font-semibold text-amber-500">{l.botClickCount}</span></div>
                  <div><span className="text-gray-500">Leads:</span> <span className="font-semibold">{l.leadsCount}</span></div>
                  <div><span className="text-gray-500">Converted:</span> <span className="font-semibold">{l.convertedCount}</span></div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <code className="flex-1 min-w-0 truncate bg-gray-950 border border-gray-800 rounded-lg px-2 py-1.5 text-xs text-gray-300">{origin}{l.trackingUrl}</code>
                    <button onClick={() => copy(`${origin}${l.trackingUrl}`, `t-${l.id}`)}
                      className="px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs shrink-0">
                      {copiedId === `t-${l.id}` ? "Copied" : "Copy tracked link"}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 min-w-0 truncate bg-gray-950 border border-gray-800 rounded-lg px-2 py-1.5 text-xs text-gray-500">{origin}{l.fullUrl}</code>
                    <button onClick={() => copy(`${origin}${l.fullUrl}`, `f-${l.id}`)}
                      className="px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs shrink-0">
                      {copiedId === `f-${l.id}` ? "Copied" : "Copy raw tagged URL"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {showForm && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={() => setShowForm(false)}>
            <div className="bg-gray-900 rounded-2xl p-6 max-w-lg w-full space-y-3 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <h2 className="font-semibold text-lg">New UTM Link</h2>

              {created ? (
                <div className="space-y-3">
                  <p className="text-sm text-green-400">Link created.</p>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Tracked link (counts clicks) -- share this one</label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 min-w-0 truncate bg-gray-950 border border-gray-800 rounded-lg px-2 py-1.5 text-xs text-gray-300">{origin}{created.trackingUrl}</code>
                      <button onClick={() => copy(`${origin}${created.trackingUrl}`, "new-t")} className="px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs shrink-0">
                        {copiedId === "new-t" ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Raw tagged URL (no click counting)</label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 min-w-0 truncate bg-gray-950 border border-gray-800 rounded-lg px-2 py-1.5 text-xs text-gray-500">{origin}{created.fullUrl}</code>
                      <button onClick={() => copy(`${origin}${created.fullUrl}`, "new-f")} className="px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs shrink-0">
                        {copiedId === "new-f" ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm transition-colors">Close</button>
                    <button onClick={openCreate} className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-xl text-sm font-medium transition-colors">Create Another</button>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Destination</label>
                    <div className="flex gap-2 mb-2">
                      <button onClick={() => setForm(f => ({ ...f, destinationMode: "landing" }))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium ${form.destinationMode === "landing" ? "bg-green-700 text-white" : "bg-gray-800 text-gray-300"}`}>
                        Existing landing page
                      </button>
                      <button onClick={() => setForm(f => ({ ...f, destinationMode: "custom" }))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium ${form.destinationMode === "custom" ? "bg-green-700 text-white" : "bg-gray-800 text-gray-300"}`}>
                        Custom path
                      </button>
                    </div>
                    {form.destinationMode === "landing" ? (
                      <>
                        <select value={form.landingPageId} onChange={e => setForm(f => ({ ...f, landingPageId: e.target.value }))}
                          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm">
                          <option value="">— select a landing page —</option>
                          {landingPages.map(p => <option key={p.id} value={p.id}>{p.title} ({p.url})</option>)}
                        </select>
                        {landingPages.length === 0 && <p className="text-xs text-gray-500 mt-1">No landing pages exist yet -- use a custom path instead.</p>}
                      </>
                    ) : (
                      <input value={form.baseUrl} onChange={e => setForm(f => ({ ...f, baseUrl: e.target.value }))}
                        placeholder="/services/private-classes"
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 text-sm" />
                    )}
                    <p className="text-xs text-gray-600 mt-1">Portal-owned paths only -- links to external domains are not supported.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <input value={form.utmSource} onChange={e => setForm(f => ({ ...f, utmSource: e.target.value }))}
                      placeholder="utm_source (e.g. instagram)"
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 text-sm" />
                    <input value={form.utmMedium} onChange={e => setForm(f => ({ ...f, utmMedium: e.target.value }))}
                      placeholder="utm_medium (e.g. social)"
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 text-sm" />
                  </div>
                  <input value={form.utmCampaign} onChange={e => setForm(f => ({ ...f, utmCampaign: e.target.value }))}
                    placeholder="utm_campaign (e.g. spring_2026)"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 text-sm" />
                  <div className="grid grid-cols-2 gap-3">
                    <input value={form.utmContent} onChange={e => setForm(f => ({ ...f, utmContent: e.target.value }))}
                      placeholder="utm_content (optional, A/B variant)"
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 text-sm" />
                    <input value={form.utmTerm} onChange={e => setForm(f => ({ ...f, utmTerm: e.target.value }))}
                      placeholder="utm_term (optional)"
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 text-sm" />
                  </div>

                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Campaign brief (optional)</label>
                    <select value={form.briefId} onChange={e => setForm(f => ({ ...f, briefId: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm">
                      <option value="">— none —</option>
                      {briefs.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                    {briefs.length === 0 && <p className="text-xs text-gray-500 mt-1">No campaign briefs exist yet.</p>}
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm transition-colors">Cancel</button>
                    <button onClick={save} disabled={saving}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors">
                      {saving ? "Creating…" : "Create Link"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
