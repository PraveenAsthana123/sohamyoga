"use client";

import { useState } from "react";

// ============================================================
// Types
// ============================================================
type PlanType = "silver" | "gold" | "platinum" | "family" | "corporate" | "kids" | "senior" | "retreat" | "workshop" | "personal_training" | "trial" | "drop_in";
type SubStatus = "trial" | "active" | "paused" | "frozen" | "grace_period" | "expired" | "cancelled";
type BundleType = "class_pack" | "hybrid" | "retreat" | "workshop" | "teacher_training" | "corporate" | "family" | "gift";
type RuleType = "buy_x_get_y" | "percentage_off" | "fixed_amount_off" | "early_bird" | "last_minute" | "seasonal" | "peak_off_peak" | "occupancy_based" | "birthday" | "first_purchase" | "referral_reward";

interface PlanRow { id: string; name: string; type: PlanType; monthlyCAD: number; annualCAD: number; status: string; subs: number; mrr: number; freezeAllowed: boolean; pauseAllowed: boolean; gracedays: number; upgradeTo: string; benefits: string[] }
interface SubRow   { id: string; customer: string; plan: string; status: SubStatus; cycle: string; amount: number; currency: string; expires: string; autoRenew: boolean; credit: number }
interface BundleRow { id: string; name: string; type: BundleType; items: string; price: number; discount: number; expiry: string; sold: number }
interface RuleRow  { id: string; name: string; type: RuleType; discount: string; segments: string; priority: number; status: string; applications: number }

// ============================================================
// Mock data
// ============================================================
const PLANS: PlanRow[] = [
  { id: "p1", name: "Silver",          type: "silver",    monthlyCAD: 79,  annualCAD: 799,  status: "active", subs: 312, mrr: 24648, freezeAllowed: false, pauseAllowed: true,  gracedays: 3,  upgradeTo: "Gold",          benefits: ["Video library", "2 meditation/mo", "10% workshop"] },
  { id: "p2", name: "Gold",            type: "gold",      monthlyCAD: 149, annualCAD: 1499, status: "active", subs: 189, mrr: 28161, freezeAllowed: true,  pauseAllowed: true,  gracedays: 7,  upgradeTo: "Platinum",       benefits: ["Priority booking", "VIP seating", "25% workshop", "30 min teacher consult"] },
  { id: "p3", name: "Platinum",        type: "platinum",  monthlyCAD: 229, annualCAD: 2299, status: "active", subs: 67,  mrr: 15343, freezeAllowed: true,  pauseAllowed: true,  gracedays: 14, upgradeTo: "—",              benefits: ["All Gold benefits", "50% retreat", "Nutrition consult", "Certificate", "Exclusive community"] },
  { id: "p4", name: "Family (4 seats)",type: "family",    monthlyCAD: 299, annualCAD: 2999, status: "active", subs: 43,  mrr: 12857, freezeAllowed: true,  pauseAllowed: true,  gracedays: 7,  upgradeTo: "—",              benefits: ["4 seats", "Shared credits", "Family wallet"] },
  { id: "p5", name: "Corporate",       type: "corporate", monthlyCAD: 0,   annualCAD: 0,    status: "active", subs: 8,   mrr: 19200, freezeAllowed: false, pauseAllowed: false, gracedays: 30, upgradeTo: "—",              benefits: ["Per-seat billing", "HR integration", "Utilization reporting", "Invoice"] },
  { id: "p6", name: "Senior 60+",      type: "senior",    monthlyCAD: 55,  annualCAD: 549,  status: "active", subs: 94,  mrr: 5170,  freezeAllowed: true,  pauseAllowed: true,  gracedays: 14, upgradeTo: "Gold",           benefits: ["Unlimited classes", "10% store", "Priority booking"] },
  { id: "p7", name: "14-Day Trial",    type: "trial",     monthlyCAD: 0,   annualCAD: 0,    status: "active", subs: 156, mrr: 0,     freezeAllowed: false, pauseAllowed: false, gracedays: 0,  upgradeTo: "Silver/Gold/Plat", benefits: ["Unlimited classes", "Video library"] },
  { id: "p8", name: "Drop-In",         type: "drop_in",   monthlyCAD: 25,  annualCAD: 0,    status: "active", subs: 0,   mrr: 0,     freezeAllowed: false, pauseAllowed: false, gracedays: 0,  upgradeTo: "—",              benefits: ["Single class access"] },
];

const SUBSCRIPTIONS: SubRow[] = [
  { id: "s1", customer: "Alice Chen",       plan: "Gold Monthly",      status: "active",       cycle: "monthly",   amount: 149, currency: "CAD", expires: "2026-09-05", autoRenew: true,  credit: 0 },
  { id: "s2", customer: "Bob Sharma",       plan: "Platinum Annual",   status: "active",       cycle: "annual",    amount: 2299, currency: "CAD", expires: "2027-01-01", autoRenew: true,  credit: 0 },
  { id: "s3", customer: "Carol Wu",         plan: "Silver Monthly",    status: "paused",       cycle: "monthly",   amount: 79,  currency: "CAD", expires: "2026-09-15", autoRenew: true,  credit: 0 },
  { id: "s4", customer: "David Corp Inc.",  plan: "Corporate Annual",  status: "active",       cycle: "annual",    amount: 2400, currency: "CAD", expires: "2027-04-01", autoRenew: false, credit: 0 },
  { id: "s5", customer: "Emma Patel",       plan: "Family Monthly",    status: "frozen",       cycle: "monthly",   amount: 299, currency: "CAD", expires: "2026-10-20", autoRenew: true,  credit: 0 },
  { id: "s6", customer: "Frank Novak",      plan: "Gold Monthly",      status: "grace_period", cycle: "monthly",   amount: 149, currency: "CAD", expires: "2026-08-05", autoRenew: false, credit: 0 },
  { id: "s7", customer: "Grace Kim",        plan: "14-Day Trial",      status: "trial",        cycle: "one_time",  amount: 0,   currency: "CAD", expires: "2026-08-19", autoRenew: false, credit: 0 },
  { id: "s8", customer: "Henry Lee",        plan: "Gold Monthly",      status: "cancelled",    cycle: "monthly",   amount: 149, currency: "CAD", expires: "2026-07-31", autoRenew: false, credit: 45.23 },
];

const BUNDLES: BundleRow[] = [
  { id: "b1", name: "10 Yoga Classes",          type: "class_pack",     items: "10 classes",             price: 199, discount: 15, expiry: "90 days", sold: 234 },
  { id: "b2", name: "20 Classes + 2 Workshops", type: "hybrid",         items: "20 class + 2 workshop",  price: 349, discount: 20, expiry: "120 days", sold: 87 },
  { id: "b3", name: "Fall Retreat Bundle",       type: "retreat",        items: "1 retreat + 5 classes",  price: 450, discount: 10, expiry: "180 days", sold: 15 },
  { id: "b4", name: "Corporate Wellness 10",     type: "corporate",      items: "10 classes × 10 seats",  price: 1800, discount: 25, expiry: "365 days", sold: 3 },
  { id: "b5", name: "Family of 4 Bundle",        type: "family",         items: "40 classes (shared)",    price: 680, discount: 18, expiry: "90 days",  sold: 28 },
  { id: "b6", name: "Gift Card CAD 100",         type: "gift",           items: "Stored value",            price: 100, discount: 0,  expiry: "12 months", sold: 67 },
];

const RULES: RuleRow[] = [
  { id: "r1", name: "Summer 20% Off",    type: "percentage_off",   discount: "20%",   segments: "all",          priority: 10, status: "active",  applications: 143 },
  { id: "r2", name: "Buy 10 Get 1 Free", type: "buy_x_get_y",      discount: "1 class free", segments: "all",  priority: 5,  status: "active",  applications: 89  },
  { id: "r3", name: "Early Bird −10%",   type: "early_bird",       discount: "10%",   segments: "all",          priority: 20, status: "active",  applications: 312 },
  { id: "r4", name: "Last Minute −20%",  type: "last_minute",      discount: "20%",   segments: "all",          priority: 15, status: "active",  applications: 54  },
  { id: "r5", name: "Birthday Gift",     type: "birthday",         discount: "20%",   segments: "gold,platinum",priority: 8,  status: "active",  applications: 23  },
  { id: "r6", name: "First Purchase",    type: "first_purchase",   discount: "CAD 15",segments: "new",          priority: 3,  status: "active",  applications: 178 },
  { id: "r7", name: "Off-Peak 15% Off",  type: "peak_off_peak",    discount: "15%",   segments: "all",          priority: 25, status: "paused",  applications: 0   },
  { id: "r8", name: "Referral Reward",   type: "referral_reward",  discount: "CAD 10",segments: "new",          priority: 12, status: "active",  applications: 56  },
];

// ============================================================
// Style helpers
// ============================================================
const SUB_STATUS_STYLE: Record<SubStatus, string> = {
  trial:        "bg-blue-100 text-blue-700",
  active:       "bg-green-100 text-green-800",
  paused:       "bg-orange-100 text-orange-700",
  frozen:       "bg-cyan-100 text-cyan-700",
  grace_period: "bg-yellow-100 text-yellow-800",
  expired:      "bg-gray-200 text-gray-500",
  cancelled:    "bg-red-100 text-red-700",
};

type Tab = "overview" | "plans" | "subscriptions" | "bundles" | "rules" | "flowchart" | "integrations";

// ============================================================
// Component
// ============================================================
export default function PricingAdminPage() {
  const [tab, setTab] = useState<Tab>("overview");

  const totalMRR = PLANS.reduce((s, p) => s + p.mrr, 0);
  const activeSubs = SUBSCRIPTIONS.filter(s => s.status === "active").length;
  const trialSubs = SUBSCRIPTIONS.filter(s => s.status === "trial").length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pricing Engine</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Plans · Bundles · Subscriptions · Dynamic Pricing · AI Recommendations
          </p>
        </div>
        <div className="flex gap-2">
          <a href="http://localhost:8080/app/pricing-rule" target="_blank" rel="noopener noreferrer"
            className="px-3 py-1.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100">
            ERPNext Pricing Rules
          </a>
          <a href="http://localhost:9003/app/products" target="_blank" rel="noopener noreferrer"
            className="px-3 py-1.5 text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded hover:bg-purple-100">
            Medusa Products
          </a>
          <button className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            + New Plan
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Monthly Revenue",  value: `$${(totalMRR).toLocaleString()}`, color: "text-green-600", bg: "bg-green-50" },
          { label: "Active Members",   value: activeSubs,                        color: "text-blue-600",  bg: "bg-blue-50" },
          { label: "Trial Members",    value: trialSubs,                         color: "text-indigo-600",bg: "bg-indigo-50" },
          { label: "Plans Active",     value: PLANS.filter(p => p.status === "active").length, color: "text-gray-700", bg: "bg-gray-50" },
          { label: "Pricing Rules",    value: RULES.filter(r => r.status === "active").length, color: "text-orange-600", bg: "bg-orange-50" },
        ].map(kpi => (
          <div key={kpi.label} className={`${kpi.bg} rounded-lg p-4 border`}>
            <p className="text-xs text-gray-500">{kpi.label}</p>
            <p className={`text-2xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b">
        {(["overview", "plans", "subscriptions", "bundles", "rules", "flowchart", "integrations"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm capitalize ${tab === t ? "border-b-2 border-blue-600 text-blue-600 font-medium" : "text-gray-500 hover:text-gray-700"}`}>
            {t}
          </button>
        ))}
      </div>

      {/* ============================================================ */}
      {/* TAB: OVERVIEW */}
      {/* ============================================================ */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Revenue by plan */}
          <div className="bg-white border rounded-lg p-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">Revenue by Plan</p>
            <div className="space-y-2">
              {PLANS.filter(p => p.mrr > 0).sort((a, b) => b.mrr - a.mrr).map(p => (
                <div key={p.id} className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 w-32 truncate">{p.name}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Math.round((p.mrr / totalMRR) * 100)}%` }} />
                  </div>
                  <span className="text-xs font-medium text-gray-700 w-20 text-right">${p.mrr.toLocaleString()}</span>
                  <span className="text-xs text-gray-400 w-8 text-right">{p.subs}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Subscription status breakdown */}
          <div className="bg-white border rounded-lg p-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">Subscription Status</p>
            <div className="space-y-2">
              {(["active","trial","paused","frozen","grace_period","cancelled"] as SubStatus[]).map(s => {
                const count = SUBSCRIPTIONS.filter(sub => sub.status === s).length;
                return (
                  <div key={s} className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${SUB_STATUS_STYLE[s]} w-24 text-center`}>{s}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                      <div className="bg-gray-400 h-1.5 rounded-full" style={{ width: `${(count / SUBSCRIPTIONS.length) * 100}%` }} />
                    </div>
                    <span className="text-xs text-gray-600 w-4 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pricing rule applications */}
          <div className="bg-white border rounded-lg p-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">Top Pricing Rules (by applications)</p>
            <div className="space-y-2">
              {RULES.filter(r => r.status === "active").sort((a, b) => b.applications - a.applications).map(r => (
                <div key={r.id} className="flex justify-between text-xs text-gray-600">
                  <span className="truncate w-40">{r.name}</span>
                  <span className="text-gray-400">{r.discount}</span>
                  <span className="font-medium">{r.applications} applied</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bundle sales */}
          <div className="bg-white border rounded-lg p-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">Bundle Sales</p>
            <div className="space-y-2">
              {BUNDLES.map(b => (
                <div key={b.id} className="flex justify-between text-xs text-gray-600">
                  <span className="truncate w-44">{b.name}</span>
                  <span className="text-green-600 font-medium">${(b.price * b.sold).toLocaleString()}</span>
                  <span className="text-gray-400">{b.sold} sold</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB: PLANS */}
      {/* ============================================================ */}
      {tab === "plans" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {PLANS.map(p => (
              <div key={p.id} className="bg-white border rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-gray-900">{p.name}</p>
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded">{p.type}</span>
                  </div>
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">{p.status}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                  <div><span className="text-gray-400">Monthly:</span> {p.monthlyCAD > 0 ? `$${p.monthlyCAD}` : "—"}</div>
                  <div><span className="text-gray-400">Annual:</span> {p.annualCAD > 0 ? `$${p.annualCAD}` : "—"}</div>
                  <div><span className="text-gray-400">Subscribers:</span> {p.subs}</div>
                  <div><span className="text-gray-400">MRR:</span> {p.mrr > 0 ? `$${p.mrr.toLocaleString()}` : "—"}</div>
                  <div><span className="text-gray-400">Grace:</span> {p.gracedays}d</div>
                  <div><span className="text-gray-400">Upgrades to:</span> {p.upgradeTo}</div>
                </div>
                <div className="flex gap-2 text-xs">
                  {p.freezeAllowed && <span className="px-2 py-0.5 bg-cyan-50 text-cyan-700 rounded border border-cyan-200">Freeze ✓</span>}
                  {p.pauseAllowed  && <span className="px-2 py-0.5 bg-orange-50 text-orange-700 rounded border border-orange-200">Pause ✓</span>}
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Benefits</p>
                  <ul className="space-y-0.5">
                    {p.benefits.map(b => <li key={b} className="text-xs text-gray-600">✓ {b}</li>)}
                  </ul>
                </div>
                <div className="flex gap-1 pt-1 border-t">
                  <button className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200">Edit</button>
                  <button className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100">Prices</button>
                  <button className="text-xs px-2 py-1 bg-gray-50 text-gray-600 rounded hover:bg-gray-100">History</button>
                </div>
              </div>
            ))}
          </div>

          {/* Plan comparison matrix */}
          <div className="bg-white border rounded-lg p-4 overflow-x-auto">
            <p className="text-sm font-semibold text-gray-700 mb-3">Plan Comparison Matrix</p>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 text-gray-500 w-40">Feature</th>
                  {["Silver","Gold","Platinum","Family","Senior","Trial"].map(n => (
                    <th key={n} className="text-center py-2 px-3 text-gray-700">{n}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[
                  ["Monthly Price",      "$79",  "$149","$229","$299","$55","Free"],
                  ["Unlimited Classes",  "✅","✅","✅","✅","✅","✅"],
                  ["Workshop Discount",  "10%","25%","50%","15%","10%","—"],
                  ["Retreat Discount",   "—","10%","50%","10%","—","—"],
                  ["Priority Booking",   "—","✅","✅","✅","✅","—"],
                  ["VIP Seating",        "—","✅","✅","—","—","—"],
                  ["Teacher Consult",    "—","30min","60min","—","—","—"],
                  ["Nutrition Consult",  "—","—","30min","—","—","—"],
                  ["Premium Content",    "—","✅","✅","✅","—","—"],
                  ["Certificate",        "—","—","✅","—","—","—"],
                  ["Pause Allowed",      "✅","✅","✅","✅","✅","—"],
                  ["Freeze Allowed",     "—","✅","✅","✅","✅","—"],
                  ["Grace Period",       "3d","7d","14d","7d","14d","—"],
                ].map(([feat, ...vals]) => (
                  <tr key={feat}>
                    <td className="py-1.5 pr-4 text-gray-600 font-medium">{feat}</td>
                    {vals.map((v, i) => (
                      <td key={i} className={`py-1.5 px-3 text-center ${v === "✅" ? "text-green-600" : v === "—" ? "text-gray-300" : "text-gray-700"}`}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB: SUBSCRIPTIONS */}
      {/* ============================================================ */}
      {tab === "subscriptions" && (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>{["Customer","Plan","Status","Cycle","Amount","Expires","Auto-Renew","Credit","Actions"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {SUBSCRIPTIONS.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{s.customer}</td>
                  <td className="px-4 py-3 text-gray-700">{s.plan}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${SUB_STATUS_STYLE[s.status]}`}>{s.status}</span></td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{s.cycle}</td>
                  <td className="px-4 py-3 font-medium">{s.amount > 0 ? `$${s.amount}` : "Free"}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{s.expires}</td>
                  <td className="px-4 py-3 text-xs">{s.autoRenew ? <span className="text-green-600">✓ Auto</span> : <span className="text-gray-400">Manual</span>}</td>
                  <td className="px-4 py-3 text-xs">{s.credit > 0 ? <span className="text-blue-600 font-medium">${s.credit}</span> : "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {s.status === "active"       && <button className="text-xs px-2 py-1 bg-orange-50 text-orange-700 rounded">Pause</button>}
                      {s.status === "active"       && <button className="text-xs px-2 py-1 bg-cyan-50 text-cyan-700 rounded">Freeze</button>}
                      {s.status === "active"       && <button className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded">Upgrade</button>}
                      {s.status === "paused"       && <button className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded">Resume</button>}
                      {s.status === "frozen"       && <button className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded">Unfreeze</button>}
                      {s.status === "grace_period" && <button className="text-xs px-2 py-1 bg-yellow-50 text-yellow-700 rounded">Renew</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB: BUNDLES */}
      {/* ============================================================ */}
      {tab === "bundles" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {BUNDLES.map(b => (
            <div key={b.id} className="bg-white border rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <p className="font-semibold text-gray-900 text-sm">{b.name}</p>
                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{b.type}</span>
              </div>
              <p className="text-xs text-gray-500">{b.items}</p>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                <div><span className="text-gray-400">Price:</span> ${b.price}</div>
                <div><span className="text-gray-400">Discount:</span> <span className="text-green-600">{b.discount}%</span></div>
                <div><span className="text-gray-400">Expires:</span> {b.expiry}</div>
                <div><span className="text-gray-400">Sold:</span> {b.sold}</div>
              </div>
              <div className="flex gap-1 pt-2 border-t">
                <button className="text-xs px-2 py-1 bg-gray-100 rounded">Edit</button>
                <button className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded">Usage</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB: PRICING RULES */}
      {/* ============================================================ */}
      {tab === "rules" && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
            <strong>Rule Evaluation Order:</strong> Rules evaluated by Priority (ASC) → exclusive rules: highest priority wins →
            combinable rules: all applied → best_wins: highest discount kept → total discount capped at order amount
          </div>
          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{["Priority","Name","Type","Discount","Segments","Status","Applied","Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {RULES.sort((a, b) => a.priority - b.priority).map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-center font-mono text-xs text-gray-500">{r.priority}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{r.name}</td>
                    <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">{r.type}</span></td>
                    <td className="px-4 py-3 font-medium text-green-600">{r.discount}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{r.segments}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${r.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{r.status}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{r.applications}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button className="text-xs px-2 py-1 bg-gray-100 rounded">Edit</button>
                        {r.status === "active" && <button className="text-xs px-2 py-1 bg-orange-50 text-orange-700 rounded">Pause</button>}
                        {r.status === "paused" && <button className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded">Resume</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB: FLOWCHART */}
      {/* ============================================================ */}
      {tab === "flowchart" && (
        <div className="space-y-6">
          {/* Subscription lifecycle */}
          <div className="bg-white border rounded-lg p-5">
            <p className="text-sm font-semibold text-gray-700 mb-4">Subscription Lifecycle State Machine</p>
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              {[
                { node: "trial", color: "bg-blue-100 text-blue-800" },
                { arrow: "activateTrial()" },
                { node: "active", color: "bg-green-100 text-green-800" },
              ].map((item, i) => "node" in item
                ? <span key={i} className={`px-3 py-1.5 rounded-lg border font-semibold ${item.color}`}>{item.node}</span>
                : <span key={i} className="text-gray-400">──{item.arrow}──▶</span>
              )}
            </div>
            <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
              {[
                { from: "active", to: "paused",       action: "pause(reason)" },
                { from: "paused", to: "active",       action: "resume() + extends expiresAt" },
                { from: "active", to: "frozen",       action: "freeze(from, to) + extends expiresAt" },
                { from: "frozen", to: "active",       action: "unfreeze()" },
                { from: "active", to: "grace_period", action: "enterGracePeriod(days)" },
                { from: "active", to: "cancelled",    action: "cancel(reason)" },
                { from: "active", to: "cancelled",    action: "cancelWithCredit(reason, credit)" },
                { from: "active", to: "active",       action: "scheduleDowngrade() (next cycle)" },
                { from: "active", to: "active",       action: "addFamilySeat() / removeFamilySeat()" },
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

          {/* Upgrade flow */}
          <div className="bg-white border rounded-lg p-5">
            <p className="text-sm font-semibold text-gray-700 mb-4">Upgrade with Proration Flow</p>
            <div className="flex flex-col gap-2 text-xs">
              {[
                { step: "1", label: "Customer requests upgrade (e.g., Silver → Gold)", color: "bg-blue-50" },
                { step: "2", label: "calculateProratedCredit() = (daysRemaining / billingCycleDays) × billingAmount", color: "bg-yellow-50" },
                { step: "3", label: "Old subscription.cancelWithCredit(reason, credit) → status=cancelled", color: "bg-orange-50" },
                { step: "4", label: "ERPNext: credit posted to Customer Wallet", color: "bg-purple-50" },
                { step: "5", label: "New Subscription created (new planId, status=active)", color: "bg-green-50" },
                { step: "6", label: "Medusa: new order + Stripe payment (amount − credit)", color: "bg-blue-50" },
                { step: "7", label: "Novu: upgrade_confirmation notification sent", color: "bg-indigo-50" },
              ].map(({ step, label, color }) => (
                <div key={step} className={`flex items-center gap-3 p-2 rounded border ${color}`}>
                  <span className="w-5 h-5 rounded-full bg-gray-600 text-white flex items-center justify-center text-xs shrink-0">{step}</span>
                  <span className="text-gray-700">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Checkout flow */}
          <div className="bg-white border rounded-lg p-5">
            <p className="text-sm font-semibold text-gray-700 mb-4">Checkout Process Flow (12-step Discount Sequence)</p>
            <div className="flex flex-wrap gap-1 text-xs">
              {["1.Order amount", "2.Apply rules (priority)", "3.Apply coupon code", "4.Apply wallet credit", "5.Apply gift card",
                "6.Apply reward points", "7.Apply proration credit", "8.Add tax (ERPNext region)", "9.Calculate installments (if any)",
                "10.Reserve coupon (Redis 15min)", "11.Create Medusa order", "12.Commit + post invoice (ERPNext)"].map(step => (
                <span key={step} className="px-2 py-1 bg-white border rounded text-gray-600">{step}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB: INTEGRATIONS */}
      {/* ============================================================ */}
      {tab === "integrations" && (
        <div className="space-y-4">
          {/* Master tables */}
          <div className="bg-white border rounded-lg p-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">Database Master Tables (PostgreSQL 15)</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {[
                { table: "pricing_plan_master",  cols: "id · name · slug · plan_type · status · prices (JSONB) · benefits · freeze_policy · pause_policy · upgradeable_to · grace_period_days" },
                { table: "pricing_plan_price",   cols: "id · plan_id(FK) · amount · currency · billing_cycle · is_promotional · promo_valid_from/to" },
                { table: "pricing_rule_master",  cols: "id · rule_type · priority · stacking_behavior · condition_json · action_json · max_applications_total · current_applications" },
                { table: "bundle_master",        cols: "id · slug · bundle_type · base_price · discounted_price · expiry_days · is_mix_and_match · is_giftable · is_transferable" },
                { table: "bundle_item",          cols: "id · bundle_id(FK) · item_type · name · quantity · product_id · class_category" },
                { table: "subscription_master",  cols: "id · customer_id · plan_id(FK) · status · billing_amount · expires_at · paused_at · frozen_from/to · grace_period_ends_at · pending_downgrade_plan_id" },
                { table: "family_seat",          cols: "id · subscription_id(FK) · customer_id · member_name · status(active/removed)" },
                { table: "bundle_ownership",     cols: "id · bundle_id(FK) · customer_id · activated_at · expires_at · gifted_to · transferred_to · seats_used" },
                { table: "bundle_usage",         cols: "id · ownership_id(FK) · item_id(FK) · used_count · last_used_at" },
                { table: "price_history",        cols: "id · entity_type · entity_id · field_changed · old_value · new_value · changed_by · changed_at" },
              ].map(({ table, cols }) => (
                <div key={table} className="border rounded p-3 bg-gray-50">
                  <p className="font-mono font-semibold text-gray-800 mb-1">{table}</p>
                  <p className="text-gray-500">{cols}</p>
                </div>
              ))}
            </div>
          </div>

          {/* External system integrations */}
          <div className="bg-white border rounded-lg p-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">External System Integrations</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {["System","Port","Pricing Responsibility","Event / Trigger","Direction"].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {[
                    ["ERPNext / Frappe", "8080", "Sales Invoice, Payment Entry, Pricing Rule, Wallet credit",        "subscription.activate / cancel / upgrade",            "→ ERPNext API"],
                    ["Medusa",           "9003", "Cart, Order, Payment, Product catalog (plan variants)",            "customer checkout, order.placed",                     "← Medusa webhook"],
                    ["OfferKit",         "3050", "Coupon validation + Redis reservation, rule sync",                 "POST /rules (sync), POST /apply (checkout)",           "↔ bidirectional"],
                    ["Cal.com",          "3100", "Class occupancy data for peak/off-peak rules",                     "GET /slots?status=booked (occupancy %)",               "← Cal.com API"],
                    ["Redis",            "6379", "Subscription upgrade/downgrade locks, coupon reservations",        "lock:subscription:{id} TTL=30s on upgrade",           "← Redis SET NX"],
                    ["PostHog",          "—",    "A/B test on ab_test_variant_id, funnel analytics",                 "plan_viewed, plan_selected, plan_upgraded events",     "→ PostHog API"],
                    ["Novu",             "4001", "Renewal reminders, grace period warnings, upgrade confirmations",  "expires_at−7d, grace_period_ends_at−2d triggers",      "→ Novu API"],
                    ["Metabase",         "3001", "Revenue reports, v_revenue_by_plan view, MRR dashboards",          "Direct DB read from subscription_master",              "← Metabase query"],
                  ].map(([sys, port, resp, trigger, dir]) => (
                    <tr key={sys} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-800">{sys}</td>
                      <td className="px-3 py-2 font-mono text-gray-500">{port}</td>
                      <td className="px-3 py-2 text-gray-600">{resp}</td>
                      <td className="px-3 py-2 text-gray-500">{trigger}</td>
                      <td className="px-3 py-2 font-mono text-blue-600">{dir}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* MCP Tools */}
          <div className="bg-white border rounded-lg p-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">Pricing MCP Tools (12)</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              {[
                { tier: "Auto / Read-only",    color: "bg-green-50 border-green-200 text-green-800",    tools: ["compare_plan", "recommend_plan", "recommend_bundle", "calculate_discount", "wallet_balance"] },
                { tier: "Customer Confirm",    color: "bg-blue-50 border-blue-200 text-blue-800",       tools: ["apply_coupon", "upgrade_plan", "downgrade_plan"] },
                { tier: "Staff",               color: "bg-yellow-50 border-yellow-200 text-yellow-800", tools: ["update_membership", "renew_subscription"] },
                { tier: "Staff + Approval",    color: "bg-orange-50 border-orange-200 text-orange-800", tools: ["create_membership (confirmApprovalId)"] },
                { tier: "Admin Destructive",   color: "bg-red-50 border-red-200 text-red-800",          tools: ["cancel_subscription (confirmText='CANCEL')"] },
              ].map(group => (
                <div key={group.tier} className={`border rounded-lg p-3 ${group.color}`}>
                  <p className="font-semibold mb-1">{group.tier}</p>
                  {group.tools.map(t => <p key={t} className="font-mono opacity-80">{t}</p>)}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
