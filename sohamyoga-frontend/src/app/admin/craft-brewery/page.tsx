'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard', 'brewlog', 'inventory', 'taproom', 'distribution', 'ai'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = {
  dashboard: 'Dashboard',
  brewlog: 'Brew Log',
  inventory: 'Inventory',
  taproom: 'Taproom Sales',
  distribution: 'Distribution',
  ai: 'AI Tools',
};

const BATCH_STATUSES = ['planning', 'mashing', 'fermenting', 'conditioning', 'packaging', 'complete'];
const PACKAGE_TYPES = ['keg', 'can', 'bottle', 'cask'];

interface Stats {
  total_batches: number;
  active_fermentations: number;
  kegs_in_stock: number;
  taproom_sales_mtd: number;
  distribution_accounts: number;
  cogs_pct: number;
}
interface Batch {
  id: number;
  batch_code: string;
  beer_name: string;
  style: string;
  status: string;
  og: number | null;
  fg: number | null;
  abv_pct: number | null;
  fermentation_vessel: string | null;
  brew_date: string;
  package_date: string | null;
  volume_litres: number;
  notes: string | null;
}
interface InventoryItem {
  id: number;
  beer_name: string;
  package_type: string;
  quantity_on_hand: number;
  reorder_point: number;
  unit_size_ml: number;
}
interface TaproomSale {
  id: number;
  sale_date: string;
  beer_name: string;
  pints_sold: number;
  amount: number;
  payment_method: string;
}
interface DistributionAccount {
  id: number;
  account_name: string;
  contact_name: string;
  phone: string;
  last_delivery: string | null;
  next_delivery: string | null;
  kegs_on_consignment: number;
}

function fmtCad(n: number) { return `$${Number(n ?? 0).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function fmtDate(d: string | null) { return d ? new Date(d).toLocaleDateString('en-CA') : '—'; }

function Badge({ label, color = 'gray' }: { label: string; color?: string }) {
  const map: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
    purple: 'bg-purple-100 text-purple-700',
    gray: 'bg-gray-100 text-gray-700',
    teal: 'bg-teal-100 text-teal-700',
    orange: 'bg-orange-100 text-orange-700',
  };
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${map[color] ?? map.gray}`}>{label.replace(/_/g, ' ')}</span>;
}

function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const borders: Record<string, string> = {
    blue: 'border-l-4 border-blue-500 bg-blue-50',
    green: 'border-l-4 border-green-500 bg-green-50',
    amber: 'border-l-4 border-amber-500 bg-amber-50',
    red: 'border-l-4 border-red-500 bg-red-50',
    purple: 'border-l-4 border-purple-500 bg-purple-50',
    teal: 'border-l-4 border-teal-500 bg-teal-50',
  };
  return (
    <div className={`rounded-lg p-4 ${borders[color] ?? borders.blue}`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function statusColor(s: string): string {
  const m: Record<string, string> = {
    planning: 'gray',
    mashing: 'amber',
    fermenting: 'blue',
    conditioning: 'purple',
    packaging: 'orange',
    complete: 'green',
  };
  return m[s] ?? 'gray';
}

// ─── New Batch Modal ───────────────────────────────────────────────────────────
function NewBatchModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    batch_code: '',
    beer_name: '',
    style: '',
    volume_litres: '',
    og: '',
    fg: '',
    fermentation_vessel: '',
    brew_date: new Date().toISOString().slice(0, 10),
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const up = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  async function save() {
    if (!form.batch_code || !form.beer_name || !form.style) { setError('Batch code, beer name and style are required.'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/craft-brewery/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          volume_litres: parseFloat(form.volume_litres) || 0,
          og: form.og ? parseFloat(form.og) : null,
          fg: form.fg ? parseFloat(form.fg) : null,
        }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setError(data.error || 'Save failed'); return; }
      onSaved(); onClose();
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="font-bold text-lg mb-4">New Batch</h2>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500">Batch Code *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.batch_code} onChange={e => up('batch_code', e.target.value)} placeholder="e.g. B2026-042"/></div>
            <div><label className="text-xs text-gray-500">Beer Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.beer_name} onChange={e => up('beer_name', e.target.value)} placeholder="e.g. Summit IPA"/></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500">Style *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.style} onChange={e => up('style', e.target.value)} placeholder="e.g. West Coast IPA"/></div>
            <div><label className="text-xs text-gray-500">Volume (L)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.volume_litres} onChange={e => up('volume_litres', e.target.value)}/></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-xs text-gray-500">OG</label><input type="number" step="0.001" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.og} onChange={e => up('og', e.target.value)} placeholder="1.060"/></div>
            <div><label className="text-xs text-gray-500">FG</label><input type="number" step="0.001" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.fg} onChange={e => up('fg', e.target.value)} placeholder="1.012"/></div>
            <div><label className="text-xs text-gray-500">Fermentation Vessel</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.fermentation_vessel} onChange={e => up('fermentation_vessel', e.target.value)} placeholder="FV-01"/></div>
          </div>
          <div><label className="text-xs text-gray-500">Brew Date</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.brew_date} onChange={e => up('brew_date', e.target.value)}/></div>
          <div><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.notes} onChange={e => up('notes', e.target.value)}/></div>
          {error && <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700">{error}</div>}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg disabled:opacity-50">{saving ? 'Saving…' : 'Create Batch'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard Tab ─────────────────────────────────────────────────────────────
function DashboardTab({ stats, batches }: { stats: Stats | null; batches: Batch[] }) {
  if (!stats) return <div className="p-8 text-center text-gray-400">Loading…</div>;
  const activeFermentations = batches.filter(b => b.status === 'fermenting' || b.status === 'conditioning');
  const byStatus = BATCH_STATUSES.map(s => ({ status: s, count: batches.filter(b => b.status === s).length })).filter(x => x.count > 0);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard label="Total Batches" value={stats.total_batches} color="blue"/>
        <KpiCard label="Active Fermentations" value={stats.active_fermentations} color="amber"/>
        <KpiCard label="Kegs In Stock" value={stats.kegs_in_stock} color="teal"/>
        <KpiCard label="Taproom Sales MTD" value={fmtCad(stats.taproom_sales_mtd)} color="green"/>
        <KpiCard label="Distribution Accounts" value={stats.distribution_accounts} color="purple"/>
        <KpiCard label="COGS %" value={`${Number(stats.cogs_pct ?? 0).toFixed(1)}%`} color={stats.cogs_pct > 40 ? 'red' : 'green'}/>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="font-semibold text-slate-700 mb-3">Batch Status Summary</h3>
          <div className="bg-white rounded-xl border p-4 space-y-2">
            {byStatus.length === 0 && <p className="text-gray-400 text-sm">No batches yet.</p>}
            {byStatus.map(x => (
              <div key={x.status} className="flex items-center justify-between">
                <Badge label={x.status} color={statusColor(x.status)}/>
                <span className="font-bold text-slate-700">{x.count}</span>
              </div>
            ))}
          </div>
        </div>
        {activeFermentations.length > 0 && (
          <div>
            <h3 className="font-semibold text-slate-700 mb-3">Active Fermentations ({activeFermentations.length})</h3>
            <div className="space-y-2">
              {activeFermentations.map(b => (
                <div key={b.id} className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{b.beer_name}</p>
                      <p className="text-xs text-gray-500">{b.batch_code} · {b.style}</p>
                    </div>
                    <Badge label={b.status} color={statusColor(b.status)}/>
                  </div>
                  {b.fermentation_vessel && <p className="text-xs text-gray-400 mt-1">Vessel: {b.fermentation_vessel}</p>}
                  <p className="text-xs text-gray-400">Brew date: {fmtDate(b.brew_date)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Brew Log Tab ──────────────────────────────────────────────────────────────
function BrewLogTab({ batches, reload }: { batches: Batch[]; reload: () => void }) {
  const [statusFilter, setStatusFilter] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const filtered = batches.filter(b => !statusFilter || b.status === statusFilter);

  async function advanceStatus(batch: Batch) {
    const idx = BATCH_STATUSES.indexOf(batch.status);
    if (idx < 0 || idx >= BATCH_STATUSES.length - 1) return;
    const nextStatus = BATCH_STATUSES[idx + 1];
    setUpdatingId(batch.id);
    try {
      await fetch(`/api/admin/craft-brewery/batches/${batch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      reload();
    } finally { setUpdatingId(null); }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <select className="border rounded-lg px-3 py-1.5 text-sm" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {BATCH_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
        <span className="text-sm text-gray-400">{filtered.length} batches</span>
        <button onClick={() => setShowNew(true)} className="ml-auto px-4 py-1.5 bg-amber-600 text-white text-sm rounded-lg">+ New Batch</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-3 py-2 font-medium text-gray-600">Batch</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Style</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Status</th>
              <th className="text-right px-3 py-2 font-medium text-gray-600">OG</th>
              <th className="text-right px-3 py-2 font-medium text-gray-600">FG</th>
              <th className="text-right px-3 py-2 font-medium text-gray-600">ABV%</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Vessel</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Brew Date</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Package Date</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(b => (
              <tr key={b.id} className="border-b hover:bg-gray-50">
                <td className="px-3 py-2">
                  <p className="font-medium">{b.beer_name}</p>
                  <p className="text-xs font-mono text-gray-400">{b.batch_code}</p>
                </td>
                <td className="px-3 py-2 text-gray-600">{b.style}</td>
                <td className="px-3 py-2"><Badge label={b.status} color={statusColor(b.status)}/></td>
                <td className="px-3 py-2 text-right font-mono text-xs">{b.og ?? '—'}</td>
                <td className="px-3 py-2 text-right font-mono text-xs">{b.fg ?? '—'}</td>
                <td className="px-3 py-2 text-right font-mono text-xs">{b.abv_pct != null ? `${b.abv_pct}%` : '—'}</td>
                <td className="px-3 py-2 text-xs text-gray-500">{b.fermentation_vessel ?? '—'}</td>
                <td className="px-3 py-2 text-xs">{fmtDate(b.brew_date)}</td>
                <td className="px-3 py-2 text-xs">{fmtDate(b.package_date)}</td>
                <td className="px-3 py-2">
                  {b.status !== 'complete' && (
                    <button
                      onClick={() => advanceStatus(b)}
                      disabled={updatingId === b.id}
                      className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded hover:bg-amber-200 disabled:opacity-50"
                    >
                      {updatingId === b.id ? '…' : `→ ${BATCH_STATUSES[BATCH_STATUSES.indexOf(b.status) + 1] ?? ''}`}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={10} className="px-3 py-8 text-center text-gray-400">No batches found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {showNew && <NewBatchModal onClose={() => setShowNew(false)} onSaved={reload}/>}
    </div>
  );
}

// ─── Inventory Tab ─────────────────────────────────────────────────────────────
function InventoryTab({ items, reload }: { items: InventoryItem[]; reload: () => void }) {
  const [adjustId, setAdjustId] = useState<number | null>(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [pkgFilter, setPkgFilter] = useState('');

  const filtered = items.filter(i => !pkgFilter || i.package_type === pkgFilter);

  async function adjustStock(id: number) {
    const delta = parseInt(adjustQty);
    if (!delta || isNaN(delta)) return;
    const cur = items.find(i => i.id === id);
    if (!cur) return;
    await fetch(`/api/admin/craft-brewery/ingredients/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity_on_hand: cur.quantity_on_hand + delta }),
    });
    setAdjustId(null); setAdjustQty(''); reload();
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <select className="border rounded-lg px-3 py-1.5 text-sm" value={pkgFilter} onChange={e => setPkgFilter(e.target.value)}>
          <option value="">All Package Types</option>
          {PACKAGE_TYPES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
        </select>
        <span className="text-sm text-gray-400">{filtered.length} items</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-3 py-2 font-medium text-gray-600">Beer</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Package</th>
              <th className="text-right px-3 py-2 font-medium text-gray-600">Size (mL)</th>
              <th className="text-right px-3 py-2 font-medium text-gray-600">Qty On Hand</th>
              <th className="text-right px-3 py-2 font-medium text-gray-600">Reorder At</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(i => {
              const isLow = i.quantity_on_hand <= i.reorder_point;
              return (
                <tr key={i.id} className={`border-b hover:bg-gray-50 ${isLow ? 'bg-red-50' : ''}`}>
                  <td className="px-3 py-2 font-medium">{i.beer_name}</td>
                  <td className="px-3 py-2">
                    <Badge label={i.package_type} color={i.package_type === 'keg' ? 'teal' : i.package_type === 'can' ? 'blue' : i.package_type === 'bottle' ? 'amber' : 'gray'}/>
                  </td>
                  <td className="px-3 py-2 text-right">{i.unit_size_ml}</td>
                  <td className={`px-3 py-2 text-right font-bold ${isLow ? 'text-red-600' : ''}`}>{i.quantity_on_hand}</td>
                  <td className="px-3 py-2 text-right text-gray-400">{i.reorder_point}</td>
                  <td className="px-3 py-2">
                    {adjustId === i.id ? (
                      <div className="flex items-center gap-1">
                        <input type="number" className="border rounded px-1 py-0.5 text-xs w-16" placeholder="±qty" value={adjustQty} onChange={e => setAdjustQty(e.target.value)}/>
                        <button onClick={() => adjustStock(i.id)} className="text-xs px-2 py-0.5 bg-blue-600 text-white rounded">Save</button>
                        <button onClick={() => setAdjustId(null)} className="text-xs px-1 py-0.5 text-gray-500">✕</button>
                      </div>
                    ) : (
                      <button onClick={() => { setAdjustId(i.id); setAdjustQty(''); }} className="text-xs px-2 py-0.5 bg-gray-100 rounded">Adjust</button>
                    )}
                    {isLow && <span className="ml-2 text-xs text-red-600 font-semibold">LOW STOCK</span>}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">No inventory items found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Taproom Sales Tab ─────────────────────────────────────────────────────────
function TaproomTab() {
  const [sales, setSales] = useState<TaproomSale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch('/api/admin/craft-brewery/taproom/today')
      .then(r => r.json())
      .then((d: TaproomSale[] | { sales?: TaproomSale[] }) => {
        if (Array.isArray(d)) setSales(d);
        else if (d && Array.isArray((d as { sales?: TaproomSale[] }).sales)) setSales((d as { sales: TaproomSale[] }).sales);
        else setSales([]);
      })
      .catch(() => setSales([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center text-gray-400">Loading…</div>;

  const byMethod: Record<string, number> = {};
  sales.forEach(s => { byMethod[s.payment_method] = (byMethod[s.payment_method] ?? 0) + s.amount; });
  const totalRev = sales.reduce((acc, s) => acc + s.amount, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <KpiCard label="Transactions Today" value={sales.length} color="blue"/>
        <KpiCard label="Revenue Today" value={fmtCad(totalRev)} color="green"/>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500 mb-2">By Payment Method</p>
          {Object.entries(byMethod).map(([m, v]) => (
            <div key={m} className="flex justify-between text-sm">
              <span className="capitalize text-gray-600">{m}</span>
              <span className="font-mono font-medium">{fmtCad(v)}</span>
            </div>
          ))}
          {Object.keys(byMethod).length === 0 && <p className="text-xs text-gray-400">No sales yet today.</p>}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-3 py-2 font-medium text-gray-600">Time</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Beer</th>
              <th className="text-right px-3 py-2 font-medium text-gray-600">Pints</th>
              <th className="text-right px-3 py-2 font-medium text-gray-600">Amount</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Payment</th>
            </tr>
          </thead>
          <tbody>
            {sales.map(s => (
              <tr key={s.id} className="border-b hover:bg-gray-50">
                <td className="px-3 py-2 text-xs text-gray-500">{new Date(s.sale_date).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}</td>
                <td className="px-3 py-2 font-medium">{s.beer_name}</td>
                <td className="px-3 py-2 text-right">{s.pints_sold}</td>
                <td className="px-3 py-2 text-right font-mono">{fmtCad(s.amount)}</td>
                <td className="px-3 py-2"><Badge label={s.payment_method} color="blue"/></td>
              </tr>
            ))}
            {sales.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-400">No taproom sales recorded today.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Distribution Tab ──────────────────────────────────────────────────────────
function DistributionTab({ accounts }: { accounts: DistributionAccount[] }) {
  if (accounts.length === 0) {
    return (
      <div className="py-12 text-center text-gray-400">
        <p className="text-lg font-medium mb-2">No Distribution Accounts</p>
        <p className="text-sm">Add distribution accounts via the API to track deliveries and consignment.</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b">
            <th className="text-left px-3 py-2 font-medium text-gray-600">Account</th>
            <th className="text-left px-3 py-2 font-medium text-gray-600">Contact</th>
            <th className="text-left px-3 py-2 font-medium text-gray-600">Phone</th>
            <th className="text-left px-3 py-2 font-medium text-gray-600">Last Delivery</th>
            <th className="text-left px-3 py-2 font-medium text-gray-600">Next Delivery</th>
            <th className="text-right px-3 py-2 font-medium text-gray-600">Kegs On Consignment</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map(a => (
            <tr key={a.id} className="border-b hover:bg-gray-50">
              <td className="px-3 py-2 font-medium">{a.account_name}</td>
              <td className="px-3 py-2 text-gray-600">{a.contact_name}</td>
              <td className="px-3 py-2 text-xs text-gray-500">{a.phone}</td>
              <td className="px-3 py-2 text-xs">{fmtDate(a.last_delivery)}</td>
              <td className="px-3 py-2 text-xs">{fmtDate(a.next_delivery)}</td>
              <td className="px-3 py-2 text-right font-bold">{a.kegs_on_consignment}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── AI Tools Tab ─────────────────────────────────────────────────────────────
function AIToolsTab() {
  const [recipeStyle, setRecipeStyle] = useState('');
  const [recipeAbv, setRecipeAbv] = useState('');
  const [recipe, setRecipe] = useState('');
  const [recipeLoading, setRecipeLoading] = useState(false);

  const [tasteBeer, setTasteBeer] = useState('');
  const [tasteStyle, setTasteStyle] = useState('');
  const [tasteAbv, setTasteAbv] = useState('');
  const [tasteNotes, setTasteNotes] = useState('');
  const [tasteLoading, setTasteLoading] = useState(false);

  async function generateRecipe() {
    if (!recipeStyle) return;
    setRecipeLoading(true); setRecipe('');
    try {
      const res = await fetch('/api/admin/craft-brewery/ai-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ style: recipeStyle, target_abv: recipeAbv ? parseFloat(recipeAbv) : undefined }),
      });
      const data = await res.json() as { recipe?: string; suggestion?: string; error?: string };
      setRecipe(data.recipe ?? data.suggestion ?? JSON.stringify(data));
    } finally { setRecipeLoading(false); }
  }

  async function generateTastingNotes() {
    if (!tasteBeer) return;
    setTasteLoading(true); setTasteNotes('');
    try {
      const res = await fetch('/api/admin/craft-brewery/ai-tasting-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ beer_name: tasteBeer, style: tasteStyle, abv_pct: tasteAbv ? parseFloat(tasteAbv) : undefined }),
      });
      const data = await res.json() as { notes?: string; tasting_notes?: string; error?: string };
      setTasteNotes(data.notes ?? data.tasting_notes ?? JSON.stringify(data));
    } finally { setTasteLoading(false); }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
      {/* Recipe Suggestion */}
      <div className="bg-white rounded-xl border p-5">
        <h3 className="font-bold text-slate-700 mb-1">Recipe Suggestion</h3>
        <p className="text-xs text-gray-400 mb-4">Powered by Llama 3.2 (local Ollama)</p>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500">Beer Style *</label>
            <input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={recipeStyle} onChange={e => setRecipeStyle(e.target.value)} placeholder="e.g. West Coast IPA, Stout, Hefeweizen"/>
          </div>
          <div>
            <label className="text-xs text-gray-500">Target ABV (%)</label>
            <input type="number" step="0.1" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={recipeAbv} onChange={e => setRecipeAbv(e.target.value)} placeholder="e.g. 6.5"/>
          </div>
          <button onClick={generateRecipe} disabled={!recipeStyle || recipeLoading} className="w-full py-2 bg-amber-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
            {recipeLoading ? 'Generating…' : 'Generate Recipe'}
          </button>
          {recipe && <div className="bg-gray-50 rounded-lg p-3 text-xs whitespace-pre-wrap mt-2 max-h-60 overflow-y-auto">{recipe}</div>}
        </div>
      </div>
      {/* Tasting Notes Generator */}
      <div className="bg-white rounded-xl border p-5">
        <h3 className="font-bold text-slate-700 mb-1">Tasting Note Generator</h3>
        <p className="text-xs text-gray-400 mb-4">Generate professional tasting notes for menus and tap cards</p>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500">Beer Name *</label>
            <input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={tasteBeer} onChange={e => setTasteBeer(e.target.value)} placeholder="e.g. Summit IPA"/>
          </div>
          <div>
            <label className="text-xs text-gray-500">Style</label>
            <input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={tasteStyle} onChange={e => setTasteStyle(e.target.value)} placeholder="e.g. West Coast IPA"/>
          </div>
          <div>
            <label className="text-xs text-gray-500">ABV (%)</label>
            <input type="number" step="0.1" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={tasteAbv} onChange={e => setTasteAbv(e.target.value)} placeholder="e.g. 6.5"/>
          </div>
          <button onClick={generateTastingNotes} disabled={!tasteBeer || tasteLoading} className="w-full py-2 bg-amber-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
            {tasteLoading ? 'Generating…' : 'Generate Tasting Notes'}
          </button>
          {tasteNotes && <div className="bg-gray-50 rounded-lg p-3 text-xs whitespace-pre-wrap mt-2 max-h-60 overflow-y-auto">{tasteNotes}</div>}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CraftBreweryPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [stats, setStats] = useState<Stats | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [accounts, setAccounts] = useState<DistributionAccount[]>([]);

  const loadAll = useCallback(async () => {
    const [s, b, inv] = await Promise.all([
      fetch('/api/admin/craft-brewery').then(r => r.json()).catch(() => null),
      fetch('/api/admin/craft-brewery/batches').then(r => r.json()).catch(() => []),
      fetch('/api/admin/craft-brewery/ingredients').then(r => r.json()).catch(() => []),
    ]);
    setStats(s);
    setBatches(Array.isArray(b) ? b : (b?.batches ?? []));
    setInventory(Array.isArray(inv) ? inv : (inv?.ingredients ?? []));
    // Distribution accounts — optional endpoint
    fetch('/api/admin/craft-brewery/recipe-calculator')
      .then(r => r.json())
      .then((d: DistributionAccount[] | { accounts?: DistributionAccount[] }) => {
        if (Array.isArray(d)) setAccounts(d);
        else if (d && Array.isArray((d as { accounts?: DistributionAccount[] }).accounts)) setAccounts((d as { accounts: DistributionAccount[] }).accounts);
        else setAccounts([]);
      })
      .catch(() => setAccounts([]));
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-slate-800 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-600 flex items-center justify-center">
            <span className="text-white text-sm font-bold">CB</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Craft Brewery Hub</h1>
            <p className="text-xs text-slate-400">Batch Management · Taproom POS · Distribution · AI Recipe &amp; Tasting Notes</p>
          </div>
          {stats && (
            <div className="ml-auto flex gap-3">
              <div className="bg-amber-700 text-white text-xs px-3 py-1 rounded-full">{stats.active_fermentations} fermenting</div>
              {stats.kegs_in_stock < 10 && <div className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full">Low keg stock</div>}
            </div>
          )}
        </div>
      </div>
      <div className="border-b bg-white px-6">
        <div className="flex gap-0 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t ? 'border-amber-600 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
      </div>
      <div className="p-6">
        {tab === 'dashboard' && <DashboardTab stats={stats} batches={batches}/>}
        {tab === 'brewlog' && <BrewLogTab batches={batches} reload={loadAll}/>}
        {tab === 'inventory' && <InventoryTab items={inventory} reload={loadAll}/>}
        {tab === 'taproom' && <TaproomTab/>}
        {tab === 'distribution' && <DistributionTab accounts={accounts}/>}
        {tab === 'ai' && <AIToolsTab/>}
      </div>
    </div>
  );
}
