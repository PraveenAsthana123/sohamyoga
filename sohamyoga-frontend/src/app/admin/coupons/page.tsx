"use client";

import { useEffect, useState } from "react";

type CouponType = "percentage" | "fixed_amount" | "free_class" | "buy_x_get_y" | "membership" |
  "bundle" | "referral" | "first_purchase" | "birthday" | "student_senior" |
  "corporate" | "teacher" | "event" | "product" | "gift_voucher" | "private_unique" | "public_promo" | "auto_applied";

type CouponStatus = "draft" | "pending_approval" | "scheduled" | "active" | "paused" | "expired" | "exhausted" | "revoked";

interface CouponRow {
  id: string;
  code: string;
  type: CouponType;
  name: string;
  status: CouponStatus;
  discount: string;
  redemptions: number;
  globalLimit?: number;
  validTo: string;
  stackingRule: string;
  channel: string[];
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

const STATUS_STYLES: Record<CouponStatus, string> = {
  draft:            "bg-gray-100 text-gray-700",
  pending_approval: "bg-yellow-100 text-yellow-800",
  scheduled:        "bg-blue-100 text-blue-700",
  active:           "bg-green-100 text-green-800",
  paused:           "bg-orange-100 text-orange-700",
  expired:          "bg-gray-200 text-gray-500",
  exhausted:        "bg-purple-100 text-purple-700",
  revoked:          "bg-red-100 text-red-700",
};

const TYPE_LABEL: Record<CouponType, string> = {
  percentage: "%", fixed_amount: "$ Off", free_class: "Free", buy_x_get_y: "BXGY",
  membership: "Mbr", bundle: "Bundle", referral: "Ref", first_purchase: "1st",
  birthday: "Bday", student_senior: "S/Sr", corporate: "Corp", teacher: "Tchr",
  event: "Event", product: "Prod", gift_voucher: "Gift", private_unique: "1:1",
  public_promo: "Promo", auto_applied: "Auto",
};

const ALL_STATUSES: CouponStatus[] = ["active", "scheduled", "draft", "pending_approval", "paused", "exhausted", "expired", "revoked"];

export default function CouponsAdminPage() {
  const [search, setSearch]           = useState("");
  const [filterStatus, setFilterStatus] = useState<CouponStatus | "all">("all");
  const [filterType, setFilterType]   = useState<CouponType | "all">("all");
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => fetchJson<{ coupons: CouponRow[] }>("/api/coupons").then(d => {
    setCoupons(d?.coupons ?? []); setLoading(false);
  });
  useEffect(() => { load(); }, []);

  async function transition(id: string, action: "submit" | "activate" | "pause") {
    const res = await fetch(`/api/coupons/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
    });
    if (res.ok) load();
  }

  const filtered = coupons.filter(c => {
    const matchSearch = !search || c.code.includes(search.toUpperCase()) || c.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || c.status === filterStatus;
    const matchType   = filterType   === "all" || c.type   === filterType;
    return matchSearch && matchStatus && matchType;
  });

  const totals = {
    active:      coupons.filter(c => c.status === "active").length,
    draft:       coupons.filter(c => c.status === "draft").length,
    exhausted:   coupons.filter(c => c.status === "exhausted").length,
    redemptions: coupons.reduce((s, c) => s + c.redemptions, 0),
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Coupon Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">OfferKit + Redis · 12-step validation · 19 coupon types · 13 MCP tools</p>
        </div>
        <div className="flex gap-2">
          <a href="http://localhost:3050" target="_blank" rel="noopener noreferrer"
            className="px-3 py-1.5 text-xs bg-indigo-50 text-indigo-700 rounded-md border border-indigo-200 hover:bg-indigo-100">
            OfferKit Engine
          </a>
          <a href="http://localhost:9003/app" target="_blank" rel="noopener noreferrer"
            className="px-3 py-1.5 text-xs bg-purple-50 text-purple-700 rounded-md border border-purple-200 hover:bg-purple-100">
            Medusa Admin
          </a>
          <button className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            + New Coupon
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Active",          value: totals.active,      color: "text-green-600",  bg: "bg-green-50" },
          { label: "Draft/Pending",   value: totals.draft,       color: "text-yellow-600", bg: "bg-yellow-50" },
          { label: "Exhausted",       value: totals.exhausted,   color: "text-purple-600", bg: "bg-purple-50" },
          { label: "Total Redeemed",  value: totals.redemptions, color: "text-blue-600",   bg: "bg-blue-50" },
        ].map(card => (
          <div key={card.label} className={`${card.bg} rounded-lg p-4 border border-opacity-20`}>
            <p className="text-xs text-gray-500">{card.label}</p>
            <p className={`text-3xl font-bold mt-1 ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Validation sequence */}
      <div className="bg-gray-50 border rounded-lg p-4">
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">12-Step Validation Sequence (OfferKit + Redis)</p>
        <div className="flex flex-wrap gap-1">
          {["normalize", "status", "dates", "eligibility", "product", "min spend", "limits", "stacking", "calculate", "reserve (Redis 15 min)", "payment", "commit"].map((step, i) => (
            <span key={step} className={`inline-flex items-center text-xs rounded px-2 py-0.5 border ${i >= 9 ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-white text-gray-700"}`}>
              <span className="text-gray-400 mr-1">{i + 1}.</span>{step}
            </span>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text" placeholder="Search code or name..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="px-3 py-2 text-sm border rounded-lg w-64"
        />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as CouponStatus | "all")}
          className="px-3 py-2 text-sm border rounded-lg">
          <option value="all">All Statuses</option>
          {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value as CouponType | "all")}
          className="px-3 py-2 text-sm border rounded-lg">
          <option value="all">All Types (19)</option>
          {(Object.keys(TYPE_LABEL) as CouponType[]).map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <span className="self-center text-xs text-gray-500">{filtered.length} coupons</span>
      </div>

      {/* Coupon table */}
      {loading ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-500 text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-500 text-sm">
          {coupons.length === 0 ? "No coupons yet. Create one to get started." : "No coupons match this filter."}
        </div>
      ) : (
      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {["Code", "Type", "Name", "Status", "Discount", "Redemptions", "Valid To", "Stacking", "Channels", "Actions"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(c => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono font-semibold text-gray-900">{c.code}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-medium">{TYPE_LABEL[c.type]}</span>
                </td>
                <td className="px-4 py-3 text-gray-700 max-w-[150px] truncate">{c.name}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[c.status]}`}>{c.status}</span>
                </td>
                <td className="px-4 py-3 font-medium text-gray-900">{c.discount}</td>
                <td className="px-4 py-3 text-gray-700">
                  {c.redemptions}
                  {c.globalLimit && <span className="text-gray-400 ml-1">/ {c.globalLimit}</span>}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{new Date(c.validTo).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{c.stackingRule}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 flex-wrap">
                    {c.channel.slice(0, 2).map(ch => (
                      <span key={ch} className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">{ch}</span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded">Edit</button>
                    {c.status === "active"    && <button onClick={() => transition(c.id, "pause")} className="text-xs px-2 py-1 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded">Pause</button>}
                    {c.status === "draft"     && <button onClick={() => transition(c.id, "submit")} className="text-xs px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded">Submit</button>}
                    {c.status === "paused"    && <button onClick={() => transition(c.id, "activate")} className="text-xs px-2 py-1 bg-green-50 hover:bg-green-100 text-green-700 rounded">Activate</button>}
                    {c.status === "scheduled" && <button onClick={() => transition(c.id, "activate")} className="text-xs px-2 py-1 bg-green-50 hover:bg-green-100 text-green-700 rounded">Activate</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {/* MCP tools quick reference */}
      <div className="bg-white border rounded-lg p-4">
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">MCP Tools (13) — Access Tiers</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { tier: "Read-only (auto)",  color: "bg-green-50 border-green-200 text-green-800",   tools: ["list_customer_coupons", "validate_coupon", "preview_discount"] },
            { tier: "Customer Confirm",  color: "bg-blue-50 border-blue-200 text-blue-800",      tools: ["apply_coupon_to_cart", "remove_coupon_from_cart"] },
            { tier: "Staff",             color: "bg-yellow-50 border-yellow-200 text-yellow-800", tools: ["create_coupon_draft", "pause_campaign", "get_coupon_analytics"] },
            { tier: "Approval Required", color: "bg-orange-50 border-orange-200 text-orange-800", tools: ["generate_unique_codes *", "activate_campaign *"] },
            { tier: "Admin (REVOKE)",    color: "bg-red-50 border-red-200 text-red-800",          tools: ["revoke_coupon (confirmText='REVOKE')", "simulate_promotion"] },
            { tier: "Audit Restricted",  color: "bg-gray-100 border-gray-300 text-gray-700",      tools: ["investigate_redemption (auditRoleToken)"] },
          ].map(group => (
            <div key={group.tier} className={`border rounded-lg p-3 ${group.color}`}>
              <p className="text-xs font-semibold mb-1">{group.tier}</p>
              {group.tools.map(t => <p key={t} className="text-xs font-mono opacity-80">{t}</p>)}
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">* requires confirmApprovalId token in payload</p>
      </div>
    </div>
  );
}
