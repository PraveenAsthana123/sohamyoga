'use client';

import { useState, useEffect, useCallback } from 'react';

interface Benchmark {
  id: number;
  benchmark_name: string;
  category: string;
  metric_name: string;
  value: number;
  unit: string;
  baseline_value: number | null;
  delta_pct: number | null;
  status: string;
  environment: string;
  run_at: string;
  notes: string | null;
}

interface BenchmarkHistory {
  benchmark_name: string;
  value: number;
  unit: string;
  run_at: string;
  status: string;
}

const GLASS = 'backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl p-6 shadow-xl';
const GLASS_SM = 'backdrop-blur-md bg-white/10 border border-white/20 rounded-xl p-4 shadow-lg';

const CATEGORY_COLORS: Record<string, string> = {
  api: 'bg-blue-500/30 text-blue-200',
  db: 'bg-cyan-500/30 text-cyan-200',
  ai: 'bg-purple-500/30 text-purple-200',
  frontend: 'bg-green-500/30 text-green-200',
  pipeline: 'bg-amber-500/30 text-amber-200',
  job: 'bg-pink-500/30 text-pink-200',
};

const STATUS_COLORS: Record<string, string> = {
  pass: 'bg-green-500/30 text-green-200',
  warn: 'bg-amber-500/30 text-amber-200',
  fail: 'bg-red-500/30 text-red-200',
};

function Badge({ text, className }: { text: string; className: string }) {
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${className}`}>{text}</span>;
}

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className={GLASS_SM}>
      <p className="text-white/60 text-xs mb-1">{label}</p>
      <p className="text-white text-2xl font-bold">{value}</p>
      {sub && <p className="text-white/50 text-xs mt-1">{sub}</p>}
    </div>
  );
}

const CATEGORIES = ['All', 'api', 'db', 'ai', 'frontend', 'pipeline', 'job'];

const SLA_TARGETS: { metric: string; target: string; key: string; check: (v: number) => boolean }[] = [
  { metric: 'API p50 latency', target: '<100ms', key: 'API Health Check', check: v => v < 100 },
  { metric: 'DB query p50', target: '<50ms', key: 'DB Query Simple SELECT', check: v => v < 50 },
  { metric: 'Ollama inference', target: '<5000ms', key: 'Ollama llama3.2 inference', check: v => v < 5000 },
  { metric: 'Auth token validation', target: '<50ms', key: 'Auth token validation', check: v => v < 50 },
  { metric: 'Pipeline throughput', target: '>100 rps', key: 'Pipeline stage throughput', check: v => v > 100 },
];

export default function BenchmarkingPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([]);
  const [history, setHistory] = useState<BenchmarkHistory[]>([]);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [selectedBenchmark, setSelectedBenchmark] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ delta_pct: number | null; status: string } | null>(null);
  const [form, setForm] = useState({
    benchmark_name: '', category: 'api', metric_name: 'p50_latency_ms',
    value: '', unit: 'ms', baseline_value: '', environment: 'local', notes: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (categoryFilter !== 'All') params.set('category', categoryFilter);
      const res = await fetch(`/api/admin/benchmarking?${params}`);
      const data = await res.json();
      setBenchmarks(data.benchmarks || []);
      setHistory(data.history || []);
    } catch { /* silent */ } finally { setLoading(false); }
  }, [categoryFilter]);

  useEffect(() => { load(); }, [load]);

  async function submitBenchmark() {
    const res = await fetch('/api/admin/benchmarking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, value: Number(form.value), baseline_value: form.baseline_value ? Number(form.baseline_value) : undefined }),
    });
    const data = await res.json();
    setSubmitResult({ delta_pct: data.delta_pct, status: data.status });
    await load();
  }

  const passing = benchmarks.filter(b => b.status === 'pass').length;
  const warning = benchmarks.filter(b => b.status === 'warn').length;
  const failing = benchmarks.filter(b => b.status === 'fail').length;

  const filteredBenchmarks = categoryFilter === 'All' ? benchmarks : benchmarks.filter(b => b.category === categoryFilter);
  const benchmarkNames = [...new Set(benchmarks.map(b => b.benchmark_name))];

  const trendData = selectedBenchmark
    ? history.filter(h => h.benchmark_name === selectedBenchmark)
    : [];
  const maxTrendVal = Math.max(...trendData.map(h => Number(h.value)), 1);

  const selectedBenchmarkData = benchmarks.find(b => b.benchmark_name === selectedBenchmark);

  const tabs = ['Overview', 'Trend Chart', 'Run Benchmark', 'SLA Targets'];

  return (
    <div className="min-h-screen p-6" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)' }}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Benchmarking Dashboard ⚡</h1>
          <p className="text-white/60 mt-1">Performance baselines and regression tracking</p>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {tabs.map((t, i) => (
            <button key={i} onClick={() => setActiveTab(i)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === i ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10'}`}>
              {t}
            </button>
          ))}
        </div>

        {/* Tab 0: Overview */}
        {activeTab === 0 && (
          <div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <KpiCard label="Total Benchmarks" value={benchmarks.length} />
              <KpiCard label="Passing" value={passing} sub="within baseline" />
              <KpiCard label="Warning" value={warning} sub=">5% worse" />
              <KpiCard label="Failing" value={failing} sub=">20% worse" />
            </div>
            {/* Category filter tabs */}
            <div className="flex flex-wrap gap-2 mb-4">
              {CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${categoryFilter === cat ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10'}`}>
                  {cat}
                </button>
              ))}
            </div>
            {loading && <p className="text-white/60 mb-4">Loading…</p>}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredBenchmarks.map(b => (
                <div key={b.id} className={GLASS_SM}>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-white font-medium text-sm">{b.benchmark_name}</h3>
                    <Badge text={b.category} className={CATEGORY_COLORS[b.category] || 'bg-gray-500/30 text-gray-200'} />
                  </div>
                  <p className="text-white/60 text-xs mb-3">{b.metric_name}</p>
                  <div className="flex items-end justify-between mb-2">
                    <span className="text-white text-xl font-bold">{Number(b.value).toFixed(1)}<span className="text-sm text-white/60 ml-1">{b.unit}</span></span>
                    {b.baseline_value !== null && (
                      <span className="text-white/50 text-xs">baseline: {Number(b.baseline_value).toFixed(1)}{b.unit}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge text={b.status} className={STATUS_COLORS[b.status] || 'bg-gray-500/30 text-gray-200'} />
                    {b.delta_pct !== null && (
                      <span className={`text-xs font-medium ${Number(b.delta_pct) > 0 ? 'text-red-300' : 'text-green-300'}`}>
                        {Number(b.delta_pct) > 0 ? '+' : ''}{Number(b.delta_pct).toFixed(1)}%
                      </span>
                    )}
                    <span className="text-white/30 text-xs ml-auto">{new Date(b.run_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 1: Trend Chart */}
        {activeTab === 1 && (
          <div className={GLASS}>
            <div className="flex items-center gap-3 mb-6">
              <label className="text-white/60 text-sm">Benchmark:</label>
              <select value={selectedBenchmark} onChange={e => setSelectedBenchmark(e.target.value)}
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm flex-1 max-w-xs">
                <option value="">Select a benchmark…</option>
                {benchmarkNames.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            {selectedBenchmark && (
              <>
                {selectedBenchmarkData && (
                  <div className="mb-4 flex items-center gap-4 text-sm">
                    <span className="text-white/60">Current: <span className="text-white font-semibold">{Number(selectedBenchmarkData.value).toFixed(1)} {selectedBenchmarkData.unit}</span></span>
                    {selectedBenchmarkData.baseline_value !== null && (
                      <span className="text-white/60">Baseline: <span className="text-white">{Number(selectedBenchmarkData.baseline_value).toFixed(1)} {selectedBenchmarkData.unit}</span></span>
                    )}
                  </div>
                )}
                {/* Baseline horizontal rule */}
                <div className="relative h-36 flex items-end gap-1">
                  {selectedBenchmarkData?.baseline_value !== null && selectedBenchmarkData?.baseline_value !== undefined && (
                    <div className="absolute inset-x-0 border-t border-dashed border-amber-400/50"
                      style={{ bottom: `${Math.min((Number(selectedBenchmarkData.baseline_value) / maxTrendVal) * 128, 128)}px` }}>
                      <span className="absolute -top-3 right-0 text-amber-300 text-xs">baseline</span>
                    </div>
                  )}
                  {trendData.map((h, i) => (
                    <div key={i} className="flex flex-col items-center gap-1 flex-1 min-w-0">
                      <div
                        className={`w-full rounded-t ${h.status === 'fail' ? 'bg-red-400/70' : h.status === 'warn' ? 'bg-amber-400/70' : 'bg-blue-400/70'}`}
                        style={{ height: `${Math.max((Number(h.value) / maxTrendVal) * 120, 4)}px` }}
                        title={`${new Date(h.run_at).toLocaleDateString()}: ${h.value} ${h.unit}`}
                      />
                      <span className="text-white/30 text-xs hidden lg:block">{new Date(h.run_at).toLocaleDateString().slice(0, 5)}</span>
                    </div>
                  ))}
                  {trendData.length === 0 && <p className="text-white/40 text-sm absolute inset-0 flex items-center justify-center">No historical data</p>}
                </div>
              </>
            )}
            {!selectedBenchmark && <p className="text-white/40 text-center py-8">Select a benchmark to view its trend</p>}
          </div>
        )}

        {/* Tab 2: Run Benchmark */}
        {activeTab === 2 && (
          <div className={GLASS + ' max-w-lg'}>
            <h3 className="text-white font-semibold mb-4">Submit Benchmark Result</h3>
            <div className="space-y-3">
              <div>
                <label className="text-white/60 text-xs mb-1 block">Benchmark Name</label>
                <input value={form.benchmark_name} onChange={e => setForm(f => ({ ...f, benchmark_name: e.target.value }))}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm" placeholder="e.g. API Health Check" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/60 text-xs mb-1 block">Category</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-2 py-2 text-white text-sm">
                    {['api', 'db', 'ai', 'frontend', 'pipeline', 'job'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-white/60 text-xs mb-1 block">Metric Name</label>
                  <input value={form.metric_name} onChange={e => setForm(f => ({ ...f, metric_name: e.target.value }))}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-2 py-2 text-white text-sm" placeholder="p50_latency_ms" />
                </div>
                <div>
                  <label className="text-white/60 text-xs mb-1 block">Value</label>
                  <input type="number" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-2 py-2 text-white text-sm" placeholder="45" />
                </div>
                <div>
                  <label className="text-white/60 text-xs mb-1 block">Unit</label>
                  <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-2 py-2 text-white text-sm">
                    {['ms', 'rps', '%', 'count', 'MB'].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-white/60 text-xs mb-1 block">Baseline Value</label>
                  <input type="number" value={form.baseline_value} onChange={e => setForm(f => ({ ...f, baseline_value: e.target.value }))}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-2 py-2 text-white text-sm" placeholder="50" />
                </div>
                <div>
                  <label className="text-white/60 text-xs mb-1 block">Environment</label>
                  <select value={form.environment} onChange={e => setForm(f => ({ ...f, environment: e.target.value }))}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-2 py-2 text-white text-sm">
                    {['local', 'staging', 'production'].map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-white/60 text-xs mb-1 block">Notes</label>
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm" placeholder="Optional notes" />
              </div>
              <button onClick={submitBenchmark} className="w-full py-2 rounded-xl bg-blue-500/40 hover:bg-blue-500/60 text-white font-medium">Submit</button>
              {submitResult && (
                <div className={`p-3 rounded-xl ${STATUS_COLORS[submitResult.status] || 'bg-gray-500/30 text-gray-200'}`}>
                  <p className="font-semibold">Result: {submitResult.status.toUpperCase()}</p>
                  {submitResult.delta_pct !== null && (
                    <p className="text-sm">Delta vs baseline: {submitResult.delta_pct > 0 ? '+' : ''}{submitResult.delta_pct?.toFixed(2)}%</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: SLA Targets */}
        {activeTab === 3 && (
          <div className={GLASS}>
            <h3 className="text-white font-semibold mb-4">SLA Targets</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-white/60 text-left border-b border-white/10">
                    <th className="pb-2 pr-4">Metric</th>
                    <th className="pb-2 pr-4">Target</th>
                    <th className="pb-2 pr-4">Current</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {SLA_TARGETS.map(sla => {
                    const b = benchmarks.find(bm => bm.benchmark_name === sla.key);
                    const current = b ? Number(b.value) : null;
                    const passes = current !== null ? sla.check(current) : null;
                    return (
                      <tr key={sla.metric} className="border-b border-white/5 hover:bg-white/5">
                        <td className="py-2 pr-4 text-white/80">{sla.metric}</td>
                        <td className="py-2 pr-4 text-white/60">{sla.target}</td>
                        <td className="py-2 pr-4 text-white">
                          {current !== null ? `${current.toFixed(1)} ${b?.unit || ''}` : '—'}
                        </td>
                        <td className="py-2">
                          {passes === null
                            ? <Badge text="no data" className="bg-gray-500/30 text-gray-200" />
                            : passes
                              ? <Badge text="pass" className={STATUS_COLORS.pass} />
                              : <Badge text="fail" className={STATUS_COLORS.fail} />
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
