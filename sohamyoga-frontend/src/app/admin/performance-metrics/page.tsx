'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────

interface Metric {
  id: number;
  metric_code: string;
  metric_type: string;
  category: string;
  name: string;
  description: string | null;
  unit: string;
  direction: string;
  current_value: number | null;
  target_value: number | null;
  baseline_value: number | null;
  min_threshold: number | null;
  max_threshold: number | null;
  status: string;
  frequency: string;
  owner: string | null;
  last_updated_at: string;
  computed_status: string;
}

interface Snapshot {
  id: number;
  metric_id: number;
  metric_code: string;
  value: number;
  recorded_at: string;
  notes: string | null;
  source: string;
}

interface ApiData {
  metrics: Metric[];
  snapshots: Snapshot[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  exceeded:    'bg-purple-500/20 text-purple-200 border-purple-500/30',
  on_track:    'bg-green-500/20 text-green-200 border-green-500/30',
  at_risk:     'bg-yellow-500/20 text-yellow-200 border-yellow-500/30',
  off_track:   'bg-red-500/20 text-red-200 border-red-500/30',
  not_measured:'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

const STATUS_ICON: Record<string, string> = {
  exceeded: '🌟',
  on_track: '🟢',
  at_risk:  '🟡',
  off_track:'🔴',
  not_measured:'⬜',
};

function fmtVal(v: number | null, unit: string): string {
  if (v === null) return '—';
  if (unit === '$') return `$${v.toLocaleString()}`;
  if (unit === '%') return `${v}%`;
  return `${v} ${unit}`;
}

function progressPct(m: Metric): number {
  if (m.current_value === null || m.target_value === null || m.target_value === 0) return 0;
  if (m.direction === 'lower_better') {
    // lower is better: at target = 100%, above target = <100%
    return Math.min(100, Math.max(0, (m.target_value / m.current_value) * 100));
  }
  return Math.min(100, Math.max(0, (m.current_value / m.target_value) * 100));
}

function achievementPct(m: Metric): number {
  if (m.current_value === null || m.target_value === null || m.target_value === 0) return 0;
  if (m.direction === 'lower_better') {
    return Math.round((m.target_value / m.current_value) * 100);
  }
  return Math.round((m.current_value / m.target_value) * 100);
}

const CATEGORIES = ['marketing','sales','finance','operations','tech','customer','product'];
const METRIC_TYPES = ['KPI','KRI','ROI','OKR','NPS','SLA'];
const DIRECTIONS = ['higher_better','lower_better','target_range'];
const FREQUENCIES = ['daily','weekly','monthly','quarterly'];
const UNITS = ['%','$','count','ratio','days','hours','score','months'];

const GLASS = 'bg-slate-800/70 border border-white/20 rounded-2xl p-6 shadow-xl';
const TAB_ACTIVE = 'bg-white/20 text-white rounded-lg px-4 py-2 text-sm font-medium';
const TAB_INACTIVE = 'text-white/60 hover:bg-white/10 rounded-lg px-4 py-2 text-sm font-medium transition-colors';

const TABS = ['Executive Dashboard','Trend Analysis','KPI Scorecard','KRI Alert Board','Add / Update Metric','ROI Calculator'];

// ─── Component ─────────────────────────────────────────────────────────────

export default function PerformanceMetricsPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [data, setData] = useState<ApiData>({ metrics: [], snapshots: [] });
  const [loading, setLoading] = useState(true);
  const [selectedMetricId, setSelectedMetricId] = useState<number | null>(null);

  // Form state
  const [form, setForm] = useState({
    id: '', metric_code: '', metric_type: 'KPI', category: 'marketing', name: '',
    description: '', unit: '%', direction: 'higher_better', current_value: '',
    target_value: '', baseline_value: '', min_threshold: '', max_threshold: '',
    frequency: 'monthly', owner: '',
  });

  // ROI calculator state
  const [roi, setRoi] = useState({
    adSpend: 0, platformCost: 0, teamHours: 0, hourlyRate: 0,
    revenueGenerated: 0, leadsClosedCount: 0, avgDealValue: 0,
    savedHours: 0, savedRate: 0,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/performance-metrics');
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ROI derived values
  const totalInvestment = roi.adSpend + roi.platformCost + roi.teamHours * roi.hourlyRate;
  const totalReturn = roi.revenueGenerated + roi.leadsClosedCount * roi.avgDealValue + roi.savedHours * roi.savedRate;
  const roiPct = totalInvestment > 0 ? ((totalReturn - totalInvestment) / totalInvestment * 100) : 0;
  const paybackMonths = totalReturn > 0 ? (totalInvestment / (totalReturn / 12)) : 0;

  const kpis = data.metrics.filter(m => m.metric_type === 'KPI');
  const kris = data.metrics.filter(m => m.metric_type === 'KRI');
  const rois = data.metrics.filter(m => m.metric_type === 'ROI');

  const selectedMetric = data.metrics.find(m => m.id === selectedMetricId) ?? data.metrics[0] ?? null;
  const metricSnapshots = selectedMetric
    ? data.snapshots.filter(s => s.metric_id === selectedMetric.id).slice(0, 12).reverse()
    : [];

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      ...form,
      current_value: form.current_value ? Number(form.current_value) : null,
      target_value: form.target_value ? Number(form.target_value) : null,
      baseline_value: form.baseline_value ? Number(form.baseline_value) : null,
      min_threshold: form.min_threshold ? Number(form.min_threshold) : null,
      max_threshold: form.max_threshold ? Number(form.max_threshold) : null,
    };
    const method = form.id ? 'PATCH' : 'POST';
    await fetch('/api/admin/performance-metrics', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setForm({
      id: '', metric_code: '', metric_type: 'KPI', category: 'marketing', name: '',
      description: '', unit: '%', direction: 'higher_better', current_value: '',
      target_value: '', baseline_value: '', min_threshold: '', max_threshold: '',
      frequency: 'monthly', owner: '',
    });
    await load();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className={GLASS}>
          <h1 className="text-3xl font-bold text-white">📊 KPI / KRI / ROI Dashboard</h1>
          <p className="text-white/60 mt-1">Performance metrics, risk indicators, and return on investment tracking.</p>
        </div>

        {/* Tabs */}
        <div className={GLASS + ' !p-2'}>
          <div className="flex flex-wrap gap-1">
            {TABS.map((t, i) => (
              <button key={i} onClick={() => setActiveTab(i)} className={activeTab === i ? TAB_ACTIVE : TAB_INACTIVE}>{t}</button>
            ))}
          </div>
        </div>

        {loading && <div className="text-white/60 text-center py-8">Loading…</div>}

        {/* Tab 0: Executive Dashboard */}
        {!loading && activeTab === 0 && (
          <div className="space-y-6">
            {/* KPIs */}
            <div className={GLASS}>
              <h2 className="text-xl font-semibold text-white mb-4">Key Performance Indicators</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {kpis.map(m => {
                  const pct = progressPct(m);
                  return (
                    <div key={m.id} className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
                      <div className="flex items-start justify-between">
                        <span className="text-white/70 text-xs font-mono">{m.metric_code}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[m.computed_status]}`}>
                          {STATUS_ICON[m.computed_status]} {m.computed_status.replace('_',' ')}
                        </span>
                      </div>
                      <p className="text-white font-medium text-sm">{m.name}</p>
                      <p className="text-2xl font-bold text-white">{fmtVal(m.current_value, m.unit)}</p>
                      <p className="text-white/50 text-xs">Target: {fmtVal(m.target_value, m.unit)}</p>
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-blue-400 to-purple-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-white/40 text-xs">{pct.toFixed(0)}% of target</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* KRIs */}
            <div className={GLASS}>
              <h2 className="text-xl font-semibold text-white mb-4">Key Risk Indicators</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {kris.map(m => {
                  const min = m.min_threshold ?? 0;
                  const max = m.max_threshold ?? (m.target_value ?? 100);
                  const cur = m.current_value ?? min;
                  const range = Math.max(max - min, 0.001);
                  const posPct = Math.min(100, Math.max(0, ((cur - min) / range) * 100));
                  return (
                    <div key={m.id} className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                      <div className="flex justify-between">
                        <span className="text-white font-medium text-sm">{m.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[m.computed_status]}`}>
                          {STATUS_ICON[m.computed_status]}
                        </span>
                      </div>
                      <p className="text-2xl font-bold text-white">{fmtVal(m.current_value, m.unit)}</p>
                      <div className="relative h-3 bg-white/10 rounded-full overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-red-500/40 via-green-500/40 to-red-500/40" />
                        <div className="absolute top-0 h-full w-1 bg-white rounded-full shadow-lg" style={{ left: `${posPct}%`, transform: 'translateX(-50%)' }} />
                      </div>
                      <div className="flex justify-between text-xs text-white/40">
                        <span>{m.min_threshold ?? '—'}</span>
                        <span className="text-white/60">Target: {fmtVal(m.target_value, m.unit)}</span>
                        <span>{m.max_threshold ?? '—'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ROI */}
            <div className={GLASS}>
              <h2 className="text-xl font-semibold text-white mb-4">ROI Metrics</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rois.map(m => (
                  <div key={m.id} className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
                    <span className="text-white/60 text-xs font-mono">{m.metric_code}</span>
                    <p className="text-white font-medium text-sm">{m.name}</p>
                    <p className="text-3xl font-bold text-emerald-400">
                      {m.current_value !== null ? `${m.current_value}${m.unit === 'ratio' ? 'x' : m.unit} return` : '—'}
                    </p>
                    <p className="text-white/50 text-xs">Target: {fmtVal(m.target_value, m.unit)}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[m.computed_status]}`}>
                      {STATUS_ICON[m.computed_status]} {m.computed_status.replace('_',' ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 1: Trend Analysis */}
        {!loading && activeTab === 1 && (
          <div className={GLASS}>
            <h2 className="text-xl font-semibold text-white mb-4">Trend Analysis</h2>
            <div className="mb-4">
              <label className="text-white/70 text-sm mr-2">Select Metric:</label>
              <select
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
                value={selectedMetricId ?? ''}
                onChange={e => setSelectedMetricId(Number(e.target.value) || null)}
              >
                <option value="">— choose —</option>
                {data.metrics.map(m => (
                  <option key={m.id} value={m.id}>{m.metric_code}: {m.name}</option>
                ))}
              </select>
            </div>

            {selectedMetric && (
              <div className="space-y-6">
                <div className="flex items-end gap-2 h-40 bg-white/5 rounded-xl p-4 relative">
                  {/* Target line */}
                  {selectedMetric.target_value !== null && metricSnapshots.length > 0 && (() => {
                    const maxVal = Math.max(...metricSnapshots.map(s => s.value), selectedMetric.target_value ?? 0);
                    const targetPct = maxVal > 0 ? ((selectedMetric.target_value ?? 0) / maxVal) * 100 : 50;
                    return (
                      <div
                        className="absolute left-4 right-4 border-t-2 border-dashed border-yellow-400/60"
                        style={{ bottom: `calc(${targetPct}% + 16px)` }}
                      >
                        <span className="text-yellow-400 text-xs ml-2 -mt-3 absolute">Target</span>
                      </div>
                    );
                  })()}
                  {metricSnapshots.length === 0 ? (
                    <p className="text-white/40 m-auto">No snapshot data yet.</p>
                  ) : (() => {
                    const maxVal = Math.max(...metricSnapshots.map(s => s.value), 0.001);
                    return metricSnapshots.map((s, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className="w-full bg-gradient-to-t from-blue-500 to-purple-400 rounded-t-sm opacity-80"
                          style={{ height: `${(s.value / maxVal) * 100}%` }}
                          title={`${s.recorded_at}: ${s.value}`}
                        />
                        <span className="text-white/40 text-xs">{s.recorded_at.slice(5)}</span>
                      </div>
                    ));
                  })()}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-white/50 border-b border-white/10">
                        <th className="text-left py-2">Date</th>
                        <th className="text-right py-2">Value</th>
                        <th className="text-left py-2 pl-4">Source</th>
                        <th className="text-left py-2 pl-4">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...metricSnapshots].reverse().map((s, i) => (
                        <tr key={i} className="border-b border-white/5 text-white/80">
                          <td className="py-2">{s.recorded_at}</td>
                          <td className="py-2 text-right font-mono">{fmtVal(s.value, selectedMetric.unit)}</td>
                          <td className="py-2 pl-4 text-white/50">{s.source}</td>
                          <td className="py-2 pl-4 text-white/50">{s.notes ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: KPI Scorecard */}
        {!loading && activeTab === 2 && (
          <div className={GLASS}>
            <h2 className="text-xl font-semibold text-white mb-4">KPI Scorecard</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-white/50 border-b border-white/10">
                    <th className="text-left py-2">Code</th>
                    <th className="text-left py-2">Name</th>
                    <th className="text-left py-2">Category</th>
                    <th className="text-right py-2">Current</th>
                    <th className="text-right py-2">Target</th>
                    <th className="text-right py-2">Achievement</th>
                    <th className="text-left py-2 pl-4">Status</th>
                    <th className="text-left py-2 pl-4">Owner</th>
                    <th className="text-left py-2 pl-4">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {[...kpis].sort((a, b) => achievementPct(a) - achievementPct(b)).map(m => (
                    <tr
                      key={m.id}
                      className="border-b border-white/5 text-white/80 hover:bg-white/5 cursor-pointer"
                      onClick={() => { setForm({ id: String(m.id), metric_code: m.metric_code, metric_type: m.metric_type, category: m.category, name: m.name, description: m.description ?? '', unit: m.unit, direction: m.direction, current_value: String(m.current_value ?? ''), target_value: String(m.target_value ?? ''), baseline_value: String(m.baseline_value ?? ''), min_threshold: String(m.min_threshold ?? ''), max_threshold: String(m.max_threshold ?? ''), frequency: m.frequency, owner: m.owner ?? '' }); setActiveTab(4); }}
                    >
                      <td className="py-2 font-mono text-xs">{m.metric_code}</td>
                      <td className="py-2">{m.name}</td>
                      <td className="py-2">
                        <span className="bg-blue-500/20 text-blue-200 px-2 py-0.5 rounded-full text-xs">{m.category}</span>
                      </td>
                      <td className="py-2 text-right font-mono">{fmtVal(m.current_value, m.unit)}</td>
                      <td className="py-2 text-right font-mono text-white/50">{fmtVal(m.target_value, m.unit)}</td>
                      <td className="py-2 text-right">
                        <span className="font-bold">{achievementPct(m)}%</span>
                      </td>
                      <td className="py-2 pl-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[m.computed_status]}`}>
                          {STATUS_ICON[m.computed_status]} {m.computed_status.replace('_',' ')}
                        </span>
                      </td>
                      <td className="py-2 pl-4 text-white/50">{m.owner ?? '—'}</td>
                      <td className="py-2 pl-4 text-white/40 text-xs">{new Date(m.last_updated_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: KRI Alert Board */}
        {!loading && activeTab === 3 && (
          <div className={GLASS}>
            <h2 className="text-xl font-semibold text-white mb-4">KRI Alert Board</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {kris.map(m => {
                const min = m.min_threshold;
                const max = m.max_threshold;
                const cur = m.current_value;
                const nearMin = min !== null && cur !== null && cur < min * 1.1 && cur >= min;
                const nearMax = max !== null && cur !== null && cur > max * 0.9 && cur <= max;
                const isAlert = nearMin || nearMax || m.computed_status === 'off_track';
                return (
                  <div key={m.id} className={`bg-white/5 border rounded-xl p-5 space-y-4 ${isAlert ? 'border-red-500/40' : 'border-white/10'}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-white font-semibold">{m.name}</p>
                        <p className="text-white/50 text-xs">{m.description}</p>
                      </div>
                      <span className={`text-2xl`}>{STATUS_ICON[m.computed_status]}</span>
                    </div>

                    <div className="text-3xl font-bold text-white">{fmtVal(cur, m.unit)}</div>

                    {/* Gauge */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-white/40">
                        <span>Min: {min ?? '—'}</span>
                        <span>Max: {max ?? '—'}</span>
                      </div>
                      {min !== null && max !== null && cur !== null && (
                        <div className="relative h-4 bg-white/10 rounded-full overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-r from-red-500/50 via-green-500/50 to-red-500/50" />
                          <div
                            className="absolute top-1 h-2 w-2 bg-white rounded-full shadow"
                            style={{ left: `${Math.min(100, Math.max(0, ((cur - min) / Math.max(max - min, 0.001)) * 100))}%`, transform: 'translateX(-50%)' }}
                          />
                        </div>
                      )}
                    </div>

                    {isAlert && (
                      <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-xs text-red-300">
                        ⚠️ {m.computed_status === 'off_track' ? 'Outside safe threshold' : 'Approaching threshold — monitor closely'}
                      </div>
                    )}

                    <div className="text-xs text-white/50">Target: {fmtVal(m.target_value, m.unit)} · Freq: {m.frequency}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 4: Add / Update Metric */}
        {activeTab === 4 && (
          <div className={GLASS}>
            <h2 className="text-xl font-semibold text-white mb-4">{form.id ? 'Update Metric' : 'Add New Metric'}</h2>
            <form onSubmit={submitForm} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                ['metric_code','Metric Code','text',true],
                ['name','Name','text',true],
                ['description','Description','text',false],
                ['unit','Unit','select',false],
                ['current_value','Current Value','number',false],
                ['target_value','Target Value','number',false],
                ['baseline_value','Baseline Value','number',false],
                ['min_threshold','Min Threshold','number',false],
                ['max_threshold','Max Threshold','number',false],
                ['frequency','Frequency','select',false],
                ['owner','Owner','text',false],
              ].map(([field, label, type, required]) => (
                <div key={field as string}>
                  <label className="text-white/70 text-sm block mb-1">{label as string}{required ? ' *' : ''}</label>
                  {type === 'select' ? (
                    <select
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
                      value={(form as Record<string, string>)[field as string]}
                      onChange={e => setForm(prev => ({ ...prev, [field as string]: e.target.value }))}
                    >
                      {field === 'unit' && UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      {field === 'frequency' && FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  ) : (
                    <input
                      type={type as string}
                      required={required as boolean}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
                      value={(form as Record<string, string>)[field as string]}
                      onChange={e => setForm(prev => ({ ...prev, [field as string]: e.target.value }))}
                    />
                  )}
                </div>
              ))}

              <div>
                <label className="text-white/70 text-sm block mb-1">Metric Type *</label>
                <select className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm" value={form.metric_type} onChange={e => setForm(p => ({ ...p, metric_type: e.target.value }))}>
                  {METRIC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-white/70 text-sm block mb-1">Category *</label>
                <select className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-white/70 text-sm block mb-1">Direction</label>
                <select className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm" value={form.direction} onChange={e => setForm(p => ({ ...p, direction: e.target.value }))}>
                  {DIRECTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div className="col-span-full flex gap-3 pt-2">
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors">
                  {form.id ? 'Update Metric' : 'Create Metric'}
                </button>
                {form.id && (
                  <button type="button" onClick={() => setForm({ id: '', metric_code: '', metric_type: 'KPI', category: 'marketing', name: '', description: '', unit: '%', direction: 'higher_better', current_value: '', target_value: '', baseline_value: '', min_threshold: '', max_threshold: '', frequency: 'monthly', owner: '' })} className="bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-lg font-medium transition-colors">
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        {/* Tab 5: ROI Calculator */}
        {activeTab === 5 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Investment Inputs */}
              <div className={GLASS}>
                <h3 className="text-lg font-semibold text-white mb-4">💸 Investment</h3>
                <div className="space-y-4">
                  {[
                    ['adSpend','Ad Spend ($)'],
                    ['platformCost','Platform Cost ($)'],
                    ['teamHours','Team Hours'],
                    ['hourlyRate','Hourly Rate ($/hr)'],
                  ].map(([key, label]) => (
                    <div key={key}>
                      <label className="text-white/70 text-sm block mb-1">{label}</label>
                      <input
                        type="number"
                        min="0"
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
                        value={(roi as Record<string, number>)[key] || ''}
                        onChange={e => setRoi(p => ({ ...p, [key]: Number(e.target.value) || 0 }))}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Return Inputs */}
              <div className={GLASS}>
                <h3 className="text-lg font-semibold text-white mb-4">💰 Returns</h3>
                <div className="space-y-4">
                  {[
                    ['revenueGenerated','Revenue Generated ($)'],
                    ['leadsClosedCount','Leads Closed (count)'],
                    ['avgDealValue','Avg Deal Value ($)'],
                    ['savedHours','Saved Hours'],
                    ['savedRate','Saved Rate ($/hr)'],
                  ].map(([key, label]) => (
                    <div key={key}>
                      <label className="text-white/70 text-sm block mb-1">{label}</label>
                      <input
                        type="number"
                        min="0"
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
                        value={(roi as Record<string, number>)[key] || ''}
                        onChange={e => setRoi(p => ({ ...p, [key]: Number(e.target.value) || 0 }))}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Results */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Investment', value: `$${totalInvestment.toLocaleString()}`, color: 'text-red-300' },
                { label: 'Total Return', value: `$${totalReturn.toLocaleString()}`, color: 'text-green-300' },
                { label: 'ROI', value: `${roiPct.toFixed(1)}%`, color: roiPct >= 0 ? 'text-emerald-400' : 'text-red-400' },
                { label: 'Payback Period', value: `${paybackMonths.toFixed(1)} mo`, color: 'text-blue-300' },
              ].map(({ label, value, color }) => (
                <div key={label} className={GLASS + ' text-center'}>
                  <p className="text-white/60 text-sm mb-2">{label}</p>
                  <p className={`text-3xl font-bold ${color}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
