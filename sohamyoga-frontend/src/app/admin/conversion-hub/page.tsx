'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard', 'experiments', 'funnels', 'offers', 'checkout'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = {
  dashboard: 'Dashboard', experiments: 'A/B Experiments', funnels: 'Funnel Analysis',
  offers: 'Offer Optimizer', checkout: 'Checkout & Activation',
};

interface Experiment { id: number; name: string; type: string; hypothesis?: string; control_variant?: string; test_variant?: string; metric?: string; status: string; control_conversions: number; test_conversions: number; control_visitors: number; test_visitors: number; }
interface Funnel { id: number; name: string; stages: Array<{ stage: string; visitors: number; conversions: number; rate: number }>; }
interface Offer { id: number; name: string; type: string; headline?: string; cta?: string; discount_pct: number; status: string; conversions: number; }
interface Metrics { running: string; ended: string; drafts: string; avg_control_rate: string; avg_test_rate: string; }
interface OptVariant { headline: string; cta: string; rationale: string; }

const STATUS_COLORS: Record<string, string> = {
  running: 'bg-green-100 text-green-700', ended: 'bg-blue-100 text-blue-700',
  draft: 'bg-gray-100 text-gray-600', paused: 'bg-amber-100 text-amber-700',
};

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>{label}</span>;
}
function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const borders: Record<string, string> = {
    blue: 'border-l-4 border-blue-500 bg-blue-50', green: 'border-l-4 border-green-500 bg-green-50',
    amber: 'border-l-4 border-amber-500 bg-amber-50', purple: 'border-l-4 border-purple-500 bg-purple-50',
    teal: 'border-l-4 border-teal-500 bg-teal-50', orange: 'border-l-4 border-orange-500 bg-orange-50',
  };
  return (
    <div className={`rounded-lg p-4 ${borders[color] || borders.blue}`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function convRate(conversions: number, visitors: number) {
  if (!visitors) return '0.00%';
  return `${(conversions / visitors * 100).toFixed(2)}%`;
}
function uplift(ctrl: number, ctrlV: number, test: number, testV: number) {
  if (!ctrlV || !testV) return '—';
  const c = ctrl / ctrlV; const t = test / testV;
  if (!c) return '—';
  const u = ((t - c) / c * 100);
  return `${u >= 0 ? '+' : ''}${u.toFixed(1)}%`;
}

export default function ConversionHubPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState<number | null>(null);
  const [analysisResult, setAnalysisResult] = useState<Record<number, { recommendation: string; winner: string; confidence_pct: number; control_rate: string; test_rate: string; uplift: string }>>({});
  const [optimizing, setOptimizing] = useState<number | null>(null);
  const [optResults, setOptResults] = useState<Record<number, OptVariant[]>>({});

  const fetchExperiments = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/conversion-hub').catch(() => null);
    if (res?.ok) { const d = await res.json(); setExperiments(d.experiments || []); setMetrics(d.metrics); }
    setLoading(false);
  }, []);

  const fetchFunnels = useCallback(async () => {
    const res = await fetch('/api/admin/conversion-hub/funnels').catch(() => null);
    if (res?.ok) { const d = await res.json(); setFunnels(d.funnels || []); }
  }, []);

  const fetchOffers = useCallback(async () => {
    const res = await fetch('/api/admin/conversion-hub/offers').catch(() => null);
    if (res?.ok) { const d = await res.json(); setOffers(d.offers || []); }
  }, []);

  useEffect(() => { fetchExperiments(); }, [fetchExperiments]);
  useEffect(() => { if (tab === 'funnels') fetchFunnels(); }, [tab, fetchFunnels]);
  useEffect(() => { if (tab === 'offers') fetchOffers(); }, [tab, fetchOffers]);

  const analyzeExp = async (id: number) => {
    setAnalyzing(id);
    const res = await fetch(`/api/admin/conversion-hub/${id}/analyze`, { method: 'POST' }).catch(() => null);
    if (res?.ok) { const d = await res.json(); setAnalysisResult(prev => ({ ...prev, [id]: d })); }
    setAnalyzing(null);
  };

  const optimizeOffer = async (id: number) => {
    setOptimizing(id);
    const res = await fetch(`/api/admin/conversion-hub/offers/${id}/optimize`, { method: 'POST' }).catch(() => null);
    if (res?.ok) { const d = await res.json(); setOptResults(prev => ({ ...prev, [id]: d.variants || [] })); }
    setOptimizing(null);
  };

  const bestOffer = offers.reduce((a, b) => b.conversions > (a?.conversions || 0) ? b : a, offers[0]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-slate-800 text-white px-6 py-4">
        <h1 className="text-2xl font-bold">Conversion Hub</h1>
        <p className="text-slate-300 text-sm mt-1">CRO · A/B Testing · Funnel Optimization · Offer Engine · Checkout</p>
      </div>
      <div className="border-b bg-white px-6 flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>
      <div className="p-6">
        {tab === 'dashboard' && (
          <div className="space-y-6">
            {loading ? <p className="text-gray-500 text-sm">Loading...</p> : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <KpiCard label="Running Experiments" value={metrics?.running || 0} color="green" />
                  <KpiCard label="Ended" value={metrics?.ended || 0} color="blue" />
                  <KpiCard label="Best Offer" value={bestOffer?.name || '—'} sub={`${bestOffer?.conversions || 0} conversions`} color="orange" />
                  <KpiCard label="Avg Test Rate" value={metrics?.avg_test_rate ? `${metrics.avg_test_rate}%` : '—'} sub={`vs control ${metrics?.avg_control_rate || 0}%`} color="purple" />
                </div>
                <div className="bg-white rounded-lg border p-4">
                  <h2 className="font-semibold text-gray-700 mb-3">Active Experiments</h2>
                  <div className="space-y-2">
                    {experiments.filter(e => e.status === 'running').map(e => (
                      <div key={e.id} className="flex items-center justify-between p-3 bg-gray-50 rounded border text-sm">
                        <div className="flex-1"><div className="font-medium text-gray-800">{e.name}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{e.metric}</div></div>
                        <div className="text-right mx-4">
                          <div className="text-xs text-gray-500">Control: {convRate(e.control_conversions, e.control_visitors)}</div>
                          <div className="text-xs text-gray-500">Test: {convRate(e.test_conversions, e.test_visitors)}</div>
                        </div>
                        <div className={`text-xs font-bold ${Number(e.test_conversions / (e.test_visitors||1)) > Number(e.control_conversions / (e.control_visitors||1)) ? 'text-green-600' : 'text-red-500'}`}>
                          {uplift(e.control_conversions, e.control_visitors, e.test_conversions, e.test_visitors)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'experiments' && (
          <div className="space-y-4">
            {experiments.map(e => (
              <div key={e.id} className="bg-white rounded-lg border p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-800">{e.name}</h3>
                    {e.hypothesis && <p className="text-xs text-gray-500 mt-0.5 italic">{e.hypothesis}</p>}
                  </div>
                  <div className="flex gap-2 items-center">
                    <Badge label={e.status} colorClass={STATUS_COLORS[e.status] || 'bg-gray-100 text-gray-600'} />
                    <Badge label={e.type} colorClass="bg-purple-100 text-purple-700" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div className="bg-gray-50 border rounded p-3 text-sm">
                    <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Control</div>
                    <div className="text-gray-700">{e.control_variant || '—'}</div>
                    <div className="mt-1 text-xs text-gray-500">{e.control_conversions} / {e.control_visitors} visitors</div>
                    <div className="font-bold text-blue-700 mt-0.5">{convRate(e.control_conversions, e.control_visitors)}</div>
                  </div>
                  <div className="bg-gray-50 border rounded p-3 text-sm">
                    <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Test</div>
                    <div className="text-gray-700">{e.test_variant || '—'}</div>
                    <div className="mt-1 text-xs text-gray-500">{e.test_conversions} / {e.test_visitors} visitors</div>
                    <div className="font-bold text-orange-600 mt-0.5">{convRate(e.test_conversions, e.test_visitors)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">Uplift: <span className={Number(e.test_conversions/(e.test_visitors||1)) > Number(e.control_conversions/(e.control_visitors||1)) ? 'text-green-600' : 'text-red-500'}>
                    {uplift(e.control_conversions, e.control_visitors, e.test_conversions, e.test_visitors)}
                  </span></span>
                  <button onClick={() => analyzeExp(e.id)} disabled={analyzing === e.id}
                    className="ml-auto bg-orange-500 text-white px-3 py-1.5 rounded text-xs disabled:opacity-50">
                    {analyzing === e.id ? 'Analyzing...' : 'AI Analyze'}
                  </button>
                </div>
                {analysisResult[e.id] && (
                  <div className="mt-3 bg-orange-50 border border-orange-200 rounded p-3 text-sm">
                    <div className="flex gap-3 mb-1">
                      <Badge label={`Winner: ${analysisResult[e.id].winner}`} colorClass="bg-orange-100 text-orange-700" />
                      <Badge label={`Confidence: ${analysisResult[e.id].confidence_pct}%`} colorClass="bg-purple-100 text-purple-700" />
                    </div>
                    <p className="text-gray-700 text-xs">{analysisResult[e.id].recommendation}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'funnels' && (
          <div className="space-y-6">
            {funnels.map(f => (
              <div key={f.id} className="bg-white rounded-lg border p-4">
                <h3 className="font-semibold text-gray-800 mb-4">{f.name}</h3>
                <div className="space-y-2">
                  {f.stages.map((stage, i) => {
                    const maxVis = f.stages[0]?.visitors || 1;
                    const pct = Math.round(stage.visitors / maxVis * 100);
                    const dropPct = i > 0 ? Math.round((1 - stage.visitors / (f.stages[i-1]?.visitors || 1)) * 100) : 0;
                    return (
                      <div key={i}>
                        <div className="flex items-center gap-3 mb-1">
                          <div className="w-24 text-xs text-right text-gray-600 font-medium">{stage.stage}</div>
                          <div className="flex-1 bg-gray-100 rounded-full h-6 relative">
                            <div className="bg-orange-400 h-6 rounded-full" style={{ width: `${pct}%` }} />
                            <span className="absolute left-2 top-0 h-6 flex items-center text-xs font-medium text-gray-700">{stage.visitors.toLocaleString()}</span>
                          </div>
                          <div className="w-20 text-xs text-right">
                            <span className="text-green-600 font-medium">{stage.rate}% CVR</span>
                            {i > 0 && <div className="text-red-400">-{dropPct}% drop</div>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'offers' && (
          <div className="space-y-4">
            {offers.map(offer => (
              <div key={offer.id} className="bg-white rounded-lg border p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-800">{offer.name}</h3>
                    {offer.headline && <p className="text-sm text-gray-600 mt-0.5">{offer.headline}</p>}
                  </div>
                  <div className="flex gap-2">
                    {offer.discount_pct > 0 && <Badge label={`${offer.discount_pct}% off`} colorClass="bg-red-100 text-red-600" />}
                    <Badge label={offer.status} colorClass={offer.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'} />
                  </div>
                </div>
                <div className="flex items-center gap-4 mb-3 text-sm text-gray-500">
                  {offer.cta && <span>CTA: <span className="font-medium text-gray-700">{offer.cta}</span></span>}
                  <span>{offer.conversions} conversions</span>
                  <Badge label={offer.type} colorClass="bg-purple-50 text-purple-600" />
                </div>
                <button onClick={() => optimizeOffer(offer.id)} disabled={optimizing === offer.id}
                  className="bg-orange-500 text-white px-3 py-1.5 rounded text-xs disabled:opacity-50">
                  {optimizing === offer.id ? 'Optimizing with Ollama...' : 'AI Optimize Copy'}
                </button>
                {optResults[offer.id] && (
                  <div className="mt-3 space-y-2">
                    {optResults[offer.id].map((v, i) => (
                      <div key={i} className="bg-orange-50 border border-orange-100 rounded p-3 text-sm">
                        <div className="font-medium text-gray-800">{v.headline}</div>
                        <div className="text-orange-700 text-xs mt-0.5">CTA: {v.cta}</div>
                        <div className="text-gray-400 text-xs mt-1 italic">{v.rationale}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'checkout' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg border p-4">
                <h3 className="font-semibold text-gray-700 mb-2">Checkout Optimization</h3>
                <ul className="text-sm text-gray-600 space-y-2">
                  {['Reduce form fields to 5 or fewer','Show trust badges above the fold','Display progress indicators','Auto-fill address from ZIP code','Offer guest checkout option'].map((tip, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-green-500 font-bold mt-0.5">✓</span>{tip}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-white rounded-lg border p-4">
                <h3 className="font-semibold text-gray-700 mb-2">Activation Optimization</h3>
                <ul className="text-sm text-gray-600 space-y-2">
                  {['Send onboarding email within 5 min','Show in-app checklist on first login','Trigger welcome video on signup','Offer live chat during first session','Send Day 3 and Day 7 follow-up emails'].map((tip, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-blue-500 font-bold mt-0.5">✓</span>{tip}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-white rounded-lg border p-4">
                <h3 className="font-semibold text-gray-700 mb-2">Pipeline Acceleration</h3>
                <ul className="text-sm text-gray-600 space-y-2">
                  {['Alert sales when lead score passes 75','Auto-schedule demo for qualified leads','Send ROI calculator to stalled deals','Trigger urgency messaging at Day 14','Escalate to senior rep after 21 days'].map((tip, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-purple-500 font-bold mt-0.5">✓</span>{tip}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <h2 className="font-semibold text-gray-700 mb-3">Checkout Funnel Health</h2>
              <div className="space-y-2 text-sm">
                {[
                  { label: 'Cart Abandonment Rate', value: '68%', status: 'warning', tip: 'Industry avg 70% — at target' },
                  { label: 'Checkout Completion', value: '72%', status: 'good', tip: 'Above industry avg of 65%' },
                  { label: 'Payment Failure Rate', value: '3.2%', status: 'good', tip: 'Low — good payment infra' },
                  { label: 'Guest Checkout Usage', value: '41%', status: 'neutral', tip: 'Consider prompting account creation post-purchase' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="text-gray-600">{item.label}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-gray-800">{item.value}</span>
                      <Badge label={item.status} colorClass={item.status === 'good' ? 'bg-green-100 text-green-700' : item.status === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'} />
                      <span className="text-xs text-gray-400 hidden md:block">{item.tip}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
