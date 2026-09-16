'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface RetailProduct {
  id: string;
  name: string;
  category: string | null;
  sku: string | null;
  price: string | null;
  cost: string | null;
  stock_qty: number;
  sold_30d: number;
  sold_90d: number;
  revenue_30d: string | null;
  return_rate: string | null;
  avg_rating: string | null;
  tags: string[] | null;
  created_at: string;
}

interface AIRecommendation {
  id: string;
  recommendation_type: string;
  product_id: string | null;
  title: string;
  description: string | null;
  expected_lift_pct: string | null;
  confidence: string | null;
  priority: string;
  status: string;
  ai_source: string;
  created_at: string;
  product_name: string | null;
}

interface DemandForecast {
  id: string;
  product_id: string;
  forecast_date: string;
  predicted_units: number | null;
  actual_units: number | null;
  confidence_interval_low: number | null;
  confidence_interval_high: number | null;
  model_used: string;
  product_name: string | null;
  day_of_week?: string;
}

interface Segment {
  name: string;
  description: string;
  count: number;
  avg_order_value: number;
  recommended_action: string;
  color: string;
  pct: number;
}

interface PriceHistory {
  id: string;
  product_id: string;
  old_price: string;
  new_price: string;
  reason: string;
  changed_at: string;
  product_name: string | null;
}

interface Summary {
  totalSkus: number;
  pendingRecommendations: number;
  highPriorityRecommendations: number;
  avgRating: number;
  lowStockAlerts: number;
  revenue30d: number;
}

interface DashboardData {
  summary: Summary;
  products: RetailProduct[];
  recommendations: AIRecommendation[];
  forecasts: DemandForecast[];
  priceHistory: PriceHistory[];
}

interface PriceOptResult {
  recommended_price: number;
  new_margin_pct: number;
  reasoning: string;
  expected_units_change_pct: number;
  expected_revenue_change_pct: number;
  ai_source: string;
  current_price: number;
  current_margin_pct: number;
  price_changed: boolean;
}

type TabName = 'Dashboard' | 'Products' | 'Demand Forecasting' | 'Customer Segments' | 'Price Optimizer' | 'AI Insights';
const TABS: TabName[] = ['Dashboard', 'Products', 'Demand Forecasting', 'Customer Segments', 'Price Optimizer', 'AI Insights'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number | string | null | undefined, dec = 2): string {
  const num = parseFloat(String(n ?? 0));
  if (isNaN(num)) return '0';
  return num.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function fmtCurrency(n: number | string | null | undefined): string {
  const num = parseFloat(String(n ?? 0));
  if (isNaN(num)) return '$0.00';
  return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function priorityBadge(priority: string): string {
  if (priority === 'high') return 'bg-red-100 text-red-800';
  if (priority === 'medium') return 'bg-yellow-100 text-yellow-800';
  return 'bg-gray-100 text-gray-700';
}

function typeBadge(type: string): string {
  const map: Record<string, string> = {
    reorder_alert: 'bg-red-100 text-red-800',
    review_quality: 'bg-orange-100 text-orange-800',
    discontinue: 'bg-gray-100 text-gray-700',
    promote: 'bg-green-100 text-green-800',
    product_bundle: 'bg-blue-100 text-blue-800',
    price_change: 'bg-purple-100 text-purple-800',
  };
  return map[type] ?? 'bg-gray-100 text-gray-700';
}

function stockColor(qty: number): string {
  if (qty <= 10) return 'text-red-600 font-semibold';
  if (qty <= 30) return 'text-yellow-600 font-semibold';
  return 'text-green-600';
}

function stockBar(qty: number, max = 200): string {
  const pct = Math.min(100, Math.round((qty / max) * 100));
  const color = qty <= 10 ? 'bg-red-500' : qty <= 30 ? 'bg-yellow-400' : 'bg-green-500';
  return `${color} h-2 rounded`;
}

function ratingStars(rating: string | null): string {
  const r = parseFloat(rating ?? '0');
  const full = Math.floor(r);
  const half = r - full >= 0.5;
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(Math.max(0, 5 - full - (half ? 1 : 0)));
}

function sparkBar(units: number, max: number): string {
  const pct = max > 0 ? Math.round((units / max) * 20) : 0;
  return '▓'.repeat(Math.max(1, pct)) + '░'.repeat(Math.max(0, 20 - pct));
}

function segmentColor(color: string): string {
  const map: Record<string, string> = {
    green: 'border-l-4 border-green-500 bg-green-50',
    blue: 'border-l-4 border-blue-500 bg-blue-50',
    orange: 'border-l-4 border-orange-500 bg-orange-50',
    purple: 'border-l-4 border-purple-500 bg-purple-50',
    gray: 'border-l-4 border-gray-400 bg-gray-50',
  };
  return map[color] ?? 'border-l-4 border-gray-400 bg-gray-50';
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-200">
      <div className="text-sm text-gray-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color ?? 'text-slate-800'}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

// ─── Tab: Dashboard ──────────────────────────────────────────────────────────

function DashboardTab({
  summary, products, recommendations,
  onApply, onDismiss,
}: {
  summary: Summary;
  products: RetailProduct[];
  recommendations: AIRecommendation[];
  onApply: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const top5 = [...products].sort((a, b) => parseFloat(b.revenue_30d ?? '0') - parseFloat(a.revenue_30d ?? '0')).slice(0, 5);
  const bottom3 = [...products].sort((a, b) => parseFloat(a.revenue_30d ?? '0') - parseFloat(b.revenue_30d ?? '0')).slice(0, 3);
  const highRecs = recommendations.filter((r) => r.priority === 'high' && r.status === 'pending');
  const pendingRecs = recommendations.filter((r) => r.status === 'pending').slice(0, 6);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard label="Total SKUs" value={summary.totalSkus} sub="Active products" />
        <KpiCard label="30d Revenue" value={fmtCurrency(summary.revenue30d)} sub="Gross revenue" color="text-green-700" />
        <KpiCard label="Pending AI Recs" value={summary.pendingRecommendations} sub="Awaiting review" color={summary.pendingRecommendations > 0 ? 'text-amber-600' : 'text-slate-800'} />
        <KpiCard label="High Priority" value={summary.highPriorityRecommendations} sub="Urgent actions" color={summary.highPriorityRecommendations > 0 ? 'text-red-600' : 'text-slate-800'} />
        <KpiCard label="Avg Rating" value={`${fmt(summary.avgRating, 1)} ★`} sub="Across all SKUs" />
        <KpiCard label="Low Stock Alerts" value={summary.lowStockAlerts} sub="< 20 units" color={summary.lowStockAlerts > 0 ? 'text-red-600' : 'text-slate-800'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 Products */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-slate-800">Top 5 Products by Revenue (30d)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <th className="text-left px-4 py-2">Product</th>
                  <th className="text-right px-4 py-2">Price</th>
                  <th className="text-right px-4 py-2">Sold 30d</th>
                  <th className="text-right px-4 py-2">Revenue</th>
                  <th className="px-4 py-2">Stock</th>
                  <th className="text-right px-4 py-2">Rating</th>
                </tr>
              </thead>
              <tbody>
                {top5.map((p) => (
                  <tr key={p.id} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <div className="font-medium text-slate-800 truncate max-w-[160px]">{p.name}</div>
                      <div className="text-xs text-gray-400">{p.category}</div>
                    </td>
                    <td className="px-4 py-2 text-right">{fmtCurrency(p.price)}</td>
                    <td className="px-4 py-2 text-right">{p.sold_30d}</td>
                    <td className="px-4 py-2 text-right text-green-700 font-medium">{fmtCurrency(p.revenue_30d)}</td>
                    <td className="px-4 py-2">
                      <div className={`text-xs ${stockColor(p.stock_qty)}`}>{p.stock_qty}</div>
                      <div className="w-16 bg-gray-100 h-2 rounded mt-1">
                        <div className={stockBar(p.stock_qty)} style={{ width: `${Math.min(100, (p.stock_qty / 200) * 100)}%` }} />
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right text-yellow-500 text-xs">{ratingStars(p.avg_rating)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom 3 Products */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-slate-800">Bottom 3 — Lowest Performers</h3>
            <p className="text-xs text-gray-400 mt-1">Flagged for action — review or discontinue</p>
          </div>
          <div className="p-4 space-y-3">
            {bottom3.map((p) => (
              <div key={p.id} className="flex items-start gap-3 p-3 bg-red-50 rounded border border-red-100">
                <div className="flex-1">
                  <div className="font-medium text-slate-800 text-sm">{p.name}</div>
                  <div className="text-xs text-gray-500">{p.category} · SKU: {p.sku}</div>
                  <div className="flex gap-4 mt-1 text-xs">
                    <span>Revenue: <span className="font-medium text-red-600">{fmtCurrency(p.revenue_30d)}</span></span>
                    <span>Sold 30d: <span className="font-medium">{p.sold_30d}</span></span>
                    <span>Return: <span className="font-medium">{fmt(parseFloat(p.return_rate ?? '0') * 100, 1)}%</span></span>
                  </div>
                </div>
                <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">Action needed</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* High Priority Recommendations */}
      {highRecs.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-red-200">
          <div className="p-4 border-b border-red-100 flex items-center gap-2">
            <span className="text-red-600">⚠</span>
            <h3 className="font-semibold text-red-700">High Priority AI Recommendations</h3>
            <span className="ml-auto text-xs bg-red-100 text-red-700 px-2 py-1 rounded">{highRecs.length} urgent</span>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {highRecs.map((r) => (
              <div key={r.id} className="border border-red-100 rounded-lg p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${typeBadge(r.recommendation_type)}`}>
                    {r.recommendation_type.replace(/_/g, ' ')}
                  </span>
                  <span className="text-xs text-gray-400">{r.ai_source}</span>
                </div>
                <div className="font-medium text-slate-800 text-sm">{r.title}</div>
                {r.product_name && <div className="text-xs text-gray-500 mt-0.5">{r.product_name}</div>}
                {r.description && <p className="text-xs text-gray-600 mt-2 line-clamp-2">{r.description}</p>}
                {r.expected_lift_pct && (
                  <div className="text-xs mt-2 text-green-700 font-medium">
                    Expected lift: +{fmt(r.expected_lift_pct, 1)}%
                  </div>
                )}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => onApply(r.id)}
                    className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                  >
                    Apply
                  </button>
                  <button
                    onClick={() => onDismiss(r.id)}
                    className="text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded hover:bg-gray-200"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Pending Recommendations */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-slate-800">All Pending AI Recommendations</h3>
        </div>
        <div className="p-4 space-y-2">
          {pendingRecs.map((r) => (
            <div key={r.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded hover:bg-gray-50">
              <span className={`text-xs px-2 py-0.5 rounded ${priorityBadge(r.priority)}`}>{r.priority}</span>
              <span className={`text-xs px-2 py-0.5 rounded ${typeBadge(r.recommendation_type)}`}>
                {r.recommendation_type.replace(/_/g, ' ')}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800 truncate">{r.title}</div>
                {r.product_name && <div className="text-xs text-gray-400">{r.product_name}</div>}
              </div>
              {r.expected_lift_pct && (
                <div className="text-xs text-green-700 font-medium whitespace-nowrap">
                  +{fmt(r.expected_lift_pct, 1)}%
                </div>
              )}
              <div className="flex gap-1">
                <button onClick={() => onApply(r.id)} className="text-xs text-green-600 hover:underline">Apply</button>
                <span className="text-gray-300">|</span>
                <button onClick={() => onDismiss(r.id)} className="text-xs text-gray-500 hover:underline">Dismiss</button>
              </div>
            </div>
          ))}
          {pendingRecs.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">No pending recommendations</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Products ────────────────────────────────────────────────────────────

function ProductsTab({
  products,
  onGetRecs,
  onOptimizePrice,
  onAddProduct,
  working,
}: {
  products: RetailProduct[];
  onGetRecs: (id: string) => Promise<void>;
  onOptimizePrice: (id: string, target: string) => Promise<void>;
  onAddProduct: (data: Record<string, string>) => Promise<void>;
  working: string | null;
}) {
  const [filterCategory, setFilterCategory] = useState('');
  const [sortBy, setSortBy] = useState<'revenue_30d' | 'stock_qty' | 'avg_rating'>('revenue_30d');
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ name: '', category: '', sku: '', price: '', cost: '', stock_qty: '', avg_rating: '' });

  const categories = Array.from(new Set(products.map((p) => p.category).filter(Boolean))) as string[];
  const filtered = products
    .filter((p) => !filterCategory || p.category === filterCategory)
    .sort((a, b) => parseFloat(String(b[sortBy] ?? 0)) - parseFloat(String(a[sortBy] ?? 0)));

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm bg-white"
        >
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm bg-white"
        >
          <option value="revenue_30d">Sort: Revenue</option>
          <option value="stock_qty">Sort: Stock</option>
          <option value="avg_rating">Sort: Rating</option>
        </select>
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="ml-auto bg-slate-800 text-white px-4 py-1.5 rounded text-sm hover:bg-slate-700"
        >
          + Add Product
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-slate-800 mb-3">Add New Product</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(['name', 'category', 'sku', 'price', 'cost', 'stock_qty', 'avg_rating'] as const).map((field) => (
              <div key={field}>
                <label className="text-xs text-gray-500 block mb-1 capitalize">{field.replace(/_/g, ' ')}</label>
                <input
                  value={form[field]}
                  onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                  className="border border-gray-300 rounded px-2 py-1 text-sm w-full bg-white"
                  placeholder={field}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => { onAddProduct(form); setShowAddForm(false); setForm({ name: '', category: '', sku: '', price: '', cost: '', stock_qty: '', avg_rating: '' }); }}
              className="bg-green-600 text-white px-4 py-1.5 rounded text-sm hover:bg-green-700"
            >
              Save Product
            </button>
            <button onClick={() => setShowAddForm(false)} className="bg-gray-200 text-gray-700 px-4 py-1.5 rounded text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Product Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-xs uppercase">
              <th className="text-left px-4 py-3">Product</th>
              <th className="text-left px-4 py-3">SKU</th>
              <th className="text-right px-4 py-3">Price</th>
              <th className="text-right px-4 py-3">Cost</th>
              <th className="text-right px-4 py-3">Stock</th>
              <th className="text-right px-4 py-3">Sold 30d</th>
              <th className="text-right px-4 py-3">Revenue 30d</th>
              <th className="text-right px-4 py-3">Return %</th>
              <th className="text-right px-4 py-3">Rating</th>
              <th className="text-center px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-2">
                  <div className="font-medium text-slate-800">{p.name}</div>
                  <div className="text-xs text-gray-400">{p.category}</div>
                </td>
                <td className="px-4 py-2 text-gray-500 text-xs font-mono">{p.sku}</td>
                <td className="px-4 py-2 text-right">{fmtCurrency(p.price)}</td>
                <td className="px-4 py-2 text-right text-gray-500">{fmtCurrency(p.cost)}</td>
                <td className="px-4 py-2 text-right">
                  <span className={stockColor(p.stock_qty)}>{p.stock_qty}</span>
                </td>
                <td className="px-4 py-2 text-right">{p.sold_30d}</td>
                <td className="px-4 py-2 text-right text-green-700 font-medium">{fmtCurrency(p.revenue_30d)}</td>
                <td className="px-4 py-2 text-right">
                  <span className={parseFloat(p.return_rate ?? '0') > 0.1 ? 'text-red-600' : 'text-gray-600'}>
                    {fmt(parseFloat(p.return_rate ?? '0') * 100, 1)}%
                  </span>
                </td>
                <td className="px-4 py-2 text-right text-yellow-500 text-xs">{ratingStars(p.avg_rating)}</td>
                <td className="px-4 py-2 text-center">
                  <div className="flex gap-1 justify-center flex-wrap">
                    <button
                      onClick={() => onGetRecs(p.id)}
                      disabled={working === p.id}
                      className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      {working === p.id ? '...' : 'AI Recs'}
                    </button>
                    <div className="relative group">
                      <button className="text-xs bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-700">
                        Optimize ▾
                      </button>
                      <div className="hidden group-hover:block absolute right-0 z-10 bg-white border border-gray-200 rounded shadow-lg min-w-[160px]">
                        {(['maximize_revenue', 'maximize_units', 'clear_stock'] as const).map((t) => (
                          <button
                            key={t}
                            onClick={() => onOptimizePrice(p.id, t)}
                            className="block w-full text-left px-3 py-2 text-xs hover:bg-gray-50 text-gray-700"
                          >
                            {t.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Tab: Demand Forecasting ─────────────────────────────────────────────────

function ForecastTab({
  products,
  forecasts,
  onGenerateForecast,
  working,
}: {
  products: RetailProduct[];
  forecasts: DemandForecast[];
  onGenerateForecast: (productId: string) => Promise<void>;
  working: boolean;
}) {
  const [selectedProductId, setSelectedProductId] = useState('');

  const productForecasts = forecasts.filter((f) => f.product_id === selectedProductId);
  const past = productForecasts.filter((f) => f.actual_units !== null);
  const accurate = past.filter(
    (f) => f.actual_units !== null && f.confidence_interval_low !== null && f.confidence_interval_high !== null &&
      f.actual_units >= (f.confidence_interval_low ?? 0) && f.actual_units <= (f.confidence_interval_high ?? 0),
  );
  const accuracyPct = past.length > 0 ? Math.round((accurate.length / past.length) * 100) : null;
  const maxPredicted = Math.max(...productForecasts.map((f) => f.predicted_units ?? 0), 1);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Select Product</label>
          <select
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm bg-white min-w-[260px]"
          >
            <option value="">-- Select a product --</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <button
          onClick={() => selectedProductId && onGenerateForecast(selectedProductId)}
          disabled={!selectedProductId || working}
          className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {working ? 'Generating...' : 'Generate Forecast'}
        </button>
        {accuracyPct !== null && (
          <div className="ml-auto bg-green-50 border border-green-200 rounded px-3 py-1.5 text-sm">
            Past accuracy: <span className="font-semibold text-green-700">{accuracyPct}%</span> within CI
          </div>
        )}
      </div>

      {productForecasts.length > 0 && (
        <>
          {/* Model Info */}
          <div className="bg-blue-50 border border-blue-100 rounded p-3 text-sm text-blue-700">
            Model: <strong>Moving Average</strong> — based on 30-day and 90-day sales history with 0.5% daily trend factor and weekday/weekend cyclicality. Confidence interval: ±20%.
          </div>

          {/* Visual Forecast Chart */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="font-semibold text-slate-800 mb-3">Forecast Visualization</h3>
            <div className="font-mono text-xs space-y-1 overflow-x-auto">
              {productForecasts.slice(0, 14).map((f) => {
                const dateStr = new Date(f.forecast_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                const bar = sparkBar(f.predicted_units ?? 0, maxPredicted);
                const actualStr = f.actual_units !== null ? ` actual: ${f.actual_units}` : '';
                const inCI = f.actual_units !== null && f.confidence_interval_low !== null && f.confidence_interval_high !== null &&
                  f.actual_units >= (f.confidence_interval_low ?? 0) && f.actual_units <= (f.confidence_interval_high ?? 0);
                return (
                  <div key={f.id} className="flex gap-2 items-center">
                    <span className="w-12 text-gray-500">{dateStr}</span>
                    <span className={f.actual_units !== null ? (inCI ? 'text-green-600' : 'text-red-500') : 'text-blue-400'}>{bar}</span>
                    <span className="text-gray-600">{f.predicted_units} [{f.confidence_interval_low}–{f.confidence_interval_high}]{actualStr}</span>
                    {f.actual_units !== null && <span className={inCI ? 'text-green-600' : 'text-red-500'}>{inCI ? '✓' : '✗'}</span>}
                  </div>
                );
              })}
            </div>
            <div className="text-xs text-gray-400 mt-2">▓ = predicted · ✓ = actual within CI · ✗ = outside CI</div>
          </div>

          {/* Forecast Table */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <th className="text-left px-4 py-2">Date</th>
                  <th className="text-right px-4 py-2">Predicted Units</th>
                  <th className="text-center px-4 py-2">Confidence Range</th>
                  <th className="text-right px-4 py-2">Actual</th>
                  <th className="text-center px-4 py-2">In CI?</th>
                </tr>
              </thead>
              <tbody>
                {productForecasts.map((f) => {
                  const inCI = f.actual_units !== null && f.confidence_interval_low !== null && f.confidence_interval_high !== null &&
                    f.actual_units >= (f.confidence_interval_low ?? 0) && f.actual_units <= (f.confidence_interval_high ?? 0);
                  return (
                    <tr key={f.id} className="border-t border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-2">{new Date(f.forecast_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</td>
                      <td className="px-4 py-2 text-right font-medium">{f.predicted_units}</td>
                      <td className="px-4 py-2 text-center text-gray-500">{f.confidence_interval_low} – {f.confidence_interval_high}</td>
                      <td className="px-4 py-2 text-right">{f.actual_units ?? <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-2 text-center">
                        {f.actual_units !== null ? (
                          <span className={inCI ? 'text-green-600' : 'text-red-500'}>{inCI ? '✓' : '✗'}</span>
                        ) : <span className="text-gray-300">pending</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!selectedProductId && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center text-gray-400">
          Select a product above to view or generate demand forecasts
        </div>
      )}

      {selectedProductId && productForecasts.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center text-gray-400">
          No forecasts yet for this product. Click "Generate Forecast" to create one.
        </div>
      )}
    </div>
  );
}

// ─── Tab: Customer Segments ───────────────────────────────────────────────────

function SegmentsTab({ segments, meta }: { segments: Segment[]; meta: { data_source: string; real_customer_count: number | null }; }) {
  const total = segments.reduce((s, seg) => s + seg.count, 0);

  return (
    <div className="space-y-6">
      {/* RFM Explanation */}
      <div className="bg-slate-800 text-white rounded-lg p-4">
        <h3 className="font-semibold mb-2">RFM Segmentation Model</h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div><span className="text-blue-300 font-semibold">R</span> — Recency: How recently a customer purchased (days since last order)</div>
          <div><span className="text-green-300 font-semibold">F</span> — Frequency: How often they buy (order count per period)</div>
          <div><span className="text-yellow-300 font-semibold">M</span> — Monetary: How much they spend (average order value)</div>
        </div>
        <div className="text-xs text-gray-400 mt-2">
          Data source: {meta.data_source}
          {meta.real_customer_count !== null && ` · ${meta.real_customer_count} real customers`}
        </div>
      </div>

      {/* Pie Text Representation */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <h3 className="font-semibold text-slate-800 mb-3">Segment Distribution ({total.toLocaleString()} customers)</h3>
        <div className="font-mono text-sm text-gray-600 flex flex-wrap gap-4">
          {segments.map((s) => (
            <span key={s.name}>
              <strong className="text-slate-800">{s.name}</strong>: {Math.round((s.count / total) * 100)}% ({s.count})
            </span>
          ))}
        </div>
        {/* Visual bar */}
        <div className="flex mt-3 h-4 rounded overflow-hidden">
          {segments.map((s) => {
            const pct = Math.round((s.count / total) * 100);
            const bgMap: Record<string, string> = { green: 'bg-green-500', blue: 'bg-blue-500', orange: 'bg-orange-400', purple: 'bg-purple-500', gray: 'bg-gray-400' };
            return <div key={s.name} className={bgMap[s.color]} style={{ width: `${pct}%` }} title={`${s.name}: ${pct}%`} />;
          })}
        </div>
      </div>

      {/* Segment Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {segments.map((seg) => (
          <div key={seg.name} className={`rounded-lg p-4 ${segmentColor(seg.color)}`}>
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold text-slate-800">{seg.name}</h3>
              <span className="text-sm font-bold text-slate-700">{seg.count.toLocaleString()}</span>
            </div>
            <p className="text-sm text-gray-600 mb-2">{seg.description}</p>
            <div className="text-sm mb-3">
              <span className="text-gray-500">Avg order: </span>
              <span className="font-semibold text-slate-800">${seg.avg_order_value}</span>
            </div>
            <div className="bg-white bg-opacity-70 rounded p-2 text-xs text-gray-700 mb-3">
              <strong>Recommended Action:</strong> {seg.recommended_action}
            </div>
            <div className="flex gap-2">
              <a
                href={`/admin/campaigns/new?segment=${encodeURIComponent(seg.name)}`}
                className="text-xs bg-slate-700 text-white px-3 py-1 rounded hover:bg-slate-600"
              >
                Create Campaign
              </a>
              <button className="text-xs bg-white border border-gray-300 text-gray-700 px-3 py-1 rounded hover:bg-gray-50">
                Export List
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tab: Price Optimizer ─────────────────────────────────────────────────────

function PriceOptimizerTab({
  products,
  priceHistory,
  onOptimize,
  optimResult,
  working,
}: {
  products: RetailProduct[];
  priceHistory: PriceHistory[];
  onOptimize: (productId: string, target: string) => Promise<void>;
  optimResult: (PriceOptResult & { product_id: string }) | null;
  working: boolean;
}) {
  const [selectedId, setSelectedId] = useState('');
  const [target, setTarget] = useState('maximize_revenue');
  const selectedProduct = products.find((p) => p.id === selectedId);
  const productHistory = priceHistory.filter((ph) => ph.product_id === selectedId);
  const currentPrice = parseFloat(selectedProduct?.price ?? '0');
  const currentCost = parseFloat(selectedProduct?.cost ?? '0');
  const currentMargin = currentPrice > 0 ? (((currentPrice - currentCost) / currentPrice) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Selector */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Select Product</label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 text-sm w-full bg-white"
            >
              <option value="">-- Select product --</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Optimization Goal</label>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 text-sm w-full bg-white"
            >
              <option value="maximize_revenue">Maximize Revenue</option>
              <option value="maximize_units">Maximize Units Sold</option>
              <option value="clear_stock">Clear Stock</option>
            </select>
          </div>
          <button
            onClick={() => selectedId && onOptimize(selectedId, target)}
            disabled={!selectedId || working}
            className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700 disabled:opacity-50"
          >
            {working ? 'Optimizing with AI...' : 'Optimize with AI'}
          </button>
        </div>

        {selectedProduct && (
          <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
            <div className="bg-gray-50 rounded p-3">
              <div className="text-gray-500 text-xs">Current Price</div>
              <div className="text-2xl font-bold text-slate-800">{fmtCurrency(selectedProduct.price)}</div>
            </div>
            <div className="bg-gray-50 rounded p-3">
              <div className="text-gray-500 text-xs">Cost</div>
              <div className="text-2xl font-bold text-slate-800">{fmtCurrency(selectedProduct.cost)}</div>
            </div>
            <div className="bg-gray-50 rounded p-3">
              <div className="text-gray-500 text-xs">Current Margin</div>
              <div className="text-2xl font-bold text-green-700">{fmt(currentMargin, 1)}%</div>
            </div>
          </div>
        )}
      </div>

      {/* Result Card */}
      {optimResult && optimResult.product_id === selectedId && (
        <div className="bg-white rounded-lg shadow-sm border border-purple-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-semibold text-slate-800">AI Price Recommendation</h3>
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">{optimResult.ai_source}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-xs text-gray-500">Current Price</div>
              <div className="text-xl font-bold text-gray-600">{fmtCurrency(optimResult.current_price)}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500">Recommended Price</div>
              <div className={`text-2xl font-bold ${optimResult.recommended_price > optimResult.current_price ? 'text-green-700' : 'text-orange-600'}`}>
                {fmtCurrency(optimResult.recommended_price)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500">Units Change</div>
              <div className={`text-xl font-bold ${optimResult.expected_units_change_pct >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                {optimResult.expected_units_change_pct >= 0 ? '+' : ''}{fmt(optimResult.expected_units_change_pct, 1)}%
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500">Revenue Change</div>
              <div className={`text-xl font-bold ${optimResult.expected_revenue_change_pct >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                {optimResult.expected_revenue_change_pct >= 0 ? '+' : ''}{fmt(optimResult.expected_revenue_change_pct, 1)}%
              </div>
            </div>
          </div>
          <div className="bg-gray-50 rounded p-3 text-sm text-gray-700 mb-4">
            <strong>Reasoning:</strong> {optimResult.reasoning}
          </div>
          <div className="text-xs text-gray-400">
            {optimResult.price_changed ? 'Price change recorded in history.' : 'No price change required at this time.'}
          </div>
        </div>
      )}

      {/* Price History */}
      {selectedId && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-slate-800">Price History</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <th className="text-left px-4 py-2">Date</th>
                  <th className="text-right px-4 py-2">Old Price</th>
                  <th className="text-right px-4 py-2">New Price</th>
                  <th className="text-right px-4 py-2">Change</th>
                  <th className="text-left px-4 py-2">Reason</th>
                </tr>
              </thead>
              <tbody>
                {productHistory.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-4 text-center text-gray-400 text-sm">No price history for this product</td></tr>
                )}
                {productHistory.map((ph) => {
                  const delta = parseFloat(ph.new_price) - parseFloat(ph.old_price);
                  const deltaPct = parseFloat(ph.old_price) > 0 ? ((delta / parseFloat(ph.old_price)) * 100) : 0;
                  return (
                    <tr key={ph.id} className="border-t border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-2">{new Date(ph.changed_at).toLocaleDateString()}</td>
                      <td className="px-4 py-2 text-right line-through text-gray-400">{fmtCurrency(ph.old_price)}</td>
                      <td className="px-4 py-2 text-right font-medium">{fmtCurrency(ph.new_price)}</td>
                      <td className={`px-4 py-2 text-right font-medium ${delta >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                        {delta >= 0 ? '+' : ''}{fmt(deltaPct, 1)}%
                      </td>
                      <td className="px-4 py-2 text-gray-600 text-xs max-w-[200px] truncate">{ph.reason}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: AI Insights ─────────────────────────────────────────────────────────

function AIInsightsTab({ products }: { products: RetailProduct[] }) {
  const [insights, setInsights] = useState<string>('');
  const [competitorName, setCompetitorName] = useState('');
  const [competitorInsights, setCompetitorInsights] = useState<string>('');
  const [loadingFull, setLoadingFull] = useState(false);
  const [loadingCompetitor, setLoadingCompetitor] = useState(false);
  const [error, setError] = useState('');

  const generateFullAnalysis = useCallback(async () => {
    setLoadingFull(true);
    setError('');
    setInsights('');
    try {
      const sorted = [...products].sort((a, b) => parseFloat(b.revenue_30d ?? '0') - parseFloat(a.revenue_30d ?? '0'));
      const top3 = sorted.slice(0, 3);
      const bottom3 = sorted.slice(-3).reverse();
      const totalRevenue = products.reduce((s, p) => s + parseFloat(p.revenue_30d ?? '0'), 0);
      const avgRating = products.length > 0
        ? products.reduce((s, p) => s + parseFloat(p.avg_rating ?? '0'), 0) / products.length
        : 0;

      const top3Str = top3.map((p) => `${p.name} (${p.sold_30d} units, $${parseFloat(p.revenue_30d ?? '0').toFixed(0)})`).join(', ');
      const bottom3Str = bottom3.map((p) => `${p.name} (${p.sold_30d} units)`).join(', ');

      const prompt = `I run a retail business. Top 3 products: ${top3Str}. Bottom 3: ${bottom3Str}. Total revenue 30d: $${totalRevenue.toFixed(0)}. Avg rating: ${avgRating.toFixed(1)}. Give me 5 strategic insights and 3 immediate actions.`;

      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json() as { text?: string; error?: string };
      if (data.error) throw new Error(data.error);
      setInsights(data.text ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate insights');
    } finally {
      setLoadingFull(false);
    }
  }, [products]);

  const generateCompetitorInsights = useCallback(async () => {
    if (!competitorName.trim()) return;
    setLoadingCompetitor(true);
    setCompetitorInsights('');
    try {
      const prompt = `We are a yoga and wellness retail brand. Our competitor is ${competitorName}. Suggest a pricing strategy — when to undercut, when to price at premium, and what product categories to focus on to differentiate. Be specific and actionable.`;
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json() as { text?: string; error?: string };
      if (data.error) throw new Error(data.error);
      setCompetitorInsights(data.text ?? '');
    } catch (err) {
      setCompetitorInsights('Error: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoadingCompetitor(false);
    }
  }, [competitorName]);

  const insightParagraphs = insights.split('\n').filter(Boolean);
  const competitorParagraphs = competitorInsights.split('\n').filter(Boolean);

  return (
    <div className="space-y-6">
      {/* Full Store Analysis */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-800">Full Store AI Analysis</h3>
          <div className="flex gap-2">
            <button
              onClick={generateFullAnalysis}
              disabled={loadingFull || products.length === 0}
              className="bg-slate-800 text-white px-4 py-2 rounded text-sm hover:bg-slate-700 disabled:opacity-50"
            >
              {loadingFull ? 'Generating...' : 'Generate Full Store Analysis'}
            </button>
            {insights && (
              <button
                onClick={() => window.print()}
                className="border border-gray-300 text-gray-700 px-4 py-2 rounded text-sm hover:bg-gray-50"
              >
                Print / Export PDF
              </button>
            )}
          </div>
        </div>

        {error && <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded p-3 mb-3">{error}</div>}

        {!insights && !loadingFull && (
          <div className="text-gray-400 text-sm text-center py-8">
            Click "Generate Full Store Analysis" to get AI-powered strategic insights about your product catalog.
            <br /><span className="text-xs">Powered by Ollama (local AI — no data leaves your server)</span>
          </div>
        )}

        {loadingFull && (
          <div className="text-center py-8">
            <div className="text-gray-500 text-sm">Running analysis with Ollama...</div>
          </div>
        )}

        {insights && (
          <div className="space-y-3 mt-2">
            {insightParagraphs.map((para, i) => (
              <div key={i} className={`p-3 rounded border ${para.toLowerCase().startsWith('insight') || /^\d\./.test(para) ? 'bg-blue-50 border-blue-100' : para.toLowerCase().startsWith('action') || /^[a-z]\)/.test(para.toLowerCase()) ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-gray-100'}`}>
                <p className="text-sm text-gray-700">{para}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Competitor Price Research */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <h3 className="font-semibold text-slate-800 mb-3">Competitor Price Research</h3>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-xs text-gray-500 block mb-1">Competitor Name</label>
            <input
              value={competitorName}
              onChange={(e) => setCompetitorName(e.target.value)}
              placeholder="e.g. Lululemon, Manduka, Alo Yoga"
              className="border border-gray-300 rounded px-3 py-2 text-sm w-full bg-white"
            />
          </div>
          <button
            onClick={generateCompetitorInsights}
            disabled={!competitorName.trim() || loadingCompetitor}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {loadingCompetitor ? 'Analyzing...' : 'Analyze Competitor'}
          </button>
        </div>

        {competitorInsights && (
          <div className="mt-4 space-y-2">
            {competitorParagraphs.map((para, i) => (
              <div key={i} className="bg-gray-50 border border-gray-100 rounded p-3">
                <p className="text-sm text-gray-700">{para}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RetailAIPage() {
  const [activeTab, setActiveTab] = useState<TabName>('Dashboard');
  const [data, setData] = useState<DashboardData | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [segmentsMeta, setSegmentsMeta] = useState<{ data_source: string; real_customer_count: number | null }>({ data_source: 'static_rfm_model', real_customer_count: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [working, setWorking] = useState<string | null>(null);
  const [forecastWorking, setForecastWorking] = useState(false);
  const [priceWorking, setPriceWorking] = useState(false);
  const [priceOptResult, setPriceOptResult] = useState<(PriceOptResult & { product_id: string }) | null>(null);
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [dashRes, segRes] = await Promise.all([
        fetch('/api/admin/retail-ai'),
        fetch('/api/admin/retail-ai/segments'),
      ]);
      if (!dashRes.ok) throw new Error(`Dashboard API error: ${dashRes.status}`);
      const dashData = await dashRes.json() as DashboardData;
      setData(dashData);
      if (segRes.ok) {
        const segData = await segRes.json() as { segments: Segment[]; meta: { data_source: string; real_customer_count: number | null } };
        setSegments(segData.segments ?? []);
        setSegmentsMeta(segData.meta ?? { data_source: 'static_rfm_model', real_customer_count: null });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const handleApplyRec = async (id: string) => {
    try {
      await fetch(`/api/admin/retail-ai?action=apply&id=${id}`, { method: 'PATCH' });
      showToast('Recommendation marked as applied');
      await loadData();
    } catch {
      showToast('Update failed');
    }
  };

  const handleDismissRec = async (id: string) => {
    try {
      await fetch(`/api/admin/retail-ai?action=dismiss&id=${id}`, { method: 'PATCH' });
      showToast('Recommendation dismissed');
      await loadData();
    } catch {
      showToast('Update failed');
    }
  };

  const handleGetRecs = async (productId: string) => {
    setWorking(productId);
    try {
      const res = await fetch('/api/admin/retail-ai/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId }),
      });
      const result = await res.json() as { recommendations?: unknown[]; error?: string; ai_source?: string };
      if (result.error) throw new Error(result.error);
      showToast(`${result.recommendations?.length ?? 0} recommendations generated (${result.ai_source})`);
      await loadData();
    } catch (err) {
      showToast('Error: ' + (err instanceof Error ? err.message : 'Unknown'));
    } finally {
      setWorking(null);
    }
  };

  const handleOptimizePrice = async (productId: string, target: string) => {
    setPriceWorking(true);
    try {
      const res = await fetch('/api/admin/retail-ai/price-optimizer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId, target }),
      });
      const result = await res.json() as PriceOptResult & { product_id: string; error?: string };
      if (result.error) throw new Error(result.error);
      setPriceOptResult({ ...result, product_id: productId });
      setActiveTab('Price Optimizer');
      showToast(`Price optimized: ${result.ai_source}`);
      await loadData();
    } catch (err) {
      showToast('Error: ' + (err instanceof Error ? err.message : 'Unknown'));
    } finally {
      setPriceWorking(false);
    }
  };

  const handleGenerateForecast = async (productId: string) => {
    setForecastWorking(true);
    try {
      const res = await fetch('/api/admin/retail-ai/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId, days_ahead: 14 }),
      });
      const result = await res.json() as { forecasts?: unknown[]; error?: string };
      if (result.error) throw new Error(result.error);
      showToast(`${result.forecasts?.length ?? 0} forecast days generated`);
      await loadData();
    } catch (err) {
      showToast('Error: ' + (err instanceof Error ? err.message : 'Unknown'));
    } finally {
      setForecastWorking(false);
    }
  };

  const handleAddProduct = async (formData: Record<string, string>) => {
    try {
      const res = await fetch('/api/admin/retail-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const result = await res.json() as { error?: string };
      if (result.error) throw new Error(result.error);
      showToast('Product added successfully');
      await loadData();
    } catch (err) {
      showToast('Error: ' + (err instanceof Error ? err.message : 'Unknown'));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-slate-800 text-white px-6 py-4">
        <div className="max-w-screen-xl mx-auto">
          <h1 className="text-xl font-bold">Retail AI Command Center</h1>
          <p className="text-slate-300 text-sm mt-0.5">AI-powered product performance, recommendations, demand forecasting &amp; price optimization</p>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-screen-xl mx-auto px-6">
          <div className="flex gap-0 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === tab
                    ? 'border-slate-800 text-slate-800'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-screen-xl mx-auto px-6 py-6">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="text-gray-400">Loading retail AI data...</div>
          </div>
        )}

        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            <strong>Error:</strong> {error}
            <button onClick={loadData} className="ml-4 text-sm underline">Retry</button>
          </div>
        )}

        {!loading && !error && data && (
          <>
            {activeTab === 'Dashboard' && (
              <DashboardTab
                summary={data.summary}
                products={data.products}
                recommendations={data.recommendations}
                onApply={handleApplyRec}
                onDismiss={handleDismissRec}
              />
            )}
            {activeTab === 'Products' && (
              <ProductsTab
                products={data.products}
                onGetRecs={handleGetRecs}
                onOptimizePrice={handleOptimizePrice}
                onAddProduct={handleAddProduct}
                working={working}
              />
            )}
            {activeTab === 'Demand Forecasting' && (
              <ForecastTab
                products={data.products}
                forecasts={data.forecasts}
                onGenerateForecast={handleGenerateForecast}
                working={forecastWorking}
              />
            )}
            {activeTab === 'Customer Segments' && (
              <SegmentsTab segments={segments} meta={segmentsMeta} />
            )}
            {activeTab === 'Price Optimizer' && (
              <PriceOptimizerTab
                products={data.products}
                priceHistory={data.priceHistory}
                onOptimize={handleOptimizePrice}
                optimResult={priceOptResult}
                working={priceWorking}
              />
            )}
            {activeTab === 'AI Insights' && (
              <AIInsightsTab products={data.products} />
            )}
          </>
        )}
      </div>

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 bg-slate-800 text-white px-4 py-2 rounded shadow-lg text-sm z-50">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
