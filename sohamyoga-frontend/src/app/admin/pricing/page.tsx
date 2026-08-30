"use client";

import { useEffect, useState } from "react";

// ─── Types (mirror the real API response shapes) ──────────────────────────────
type PlanType = "silver" | "gold" | "platinum" | "family" | "corporate" | "kids" | "senior" | "retreat" | "workshop" | "personal_training" | "trial" | "drop_in";
type PlanStatus = "draft" | "active" | "deprecated" | "archived";
type BillingCycle = "daily" | "weekly" | "monthly" | "quarterly" | "annual" | "one_time";
type SubStatus = "trial" | "active" | "paused" | "frozen" | "grace_period" | "expired" | "cancelled";
type BundleType = "class_pack" | "unlimited_monthly" | "unlimited_yearly" | "hybrid" | "retreat" | "workshop" | "teacher_training" | "corporate" | "family" | "kids" | "senior" | "gift" | "custom";
type BundleStatus = "draft" | "active" | "suspended" | "archived";

interface PlanPriceRow { id: string; amount: number; currency: string; billingCycle: BillingCycle }
interface PlanRow {
  id: string; name: string; slug: string; type: PlanType; description: string; status: PlanStatus;
  gracePeriodDays: number; prices: PlanPriceRow[]; activeSubscriptions: number; mrr: number;
  isGiftable: boolean; isTransferable: boolean;
}
interface SubRow {
  id: string; customerId: string; planId: string; planName: string; planType: PlanType; status: SubStatus;
  billingCycle: BillingCycle; billingAmount: number; currency: string; expiresAt: string; autoRenew: boolean;
  prorationCredit: number;
}
interface BundleItemRow { id: string; type: string; name: string; quantity: number }
interface BundleRow {
  id: string; name: string; type: BundleType; status: BundleStatus; basePrice: number; discountedPrice: number;
  currency: string; expiryDays: number; items: BundleItemRow[]; sold: number; activeOwnerships: number; revenue: number;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

function EmptyState({ message }: { message: string }) {
  return <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-500 text-sm">{message}</div>;
}

const SUB_STATUS_STYLE: Record<SubStatus, string> = {
  trial: "bg-blue-100 text-blue-700", active: "bg-green-100 text-green-800", paused: "bg-orange-100 text-orange-700",
  frozen: "bg-cyan-100 text-cyan-700", grace_period: "bg-yellow-100 text-yellow-800",
  expired: "bg-gray-200 text-gray-500", cancelled: "bg-red-100 text-red-700",
};

const PLAN_TYPES: PlanType[] = ["silver", "gold", "platinum", "family", "corporate", "kids", "senior", "retreat", "workshop", "personal_training", "trial", "drop_in"];
const BUNDLE_TYPES: BundleType[] = ["class_pack", "unlimited_monthly", "unlimited_yearly", "hybrid", "retreat", "workshop", "teacher_training", "corporate", "family", "kids", "senior", "gift", "custom"];

// ─── Plan creation modal ────────────────────────────────────────────────────────
function PlanFormModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<PlanType>("silver");
  const [description, setDescription] = useState("");
  const [monthly, setMonthly] = useState("");
  const [annual, setAnnual] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setError("");
    const monthlyAmt = Number(monthly);
    if (!name.trim()) return setError("Plan name is required.");
    if (!Number.isFinite(monthlyAmt) || monthlyAmt < 0) return setError("Enter a valid monthly price.");
    const prices = [{ amount: monthlyAmt, currency: "CAD", billingCycle: "monthly" as BillingCycle }];
    if (annual.trim()) {
      const a = Number(annual);
      if (!Number.isFinite(a) || a < 0) return setError("Enter a valid annual price.");
      prices.push({ amount: a, currency: "CAD", billingCycle: "annual" as BillingCycle });
    }
    setSaving(true);
    const res = await fetch("/api/pricing/plans", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type, description, prices }),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error ?? "Failed to create plan."); return; }
    onCreated();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-900">New Plan</h2>
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
        <div className="grid gap-3">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Plan name (e.g. Bronze)" className="border rounded-lg px-3 py-2 text-sm" />
          <select value={type} onChange={e => setType(e.target.value as PlanType)} className="border rounded-lg px-3 py-2 text-sm">
            {PLAN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input value={monthly} onChange={e => setMonthly(e.target.value)} placeholder="Monthly price (CAD)" type="number" min="0" step="0.01" className="border rounded-lg px-3 py-2 text-sm" />
            <input value={annual} onChange={e => setAnnual(e.target.value)} placeholder="Annual price (CAD, optional)" type="number" min="0" step="0.01" className="border rounded-lg px-3 py-2 text-sm" />
          </div>
          <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description" rows={3} className="border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Saving…" : "Create draft plan"}
          </button>
        </div>
        <p className="text-xs text-gray-400">New plans start as <code>draft</code> — activate from the Plans tab once ready.</p>
      </div>
    </div>
  );
}

// ─── Bundle creation modal ───────────────────────────────────────────────────────
function BundleFormModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<BundleType>("class_pack");
  const [basePrice, setBasePrice] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemQty, setItemQty] = useState("10");
  const [expiryDays, setExpiryDays] = useState("90");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setError("");
    const price = Number(basePrice);
    const qty = Number(itemQty);
    if (!name.trim()) return setError("Bundle name is required.");
    if (!Number.isFinite(price) || price < 0) return setError("Enter a valid price.");
    if (!itemName.trim() || !Number.isFinite(qty) || qty < 1) return setError("Provide at least one valid item with quantity >= 1.");
    setSaving(true);
    const res = await fetch("/api/bundles", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name, type, basePrice: price, expiryDays: Number(expiryDays) || 90,
        items: [{ type: "class", name: itemName, quantity: qty }],
      }),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error ?? "Failed to create bundle."); return; }
    onCreated();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-900">New Bundle</h2>
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
        <div className="grid gap-3">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Bundle name (e.g. 10 Yoga Classes)" className="border rounded-lg px-3 py-2 text-sm" />
          <select value={type} onChange={e => setType(e.target.value as BundleType)} className="border rounded-lg px-3 py-2 text-sm">
            {BUNDLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input value={basePrice} onChange={e => setBasePrice(e.target.value)} placeholder="Price (CAD)" type="number" min="0" step="0.01" className="border rounded-lg px-3 py-2 text-sm" />
            <input value={expiryDays} onChange={e => setExpiryDays(e.target.value)} placeholder="Expiry (days)" type="number" min="1" className="border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input value={itemName} onChange={e => setItemName(e.target.value)} placeholder="Item name (e.g. Class credit)" className="border rounded-lg px-3 py-2 text-sm" />
            <input value={itemQty} onChange={e => setItemQty(e.target.value)} placeholder="Quantity" type="number" min="1" className="border rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Saving…" : "Create draft bundle"}
          </button>
        </div>
        <p className="text-xs text-gray-400">New bundles start as <code>draft</code> — publish from the Bundles tab once ready.</p>
      </div>
    </div>
  );
}

type Tab = "overview" | "plans" | "subscriptions" | "bundles" | "flowchart" | "integrations";

// ─── Component ────────────────────────────────────────────────────────────────
export default function PricingAdminPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubRow[]>([]);
  const [bundles, setBundles] = useState<BundleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showBundleModal, setShowBundleModal] = useState(false);
  const [subFilter, setSubFilter] = useState<string>("all");

  const reload = () => Promise.all([
    fetchJson<{ plans: PlanRow[] }>("/api/pricing/plans"),
    fetchJson<{ subscriptions: SubRow[] }>("/api/subscriptions"),
    fetchJson<{ bundles: BundleRow[] }>("/api/bundles"),
  ]).then(([p, s, b]) => {
    setPlans(p?.plans ?? []); setSubscriptions(s?.subscriptions ?? []); setBundles(b?.bundles ?? []);
    setLoading(false);
  });

  useEffect(() => { reload(); }, []);

  async function planAction(id: string, action: "activate" | "deprecate" | "archive") {
    await fetch(`/api/pricing/plans/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    reload();
  }
  async function subAction(id: string, action: string, extra: Record<string, unknown> = {}) {
    await fetch(`/api/subscriptions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }) });
    reload();
  }
  async function bundleAction(id: string, action: string, extra: Record<string, unknown> = {}) {
    await fetch(`/api/bundles/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }) });
    reload();
  }

  const totalMRR = plans.reduce((s, p) => s + p.mrr, 0);
  const activeSubs = subscriptions.filter(s => s.status === "active").length;
  const trialSubs = subscriptions.filter(s => s.status === "trial").length;
  const filteredSubs = subFilter === "all" ? subscriptions : subscriptions.filter(s => s.status === subFilter);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pricing Engine</h1>
          <p className="text-sm text-gray-500 mt-0.5">Plans · Bundles · Subscriptions — real data from pricing_plan_master / subscription_master / bundle_master</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowBundleModal(true)} className="px-3 py-1.5 text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded hover:bg-purple-100">+ New Bundle</button>
          <button onClick={() => setShowPlanModal(true)} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">+ New Plan</button>
        </div>
      </div>

      {showPlanModal && <PlanFormModal onClose={() => setShowPlanModal(false)} onCreated={() => { setShowPlanModal(false); reload(); setTab("plans"); }} />}
      {showBundleModal && <BundleFormModal onClose={() => setShowBundleModal(false)} onCreated={() => { setShowBundleModal(false); reload(); setTab("bundles"); }} />}

      {/* KPI Row — every value derived from fetched rows, no fabrication */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Monthly Revenue (MRR)", value: `$${totalMRR.toLocaleString()}`, color: "text-green-600", bg: "bg-green-50" },
          { label: "Active Members", value: activeSubs, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Trial Members", value: trialSubs, color: "text-indigo-600", bg: "bg-indigo-50" },
          { label: "Plans Active", value: plans.filter(p => p.status === "active").length, color: "text-gray-700", bg: "bg-gray-50" },
          { label: "Bundles Active", value: bundles.filter(b => b.status === "active").length, color: "text-orange-600", bg: "bg-orange-50" },
        ].map(kpi => (
          <div key={kpi.label} className={`${kpi.bg} rounded-lg p-4 border`}>
            <p className="text-xs text-gray-500">{kpi.label}</p>
            <p className={`text-2xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 border-b overflow-x-auto">
        {(["overview", "plans", "subscriptions", "bundles", "flowchart", "integrations"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm capitalize whitespace-nowrap ${tab === t ? "border-b-2 border-blue-600 text-blue-600 font-medium" : "text-gray-500 hover:text-gray-700"}`}>{t}</button>
        ))}
      </div>

      {/* ─── OVERVIEW ─────────────────────────────────────────────────────── */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border rounded-lg p-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">Revenue by Plan (active subscriptions)</p>
            {loading ? <EmptyState message="Loading…" /> : !plans.some(p => p.mrr > 0) ? (
              <EmptyState message="No active subscriptions yet — revenue by plan will appear once customers subscribe." />
            ) : (
              <div className="space-y-2">
                {plans.filter(p => p.mrr > 0).sort((a, b) => b.mrr - a.mrr).map(p => (
                  <div key={p.id} className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 w-32 truncate">{p.name}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${totalMRR ? Math.round((p.mrr / totalMRR) * 100) : 0}%` }} />
                    </div>
                    <span className="text-xs font-medium text-gray-700 w-20 text-right">${p.mrr.toLocaleString()}</span>
                    <span className="text-xs text-gray-400 w-8 text-right">{p.activeSubscriptions}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border rounded-lg p-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">Subscription Status</p>
            {loading ? <EmptyState message="Loading…" /> : subscriptions.length === 0 ? (
              <EmptyState message="No subscriptions yet." />
            ) : (
              <div className="space-y-2">
                {(["active", "trial", "paused", "frozen", "grace_period", "cancelled"] as SubStatus[]).map(s => {
                  const count = subscriptions.filter(sub => sub.status === s).length;
                  return (
                    <div key={s} className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${SUB_STATUS_STYLE[s]} w-24 text-center`}>{s}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                        <div className="bg-gray-400 h-1.5 rounded-full" style={{ width: `${subscriptions.length ? (count / subscriptions.length) * 100 : 0}%` }} />
                      </div>
                      <span className="text-xs text-gray-600 w-4 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white border rounded-lg p-4 md:col-span-2">
            <p className="text-sm font-semibold text-gray-700 mb-3">Bundle Sales</p>
            {bundles.length === 0 ? <EmptyState message="No bundles created yet." /> : (
              <div className="space-y-2">
                {bundles.map(b => (
                  <div key={b.id} className="flex justify-between text-xs text-gray-600">
                    <span className="truncate w-44">{b.name}</span>
                    <span className="text-green-600 font-medium">${b.revenue.toLocaleString()}</span>
                    <span className="text-gray-400">{b.sold} sold</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── PLANS ─────────────────────────────────────────────────────────── */}
      {tab === "plans" && (
        <div className="space-y-4">
          {plans.length === 0 ? <EmptyState message={loading ? "Loading…" : "No plans yet. Create one to get started."} /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {plans.map(p => {
              const monthly = p.prices.find(pr => pr.billingCycle === "monthly");
              const annual = p.prices.find(pr => pr.billingCycle === "annual");
              return (
                <div key={p.id} className="bg-white border rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-gray-900">{p.name}</p>
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded">{p.type}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs ${p.status === "active" ? "bg-green-100 text-green-700" : p.status === "draft" ? "bg-gray-100 text-gray-500" : "bg-orange-100 text-orange-700"}`}>{p.status}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                    <div><span className="text-gray-400">Monthly:</span> {monthly ? `$${monthly.amount}` : "—"}</div>
                    <div><span className="text-gray-400">Annual:</span> {annual ? `$${annual.amount}` : "—"}</div>
                    <div><span className="text-gray-400">Subscribers:</span> {p.activeSubscriptions}</div>
                    <div><span className="text-gray-400">MRR:</span> {p.mrr > 0 ? `$${p.mrr.toLocaleString()}` : "—"}</div>
                    <div><span className="text-gray-400">Grace:</span> {p.gracePeriodDays}d</div>
                  </div>
                  <div className="flex gap-1 pt-1 border-t">
                    {p.status === "draft" && <button onClick={() => planAction(p.id, "activate")} className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded hover:bg-green-100">Activate</button>}
                    {p.status === "active" && <button onClick={() => planAction(p.id, "deprecate")} className="text-xs px-2 py-1 bg-orange-50 text-orange-700 rounded hover:bg-orange-100">Deprecate</button>}
                    {p.status !== "archived" && <button onClick={() => planAction(p.id, "archive")} className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200">Archive</button>}
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>
      )}

      {/* ─── SUBSCRIPTIONS ────────────────────────────────────────────────── */}
      {tab === "subscriptions" && (
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            {["all", "trial", "active", "paused", "frozen", "grace_period", "cancelled", "expired"].map(f => (
              <button key={f} onClick={() => setSubFilter(f)} className={`text-xs px-3 py-1 rounded-full capitalize ${subFilter === f ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>{f}</button>
            ))}
          </div>
          {filteredSubs.length === 0 ? <EmptyState message="No subscriptions match this filter." /> : (
          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{["Customer", "Plan", "Status", "Cycle", "Amount", "Expires", "Auto-Renew", "Credit", "Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSubs.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{s.customerId}</td>
                    <td className="px-4 py-3 text-gray-700">{s.planName}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${SUB_STATUS_STYLE[s.status]}`}>{s.status}</span></td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{s.billingCycle}</td>
                    <td className="px-4 py-3 font-medium">{s.billingAmount > 0 ? `$${s.billingAmount}` : "Free"}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{new Date(s.expiresAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-xs">{s.autoRenew ? <span className="text-green-600">✓ Auto</span> : <span className="text-gray-400">Manual</span>}</td>
                    <td className="px-4 py-3 text-xs">{s.prorationCredit > 0 ? <span className="text-blue-600 font-medium">${s.prorationCredit}</span> : "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {s.status === "trial" && <button onClick={() => subAction(s.id, "activateTrial")} className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded">Activate</button>}
                        {s.status === "active" && <button onClick={() => subAction(s.id, "pause", { reason: "admin_action" })} className="text-xs px-2 py-1 bg-orange-50 text-orange-700 rounded">Pause</button>}
                        {s.status === "active" && <button onClick={() => subAction(s.id, "freeze", { from: new Date().toISOString(), to: new Date(Date.now() + 14 * 86400000).toISOString() })} className="text-xs px-2 py-1 bg-cyan-50 text-cyan-700 rounded">Freeze</button>}
                        {s.status === "paused" && <button onClick={() => subAction(s.id, "resume")} className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded">Resume</button>}
                        {s.status === "frozen" && <button onClick={() => subAction(s.id, "unfreeze")} className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded">Unfreeze</button>}
                        {(s.status === "active" || s.status === "paused") && <button onClick={() => subAction(s.id, "cancel", { reason: "admin_cancelled" })} className="text-xs px-2 py-1 bg-red-50 text-red-700 rounded">Cancel</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </div>
      )}

      {/* ─── BUNDLES ──────────────────────────────────────────────────────── */}
      {tab === "bundles" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {bundles.length === 0 ? <EmptyState message="No bundles created yet." /> : bundles.map(b => (
            <div key={b.id} className="bg-white border rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <p className="font-semibold text-gray-900 text-sm">{b.name}</p>
                <span className={`text-xs px-2 py-0.5 rounded ${b.status === "active" ? "bg-green-100 text-green-700" : b.status === "draft" ? "bg-gray-100 text-gray-500" : "bg-orange-100 text-orange-700"}`}>{b.status}</span>
              </div>
              <p className="text-xs text-gray-500">{b.items.map(i => `${i.quantity} ${i.name}`).join(" + ")}</p>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                <div><span className="text-gray-400">Price:</span> ${b.discountedPrice}</div>
                <div><span className="text-gray-400">Expires:</span> {b.expiryDays}d</div>
                <div><span className="text-gray-400">Sold:</span> {b.sold}</div>
                <div><span className="text-gray-400">Revenue:</span> ${b.revenue.toLocaleString()}</div>
              </div>
              <div className="flex gap-1 pt-2 border-t">
                {b.status === "draft" && <button onClick={() => bundleAction(b.id, "publish")} className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded">Publish</button>}
                {b.status === "active" && <button onClick={() => bundleAction(b.id, "suspend", { reason: "admin_action" })} className="text-xs px-2 py-1 bg-orange-50 text-orange-700 rounded">Suspend</button>}
                {b.status === "suspended" && <button onClick={() => bundleAction(b.id, "reinstate")} className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded">Reinstate</button>}
                {b.status !== "archived" && <button onClick={() => bundleAction(b.id, "archive")} className="text-xs px-2 py-1 bg-gray-100 rounded">Archive</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── FLOWCHART (reference documentation, not live data) ─────────────── */}
      {tab === "flowchart" && (
        <div className="space-y-6">
          <div className="bg-white border rounded-lg p-5">
            <p className="text-sm font-semibold text-gray-700 mb-4">Subscription Lifecycle State Machine (Subscription.ts)</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
              {[
                { from: "trial", to: "active", action: "activateTrial()" },
                { from: "active", to: "paused", action: "pause(reason)" },
                { from: "paused", to: "active", action: "resume() — extends expiresAt" },
                { from: "active", to: "frozen", action: "freeze(from, to) — extends expiresAt" },
                { from: "frozen", to: "active", action: "unfreeze()" },
                { from: "active", to: "grace_period", action: "enterGracePeriod(days)" },
                { from: "active", to: "cancelled", action: "cancel(reason)" },
                { from: "active/paused", to: "active", action: "scheduleDowngrade(planId) — next cycle" },
              ].map(({ from, to, action }) => (
                <div key={action} className="border rounded p-2 bg-gray-50">
                  <div className="flex items-center gap-1">
                    <span className="px-1.5 py-0.5 rounded bg-gray-200 text-gray-700">{from}</span>
                    <span className="text-gray-400">→</span>
                    <span className="px-1.5 py-0.5 rounded bg-gray-200 text-gray-700">{to}</span>
                  </div>
                  <p className="text-gray-500 mt-1 font-mono text-xs">{action}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white border rounded-lg p-5">
            <p className="text-sm font-semibold text-gray-700 mb-4">Bundle Lifecycle (Bundle.ts)</p>
            <div className="flex flex-col gap-2 text-xs">
              {[
                "Admin creates bundle template → status=draft (POST /api/bundles)",
                "Admin publishes → status=active (PATCH .../[id] {action:'publish'})",
                "Customer purchases → Bundle.activate(customerId) creates a bundle_ownership row + bundle_usage rows (PATCH {action:'purchase'})",
                "Customer redeems a class/workshop → Bundle.useItem() increments bundle_usage.used_count (PATCH {action:'useItem'})",
                "Credits exhausted when used_count === quantity for every item — totalRemaining() reaches 0",
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-2 p-2 bg-gray-50 rounded border text-gray-600">
                  <span className="font-medium text-gray-500 shrink-0">{i + 1}.</span><span>{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── INTEGRATIONS (reference documentation, not live data) ──────────── */}
      {tab === "integrations" && (
        <div className="bg-white border rounded-lg p-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">Database Master Tables (PostgreSQL 15)</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {[
              { table: "pricing_plan_master", cols: "id · name · slug · plan_type · status · benefits · freeze_policy · pause_policy · grace_period_days" },
              { table: "pricing_plan_price", cols: "id · plan_id(FK) · amount · currency · billing_cycle · is_promotional" },
              { table: "pricing_rule_master", cols: "id · rule_type · priority · stacking_behavior · condition_json · action_json — domain class exists (PricingRule.ts), no API route wired yet" },
              { table: "bundle_master / bundle_item", cols: "id · bundle_type · base_price · discounted_price · expiry_days ; items: type · name · quantity" },
              { table: "subscription_master", cols: "id · customer_id · plan_id(FK) · status · billing_amount · expires_at · paused_at · frozen_from/to · grace_period_ends_at" },
              { table: "bundle_ownership / bundle_usage", cols: "per-customer purchase + per-item credit consumption" },
              { table: "family_seat", cols: "id · subscription_id(FK) · customer_id · member_name · status" },
              { table: "price_history", cols: "id · entity_type · entity_id · field_changed · old_value · new_value — audit log, not yet written to by these routes" },
            ].map(({ table, cols }) => (
              <div key={table} className="border rounded p-3 bg-gray-50">
                <p className="font-mono font-semibold text-gray-800 mb-1">{table}</p>
                <p className="text-gray-500">{cols}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
