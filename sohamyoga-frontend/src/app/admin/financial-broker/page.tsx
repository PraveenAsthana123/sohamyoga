'use client';

import { useEffect, useState, useCallback } from 'react';

interface Client {
  client_id: string;
  name: string;
  risk_profile: string;
  account_type: string;
  aum_usd: string;
  kyc_status: string;
  portfolio_count: number;
  last_activity: string;
}

interface Product {
  product_id: string;
  name: string;
  product_type: string;
  risk_level: string;
  min_investment: string;
  expected_return_pct: string;
  is_active: boolean;
}

interface Trade {
  id: number;
  trade_id: string;
  client_id: string;
  product_id: string;
  trade_type: string;
  amount_usd: string;
  status: string;
  executed_at: string | null;
  created_at: string;
}

interface KYC {
  client_id: string;
  docs_submitted: Record<string, boolean>;
  aml_status: string;
  compliance_officer: string | null;
  last_review: string | null;
}

interface Reports {
  total_aum: number;
  net_new_money_mtd: number;
  redemptions_mtd: number;
  fee_revenue_mtd: number;
}

interface PageData {
  clients: Client[];
  products: Product[];
  trades: Trade[];
  kyc: KYC[];
  reports: Reports;
}

const TABS = ['Clients', 'Products', 'Trades', 'KYC/Compliance', 'Reports', 'Settings'] as const;
type Tab = typeof TABS[number];

const RISK_COLOR: Record<string, string> = {
  Conservative: 'bg-green-100 text-green-700',
  Moderate: 'bg-yellow-100 text-yellow-700',
  Aggressive: 'bg-red-100 text-red-700',
};

const KYC_COLOR: Record<string, string> = {
  verified: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  review: 'bg-orange-100 text-orange-700',
  rejected: 'bg-red-100 text-red-700',
};

const TRADE_STATUS_COLOR: Record<string, string> = {
  executed: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-gray-100 text-gray-600',
  failed: 'bg-red-100 text-red-700',
};

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export default function FinancialBrokerPage() {
  const [tab, setTab] = useState<Tab>('Clients');
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/financial-broker');
      if (!r.ok) throw new Error(await r.text());
      setData(await r.json());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateTradeStatus = async (trade_id: string, status: string) => {
    await fetch('/api/admin/financial-broker', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'trade', trade_id, status }),
    });
    setMsg(`Trade ${trade_id} updated`);
    load();
  };

  if (loading) return <div className="p-8 text-gray-500">Loading financial data...</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!data) return null;

  const { clients, products, trades, kyc, reports } = data;
  const activeClients = clients.filter(c => c.kyc_status === 'verified').length;
  const pendingKyc = clients.filter(c => c.kyc_status === 'pending' || c.kyc_status === 'review').length;
  const openTrades = trades.filter(t => t.status === 'pending').length;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Financial Broker</h1>
        <p className="text-gray-500 text-sm mt-1">Client portfolios, products, trades and compliance</p>
      </div>

      {msg && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded text-sm">
          {msg}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Clients', value: activeClients, color: 'bg-blue-50 border-blue-200' },
          { label: 'AUM', value: fmt(reports.total_aum), color: 'bg-green-50 border-green-200' },
          { label: 'Pending KYC', value: pendingKyc, color: 'bg-yellow-50 border-yellow-200' },
          { label: 'Open Trades', value: openTrades, color: 'bg-orange-50 border-orange-200' },
        ].map(s => (
          <div key={s.label} className={`border rounded-lg p-4 ${s.color}`}>
            <div className="text-2xl font-bold text-gray-900">{s.value}</div>
            <div className="text-sm text-gray-600 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1 overflow-x-auto">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab === t ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {t}
            </button>
          ))}
        </nav>
      </div>

      {/* Clients */}
      {tab === 'Clients' && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                {['Client ID', 'Name', 'Risk Profile', 'Account Type', 'AUM', 'KYC', 'Portfolios', 'Last Activity'].map(h => (
                  <th key={h} className="px-4 py-3 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clients.map(c => (
                <tr key={c.client_id} className="bg-white hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.client_id}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${RISK_COLOR[c.risk_profile] || 'bg-gray-100'}`}>
                      {c.risk_profile}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.account_type}</td>
                  <td className="px-4 py-3 font-medium">{fmt(Number(c.aum_usd))}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${KYC_COLOR[c.kyc_status] || 'bg-gray-100'}`}>
                      {c.kyc_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.portfolio_count}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(c.last_activity).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Products */}
      {tab === 'Products' && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                {['Product', 'Type', 'Risk Level', 'Min Investment', 'Expected Return', 'Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map(p => (
                <tr key={p.product_id} className="bg-white hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                  <td className="px-4 py-3 text-gray-600">{p.product_type}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${RISK_COLOR[p.risk_level + (p.risk_level === 'Low' ? '' : '')] || 'bg-gray-100'}`}>
                      {p.risk_level}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">${Number(p.min_investment).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className="text-green-600 font-medium">{p.expected_return_pct}%</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {p.is_active ? 'active' : 'paused'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Trades */}
      {tab === 'Trades' && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                {['Trade ID', 'Client', 'Product', 'Type', 'Amount', 'Status', 'Executed', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {trades.map(t => (
                <tr key={t.trade_id} className="bg-white hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{t.trade_id}</td>
                  <td className="px-4 py-3 text-gray-600">{t.client_id}</td>
                  <td className="px-4 py-3 text-gray-600">{t.product_id}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${t.trade_type === 'Buy' ? 'bg-green-100 text-green-700' : t.trade_type === 'Sell' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                      {t.trade_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium">${Number(t.amount_usd).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${TRADE_STATUS_COLOR[t.status] || 'bg-gray-100'}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {t.executed_at ? new Date(t.executed_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {t.status === 'pending' && (
                      <button onClick={() => updateTradeStatus(t.trade_id, 'executed')}
                        className="text-xs text-green-600 hover:text-green-800 mr-2">Execute</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* KYC/Compliance */}
      {tab === 'KYC/Compliance' && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                {['Client', 'ID', 'Address', 'Income', 'SIN/PAN', 'AML Status', 'Officer', 'Last Review'].map(h => (
                  <th key={h} className="px-4 py-3 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {kyc.map(k => {
                const docs = k.docs_submitted || {};
                return (
                  <tr key={k.client_id} className="bg-white hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{k.client_id}</td>
                    {['id', 'address', 'income', 'sin'].map(d => (
                      <td key={d} className="px-4 py-3">
                        <span className={(docs as Record<string, boolean>)[d] ? 'text-green-500' : 'text-gray-300'}>
                          {(docs as Record<string, boolean>)[d] ? '✓' : '✗'}
                        </span>
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${k.aml_status === 'cleared' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {k.aml_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{k.compliance_officer || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {k.last_review ? new Date(k.last_review).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Reports */}
      {tab === 'Reports' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total AUM', value: fmt(reports.total_aum), sub: 'All client assets', icon: '💰' },
            { label: 'Net New Money (MTD)', value: fmt(reports.net_new_money_mtd), sub: 'Buy trades executed', icon: '📈' },
            { label: 'Redemptions (MTD)', value: fmt(reports.redemptions_mtd), sub: 'Sell trades executed', icon: '📉' },
            { label: 'Fee Revenue (MTD)', value: fmt(reports.fee_revenue_mtd), sub: 'Management fee estimate', icon: '💳' },
          ].map(r => (
            <div key={r.label} className="bg-white border border-gray-200 rounded-lg p-5">
              <div className="text-2xl mb-2">{r.icon}</div>
              <div className="text-2xl font-bold text-gray-900">{r.value}</div>
              <div className="text-sm font-medium text-gray-700 mt-1">{r.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{r.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Settings */}
      {tab === 'Settings' && (
        <div className="max-w-lg space-y-4">
          {[
            { label: 'Management Fee (%)', value: '1.25' },
            { label: 'Performance Fee (%)', value: '15.0' },
            { label: 'Compliance Jurisdiction', value: 'Canada' },
            { label: 'KYC Re-verification (months)', value: '24' },
          ].map(s => (
            <div key={s.label} className="flex items-center justify-between py-3 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-700">{s.label}</span>
              <input type="text" defaultValue={s.value}
                className="text-sm border border-gray-300 rounded px-3 py-1 w-40" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
