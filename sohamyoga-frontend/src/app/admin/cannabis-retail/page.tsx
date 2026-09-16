'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard','pos','inventory','compliance','reports','staff'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab,string> = {
  dashboard: 'Dashboard',
  pos: 'POS / New Sale',
  inventory: 'Inventory',
  compliance: 'Compliance Log',
  reports: 'Reports',
  staff: 'Staff & Training',
};

const CATEGORIES = ['flower','pre_roll','edible','beverage','concentrate','vape','capsule','topical','accessory','other'];
const LOG_TYPES = ['age_check_fail','daily_limit_check','product_recall','staff_training','aglc_inspection','inventory_count','waste_disposal','suspicious_activity'];
const PAYMENT_METHODS = ['cash','debit','credit'];

interface Product { id:number; brand:string; product_name:string; sku:string; category:string; thc_pct:number|null; cbd_pct:number|null; weight_grams:number|null; retail_price:number; stock_quantity:number; reorder_point:number; compliance_status:string; is_active:boolean; }
interface DashData { sales_today:number; revenue_today:number; items_sold_today:number; compliance_events_mtd:number; low_stock_count:number; product_recalls_active:Product[]; }
interface ComplianceLog { id:number; log_type:string; staff_involved:string|null; description:string; action_taken:string|null; aglc_report_required:boolean; aglc_reported:boolean; created_at:string; }
interface CartItem { product: Product; quantity: number; }
interface TodaySummary { transaction_count:number; total_revenue:number; thc_grams_sold_today:number; by_category:{category:string;units:number;revenue:number}[]; }

function fmtCad(n:number) { return `$${Number(n??0).toLocaleString('en-CA',{minimumFractionDigits:2,maximumFractionDigits:2})}`; }
function fmtDate(d:string) { return d ? new Date(d).toLocaleString('en-CA') : '—'; }

function Badge({ label, color='gray' }:{label:string;color?:string}) {
  const m:Record<string,string> = { blue:'bg-blue-100 text-blue-700', green:'bg-green-100 text-green-700', amber:'bg-amber-100 text-amber-700', red:'bg-red-100 text-red-700', purple:'bg-purple-100 text-purple-700', gray:'bg-gray-100 text-gray-700', teal:'bg-teal-100 text-teal-700' };
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${m[color]??m.gray}`}>{label.replace(/_/g,' ')}</span>;
}

function KpiCard({ label, value, sub, color='blue' }:{label:string;value:string|number;sub?:string;color?:string}) {
  const b:Record<string,string> = { blue:'border-l-4 border-blue-500 bg-blue-50', green:'border-l-4 border-green-500 bg-green-50', amber:'border-l-4 border-amber-500 bg-amber-50', red:'border-l-4 border-red-500 bg-red-50', purple:'border-l-4 border-purple-500 bg-purple-50' };
  return <div className={`rounded-lg p-4 ${b[color]??b.blue}`}><p className="text-sm text-gray-500">{label}</p><p className="text-2xl font-bold mt-1">{value}</p>{sub&&<p className="text-xs text-gray-400 mt-1">{sub}</p>}</div>;
}

function catColor(c:string):string {
  const m:Record<string,string> = { flower:'green', pre_roll:'amber', edible:'purple', beverage:'blue', concentrate:'orange', vape:'teal', capsule:'gray', topical:'gray', accessory:'gray' };
  return m[c]??'gray';
}

// ─── Dashboard Tab ─────────────────────────────────────────────────────────────
function DashboardTab({ dash, products }:{dash:DashData|null;products:Product[]}) {
  if (!dash) return <div className="p-8 text-center text-gray-400">Loading…</div>;
  const lowStock = products.filter(p=>p.stock_quantity<=p.reorder_point && p.compliance_status==='approved' && p.is_active);
  return (
    <div className="space-y-6">
      {dash.product_recalls_active.length > 0 && (
        <div className="bg-red-50 border-2 border-red-400 rounded-lg p-4">
          <h3 className="font-bold text-red-700 text-lg mb-2">PRODUCT RECALL ALERT</h3>
          {dash.product_recalls_active.map(p=>(
            <div key={p.id} className="text-sm text-red-700 font-medium">⚠ {p.brand} {p.product_name} (SKU: {p.sku}) — RECALLED. Remove from floor immediately.</div>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Sales Today" value={dash.sales_today} color="blue"/>
        <KpiCard label="Revenue Today" value={fmtCad(dash.revenue_today)} color="green"/>
        <KpiCard label="Items Sold Today" value={dash.items_sold_today} color="amber"/>
        <KpiCard label="Compliance Events (MTD)" value={dash.compliance_events_mtd} color={dash.compliance_events_mtd>0?'red':'purple'}/>
      </div>
      {lowStock.length > 0 && (
        <div>
          <h3 className="font-semibold text-slate-700 mb-2">Low Stock Alerts ({lowStock.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {lowStock.map(p=>(
              <div key={p.id} className="bg-amber-50 border border-amber-300 rounded-lg p-3">
                <p className="font-medium text-sm">{p.brand} {p.product_name}</p>
                <p className="text-xs text-gray-500">{p.sku}</p>
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-amber-700 font-bold">{p.stock_quantity} units left</span>
                  <span className="text-xs text-gray-400">reorder at {p.reorder_point}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── POS / New Sale Tab ────────────────────────────────────────────────────────
function POSTab({ products, onSaleComplete }:{products:Product[];onSaleComplete:()=>void}) {
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [ageVerified, setAgeVerified] = useState(false);
  const [staffId, setStaffId] = useState('');
  const [payMethod, setPayMethod] = useState<string>('debit');
  const [receipt, setReceipt] = useState<{id:number;total_amount:number;gst_amount:number;subtotal:number;total_thc_grams:number}|null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const availableProducts = products.filter(p => p.compliance_status === 'approved' && p.is_active && p.stock_quantity > 0);
  const filtered = availableProducts.filter(p => !search || `${p.brand} ${p.product_name} ${p.sku}`.toLowerCase().includes(search.toLowerCase()));

  function addToCart(prod: Product) {
    setCart(prev => {
      const existing = prev.find(c => c.product.id === prod.id);
      if (existing) return prev.map(c => c.product.id === prod.id ? {...c, quantity: c.quantity+1} : c);
      return [...prev, { product: prod, quantity: 1 }];
    });
  }
  function removeFromCart(productId: number) { setCart(prev => prev.filter(c => c.product.id !== productId)); }
  function changeQty(productId: number, delta: number) {
    setCart(prev => prev.map(c => {
      if (c.product.id !== productId) return c;
      const newQty = c.quantity + delta;
      return newQty <= 0 ? { ...c, quantity: 1 } : { ...c, quantity: Math.min(newQty, c.product.stock_quantity) };
    }));
  }

  const subtotal = cart.reduce((s,c) => s + c.product.retail_price * c.quantity, 0);
  const gst = Math.round(subtotal * 0.05 * 100) / 100;
  const total = subtotal + gst;
  const thcGrams = cart.reduce((s,c) => {
    const tg = c.product.thc_pct && c.product.weight_grams ? (c.product.thc_pct/100) * c.product.weight_grams * c.quantity : 0;
    return s + tg;
  }, 0);

  async function completeSale() {
    if (!ageVerified) { setError('Age verification is MANDATORY. Toggle the Age Verified switch to proceed.'); return; }
    if (!staffId) { setError('Staff ID required.'); return; }
    if (!cart.length) { setError('Cart is empty.'); return; }
    setError(''); setProcessing(true);
    try {
      const res = await fetch('/api/admin/cannabis-retail/sales', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ staff_id: staffId, customer_age_verified: ageVerified, payment_method: payMethod, items: cart.map(c=>({ product_id: c.product.id, quantity: c.quantity, unit_price: c.product.retail_price })) })
      });
      const data = await res.json() as { id?:number; total_amount?:number; gst_amount?:number; subtotal?:number; total_thc_grams?:number; error?:string };
      if (!res.ok) { setError(data.error || 'Sale failed'); return; }
      setReceipt({ id: data.id!, total_amount: data.total_amount!, gst_amount: data.gst_amount!, subtotal: data.subtotal!, total_thc_grams: data.total_thc_grams! });
      setCart([]); setAgeVerified(false); onSaleComplete();
    } finally { setProcessing(false); }
  }

  if (receipt) {
    return (
      <div className="max-w-md mx-auto text-center">
        <div className="bg-green-50 border border-green-200 rounded-xl p-6">
          <div className="text-4xl mb-2">✓</div>
          <h3 className="font-bold text-lg text-green-700">Sale Complete</h3>
          <p className="text-sm text-gray-500 mb-4">Sale ID #{receipt.id}</p>
          <div className="bg-white rounded-lg p-4 text-left space-y-1 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{fmtCad(receipt.subtotal)}</span></div>
            <div className="flex justify-between"><span>GST (5%)</span><span>{fmtCad(receipt.gst_amount)}</span></div>
            <div className="flex justify-between font-bold text-base border-t pt-1"><span>Total</span><span>{fmtCad(receipt.total_amount)}</span></div>
            <div className="text-xs text-gray-400 pt-1">THC: {receipt.total_thc_grams.toFixed(2)}g</div>
          </div>
          <button onClick={()=>setReceipt(null)} className="mt-4 px-6 py-2 bg-green-600 text-white rounded-lg text-sm">New Sale</button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Product Search */}
      <div className="lg:col-span-2">
        <input className="w-full border rounded-lg px-3 py-2 text-sm mb-3" placeholder="Search brand, product, SKU…" value={search} onChange={e=>setSearch(e.target.value)}/>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-96 overflow-y-auto">
          {filtered.map(p=>(
            <button key={p.id} onClick={()=>addToCart(p)} className="text-left border rounded-lg p-3 hover:bg-blue-50 hover:border-blue-300 transition-colors">
              <div className="flex justify-between items-start">
                <div><p className="font-medium text-sm">{p.brand}</p><p className="text-xs text-gray-500">{p.product_name}</p></div>
                <Badge label={p.category} color={catColor(p.category)}/>
              </div>
              <div className="flex justify-between mt-2 text-xs">
                <span className="text-green-700 font-bold">{fmtCad(p.retail_price)}</span>
                <span className="text-gray-400">{p.thc_pct}% THC · {p.stock_quantity} left</span>
              </div>
            </button>
          ))}
          {filtered.length===0 && <p className="text-gray-400 text-sm col-span-2 py-4 text-center">No available products found.</p>}
        </div>
      </div>
      {/* Cart & Checkout */}
      <div className="bg-white border rounded-xl p-4 space-y-3">
        <h3 className="font-bold text-slate-700">Cart</h3>
        {/* Age Verification — MANDATORY */}
        <div className={`rounded-lg p-3 border-2 ${ageVerified?'border-green-400 bg-green-50':'border-red-400 bg-red-50'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-sm font-bold ${ageVerified?'text-green-700':'text-red-700'}`}>{ageVerified?'AGE VERIFIED ✓':'AGE VERIFICATION REQUIRED'}</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={ageVerified} onChange={e=>setAgeVerified(e.target.checked)}/>
              <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-green-500 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5"></div>
            </label>
          </div>
          {!ageVerified && <p className="text-xs text-red-600 mt-1">Must verify customer is 18+ before completing sale</p>}
        </div>
        <div>
          <label className="text-xs text-gray-500">Staff ID *</label>
          <input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={staffId} onChange={e=>setStaffId(e.target.value)} placeholder="Your employee ID"/>
        </div>
        {/* Cart Items */}
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {cart.length===0 && <p className="text-gray-400 text-xs text-center py-4">No items in cart</p>}
          {cart.map(item=>(
            <div key={item.product.id} className="flex items-center gap-2 text-sm border-b pb-2">
              <div className="flex-1 min-w-0"><p className="font-medium text-xs truncate">{item.product.brand} {item.product.product_name}</p><p className="text-xs text-gray-400">{fmtCad(item.product.retail_price)} each</p></div>
              <div className="flex items-center gap-1">
                <button onClick={()=>changeQty(item.product.id,-1)} className="w-5 h-5 rounded bg-gray-100 text-xs">-</button>
                <span className="w-6 text-center text-xs font-bold">{item.quantity}</span>
                <button onClick={()=>changeQty(item.product.id,1)} className="w-5 h-5 rounded bg-gray-100 text-xs">+</button>
              </div>
              <span className="text-xs font-mono w-16 text-right">{fmtCad(item.product.retail_price*item.quantity)}</span>
              <button onClick={()=>removeFromCart(item.product.id)} className="text-red-400 text-xs">✕</button>
            </div>
          ))}
        </div>
        {/* THC Tracker */}
        {thcGrams > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs">
            <span className="font-medium text-amber-700">THC in this transaction: {thcGrams.toFixed(2)}g</span>
          </div>
        )}
        {/* Totals */}
        <div className="border-t pt-2 space-y-1 text-sm">
          <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{fmtCad(subtotal)}</span></div>
          <div className="flex justify-between text-gray-500"><span>GST (5%)</span><span>{fmtCad(gst)}</span></div>
          <div className="flex justify-between font-bold text-base"><span>Total</span><span>{fmtCad(total)}</span></div>
        </div>
        <div>
          <label className="text-xs text-gray-500">Payment Method</label>
          <div className="flex gap-2 mt-1">
            {PAYMENT_METHODS.map(m=><button key={m} onClick={()=>setPayMethod(m)} className={`flex-1 py-1 text-xs rounded border ${payMethod===m?'bg-blue-600 text-white border-blue-600':'border-gray-200'}`}>{m}</button>)}
          </div>
        </div>
        {error && <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700">{error}</div>}
        <button onClick={completeSale} disabled={processing||!cart.length} className="w-full py-2 bg-green-600 text-white rounded-lg text-sm font-bold disabled:opacity-50">{processing?'Processing…':'Complete Sale'}</button>
      </div>
    </div>
  );
}

// ─── Inventory Tab ─────────────────────────────────────────────────────────────
function InventoryTab({ products, reload }:{products:Product[];reload:()=>void}) {
  const [catFilter, setCatFilter] = useState('');
  const [adjustId, setAdjustId] = useState<number|null>(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [aiProd, setAiProd] = useState<Product|null>(null);
  const [aiDesc, setAiDesc] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const filtered = products.filter(p => !catFilter || p.category === catFilter);

  async function adjustStock(id:number) {
    if (!adjustQty) return;
    const cur = products.find(p=>p.id===id);
    if (!cur) return;
    await fetch(`/api/admin/cannabis-retail/products/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ stock_quantity: cur.stock_quantity + parseInt(adjustQty) }) });
    setAdjustId(null); setAdjustQty(''); reload();
  }

  async function markRecalled(p:Product) {
    if (!confirm(`Mark "${p.brand} ${p.product_name}" as RECALLED? This will log a compliance event and require AGLC reporting.`)) return;
    await fetch(`/api/admin/cannabis-retail/products/${p.id}/recall`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ reason:'Admin initiated recall' }) });
    reload();
  }

  async function getAiDesc(p:Product) {
    setAiProd(p); setAiDesc(''); setAiLoading(true);
    const res = await fetch('/api/admin/cannabis-retail/ai-product-description', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ brand:p.brand, product_name:p.product_name, category:p.category, thc_pct:p.thc_pct, cbd_pct:p.cbd_pct, weight_grams:p.weight_grams }) });
    const data = await res.json() as { description:string };
    setAiDesc(data.description); setAiLoading(false);
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <select className="border rounded-lg px-3 py-1.5 text-sm" value={catFilter} onChange={e=>setCatFilter(e.target.value)}>
          <option value="">All Categories</option>
          {CATEGORIES.map(c=><option key={c} value={c}>{c.replace('_',' ')}</option>)}
        </select>
        <span className="text-sm text-gray-400">{filtered.length} products</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 border-b"><th className="text-left px-3 py-2 font-medium text-gray-600">Product</th><th className="text-left px-3 py-2 font-medium text-gray-600">Category</th><th className="text-right px-3 py-2 font-medium text-gray-600">THC%</th><th className="text-right px-3 py-2 font-medium text-gray-600">Price</th><th className="text-right px-3 py-2 font-medium text-gray-600">Stock</th><th className="text-left px-3 py-2 font-medium text-gray-600">Status</th><th className="text-left px-3 py-2 font-medium text-gray-600">Actions</th></tr></thead>
          <tbody>
            {filtered.map(p=>(
              <tr key={p.id} className={`border-b hover:bg-gray-50 ${p.compliance_status==='recalled'?'bg-red-50':p.stock_quantity<=p.reorder_point?'bg-amber-50':''}`}>
                <td className="px-3 py-2"><p className="font-medium">{p.brand} {p.product_name}</p><p className="text-xs font-mono text-gray-400">{p.sku}</p></td>
                <td className="px-3 py-2"><Badge label={p.category} color={catColor(p.category)}/></td>
                <td className="px-3 py-2 text-right">{p.thc_pct ?? '—'}%</td>
                <td className="px-3 py-2 text-right font-mono">{fmtCad(p.retail_price)}</td>
                <td className={`px-3 py-2 text-right font-bold ${p.stock_quantity<=p.reorder_point?'text-amber-600':''}`}>{p.stock_quantity}</td>
                <td className="px-3 py-2">
                  {p.compliance_status==='recalled' ? <Badge label="RECALLED" color="red"/> : <Badge label={p.compliance_status} color="green"/>}
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-1 flex-wrap">
                    {adjustId===p.id ? (
                      <>
                        <input type="number" className="border rounded px-1 py-0.5 text-xs w-16" placeholder="±qty" value={adjustQty} onChange={e=>setAdjustQty(e.target.value)}/>
                        <button onClick={()=>adjustStock(p.id)} className="text-xs px-2 py-0.5 bg-blue-600 text-white rounded">Save</button>
                        <button onClick={()=>setAdjustId(null)} className="text-xs px-1 py-0.5 text-gray-500">✕</button>
                      </>
                    ) : (
                      <>
                        <button onClick={()=>setAdjustId(p.id)} className="text-xs px-2 py-0.5 bg-gray-100 rounded">Adjust</button>
                        {p.compliance_status!=='recalled' && <button onClick={()=>markRecalled(p)} className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded">Recall</button>}
                        <button onClick={()=>getAiDesc(p)} className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded">AI Desc</button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {aiProd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl p-6 max-h-[80vh] overflow-y-auto">
            <h2 className="font-bold text-lg mb-1">AI Product Description</h2>
            <p className="text-xs text-gray-400 mb-3">{aiProd.brand} {aiProd.product_name}</p>
            {aiLoading ? <div className="py-8 text-center text-gray-400">Generating with Llama 3.2…</div> : <div className="bg-gray-50 rounded-lg p-4 text-sm whitespace-pre-wrap">{aiDesc}</div>}
            <button onClick={()=>{setAiProd(null);setAiDesc('');}} className="mt-4 px-4 py-2 border rounded-lg text-sm">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Compliance Log Tab ────────────────────────────────────────────────────────
function ComplianceTab({ logs, reload }:{logs:ComplianceLog[];reload:()=>void}) {
  const [typeFilter, setTypeFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [f, setF] = useState({ log_type:'age_check_fail', staff_involved:'', description:'', action_taken:'', aglc_report_required:false });
  const [saving, setSaving] = useState(false);
  const up = (k:string, v:string|boolean) => setF(p=>({...p,[k]:v}));

  const filtered = logs.filter(l => !typeFilter || l.log_type === typeFilter);

  async function markReported(id:number) {
    await fetch(`/api/admin/cannabis-retail/compliance/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ aglc_reported: true }) });
    reload();
  }

  async function saveLog() {
    if (!f.description) return;
    setSaving(true);
    try { await fetch('/api/admin/cannabis-retail/compliance', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(f) }); setShowAdd(false); reload(); }
    finally { setSaving(false); }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <select className="border rounded-lg px-3 py-1.5 text-sm" value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}>
          <option value="">All Types</option>
          {LOG_TYPES.map(t=><option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
        </select>
        <button onClick={()=>setShowAdd(true)} className="ml-auto px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg">+ Log Event</button>
      </div>
      <table className="w-full text-sm">
        <thead><tr className="bg-gray-50 border-b"><th className="text-left px-3 py-2 font-medium text-gray-600">Type</th><th className="text-left px-3 py-2 font-medium text-gray-600">Description</th><th className="text-left px-3 py-2 font-medium text-gray-600">Staff</th><th className="text-left px-3 py-2 font-medium text-gray-600">AGLC</th><th className="text-left px-3 py-2 font-medium text-gray-600">Date</th><th className="px-3 py-2"></th></tr></thead>
        <tbody>
          {filtered.map(l=>(
            <tr key={l.id} className="border-b hover:bg-gray-50">
              <td className="px-3 py-2"><Badge label={l.log_type} color={l.log_type==='product_recall'||l.log_type==='age_check_fail'?'red':l.log_type==='aglc_inspection'?'blue':'gray'}/></td>
              <td className="px-3 py-2 max-w-xs"><p className="text-xs">{l.description}</p>{l.action_taken&&<p className="text-xs text-gray-400 mt-0.5">Action: {l.action_taken}</p>}</td>
              <td className="px-3 py-2 text-xs">{l.staff_involved||'—'}</td>
              <td className="px-3 py-2">
                {l.aglc_report_required ? (l.aglc_reported ? <Badge label="Reported" color="green"/> : <Badge label="Required" color="red"/>) : <span className="text-xs text-gray-400">—</span>}
              </td>
              <td className="px-3 py-2 text-xs">{fmtDate(l.created_at)}</td>
              <td className="px-3 py-2">
                {l.aglc_report_required && !l.aglc_reported && <button onClick={()=>markReported(l.id)} className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">Mark Reported</button>}
              </td>
            </tr>
          ))}
          {filtered.length===0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">No compliance events found.</td></tr>}
        </tbody>
      </table>
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
            <h2 className="font-bold text-lg mb-4">Log Compliance Event</h2>
            <div className="space-y-3">
              <div><label className="text-xs text-gray-500">Event Type</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={f.log_type} onChange={e=>up('log_type',e.target.value)}>{LOG_TYPES.map(t=><option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}</select></div>
              <div><label className="text-xs text-gray-500">Staff Involved</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={f.staff_involved} onChange={e=>up('staff_involved',e.target.value)}/></div>
              <div><label className="text-xs text-gray-500">Description *</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={3} value={f.description} onChange={e=>up('description',e.target.value)}/></div>
              <div><label className="text-xs text-gray-500">Action Taken</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={f.action_taken} onChange={e=>up('action_taken',e.target.value)}/></div>
              <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={f.aglc_report_required} onChange={e=>up('aglc_report_required',e.target.checked)}/> AGLC report required</label>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={()=>setShowAdd(false)} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
              <button onClick={saveLog} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg disabled:opacity-50">{saving?'Saving…':'Log Event'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Reports Tab ───────────────────────────────────────────────────────────────
function ReportsTab() {
  const [todaySummary, setTodaySummary] = useState<TodaySummary|null>(null);
  useEffect(() => { fetch('/api/admin/cannabis-retail/sales/today').then(r=>r.json()).then(setTodaySummary); }, []);
  if (!todaySummary) return <div className="p-8 text-center text-gray-400">Loading…</div>;
  return (
    <div className="space-y-6">
      <h3 className="font-semibold text-slate-700">Today's Summary</h3>
      <div className="grid grid-cols-3 gap-4">
        <KpiCard label="Transactions" value={todaySummary.transaction_count} color="blue"/>
        <KpiCard label="Revenue" value={fmtCad(todaySummary.total_revenue)} color="green"/>
        <KpiCard label="THC Grams Sold" value={`${Number(todaySummary.thc_grams_sold_today).toFixed(2)}g`} color="amber"/>
      </div>
      <div>
        <h4 className="font-medium text-slate-700 mb-2">Sales by Category (Today)</h4>
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 border-b"><th className="text-left px-3 py-2 font-medium text-gray-600">Category</th><th className="text-right px-3 py-2 font-medium text-gray-600">Units Sold</th><th className="text-right px-3 py-2 font-medium text-gray-600">Revenue</th></tr></thead>
          <tbody>
            {todaySummary.by_category.map(r=>(
              <tr key={r.category} className="border-b">
                <td className="px-3 py-2"><Badge label={r.category} color={catColor(r.category)}/></td>
                <td className="px-3 py-2 text-right">{r.units}</td>
                <td className="px-3 py-2 text-right font-mono">{fmtCad(r.revenue)}</td>
              </tr>
            ))}
            {todaySummary.by_category.length===0 && <tr><td colSpan={3} className="px-3 py-6 text-center text-gray-400">No sales today.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Staff & Training Tab ──────────────────────────────────────────────────────
function StaffTab() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="font-bold text-blue-800 text-lg mb-3">AGLC Age Verification Requirements</h3>
        <ul className="text-sm text-blue-700 space-y-1.5 list-disc list-inside">
          <li>All customers must be 18 years of age or older — Alberta minimum legal age</li>
          <li>Check ID for EVERY customer who appears under 25 years of age</li>
          <li>Accepted ID: Government-issued photo ID (driver&apos;s licence, passport, Canadian PR card, Status card)</li>
          <li>Expired IDs are NOT acceptable under any circumstances</li>
          <li>If you cannot verify age, do NOT complete the sale — log an age_check_fail event</li>
        </ul>
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
        <h3 className="font-bold text-amber-800 text-lg mb-3">Transaction Limits (AGLC)</h3>
        <ul className="text-sm text-amber-700 space-y-1.5 list-disc list-inside">
          <li>Maximum 30 grams of dried cannabis equivalent per transaction</li>
          <li>1g of dried cannabis = 5g of fresh cannabis = 15g of edible = 70g of liquid = 0.25g of concentrate = 1 capsule</li>
          <li>Retailers may not sell more than the equivalent of 30g dried per transaction</li>
          <li>Monitor THC gram totals — the POS system tracks this automatically</li>
        </ul>
      </div>
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <h3 className="font-bold text-red-800 text-lg mb-3">Product Recall Procedure</h3>
        <ol className="text-sm text-red-700 space-y-1.5 list-decimal list-inside">
          <li>Immediately remove recalled product from shelves and lock in designated recall area</li>
          <li>Mark product as RECALLED in the system (Inventory → Recall button)</li>
          <li>Log a compliance event with log_type: product_recall</li>
          <li>Contact AGLC within 24 hours — file AGLC online complaint/recall notification</li>
          <li>Do NOT sell any recalled product regardless of customer request</li>
          <li>Keep recalled inventory quarantined until AGLC disposal instructions are received</li>
        </ol>
      </div>
      <div className="bg-green-50 border border-green-200 rounded-xl p-6">
        <h3 className="font-bold text-green-800 text-lg mb-3">Responsible Service Protocol</h3>
        <ul className="text-sm text-green-700 space-y-1.5 list-disc list-inside">
          <li>Never market products using terms like "medical benefits," "heals," "treats," or "cures"</li>
          <li>Do not market to minors or use imagery that appeals to youth</li>
          <li>Packaging must remain sealed and in original Health Canada compliant packaging</li>
          <li>Suspicious activity (bulk purchase, resale intent) must be logged and reported</li>
          <li>Store is subject to unannounced AGLC inspections — maintain compliance log up to date</li>
        </ul>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CannabisRetailPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [dash, setDash] = useState<DashData|null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [logs, setLogs] = useState<ComplianceLog[]>([]);

  const loadAll = useCallback(async () => {
    const [d, p, l] = await Promise.all([
      fetch('/api/admin/cannabis-retail').then(r=>r.json()),
      fetch('/api/admin/cannabis-retail/products').then(r=>r.json()),
      fetch('/api/admin/cannabis-retail/compliance').then(r=>r.json()),
    ]);
    setDash(d); setProducts(Array.isArray(p)?p:[]); setLogs(Array.isArray(l)?l:[]);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-slate-800 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-green-600 flex items-center justify-center"><span className="text-white text-sm font-bold">CR</span></div>
          <div>
            <h1 className="text-xl font-bold text-white">Cannabis Retail Hub</h1>
            <p className="text-xs text-slate-400">AGLC Alberta Private Retail · Compliance-First POS · Age Verification Mandatory</p>
          </div>
          {dash?.product_recalls_active && dash.product_recalls_active.length > 0 && (
            <div className="ml-auto bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse">{dash.product_recalls_active.length} ACTIVE RECALL</div>
          )}
        </div>
      </div>
      <div className="border-b bg-white px-6">
        <div className="flex gap-0 overflow-x-auto">
          {TABS.map(t=>(
            <button key={t} onClick={()=>setTab(t)} className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab===t?'border-green-600 text-green-600':'border-transparent text-gray-500 hover:text-gray-700'}`}>{TAB_LABELS[t]}</button>
          ))}
        </div>
      </div>
      <div className="p-6">
        {tab==='dashboard' && <DashboardTab dash={dash} products={products}/>}
        {tab==='pos' && <POSTab products={products} onSaleComplete={loadAll}/>}
        {tab==='inventory' && <InventoryTab products={products} reload={loadAll}/>}
        {tab==='compliance' && <ComplianceTab logs={logs} reload={loadAll}/>}
        {tab==='reports' && <ReportsTab/>}
        {tab==='staff' && <StaffTab/>}
      </div>
    </div>
  );
}
