'use client';

import { useEffect, useState, useCallback } from 'react';

interface Provider {
  provider_id: string;
  name: string;
  provider_type: string;
  network: string;
  coverage_region: string;
  status: string;
  contact_email: string;
}

interface Product {
  product_id: string;
  name: string;
  product_type: string;
  provider_id: string;
  monthly_premium: string;
  deductible: string;
  inpatient_coverage_pct: number;
  outpatient_coverage_pct: number;
  status: string;
}

interface Referral {
  id: number;
  referral_id: string;
  client_name_masked: string;
  product_id: string;
  provider_id: string;
  referred_by: string;
  status: string;
  commission_usd: string;
  created_at: string;
}

interface Claim {
  id: number;
  claim_id: string;
  client_masked: string;
  product_id: string;
  claim_type: string;
  amount_usd: string;
  status: string;
  submitted_at: string;
}

interface Analytics {
  conversion_rate: string;
  top_products: { name: string; type: string; premium: string }[];
  monthly_commission: number;
}

interface PageData {
  providers: Provider[];
  products: Product[];
  referrals: Referral[];
  claims: Claim[];
  analytics: Analytics;
}

const TABS = ['Providers', 'Products', 'Referrals', 'Claims', 'Analytics', 'Settings'] as const;
type Tab = typeof TABS[number];

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-600',
  converted: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  contacted: 'bg-blue-100 text-blue-700',
  declined: 'bg-red-100 text-red-700',
  submitted: 'bg-yellow-100 text-yellow-700',
  under_review: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

export default function HealthcareBrokerPage() {
  const [tab, setTab] = useState<Tab>('Providers');
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/healthcare-broker');
      if (!r.ok) throw new Error(await r.text());
      setData(await r.json());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateClaim = async (claim_id: string, status: string) => {
    await fetch('/api/admin/healthcare-broker', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'claim', claim_id, status }),
    });
    setMsg(`Claim ${claim_id} updated`);
    load();
  };

  const updateReferral = async (referral_id: string, status: string) => {
    await fetch('/api/admin/healthcare-broker', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'referral', referral_id, status }),
    });
    setMsg(`Referral ${referral_id} updated`);
    load();
  };

  if (loading) return <div className="p-8 text-gray-500">Loading healthcare data...</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!data) return null;

  const { providers, products, referrals, claims, analytics } = data;
  const activeProviders = providers.filter(p => p.status === 'active').length;
  const activeReferrals = referrals.filter(r => r.status === 'pending' || r.status === 'contacted').length;
  const totalCommission = referrals.reduce((s, r) => s + Number(r.commission_usd), 0);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Healthcare Product Broker</h1>
        <p className="text-gray-500 text-sm mt-1">Manage providers, products, referrals and claims</p>
      </div>

      {msg && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded text-sm">
          {msg}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Partner Providers', value: activeProviders, color: 'bg-blue-50 border-blue-200' },
          { label: 'Products Listed', value: products.length, color: 'bg-purple-50 border-purple-200' },
          { label: 'Active Referrals', value: activeReferrals, color: 'bg-yellow-50 border-yellow-200' },
          { label: 'Commission Earned', value: `$${totalCommission.toFixed(0)}`, color: 'bg-green-50 border-green-200' },
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

      {/* Providers */}
      {tab === 'Providers' && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                {['Provider ID', 'Name', 'Type', 'Network', 'Region', 'Status', 'Contact'].map(h => (
                  <th key={h} className="px-4 py-3 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {providers.map(p => (
                <tr key={p.provider_id} className="bg-white hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.provider_id}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                  <td className="px-4 py-3 text-gray-600">{p.provider_type}</td>
                  <td className="px-4 py-3 text-gray-600">{p.network}</td>
                  <td className="px-4 py-3 text-gray-600">{p.coverage_region}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_BADGE[p.status] || 'bg-gray-100'}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-blue-600 text-xs">{p.contact_email}</td>
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
                {['Product', 'Type', 'Provider', 'Monthly Premium', 'Deductible', 'Inpatient', 'Outpatient', 'Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map(p => (
                <tr key={p.product_id} className="bg-white hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                  <td className="px-4 py-3 text-gray-600">{p.product_type}</td>
                  <td className="px-4 py-3 text-gray-600">{p.provider_id}</td>
                  <td className="px-4 py-3">${Number(p.monthly_premium).toFixed(2)}/mo</td>
                  <td className="px-4 py-3">${Number(p.deductible).toFixed(2)}</td>
                  <td className="px-4 py-3">{p.inpatient_coverage_pct}%</td>
                  <td className="px-4 py-3">{p.outpatient_coverage_pct}%</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_BADGE[p.status] || 'bg-gray-100'}`}>
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Referrals */}
      {tab === 'Referrals' && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                {['Referral ID', 'Client (masked)', 'Product', 'Provider', 'Referred By', 'Status', 'Commission', 'Date', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {referrals.map(r => (
                <tr key={r.referral_id} className="bg-white hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{r.referral_id}</td>
                  <td className="px-4 py-3 font-medium">{r.client_name_masked}</td>
                  <td className="px-4 py-3 text-gray-600">{r.product_id}</td>
                  <td className="px-4 py-3 text-gray-600">{r.provider_id}</td>
                  <td className="px-4 py-3 text-gray-600">{r.referred_by}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_BADGE[r.status] || 'bg-gray-100'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">${Number(r.commission_usd).toFixed(2)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    {r.status === 'pending' && (
                      <button onClick={() => updateReferral(r.referral_id, 'contacted')}
                        className="text-xs text-blue-600 hover:text-blue-800">Contact</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Claims */}
      {tab === 'Claims' && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                {['Claim ID', 'Client', 'Product', 'Type', 'Amount', 'Status', 'Submitted', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {claims.map(c => (
                <tr key={c.claim_id} className="bg-white hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.claim_id}</td>
                  <td className="px-4 py-3 font-medium">{c.client_masked}</td>
                  <td className="px-4 py-3 text-gray-600">{c.product_id}</td>
                  <td className="px-4 py-3 text-gray-600">{c.claim_type}</td>
                  <td className="px-4 py-3">${Number(c.amount_usd).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_BADGE[c.status] || 'bg-gray-100'}`}>
                      {c.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(c.submitted_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    {c.status === 'under_review' && (
                      <>
                        <button onClick={() => updateClaim(c.claim_id, 'approved')}
                          className="text-xs text-green-600 hover:text-green-800 mr-2">Approve</button>
                        <button onClick={() => updateClaim(c.claim_id, 'rejected')}
                          className="text-xs text-red-600 hover:text-red-800">Reject</button>
                      </>
                    )}
                    {c.status === 'submitted' && (
                      <button onClick={() => updateClaim(c.claim_id, 'under_review')}
                        className="text-xs text-blue-600 hover:text-blue-800">Review</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Analytics */}
      {tab === 'Analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <div className="text-sm text-gray-600 mb-1">Overall Conversion Rate</div>
              <div className="text-4xl font-bold text-green-600">{analytics.conversion_rate}%</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <div className="text-sm text-gray-600 mb-1">Total Commission Earned</div>
              <div className="text-4xl font-bold text-blue-600">${analytics.monthly_commission.toFixed(2)}</div>
            </div>
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-800 mb-3">Top Products by Referral Volume</h2>
            <div className="space-y-3">
              {analytics.top_products.map((p, i) => (
                <div key={p.name} className="flex items-center gap-4">
                  <div className="w-4 text-gray-400 text-xs">{i + 1}</div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-800">{p.name}</div>
                    <div className="text-xs text-gray-500">{p.type} — ${Number(p.premium).toFixed(2)}/mo</div>
                  </div>
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${Math.max(20, 100 - i * 18)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Settings */}
      {tab === 'Settings' && (
        <div className="max-w-lg space-y-4">
          {[
            { label: 'Commission Rate — Health Insurance (%)', value: '15' },
            { label: 'Commission Rate — Dental (%)', value: '10' },
            { label: 'Commission Rate — Life Insurance (%)', value: '20' },
            { label: 'Referral Tracking Window (days)', value: '90' },
            { label: 'HIPAA Compliance Mode', type: 'toggle', value: true },
          ].map(s => (
            <div key={s.label} className="flex items-center justify-between py-3 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-700">{s.label}</span>
              {s.type === 'toggle' ? (
                <div className={`w-11 h-6 rounded-full ${s.value ? 'bg-blue-500' : 'bg-gray-300'} relative cursor-pointer`}>
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow ${s.value ? 'left-5' : 'left-0.5'}`} />
                </div>
              ) : (
                <input type="text" defaultValue={s.value as string}
                  className="text-sm border border-gray-300 rounded px-3 py-1 w-32" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
