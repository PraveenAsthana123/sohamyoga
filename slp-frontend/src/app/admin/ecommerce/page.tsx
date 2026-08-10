"use client";

import { useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
type ProductType = "physical" | "digital" | "service" | "subscription" | "bundle" | "workshop" | "retreat" | "course" | "gift_card" | "ayurvedic" | "book" | "membership";
type OrderStatus = "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded" | "returned";
type Tab = "overview" | "products" | "orders" | "inventory" | "marketplace" | "flowchart" | "integrations";

interface ProductRow { id: string; name: string; type: ProductType; sku: string; price: number; stock: number; status: string; rating: number; vendor?: string }
interface OrderRow   { id: string; number: string; customer: string; status: OrderStatus; payment: string; total: number; items: number; date: string; tracking?: string }
interface InventoryRow { id: string; product: string; sku: string; warehouse: string; qty: number; reserved: number; reorderPoint: number; batch?: string }
interface VendorRow  { id: string; name: string; type: string; commission: string; sales: number; pending: number; status: string }

// ─── Mock data ────────────────────────────────────────────────────────────────
const PRODUCTS: ProductRow[] = [
  { id: "p1",  name: "Premium Yoga Mat 6mm",        type: "physical",     sku: "YM-001",     price: 69.99,  stock: 45,  status: "active",      rating: 4.8 },
  { id: "p2",  name: "Ayurvedic Ashwagandha Oil",   type: "ayurvedic",    sku: "AY-012",     price: 29.99,  stock: 120, status: "active",      rating: 4.6 },
  { id: "p3",  name: "30-Day Yoga Foundations",      type: "course",       sku: "CRS-001",    price: 149.0,  stock: 999, status: "active",      rating: 4.9 },
  { id: "p4",  name: "Morning Flow Workshop",        type: "workshop",     sku: "WS-2026-09", price: 89.0,   stock: 12,  status: "active",      rating: 4.7 },
  { id: "p5",  name: "Kerala Retreat (5 nights)",    type: "retreat",      sku: "RET-2026-11",price: 1299.0, stock: 8,   status: "active",      rating: 5.0 },
  { id: "p6",  name: "Yoga Blocks (pair)",           type: "physical",     sku: "BLK-002",    price: 24.99,  stock: 3,   status: "active",      rating: 4.4 },
  { id: "p7",  name: "Gold Membership Monthly",      type: "membership",   sku: "MBR-GOLD-M", price: 149.0,  stock: 999, status: "active",      rating: 4.9 },
  { id: "p8",  name: "Meditation MP3 Bundle",        type: "digital",      sku: "DL-MED-001", price: 19.99,  stock: 999, status: "active",      rating: 4.5 },
  { id: "p9",  name: "Yoga Starter Pack",            type: "bundle",       sku: "BDL-001",    price: 89.0,   stock: 25,  status: "active",      rating: 4.6, vendor: "ananya-studio" },
  { id: "p10", name: "Private Class (60 min)",       type: "service",      sku: "SVC-PRIV-1", price: 120.0,  stock: 20,  status: "active",      rating: 5.0, vendor: "ananya-studio" },
  { id: "p11", name: "Light on Yoga (Book)",         type: "book",         sku: "BK-001",     price: 34.99,  stock: 0,   status: "out_of_stock", rating: 4.8 },
  { id: "p12", name: "CAD 100 Gift Card",            type: "gift_card",    sku: "GC-100",     price: 100.0,  stock: 999, status: "active",      rating: 0 },
];

const ORDERS: OrderRow[] = [
  { id: "o1", number: "ORD-2026-1042", customer: "Alice Chen",        status: "delivered",  payment: "paid",    total: 89.0,   items: 2, date: "2026-07-28", tracking: "1Z999AA10123456784" },
  { id: "o2", number: "ORD-2026-1043", customer: "Bob Sharma",        status: "processing", payment: "paid",    total: 1388.0, items: 1, date: "2026-08-01" },
  { id: "o3", number: "ORD-2026-1044", customer: "Carol Wu",          status: "pending",    payment: "pending", total: 49.98,  items: 2, date: "2026-08-04" },
  { id: "o4", number: "ORD-2026-1045", customer: "David Corp Inc.",   status: "confirmed",  payment: "paid",    total: 1440.0, items: 8, date: "2026-08-04" },
  { id: "o5", number: "ORD-2026-1046", customer: "Emma Patel",        status: "shipped",    payment: "paid",    total: 149.0,  items: 1, date: "2026-08-03", tracking: "TRK2026-0803-E" },
  { id: "o6", number: "ORD-2026-1047", customer: "Frank Novak",       status: "cancelled",  payment: "refunded",total: 69.99,  items: 1, date: "2026-07-30" },
  { id: "o7", number: "ORD-2026-1048", customer: "Grace Kim",         status: "returned",   payment: "refunded",total: 29.99,  items: 1, date: "2026-07-15" },
  { id: "o8", number: "ORD-2026-1049", customer: "Henry Lee",         status: "delivered",  payment: "paid",    total: 268.0,  items: 3, date: "2026-07-20", tracking: "1Z888XY22345678" },
];

const INVENTORY: InventoryRow[] = [
  { id: "inv1", product: "Premium Yoga Mat 6mm",      sku: "YM-001",     warehouse: "Toronto Main",  qty: 45, reserved: 3,  reorderPoint: 10 },
  { id: "inv2", product: "Ayurvedic Ashwagandha Oil", sku: "AY-012",     warehouse: "Toronto Main",  qty: 120,reserved: 8,  reorderPoint: 20, batch: "AY-2026-07" },
  { id: "inv3", product: "Yoga Blocks (pair)",         sku: "BLK-002",   warehouse: "Toronto Main",  qty: 3,  reserved: 0,  reorderPoint: 10 },
  { id: "inv4", product: "Light on Yoga (Book)",       sku: "BK-001",    warehouse: "Toronto Main",  qty: 0,  reserved: 0,  reorderPoint: 5 },
  { id: "inv5", product: "Yoga Starter Pack",          sku: "BDL-001",   warehouse: "Vancouver DC",  qty: 25, reserved: 2,  reorderPoint: 8 },
  { id: "inv6", product: "Premium Yoga Mat 6mm",       sku: "YM-001",    warehouse: "Vancouver DC",  qty: 18, reserved: 1,  reorderPoint: 5 },
];

const VENDORS: VendorRow[] = [
  { id: "v1", name: "Ananya Yoga Studio",  type: "teacher",     commission: "20%",     sales: 4500,  pending: 720,  status: "active" },
  { id: "v2", name: "AyurVeda Canada",     type: "partner",     commission: "15%",     sales: 8200,  pending: 1394, status: "active" },
  { id: "v3", name: "YogaWear Co.",        type: "brand",       commission: "12%",     sales: 2100,  pending: 264,  status: "active" },
  { id: "v4", name: "Priya Wellness",      type: "affiliate",   commission: "CAD 10",  sales: 1200,  pending: 180,  status: "suspended" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ORDER_STATUS_STYLE: Record<OrderStatus, string> = {
  pending:    "bg-yellow-100 text-yellow-800",
  confirmed:  "bg-blue-100 text-blue-700",
  processing: "bg-indigo-100 text-indigo-700",
  shipped:    "bg-purple-100 text-purple-700",
  delivered:  "bg-green-100 text-green-800",
  cancelled:  "bg-gray-200 text-gray-500",
  refunded:   "bg-red-100 text-red-700",
  returned:   "bg-orange-100 text-orange-700",
};

const PRODUCT_TYPE_COLOR: Record<ProductType, string> = {
  physical:     "bg-blue-50 text-blue-700",
  digital:      "bg-purple-50 text-purple-700",
  service:      "bg-green-50 text-green-700",
  subscription: "bg-indigo-50 text-indigo-700",
  bundle:       "bg-yellow-50 text-yellow-800",
  workshop:     "bg-orange-50 text-orange-700",
  retreat:      "bg-pink-50 text-pink-700",
  course:       "bg-teal-50 text-teal-700",
  gift_card:    "bg-red-50 text-red-600",
  ayurvedic:    "bg-emerald-50 text-emerald-700",
  book:         "bg-slate-50 text-slate-700",
  membership:   "bg-violet-50 text-violet-700",
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function EcommerceAdminPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [orderFilter, setOrderFilter] = useState<string>("all");

  const totalRevenue = ORDERS.filter(o => o.payment === "paid").reduce((s, o) => s + o.total, 0);
  const pendingOrders = ORDERS.filter(o => o.status === "pending").length;
  const lowStockItems = INVENTORY.filter(i => i.qty > 0 && i.qty <= i.reorderPoint).length;
  const outOfStock = INVENTORY.filter(i => i.qty === 0).length;

  const filteredOrders = orderFilter === "all"
    ? ORDERS
    : ORDERS.filter(o => o.status === orderFilter);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">eCommerce</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Products · Orders · Inventory · Marketplace · Yoga Commerce
          </p>
        </div>
        <div className="flex gap-2">
          <a href="http://localhost:9003" target="_blank" rel="noopener noreferrer"
            className="px-3 py-1.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100">
            MedusaJS Admin
          </a>
          <a href="http://localhost:8080/app/item" target="_blank" rel="noopener noreferrer"
            className="px-3 py-1.5 text-xs bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100">
            ERPNext Items
          </a>
          <button className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            + Add Product
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Today's Revenue",    value: `$${totalRevenue.toLocaleString()}`, color: "text-green-600",  bg: "bg-green-50" },
          { label: "Pending Orders",     value: pendingOrders,                       color: "text-yellow-700", bg: "bg-yellow-50" },
          { label: "Active Products",    value: PRODUCTS.filter(p => p.status === "active").length, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Low Stock Items",    value: lowStockItems,                       color: "text-orange-600", bg: "bg-orange-50" },
          { label: "Out of Stock",       value: outOfStock,                          color: "text-red-600",    bg: "bg-red-50" },
        ].map(kpi => (
          <div key={kpi.label} className={`${kpi.bg} rounded-lg p-4 border`}>
            <p className="text-xs text-gray-500">{kpi.label}</p>
            <p className={`text-2xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b overflow-x-auto">
        {(["overview","products","orders","inventory","marketplace","flowchart","integrations"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm capitalize whitespace-nowrap ${tab === t ? "border-b-2 border-blue-600 text-blue-600 font-medium" : "text-gray-500 hover:text-gray-700"}`}>
            {t}
          </button>
        ))}
      </div>

      {/* ─── OVERVIEW ─────────────────────────────────────────────────────── */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Revenue by product type */}
          <div className="bg-white border rounded-lg p-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">Product Type Revenue Mix</p>
            <div className="space-y-2">
              {([
                ["membership",  "$8,400", 32],
                ["course",      "$5,600", 22],
                ["retreat",     "$5,200", 20],
                ["physical",    "$3,100", 12],
                ["workshop",    "$1,800", 7],
                ["ayurvedic",   "$1,200", 5],
                ["other",       "$500",   2],
              ] as [string, string, number][]).map(([type, rev, pct]) => (
                <div key={type} className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 w-24">{type}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-medium text-gray-700 w-14 text-right">{rev}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Order status breakdown */}
          <div className="bg-white border rounded-lg p-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">Orders by Status</p>
            <div className="space-y-2">
              {(["delivered","confirmed","processing","shipped","pending","cancelled","refunded","returned"] as OrderStatus[]).map(s => {
                const count = ORDERS.filter(o => o.status === s).length;
                return (
                  <div key={s} className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full w-24 text-center ${ORDER_STATUS_STYLE[s]}`}>{s}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                      <div className="bg-gray-400 h-1.5 rounded-full" style={{ width: `${(count / ORDERS.length) * 100}%` }} />
                    </div>
                    <span className="text-xs w-4">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Yoga-specific commerce features */}
          <div className="bg-white border rounded-lg p-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">Yoga Commerce Features</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                "✅ Yoga Equipment", "✅ Ayurvedic Products", "✅ Books",
                "✅ Online Courses",  "✅ Video Library",      "✅ Gift Cards",
                "✅ Gift Packs",      "✅ Subscription Products","✅ Private Classes",
                "✅ Workshops",       "✅ Retreats",            "✅ Teacher Training",
                "✅ Corporate Package","✅ Gift Membership",    "✅ Downloadable PDFs",
              ].map(f => <span key={f} className="text-gray-600">{f}</span>)}
            </div>
          </div>

          {/* Marketplace summary */}
          <div className="bg-white border rounded-lg p-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">Marketplace Vendors</p>
            <div className="space-y-2">
              {VENDORS.map(v => (
                <div key={v.id} className="flex justify-between items-center text-xs">
                  <span className="text-gray-700 font-medium">{v.name}</span>
                  <span className="text-gray-400">{v.type}</span>
                  <span className="text-green-600 font-medium">${v.sales.toLocaleString()}</span>
                  <span className={`px-1.5 py-0.5 rounded text-xs ${v.status === "active" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>{v.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── PRODUCTS ─────────────────────────────────────────────────────── */}
      {tab === "products" && (
        <div className="space-y-4">
          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{["Product","Type","SKU","Price","Stock","Rating","Status","Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {PRODUCTS.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 text-sm">{p.name}</div>
                      {p.vendor && <div className="text-xs text-gray-400">{p.vendor}</div>}
                    </td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${PRODUCT_TYPE_COLOR[p.type]}`}>{p.type}</span></td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.sku}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">${p.price}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${p.stock === 0 ? "text-red-600" : p.stock <= 5 ? "text-orange-600" : "text-gray-700"}`}>
                        {p.stock === 999 ? "∞" : p.stock}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{p.rating > 0 ? `★ ${p.rating}` : "—"}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs ${p.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>{p.status}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200">Edit</button>
                        <button className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded">Inventory</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── ORDERS ───────────────────────────────────────────────────────── */}
      {tab === "orders" && (
        <div className="space-y-3">
          {/* Filter bar */}
          <div className="flex gap-2 flex-wrap">
            {["all","pending","confirmed","processing","shipped","delivered","cancelled","refunded"].map(f => (
              <button key={f} onClick={() => setOrderFilter(f)}
                className={`text-xs px-3 py-1 rounded-full capitalize ${orderFilter === f ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {f}
              </button>
            ))}
          </div>
          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{["Order","Customer","Status","Payment","Total","Items","Date","Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredOrders.map(o => (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-blue-600">{o.number}</td>
                    <td className="px-4 py-3 font-medium text-gray-900 text-sm">{o.customer}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${ORDER_STATUS_STYLE[o.status]}`}>{o.status}</span></td>
                    <td className="px-4 py-3"><span className={`text-xs ${o.payment === "paid" ? "text-green-600" : o.payment === "refunded" ? "text-red-600" : "text-yellow-700"}`}>{o.payment}</span></td>
                    <td className="px-4 py-3 font-medium">${o.total.toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{o.items} item{o.items > 1 ? "s" : ""}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{o.date}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button className="text-xs px-2 py-1 bg-gray-100 rounded">View</button>
                        {o.status === "pending"    && <button className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded">Confirm</button>}
                        {o.status === "confirmed"  && <button className="text-xs px-2 py-1 bg-indigo-50 text-indigo-700 rounded">Process</button>}
                        {o.status === "processing" && <button className="text-xs px-2 py-1 bg-purple-50 text-purple-700 rounded">Ship</button>}
                        {o.status === "shipped"    && <button className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded">Deliver</button>}
                        {o.status === "delivered"  && <button className="text-xs px-2 py-1 bg-orange-50 text-orange-700 rounded">Refund</button>}
                        {o.tracking && <button className="text-xs px-2 py-1 bg-gray-50 text-gray-500 rounded">Track</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── INVENTORY ────────────────────────────────────────────────────── */}
      {tab === "inventory" && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3 text-xs">
            {[
              { label: "Warehouses",   value: "2 active (Toronto + Vancouver)" },
              { label: "Low Stock",    value: `${lowStockItems} SKUs below reorder point` },
              { label: "Out of Stock", value: `${outOfStock} SKUs — PO required` },
            ].map(s => (
              <div key={s.label} className="bg-white border rounded-lg p-3">
                <p className="text-gray-500">{s.label}</p>
                <p className="font-semibold text-gray-800 mt-0.5">{s.value}</p>
              </div>
            ))}
          </div>
          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{["Product","SKU","Warehouse","On Hand","Reserved","Available","Reorder Pt.","Status","Batch"].map(h => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {INVENTORY.map(i => {
                  const avail = i.qty - i.reserved;
                  const isLow = avail > 0 && avail <= i.reorderPoint;
                  const isOut = avail <= 0;
                  return (
                    <tr key={i.id} className="hover:bg-gray-50">
                      <td className="px-3 py-3 text-gray-900 font-medium text-xs">{i.product}</td>
                      <td className="px-3 py-3 font-mono text-xs text-gray-500">{i.sku}</td>
                      <td className="px-3 py-3 text-xs text-gray-500">{i.warehouse}</td>
                      <td className="px-3 py-3 text-xs font-medium text-gray-700">{i.qty}</td>
                      <td className="px-3 py-3 text-xs text-gray-500">{i.reserved}</td>
                      <td className="px-3 py-3 text-xs font-semibold">{avail}</td>
                      <td className="px-3 py-3 text-xs text-gray-400">{i.reorderPoint}</td>
                      <td className="px-3 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isOut ? "bg-red-100 text-red-700" : isLow ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700"}`}>
                          {isOut ? "out_of_stock" : isLow ? "low_stock" : "in_stock"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-400">{i.batch ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── MARKETPLACE ──────────────────────────────────────────────────── */}
      {tab === "marketplace" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {VENDORS.map(v => (
              <div key={v.id} className="bg-white border rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <p className="font-semibold text-gray-900 text-sm">{v.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded ${v.status === "active" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>{v.status}</span>
                </div>
                <div className="text-xs text-gray-500 space-y-1">
                  <div><span className="text-gray-400">Type:</span> {v.type}</div>
                  <div><span className="text-gray-400">Commission:</span> {v.commission}</div>
                  <div><span className="text-gray-400">Total Sales:</span> <span className="text-green-600 font-medium">${v.sales.toLocaleString()}</span></div>
                  <div><span className="text-gray-400">Pending Balance:</span> <span className="text-blue-600 font-medium">${v.pending.toLocaleString()}</span></div>
                </div>
                <div className="flex gap-1 pt-1 border-t">
                  <button className="text-xs px-2 py-1 bg-gray-100 rounded">Products</button>
                  <button className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded">Settle</button>
                </div>
              </div>
            ))}
          </div>

          {/* MCP Tools */}
          <div className="bg-white border rounded-lg p-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">eCommerce MCP Tools (12)</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              {[
                { tier: "Auto / Read-only",    color: "bg-green-50 border-green-200 text-green-800",    tools: ["search_product", "recommend_product", "inventory_status", "wallet_balance", "subscription_status", "track_order"] },
                { tier: "Staff / Customer",     color: "bg-blue-50 border-blue-200 text-blue-800",       tools: ["create_order", "generate_invoice", "create_coupon", "return_request (confirmText=REQUEST_RETURN)"] },
                { tier: "Approval / Destructive", color: "bg-red-50 border-red-200 text-red-800",        tools: ["refund_order (confirmApprovalId)", "cancel_order (confirmText=CANCEL_ORDER + approvalId)"] },
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

      {/* ─── FLOWCHART ────────────────────────────────────────────────────── */}
      {tab === "flowchart" && (
        <div className="space-y-6">
          {/* Order lifecycle */}
          <div className="bg-white border rounded-lg p-5">
            <p className="text-sm font-semibold text-gray-700 mb-4">Order Lifecycle State Machine</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
              {[
                { from: "draft",       to: "pending",           action: "submit()" },
                { from: "pending",     to: "confirmed",         action: "confirm()" },
                { from: "confirmed",   to: "processing",        action: "startProcessing()" },
                { from: "processing",  to: "shipped",           action: "ship(trackingNumber)" },
                { from: "confirmed",   to: "shipped",           action: "ship() (small orders)" },
                { from: "shipped",     to: "delivered",         action: "deliver()" },
                { from: "delivered",   to: "returned",          action: "requestReturn(reason)" },
                { from: "delivered",   to: "refunded",          action: "refund(amount, reason)" },
                { from: "any",         to: "cancelled",         action: "cancel(reason) — pre-delivery" },
              ].map(({ from, to, action }) => (
                <div key={action} className="border rounded p-2 bg-gray-50">
                  <div className="flex items-center gap-1">
                    <span className="px-1.5 py-0.5 rounded bg-gray-200 text-gray-700">{from}</span>
                    <span className="text-gray-400">→</span>
                    <span className="px-1.5 py-0.5 rounded bg-gray-200 text-gray-700">{to}</span>
                  </div>
                  <p className="text-gray-500 mt-1 font-mono">{action}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Checkout flow */}
          <div className="bg-white border rounded-lg p-5">
            <p className="text-sm font-semibold text-gray-700 mb-4">Checkout Process Flow</p>
            <div className="flex flex-col gap-2 text-xs">
              {[
                { step:"1", label:"Cart subtotal", color:"bg-gray-50" },
                { step:"2", label:"Apply pricing rules (Wave 8: early_bird, peak_off_peak, occupancy)", color:"bg-blue-50" },
                { step:"3", label:"Apply coupon code → OfferKit validate + Redis 15-min reservation (Wave 7)", color:"bg-blue-50" },
                { step:"4", label:"Apply gift card balance → GiftVoucher.redeem() (Wave 7)", color:"bg-blue-50" },
                { step:"5", label:"Apply wallet credit → wallet.balance deduction", color:"bg-blue-50" },
                { step:"6", label:"Apply reward points → Gamification domain (100 pts = CAD 5)", color:"bg-blue-50" },
                { step:"7", label:"Calculate shipping → ERPNext carrier rates by region + weight", color:"bg-yellow-50" },
                { step:"8", label:"Calculate tax → ERPNext Tax Template (HST 13% / GST 5%)", color:"bg-yellow-50" },
                { step:"9", label:"Final total = subtotal + shipping + tax − all discounts (min CAD 0)", color:"bg-green-50" },
                { step:"10", label:"MedusaJS cart → Stripe payment_intent created", color:"bg-purple-50" },
                { step:"11", label:"Payment confirmed → sales_order.status=confirmed + ERPNext Sales Invoice", color:"bg-purple-50" },
                { step:"12", label:"Novu: order_confirmed + invoice email; PostHog: order_placed event", color:"bg-indigo-50" },
              ].map(({ step, label, color }) => (
                <div key={step} className={`flex items-start gap-3 p-2 rounded border ${color}`}>
                  <span className="w-5 h-5 rounded-full bg-gray-600 text-white flex items-center justify-center text-xs shrink-0 mt-0.5">{step}</span>
                  <span className="text-gray-700">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Inventory flow */}
          <div className="bg-white border rounded-lg p-5">
            <p className="text-sm font-semibold text-gray-700 mb-4">Inventory Movement Flow</p>
            <div className="flex flex-col gap-2 text-xs">
              {[
                "1. Purchase Order created (ERPNext PO) → supplier notified",
                "2. Goods received → Inventory.receive(qty, PO-ref, {batchNumber, expiryDate})",
                "3. Customer adds to cart → Inventory.reserve(qty, cartId) — Redis lock 15min",
                "4. Order confirmed → Inventory.commit(qty, orderId) — stock_movement type=sale",
                "5. Shipment dispatched → ERPNext Stock Ledger Entry created",
                "6. Customer return → Inventory.addReturn(qty, orderId) — stock restored",
                "7. Stock <= reorderPoint → Novu low_stock_alert + ERPNext auto-PO suggestion",
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-2 p-2 bg-gray-50 rounded border text-gray-600">
                  <span className="font-medium text-gray-500 shrink-0">{i + 1}.</span>
                  <span>{step.substring(3)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── INTEGRATIONS ─────────────────────────────────────────────────── */}
      {tab === "integrations" && (
        <div className="space-y-4">
          {/* Master tables */}
          <div className="bg-white border rounded-lg p-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">Database Master Tables (PostgreSQL 15)</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {[
                { table: "category",        cols: "id · name · slug · parent_id · sort_order · is_active" },
                { table: "product_master",  cols: "id · name · slug · product_type · status · base_price · sku · stock · track_inventory · taxable · hsn_code · vendor_id · teacher_id · categories[] · tags[]" },
                { table: "product_variant", cols: "id · product_id(FK) · sku · name · attributes(JSONB) · price · stock · is_active" },
                { table: "warehouse",       cols: "id · name · code · address(JSONB) · is_default · is_active" },
                { table: "inventory",       cols: "id · product_id(FK) · variant_id · warehouse_id(FK) · quantity · reserved_quantity · reorder_point · batch_number · expiry_date · location" },
                { table: "stock_movement",  cols: "id · inventory_id(FK) · movement_type · quantity · reference_id · reason · performed_by · performed_at" },
                { table: "supplier",        cols: "id · name · contact_email · payment_terms · currency · is_active" },
                { table: "purchase_order",  cols: "id · po_number · supplier_id(FK) · warehouse_id(FK) · status · total · expected_date" },
                { table: "sales_order",     cols: "id · order_number · customer_id · status · payment_status · fulfillment_status · subtotal · coupon_discount · total · shipping_address(JSONB)" },
                { table: "order_item",      cols: "id · order_id(FK) · product_id · product_type · sku · quantity · unit_price · tax_amount · is_digital · teacher_id · vendor_id" },
                { table: "shipment",        cols: "id · order_id(FK) · tracking_number · carrier · status · shipped_at · delivered_at" },
                { table: "payment",         cols: "id · order_id(FK) · payment_method · amount · status · provider_ref · refunded_amount" },
                { table: "wallet",          cols: "id · customer_id(UNIQUE) · balance · reward_points · currency" },
                { table: "vendor",          cols: "id · name · slug · vendor_type · status · commission_type · commission_rate · commission_tiers(JSONB) · pending_balance" },
                { table: "commission",      cols: "id · vendor_id(FK) · order_id(FK) · gross_amount · commission_amount · net_amount · status · period" },
              ].map(({ table, cols }) => (
                <div key={table} className="border rounded p-3 bg-gray-50">
                  <p className="font-mono font-semibold text-gray-800 mb-1">{table}</p>
                  <p className="text-gray-500">{cols}</p>
                </div>
              ))}
            </div>
          </div>

          {/* External integrations */}
          <div className="bg-white border rounded-lg p-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">External System Integrations</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b">
                  <tr>{["System","Port","Role","Events","Direction"].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y">
                  {[
                    ["MedusaJS",  "9003/9004", "Cart, order, catalog, Stripe payment",     "cart.created, order.placed, payment.captured",   "↔ bidirectional"],
                    ["ERPNext",   "8080",      "Sales Invoice, Stock Entry, Payment, PO",   "subscription.activate, order.confirmed, GRN",    "→ ERPNext API"],
                    ["OfferKit",  "3050",      "Coupon validation + Redis reserve",         "POST /apply at checkout step 3",                 "↔ bidirectional"],
                    ["Stripe",    "—",         "Payment gateway; webhook → payment.status", "payment_intent.succeeded, charge.refunded",      "← Stripe webhook"],
                    ["Cal.com",   "3100",      "Workshop/retreat capacity as inventory",    "booking.confirmed → inventory.commit()",         "← Cal.com API"],
                    ["Moodle",    "8020",      "Course enrollment on digital purchase",     "order.confirmed → Moodle enrol_user API",        "→ Moodle API"],
                    ["Redis",     "6379",      "Cart TTL 24h; reservation lock 15min",     "SET cart:{id} EX 86400; SET reserve:{sku} EX 900","← SET NX"],
                    ["PostHog",   "—",         "Funnel analytics, A/B testing",            "product_viewed, add_to_cart, order_placed",       "→ PostHog API"],
                    ["Novu",      "4001",      "Order/shipment/refund notifications",       "order_confirmed, shipment_dispatched, refund_processed","→ Novu API"],
                    ["Metabase",  "3001",      "Sales dashboards via DB views",            "v_sales_summary, v_vendor_performance",           "← DB views"],
                    ["Chatwoot",  "—",         "Pre/post-purchase live chat",              "chat widget on product + checkout pages",         "↔ bidirectional"],
                  ].map(([sys, port, role, events, dir]) => (
                    <tr key={sys} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-800">{sys}</td>
                      <td className="px-3 py-2 font-mono text-gray-500">{port}</td>
                      <td className="px-3 py-2 text-gray-600">{role}</td>
                      <td className="px-3 py-2 text-gray-500">{events}</td>
                      <td className="px-3 py-2 font-mono text-blue-600">{dir}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
