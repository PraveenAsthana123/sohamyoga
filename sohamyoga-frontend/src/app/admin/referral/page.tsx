"use client";
import { useState } from "react";

// ── mock data ────────────────────────────────────────────────────────────────

const KPI = [
  { label: "Total Referrals",     value: "1,842",  sub: "+214 this month",   color: "text-blue-600" },
  { label: "Successful",          value: "934",    sub: "50.7% conversion",  color: "text-green-600" },
  { label: "Pending Rewards",     value: "87",     sub: "Awaiting approval", color: "text-yellow-600" },
  { label: "Rewards Paid",        value: "$14,280",sub: "CAD this month",    color: "text-purple-600" },
  { label: "Active Campaigns",    value: "4",      sub: "2 expiring soon",   color: "text-indigo-600" },
  { label: "Revenue Generated",   value: "$68,420",sub: "from referrals",    color: "text-emerald-600" },
];

const REFERRALS = [
  { id: "ref-001", referrer: "Priya Sharma",    referree: "Anika Mehta",     type: "customer_customer", status: "reward_paid",    amount: 149, channel: "whatsapp", campaign: "Summer 2026" },
  { id: "ref-002", referrer: "Raj Kumar",       referree: "Sunita Patel",    type: "teacher_student",   status: "reward_pending", amount: 229, channel: "qr_code",  campaign: "Teacher Drive" },
  { id: "ref-003", referrer: "Meera Nair",      referree: "Arjun Singh",     type: "customer_customer", status: "registered",     amount: null,channel: "email",    campaign: "Summer 2026" },
  { id: "ref-004", referrer: "Dr. Gupta",       referree: "Ritu Verma",      type: "doctor",            status: "membership_purchased", amount: 299, channel: "direct_link", campaign: "Doctor Referral" },
  { id: "ref-005", referrer: "TechCorp HR",     referree: "5 employees",     type: "corporate",         status: "reward_approved",amount: 1495,channel: "email",    campaign: "Corporate Q3" },
  { id: "ref-006", referrer: "Ananya Iyer",     referree: "Vivek Shah",      type: "customer_customer", status: "reward_rejected", amount: null,channel: "facebook","campaign": "Summer 2026" },
  { id: "ref-007", referrer: "YogaInfluencer1", referree: "412 clicks",      type: "influencer",        status: "clicked",        amount: null,channel: "instagram","campaign": "Influencer Aug" },
  { id: "ref-008", referrer: "Kavita Reddy",    referree: "Sanjay Bose",     type: "student_teacher",   status: "verified",       amount: null,channel: "telegram", campaign: "Teacher Drive" },
];

const STATUS_STYLE: Record<string, string> = {
  draft:                "bg-gray-100 text-gray-700",
  shared:               "bg-blue-100 text-blue-700",
  clicked:              "bg-cyan-100 text-cyan-700",
  registered:           "bg-sky-100 text-sky-700",
  verified:             "bg-indigo-100 text-indigo-700",
  membership_purchased: "bg-violet-100 text-violet-700",
  reward_pending:       "bg-yellow-100 text-yellow-700",
  reward_approved:      "bg-lime-100 text-lime-700",
  reward_rejected:      "bg-red-100 text-red-700",
  reward_paid:          "bg-green-100 text-green-700",
  expired:              "bg-gray-200 text-gray-500",
};

const TYPE_COLOR: Record<string, string> = {
  customer_customer: "bg-blue-100 text-blue-700",
  teacher_student:   "bg-purple-100 text-purple-700",
  student_teacher:   "bg-indigo-100 text-indigo-700",
  corporate:         "bg-orange-100 text-orange-700",
  doctor:            "bg-red-100 text-red-700",
  hospital:          "bg-rose-100 text-rose-700",
  partner:           "bg-teal-100 text-teal-700",
  influencer:        "bg-pink-100 text-pink-700",
  affiliate:         "bg-yellow-100 text-yellow-700",
  employee:          "bg-cyan-100 text-cyan-700",
  franchise:         "bg-emerald-100 text-emerald-700",
  event:             "bg-lime-100 text-lime-700",
  workshop:          "bg-violet-100 text-violet-700",
  retreat:           "bg-green-100 text-green-700",
};

const CODES = [
  { code: "PRAVEEN2026", referrer: "Praveen Asthana",  type: "customer_customer", status: "active",  clicks: 148, uses: 42, maxUses: null,   campaign: "Summer 2026",  expiry: "2026-12-31" },
  { code: "YOGI-PRIYA",  referrer: "Priya Sharma",     type: "customer_customer", status: "active",  clicks: 92,  uses: 31, maxUses: null,   campaign: "Summer 2026",  expiry: "2026-12-31" },
  { code: "TEACH-RAJ",  referrer: "Raj Kumar",          type: "teacher_student",   status: "active",  clicks: 67,  uses: 18, maxUses: 50,     campaign: "Teacher Drive", expiry: "2026-09-30" },
  { code: "CORP-TECH",  referrer: "TechCorp HR",        type: "corporate",         status: "paused",  clicks: 210, uses: 5,  maxUses: 10,     campaign: "Corporate Q3", expiry: "2026-09-30" },
  { code: "DR-GUPTA",   referrer: "Dr. Gupta",          type: "doctor",            status: "active",  clicks: 34,  uses: 12, maxUses: null,   campaign: "Doctor Referral", expiry: null },
  { code: "INFL-001",   referrer: "YogaInfluencer1",   type: "influencer",        status: "active",  clicks: 412, uses: 0,  maxUses: null,   campaign: "Influencer Aug", expiry: "2026-08-31" },
];

const CAMPAIGNS = [
  { name: "Summer Referral 2026",  type: "standard",     status: "active", rewardType: "wallet_credit",  referrerReward: 25, referreeReward: 15, referrals: 842,  paid: 8420,  conversion: 50.7 },
  { name: "Teacher Drive Q3",      type: "standard",     status: "active", rewardType: "free_class",     referrerReward: 1,  referreeReward: 1,  referrals: 214,  paid: 214,   conversion: 38.2 },
  { name: "Corporate Q3 2026",     type: "corporate",    status: "active", rewardType: "wallet_credit",  referrerReward: 50, referreeReward: 30, referrals: 47,   paid: 2350,  conversion: 72.3 },
  { name: "Doctor Referral",       type: "standard",     status: "active", rewardType: "gift_card",      referrerReward: 75, referreeReward: 25, referrals: 129,  paid: 9675,  conversion: 64.1 },
  { name: "Diwali Double Rewards", type: "double_reward",status: "draft",  rewardType: "wallet_credit",  referrerReward: 50, referreeReward: 30, referrals: 0,    paid: 0,     conversion: 0 },
];

const REWARDS_PENDING = [
  { id: "rr-001", referral: "ref-002", referrer: "Raj Kumar",    type: "wallet_credit",  value: 25,  campaign: "Teacher Drive", flags: [] },
  { id: "rr-002", referral: "ref-004", referrer: "Dr. Gupta",    type: "gift_card",       value: 75,  campaign: "Doctor Referral", flags: [] },
  { id: "rr-003", referral: "ref-005", referrer: "TechCorp HR",  type: "wallet_credit",  value: 250, campaign: "Corporate Q3", flags: ["dup-domain"] },
];

const MCP_TOOLS = [
  { name: "create_referral_code", tier: "auto",             desc: "Generate unique code for referrer" },
  { name: "generate_referral_link",tier: "auto",            desc: "Build shareable URL with UTM params" },
  { name: "generate_referral_qr", tier: "auto",             desc: "Create QR code image for the link" },
  { name: "validate_referral",    tier: "auto",             desc: "Check code validity + fraud flags" },
  { name: "wallet_balance",       tier: "auto",             desc: "Retrieve referral wallet balance" },
  { name: "referral_history",     tier: "auto",             desc: "List referral events for a referrer" },
  { name: "leaderboard",          tier: "auto",             desc: "Top referrers for campaign / global" },
  { name: "calculate_reward",     tier: "staff",            desc: "Compute reward from campaign rules" },
  { name: "referral_analytics",   tier: "staff",            desc: "Funnel metrics: clicks → conversions" },
  { name: "approve_reward",       tier: "staff_approval",   desc: "Approve pending reward (+ approvalId)" },
  { name: "reject_reward",        tier: "staff_approval",   desc: "Reject reward with reason (+ approvalId)" },
  { name: "fraud_check",          tier: "admin_destructive",desc: "Fraud scan (RUN_FRAUD_CHECK + approvalId)" },
];

const TIER_STYLE: Record<string, string> = {
  auto:             "bg-green-100 text-green-700",
  customer_confirm: "bg-blue-100 text-blue-700",
  staff:            "bg-yellow-100 text-yellow-700",
  staff_approval:   "bg-orange-100 text-orange-700",
  admin_destructive:"bg-red-100 text-red-700",
};

const DB_TABLES = [
  { name: "referral_campaign",           desc: "Campaign config: type, dates, reward values, limits" },
  { name: "referral_code",               desc: "Unique codes per referrer: URL, QR, status, click/use counts" },
  { name: "referral_link",               desc: "Per-channel links with UTM tracking" },
  { name: "referral_click",              desc: "Raw click events: IP, device, agent, timestamp" },
  { name: "referral_master",             desc: "Core referral record: status machine, fraud flags, order amount" },
  { name: "referral_registration",       desc: "When referree registers: device, IP, source" },
  { name: "referral_reward",             desc: "Reward per referral: type, value, status, approval" },
  { name: "referral_wallet",             desc: "Per-customer wallet: balance, lifetime earned/spent" },
  { name: "referral_wallet_transaction", desc: "Wallet credit/debit ledger" },
  { name: "referral_campaign_analytics", desc: "Daily rollup: clicks, registrations, purchases, revenue" },
  { name: "referral_audit",              desc: "Status change history with actor and metadata" },
  { name: "referral_notification",       desc: "Notification events (8 types) per referral" },
];

const TABS = ["overview","referrals","codes","campaigns","rewards","flowchart","integrations"] as const;
type Tab = typeof TABS[number];

// ── component ────────────────────────────────────────────────────────────────

export default function ReferralAdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Referral Management</h1>
          <p className="text-sm text-gray-500 mt-1">Wave 10 · Referral codes, campaigns, rewards, fraud detection, analytics</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-lg p-1 shadow-sm border border-gray-200 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-4 py-2 rounded-md text-sm font-medium capitalize whitespace-nowrap transition-colors ${
                activeTab === t ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ── */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {KPI.map(k => (
                <div key={k.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <p className="text-xs text-gray-500">{k.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${k.color}`}>{k.value}</p>
                  <p className="text-xs text-gray-400 mt-1">{k.sub}</p>
                </div>
              ))}
            </div>

            {/* Funnel */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h2 className="font-semibold text-gray-800 mb-4">Referral Funnel (Last 30 Days)</h2>
              <div className="flex items-end gap-2">
                {[
                  { label: "Codes Issued", n: 312, pct: 100 },
                  { label: "Clicked",      n: 248, pct: 80 },
                  { label: "Registered",   n: 174, pct: 56 },
                  { label: "Verified",     n: 141, pct: 45 },
                  { label: "Purchased",    n: 108, pct: 35 },
                  { label: "Rewarded",     n: 93,  pct: 30 },
                ].map(f => (
                  <div key={f.label} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs font-semibold text-gray-700">{f.n}</span>
                    <div
                      className="w-full bg-blue-500 rounded-t"
                      style={{ height: `${f.pct * 1.5}px` }}
                    />
                    <span className="text-xs text-gray-500 text-center">{f.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Referrers */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h2 className="font-semibold text-gray-800 mb-3">Top Referrers (Monthly)</h2>
              <div className="space-y-2">
                {[
                  { name: "Priya Sharma",    refs: 42, revenue: "$6,258",  reward: "$1,050" },
                  { name: "Dr. Gupta",       refs: 31, revenue: "$9,269",  reward: "$2,325" },
                  { name: "Raj Kumar",       refs: 28, revenue: "$4,172",  reward: "$700" },
                  { name: "TechCorp HR",     refs: 25, revenue: "$7,475",  reward: "$1,250" },
                  { name: "Ananya Iyer",     refs: 19, revenue: "$2,831",  reward: "$475" },
                ].map((r, i) => (
                  <div key={r.name} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-bold">{i + 1}</span>
                    <span className="flex-1 text-sm font-medium text-gray-800">{r.name}</span>
                    <span className="text-sm text-gray-600">{r.refs} refs</span>
                    <span className="text-sm text-green-600">{r.revenue}</span>
                    <span className="text-sm text-purple-600">{r.reward}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Reward distribution */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h2 className="font-semibold text-gray-800 mb-3">Reward Type Distribution</h2>
              <div className="space-y-2">
                {[
                  { type: "Wallet Credit",        pct: 42, color: "bg-blue-500" },
                  { type: "Gift Card",             pct: 22, color: "bg-purple-500" },
                  { type: "Reward Points",         pct: 18, color: "bg-yellow-500" },
                  { type: "Free Class",            pct: 10, color: "bg-green-500" },
                  { type: "Discount Coupon",       pct: 5,  color: "bg-orange-500" },
                  { type: "Membership Extension",  pct: 3,  color: "bg-pink-500" },
                ].map(r => (
                  <div key={r.type} className="flex items-center gap-3">
                    <span className="w-32 text-xs text-gray-600">{r.type}</span>
                    <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${r.color} rounded-full`} style={{ width: `${r.pct}%` }} />
                    </div>
                    <span className="text-xs text-gray-500 w-8">{r.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── REFERRALS ── */}
        {activeTab === "referrals" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-4 border-b border-gray-100 flex items-center gap-3">
              <h2 className="font-semibold text-gray-800">All Referrals</h2>
              <span className="text-sm text-gray-500">({REFERRALS.length} shown)</span>
              <div className="ml-auto flex gap-2">
                <select className="text-sm border border-gray-200 rounded px-2 py-1 text-gray-600">
                  <option>All Status</option>
                  {Object.keys(STATUS_STYLE).map(s => <option key={s}>{s}</option>)}
                </select>
                <select className="text-sm border border-gray-200 rounded px-2 py-1 text-gray-600">
                  <option>All Types</option>
                  {Object.keys(TYPE_COLOR).map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {["Referrer","Referree","Type","Status","Channel","Amount","Campaign","Actions"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {REFERRALS.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{r.referrer}</td>
                      <td className="px-4 py-3 text-gray-600">{r.referree}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLOR[r.type] ?? "bg-gray-100 text-gray-600"}`}>
                          {r.type.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[r.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {r.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 capitalize">{r.channel?.replace(/_/g, " ")}</td>
                      <td className="px-4 py-3 text-gray-700">{r.amount ? `$${r.amount}` : "—"}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{r.campaign}</td>
                      <td className="px-4 py-3">
                        {r.status === "reward_pending" && (
                          <div className="flex gap-1">
                            <button className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200">Approve</button>
                            <button className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200">Reject</button>
                          </div>
                        )}
                        {r.status === "clicked" && (
                          <button className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">View Fraud</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── CODES ── */}
        {activeTab === "codes" && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-semibold text-gray-800">Referral Codes</h2>
                <button className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  + Generate Code
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {["Code","Referrer","Type","Status","Clicks","Uses","Max Uses","Campaign","Expiry","Actions"].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {CODES.map(c => (
                      <tr key={c.code} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono font-bold text-blue-700">{c.code}</td>
                        <td className="px-4 py-3 text-gray-700">{c.referrer}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${TYPE_COLOR[c.type] ?? "bg-gray-100 text-gray-600"}`}>
                            {c.type.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            c.status === "active" ? "bg-green-100 text-green-700" :
                            c.status === "paused" ? "bg-yellow-100 text-yellow-700" :
                            "bg-red-100 text-red-700"
                          }`}>{c.status}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{c.clicks}</td>
                        <td className="px-4 py-3 text-gray-600">{c.uses}</td>
                        <td className="px-4 py-3 text-gray-500">{c.maxUses ?? "∞"}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{c.campaign}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{c.expiry ?? "No expiry"}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200">QR</button>
                            <button className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200">Copy</button>
                            {c.status === "active" && (
                              <button className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200">Pause</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── CAMPAIGNS ── */}
        {activeTab === "campaigns" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                + New Campaign
              </button>
            </div>
            {CAMPAIGNS.map(c => (
              <div key={c.name} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-800">{c.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        c.status === "active" ? "bg-green-100 text-green-700" :
                        c.status === "paused" ? "bg-yellow-100 text-yellow-700" :
                        c.status === "draft"  ? "bg-gray-100 text-gray-600" :
                        "bg-red-100 text-red-700"
                      }`}>{c.status}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700">{c.type.replace(/_/g," ")}</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      Reward: <strong>{c.rewardType.replace(/_/g," ")}</strong> ·
                      Referrer: <strong>${c.referrerReward}</strong> ·
                      Referee: <strong>${c.referreeReward}</strong>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {c.status === "active" && <button className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded">Pause</button>}
                    {c.status === "draft"  && <button className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">Activate</button>}
                    <button className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">Edit</button>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-lg font-bold text-gray-800">{c.referrals}</p>
                    <p className="text-xs text-gray-500">Referrals</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-lg font-bold text-green-600">{c.conversion}%</p>
                    <p className="text-xs text-gray-500">Conversion</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-lg font-bold text-purple-600">${c.paid.toLocaleString()}</p>
                    <p className="text-xs text-gray-500">Rewards Paid</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-lg font-bold text-blue-600">
                      {c.referrals > 0 ? `${Math.round(c.paid / c.referrals * 10) / 10}` : "—"}
                    </p>
                    <p className="text-xs text-gray-500">Avg Reward</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── REWARDS ── */}
        {activeTab === "rewards" && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="p-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800">Pending Reward Approvals</h2>
                <p className="text-xs text-gray-500 mt-0.5">Requires staff_approval (confirmApprovalId)</p>
              </div>
              <div className="divide-y divide-gray-50">
                {REWARDS_PENDING.map(r => (
                  <div key={r.id} className="p-4 flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800">{r.referrer}</span>
                        {r.flags.length > 0 && (
                          <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">
                            {r.flags.join(", ")}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {r.type.replace(/_/g," ")} · ${r.value} · {r.campaign}
                      </p>
                      <p className="text-xs text-gray-400">Referral: {r.referral}</p>
                    </div>
                    <div className="flex gap-2">
                      <button className="px-3 py-1.5 bg-green-700 text-white text-sm rounded-lg hover:bg-green-800">
                        Approve
                      </button>
                      <button className="px-3 py-1.5 bg-red-100 text-red-700 text-sm rounded-lg hover:bg-red-200">
                        Reject
                      </button>
                      <button className="px-3 py-1.5 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200">
                        Fraud Check
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Fraud Detection */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <h2 className="font-semibold text-gray-800 mb-3">Fraud Detection Rules</h2>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { rule: "Duplicate Email", action: "Auto-reject", status: "active" },
                  { rule: "Duplicate Phone", action: "Auto-reject", status: "active" },
                  { rule: "Duplicate Device", action: "Flag + Review", status: "active" },
                  { rule: "Duplicate IP (24h)", action: "Flag + Hold", status: "active" },
                  { rule: "Self-Referral", action: "Auto-reject", status: "active" },
                  { rule: "VPN Detected", action: "Flag + Hold", status: "active" },
                  { rule: "Max Reward Cap", action: "Auto-reject", status: "active" },
                  { rule: "Blacklisted Domain", action: "Auto-reject", status: "active" },
                ].map(f => (
                  <div key={f.rule} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-700">{f.rule}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-red-600">{f.action}</span>
                      <span className="w-2 h-2 rounded-full bg-green-400" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── FLOWCHART ── */}
        {activeTab === "flowchart" && (
          <div className="space-y-6">
            {/* Referral lifecycle */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h2 className="font-semibold text-gray-800 mb-4">Referral Status State Machine</h2>
              <div className="font-mono text-xs bg-gray-50 rounded-lg p-4 overflow-x-auto whitespace-pre">
{`draft ──► shared ──► clicked ──► registered ──► verified
                                       │               │
                                       └───────────────┤
                                                       │
                                           membership_purchased
                                                       │
                                              reward_pending
                                                       │
                                    ┌──────────────────┤
                                    │                  │
                              reward_rejected    reward_approved
                                                       │
                                                 reward_paid  (terminal)`}
              </div>
            </div>

            {/* Registration flow */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h2 className="font-semibold text-gray-800 mb-4">12-Step Referral Registration Flow</h2>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { n: 1,  step: "Customer requests referral code",        icon: "🔑" },
                  { n: 2,  step: "Portal generates code + URL + QR",        icon: "🔗" },
                  { n: 3,  step: "Customer shares via channel (11 options)", icon: "📤" },
                  { n: 4,  step: "Friend clicks referral link",              icon: "👆" },
                  { n: 5,  step: "Redis dedup check (IP + code, 60s TTL)",  icon: "🛡️" },
                  { n: 6,  step: "Fraud pre-check (email, device, IP, VPN)",icon: "🔍" },
                  { n: 7,  step: "Friend completes registration (Keycloak)", icon: "📝" },
                  { n: 8,  step: "Email / mobile verification",              icon: "✅" },
                  { n: 9,  step: "Friend purchases membership or class pack",icon: "💳" },
                  { n: 10, step: "System calculates reward (campaign rules)",icon: "🧮" },
                  { n: 11, step: "Staff approves reward (or auto-approval)",  icon: "👍" },
                  { n: 12, step: "Reward distributed + Novu notification",   icon: "🎁" },
                ].map(s => (
                  <div key={s.n} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold flex-shrink-0">{s.n}</span>
                    <div>
                      <span className="text-sm">{s.icon}</span>
                      <p className="text-xs text-gray-600 mt-0.5">{s.step}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Reward distribution flow */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h2 className="font-semibold text-gray-800 mb-4">Reward Distribution by Type</h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { type: "wallet_credit",         dest: "referral_wallet.balance += value",          system: "Portal wallet" },
                  { type: "reward_points",          dest: "Gamification.addPoints(customerId, value)", system: "Wave 5" },
                  { type: "discount_coupon",        dest: "CouponMaster.createCoupon()",               system: "Wave 7" },
                  { type: "gift_card",              dest: "GiftVoucher.issueCard()",                   system: "Wave 7" },
                  { type: "free_class",             dest: "eCommerce.createOrder(unitPrice=0)",        system: "Wave 9" },
                  { type: "membership_extension",   dest: "Pricing.Subscription.extendBy(days)",       system: "Wave 8" },
                  { type: "cash",                   dest: "ERPNext Journal Entry (Debit expense)",     system: "ERPNext" },
                  { type: "meditation_course",      dest: "Moodle.enrollCourse(courseId)",             system: "Moodle 8020" },
                ].map(r => (
                  <div key={r.type} className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs font-mono font-bold text-blue-700">{r.type}</p>
                    <p className="text-xs text-gray-600 mt-1">→ {r.dest}</p>
                    <p className="text-xs text-gray-400 mt-0.5">System: {r.system}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── INTEGRATIONS ── */}
        {activeTab === "integrations" && (
          <div className="space-y-6">
            {/* DB tables */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h2 className="font-semibold text-gray-800 mb-4">Master / Reference Tables (12)</h2>
              <div className="grid grid-cols-2 gap-3">
                {DB_TABLES.map(t => (
                  <div key={t.name} className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs font-mono font-bold text-gray-800">{t.name}</p>
                    <p className="text-xs text-gray-500 mt-1">{t.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* MCP Tools */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h2 className="font-semibold text-gray-800 mb-4">MCP Tools (12)</h2>
              <div className="grid grid-cols-2 gap-3">
                {MCP_TOOLS.map(t => (
                  <div key={t.name} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${TIER_STYLE[t.tier] ?? "bg-gray-100 text-gray-600"}`}>
                      {t.tier}
                    </span>
                    <div>
                      <p className="text-xs font-mono font-bold text-gray-800">{t.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{t.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* External systems */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h2 className="font-semibold text-gray-800 mb-3">External System Integration</h2>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {["System","Port","Referral Role","Direction"].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[
                    { sys: "Novu",       port: "4001", role: "8 notification event types",             dir: "→ Novu API" },
                    { sys: "PostHog",    port: "—",    role: "Click, registration, conversion events", dir: "→ PostHog API" },
                    { sys: "Frappe CRM", port: "8080", role: "Lead creation when referree registers",  dir: "→ Frappe API" },
                    { sys: "ERPNext",    port: "8080", role: "Cash reward journal entries",            dir: "→ ERPNext API" },
                    { sys: "Redis",      port: "6379", role: "Click dedup (SET NX 60s), code cache",  dir: "← SET/GET" },
                    { sys: "Metabase",   port: "3001", role: "v_top_referrers + v_campaign_performance", dir: "← DB views" },
                    { sys: "Postiz",     port: "5000", role: "Social share (Facebook, Instagram, LinkedIn)", dir: "→ Postiz API" },
                    { sys: "GrowthBook", port: "—",    role: "A/B testing campaign variants",         dir: "→ GrowthBook API" },
                    { sys: "Moodle",     port: "8020", role: "meditation_course reward enrollment",   dir: "→ Moodle API" },
                    { sys: "Cal.com",    port: "3100", role: "workshop_access reward booking",        dir: "→ Cal.com API" },
                  ].map(r => (
                    <tr key={r.sys} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-800">{r.sys}</td>
                      <td className="px-3 py-2 font-mono text-gray-600">{r.port}</td>
                      <td className="px-3 py-2 text-gray-600">{r.role}</td>
                      <td className="px-3 py-2 font-mono text-xs text-blue-600">{r.dir}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cross-wave integration */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h2 className="font-semibold text-gray-800 mb-3">Cross-Wave Integration</h2>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {["Wave","Domain","Integration Point"].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[
                    { wave: "Wave 5", domain: "Gamification",  point: "reward_points reward → addPoints()" },
                    { wave: "Wave 7", domain: "Coupon",         point: "discount_coupon reward → CouponMaster.create(); GiftVoucher.issue()" },
                    { wave: "Wave 8", domain: "Pricing",        point: "membership_extension → Subscription.extendBy(days); vip_membership → upgradePlan()" },
                    { wave: "Wave 9", domain: "eCommerce",      point: "free_class, yoga_mat, merchandise → Order.create(); order_amount → sales tracking" },
                    { wave: "Wave 9", domain: "Marketplace",    point: "teacher_student referral → Marketplace.recordSale() for teacher commission" },
                  ].map(r => (
                    <tr key={`${r.wave}-${r.domain}`} className="hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 text-xs font-medium">{r.wave}</span>
                      </td>
                      <td className="px-3 py-2 font-medium text-gray-700">{r.domain}</td>
                      <td className="px-3 py-2 text-gray-600 font-mono text-xs">{r.point}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
