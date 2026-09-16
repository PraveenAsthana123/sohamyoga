'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard','pos','products','customers','sales-history','ai','analytics'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab,string> = { dashboard:'Dashboard', pos:'POS / New Sale', products:'Products', customers:'Customers', 'sales-history':'Sales History', ai:'AI Tools', analytics:'Analytics' };

const CATEGORIES = ['Accessories','Apparel','Beauty','Books','Candles','Food','Gifts','Home Decor','Jewelry','Kids','Pets','Stationery','Wellness','Other'];
const PAYMENT_METHODS = ['cash','credit','debit','etransfer','gift_card','loyalty_points','split'];
const LOYALTY_TIERS = ['bronze','silver','gold','platinum'];
const SEASONS = ['Spring','Summer','Stampede Season','Back to School','Fall','Christmas','New Year'];

interface SrProduct { id:number; name:string; sku:string; category:string; brand:string; description:string; cost_price:number; retail_price:number; sale_price:number; is_on_sale:boolean; margin_pct:number; stock_quantity:number; reorder_point:number; location:string; is_active:boolean; tags:string[]; }
interface SrCustomer { id:number; first_name:string; last_name:string; email:string; phone:string; birthday:string; loyalty_points:number; loyalty_tier:string; total_purchases:number; total_spent:number; last_purchase_date:string; }
interface SrSale { id:number; customer_id:number; first_name:string; last_name:string; sale_date:string; subtotal:number; discount_amount:number; gst_amount:number; total_amount:number; payment_method:string; staff_name:string; loyalty_points_earned:number; }
interface CartItem { product: SrProduct; quantity: number; discount_pct: number; }

function fmtCad(n:number|string) { return `$${Number(n??0).toLocaleString('en-CA',{minimumFractionDigits:2,maximumFractionDigits:2})}`; }
function fmtDate(d:string) { return d?new Date(d).toLocaleDateString('en-CA'):'—'; }

function Badge({ label, color='gray' }: { label:string; color?:string }) {
  const m: Record<string,string> = { blue:'bg-blue-100 text-blue-700', green:'bg-green-100 text-green-700', amber:'bg-amber-100 text-amber-700', red:'bg-red-100 text-red-700', gray:'bg-gray-100 text-gray-700', teal:'bg-teal-100 text-teal-700', purple:'bg-purple-100 text-purple-700', orange:'bg-orange-100 text-orange-700', yellow:'bg-yellow-100 text-yellow-700' };
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${m[color]??m.gray}`}>{label.replace(/_/g,' ')}</span>;
}
function KpiCard({ label, value, sub, color='blue' }: { label:string; value:string|number; sub?:string; color?:string }) {
  const b: Record<string,string> = { blue:'border-l-4 border-blue-500 bg-blue-50', green:'border-l-4 border-green-500 bg-green-50', amber:'border-l-4 border-amber-500 bg-amber-50', red:'border-l-4 border-red-500 bg-red-50', purple:'border-l-4 border-purple-500 bg-purple-50' };
  return <div className={`rounded-lg p-4 ${b[color]??b.blue}`}><p className="text-sm text-gray-500">{label}</p><p className="text-2xl font-bold mt-1">{value}</p>{sub&&<p className="text-xs text-gray-400 mt-1">{sub}</p>}</div>;
}
function marginColor(m:number) { return m>=50?'green':m>=30?'amber':'red'; }
function tierColor(t:string) { return {platinum:'purple',gold:'yellow',silver:'gray',bronze:'orange'}[t]??'gray'; }

// ─── Add Product Modal ─────────────────────────────────────────────────────────
function AddProductModal({ onClose, onSaved }: { onClose:()=>void; onSaved:()=>void }) {
  const [form,setForm] = useState({ name:'',sku:'',category:'Accessories',subcategory:'',brand:'',description:'',cost_price:'',retail_price:'',stock_quantity:'0',reorder_point:'5',location:'',is_seasonal:'false' });
  const [saving,setSaving] = useState(false);
  const f = (k:string,v:string) => setForm(p=>({...p,[k]:v}));
  const margin = form.retail_price && form.cost_price ? ((parseFloat(form.retail_price)-parseFloat(form.cost_price))/parseFloat(form.retail_price)*100).toFixed(1) : '—';
  async function submit() {
    if (!form.name||!form.sku||!form.cost_price||!form.retail_price) return;
    setSaving(true);
    try { await fetch('/api/admin/specialty-retail/products',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,cost_price:parseFloat(form.cost_price),retail_price:parseFloat(form.retail_price),stock_quantity:parseInt(form.stock_quantity)||0,reorder_point:parseInt(form.reorder_point)||5,is_seasonal:form.is_seasonal==='true'})}); onSaved(); }
    finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl p-6 overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-4 text-slate-800">Add Product</h2>
        {margin!=='—' && <div className={`mb-3 p-2 text-sm rounded ${parseFloat(margin)>=30?'bg-green-50 text-green-700':'bg-red-50 text-red-700'}`}>Margin: <strong>{margin}%</strong></div>}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs text-gray-500">Product Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.name} onChange={e=>f('name',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">SKU *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5 font-mono" value={form.sku} onChange={e=>f('sku',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Brand</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.brand} onChange={e=>f('brand',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Category</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.category} onChange={e=>f('category',e.target.value)}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Subcategory</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.subcategory} onChange={e=>f('subcategory',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Cost Price *</label><input type="number" step="0.01" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.cost_price} onChange={e=>f('cost_price',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Retail Price *</label><input type="number" step="0.01" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.retail_price} onChange={e=>f('retail_price',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Stock Quantity</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.stock_quantity} onChange={e=>f('stock_quantity',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Reorder Point</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.reorder_point} onChange={e=>f('reorder_point',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Location (shelf/bin)</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.location} onChange={e=>f('location',e.target.value)} placeholder="e.g. A3-shelf2" /></div>
          <div><label className="text-xs text-gray-500">Seasonal?</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.is_seasonal} onChange={e=>f('is_seasonal',e.target.value)}><option value="false">No</option><option value="true">Yes</option></select></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Description</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.description} onChange={e=>f('description',e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border rounded hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{saving?'Saving…':'Add Product'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Customer Modal ────────────────────────────────────────────────────────
function AddCustomerModal({ onClose, onSaved }: { onClose:()=>void; onSaved:()=>void }) {
  const [form,setForm] = useState({ first_name:'',last_name:'',email:'',phone:'',birthday:'',notes:'' });
  const [saving,setSaving] = useState(false);
  const f = (k:string,v:string) => setForm(p=>({...p,[k]:v}));
  async function submit() {
    if (!form.first_name||!form.last_name) return;
    setSaving(true);
    try { await fetch('/api/admin/specialty-retail/customers',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)}); onSaved(); }
    finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold mb-4 text-slate-800">New Customer</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500">First Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.first_name} onChange={e=>f('first_name',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Last Name *</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.last_name} onChange={e=>f('last_name',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Email</label><input type="email" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.email} onChange={e=>f('email',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Phone</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.phone} onChange={e=>f('phone',e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Birthday</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={form.birthday} onChange={e=>f('birthday',e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" rows={2} value={form.notes} onChange={e=>f('notes',e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border rounded hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-teal-600 text-white rounded hover:bg-teal-700 disabled:opacity-50">{saving?'Saving…':'Add Customer'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Stock Adjust Modal ────────────────────────────────────────────────────────
function AdjustStockModal({ product, onClose, onSaved }: { product:SrProduct; onClose:()=>void; onSaved:()=>void }) {
  const [adj,setAdj] = useState('0');
  const [reason,setReason] = useState('');
  const [saving,setSaving] = useState(false);
  async function submit() {
    setSaving(true);
    try { await fetch(`/api/admin/specialty-retail/products/${product.id}/adjust-stock`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({adjustment:parseInt(adj),reason})}); onSaved(); }
    finally { setSaving(false); }
  }
  const newQty = product.stock_quantity + (parseInt(adj)||0);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
        <h2 className="text-lg font-bold mb-1 text-slate-800">Adjust Stock</h2>
        <p className="text-sm text-gray-500 mb-4">{product.name} · Current: <strong>{product.stock_quantity}</strong></p>
        <div className="space-y-3">
          <div><label className="text-xs text-gray-500">Adjustment (+received / -sold/shrinkage)</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={adj} onChange={e=>setAdj(e.target.value)} /></div>
          <p className="text-sm">New quantity: <strong className={newQty<=product.reorder_point?'text-red-600':'text-green-700'}>{newQty}</strong></p>
          <div><label className="text-xs text-gray-500">Reason</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={reason} onChange={e=>setReason(e.target.value)} placeholder="Received shipment, shrinkage, count adjustment..." /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border rounded hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50">{saving?'Saving…':'Apply'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function SpecialtyRetailPage() {
  const [tab,setTab] = useState<Tab>('dashboard');
  const [dashboard,setDashboard] = useState<any>(null);
  const [products,setProducts] = useState<SrProduct[]>([]);
  const [customers,setCustomers] = useState<SrCustomer[]>([]);
  const [sales,setSales] = useState<SrSale[]>([]);
  const [stats,setStats] = useState<any>(null);
  const [cart,setCart] = useState<CartItem[]>([]);
  const [posSearch,setPosSearch] = useState('');
  const [posCustomerId,setPosCustomerId] = useState<string>('');
  const [posPayment,setPosPayment] = useState('credit');
  const [posStaff,setPosStaff] = useState('');
  const [posDiscount,setPosDiscount] = useState('0');
  const [posRedeemPts,setPosRedeemPts] = useState('0');
  const [saleSaved,setSaleSaved] = useState<any>(null);
  const [showAddProduct,setShowAddProduct] = useState(false);
  const [showAddCustomer,setShowAddCustomer] = useState(false);
  const [adjustProduct,setAdjustProduct] = useState<SrProduct|null>(null);
  const [aiMode,setAiMode] = useState<'description'|'promotion'>('description');
  const [aiProduct,setAiProduct] = useState<string>('');
  const [aiOutput,setAiOutput] = useState('');
  const [aiLoading,setAiLoading] = useState(false);
  const [aiPromoForm,setAiPromoForm] = useState({category:'',season:'',goal:'increase foot traffic',budget:'$500'});
  const [productSearch,setProductSearch] = useState('');
  const [productCategory,setProductCategory] = useState('');
  const [showLowStock,setShowLowStock] = useState(false);

  const load = useCallback(async () => {
    try {
      const [d,p,c,s,st] = await Promise.all([
        fetch('/api/admin/specialty-retail').then(r=>r.json()),
        fetch('/api/admin/specialty-retail/products').then(r=>r.json()),
        fetch('/api/admin/specialty-retail/customers').then(r=>r.json()),
        fetch('/api/admin/specialty-retail/sales').then(r=>r.json()),
        fetch('/api/admin/specialty-retail/stats').then(r=>r.json()),
      ]);
      setDashboard(d); setProducts(Array.isArray(p)?p:[]); setCustomers(Array.isArray(c)?c:[]); setSales(Array.isArray(s)?s:[]); setStats(st);
    } catch {}
  }, []);
  useEffect(() => { load(); }, []);

  // POS logic
  const filteredPOS = products.filter(p => p.stock_quantity>0 && (p.name.toLowerCase().includes(posSearch.toLowerCase()) || p.sku.toLowerCase().includes(posSearch.toLowerCase())));
  function addToCart(prod:SrProduct) {
    setCart(prev=>{
      const ex = prev.find(i=>i.product.id===prod.id);
      if (ex) return prev.map(i=>i.product.id===prod.id?{...i,quantity:i.quantity+1}:i);
      return [...prev,{product:prod,quantity:1,discount_pct:0}];
    });
  }
  function removeFromCart(productId:number) { setCart(prev=>prev.filter(i=>i.product.id!==productId)); }
  function updateCartQty(productId:number,qty:number) { setCart(prev=>prev.map(i=>i.product.id===productId?{...i,quantity:Math.max(1,qty)}:i)); }
  const cartSubtotal = cart.reduce((s,i)=>{
    const price = i.product.is_on_sale && i.product.sale_price ? i.product.sale_price : i.product.retail_price;
    return s + price*i.quantity*(1-i.discount_pct/100);
  },0);
  const discAmt = parseFloat(posDiscount)||0;
  const loyaltyAmt = (parseInt(posRedeemPts)||0)/100;
  const gst = Math.max(0,cartSubtotal-discAmt-loyaltyAmt)*0.05;
  const total = Math.max(0,cartSubtotal-discAmt-loyaltyAmt)+gst;
  const ptsEarned = Math.floor(total*10);

  async function completeSale() {
    if (!cart.length) return;
    const items = cart.map(i=>({ product_id:i.product.id, quantity:i.quantity, discount_pct:i.discount_pct, unit_price:i.product.is_on_sale&&i.product.sale_price?i.product.sale_price:i.product.retail_price }));
    const res = await fetch('/api/admin/specialty-retail/sales',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ items, customer_id:posCustomerId?parseInt(posCustomerId):null, payment_method:posPayment, staff_name:posStaff||undefined, discount_amount:discAmt, loyalty_points_redeemed:parseInt(posRedeemPts)||0 })});
    const data = await res.json();
    if (data.sale) { setSaleSaved(data.sale); setCart([]); setPosDiscount('0'); setPosRedeemPts('0'); load(); }
  }

  async function generateAi() {
    setAiLoading(true); setAiOutput('');
    try {
      let endpoint = 'ai-product-description', payload:any = {};
      if (aiMode==='description') {
        const prod = products.find(p=>String(p.id)===aiProduct);
        endpoint = 'ai-product-description'; payload = prod || {};
      } else {
        endpoint = 'ai-promotion'; payload = aiPromoForm;
      }
      const r = await fetch(`/api/admin/specialty-retail/${endpoint}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const data = await r.json();
      setAiOutput(data.description||data.campaign||JSON.stringify(data));
    } finally { setAiLoading(false); }
  }

  const filteredProducts = products.filter(p=>{
    if (productCategory && p.category!==productCategory) return false;
    if (showLowStock && p.stock_quantity>p.reorder_point) return false;
    if (productSearch && !p.name.toLowerCase().includes(productSearch.toLowerCase()) && !p.sku.toLowerCase().includes(productSearch.toLowerCase())) return false;
    return true;
  });

  const customerMap: Record<number,SrCustomer> = {};
  for (const c of customers) customerMap[c.id] = c;
  const selectedCust = posCustomerId ? customerMap[parseInt(posCustomerId)] : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-2xl font-bold text-slate-800">Specialty Retail & Boutique Hub</h1>
        <p className="text-sm text-gray-500 mt-0.5">POS, inventory, loyalty, and AI tools for boutique retail in Calgary</p>
      </div>
      <div className="bg-white border-b px-6">
        <div className="flex gap-0 overflow-x-auto">
          {TABS.map(t=><button key={t} onClick={()=>setTab(t)} className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab===t?'border-rose-600 text-rose-600':'border-transparent text-gray-500 hover:text-gray-700'}`}>{TAB_LABELS[t]}</button>)}
        </div>
      </div>

      <div className="p-6">
        {/* DASHBOARD */}
        {tab==='dashboard' && (
          <div className="space-y-6">
            {dashboard ? (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <KpiCard label="Revenue Today" value={fmtCad(dashboard.revenue_today)} color="green" />
                <KpiCard label="Transactions Today" value={dashboard.transaction_count_today} color="blue" />
                <KpiCard label="Avg Transaction" value={fmtCad(dashboard.avg_transaction_today)} color="purple" />
                <KpiCard label="Low Stock Items" value={dashboard.low_stock_count} color={dashboard.low_stock_count>0?'red':'green'} />
                <KpiCard label="Top Product Today" value={dashboard.top_product_today?.name||'—'} sub={dashboard.top_product_today?fmtCad(dashboard.top_product_today.revenue):undefined} color="amber" />
              </div>
            ) : <div className="h-20 bg-gray-100 rounded animate-pulse" />}

            {dashboard?.low_stock_count > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="font-semibold text-red-800 mb-2">Low Stock Alerts</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {products.filter(p=>p.stock_quantity<=p.reorder_point).slice(0,8).map(p=>(
                    <div key={p.id} className="flex justify-between items-center text-sm p-2 bg-white rounded border border-red-100">
                      <span className="truncate mr-2">{p.name}</span>
                      <span className="font-bold text-red-600 flex-shrink-0">{p.stock_quantity}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="font-semibold text-slate-700 mb-3">Last 5 Transactions</h3>
              <div className="bg-white rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b"><tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Time</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Customer</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Payment</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-500">Total</th>
                  </tr></thead>
                  <tbody>
                    {sales.slice(0,5).map(s=>(
                      <tr key={s.id} className="border-b">
                        <td className="px-4 py-2">{new Date(s.sale_date).toLocaleTimeString('en-CA',{hour:'2-digit',minute:'2-digit'})}</td>
                        <td className="px-4 py-2">{s.first_name?`${s.first_name} ${s.last_name}`:'Walk-in'}</td>
                        <td className="px-4 py-2"><Badge label={s.payment_method} color="blue" /></td>
                        <td className="px-4 py-2 text-right font-semibold text-green-700">{fmtCad(s.total_amount)}</td>
                      </tr>
                    ))}
                    {!sales.length && <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">No sales yet today.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* POS */}
        {tab==='pos' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Product search */}
            <div>
              <h2 className="text-lg font-semibold text-slate-800 mb-3">Product Search</h2>
              <input className="w-full border rounded px-3 py-2 text-sm mb-3" placeholder="Search by name or SKU…" value={posSearch} onChange={e=>setPosSearch(e.target.value)} />
              <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                {filteredPOS.slice(0,20).map(p=>(
                  <div key={p.id} className="bg-white rounded-lg border p-3 flex justify-between items-center cursor-pointer hover:bg-gray-50" onClick={()=>addToCart(p)}>
                    <div><p className="font-medium text-sm">{p.name}</p><p className="text-xs text-gray-400">{p.sku} · {p.location||'—'} · Stock: {p.stock_quantity}</p></div>
                    <div className="text-right flex-shrink-0 ml-3">
                      {p.is_on_sale && p.sale_price ? (
                        <div><p className="font-bold text-rose-600">{fmtCad(p.sale_price)}</p><p className="text-xs line-through text-gray-400">{fmtCad(p.retail_price)}</p></div>
                      ) : <p className="font-bold text-slate-800">{fmtCad(p.retail_price)}</p>}
                    </div>
                  </div>
                ))}
                {!filteredPOS.length && <p className="text-center py-8 text-gray-400">No products found.</p>}
              </div>
            </div>

            {/* Cart */}
            <div>
              <h2 className="text-lg font-semibold text-slate-800 mb-3">Current Sale</h2>
              {saleSaved && (
                <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="font-semibold text-green-800">Sale Complete!</p>
                  <p className="text-sm text-green-700">Total: {fmtCad(saleSaved.total_amount)} · Points earned: {saleSaved.loyalty_points_earned}</p>
                  <button onClick={()=>setSaleSaved(null)} className="mt-1 text-xs text-green-600 underline">Start new sale</button>
                </div>
              )}
              <div className="bg-white rounded-lg border p-4">
                {cart.length===0 ? <p className="text-center py-8 text-gray-400 text-sm">Click products to add to cart</p> : (
                  <div>
                    <table className="w-full text-sm mb-3">
                      <thead className="border-b"><tr><th className="text-left py-1 font-medium text-gray-500">Item</th><th className="text-center py-1 font-medium text-gray-500 w-16">Qty</th><th className="text-right py-1 font-medium text-gray-500">Total</th><th className="w-8"></th></tr></thead>
                      <tbody>
                        {cart.map(item=>{
                          const price = item.product.is_on_sale&&item.product.sale_price?item.product.sale_price:item.product.retail_price;
                          return (
                            <tr key={item.product.id} className="border-b">
                              <td className="py-2"><p className="font-medium">{item.product.name}</p><p className="text-xs text-gray-400">{fmtCad(price)}/ea</p></td>
                              <td className="py-2 text-center"><input type="number" min="1" className="w-14 text-center border rounded px-1 py-0.5 text-sm" value={item.quantity} onChange={e=>updateCartQty(item.product.id,parseInt(e.target.value)||1)} /></td>
                              <td className="py-2 text-right font-semibold">{fmtCad(price*item.quantity)}</td>
                              <td className="py-2 text-center"><button onClick={()=>removeFromCart(item.product.id)} className="text-red-400 hover:text-red-600 text-xs">✕</button></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div className="space-y-2 text-sm border-t pt-3">
                      <div className="flex justify-between"><span>Subtotal</span><span>{fmtCad(cartSubtotal)}</span></div>
                      <div className="flex gap-2 items-center"><span className="flex-1">Discount</span><span>$</span><input type="number" min="0" className="w-20 border rounded px-2 py-0.5 text-sm" value={posDiscount} onChange={e=>setPosDiscount(e.target.value)} /></div>
                      {selectedCust && <div className="flex gap-2 items-center"><span className="flex-1">Redeem Points ({selectedCust.loyalty_points} avail)</span><input type="number" min="0" className="w-20 border rounded px-2 py-0.5 text-sm" value={posRedeemPts} onChange={e=>setPosRedeemPts(e.target.value)} /></div>}
                      <div className="flex justify-between text-gray-500"><span>GST (5%)</span><span>{fmtCad(gst)}</span></div>
                      <div className="flex justify-between font-bold text-lg border-t pt-2"><span>Total</span><span className="text-green-700">{fmtCad(total)}</span></div>
                      {ptsEarned>0 && <p className="text-xs text-teal-600">+{ptsEarned} loyalty points will be earned</p>}
                    </div>
                  </div>
                )}
                <div className="mt-4 space-y-2 border-t pt-3">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-xs text-gray-500">Customer (optional)</label>
                      <select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={posCustomerId} onChange={e=>setPosCustomerId(e.target.value)}>
                        <option value="">Walk-in</option>
                        {customers.map(c=><option key={c.id} value={c.id}>{c.first_name} {c.last_name} ({c.loyalty_points}pts)</option>)}
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-gray-500">Staff Name</label>
                      <input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={posStaff} onChange={e=>setPosStaff(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Payment Method</label>
                    <select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={posPayment} onChange={e=>setPosPayment(e.target.value)}>
                      {PAYMENT_METHODS.map(m=><option key={m} value={m}>{m.replace(/_/g,' ')}</option>)}
                    </select>
                  </div>
                  <button onClick={completeSale} disabled={!cart.length} className="w-full py-2.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50 font-semibold">Complete Sale — {fmtCad(total)}</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PRODUCTS */}
        {tab==='products' && (
          <div>
            <div className="flex flex-wrap gap-3 items-center justify-between mb-4">
              <div className="flex gap-2 items-center flex-wrap">
                <h2 className="text-lg font-semibold text-slate-800">Products</h2>
                <input className="border rounded px-2 py-1.5 text-sm" placeholder="Search…" value={productSearch} onChange={e=>setProductSearch(e.target.value)} />
                <select className="border rounded px-2 py-1.5 text-sm" value={productCategory} onChange={e=>setProductCategory(e.target.value)}>
                  <option value="">All categories</option>
                  {CATEGORIES.map(c=><option key={c}>{c}</option>)}
                </select>
                <label className="flex items-center gap-1 text-sm cursor-pointer"><input type="checkbox" checked={showLowStock} onChange={e=>setShowLowStock(e.target.checked)} />Low stock only</label>
              </div>
              <button onClick={()=>setShowAddProduct(true)} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">+ Add Product</button>
            </div>
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b"><tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Product</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Category</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Cost</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Retail</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">Margin</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">Stock</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">Actions</th>
                </tr></thead>
                <tbody>
                  {filteredProducts.map(p=>(
                    <tr key={p.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3"><p className="font-medium">{p.name}</p><p className="text-xs text-gray-400">{p.sku} · {p.brand||'—'}</p>{p.is_on_sale&&<Badge label="ON SALE" color="red" />}</td>
                      <td className="px-4 py-3">{p.category}</td>
                      <td className="px-4 py-3 text-right">{fmtCad(p.cost_price)}</td>
                      <td className="px-4 py-3 text-right font-medium">{p.is_on_sale&&p.sale_price?<><span className="text-rose-600">{fmtCad(p.sale_price)}</span><span className="text-xs line-through text-gray-400 ml-1">{fmtCad(p.retail_price)}</span></>:fmtCad(p.retail_price)}</td>
                      <td className="px-4 py-3 text-center"><Badge label={`${Number(p.margin_pct).toFixed(0)}%`} color={marginColor(Number(p.margin_pct))} /></td>
                      <td className="px-4 py-3 text-center"><span className={p.stock_quantity<=p.reorder_point?'text-red-600 font-bold':''}>{p.stock_quantity}</span>{p.stock_quantity<=p.reorder_point&&<span className="text-xs text-red-500 ml-1">⚠</span>}</td>
                      <td className="px-4 py-3 text-center"><button onClick={()=>setAdjustProduct(p)} className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded hover:bg-orange-200">Adjust Stock</button></td>
                    </tr>
                  ))}
                  {!filteredProducts.length && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No products found.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CUSTOMERS */}
        {tab==='customers' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-800">Customers ({customers.length})</h2>
              <button onClick={()=>setShowAddCustomer(true)} className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700">+ Add Customer</button>
            </div>
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b"><tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Customer</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Tier</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Points</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Total Spent</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">Purchases</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Last Visit</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Birthday</th>
                </tr></thead>
                <tbody>
                  {customers.map(c=>{
                    const bday = c.birthday ? new Date(c.birthday) : null;
                    const isBirthdaySoon = bday ? (() => { const today=new Date(); const bNext=new Date(today.getFullYear(),bday.getMonth(),bday.getDate()); if(bNext<today)bNext.setFullYear(today.getFullYear()+1); return (bNext.getTime()-today.getTime())/86400000<=30; })() : false;
                    return (
                      <tr key={c.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3"><p className="font-medium">{c.first_name} {c.last_name}</p><p className="text-xs text-gray-400">{c.email||c.phone||'—'}</p></td>
                        <td className="px-4 py-3"><Badge label={c.loyalty_tier} color={tierColor(c.loyalty_tier)} /></td>
                        <td className="px-4 py-3 text-right font-medium">{c.loyalty_points.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right">{fmtCad(c.total_spent)}</td>
                        <td className="px-4 py-3 text-center">{c.total_purchases}</td>
                        <td className="px-4 py-3">{fmtDate(c.last_purchase_date)}</td>
                        <td className="px-4 py-3">{c.birthday?<span className={isBirthdaySoon?'text-rose-600 font-medium':''}>{fmtDate(c.birthday)}{isBirthdaySoon&&' 🎂'}</span>:'—'}</td>
                      </tr>
                    );
                  })}
                  {!customers.length && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No customers yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SALES HISTORY */}
        {tab==='sales-history' && (
          <div>
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Sales History</h2>
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b"><tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Date/Time</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Customer</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Staff</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Payment</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Subtotal</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">GST</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Total</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">Pts Earned</th>
                </tr></thead>
                <tbody>
                  {sales.map(s=>(
                    <tr key={s.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3">{new Date(s.sale_date).toLocaleString('en-CA',{dateStyle:'short',timeStyle:'short'})}</td>
                      <td className="px-4 py-3">{s.first_name?`${s.first_name} ${s.last_name}`:'Walk-in'}</td>
                      <td className="px-4 py-3">{s.staff_name||'—'}</td>
                      <td className="px-4 py-3"><Badge label={s.payment_method} color="blue" /></td>
                      <td className="px-4 py-3 text-right">{fmtCad(s.subtotal)}</td>
                      <td className="px-4 py-3 text-right">{fmtCad(s.gst_amount)}</td>
                      <td className="px-4 py-3 text-right font-semibold">{fmtCad(s.total_amount)}</td>
                      <td className="px-4 py-3 text-center text-teal-600">{s.loyalty_points_earned}</td>
                    </tr>
                  ))}
                  {!sales.length && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No sales yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* AI TOOLS */}
        {tab==='ai' && (
          <div className="max-w-3xl">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">AI Retail Tools</h2>
            <div className="bg-white rounded-lg border p-4 mb-4">
              <div className="mb-4">
                <label className="text-xs text-gray-500 block mb-1">Tool</label>
                <div className="flex gap-2">
                  <button onClick={()=>setAiMode('description')} className={`px-4 py-2 text-sm rounded-lg ${aiMode==='description'?'bg-blue-600 text-white':'border hover:bg-gray-50'}`}>Product Description</button>
                  <button onClick={()=>setAiMode('promotion')} className={`px-4 py-2 text-sm rounded-lg ${aiMode==='promotion'?'bg-rose-600 text-white':'border hover:bg-gray-50'}`}>Promotion Campaign</button>
                </div>
              </div>
              {aiMode==='description' ? (
                <div className="mb-4">
                  <label className="text-xs text-gray-500 block mb-1">Select Product</label>
                  <select className="w-full border rounded px-2 py-1.5 text-sm" value={aiProduct} onChange={e=>setAiProduct(e.target.value)}>
                    <option value="">Select a product…</option>
                    {products.map(p=><option key={p.id} value={p.id}>{p.name} ({p.category})</option>)}
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div><label className="text-xs text-gray-500">Category</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiPromoForm.category} onChange={e=>setAiPromoForm(p=>({...p,category:e.target.value}))} placeholder="e.g. Jewelry, All Products" /></div>
                  <div><label className="text-xs text-gray-500">Season</label><select className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiPromoForm.season} onChange={e=>setAiPromoForm(p=>({...p,season:e.target.value}))}><option value="">Select…</option>{SEASONS.map(s=><option key={s}>{s}</option>)}</select></div>
                  <div><label className="text-xs text-gray-500">Goal</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiPromoForm.goal} onChange={e=>setAiPromoForm(p=>({...p,goal:e.target.value}))} /></div>
                  <div><label className="text-xs text-gray-500">Budget</label><input className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" value={aiPromoForm.budget} onChange={e=>setAiPromoForm(p=>({...p,budget:e.target.value}))} /></div>
                </div>
              )}
              <button onClick={generateAi} disabled={aiLoading||(aiMode==='description'&&!aiProduct)} className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium">{aiLoading?'Generating…':'Generate'}</button>
            </div>
            {aiOutput && (
              <div className="bg-white rounded-lg border p-4">
                <h3 className="font-semibold text-slate-800 mb-3">{aiMode==='description'?'Product Description':'Campaign Copy'}</h3>
                <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">{aiOutput}</pre>
                <button onClick={()=>navigator.clipboard.writeText(aiOutput)} className="mt-3 text-xs text-blue-600 hover:underline">Copy to clipboard</button>
              </div>
            )}
          </div>
        )}

        {/* ANALYTICS */}
        {tab==='analytics' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-slate-800">Analytics</h2>
            {stats ? (
              <>
                <div className="bg-white rounded-lg border p-4">
                  <h3 className="font-semibold text-slate-700 mb-3">Revenue — Last 7 Days</h3>
                  <div className="flex items-end gap-2 h-32">
                    {(stats.daily_revenue_7d||[]).map((d:any,i:number)=>{
                      const maxRev = Math.max(...(stats.daily_revenue_7d||[]).map((x:any)=>parseFloat(x.revenue)),1);
                      const pct = (parseFloat(d.revenue)/maxRev*100);
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center">
                          <p className="text-xs text-gray-400 mb-1">{fmtCad(d.revenue)}</p>
                          <div className="w-full bg-rose-500 rounded-t" style={{height:`${pct}%`,minHeight:'4px'}} />
                          <p className="text-xs text-gray-400 mt-1">{new Date(d.day).toLocaleDateString('en-CA',{month:'short',day:'numeric'})}</p>
                        </div>
                      );
                    })}
                    {!stats.daily_revenue_7d?.length && <p className="text-gray-400 text-sm">No data yet.</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-lg border p-4">
                    <h3 className="font-semibold text-slate-700 mb-3">Top Products by Revenue</h3>
                    <div className="space-y-2">
                      {(stats.top_products||[]).map((p:any,i:number)=>(
                        <div key={i} className="flex justify-between items-center text-sm">
                          <span className="truncate mr-2">{i+1}. {p.name}</span>
                          <span className="font-semibold flex-shrink-0">{fmtCad(p.revenue)}</span>
                        </div>
                      ))}
                      {!stats.top_products?.length && <p className="text-gray-400 text-sm">No data yet.</p>}
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border p-4">
                    <h3 className="font-semibold text-slate-700 mb-3">Category Mix</h3>
                    <div className="space-y-2">
                      {(stats.category_breakdown||[]).map((c:any,i:number)=>(
                        <div key={i} className="flex justify-between items-center text-sm">
                          <span>{c.category}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400 text-xs">{c.units} units</span>
                            <span className="font-semibold">{fmtCad(c.revenue)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border p-4">
                    <h3 className="font-semibold text-slate-700 mb-3">Loyalty Tier Distribution</h3>
                    <div className="space-y-2">
                      {(stats.loyalty_tier_distribution||[]).map((t:any)=>(
                        <div key={t.loyalty_tier} className="flex justify-between items-center text-sm">
                          <Badge label={t.loyalty_tier} color={tierColor(t.loyalty_tier)} />
                          <span className="font-semibold">{t.count} customers</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border p-4">
                    <h3 className="font-semibold text-slate-700 mb-3">Payment Methods</h3>
                    <div className="space-y-2">
                      {(stats.payment_method_breakdown||[]).map((p:any)=>(
                        <div key={p.payment_method} className="flex justify-between items-center text-sm">
                          <Badge label={p.payment_method} color="blue" />
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400 text-xs">{p.count}x</span>
                            <span className="font-semibold">{fmtCad(p.amount)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            ) : <div className="h-32 bg-gray-100 rounded animate-pulse" />}
          </div>
        )}
      </div>

      {showAddProduct && <AddProductModal onClose={()=>setShowAddProduct(false)} onSaved={()=>{setShowAddProduct(false);load();}} />}
      {showAddCustomer && <AddCustomerModal onClose={()=>setShowAddCustomer(false)} onSaved={()=>{setShowAddCustomer(false);load();}} />}
      {adjustProduct && <AdjustStockModal product={adjustProduct} onClose={()=>setAdjustProduct(null)} onSaved={()=>{setAdjustProduct(null);load();}} />}
    </div>
  );
}
