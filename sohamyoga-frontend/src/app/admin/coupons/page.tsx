'use client';

import { useState, useEffect, useCallback } from 'react';

interface Coupon {
  id: number;
  code: string;
  promotion_id: number | null;
  coupon_type: string;
  discount_type: string;
  discount_value: number;
  min_order_value: number;
  max_uses: number | null;
  used_count: number;
  is_active: boolean;
  valid_from: string;
  valid_until: string | null;
  applicable_to: string;
  customer_email: string | null;
  created_by: string | null;
  created_at: string;
  redemption_count: number;
  is_expired: boolean;
}

interface Redemption {
  id: number;
  coupon_id: number;
  code: string;
  order_id: number | null;
  customer_email: string | null;
  discount_applied: number;
  redeemed_at: string;
}

const TABS = ['Active Coupons', 'Create Coupon', 'Bulk Generate', 'Redemption History', 'Analytics'] as const;
type Tab = typeof TABS[number];

const TYPE_COLORS: Record<string, string> = {
  single_use: 'bg-purple-500/20 text-purple-300',
  multi_use: 'bg-blue-500/20 text-blue-300',
  unlimited: 'bg-green-500/20 text-green-300',
  one_per_customer: 'bg-orange-500/20 text-orange-300',
};

function discountLabel(c: Coupon) {
  return c.discount_type === 'percentage' ? `${c.discount_value}% off` : `$${c.discount_value} off`;
}

export default function CouponsPage() {
  const [tab, setTab] = useState<Tab>('Active Coupons');
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<number | null>(null);

  // Create form
  const [form, setForm] = useState({
    code: '', discount_type: 'percentage', discount_value: '',
    min_order_value: '0', max_uses: '', valid_until: '',
    coupon_type: 'single_use', customer_email: '',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  // Bulk generate form
  const [bulk, setBulk] = useState({
    count: '10', prefix: '', discount_type: 'percentage', discount_value: '10', valid_until: '',
  });
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkResult, setBulkResult] = useState<Coupon[]>([]);
  const [bulkMsg, setBulkMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/coupons');
      const data = await res.json() as { coupons?: Coupon[]; redemptions?: Redemption[] };
      setCoupons(data.coupons ?? []);
      setRedemptions(data.redemptions ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const copy = (id: number, code: string) => {
    void navigator.clipboard.writeText(code);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  const deactivate = async (id: number) => {
    await fetch('/api/admin/coupons', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
    // Pass id via query param
    await fetch(`/api/admin/coupons?id=${id}`, { method: 'DELETE' });
    void load();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          discount_value: Number(form.discount_value),
          min_order_value: Number(form.min_order_value),
          max_uses: form.max_uses ? Number(form.max_uses) : null,
          valid_until: form.valid_until || null,
          customer_email: form.customer_email || null,
        }),
      });
      const data = await res.json() as { coupon?: Coupon; error?: string };
      if (res.ok && data.coupon) {
        setMsg(`Coupon created: ${data.coupon.code}`);
        setForm({ code: '', discount_type: 'percentage', discount_value: '', min_order_value: '0',
          max_uses: '', valid_until: '', coupon_type: 'single_use', customer_email: '' });
        void load();
      } else {
        setMsg(data.error ?? 'Error creating coupon.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleBulk = async (e: React.FormEvent) => {
    e.preventDefault();
    setBulkSaving(true);
    setBulkMsg('');
    setBulkResult([]);
    try {
      const res = await fetch('/api/admin/coupons/bulk-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          count: Number(bulk.count),
          prefix: bulk.prefix,
          discount_type: bulk.discount_type,
          discount_value: Number(bulk.discount_value),
          valid_until: bulk.valid_until || null,
        }),
      });
      const data = await res.json() as { generated?: number; coupons?: Coupon[]; error?: string };
      if (res.ok) {
        setBulkMsg(`Generated ${data.generated} coupons.`);
        setBulkResult(data.coupons ?? []);
        void load();
      } else {
        setBulkMsg(data.error ?? 'Error generating coupons.');
      }
    } finally {
      setBulkSaving(false);
    }
  };

  const glass = 'bg-slate-800/70 border border-white/20 rounded-2xl p-6 shadow-xl';
  const activeCoupons = coupons.filter(c => c.is_active && !c.is_expired);
  const totalDiscount = redemptions.reduce((a, r) => a + Number(r.discount_applied || 0), 0);
  const redemptionRate = coupons.length ? ((coupons.filter(c => c.used_count > 0).length / coupons.length) * 100).toFixed(1) : '0';
  const mostUsed = [...coupons].sort((a, b) => b.used_count - a.used_count)[0];
  const maxUsed = Math.max(...coupons.map(c => c.used_count), 1);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">Coupon Management</h1>
        <p className="text-white/60 mb-6">Create, manage, and track coupon codes and redemptions.</p>

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

        {/* Active Coupons */}
        {tab === 'Active Coupons' && (
          <div className={glass}>
            {loading ? <p className="text-white/50 text-sm">Loading...</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-white/80">
                  <thead>
                    <tr className="text-white/40 text-xs border-b border-white/10">
                      {['Code', 'Type', 'Discount', 'Used', 'Valid Until', 'Status', 'Actions'].map(h => (
                        <th key={h} className="text-left py-2 px-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeCoupons.map(c => (
                      <tr key={c.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs bg-black/20 px-2 py-0.5 rounded">{c.code}</span>
                            <button onClick={() => copy(c.id, c.code)}
                              className="text-xs text-white/40 hover:text-white transition-colors">
                              {copied === c.id ? '✓' : '⧉'}
                            </button>
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[c.coupon_type] ?? 'bg-white/10 text-white/60'}`}>
                            {c.coupon_type}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-green-400 font-medium">{discountLabel(c)}</td>
                        <td className="py-2 px-3 text-xs">{c.used_count}{c.max_uses ? `/${c.max_uses}` : ''}</td>
                        <td className="py-2 px-3 text-xs">{c.valid_until ? c.valid_until.substring(0, 10) : '∞'}</td>
                        <td className="py-2 px-3">
                          {c.is_expired
                            ? <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-300">Expired</span>
                            : <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-300">Active</span>
                          }
                        </td>
                        <td className="py-2 px-3">
                          <button onClick={() => deactivate(c.id)}
                            className="text-xs bg-red-500/20 hover:bg-red-500/40 text-red-300 px-2 py-0.5 rounded transition-all">
                            Deactivate
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!activeCoupons.length && (
                      <tr><td colSpan={7} className="py-8 text-center text-white/30">No active coupons.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Create Coupon */}
        {tab === 'Create Coupon' && (
          <div className={glass}>
            <h2 className="text-lg font-semibold text-white mb-4">Create New Coupon</h2>
            <p className="text-white/50 text-xs mb-4">Leave Code blank to auto-generate an 8-character alphanumeric code.</p>
            {msg && <div className={`mb-4 p-3 rounded-lg text-sm ${msg.includes('created') ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>{msg}</div>}
            <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-white/60 text-xs block mb-1">Code (optional — auto-generates if blank)</label>
                <input type="text" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                  placeholder="e.g. SUMMER25"
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm font-mono placeholder-white/30 focus:outline-none focus:border-violet-400 uppercase" />
              </div>

              <div>
                <label className="text-white/60 text-xs block mb-1">Coupon Type</label>
                <select value={form.coupon_type} onChange={e => setForm(f => ({ ...f, coupon_type: e.target.value }))}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-400">
                  {['single_use', 'multi_use', 'unlimited', 'one_per_customer'].map(t => (
                    <option key={t} value={t} className="bg-slate-800">{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-white/60 text-xs block mb-1">Discount Type</label>
                <select value={form.discount_type} onChange={e => setForm(f => ({ ...f, discount_type: e.target.value }))}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-400">
                  <option value="percentage" className="bg-slate-800">Percentage (%)</option>
                  <option value="fixed_amount" className="bg-slate-800">Fixed Amount ($)</option>
                </select>
              </div>

              <div>
                <label className="text-white/60 text-xs block mb-1">
                  Discount Value {form.discount_type === 'percentage' ? '(%)' : '($)'}
                </label>
                <input required type="number" min="0" step="0.01" value={form.discount_value}
                  onChange={e => setForm(f => ({ ...f, discount_value: e.target.value }))}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-400" />
              </div>

              <div>
                <label className="text-white/60 text-xs block mb-1">Min Order Value ($)</label>
                <input type="number" min="0" step="0.01" value={form.min_order_value}
                  onChange={e => setForm(f => ({ ...f, min_order_value: e.target.value }))}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-400" />
              </div>

              <div>
                <label className="text-white/60 text-xs block mb-1">Max Uses (blank = unlimited)</label>
                <input type="number" min="1" value={form.max_uses} onChange={e => setForm(f => ({ ...f, max_uses: e.target.value }))}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-400" />
              </div>

              <div>
                <label className="text-white/60 text-xs block mb-1">Valid Until</label>
                <input type="datetime-local" value={form.valid_until} onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-400" />
              </div>

              <div>
                <label className="text-white/60 text-xs block mb-1">Restrict to Customer Email (optional)</label>
                <input type="email" value={form.customer_email} onChange={e => setForm(f => ({ ...f, customer_email: e.target.value }))}
                  placeholder="customer@example.com"
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-violet-400" />
              </div>

              <div className="md:col-span-2">
                <button type="submit" disabled={saving}
                  className="bg-violet-600 hover:bg-violet-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50">
                  {saving ? 'Creating...' : 'Create Coupon'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Bulk Generate */}
        {tab === 'Bulk Generate' && (
          <div className={glass}>
            <h2 className="text-lg font-semibold text-white mb-4">Bulk Generate Coupons</h2>
            {bulkMsg && <div className={`mb-4 p-3 rounded-lg text-sm ${bulkMsg.includes('Generated') ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>{bulkMsg}</div>}
            <form onSubmit={handleBulk} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="text-white/60 text-xs block mb-1">Count (1–100)</label>
                <input required type="number" min="1" max="100" value={bulk.count}
                  onChange={e => setBulk(b => ({ ...b, count: e.target.value }))}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-400" />
              </div>

              <div>
                <label className="text-white/60 text-xs block mb-1">Code Prefix (optional)</label>
                <input type="text" value={bulk.prefix} onChange={e => setBulk(b => ({ ...b, prefix: e.target.value }))}
                  placeholder="e.g. BULK"
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm font-mono placeholder-white/30 focus:outline-none focus:border-violet-400 uppercase" />
              </div>

              <div>
                <label className="text-white/60 text-xs block mb-1">Discount Type</label>
                <select value={bulk.discount_type} onChange={e => setBulk(b => ({ ...b, discount_type: e.target.value }))}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-400">
                  <option value="percentage" className="bg-slate-800">Percentage (%)</option>
                  <option value="fixed_amount" className="bg-slate-800">Fixed Amount ($)</option>
                </select>
              </div>

              <div>
                <label className="text-white/60 text-xs block mb-1">Discount Value</label>
                <input required type="number" min="0" step="0.01" value={bulk.discount_value}
                  onChange={e => setBulk(b => ({ ...b, discount_value: e.target.value }))}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-400" />
              </div>

              <div>
                <label className="text-white/60 text-xs block mb-1">Valid Until</label>
                <input type="datetime-local" value={bulk.valid_until} onChange={e => setBulk(b => ({ ...b, valid_until: e.target.value }))}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-400" />
              </div>

              <div className="md:col-span-2">
                <button type="submit" disabled={bulkSaving}
                  className="bg-violet-600 hover:bg-violet-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50">
                  {bulkSaving ? 'Generating...' : 'Generate Coupons'}
                </button>
              </div>
            </form>

            {bulkResult.length > 0 && (
              <div>
                <h3 className="text-white/70 text-sm font-medium mb-3">Generated Codes:</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-64 overflow-y-auto">
                  {bulkResult.map(c => (
                    <div key={c.id} className="font-mono text-xs bg-black/20 px-3 py-2 rounded text-white/80 text-center">
                      {c.code}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Redemption History */}
        {tab === 'Redemption History' && (
          <div className={glass}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-white/80">
                <thead>
                  <tr className="text-white/40 text-xs border-b border-white/10">
                    {['Code', 'Customer', 'Discount Applied', 'Order ID', 'Redeemed At'].map(h => (
                      <th key={h} className="text-left py-2 px-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {redemptions.map(r => (
                    <tr key={r.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-2 px-3 font-mono text-xs">{r.code}</td>
                      <td className="py-2 px-3 text-xs">{r.customer_email ?? '—'}</td>
                      <td className="py-2 px-3 text-green-400">${Number(r.discount_applied || 0).toFixed(2)}</td>
                      <td className="py-2 px-3 text-xs">{r.order_id ?? '—'}</td>
                      <td className="py-2 px-3 text-xs">{new Date(r.redeemed_at).toLocaleString()}</td>
                    </tr>
                  ))}
                  {!redemptions.length && (
                    <tr><td colSpan={5} className="py-8 text-center text-white/30">No redemptions yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Analytics */}
        {tab === 'Analytics' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={glass}>
              <h3 className="text-white font-semibold mb-4">Overview</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Total Coupons', value: coupons.length },
                  { label: 'Active', value: activeCoupons.length },
                  { label: 'Redemption Rate', value: `${redemptionRate}%` },
                  { label: 'Total Discount Given', value: `$${totalDiscount.toFixed(2)}` },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-white/5 rounded-xl p-3">
                    <p className="text-white/50 text-xs">{label}</p>
                    <p className="text-white text-xl font-bold">{value}</p>
                  </div>
                ))}
              </div>
              {mostUsed && (
                <div className="mt-4 p-3 bg-violet-500/10 rounded-xl">
                  <p className="text-white/50 text-xs">Most Used Coupon</p>
                  <p className="text-white font-mono font-medium">{mostUsed.code}</p>
                  <p className="text-violet-400 text-sm">{mostUsed.used_count} redemptions · {discountLabel(mostUsed)}</p>
                </div>
              )}
            </div>

            <div className={glass}>
              <h3 className="text-white font-semibold mb-4">Coupon Usage</h3>
              <div className="space-y-2">
                {coupons.slice(0, 10).map(c => (
                  <div key={c.id}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="font-mono text-white/70">{c.code}</span>
                      <span className="text-white">{c.used_count} uses</span>
                    </div>
                    <div className="bg-white/10 rounded-full h-2">
                      <div className="bg-violet-500 h-2 rounded-full" style={{ width: `${(c.used_count / maxUsed) * 100}%` }} />
                    </div>
                  </div>
                ))}
                {!coupons.length && <p className="text-white/30 text-sm text-center py-4">No coupons yet.</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
