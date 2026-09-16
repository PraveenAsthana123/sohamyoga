'use client';

import { useState, useEffect, useCallback } from 'react';

interface Promotion {
  id: number;
  name: string;
  description: string | null;
  promotion_type: string;
  discount_value: number;
  min_order_value: number;
  max_discount_amount: number | null;
  applicable_to: string;
  product_ids: number[] | null;
  category_ids: number[] | null;
  start_date: string | null;
  end_date: string | null;
  usage_limit: number | null;
  usage_count: number;
  is_stackable: boolean;
  requires_coupon: boolean;
  status: string;
  created_at: string;
}

const TABS = ['Active Promotions', 'All Promotions', 'Create Promotion', 'Performance', 'Calendar'] as const;
type Tab = typeof TABS[number];

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-500/20 text-gray-300',
  scheduled: 'bg-blue-500/20 text-blue-300',
  active: 'bg-green-500/20 text-green-300',
  paused: 'bg-yellow-500/20 text-yellow-300',
  expired: 'bg-red-500/20 text-red-300',
  cancelled: 'bg-red-700/20 text-red-400',
};

const TYPE_COLORS: Record<string, string> = {
  percentage: 'bg-purple-500/20 text-purple-300',
  fixed_amount: 'bg-cyan-500/20 text-cyan-300',
  free_shipping: 'bg-green-500/20 text-green-300',
  buy_x_get_y: 'bg-orange-500/20 text-orange-300',
  flash_sale: 'bg-red-500/20 text-red-300',
  bundle: 'bg-blue-500/20 text-blue-300',
};

function daysRemaining(end: string | null) {
  if (!end) return null;
  const diff = Math.ceil((new Date(end).getTime() - Date.now()) / 86400000);
  return diff;
}

function discountDisplay(p: Promotion) {
  if (p.promotion_type === 'percentage') return `${p.discount_value}% off`;
  if (p.promotion_type === 'fixed_amount') return `$${p.discount_value} off`;
  if (p.promotion_type === 'free_shipping') return 'Free Shipping';
  return `${p.promotion_type}`;
}

export default function PromotionsPage() {
  const [tab, setTab] = useState<Tab>('Active Promotions');
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({
    name: '', description: '', promotion_type: 'percentage', discount_value: '',
    min_order_value: '0', max_discount_amount: '', applicable_to: 'all',
    start_date: '', end_date: '', usage_limit: '',
    is_stackable: false, requires_coupon: false, status: 'draft',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = statusFilter ? `?status=${statusFilter}` : '';
      const res = await fetch(`/api/admin/promotions${qs}`);
      const data = await res.json() as { promotions?: Promotion[] };
      setPromotions(data.promotions ?? []);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { void load(); }, [load]);

  const activate = async (id: number, newStatus: string) => {
    await fetch(`/api/admin/promotions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    void load();
  };

  const clone = async (p: Promotion) => {
    await fetch('/api/admin/promotions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...p, id: undefined, name: `${p.name} (Copy)`, status: 'draft', usage_count: 0 }),
    });
    void load();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch('/api/admin/promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          discount_value: Number(form.discount_value),
          min_order_value: Number(form.min_order_value),
          max_discount_amount: form.max_discount_amount ? Number(form.max_discount_amount) : null,
          usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
        }),
      });
      if (res.ok) {
        setMsg('Promotion created successfully.');
        setForm({ name: '', description: '', promotion_type: 'percentage', discount_value: '',
          min_order_value: '0', max_discount_amount: '', applicable_to: 'all',
          start_date: '', end_date: '', usage_limit: '', is_stackable: false, requires_coupon: false, status: 'draft' });
        void load();
      } else {
        const d = await res.json() as { error?: string };
        setMsg(d.error ?? 'Error creating promotion.');
      }
    } finally {
      setSaving(false);
    }
  };

  const glass = 'backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl p-6 shadow-xl';
  const activePromos = promotions.filter(p => p.status === 'active');

  // Performance estimates
  const avgOrder = 75; // fallback avg order value
  const revenueImpact = (p: Promotion) => {
    if (!p.usage_count) return 0;
    const pct = p.promotion_type === 'percentage' ? p.discount_value / 100 : 0;
    return p.usage_count * avgOrder * pct;
  };
  const mostUsed = [...promotions].sort((a, b) => b.usage_count - a.usage_count)[0];
  const totalDiscount = promotions.reduce((a, p) => a + revenueImpact(p), 0);
  const avgDiscount = promotions.length ? totalDiscount / promotions.length : 0;

  // Calendar
  const sorted = [...promotions].sort((a, b) => {
    const da = a.start_date ? new Date(a.start_date).getTime() : 0;
    const db = b.start_date ? new Date(b.start_date).getTime() : 0;
    return da - db;
  });
  const earliest = sorted.find(p => p.start_date)?.start_date;
  const latest = sorted.reverse().find(p => p.end_date)?.end_date;
  const totalDays = earliest && latest
    ? Math.max((new Date(latest).getTime() - new Date(earliest).getTime()) / 86400000, 1)
    : 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">Promotions</h1>
        <p className="text-white/60 mb-6">Create and manage discount promotions, flash sales, and bundles.</p>

        <div className="flex flex-wrap gap-2 mb-6">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10'
              }`}>
              {t}
            </button>
          ))}
        </div>

        {/* Active Promotions */}
        {tab === 'Active Promotions' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {activePromos.map(p => {
              const days = daysRemaining(p.end_date);
              const usagePct = p.usage_limit ? Math.min((p.usage_count / p.usage_limit) * 100, 100) : 0;
              return (
                <div key={p.id} className={glass}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-white font-semibold">{p.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[p.promotion_type] ?? 'bg-white/10 text-white/60'}`}>
                        {p.promotion_type}
                      </span>
                    </div>
                    <span className="text-xl font-bold text-green-400">{discountDisplay(p)}</span>
                  </div>
                  <p className="text-white/50 text-xs mb-3">Applies to: {p.applicable_to}</p>
                  {p.usage_limit && (
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-white/50 mb-1">
                        <span>Usage</span>
                        <span>{p.usage_count} / {p.usage_limit}</span>
                      </div>
                      <div className="bg-white/10 rounded-full h-2">
                        <div className="bg-green-500 h-2 rounded-full" style={{ width: `${usagePct}%` }} />
                      </div>
                    </div>
                  )}
                  {days !== null && (
                    <p className={`text-xs mb-3 ${days <= 3 ? 'text-red-400' : 'text-white/50'}`}>
                      {days > 0 ? `${days} days remaining` : 'Expired'}
                    </p>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => activate(p.id, 'paused')}
                      className="text-xs bg-yellow-500/20 hover:bg-yellow-500/40 text-yellow-300 px-3 py-1 rounded transition-all">
                      Pause
                    </button>
                    <button onClick={() => clone(p)}
                      className="text-xs bg-blue-500/20 hover:bg-blue-500/40 text-blue-300 px-3 py-1 rounded transition-all">
                      Clone
                    </button>
                  </div>
                </div>
              );
            })}
            {!activePromos.length && (
              <div className={`${glass} md:col-span-3`}>
                <p className="text-white/30 text-center py-8">No active promotions.</p>
              </div>
            )}
          </div>
        )}

        {/* All Promotions */}
        {tab === 'All Promotions' && (
          <div className={glass}>
            <div className="flex flex-wrap gap-2 mb-4">
              {['', 'draft', 'scheduled', 'active', 'paused', 'expired', 'cancelled'].map(s => (
                <button key={s || 'all'} onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border border-white/20 transition-all ${
                    statusFilter === s ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10'
                  }`}>
                  {s || 'All'}
                </button>
              ))}
            </div>
            {loading ? <p className="text-white/50 text-sm">Loading...</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-white/80">
                  <thead>
                    <tr className="text-white/40 text-xs border-b border-white/10">
                      {['Name', 'Type', 'Discount', 'Start', 'End', 'Usage', 'Status', 'Actions'].map(h => (
                        <th key={h} className="text-left py-2 px-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {promotions.map(p => (
                      <tr key={p.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="py-2 px-3 font-medium">{p.name}</td>
                        <td className="py-2 px-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[p.promotion_type] ?? 'bg-white/10 text-white/60'}`}>
                            {p.promotion_type}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-green-400 font-medium">{discountDisplay(p)}</td>
                        <td className="py-2 px-3 text-xs">{p.start_date ? p.start_date.substring(0, 10) : '—'}</td>
                        <td className="py-2 px-3 text-xs">{p.end_date ? p.end_date.substring(0, 10) : '—'}</td>
                        <td className="py-2 px-3 text-xs">{p.usage_count}{p.usage_limit ? `/${p.usage_limit}` : ''}</td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[p.status] ?? 'bg-white/10 text-white/60'}`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex gap-1">
                            {p.status !== 'active' && (
                              <button onClick={() => activate(p.id, 'active')}
                                className="text-xs bg-green-500/20 hover:bg-green-500/40 text-green-300 px-2 py-0.5 rounded transition-all">
                                Activate
                              </button>
                            )}
                            {p.status === 'active' && (
                              <button onClick={() => activate(p.id, 'paused')}
                                className="text-xs bg-yellow-500/20 hover:bg-yellow-500/40 text-yellow-300 px-2 py-0.5 rounded transition-all">
                                Pause
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!promotions.length && (
                      <tr><td colSpan={8} className="py-8 text-center text-white/30">No promotions found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Create Promotion */}
        {tab === 'Create Promotion' && (
          <div className={glass}>
            <h2 className="text-lg font-semibold text-white mb-4">New Promotion</h2>
            {msg && <div className={`mb-4 p-3 rounded-lg text-sm ${msg.includes('success') ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>{msg}</div>}
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-white/60 text-xs block mb-1">Promotion Name *</label>
                <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-400" />
              </div>

              <div className="md:col-span-2">
                <label className="text-white/60 text-xs block mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-400" />
              </div>

              <div>
                <label className="text-white/60 text-xs block mb-2">Discount Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {['percentage', 'fixed_amount', 'free_shipping', 'buy_x_get_y', 'flash_sale', 'bundle'].map(t => (
                    <label key={t} className={`flex items-center gap-1.5 text-xs cursor-pointer p-2 rounded-lg border transition-all ${
                      form.promotion_type === t ? 'border-indigo-400 bg-indigo-500/20 text-white' : 'border-white/20 text-white/60 hover:bg-white/5'
                    }`}>
                      <input type="radio" name="promo_type" value={t} checked={form.promotion_type === t}
                        onChange={e => setForm(f => ({ ...f, promotion_type: e.target.value }))} className="sr-only" />
                      {t}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-white/60 text-xs block mb-1">
                  {form.promotion_type === 'percentage' ? 'Discount %' : form.promotion_type === 'fixed_amount' ? 'Discount $' : 'Discount Value'}
                </label>
                <input type="number" min="0" step="0.01" value={form.discount_value}
                  onChange={e => setForm(f => ({ ...f, discount_value: e.target.value }))}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-400" />
              </div>

              {['percentage', 'fixed_amount'].includes(form.promotion_type) && (
                <div>
                  <label className="text-white/60 text-xs block mb-1">Min Order Value ($)</label>
                  <input type="number" min="0" step="0.01" value={form.min_order_value}
                    onChange={e => setForm(f => ({ ...f, min_order_value: e.target.value }))}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-400" />
                </div>
              )}

              {form.promotion_type === 'percentage' && (
                <div>
                  <label className="text-white/60 text-xs block mb-1">Max Discount Cap ($)</label>
                  <input type="number" min="0" step="0.01" value={form.max_discount_amount}
                    onChange={e => setForm(f => ({ ...f, max_discount_amount: e.target.value }))}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-400" />
                </div>
              )}

              <div>
                <label className="text-white/60 text-xs block mb-1">Applicable To</label>
                <select value={form.applicable_to} onChange={e => setForm(f => ({ ...f, applicable_to: e.target.value }))}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-400">
                  {['all', 'specific_products', 'specific_categories', 'first_order'].map(o => (
                    <option key={o} value={o} className="bg-slate-800">{o}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-white/60 text-xs block mb-1">Start Date</label>
                <input type="datetime-local" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-400" />
              </div>

              <div>
                <label className="text-white/60 text-xs block mb-1">End Date</label>
                <input type="datetime-local" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-400" />
              </div>

              <div>
                <label className="text-white/60 text-xs block mb-1">Usage Limit (blank = unlimited)</label>
                <input type="number" min="1" value={form.usage_limit} onChange={e => setForm(f => ({ ...f, usage_limit: e.target.value }))}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-400" />
              </div>

              <div>
                <label className="text-white/60 text-xs block mb-1">Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-400">
                  {['draft', 'scheduled', 'active'].map(s => (
                    <option key={s} value={s} className="bg-slate-800">{s}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-white/70 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.is_stackable} onChange={e => setForm(f => ({ ...f, is_stackable: e.target.checked }))}
                    className="rounded" />
                  Stackable
                </label>
                <label className="flex items-center gap-2 text-white/70 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.requires_coupon} onChange={e => setForm(f => ({ ...f, requires_coupon: e.target.checked }))}
                    className="rounded" />
                  Requires Coupon
                </label>
              </div>

              <div className="md:col-span-2">
                <button type="submit" disabled={saving}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50">
                  {saving ? 'Creating...' : 'Create Promotion'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Performance */}
        {tab === 'Performance' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={glass}>
              <h3 className="text-white font-semibold mb-4">Overview</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Total Promotions', value: promotions.length },
                  { label: 'Active', value: activePromos.length },
                  { label: 'Estimated Impact', value: `$${totalDiscount.toFixed(0)}` },
                  { label: 'Avg Discount/Promo', value: `$${avgDiscount.toFixed(0)}` },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-white/5 rounded-xl p-3">
                    <p className="text-white/50 text-xs">{label}</p>
                    <p className="text-white text-xl font-bold">{value}</p>
                  </div>
                ))}
              </div>
              {mostUsed && (
                <div className="mt-4 p-3 bg-green-500/10 rounded-xl">
                  <p className="text-white/50 text-xs">Most Used Promotion</p>
                  <p className="text-white font-medium">{mostUsed.name}</p>
                  <p className="text-green-400 text-sm">{mostUsed.usage_count} uses</p>
                </div>
              )}
            </div>

            <div className={glass}>
              <h3 className="text-white font-semibold mb-4">Promotion Performance</h3>
              <div className="space-y-3">
                {promotions.slice(0, 10).map(p => (
                  <div key={p.id} className="bg-white/5 rounded-xl p-3">
                    <div className="flex justify-between items-start">
                      <p className="text-white text-sm font-medium">{p.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[p.status] ?? 'bg-white/10'}`}>{p.status}</span>
                    </div>
                    <div className="flex gap-4 mt-1 text-xs text-white/50">
                      <span>{p.usage_count} uses</span>
                      <span>Est. ${revenueImpact(p).toFixed(0)} impact</span>
                      <span>{discountDisplay(p)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Calendar */}
        {tab === 'Calendar' && (
          <div className={glass}>
            <h2 className="text-lg font-semibold text-white mb-4">Promotion Timeline</h2>
            <div className="space-y-3">
              {sorted.map(p => {
                const now = Date.now();
                const start = p.start_date ? new Date(p.start_date).getTime() : now;
                const end = p.end_date ? new Date(p.end_date).getTime() : now + 86400000;
                const ref = earliest ? new Date(earliest).getTime() : start;
                const leftPct = Math.max(0, ((start - ref) / (totalDays * 86400000)) * 100);
                const widthPct = Math.max(1, ((end - start) / (totalDays * 86400000)) * 100);
                const isActive = p.status === 'active';
                const isUpcoming = p.status === 'scheduled';

                return (
                  <div key={p.id}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-white/80 text-sm">{p.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[p.status] ?? 'bg-white/10'}`}>{p.status}</span>
                    </div>
                    <div className="relative bg-white/10 rounded-full h-4">
                      <div
                        className={`absolute h-4 rounded-full ${isActive ? 'bg-green-500' : isUpcoming ? 'bg-blue-500' : 'bg-gray-500'}`}
                        style={{ left: `${leftPct}%`, width: `${Math.min(widthPct, 100 - leftPct)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-white/30 mt-0.5">
                      <span>{p.start_date ? p.start_date.substring(0, 10) : '—'}</span>
                      <span>{p.end_date ? p.end_date.substring(0, 10) : '—'}</span>
                    </div>
                  </div>
                );
              })}
              {!promotions.length && <p className="text-white/30 text-center py-8">No promotions to display.</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
