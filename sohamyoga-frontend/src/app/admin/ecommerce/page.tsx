"use client";

import { useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
type ProductType = "physical" | "digital" | "service" | "subscription" | "bundle" | "workshop" | "retreat" | "course" | "gift_card" | "ayurvedic" | "book" | "membership";
type OrderStatus = "draft" | "pending" | "confirmed" | "processing" | "partially_shipped" | "shipped" | "delivered" | "cancelled" | "refunded" | "returned";
type Tab = "overview" | "products" | "orders" | "inventory" | "marketplace" | "flowchart" | "integrations";

interface ProductRow { id: string; name: string; type: ProductType; sku: string; price: number; stock: number; status: string; rating: number; vendor?: string; vendorId?: string }
interface OrderRow   { id: string; number: string; customer: string; status: OrderStatus; payment: string; total: number; items: number; date: string; tracking?: string }
interface InventoryRow { id: string; product: string; sku: string; warehouse: string; qty: number; reserved: number; reorderPoint: number; batch?: string }
interface VendorRow  { id: string; name: string; type: string; commission: string; sales: number; pending: number; status: string }
interface DashboardData {
  kpis: { todayRevenue: number; pendingOrders: number; activeProducts: number; lowStock: number; outOfStock: number };
  revenueByType: { type: string; revenue: number; pct: number }[];
  ordersByStatus: { status: string; count: number; pct: number }[];
  totalOrders: number;
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

interface CategoryOption { id: string; name: string; slug: string; parentSlug?: string }

const SERVICE_LIKE_TYPES: ProductType[] = ["service", "workshop", "course"];

function ProductFormModal({ vendors, onClose, onCreated }: {
  vendors: VendorRow[]; onClose: () => void; onCreated: () => void;
}) {
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [name, setName] = useState("");
  const [productType, setProductType] = useState<ProductType>("service");
  const [categorySlug, setCategorySlug] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchJson<{ categories: CategoryOption[] }>("/api/ecommerce/categories").then(d => setCategories(d?.categories ?? []));
  }, []);

  const activeVendors = vendors.filter(v => v.status === "active");
  const isService = SERVICE_LIKE_TYPES.includes(productType);

  async function submit() {
    setError("");
    const price = Number(basePrice);
    if (!name.trim()) return setError("Name is required.");
    if (!Number.isFinite(price) || price < 0) return setError("Enter a valid price.");
    setSaving(true);
    const res = await fetch("/api/ecommerce/products", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name, productType, basePrice: price, shortDescription,
        categorySlug: categorySlug || undefined, vendorId: vendorId || undefined,
        durationMinutes: isService && durationMinutes ? Number(durationMinutes) : undefined,
      }),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error ?? "Failed to create listing."); return; }
    onCreated();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-900">New Listing</h2>
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
        <div className="grid gap-3">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Name (e.g. Social Media Management — Monthly)"
            className="border rounded-lg px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-3">
            <select value={productType} onChange={e => setProductType(e.target.value as ProductType)} className="border rounded-lg px-3 py-2 text-sm">
              {(Object.keys(PRODUCT_TYPE_COLOR) as ProductType[]).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={categorySlug} onChange={e => setCategorySlug(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
              <option value="">No category</option>
              {categories.map(c => (
                <option key={c.slug} value={c.slug}>{c.parentSlug ? `— ${c.name}` : c.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input value={basePrice} onChange={e => setBasePrice(e.target.value)} placeholder="Price (CAD)" type="number" min="0" step="0.01"
              className="border rounded-lg px-3 py-2 text-sm" />
            {isService && (
              <input value={durationMinutes} onChange={e => setDurationMinutes(e.target.value)} placeholder="Duration (minutes)" type="number" min="0"
                className="border rounded-lg px-3 py-2 text-sm" />
            )}
          </div>
          <select value={vendorId} onChange={e => setVendorId(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
            <option value="">Sold directly by the studio</option>
            {activeVendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          {vendors.length > 0 && activeVendors.length === 0 && (
            <p className="text-xs text-amber-600">No vendors are active yet — this listing will be sold directly by the studio.</p>
          )}
          <textarea value={shortDescription} onChange={e => setShortDescription(e.target.value)} placeholder="Short description"
            rows={3} className="border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Saving…" : "Create draft listing"}
          </button>
        </div>
        <p className="text-xs text-gray-400">New listings start as <code>draft</code> — publish from the Products tab once ready.</p>
      </div>
    </div>
  );
}

function VendorFormModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [vendorType, setVendorType] = useState("independent");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [commissionRate, setCommissionRate] = useState("15");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setError("");
    if (!name.trim()) return setError("Vendor name is required.");
    if (!email.trim()) return setError("Vendor email is required.");
    setSaving(true);
    const res = await fetch("/api/ecommerce/vendors", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, vendorType, email, phone, commissionType: "percentage", commissionRate: Number(commissionRate) }),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error ?? "Failed to onboard vendor."); return; }
    onCreated();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-900">Onboard Vendor</h2>
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
        <div className="grid gap-3">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Vendor / business name" className="border rounded-lg px-3 py-2 text-sm" />
          <select value={vendorType} onChange={e => setVendorType(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
            {["teacher", "partner", "brand", "affiliate", "independent"].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" type="email" className="border rounded-lg px-3 py-2 text-sm" />
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone (optional)" className="border rounded-lg px-3 py-2 text-sm" />
          <div>
            <label className="text-xs text-gray-500">Commission rate (%)</label>
            <input value={commissionRate} onChange={e => setCommissionRate(e.target.value)} type="number" min="0" max="100"
              className="border rounded-lg px-3 py-2 text-sm w-full mt-1" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Saving…" : "Onboard vendor"}
          </button>
        </div>
        <p className="text-xs text-gray-400">New vendors start as <code>pending</code> — activate them below once verified.</p>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ORDER_STATUS_STYLE: Record<string, string> = {
  draft:      "bg-gray-100 text-gray-500",
  pending:    "bg-yellow-100 text-yellow-800",
  confirmed:  "bg-blue-100 text-blue-700",
  processing: "bg-indigo-100 text-indigo-700",
  partially_shipped: "bg-purple-100 text-purple-600",
  shipped:    "bg-purple-100 text-purple-700",
  delivered:  "bg-green-100 text-green-800",
  cancelled:  "bg-gray-200 text-gray-500",
  refunded:   "bg-red-100 text-red-700",
  returned:   "bg-orange-100 text-orange-700",
};

const PRODUCT_TYPE_COLOR: Record<string, string> = {
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

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [activeWarehouses, setActiveWarehouses] = useState(0);
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [vendorFilter, setVendorFilter] = useState<string | null>(null);

  const reloadCore = () => Promise.all([
    fetchJson<DashboardData>("/api/ecommerce/dashboard"),
    fetchJson<{ products: ProductRow[] }>("/api/ecommerce/products"),
    fetchJson<{ inventory: InventoryRow[]; activeWarehouses: number }>("/api/ecommerce/inventory"),
    fetchJson<{ vendors: VendorRow[] }>("/api/ecommerce/vendors"),
  ]).then(([dash, prod, inv, ven]) => {
    setDashboard(dash);
    setProducts(prod?.products ?? []);
    setInventory(inv?.inventory ?? []);
    setActiveWarehouses(inv?.activeWarehouses ?? 0);
    setVendors(ven?.vendors ?? []);
    setLoading(false);
  });

  useEffect(() => { reloadCore(); }, []);

  useEffect(() => {
    const qs = orderFilter === "all" ? "" : `?status=${orderFilter}`;
    fetchJson<{ orders: OrderRow[] }>(`/api/ecommerce/orders${qs}`).then(d => setOrders(d?.orders ?? []));
  }, [orderFilter]);

  useEffect(() => {
    if (!vendorFilter) return;
    fetchJson<{ products: ProductRow[] }>(`/api/ecommerce/products?vendorId=${vendorFilter}`).then(d => setProducts(d?.products ?? []));
  }, [vendorFilter]);

  const vendorFilterName = vendorFilter ? vendors.find(v => v.id === vendorFilter)?.name : undefined;

  const kpis = dashboard?.kpis;

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
          <button onClick={() => setShowProductModal(true)} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            + Add Product
          </button>
        </div>
      </div>

      {showProductModal && (
        <ProductFormModal vendors={vendors} onClose={() => setShowProductModal(false)}
          onCreated={() => { setShowProductModal(false); reloadCore(); setTab("products"); }} />
      )}
      {showVendorModal && (
        <VendorFormModal onClose={() => setShowVendorModal(false)}
          onCreated={() => { setShowVendorModal(false); reloadCore(); }} />
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Today's Revenue",    value: `$${(kpis?.todayRevenue ?? 0).toLocaleString()}`, color: "text-green-600",  bg: "bg-green-50" },
          { label: "Pending Orders",     value: kpis?.pendingOrders ?? 0,                       color: "text-yellow-700", bg: "bg-yellow-50" },
          { label: "Active Products",    value: kpis?.activeProducts ?? 0, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Low Stock Items",    value: kpis?.lowStock ?? 0,                       color: "text-orange-600", bg: "bg-orange-50" },
          { label: "Out of Stock",       value: kpis?.outOfStock ?? 0,                          color: "text-red-600",    bg: "bg-red-50" },
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
            {loading ? <EmptyState message="Loading…" /> : !dashboard?.revenueByType.length ? (
              <EmptyState message="No sales recorded yet." />
            ) : (
              <div className="space-y-2">
                {dashboard.revenueByType.map(({ type, revenue, pct }) => (
                  <div key={type} className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 w-24">{type}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-medium text-gray-700 w-14 text-right">${revenue.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Order status breakdown */}
          <div className="bg-white border rounded-lg p-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">Orders by Status</p>
            {loading ? <EmptyState message="Loading…" /> : !dashboard?.ordersByStatus.length ? (
              <EmptyState message="No orders yet." />
            ) : (
              <div className="space-y-2">
                {dashboard.ordersByStatus.map(({ status, count, pct }) => (
                  <div key={status} className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full w-28 text-center ${ORDER_STATUS_STYLE[status] ?? "bg-gray-100 text-gray-600"}`}>{status}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                      <div className="bg-gray-400 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs w-4">{count}</span>
                  </div>
                ))}
              </div>
            )}
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
            {vendors.length === 0 ? <EmptyState message="No vendors onboarded yet." /> : (
              <div className="space-y-2">
                {vendors.map(v => (
                  <div key={v.id} className="flex justify-between items-center text-xs">
                    <span className="text-gray-700 font-medium">{v.name}</span>
                    <span className="text-gray-400">{v.type}</span>
                    <span className="text-green-600 font-medium">${v.sales.toLocaleString()}</span>
                    <span className={`px-1.5 py-0.5 rounded text-xs ${v.status === "active" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>{v.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── PRODUCTS ─────────────────────────────────────────────────────── */}
      {tab === "products" && (
        <div className="space-y-4">
          {vendorFilter && (
            <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-800">
              <span>Showing listings from <strong>{vendorFilterName ?? "this vendor"}</strong></span>
              <button onClick={() => { setVendorFilter(null); reloadCore(); }} className="text-xs underline">Clear filter</button>
            </div>
          )}
          {products.length === 0 ? <EmptyState message={loading ? "Loading…" : "No products yet. Add one to get started."} /> : (
          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{["Product","Type","SKU","Price","Stock","Rating","Status","Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 text-sm">{p.name}</div>
                      {p.vendor && <div className="text-xs text-gray-400">{p.vendor}</div>}
                    </td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${PRODUCT_TYPE_COLOR[p.type] ?? ""}`}>{p.type}</span></td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.sku}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">${p.price}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${p.stock === 0 ? "text-red-600" : p.stock <= 5 ? "text-orange-600" : "text-gray-700"}`}>
                        {p.stock}
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
          )}
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
          {orders.length === 0 ? <EmptyState message="No orders match this filter." /> : (
          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{["Order","Customer","Status","Payment","Total","Items","Date","Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map(o => (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-blue-600">{o.number}</td>
                    <td className="px-4 py-3 font-medium text-gray-900 text-sm">{o.customer}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${ORDER_STATUS_STYLE[o.status] ?? "bg-gray-100 text-gray-600"}`}>{o.status}</span></td>
                    <td className="px-4 py-3"><span className={`text-xs ${o.payment === "paid" ? "text-green-600" : o.payment === "refunded" ? "text-red-600" : "text-yellow-700"}`}>{o.payment}</span></td>
                    <td className="px-4 py-3 font-medium">${o.total.toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{o.items} item{o.items !== 1 ? "s" : ""}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{new Date(o.date).toLocaleDateString()}</td>
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
          )}
        </div>
      )}

      {/* ─── INVENTORY ────────────────────────────────────────────────────── */}
      {tab === "inventory" && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3 text-xs">
            {[
              { label: "Warehouses",   value: `${activeWarehouses} active` },
              { label: "Low Stock",    value: `${kpis?.lowStock ?? 0} SKUs below reorder point` },
              { label: "Out of Stock", value: `${kpis?.outOfStock ?? 0} SKUs — PO required` },
            ].map(s => (
              <div key={s.label} className="bg-white border rounded-lg p-3">
                <p className="text-gray-500">{s.label}</p>
                <p className="font-semibold text-gray-800 mt-0.5">{s.value}</p>
              </div>
            ))}
          </div>
          {inventory.length === 0 ? <EmptyState message="No inventory records yet." /> : (
          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{["Product","SKU","Warehouse","On Hand","Reserved","Available","Reorder Pt.","Status","Batch"].map(h => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {inventory.map(i => {
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
          )}
        </div>
      )}

      {/* ─── MARKETPLACE ──────────────────────────────────────────────────── */}
      {tab === "marketplace" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">Teachers, partners, and brands who sell products or services (e.g. digital marketing services) through this marketplace.</p>
            <button onClick={() => setShowVendorModal(true)} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex-shrink-0">
              + Onboard Vendor
            </button>
          </div>
          {vendors.length === 0 ? <EmptyState message="No vendors onboarded yet." /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {vendors.map(v => (
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
                  <button onClick={() => { setVendorFilter(v.id); setTab("products"); }} className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200">Products</button>
                  {v.status === "pending" && (
                    <button
                      onClick={async () => { await fetch("/api/ecommerce/vendors", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: v.id, status: "active" }) }); reloadCore(); }}
                      className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded hover:bg-green-100">Activate</button>
                  )}
                  {v.status === "active" && (
                    <button
                      onClick={async () => { await fetch("/api/ecommerce/vendors", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: v.id, status: "suspended" }) }); reloadCore(); }}
                      className="text-xs px-2 py-1 bg-red-50 text-red-700 rounded hover:bg-red-100">Suspend</button>
                  )}
                </div>
              </div>
            ))}
          </div>
          )}

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
