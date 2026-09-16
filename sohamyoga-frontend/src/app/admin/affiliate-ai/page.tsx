'use client';

import { useState, useEffect, useCallback } from 'react';

type Tab = 'AI Partner Matching' | 'Creative Generator' | 'Offer Optimizer' | 'Multi-Touch Attribution' | 'Tax & Payments';
const TABS: Tab[] = ['AI Partner Matching', 'Creative Generator', 'Offer Optimizer', 'Multi-Touch Attribution', 'Tax & Payments'];

interface Partner { id: number; name: string; niche: string; audience_size: number; conversion_rate: number; ai_match_score: number; recommended_commission: number; status: string; }
interface Creative { id: number; partner_id: number; format: string; headline: string; body: string; cta: string; ctr_prediction: number; status: string; }
interface Offer { id: number; name: string; commission_type: string; commission_value: number; cookie_days: number; ai_optimized: boolean; predicted_roi: number; status: string; }
interface Attribution { id: number; conversion_id: string; first_touch_partner: string; last_touch_partner: string; revenue: number; }
interface Payment { id: number; partner_name: string; amount: number; currency: string; status: string; payment_method: string; due_date: string; }

const STATUS_COLOR: Record<string, string> = { active: 'bg-green-100 text-green-700', candidate: 'bg-yellow-100 text-yellow-700', pending: 'bg-yellow-100 text-yellow-700', paid: 'bg-green-100 text-green-700', processing: 'bg-blue-100 text-blue-700', on_hold: 'bg-red-100 text-red-700' };

export default function AffiliateAIPage() {
  const [tab, setTab] = useState<Tab>('AI Partner Matching');
  const [partners, setPartners] = useState<Partner[]>([]);
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [attribution, setAttribution] = useState<Attribution[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentStats, setPaymentStats] = useState<{ total: string; pending_total: string; paid_total: string }>({ total: '0', pending_total: '0', paid_total: '0' });
  const [stats, setStats] = useState<{ total: string; avg_score: string; total_audience: string }>({ total: '0', avg_score: '0', total_audience: '0' });
  const [loading, setLoading] = useState(false);

  // Match form
  const [matchForm, setMatchForm] = useState({ campaign_brief: '', target_niche: 'yoga & wellness', budget: '$500-2000', goals: 'new member acquisition' });
  const [matchResults, setMatchResults] = useState<unknown[]>([]);

  // Creative gen form
  const [creativeForm, setCreativeForm] = useState({ product: 'Yoga membership', partner_niche: 'wellness', format: 'banner', unique_selling_point: 'First week free' });
  const [generatedCreative, setGeneratedCreative] = useState<Record<string, unknown> | null>(null);

  // Offer optimize
  const [optimizeResult, setOptimizeResult] = useState<Record<string, unknown> | null>(null);
  const [selectedOfferId, setSelectedOfferId] = useState<number | null>(null);

  // Attribution report
  const [attrReport, setAttrReport] = useState<Record<string, unknown> | null>(null);

  // Payout calc
  const [payoutCalc, setPayoutCalc] = useState<Record<string, unknown> | null>(null);

  const loadData = useCallback(async () => {
    const res = await fetch('/api/admin/affiliate-ai');
    if (res.ok) { const d = await res.json() as { partners: Partner[]; stats: typeof stats }; setPartners(d.partners || []); setStats(d.stats); }
    const [cRes, oRes, aRes, pRes] = await Promise.all([
      fetch('/api/admin/affiliate-ai/creatives'),
      fetch('/api/admin/affiliate-ai/offers'),
      fetch('/api/admin/affiliate-ai/attribution'),
      fetch('/api/admin/affiliate-ai/payments'),
    ]);
    if (cRes.ok) setCreatives(await cRes.json() as Creative[]);
    if (oRes.ok) setOffers(await oRes.json() as Offer[]);
    if (aRes.ok) setAttribution(await aRes.json() as Attribution[]);
    if (pRes.ok) { const d = await pRes.json() as { payments: Payment[]; stats: typeof paymentStats }; setPayments(d.payments || []); setPaymentStats(d.stats); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const runMatch = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/affiliate-ai/match', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(matchForm) });
      const d = await res.json() as { partners: unknown[] };
      setMatchResults(d.partners || []);
    } finally { setLoading(false); }
  };

  const generateCreative = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/affiliate-ai/creatives/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(creativeForm) });
      setGeneratedCreative(await res.json() as Record<string, unknown>);
    } finally { setLoading(false); }
  };

  const optimizeOffer = async (id: number) => {
    setSelectedOfferId(id); setLoading(true);
    try {
      const res = await fetch(`/api/admin/affiliate-ai/offers/${id}/optimize`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      setOptimizeResult(await res.json() as Record<string, unknown>);
      await loadData();
    } finally { setLoading(false); }
  };

  const loadAttrReport = async () => {
    const res = await fetch('/api/admin/affiliate-ai/attribution/report');
    if (res.ok) setAttrReport(await res.json() as Record<string, unknown>);
  };

  const calculatePayout = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/affiliate-ai/payments/calculate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      setPayoutCalc(await res.json() as Record<string, unknown>);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-slate-800 text-white px-6 py-4">
        <h1 className="text-xl font-bold">Affiliate AI</h1>
        <p className="text-slate-300 text-sm">AI partner matching, creative generation, offer optimization, multi-touch attribution & payments</p>
      </div>

      <div className="bg-white border-b px-6 py-3 flex gap-8">
        <div><span className="text-2xl font-bold text-slate-800">{stats.total}</span><span className="text-gray-500 text-sm ml-1">Partners</span></div>
        <div><span className="text-2xl font-bold text-slate-800">{Number(stats.avg_score).toFixed(0)}</span><span className="text-gray-500 text-sm ml-1">Avg Match Score</span></div>
        <div><span className="text-2xl font-bold text-slate-800">${Number(paymentStats.pending_total).toFixed(0)}</span><span className="text-gray-500 text-sm ml-1">Pending Payouts</span></div>
        <div><span className="text-2xl font-bold text-slate-800">{Number(stats.total_audience).toLocaleString()}</span><span className="text-gray-500 text-sm ml-1">Total Audience</span></div>
      </div>

      <div className="bg-white border-b px-6 flex gap-1">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="p-6">
        {/* AI Partner Matching */}
        {tab === 'AI Partner Matching' && (
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-1 bg-white rounded-lg border p-5">
              <h2 className="font-semibold text-slate-800 mb-4">AI Partner Finder</h2>
              <div className="space-y-3">
                <div><label className="text-xs font-medium text-gray-600">Campaign Brief</label>
                  <textarea value={matchForm.campaign_brief} onChange={e => setMatchForm(p => ({ ...p, campaign_brief: e.target.value }))}
                    placeholder="Describe your campaign goals..." rows={3} className="w-full mt-1 border rounded px-3 py-2 text-sm" /></div>
                {(['target_niche','budget','goals'] as const).map(k => (
                  <div key={k}><label className="text-xs font-medium text-gray-600 capitalize">{k.replace('_', ' ')}</label>
                    <input value={matchForm[k]} onChange={e => setMatchForm(p => ({ ...p, [k]: e.target.value }))} className="w-full mt-1 border rounded px-3 py-2 text-sm" /></div>
                ))}
                <button onClick={runMatch} disabled={loading}
                  className="w-full bg-blue-600 text-white py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {loading ? 'Matching...' : '🤖 Find Best Partners'}
                </button>
              </div>
            </div>
            <div className="col-span-2 space-y-3">
              {matchResults.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-medium text-slate-700">AI-Matched Partners</h3>
                  {(matchResults as Record<string, unknown>[]).map((p, i) => (
                    <div key={i} className="bg-blue-50 border border-blue-200 rounded p-4">
                      <div className="flex justify-between items-start">
                        <div><p className="font-medium">{String(p.name)} <span className="text-xs text-gray-400">· {String(p.type)}</span></p>
                          <p className="text-xs text-gray-600">{String(p.niche)} · ~{Number(p.estimated_audience).toLocaleString()} audience</p>
                          <p className="text-xs text-gray-700 mt-1">{String(p.why_good_fit)}</p></div>
                        <span className="text-xl font-bold text-blue-700">{String(p.match_score)}</span>
                      </div>
                      <div className="mt-2 flex gap-3 text-xs">
                        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded">Commission: {String(p.recommended_commission)}</span>
                      </div>
                      <p className="text-xs text-blue-700 mt-2 italic">Strategy: {String(p.outreach_strategy)}</p>
                    </div>
                  ))}
                </div>
              )}
              <h3 className="font-medium text-slate-700">Current Partner Database</h3>
              {partners.map(p => (
                <div key={p.id} className="bg-white border rounded p-4 flex justify-between items-center">
                  <div><p className="font-medium text-sm">{p.name}</p>
                    <p className="text-xs text-gray-500">{p.niche} · {Number(p.audience_size).toLocaleString()} audience · {p.conversion_rate}% CR</p>
                    <p className="text-xs text-gray-500">Recommended commission: {p.recommended_commission}%</p></div>
                  <div className="flex items-center gap-3">
                    <div className="text-center"><div className="text-xl font-bold text-blue-700">{p.ai_match_score}</div><div className="text-xs text-gray-500">Score</div></div>
                    <span className={`text-xs px-2 py-1 rounded ${STATUS_COLOR[p.status] || 'bg-gray-100'}`}>{p.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Creative Generator */}
        {tab === 'Creative Generator' && (
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-1 bg-white rounded-lg border p-5">
              <h2 className="font-semibold text-slate-800 mb-4">AI Creative Generator</h2>
              <div className="space-y-3">
                {(['product','partner_niche','unique_selling_point'] as const).map(k => (
                  <div key={k}><label className="text-xs font-medium text-gray-600 capitalize">{k.replace('_', ' ')}</label>
                    <input value={creativeForm[k]} onChange={e => setCreativeForm(p => ({ ...p, [k]: e.target.value }))} className="w-full mt-1 border rounded px-3 py-2 text-sm" /></div>
                ))}
                <div><label className="text-xs font-medium text-gray-600">Format</label>
                  <select value={creativeForm.format} onChange={e => setCreativeForm(p => ({ ...p, format: e.target.value }))} className="w-full mt-1 border rounded px-3 py-2 text-sm">
                    {['banner','email','social_post','video_ad','newsletter'].map(f => <option key={f}>{f}</option>)}</select></div>
                <button onClick={generateCreative} disabled={loading}
                  className="w-full bg-purple-600 text-white py-2 rounded text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
                  {loading ? 'Generating...' : '✨ Generate Creative'}
                </button>
              </div>
              {generatedCreative && (
                <div className="mt-4 space-y-2">
                  <div className="bg-purple-50 rounded p-3"><p className="text-xs font-bold text-purple-800">Headline</p><p className="text-sm mt-1">{String(generatedCreative.headline)}</p></div>
                  <div className="bg-gray-50 rounded p-3"><p className="text-xs font-bold text-gray-700">Body</p><p className="text-xs mt-1">{String(generatedCreative.body)}</p></div>
                  <div className="bg-green-50 rounded p-2"><p className="text-xs font-bold text-green-800">CTA: {String(generatedCreative.cta)}</p></div>
                  <div className="bg-blue-50 rounded p-2"><p className="text-xs text-blue-700">Predicted CTR: <strong>{String(generatedCreative.ctr_prediction)}%</strong></p></div>
                </div>
              )}
            </div>
            <div className="col-span-2 bg-white rounded-lg border p-5">
              <h2 className="font-semibold text-slate-800 mb-4">Creative Library ({creatives.length})</h2>
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {creatives.map(c => (
                  <div key={c.id} className="border rounded p-3">
                    <div className="flex justify-between"><div>
                      <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{c.format}</span>
                      {c.ctr_prediction > 0 && <span className="text-xs text-green-700 font-medium ml-2">CTR: {c.ctr_prediction}%</span>}
                    </div></div>
                    <p className="font-medium text-sm mt-1">{c.headline}</p>
                    <p className="text-xs text-gray-600 mt-1">{c.body}</p>
                    <p className="text-xs text-blue-700 mt-1">CTA: {c.cta}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Offer Optimizer */}
        {tab === 'Offer Optimizer' && (
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border p-5">
              <h2 className="font-semibold text-slate-800 mb-4">Affiliate Offers</h2>
              <div className="space-y-3">
                {offers.map(o => (
                  <div key={o.id} className="border rounded p-4">
                    <div className="flex justify-between items-start">
                      <div><p className="font-medium text-sm">{o.name}</p>
                        <p className="text-xs text-gray-500">{o.commission_value}{o.commission_type === 'percentage' ? '%' : ' flat'} · {o.cookie_days}d cookie · ROI: {o.predicted_roi}%</p>
                        {o.ai_optimized && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded mt-1 inline-block">AI Optimized</span>}
                      </div>
                      <button onClick={() => optimizeOffer(o.id)} disabled={loading && selectedOfferId === o.id}
                        className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50">
                        {loading && selectedOfferId === o.id ? '...' : 'Optimize'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-lg border p-5">
              <h2 className="font-semibold text-slate-800 mb-4">Optimization Result</h2>
              {!optimizeResult && <p className="text-gray-400 text-sm text-center mt-8">Click Optimize on any offer to see AI recommendations</p>}
              {optimizeResult && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-green-50 rounded p-3"><p className="text-xs text-gray-500">New Commission</p><p className="text-xl font-bold text-green-700">{Number(optimizeResult.optimized_commission).toFixed(1)}%</p></div>
                    <div className="bg-blue-50 rounded p-3"><p className="text-xs text-gray-500">Cookie Days</p><p className="text-xl font-bold text-blue-700">{String(optimizeResult.optimized_cookie_days)}</p></div>
                    <div className="bg-purple-50 rounded p-3"><p className="text-xs text-gray-500">Predicted ROI</p><p className="text-xl font-bold text-purple-700">{Number(optimizeResult.optimized_roi).toFixed(0)}%</p></div>
                  </div>
                  <div className="bg-gray-50 rounded p-3"><p className="text-xs font-bold text-gray-700 mb-1">Rationale</p><p className="text-xs text-gray-600">{String(optimizeResult.rationale)}</p></div>
                  <div><p className="text-xs font-bold text-gray-700 mb-1">Recommendations</p>
                    {(optimizeResult.recommendations as string[])?.map((r: string) => <p key={r} className="text-xs text-gray-600">• {r}</p>)}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Multi-Touch Attribution */}
        {tab === 'Multi-Touch Attribution' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-slate-800">Attribution Report</h2>
              <button onClick={loadAttrReport} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">Load Report</button>
            </div>
            {attrReport && (
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-lg border p-4 text-center"><p className="text-xs text-gray-500">Total Revenue</p><p className="text-2xl font-bold text-slate-800">${Number(attrReport.total_revenue).toFixed(0)}</p></div>
                <div className="bg-white rounded-lg border p-4 text-center"><p className="text-xs text-gray-500">Conversions</p><p className="text-2xl font-bold text-slate-800">{String(attrReport.total_conversions)}</p></div>
                <div className="bg-white rounded-lg border p-4 text-center"><p className="text-xs text-gray-500">Avg Touchpoints</p><p className="text-2xl font-bold text-slate-800">{Number(attrReport.avg_touchpoints).toFixed(1)}</p></div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              {attrReport && (['first_touch_attribution','last_touch_attribution','linear_attribution','time_decay_attribution'] as const).map(model => (
                <div key={model} className="bg-white rounded-lg border p-4">
                  <h3 className="font-medium text-sm text-slate-700 mb-3 capitalize">{model.replace(/_/g, ' ')}</h3>
                  {Object.entries(attrReport[model] as Record<string, number>).map(([partner, value]) => (
                    <div key={partner} className="flex justify-between items-center py-1 border-b last:border-0">
                      <span className="text-xs text-gray-700">{partner}</span>
                      <span className="text-xs font-bold text-green-700">${Number(value).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="bg-white rounded-lg border p-5 mt-4">
              <h3 className="font-medium text-slate-800 mb-3">Conversion Records</h3>
              <div className="space-y-2">
                {attribution.map(a => (
                  <div key={a.id} className="border rounded p-3 flex justify-between items-center">
                    <div><p className="text-xs font-medium text-gray-700">{a.conversion_id}</p>
                      <p className="text-xs text-gray-500">First: {a.first_touch_partner} → Last: {a.last_touch_partner}</p></div>
                    <span className="text-sm font-bold text-green-700">${Number(a.revenue).toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tax & Payments */}
        {tab === 'Tax & Payments' && (
          <div>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-lg border p-4 text-center"><p className="text-xs text-gray-500">Pending Payouts</p><p className="text-2xl font-bold text-orange-600">${Number(paymentStats.pending_total).toFixed(2)}</p></div>
              <div className="bg-white rounded-lg border p-4 text-center"><p className="text-xs text-gray-500">Paid This Period</p><p className="text-2xl font-bold text-green-700">${Number(paymentStats.paid_total).toFixed(2)}</p></div>
              <div className="bg-white rounded-lg border p-4 text-center"><p className="text-xs text-gray-500">Total Partners</p><p className="text-2xl font-bold text-slate-800">{paymentStats.total}</p></div>
            </div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-slate-800">Payment Schedule</h2>
              <button onClick={calculatePayout} disabled={loading} className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 disabled:opacity-50">
                {loading ? '...' : 'Calculate Payouts'}
              </button>
            </div>
            {payoutCalc && (
              <div className="bg-green-50 border border-green-200 rounded p-4 mb-4">
                <p className="text-sm font-semibold text-green-800">Payout Calculation: ${Number(payoutCalc.total_payout).toFixed(2)} CAD total pending</p>
                <div className="flex gap-4 mt-2">{Object.entries(payoutCalc.by_method as Record<string, number>).map(([m, v]) => (
                  <span key={m} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">{m}: ${Number(v).toFixed(2)}</span>
                ))}</div>
              </div>
            )}
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50"><tr>{['Partner','Amount','Currency','Method','Status','Due Date'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>)}</tr></thead>
                <tbody>{payments.map(p => (
                  <tr key={p.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{p.partner_name}</td>
                    <td className="px-4 py-3">${Number(p.amount).toFixed(2)}</td>
                    <td className="px-4 py-3">{p.currency}</td>
                    <td className="px-4 py-3">{p.payment_method}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLOR[p.status] || 'bg-gray-100'}`}>{p.status}</span></td>
                    <td className="px-4 py-3 text-gray-500">{p.due_date || '-'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
