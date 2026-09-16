'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard', 'connections', 'products', 'orders', 'abandoned', 'webhooks'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = {
  dashboard: 'Dashboard', connections: 'Store Connections', products: 'Product Catalog',
  orders: 'Orders', abandoned: 'Abandoned Carts', webhooks: 'Webhooks',
};

function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const borders: Record<string, string> = {
    blue: 'border-l-4 border-blue-500 bg-blue-50', green: 'border-l-4 border-green-500 bg-green-50',
    amber: 'border-l-4 border-amber-500 bg-amber-50', purple: 'border-l-4 border-purple-500 bg-purple-50',
    red: 'border-l-4 border-red-500 bg-red-50', teal: 'border-l-4 border-teal-500 bg-teal-50',
  };
  return (
    <div className={`rounded-lg p-4 ${borders[color] || borders.blue}`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>{label}</span>;
}

function EmptyState({ message }: { message: string }) {
  return <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-500 text-sm">{message}</div>;
}

type Connection = {
  id: number; store_domain: string; shop_name: string; plan: string; status: string;
  products_synced: number; orders_synced: number; last_sync: string | null; created_at: string;
};
type Product = {
  id: number; shopify_id: string; title: string; handle: string; status: string;
  price: number; inventory: number; tags: string[] | null; ai_description: string | null; synced_at: string;
};
type Order = {
  id: number; shopify_id: string; order_number: string; customer_email: string;
  total_price: number; status: string; line_items: unknown; created_at: string;
};
type AbandonedCart = {
  id: number; store_domain: string; cart_token: string; customer_email: string; customer_name: string;
  total_price: number; items: unknown; recovery_email_sent: boolean; recovered: boolean; created_at: string;
};
type Webhook = {
  id: number; store_domain: string; topic: string; endpoint: string; status: string; last_triggered: string | null; created_at: string;
};

const STATUS_COLORS: Record<string, string> = {
  connected: 'bg-green-100 text-green-700', disconnected: 'bg-red-100 text-red-700', paused: 'bg-yellow-100 text-yellow-700',
  active: 'bg-green-100 text-green-700', inactive: 'bg-gray-100 text-gray-600',
  fulfilled: 'bg-green-100 text-green-700', pending: 'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-red-100 text-red-700', refunded: 'bg-purple-100 text-purple-700',
};

async function api<T>(url: string, opts?: RequestInit): Promise<T | null> {
  try {
    const r = await fetch(url, { cache: 'no-store', ...opts });
    if (!r.ok) return null;
    return r.json() as Promise<T>;
  } catch { return null; }
}

const DOMAIN = 'yoga-studio.myshopify.com';

function DashboardTab({ connections, stats }: { connections: Connection[]; stats: Record<string, string> | null }) {
  const conn = connections[0];
  const revenue30d = stats ? Number(stats.revenue_30d || 0) : 0;
  const pendingOrders = stats ? Number(stats.pending_orders || 0) : 0;
  const openCarts = stats ? Number(stats.open_carts || 0) : 0;
  const recoveredCarts = stats ? Number(stats.recovered_carts || 0) : 0;
  const recoveryRate = openCarts + recoveredCarts > 0 ? Math.round((recoveredCarts / (openCarts + recoveredCarts)) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Revenue (30 days)" value={`$${revenue30d.toFixed(2)}`} sub="Shopify orders" color="green" />
        <KpiCard label="Pending Orders" value={pendingOrders} sub="Awaiting fulfillment" color="amber" />
        <KpiCard label="Open Carts" value={openCarts} sub="Abandoned carts" color="red" />
        <KpiCard label="Recovery Rate" value={`${recoveryRate}%`} sub="Carts recovered" color="teal" />
      </div>
      {conn && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h3 className="font-semibold text-gray-800">Store Health — {conn.shop_name}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><p className="text-gray-500">Domain</p><p className="font-medium">{conn.store_domain}</p></div>
            <div><p className="text-gray-500">Plan</p><p className="font-medium capitalize">{conn.plan}</p></div>
            <div><p className="text-gray-500">Products Synced</p><p className="font-medium">{conn.products_synced}</p></div>
            <div><p className="text-gray-500">Orders Synced</p><p className="font-medium">{conn.orders_synced}</p></div>
          </div>
          <div className="text-xs text-gray-400">
            Last sync: {conn.last_sync ? new Date(conn.last_sync).toLocaleString() : 'Never'}
          </div>
        </div>
      )}
    </div>
  );
}

function ConnectionsTab({ connections, onRefresh }: { connections: Connection[]; onRefresh: () => void }) {
  const [adding, setAdding] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [form, setForm] = useState({ store_domain: '', access_token: '', shop_name: '', plan: 'basic' });
  const [msg, setMsg] = useState('');

  async function addStore() {
    const r = await api<{ connection: Connection }>('/api/admin/shopify-integration', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    if (r) { setAdding(false); setMsg('Store connected.'); onRefresh(); }
    else setMsg('Failed to connect store.');
  }

  async function syncStore(domain: string) {
    setSyncing(domain);
    const r = await api<{ ok: boolean; products_synced: number; orders_synced: number }>(
      `/api/admin/shopify-integration/${encodeURIComponent(domain)}/sync`, { method: 'POST' }
    );
    setSyncing(null);
    if (r) { setMsg(`Sync complete: ${r.products_synced} products, ${r.orders_synced} orders.`); onRefresh(); }
    else setMsg('Sync failed.');
  }

  return (
    <div className="space-y-4">
      {msg && <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">{msg}</div>}
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-gray-800">Connected Stores</h3>
        <button onClick={() => setAdding(!adding)} className="bg-green-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-green-700">
          + Add Store
        </button>
      </div>
      {adding && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
          <h4 className="font-medium text-gray-700">New Shopify Connection</h4>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500 block mb-1">Store Domain</label>
              <input className="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder="yourstore.myshopify.com"
                value={form.store_domain} onChange={e => setForm(f => ({ ...f, store_domain: e.target.value }))} /></div>
            <div><label className="text-xs text-gray-500 block mb-1">Access Token</label>
              <input className="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder="shpat_..."
                value={form.access_token} onChange={e => setForm(f => ({ ...f, access_token: e.target.value }))} /></div>
            <div><label className="text-xs text-gray-500 block mb-1">Shop Name</label>
              <input className="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder="My Yoga Store"
                value={form.shop_name} onChange={e => setForm(f => ({ ...f, shop_name: e.target.value }))} /></div>
            <div><label className="text-xs text-gray-500 block mb-1">Plan</label>
              <select className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}>
                <option value="basic">Basic</option><option value="standard">Standard</option><option value="advanced">Advanced</option>
              </select></div>
          </div>
          <div className="flex gap-2">
            <button onClick={addStore} className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700">Connect Store</button>
            <button onClick={() => setAdding(false)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded text-sm hover:bg-gray-200">Cancel</button>
          </div>
        </div>
      )}
      <div className="space-y-3">
        {connections.length === 0 ? <EmptyState message="No stores connected." /> : connections.map(c => (
          <div key={c.id} className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-gray-800">{c.shop_name}</p>
                <Badge label={c.status} colorClass={STATUS_COLORS[c.status] || 'bg-gray-100 text-gray-600'} />
                <Badge label={c.plan} colorClass="bg-blue-100 text-blue-700" />
              </div>
              <p className="text-sm text-gray-500 mt-1">{c.store_domain}</p>
              <p className="text-xs text-gray-400 mt-1">
                {c.products_synced} products · {c.orders_synced} orders · Last sync: {c.last_sync ? new Date(c.last_sync).toLocaleString() : 'Never'}
              </p>
            </div>
            <button
              onClick={() => syncStore(c.store_domain)}
              disabled={syncing === c.store_domain}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {syncing === c.store_domain ? 'Syncing…' : 'Sync Now'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductsTab() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [aiLoading, setAiLoading] = useState<number | null>(null);
  const [aiMsg, setAiMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const r = await api<{ products: Product[]; pages: number }>(
      `/api/admin/shopify-integration/${encodeURIComponent(DOMAIN)}/products?q=${encodeURIComponent(search)}&page=${page}`
    );
    setProducts(r?.products || []);
    setTotalPages(r?.pages || 1);
    setLoading(false);
  }, [search, page]);

  useEffect(() => { load(); }, [load]);

  async function aiDescribe(productId: number) {
    setAiLoading(productId);
    const r = await api<{ ok: boolean; description: string; tags: string[] }>(
      `/api/admin/shopify-integration/${encodeURIComponent(DOMAIN)}/products/${productId}/ai-describe`,
      { method: 'POST' }
    );
    setAiLoading(null);
    if (r) { setAiMsg(`AI description generated for product #${productId}.`); load(); }
    else setAiMsg('AI describe failed.');
  }

  async function bulkAiDescribe() {
    setAiMsg('Running bulk AI describe…');
    for (const p of products.filter(p => !p.ai_description)) {
      await aiDescribe(p.id);
    }
    setAiMsg('Bulk AI describe complete.');
  }

  return (
    <div className="space-y-4">
      {aiMsg && <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">{aiMsg}</div>}
      <div className="flex gap-3 items-center">
        <input className="border border-gray-300 rounded px-3 py-2 text-sm flex-1" placeholder="Search products…"
          value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        <button onClick={bulkAiDescribe} className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700">
          Bulk AI Describe
        </button>
      </div>
      {loading ? <EmptyState message="Loading…" /> : (
        <div className="space-y-2">
          {products.length === 0 ? <EmptyState message="No products found." /> : products.map(p => (
            <div key={p.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-800">{p.title}</p>
                    <Badge label={p.status} colorClass={STATUS_COLORS[p.status] || 'bg-gray-100 text-gray-600'} />
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    ${Number(p.price).toFixed(2)} · {p.inventory} in stock
                  </div>
                  {p.tags && p.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {p.tags.map((t, i) => <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{t}</span>)}
                    </div>
                  )}
                  {p.ai_description && (
                    <p className="text-xs text-gray-500 mt-2 italic line-clamp-2">{p.ai_description}</p>
                  )}
                </div>
                <button
                  onClick={() => aiDescribe(p.id)}
                  disabled={aiLoading === p.id}
                  className="ml-3 bg-purple-100 text-purple-700 px-3 py-1.5 rounded text-xs hover:bg-purple-200 disabled:opacity-50 whitespace-nowrap"
                >
                  {aiLoading === p.id ? 'Generating…' : 'AI Describe'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {totalPages > 1 && (
        <div className="flex gap-2 justify-center">
          {Array.from({ length: totalPages }, (_, i) => (
            <button key={i} onClick={() => setPage(i + 1)}
              className={`px-3 py-1 rounded text-sm ${page === i + 1 ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function OrdersTab() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    api<{ orders: Order[] }>(
      `/api/admin/shopify-integration/${encodeURIComponent(DOMAIN)}/orders?status=${statusFilter}`
    ).then(r => { setOrders(r?.orders || []); setLoading(false); });
  }, [statusFilter]);

  const statuses = ['', 'pending', 'fulfilled', 'cancelled', 'refunded'];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {statuses.map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded text-sm font-medium ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            {s || 'All'}
          </button>
        ))}
      </div>
      {loading ? <EmptyState message="Loading…" /> : (
        <div className="space-y-2">
          {orders.length === 0 ? <EmptyState message="No orders found." /> : orders.map(o => (
            <div key={o.id} className="bg-white border border-gray-200 rounded-lg">
              <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => setExpanded(expanded === o.id ? null : o.id)}>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-800">{o.order_number}</p>
                    <Badge label={o.status} colorClass={STATUS_COLORS[o.status] || 'bg-gray-100 text-gray-600'} />
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{o.customer_email}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-800">${Number(o.total_price).toFixed(2)}</p>
                  <p className="text-xs text-gray-400">{new Date(o.created_at).toLocaleDateString()}</p>
                </div>
              </div>
              {expanded === o.id && (
                <div className="px-4 pb-4 border-t border-gray-100">
                  <p className="text-xs text-gray-500 mt-2 font-medium">Line Items</p>
                  <pre className="text-xs text-gray-700 mt-1 bg-gray-50 rounded p-2 overflow-x-auto">
                    {JSON.stringify(o.line_items, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AbandonedTab() {
  const [carts, setCarts] = useState<AbandonedCart[]>([]);
  const [stats, setStats] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState<number | null>(null);
  const [emailModal, setEmailModal] = useState<{ subject: string; body: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await api<{ carts: AbandonedCart[]; stats: Record<string, string> }>(
      `/api/admin/shopify-integration/${encodeURIComponent(DOMAIN)}/abandoned`
    );
    setCarts(r?.carts || []);
    setStats(r?.stats || null);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function sendRecovery(id: number) {
    setRecovering(id);
    const r = await api<{ ok: boolean; subject: string; body: string }>(
      `/api/admin/shopify-integration/${encodeURIComponent(DOMAIN)}/abandoned/${id}/recover`,
      { method: 'POST' }
    );
    setRecovering(null);
    if (r) { setEmailModal({ subject: r.subject, body: r.body }); load(); }
  }

  const openCarts = stats ? Number(stats.open_carts || 0) : 0;
  const recoveredCarts = stats ? Number(stats.recovered_carts || 0) : 0;
  const recoveryRevenue = stats ? Number(stats.recovery_revenue || 0) : 0;
  const recoveryRate = openCarts + recoveredCarts > 0 ? Math.round((recoveredCarts / (openCarts + recoveredCarts)) * 100) : 0;

  return (
    <div className="space-y-4">
      {emailModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6 space-y-4">
            <h3 className="font-semibold text-gray-800">Recovery Email Preview</h3>
            <div><p className="text-sm font-medium text-gray-500">Subject</p><p className="text-sm text-gray-800">{emailModal.subject}</p></div>
            <div><p className="text-sm font-medium text-gray-500">Body</p><pre className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded p-3">{emailModal.body}</pre></div>
            <button onClick={() => setEmailModal(null)} className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">Close</button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-3 gap-4">
        <KpiCard label="Open Carts" value={openCarts} color="red" />
        <KpiCard label="Recovered Carts" value={recoveredCarts} color="green" />
        <KpiCard label="Recovery Revenue" value={`$${recoveryRevenue.toFixed(2)}`} sub={`${recoveryRate}% rate`} color="teal" />
      </div>
      {loading ? <EmptyState message="Loading…" /> : (
        <div className="space-y-3">
          {carts.length === 0 ? <EmptyState message="No abandoned carts." /> : carts.map(c => (
            <div key={c.id} className="bg-white border border-gray-200 rounded-lg p-4 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-800">{c.customer_name}</p>
                  {c.recovery_email_sent && <Badge label="Email Sent" colorClass="bg-blue-100 text-blue-700" />}
                  {c.recovered && <Badge label="Recovered" colorClass="bg-green-100 text-green-700" />}
                </div>
                <p className="text-sm text-gray-500">{c.customer_email}</p>
                <p className="text-sm font-semibold text-gray-700 mt-1">${Number(c.total_price).toFixed(2)}</p>
                <p className="text-xs text-gray-400 mt-1">{new Date(c.created_at).toLocaleString()}</p>
              </div>
              <button
                onClick={() => sendRecovery(c.id)}
                disabled={recovering === c.id || c.recovery_email_sent}
                className="bg-amber-500 text-white px-3 py-1.5 rounded text-sm hover:bg-amber-600 disabled:opacity-50"
              >
                {recovering === c.id ? 'Generating…' : c.recovery_email_sent ? 'Email Sent' : 'Send Recovery'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WebhooksTab() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ store_domain: DOMAIN, topic: 'orders/create', endpoint: '/api/webhooks/shopify/' });
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const r = await api<{ webhooks: Webhook[] }>(`/api/admin/shopify-integration/webhooks?domain=${encodeURIComponent(DOMAIN)}`);
    setWebhooks(r?.webhooks || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addWebhook() {
    const r = await api<{ webhook: Webhook }>('/api/admin/shopify-integration/webhooks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    if (r) { setAdding(false); setMsg('Webhook added.'); load(); }
    else setMsg('Failed to add webhook.');
  }

  async function toggleStatus(w: Webhook) {
    const newStatus = w.status === 'active' ? 'inactive' : 'active';
    await api('/api/admin/shopify-integration/webhooks', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: w.id, status: newStatus }),
    });
    load();
  }

  const topics = ['orders/create', 'orders/updated', 'products/create', 'products/update', 'carts/update', 'checkouts/create', 'customers/create'];

  return (
    <div className="space-y-4">
      {msg && <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">{msg}</div>}
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-gray-800">Webhook Configurations</h3>
        <button onClick={() => setAdding(!adding)} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">+ Add Webhook</button>
      </div>
      {adding && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500 block mb-1">Topic</label>
              <select className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                value={form.topic} onChange={e => setForm(f => ({ ...f, topic: e.target.value }))}>
                {topics.map(t => <option key={t} value={t}>{t}</option>)}
              </select></div>
            <div><label className="text-xs text-gray-500 block mb-1">Endpoint</label>
              <input className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                value={form.endpoint} onChange={e => setForm(f => ({ ...f, endpoint: e.target.value }))} /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={addWebhook} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">Add Webhook</button>
            <button onClick={() => setAdding(false)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded text-sm hover:bg-gray-200">Cancel</button>
          </div>
        </div>
      )}
      {loading ? <EmptyState message="Loading…" /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead><tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left p-3 font-medium text-gray-600">Topic</th>
              <th className="text-left p-3 font-medium text-gray-600">Endpoint</th>
              <th className="text-left p-3 font-medium text-gray-600">Status</th>
              <th className="text-left p-3 font-medium text-gray-600">Last Triggered</th>
              <th className="text-left p-3 font-medium text-gray-600">Action</th>
            </tr></thead>
            <tbody>
              {webhooks.map(w => (
                <tr key={w.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-3 font-mono text-xs">{w.topic}</td>
                  <td className="p-3 text-gray-600 text-xs">{w.endpoint}</td>
                  <td className="p-3"><Badge label={w.status} colorClass={STATUS_COLORS[w.status] || 'bg-gray-100 text-gray-600'} /></td>
                  <td className="p-3 text-gray-500">{w.last_triggered ? new Date(w.last_triggered).toLocaleString() : 'Never'}</td>
                  <td className="p-3">
                    <button onClick={() => toggleStatus(w)} className="text-xs text-blue-600 hover:underline">
                      {w.status === 'active' ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function ShopifyIntegrationPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [connections, setConnections] = useState<Connection[]>([]);
  const [stats, setStats] = useState<Record<string, string> | null>(null);

  const loadMain = useCallback(async () => {
    const r = await api<{ connections: Connection[]; stats: Record<string, string> }>('/api/admin/shopify-integration');
    setConnections(r?.connections || []);
    setStats(r?.stats || null);
  }, []);

  useEffect(() => { loadMain(); }, [loadMain]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shopify Integration</h1>
          <p className="text-sm text-gray-500 mt-1">Manage Shopify store connections, products, orders and abandoned cart recovery</p>
        </div>
        <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1 overflow-x-auto">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded text-sm font-medium whitespace-nowrap transition-colors ${tab === t ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          {tab === 'dashboard' && <DashboardTab connections={connections} stats={stats} />}
          {tab === 'connections' && <ConnectionsTab connections={connections} onRefresh={loadMain} />}
          {tab === 'products' && <ProductsTab />}
          {tab === 'orders' && <OrdersTab />}
          {tab === 'abandoned' && <AbandonedTab />}
          {tab === 'webhooks' && <WebhooksTab />}
        </div>
      </div>
    </div>
  );
}
