'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard', 'orders', 'customers', 'materials', 'design-files', 'ai-tools'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = {
  dashboard: 'Dashboard', orders: 'Orders', customers: 'Customers',
  materials: 'Materials', 'design-files': 'Design Files', 'ai-tools': 'AI Tools',
};

const PRODUCT_TYPES = ['business_cards','flyers','brochures','posters','banners','vinyl_signs','vehicle_wrap','window_graphics','yard_signs','roll_up_banner','canvas_print','trade_show_display','stickers','labels','letterhead','envelopes','booklets','t_shirts','branded_merchandise','other'];
const ORDER_STATUSES = ['quote','artwork_review','pre_press','printing','finishing','quality_check','ready_for_pickup','shipped','delivered','cancelled'];
const ARTWORK_STATUSES = ['awaiting','received','approved','revision_needed','final'];
const CUSTOMER_TYPES = ['business','individual','government','non_profit','trade'];
const MATERIAL_CATEGORIES = ['paper','substrate','ink','vinyl','canvas','fabric','other'];
const FINISHES = ['matte','gloss','uv_coating','laminate','none'];

interface DashData { orders_in_production: number; rush_orders_today: number; revenue_mtd: number; materials_low_stock: number; ready_for_pickup_count: number; pipeline: PsOrder[]; }
interface PsCustomer { id: number; first_name: string; last_name: string; email: string; phone: string; company: string; customer_type: string; discount_pct: number; account_status: string; total_orders: number; total_spent: number; notes: string; }
interface PsOrder { id: number; customer_id: number; customer_name: string; company: string; order_number: string; product_type: string; quantity: number; size: string; paper_stock: string; finish: string; sides: string; color_mode: string; artwork_status: string; proof_sent: boolean; proof_approved: boolean; rush_order: boolean; status: string; unit_price: number; total_price: number; setup_fee: number; rush_fee: number; deposit_paid: number; balance_due: number; due_date: string; notes: string; }
interface Material { id: number; name: string; category: string; stock_quantity: number; unit: string; reorder_point: number; cost_per_unit: number; supplier: string; sku: string; is_low_stock: boolean; }
interface DesignFile { id: number; order_id: number; file_name: string; file_url: string; file_type: string; version: number; is_final: boolean; uploaded_at: string; notes: string; }

function fmtCad(n: number) { return `$${Number(n ?? 0).toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`; }
function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString('en-CA') : '—'; }

function Badge({ label, color = 'gray' }: { label: string; color?: string }) {
  const map: Record<string, string> = { blue: 'bg-blue-100 text-blue-700', green: 'bg-green-100 text-green-700', amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700', purple: 'bg-purple-100 text-purple-700', gray: 'bg-gray-100 text-gray-700', teal: 'bg-teal-100 text-teal-700', orange: 'bg-orange-100 text-orange-700', pink: 'bg-pink-100 text-pink-700', sky: 'bg-sky-100 text-sky-700' };
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${map[color] ?? map.gray}`}>{label}</span>;
}

function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const borders: Record<string, string> = { blue: 'border-l-4 border-blue-500 bg-blue-50', green: 'border-l-4 border-green-500 bg-green-50', amber: 'border-l-4 border-amber-500 bg-amber-50', red: 'border-l-4 border-red-500 bg-red-50', purple: 'border-l-4 border-purple-500 bg-purple-50', teal: 'border-l-4 border-teal-500 bg-teal-50', orange: 'border-l-4 border-orange-500 bg-orange-50' };
  return (
    <div className={`rounded-lg p-4 ${borders[color] ?? borders.blue}`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function orderStatusColor(s: string) {
  const m: Record<string, string> = { quote: 'gray', artwork_review: 'amber', pre_press: 'sky', printing: 'blue', finishing: 'purple', quality_check: 'teal', ready_for_pickup: 'green', shipped: 'orange', delivered: 'green', cancelled: 'red' };
  return m[s] ?? 'gray';
}
function artworkColor(s: string) {
  const m: Record<string, string> = { awaiting: 'gray', received: 'blue', approved: 'green', revision_needed: 'red', final: 'teal' };
  return m[s] ?? 'gray';
}

const WORKFLOW_STEPS = ['quote','artwork_review','pre_press','printing','finishing','quality_check','ready_for_pickup','shipped','delivered'];

// ─── Modal: Add Order ──────────────────────────────────────────────────────────
function AddOrderModal({ customers, onClose, onSaved }: { customers: PsCustomer[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ customer_id: '', product_type: 'business_cards', quantity: '250', size: '', paper_stock: '', finish: 'matte', sides: 'double', color_mode: 'full_color', rush_order: false, unit_price: '', setup_fee: '0', rush_fee: '0', deposit_paid: '0', due_date: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.product_type || !form.quantity) return;
    setSaving(true);
    try {
      const qty = parseInt(form.quantity);
      const unit = form.unit_price ? parseFloat(form.unit_price) : null;
      const setup = parseFloat(form.setup_fee);
      const rush = parseFloat(form.rush_fee);
      const total = unit ? unit * qty + setup + rush : null;
      const deposit = parseFloat(form.deposit_paid);
      await fetch('/api/admin/print-shop/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, customer_id: form.customer_id ? parseInt(form.customer_id) : null, quantity: qty, unit_price: unit, setup_fee: setup, rush_fee: rush, total_price: total, deposit_paid: deposit, balance_due: total ? total - deposit : null }),
      });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold mb-4">New Order</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs text-gray-500">Customer</label>
            <select className="w-full border rounded px-2 py-1.5 text-sm" value={form.customer_id} onChange={e => f('customer_id', e.target.value)}>
              <option value="">— Walk-in / No Account —</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.company ?? `${c.first_name} ${c.last_name}`}</option>)}
            </select>
          </div>
          <div><label className="text-xs text-gray-500">Product Type *</label>
            <select className="w-full border rounded px-2 py-1.5 text-sm" value={form.product_type} onChange={e => f('product_type', e.target.value)}>
              {PRODUCT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div><label className="text-xs text-gray-500">Quantity *</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm" value={form.quantity} onChange={e => f('quantity', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Size</label><input className="w-full border rounded px-2 py-1.5 text-sm" placeholder='e.g. 3.5" x 2"' value={form.size} onChange={e => f('size', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Paper Stock</label><input className="w-full border rounded px-2 py-1.5 text-sm" placeholder="e.g. 16pt C2S" value={form.paper_stock} onChange={e => f('paper_stock', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Finish</label>
            <select className="w-full border rounded px-2 py-1.5 text-sm" value={form.finish} onChange={e => f('finish', e.target.value)}>
              {FINISHES.map(f2 => <option key={f2} value={f2}>{f2.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div><label className="text-xs text-gray-500">Sides</label>
            <select className="w-full border rounded px-2 py-1.5 text-sm" value={form.sides} onChange={e => f('sides', e.target.value)}>
              <option value="single">Single</option><option value="double">Double</option>
            </select>
          </div>
          <div><label className="text-xs text-gray-500">Unit Price ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm" value={form.unit_price} onChange={e => f('unit_price', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Setup Fee ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm" value={form.setup_fee} onChange={e => f('setup_fee', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Deposit ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm" value={form.deposit_paid} onChange={e => f('deposit_paid', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Due Date</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm" value={form.due_date} onChange={e => f('due_date', e.target.value)} /></div>
          <div className="col-span-2 flex items-center gap-2"><input type="checkbox" id="rush" checked={form.rush_order} onChange={e => f('rush_order', e.target.checked)} /><label htmlFor="rush" className="text-sm font-medium text-orange-600">Rush Order</label></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm" rows={2} value={form.notes} onChange={e => f('notes', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="px-4 py-2 rounded border text-sm" onClick={onClose}>Cancel</button>
          <button className="px-4 py-2 rounded bg-blue-600 text-white text-sm" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Create Order'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Add Customer ───────────────────────────────────────────────────────
function AddCustomerModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', company: '', customer_type: 'business', billing_address: '', discount_pct: '0', notes: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.first_name || !form.last_name || !form.email) return;
    setSaving(true);
    try {
      await fetch('/api/admin/print-shop/customers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, discount_pct: parseFloat(form.discount_pct) }),
      });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold mb-4">Add Customer</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500">First Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.first_name} onChange={e => f('first_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Last Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.last_name} onChange={e => f('last_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Email *</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.email} onChange={e => f('email', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Phone</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.phone} onChange={e => f('phone', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Company</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.company} onChange={e => f('company', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Customer Type</label>
            <select className="w-full border rounded px-2 py-1.5 text-sm" value={form.customer_type} onChange={e => f('customer_type', e.target.value)}>
              {CUSTOMER_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div><label className="text-xs text-gray-500">Discount %</label><input type="number" min="0" max="100" className="w-full border rounded px-2 py-1.5 text-sm" value={form.discount_pct} onChange={e => f('discount_pct', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Billing Address</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.billing_address} onChange={e => f('billing_address', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm" rows={2} value={form.notes} onChange={e => f('notes', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="px-4 py-2 rounded border text-sm" onClick={onClose}>Cancel</button>
          <button className="px-4 py-2 rounded bg-blue-600 text-white text-sm" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Add Customer'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Add Material ───────────────────────────────────────────────────────
function AddMaterialModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', category: 'paper', stock_quantity: '0', unit: 'sheets', reorder_point: '100', cost_per_unit: '', supplier: '', sku: '' });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  async function submit() {
    if (!form.name) return;
    setSaving(true);
    try {
      await fetch('/api/admin/print-shop/materials', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, stock_quantity: parseFloat(form.stock_quantity), reorder_point: parseFloat(form.reorder_point), cost_per_unit: form.cost_per_unit ? parseFloat(form.cost_per_unit) : null }),
      });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold mb-4">Add Material</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs text-gray-500">Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.name} onChange={e => f('name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Category</label>
            <select className="w-full border rounded px-2 py-1.5 text-sm" value={form.category} onChange={e => f('category', e.target.value)}>
              {MATERIAL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div><label className="text-xs text-gray-500">Unit</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.unit} onChange={e => f('unit', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Stock Qty</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm" value={form.stock_quantity} onChange={e => f('stock_quantity', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Reorder Point</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm" value={form.reorder_point} onChange={e => f('reorder_point', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Cost/Unit ($)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm" value={form.cost_per_unit} onChange={e => f('cost_per_unit', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Supplier</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.supplier} onChange={e => f('supplier', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">SKU</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.sku} onChange={e => f('sku', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="px-4 py-2 rounded border text-sm" onClick={onClose}>Cancel</button>
          <button className="px-4 py-2 rounded bg-blue-600 text-white text-sm" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Add Material'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Adjust Stock ───────────────────────────────────────────────────────
function AdjustStockModal({ material, onClose, onSaved }: { material: Material; onClose: () => void; onSaved: () => void }) {
  const [adjustment, setAdjustment] = useState('0');
  const [saving, setSaving] = useState(false);
  async function submit() {
    setSaving(true);
    try {
      await fetch(`/api/admin/print-shop/materials/${material.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'adjust_stock', adjustment: parseFloat(adjustment) }),
      });
      onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-bold mb-1">Adjust Stock</h2>
        <p className="text-sm text-gray-500 mb-4">{material.name} · Current: {material.stock_quantity} {material.unit}</p>
        <label className="text-xs text-gray-500">Adjustment (positive = add, negative = use)</label>
        <input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-1" value={adjustment} onChange={e => setAdjustment(e.target.value)} />
        <p className="text-xs text-gray-400 mt-1">New total: {material.stock_quantity + parseFloat(adjustment || '0')} {material.unit}</p>
        <div className="flex justify-end gap-2 mt-4">
          <button className="px-4 py-2 rounded border text-sm" onClick={onClose}>Cancel</button>
          <button className="px-4 py-2 rounded bg-blue-600 text-white text-sm" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Adjust'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function PrintShopPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [dash, setDash] = useState<DashData | null>(null);
  const [orders, setOrders] = useState<PsOrder[]>([]);
  const [customers, setCustomers] = useState<PsCustomer[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [designFiles, setDesignFiles] = useState<DesignFile[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [showAddOrder, setShowAddOrder] = useState(false);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [adjustingMaterial, setAdjustingMaterial] = useState<Material | null>(null);
  const [aiDesc, setAiDesc] = useState('');
  const [aiBrief, setAiBrief] = useState('');
  const [aiLoading, setAiLoading] = useState<'desc' | 'brief' | null>(null);
  const [aiDescForm, setAiDescForm] = useState({ product_type: 'business_cards', quantity: '250', size: '3.5x2', finish: 'matte', color_mode: 'full_color' });
  const [aiBriefForm, setAiBriefForm] = useState({ product_type: 'business_cards', company: '', industry: '', goal: '', colors: '', message: '' });
  const [newFile, setNewFile] = useState({ file_name: '', file_url: '', file_type: '', notes: '', is_final: false });

  const loadDash = useCallback(async () => { const r = await fetch('/api/admin/print-shop'); setDash(await r.json()); }, []);
  const loadOrders = useCallback(async (status = '', product = '') => {
    let url = '/api/admin/print-shop/orders?';
    if (status) url += `status=${status}&`;
    if (product) url += `product_type=${product}`;
    const r = await fetch(url); setOrders(await r.json());
  }, []);
  const loadCustomers = useCallback(async () => { const r = await fetch('/api/admin/print-shop/customers'); setCustomers(await r.json()); }, []);
  const loadMaterials = useCallback(async () => { const r = await fetch('/api/admin/print-shop/materials'); setMaterials(await r.json()); }, []);
  const loadDesignFiles = useCallback(async (orderId: string) => {
    if (!orderId) return;
    const r = await fetch(`/api/admin/print-shop/orders/${orderId}/design-files`);
    setDesignFiles(await r.json());
  }, []);

  useEffect(() => { loadDash(); loadCustomers(); }, []);
  useEffect(() => { if (tab === 'orders') loadOrders(statusFilter, productFilter); }, [tab, statusFilter, productFilter]);
  useEffect(() => { if (tab === 'materials') loadMaterials(); }, [tab]);
  useEffect(() => { if (tab === 'design-files' && selectedOrderId) loadDesignFiles(selectedOrderId); }, [tab, selectedOrderId]);

  async function advanceOrder(id: number) {
    await fetch(`/api/admin/print-shop/orders/${id}/advance`, { method: 'POST' });
    loadOrders(statusFilter, productFilter);
    loadDash();
  }

  async function sendProof(id: number) {
    await fetch(`/api/admin/print-shop/orders/${id}/proof`, { method: 'POST' });
    loadOrders(statusFilter, productFilter);
  }

  async function uploadDesignFile() {
    if (!selectedOrderId || !newFile.file_name) return;
    await fetch(`/api/admin/print-shop/orders/${selectedOrderId}/design-files`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newFile),
    });
    setNewFile({ file_name: '', file_url: '', file_type: '', notes: '', is_final: false });
    loadDesignFiles(selectedOrderId);
  }

  async function runAiDesc() {
    setAiLoading('desc');
    try {
      const r = await fetch('/api/admin/print-shop/ai-product-description', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(aiDescForm) });
      const d = await r.json();
      setAiDesc(d.description);
    } finally { setAiLoading(null); }
  }

  async function runAiBrief() {
    setAiLoading('brief');
    try {
      const r = await fetch('/api/admin/print-shop/ai-design-brief', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(aiBriefForm) });
      const d = await r.json();
      setAiBrief(d.brief);
    } finally { setAiLoading(null); }
  }

  const PIPELINE_COLS = ['quote','artwork_review','pre_press','printing','finishing','quality_check','ready_for_pickup'];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-slate-800 text-white px-6 py-4">
        <h1 className="text-xl font-bold">Print Shop & Signage Studio Hub</h1>
        <p className="text-slate-300 text-sm mt-0.5">Order management, production pipeline, design files, materials inventory</p>
      </div>

      <div className="bg-white border-b px-6">
        <div className="flex gap-1">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {/* ── Dashboard ── */}
        {tab === 'dashboard' && dash && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <KpiCard label="In Production" value={dash.orders_in_production} color="blue" />
              <KpiCard label="Rush Orders" value={dash.rush_orders_today} sub="Active" color="orange" />
              <KpiCard label="Revenue MTD" value={fmtCad(dash.revenue_mtd)} color="green" />
              <KpiCard label="Low Stock Items" value={dash.materials_low_stock} color="red" />
              <KpiCard label="Ready for Pickup" value={dash.ready_for_pickup_count} color="teal" />
            </div>

            <div className="bg-white rounded-xl shadow-sm border p-5">
              <h2 className="font-semibold mb-4">Production Pipeline Kanban</h2>
              <div className="overflow-x-auto">
                <div className="flex gap-3 min-w-max">
                  {PIPELINE_COLS.map(col => {
                    const colOrders = dash.pipeline.filter(o => o.status === col);
                    return (
                      <div key={col} className="w-48 flex-shrink-0">
                        <div className="text-xs font-semibold text-gray-500 uppercase mb-2 px-1">{col.replace(/_/g, ' ')} ({colOrders.length})</div>
                        <div className="space-y-2">
                          {colOrders.map(o => (
                            <div key={o.id} className={`rounded-lg p-2 border text-xs ${o.rush_order ? 'border-orange-400 bg-orange-50' : 'bg-white border-gray-200'}`}>
                              <p className="font-medium">{o.order_number}</p>
                              <p className="text-gray-500 truncate">{o.company ?? o.customer_name ?? 'Walk-in'}</p>
                              <p className="text-gray-400 capitalize">{o.product_type?.replace(/_/g, ' ')}</p>
                              {o.rush_order && <Badge label="RUSH" color="orange" />}
                              {o.due_date && <p className="text-gray-400 mt-1">Due: {fmtDate(o.due_date)}</p>}
                            </div>
                          ))}
                          {colOrders.length === 0 && <div className="rounded-lg p-3 bg-gray-50 border border-dashed text-center text-gray-300 text-xs">Empty</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Orders ── */}
        {tab === 'orders' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <select className="border rounded px-3 py-1.5 text-sm" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                  <option value="">All Statuses</option>
                  {ORDER_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
                <select className="border rounded px-3 py-1.5 text-sm" value={productFilter} onChange={e => setProductFilter(e.target.value)}>
                  <option value="">All Products</option>
                  {PRODUCT_TYPES.map(p => <option key={p} value={p}>{p.replace(/_/g, ' ')}</option>)}
                </select>
                <span className="text-sm text-gray-500">{orders.length} orders</span>
              </div>
              <button onClick={() => setShowAddOrder(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">+ New Order</button>
            </div>
            <div className="grid gap-3">
              {orders.map(o => (
                <div key={o.id} className={`bg-white rounded-xl border p-4 ${o.rush_order ? 'border-l-4 border-orange-500' : ''}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-mono text-sm font-bold">{o.order_number}</span>
                        <Badge label={o.product_type.replace(/_/g, ' ')} color="blue" />
                        <Badge label={o.status.replace(/_/g, ' ')} color={orderStatusColor(o.status)} />
                        <Badge label={`Art: ${o.artwork_status}`} color={artworkColor(o.artwork_status)} />
                        {o.rush_order && <Badge label="RUSH" color="orange" />}
                        {o.proof_sent && !o.proof_approved && <Badge label="Proof Sent" color="amber" />}
                        {o.proof_approved && <Badge label="Proof Approved" color="green" />}
                      </div>
                      <p className="text-sm text-gray-600">{o.company ?? o.customer_name ?? 'Walk-in'} · Qty: {o.quantity?.toLocaleString()} · {o.size ?? '—'}</p>
                      <div className="flex gap-3 mt-1 text-xs text-gray-500">
                        <span>Total: <strong>{o.total_price ? fmtCad(o.total_price) : '—'}</strong></span>
                        <span>Balance: <strong className={o.balance_due > 0 ? 'text-red-600' : 'text-green-600'}>{o.balance_due != null ? fmtCad(o.balance_due) : '—'}</strong></span>
                        {o.due_date && <span>Due: {fmtDate(o.due_date)}</span>}
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4 flex-col items-end">
                      {!['delivered','cancelled'].includes(o.status) && (
                        <button onClick={() => advanceOrder(o.id)} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded whitespace-nowrap">Advance Status</button>
                      )}
                      {!o.proof_sent && o.status === 'artwork_review' && (
                        <button onClick={() => sendProof(o.id)} className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded whitespace-nowrap">Send Proof</button>
                      )}
                    </div>
                  </div>
                  {/* Workflow progress bar */}
                  <div className="mt-3 flex gap-1">
                    {WORKFLOW_STEPS.map(step => (
                      <div key={step} title={step.replace(/_/g, ' ')} className={`h-1.5 flex-1 rounded-full ${WORKFLOW_STEPS.indexOf(step) <= WORKFLOW_STEPS.indexOf(o.status) ? 'bg-blue-500' : 'bg-gray-200'}`} />
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-1 text-right">{Math.round((WORKFLOW_STEPS.indexOf(o.status) / (WORKFLOW_STEPS.length - 1)) * 100)}% complete</p>
                </div>
              ))}
              {orders.length === 0 && <div className="bg-white rounded-xl border p-8 text-center text-gray-400">No orders found.</div>}
            </div>
          </div>
        )}

        {/* ── Customers ── */}
        {tab === 'customers' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={() => setShowAddCustomer(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">+ Add Customer</button>
            </div>
            <div className="grid gap-3">
              {customers.map(c => (
                <div key={c.id} className="bg-white rounded-xl border p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{c.company ?? `${c.first_name} ${c.last_name}`}</span>
                        {c.company && <span className="text-sm text-gray-500">{c.first_name} {c.last_name}</span>}
                        <Badge label={c.customer_type.replace(/_/g, ' ')} color="blue" />
                        <Badge label={c.account_status} color={c.account_status === 'active' ? 'green' : c.account_status === 'credit_hold' ? 'red' : 'gray'} />
                        {c.discount_pct > 0 && <Badge label={`${c.discount_pct}% discount`} color="purple" />}
                      </div>
                      <p className="text-sm text-gray-500">{c.email} · {c.phone ?? '—'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{c.total_orders} orders</p>
                      <p className="text-sm text-green-700 font-medium">{fmtCad(c.total_spent)}</p>
                    </div>
                  </div>
                </div>
              ))}
              {customers.length === 0 && <div className="bg-white rounded-xl border p-8 text-center text-gray-400">No customers found.</div>}
            </div>
          </div>
        )}

        {/* ── Materials ── */}
        {tab === 'materials' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={() => setShowAddMaterial(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">+ Add Material</button>
            </div>
            <div className="grid gap-3">
              {materials.map(m => (
                <div key={m.id} className={`bg-white rounded-xl border p-4 ${m.is_low_stock ? 'border-l-4 border-red-500' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{m.name}</span>
                        <Badge label={m.category ?? 'other'} color="teal" />
                        {m.is_low_stock && <Badge label="LOW STOCK" color="red" />}
                      </div>
                      <p className="text-sm text-gray-500">
                        Stock: <strong className={m.is_low_stock ? 'text-red-600' : 'text-green-700'}>{m.stock_quantity} {m.unit}</strong> · Reorder at: {m.reorder_point} {m.unit}
                      </p>
                      <p className="text-xs text-gray-400">{m.supplier ?? '—'} · SKU: {m.sku ?? '—'} · Cost: {m.cost_per_unit ? fmtCad(m.cost_per_unit) + '/' + m.unit : '—'}</p>
                    </div>
                    <button onClick={() => setAdjustingMaterial(m)} className="text-xs bg-gray-100 text-gray-700 px-3 py-2 rounded hover:bg-gray-200">Adjust Stock</button>
                  </div>
                </div>
              ))}
              {materials.length === 0 && <div className="bg-white rounded-xl border p-8 text-center text-gray-400">No materials found.</div>}
            </div>
          </div>
        )}

        {/* ── Design Files ── */}
        {tab === 'design-files' && (
          <div className="space-y-4 max-w-2xl">
            <div className="bg-white rounded-xl border p-4">
              <label className="text-xs text-gray-500 block mb-1">Select Order</label>
              <select className="w-full border rounded px-3 py-2 text-sm" value={selectedOrderId} onChange={e => { setSelectedOrderId(e.target.value); loadDesignFiles(e.target.value); }}>
                <option value="">— Select an Order —</option>
                {orders.map(o => <option key={o.id} value={o.id}>{o.order_number} — {o.product_type.replace(/_/g, ' ')} — {o.company ?? o.customer_name ?? 'Walk-in'}</option>)}
              </select>
            </div>

            {selectedOrderId && (
              <>
                <div className="bg-white rounded-xl border p-4">
                  <h3 className="font-semibold mb-3 text-sm">Upload Design File</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2"><label className="text-xs text-gray-500">File Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={newFile.file_name} onChange={e => setNewFile(p => ({ ...p, file_name: e.target.value }))} placeholder="e.g. logo-v3.ai" /></div>
                    <div className="col-span-2"><label className="text-xs text-gray-500">File URL</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={newFile.file_url} onChange={e => setNewFile(p => ({ ...p, file_url: e.target.value }))} placeholder="https://..." /></div>
                    <div><label className="text-xs text-gray-500">File Type</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={newFile.file_type} onChange={e => setNewFile(p => ({ ...p, file_type: e.target.value }))} placeholder="pdf, ai, psd…" /></div>
                    <div className="flex items-center gap-2 pt-4"><input type="checkbox" id="final" checked={newFile.is_final} onChange={e => setNewFile(p => ({ ...p, is_final: e.target.checked }))} /><label htmlFor="final" className="text-sm">Mark as Final</label></div>
                    <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={newFile.notes} onChange={e => setNewFile(p => ({ ...p, notes: e.target.value }))} /></div>
                  </div>
                  <button onClick={uploadDesignFile} className="mt-3 bg-blue-600 text-white px-4 py-2 rounded text-sm">Upload File Record</button>
                </div>

                <div className="bg-white rounded-xl border p-4">
                  <h3 className="font-semibold mb-3 text-sm">Version History</h3>
                  {designFiles.length === 0 ? (
                    <p className="text-gray-400 text-sm">No files uploaded yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {designFiles.map(f => (
                        <div key={f.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{f.file_name}</span>
                              <Badge label={`v${f.version}`} color="gray" />
                              {f.is_final && <Badge label="FINAL" color="green" />}
                            </div>
                            <p className="text-xs text-gray-400">{f.file_type ?? '—'} · {new Date(f.uploaded_at).toLocaleString('en-CA')}</p>
                            {f.notes && <p className="text-xs text-gray-500 italic">{f.notes}</p>}
                          </div>
                          {f.file_url && <a href={f.file_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">Open</a>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {!selectedOrderId && <div className="bg-white rounded-xl border p-8 text-center text-gray-400">Select an order to view design files.</div>}
          </div>
        )}

        {/* ── AI Tools ── */}
        {tab === 'ai-tools' && (
          <div className="space-y-6 max-w-2xl">
            {/* Product Description */}
            <div className="bg-white rounded-xl border p-5">
              <h2 className="font-semibold mb-4">Product Description Writer</h2>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div><label className="text-xs text-gray-500">Product Type</label>
                  <select className="w-full border rounded px-2 py-1.5 text-sm" value={aiDescForm.product_type} onChange={e => setAiDescForm(p => ({ ...p, product_type: e.target.value }))}>
                    {PRODUCT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div><label className="text-xs text-gray-500">Quantity</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm" value={aiDescForm.quantity} onChange={e => setAiDescForm(p => ({ ...p, quantity: e.target.value }))} /></div>
                <div><label className="text-xs text-gray-500">Size</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={aiDescForm.size} onChange={e => setAiDescForm(p => ({ ...p, size: e.target.value }))} /></div>
                <div><label className="text-xs text-gray-500">Finish</label>
                  <select className="w-full border rounded px-2 py-1.5 text-sm" value={aiDescForm.finish} onChange={e => setAiDescForm(p => ({ ...p, finish: e.target.value }))}>
                    {FINISHES.map(f => <option key={f} value={f}>{f.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div><label className="text-xs text-gray-500">Color Mode</label>
                  <select className="w-full border rounded px-2 py-1.5 text-sm" value={aiDescForm.color_mode} onChange={e => setAiDescForm(p => ({ ...p, color_mode: e.target.value }))}>
                    <option value="full_color">Full Color</option>
                    <option value="black_white">Black & White</option>
                    <option value="spot_color">Spot Color</option>
                  </select>
                </div>
              </div>
              <button onClick={runAiDesc} disabled={aiLoading !== null} className="bg-blue-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50">{aiLoading === 'desc' ? 'Generating…' : 'Generate Description'}</button>
              {aiDesc && <pre className="bg-gray-50 rounded p-4 text-xs whitespace-pre-wrap font-mono border max-h-72 overflow-y-auto mt-3">{aiDesc}</pre>}
            </div>

            {/* Design Brief */}
            <div className="bg-white rounded-xl border p-5">
              <h2 className="font-semibold mb-4">Design Brief Generator</h2>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div><label className="text-xs text-gray-500">Product Type</label>
                  <select className="w-full border rounded px-2 py-1.5 text-sm" value={aiBriefForm.product_type} onChange={e => setAiBriefForm(p => ({ ...p, product_type: e.target.value }))}>
                    {PRODUCT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div><label className="text-xs text-gray-500">Company/Client</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={aiBriefForm.company} onChange={e => setAiBriefForm(p => ({ ...p, company: e.target.value }))} /></div>
                <div><label className="text-xs text-gray-500">Industry</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={aiBriefForm.industry} onChange={e => setAiBriefForm(p => ({ ...p, industry: e.target.value }))} /></div>
                <div><label className="text-xs text-gray-500">Brand Colors</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={aiBriefForm.colors} onChange={e => setAiBriefForm(p => ({ ...p, colors: e.target.value }))} placeholder="e.g. Navy blue, gold" /></div>
                <div className="col-span-2"><label className="text-xs text-gray-500">Goal</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={aiBriefForm.goal} onChange={e => setAiBriefForm(p => ({ ...p, goal: e.target.value }))} /></div>
                <div className="col-span-2"><label className="text-xs text-gray-500">Key Message</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={aiBriefForm.message} onChange={e => setAiBriefForm(p => ({ ...p, message: e.target.value }))} /></div>
              </div>
              <button onClick={runAiBrief} disabled={aiLoading !== null} className="bg-purple-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50">{aiLoading === 'brief' ? 'Generating…' : 'Generate Brief'}</button>
              {aiBrief && <pre className="bg-gray-50 rounded p-4 text-xs whitespace-pre-wrap font-mono border max-h-72 overflow-y-auto mt-3">{aiBrief}</pre>}
            </div>
          </div>
        )}
      </div>

      {showAddOrder && <AddOrderModal customers={customers} onClose={() => setShowAddOrder(false)} onSaved={() => { setShowAddOrder(false); loadOrders(statusFilter, productFilter); loadDash(); }} />}
      {showAddCustomer && <AddCustomerModal onClose={() => setShowAddCustomer(false)} onSaved={() => { setShowAddCustomer(false); loadCustomers(); }} />}
      {showAddMaterial && <AddMaterialModal onClose={() => setShowAddMaterial(false)} onSaved={() => { setShowAddMaterial(false); loadMaterials(); }} />}
      {adjustingMaterial && <AdjustStockModal material={adjustingMaterial} onClose={() => setAdjustingMaterial(null)} onSaved={() => { setAdjustingMaterial(null); loadMaterials(); }} />}
    </div>
  );
}
