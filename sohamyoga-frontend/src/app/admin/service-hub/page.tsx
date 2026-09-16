'use client';

import { useState, useEffect, useCallback } from 'react';

type Tab = 'Dashboard' | 'Service Catalog' | 'Upsell & Cross-sell' | 'Demand Forecasting' | 'Staff Utilization' | 'Deposits & Payments';
const TABS: Tab[] = ['Dashboard', 'Service Catalog', 'Upsell & Cross-sell', 'Demand Forecasting', 'Staff Utilization', 'Deposits & Payments'];

interface ServicePackage { id: number; name: string; type: string; price: number; description: string; duration_minutes: number; max_participants: number; is_gift: boolean; status: string; sold_count: number; }
interface UpsellRule { id: number; trigger_service: string; upsell_offer: string; discount_pct: number; timing: string; accepted_count: number; shown_count: number; }
interface Forecast { id: number; service_name: string; period: string; actual_bookings: number; forecasted_bookings: number; confidence_pct: number; factors: string[]; }
interface Staff { id: number; staff_name: string; role: string; period: string; scheduled_hours: number; actual_hours: number; utilization_pct: number; services_delivered: number; }
interface Deposit { id: number; booking_reference: string; customer_name: string; service: string; total_amount: number; deposit_amount: number; status: string; due_date: string; }

const TYPE_COLOR: Record<string, string> = { class: 'bg-blue-100 text-blue-700', session: 'bg-purple-100 text-purple-700', bundle: 'bg-orange-100 text-orange-700', gift: 'bg-pink-100 text-pink-700', membership: 'bg-green-100 text-green-700', retreat: 'bg-teal-100 text-teal-700' };
const DEPOSIT_COLOR: Record<string, string> = { pending: 'bg-yellow-100 text-yellow-700', paid: 'bg-green-100 text-green-700', overdue: 'bg-red-100 text-red-700' };

export default function ServiceHubPage() {
  const [tab, setTab] = useState<Tab>('Dashboard');
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [upsellRules, setUpsellRules] = useState<UpsellRule[]>([]);
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [stats, setStats] = useState<{ total_revenue: string; total_sold: string; gift_revenue: string; mrr: string }>({ total_revenue: '0', total_sold: '0', gift_revenue: '0', mrr: '0' });
  const [depositStats, setDepositStats] = useState<{ total_deposits: string; pending_count: string }>({ total_deposits: '0', pending_count: '0' });
  const [loading, setLoading] = useState(false);

  // Upsell gen form
  const [upsellForm, setUpsellForm] = useState({ customer_name: '', service_history: 'Beginner Yoga Series x3', budget_range: '$100-500' });
  const [upsellResult, setUpsellResult] = useState<Record<string, unknown> | null>(null);

  // Forecast gen form
  const [forecastForm, setForecastForm] = useState({ service_name: 'Beginner Yoga Series', historical_avg: '22', season: 'fall', upcoming_promotions: 'October wellness campaign' });
  const [forecastResult, setForecastResult] = useState<Record<string, unknown> | null>(null);

  const loadData = useCallback(async () => {
    const [sRes, uRes, fRes, stRes, dRes] = await Promise.all([
      fetch('/api/admin/service-hub'),
      fetch('/api/admin/service-hub/upsell'),
      fetch('/api/admin/service-hub/forecast'),
      fetch('/api/admin/service-hub/staff'),
      fetch('/api/admin/service-hub/deposits'),
    ]);
    if (sRes.ok) { const d = await sRes.json() as { packages: ServicePackage[]; stats: typeof stats }; setPackages(d.packages || []); setStats(d.stats); }
    if (uRes.ok) setUpsellRules(await uRes.json() as UpsellRule[]);
    if (fRes.ok) setForecasts(await fRes.json() as Forecast[]);
    if (stRes.ok) setStaff(await stRes.json() as Staff[]);
    if (dRes.ok) { const d = await dRes.json() as { deposits: Deposit[]; stats: typeof depositStats }; setDeposits(d.deposits || []); setDepositStats(d.stats); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const generateUpsell = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/service-hub/upsell/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(upsellForm) });
      setUpsellResult(await res.json() as Record<string, unknown>);
    } finally { setLoading(false); }
  };

  const generateForecast = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/service-hub/forecast/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(forecastForm) });
      setForecastResult(await res.json() as Record<string, unknown>);
    } finally { setLoading(false); }
  };

  const markDepositPaid = async (id: number) => {
    await fetch(`/api/admin/service-hub/deposits/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'paid' }) });
    await loadData();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-slate-800 text-white px-6 py-4">
        <h1 className="text-xl font-bold">Service Hub</h1>
        <p className="text-slate-300 text-sm">Service catalog, upselling, demand forecasting, staff utilization & deposits</p>
      </div>

      <div className="bg-white border-b px-6 py-3 flex gap-8">
        <div><span className="text-2xl font-bold text-slate-800">${Number(stats.total_revenue).toLocaleString()}</span><span className="text-gray-500 text-sm ml-1">Total Revenue</span></div>
        <div><span className="text-2xl font-bold text-slate-800">{stats.total_sold}</span><span className="text-gray-500 text-sm ml-1">Units Sold</span></div>
        <div><span className="text-2xl font-bold text-pink-600">${Number(stats.gift_revenue).toLocaleString()}</span><span className="text-gray-500 text-sm ml-1">Gift Card Revenue</span></div>
        <div><span className="text-2xl font-bold text-green-700">${Number(depositStats.total_deposits).toLocaleString()}</span><span className="text-gray-500 text-sm ml-1">Deposits Collected</span></div>
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
        {/* Dashboard */}
        {tab === 'Dashboard' && (
          <div className="grid grid-cols-4 gap-4">
            {packages.slice(0, 4).map(p => (
              <div key={p.id} className="bg-white rounded-lg border p-4">
                <div className="flex justify-between mb-2"><span className={`text-xs px-2 py-0.5 rounded ${TYPE_COLOR[p.type] || 'bg-gray-100'}`}>{p.type}</span>{p.is_gift && <span className="text-xs bg-pink-100 text-pink-700 px-2 py-0.5 rounded">🎁 Gift</span>}</div>
                <p className="font-medium text-sm">{p.name}</p>
                <p className="text-2xl font-bold text-slate-800 mt-2">${Number(p.price).toFixed(0)}</p>
                <p className="text-xs text-gray-500">{p.sold_count} sold · ${(Number(p.price) * p.sold_count).toLocaleString()} revenue</p>
              </div>
            ))}
          </div>
        )}

        {/* Service Catalog */}
        {tab === 'Service Catalog' && (
          <div className="grid grid-cols-3 gap-4">
            {packages.map(p => (
              <div key={p.id} className="bg-white rounded-lg border p-5">
                <div className="flex justify-between mb-3">
                  <span className={`text-xs px-2 py-0.5 rounded ${TYPE_COLOR[p.type] || 'bg-gray-100'}`}>{p.type}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100'}`}>{p.status}</span>
                </div>
                <p className="font-semibold text-slate-800">{p.name}</p>
                <p className="text-xs text-gray-600 mt-1">{p.description}</p>
                <div className="flex justify-between items-end mt-4">
                  <div><p className="text-2xl font-bold text-blue-700">${Number(p.price).toFixed(0)}</p>
                    {p.duration_minutes > 0 && <p className="text-xs text-gray-400">{p.duration_minutes} min · max {p.max_participants}</p>}</div>
                  <div className="text-right"><p className="text-xl font-bold text-green-700">{p.sold_count}</p><p className="text-xs text-gray-400">sold</p></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Upsell & Cross-sell */}
        {tab === 'Upsell & Cross-sell' && (
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-1 bg-white rounded-lg border p-5">
              <h2 className="font-semibold text-slate-800 mb-4">AI Upsell Generator</h2>
              <div className="space-y-3">
                {(['customer_name','service_history','budget_range'] as const).map(k => (
                  <div key={k}><label className="text-xs font-medium text-gray-600 capitalize">{k.replace('_',' ')}</label>
                    <input value={upsellForm[k]} onChange={e => setUpsellForm(p => ({ ...p, [k]: e.target.value }))} className="w-full mt-1 border rounded px-3 py-2 text-sm" /></div>
                ))}
                <button onClick={generateUpsell} disabled={loading}
                  className="w-full bg-orange-600 text-white py-2 rounded text-sm font-medium hover:bg-orange-700 disabled:opacity-50">
                  {loading ? 'Generating...' : '✨ Generate Recommendations'}
                </button>
              </div>
              {upsellResult && (
                <div className="mt-4 space-y-2">
                  <div className="bg-orange-50 rounded p-3"><p className="text-xs font-bold text-orange-800">Upsell Offer</p>
                    <p className="text-sm mt-1">{String((upsellResult.upsell as Record<string,unknown>)?.offer)}</p>
                    {Number((upsellResult.upsell as Record<string,unknown>)?.discount) > 0 && <p className="text-xs text-green-700 mt-1">Discount: {String((upsellResult.upsell as Record<string,unknown>)?.discount)}%</p>}</div>
                  <div className="bg-blue-50 rounded p-2"><p className="text-xs font-bold text-blue-800">Message</p>
                    <p className="text-xs mt-1">{String(upsellResult.personalized_message)}</p></div>
                </div>
              )}
            </div>
            <div className="col-span-2 bg-white rounded-lg border p-5">
              <h2 className="font-semibold text-slate-800 mb-4">Active Upsell Rules</h2>
              {upsellRules.map(r => (
                <div key={r.id} className="border rounded p-4 mb-3">
                  <p className="text-sm font-medium">{r.trigger_service} → {r.upsell_offer}</p>
                  <div className="flex gap-3 mt-2 text-xs text-gray-500">
                    <span>{r.timing}</span>
                    {r.discount_pct > 0 && <span className="text-green-700">{r.discount_pct}% off</span>}
                    <span>Shown: {r.shown_count}</span>
                    <span className="text-blue-700">Accepted: {r.accepted_count} ({r.shown_count > 0 ? Math.round(r.accepted_count/r.shown_count*100) : 0}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Demand Forecasting */}
        {tab === 'Demand Forecasting' && (
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-1 bg-white rounded-lg border p-5">
              <h2 className="font-semibold text-slate-800 mb-4">AI Forecast Generator</h2>
              <div className="space-y-3">
                {(['service_name','historical_avg','season','upcoming_promotions'] as const).map(k => (
                  <div key={k}><label className="text-xs font-medium text-gray-600 capitalize">{k.replace(/_/g,' ')}</label>
                    <input value={forecastForm[k]} onChange={e => setForecastForm(p => ({ ...p, [k]: e.target.value }))} className="w-full mt-1 border rounded px-3 py-2 text-sm" /></div>
                ))}
                <button onClick={generateForecast} disabled={loading}
                  className="w-full bg-blue-600 text-white py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {loading ? 'Forecasting...' : '📊 Generate Forecast'}
                </button>
              </div>
              {forecastResult && (
                <div className="mt-4 bg-blue-50 rounded p-3">
                  <p className="text-xs font-bold text-blue-800">Insight</p>
                  <p className="text-xs mt-1">{String(forecastResult.key_insight)}</p>
                  <p className="text-xs text-purple-700 mt-2">👥 {String(forecastResult.staffing_recommendation)}</p>
                </div>
              )}
            </div>
            <div className="col-span-2 space-y-4">
              {forecastResult && (forecastResult.weeks as Record<string,unknown>[])?.length > 0 && (
                <div className="bg-white rounded-lg border p-5">
                  <h3 className="font-medium text-slate-800 mb-3">4-Week AI Forecast</h3>
                  {(forecastResult.weeks as Record<string,unknown>[]).map((w, i) => (
                    <div key={i} className="flex items-center gap-4 py-2 border-b last:border-0">
                      <span className="text-xs font-medium text-gray-600 w-16">{String(w.period)}</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-4 relative">
                        <div className="bg-blue-500 h-4 rounded-full" style={{ width: `${Math.min(Number(w.forecasted_bookings) * 3, 100)}%` }} />
                      </div>
                      <span className="text-sm font-bold w-8">{String(w.forecasted_bookings)}</span>
                      <span className="text-xs text-gray-400">{String(w.confidence_pct)}%</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="bg-white rounded-lg border p-5">
                <h2 className="font-semibold text-slate-800 mb-4">Historical Forecasts</h2>
                <div className="space-y-2">
                  {forecasts.map(f => (
                    <div key={f.id} className="border rounded p-3">
                      <div className="flex justify-between"><p className="font-medium text-sm">{f.service_name}</p><span className="text-xs text-gray-400">{f.period}</span></div>
                      <div className="flex gap-4 mt-1 text-xs">
                        <span>Actual: <strong>{f.actual_bookings}</strong></span>
                        <span>Forecast: <strong className="text-blue-700">{f.forecasted_bookings}</strong></span>
                        <span>Confidence: {f.confidence_pct}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Staff Utilization */}
        {tab === 'Staff Utilization' && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-white rounded-lg border p-4 text-center"><p className="text-xs text-gray-500">Team Avg Utilization</p><p className="text-3xl font-bold text-blue-700">{(staff.reduce((s, r) => s + Number(r.utilization_pct), 0) / Math.max(staff.length, 1)).toFixed(0)}%</p></div>
              <div className="bg-white rounded-lg border p-4 text-center"><p className="text-xs text-gray-500">Over Capacity (&gt;100%)</p><p className="text-3xl font-bold text-red-600">{staff.filter(s => Number(s.utilization_pct) > 100).length}</p></div>
              <div className="bg-white rounded-lg border p-4 text-center"><p className="text-xs text-gray-500">Under Utilized (&lt;75%)</p><p className="text-3xl font-bold text-yellow-600">{staff.filter(s => Number(s.utilization_pct) < 75).length}</p></div>
              <div className="bg-white rounded-lg border p-4 text-center"><p className="text-xs text-gray-500">Total Services</p><p className="text-3xl font-bold text-green-700">{staff.reduce((s, r) => s + r.services_delivered, 0)}</p></div>
            </div>
            <div className="bg-white rounded-lg border p-5">
              <div className="space-y-4">
                {staff.map(s => (
                  <div key={s.id}>
                    <div className="flex justify-between items-center mb-1">
                      <div><p className="font-medium text-sm">{s.staff_name}</p><p className="text-xs text-gray-500">{s.role} · {s.period}</p></div>
                      <div className="flex gap-4 text-sm">
                        <span>{s.actual_hours}h / {s.scheduled_hours}h</span>
                        <span className={`font-bold ${Number(s.utilization_pct) > 100 ? 'text-red-600' : Number(s.utilization_pct) > 85 ? 'text-green-700' : 'text-yellow-600'}`}>{Number(s.utilization_pct).toFixed(0)}%</span>
                        <span className="text-gray-500">{s.services_delivered} sessions</span>
                      </div>
                    </div>
                    <div className="bg-gray-200 rounded-full h-3">
                      <div className={`h-3 rounded-full ${Number(s.utilization_pct) > 100 ? 'bg-red-500' : Number(s.utilization_pct) > 85 ? 'bg-green-500' : 'bg-yellow-400'}`}
                        style={{ width: `${Math.min(Number(s.utilization_pct), 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Deposits & Payments */}
        {tab === 'Deposits & Payments' && (
          <div>
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div className="bg-white rounded-lg border p-4 text-center"><p className="text-xs text-gray-500">Deposits Collected</p><p className="text-2xl font-bold text-green-700">${Number(depositStats.total_deposits).toFixed(0)}</p></div>
              <div className="bg-white rounded-lg border p-4 text-center"><p className="text-xs text-gray-500">Pending</p><p className="text-2xl font-bold text-yellow-600">{depositStats.pending_count}</p></div>
              <div className="bg-white rounded-lg border p-4 text-center"><p className="text-xs text-gray-500">Overdue</p><p className="text-2xl font-bold text-red-600">{deposits.filter(d => d.status === 'overdue').length}</p></div>
            </div>
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50"><tr>{['Booking Ref','Customer','Service','Total','Deposit','Status','Due','Action'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>)}</tr></thead>
                <tbody>{deposits.map(d => (
                  <tr key={d.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{d.booking_reference}</td>
                    <td className="px-4 py-3 font-medium">{d.customer_name}</td>
                    <td className="px-4 py-3 text-gray-600">{d.service}</td>
                    <td className="px-4 py-3">${Number(d.total_amount).toFixed(0)}</td>
                    <td className="px-4 py-3 font-bold text-blue-700">${Number(d.deposit_amount).toFixed(0)}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded ${DEPOSIT_COLOR[d.status] || 'bg-gray-100'}`}>{d.status}</span></td>
                    <td className="px-4 py-3 text-xs text-gray-500">{d.due_date}</td>
                    <td className="px-4 py-3">{d.status === 'pending' || d.status === 'overdue' ?
                      <button onClick={() => markDepositPaid(d.id)} className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700">Mark Paid</button>
                      : <span className="text-xs text-gray-400">-</span>}
                    </td>
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
