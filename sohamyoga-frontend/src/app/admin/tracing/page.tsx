'use client';

import { useState, useEffect, useCallback } from 'react';

interface TraceRow {
  trace_id: string;
  operation: string;
  service: string;
  status: string;
  started_at: string;
  span_count: number;
  total_duration_ms: number;
}

interface Span {
  id: number;
  trace_id: string;
  span_id: string;
  parent_span_id: string | null;
  operation: string;
  service: string;
  status: string;
  duration_ms: number | null;
  started_at: string;
  tags: Record<string, string>;
  error_message: string | null;
}

const GLASS = 'bg-slate-800/70 border border-white/20 rounded-2xl p-6 shadow-xl';
const GLASS_SM = 'bg-slate-800/70 border border-white/20 rounded-xl p-4 shadow-lg';

const STATUS_COLORS: Record<string, string> = {
  ok: 'bg-green-500/30 text-green-200',
  error: 'bg-red-500/30 text-red-200',
  timeout: 'bg-amber-500/30 text-amber-200',
};

const SERVICE_COLORS: Record<string, string> = {
  postgres: 'bg-blue-500',
  ollama: 'bg-purple-500',
  'external-api': 'bg-amber-500',
  sohamyoga: 'bg-green-500',
};

function Badge({ text, className }: { text: string; className: string }) {
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${className}`}>{text}</span>;
}

export default function TracingPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [traces, setTraces] = useState<TraceRow[]>([]);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [spans, setSpans] = useState<Span[]>([]);
  const [injectForm, setInjectForm] = useState({ operation: '', service: 'sohamyoga', duration_ms: '', status: 'ok', tags: '{}' });
  const [loading, setLoading] = useState(false);

  const loadTraces = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/tracing');
      const data = await res.json();
      setTraces(data.traces || []);
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  const loadSpans = useCallback(async (traceId: string) => {
    try {
      const res = await fetch(`/api/admin/tracing/${traceId}`);
      const data = await res.json();
      setSpans(data.spans || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadTraces(); }, [loadTraces]);
  useEffect(() => { if (selectedTraceId) loadSpans(selectedTraceId); }, [selectedTraceId, loadSpans]);

  async function injectTrace() {
    let parsedTags = {};
    try { parsedTags = JSON.parse(injectForm.tags || '{}'); } catch { parsedTags = {}; }
    await fetch('/api/admin/tracing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: injectForm.operation,
        service: injectForm.service,
        duration_ms: Number(injectForm.duration_ms) || null,
        status: injectForm.status,
        tags: parsedTags,
      }),
    });
    await loadTraces();
  }

  // Build service map from traces
  const serviceMap = traces.reduce<Record<string, { total: number; total_duration: number; errors: number }>>((acc, t) => {
    if (!acc[t.service]) acc[t.service] = { total: 0, total_duration: 0, errors: 0 };
    acc[t.service].total++;
    acc[t.service].total_duration += t.total_duration_ms || 0;
    if (t.status === 'error') acc[t.service].errors++;
    return acc;
  }, {});

  // Waterfall computation
  const traceStartMs = spans.length > 0 ? new Date(spans[0].started_at).getTime() : 0;
  const traceEndMs = spans.reduce((max, s) => {
    const end = new Date(s.started_at).getTime() + (s.duration_ms || 0);
    return end > max ? end : max;
  }, traceStartMs);
  const totalTraceDuration = Math.max(traceEndMs - traceStartMs, 1);

  // Build parent map for indentation
  const spanDepth: Record<string, number> = {};
  function getDepth(spanId: string, visited = new Set<string>()): number {
    if (visited.has(spanId)) return 0;
    visited.add(spanId);
    const span = spans.find(s => s.span_id === spanId);
    if (!span || !span.parent_span_id) return 0;
    return 1 + getDepth(span.parent_span_id, visited);
  }
  spans.forEach(s => { spanDepth[s.span_id] = getDepth(s.span_id); });

  const tabs = ['Trace List', 'Trace Detail', 'Service Map', 'Inject Test Trace'];

  return (
    <div className="min-h-screen p-6" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)' }}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Distributed Tracing 🔭</h1>
          <p className="text-white/60 mt-1">Trace requests across services with waterfall visualization</p>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {tabs.map((t, i) => (
            <button key={i} onClick={() => setActiveTab(i)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === i ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10'}`}>
              {t}
            </button>
          ))}
        </div>

        {/* Tab 0: Trace List */}
        {activeTab === 0 && (
          <div className={GLASS}>
            {loading && <p className="text-white/60 mb-4">Loading…</p>}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-white/60 text-left border-b border-white/10">
                    <th className="pb-2 pr-4">Trace ID</th>
                    <th className="pb-2 pr-4">Root Operation</th>
                    <th className="pb-2 pr-4">Service</th>
                    <th className="pb-2 pr-4">Spans</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">Duration</th>
                    <th className="pb-2">Started</th>
                  </tr>
                </thead>
                <tbody>
                  {traces.map(t => (
                    <tr key={t.trace_id} onClick={() => { setSelectedTraceId(t.trace_id); setActiveTab(1); }}
                      className="border-b border-white/5 hover:bg-white/5 cursor-pointer">
                      <td className="py-2 pr-4 text-blue-300 font-mono text-xs">{t.trace_id.slice(0, 8)}…</td>
                      <td className="py-2 pr-4 text-white/80">{t.operation}</td>
                      <td className="py-2 pr-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full text-white ${SERVICE_COLORS[t.service] || 'bg-gray-500'}`}>{t.service}</span>
                      </td>
                      <td className="py-2 pr-4 text-white/60">{t.span_count}</td>
                      <td className="py-2 pr-4"><Badge text={t.status} className={STATUS_COLORS[t.status] || 'bg-gray-500/30 text-gray-200'} /></td>
                      <td className="py-2 pr-4 text-white/60">{t.total_duration_ms}ms</td>
                      <td className="py-2 text-white/60 text-xs">{new Date(t.started_at).toLocaleString()}</td>
                    </tr>
                  ))}
                  {traces.length === 0 && <tr><td colSpan={7} className="py-4 text-center text-white/40">No traces yet — inject one on the last tab</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 1: Trace Detail — Waterfall */}
        {activeTab === 1 && (
          <div className={GLASS}>
            {!selectedTraceId ? (
              <p className="text-white/60">Click a trace in the Trace List tab to view detail</p>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-white font-semibold">Trace: <span className="font-mono text-blue-300 text-sm">{selectedTraceId}</span></h3>
                  <button onClick={() => setActiveTab(0)} className="text-xs text-white/50 hover:text-white/80">← Back</button>
                </div>
                {/* Legend */}
                <div className="flex flex-wrap gap-3 mb-4">
                  {Object.entries(SERVICE_COLORS).map(([svc, color]) => (
                    <div key={svc} className="flex items-center gap-1.5">
                      <div className={`w-3 h-3 rounded-sm ${color}`} />
                      <span className="text-white/60 text-xs">{svc}</span>
                    </div>
                  ))}
                </div>
                {/* Waterfall */}
                <div className="space-y-1">
                  {spans.map(span => {
                    const spanStart = new Date(span.started_at).getTime() - traceStartMs;
                    const left = (spanStart / totalTraceDuration) * 100;
                    const width = Math.max(((span.duration_ms || 0) / totalTraceDuration) * 100, 0.5);
                    const depth = spanDepth[span.span_id] || 0;
                    const barColor = SERVICE_COLORS[span.service] || 'bg-gray-500';
                    return (
                      <div key={span.id} className="flex items-center gap-3">
                        <div className="w-48 text-right shrink-0" style={{ paddingRight: `${depth * 12}px` }}>
                          <span className="text-white/70 text-xs truncate block">{span.operation}</span>
                          <span className="text-white/40 text-xs">{span.duration_ms ?? '?'}ms</span>
                        </div>
                        <div className="flex-1 h-6 bg-white/5 rounded relative">
                          <div
                            className={`absolute h-full rounded ${barColor} opacity-70`}
                            style={{ left: `${Math.min(left, 99)}%`, width: `${Math.min(width, 100 - left)}%` }}
                            title={`${span.operation} | ${span.service} | ${span.duration_ms ?? '?'}ms | ${span.status}`}
                          />
                        </div>
                        <Badge text={span.status} className={STATUS_COLORS[span.status] || 'bg-gray-500/30 text-gray-200'} />
                      </div>
                    );
                  })}
                  {spans.length === 0 && <p className="text-white/40 text-center py-4">No spans found for this trace</p>}
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab 2: Service Map */}
        {activeTab === 2 && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {Object.entries(serviceMap).map(([svc, data]) => (
                <div key={svc} className={GLASS_SM}>
                  <div className={`w-full h-1 rounded-full mb-3 ${SERVICE_COLORS[svc] || 'bg-gray-500'}`} />
                  <h4 className="text-white font-semibold text-sm mb-2">{svc}</h4>
                  <div className="space-y-1 text-xs text-white/60">
                    <div className="flex justify-between"><span>Total traces</span><span className="text-white">{data.total}</span></div>
                    <div className="flex justify-between"><span>Avg duration</span><span className="text-white">{data.total > 0 ? Math.round(data.total_duration / data.total) : 0}ms</span></div>
                    <div className="flex justify-between"><span>Error rate</span><span className={data.errors > 0 ? 'text-red-300' : 'text-green-300'}>{data.total > 0 ? ((data.errors / data.total) * 100).toFixed(1) : 0}%</span></div>
                  </div>
                </div>
              ))}
              {Object.keys(serviceMap).length === 0 && <p className="text-white/40 col-span-4 text-center py-4">No service data yet</p>}
            </div>
            {Object.keys(serviceMap).length > 0 && (
              <div className={GLASS}>
                <h3 className="text-white font-semibold mb-4">Service Connections</h3>
                <div className="flex flex-wrap items-center gap-4 text-white/70 text-sm">
                  {Object.keys(serviceMap).map((svc, i, arr) => (
                    <div key={svc} className="flex items-center gap-4">
                      <span className={`px-3 py-1.5 rounded-lg text-white text-xs ${SERVICE_COLORS[svc] || 'bg-gray-500'}`}>{svc}</span>
                      {i < arr.length - 1 && <span className="text-white/30">→</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Inject Test Trace */}
        {activeTab === 3 && (
          <div className={GLASS + ' max-w-lg'}>
            <h3 className="text-white font-semibold mb-4">Inject Test Trace Span</h3>
            <div className="space-y-3">
              {(['operation'] as const).map(field => (
                <div key={field}>
                  <label className="text-white/60 text-xs mb-1 block capitalize">{field}</label>
                  <input value={injectForm[field]} onChange={e => setInjectForm(f => ({ ...f, [field]: e.target.value }))}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm" placeholder="e.g. api.POST /api/admin/ads" />
                </div>
              ))}
              <div>
                <label className="text-white/60 text-xs mb-1 block">Service</label>
                <select value={injectForm.service} onChange={e => setInjectForm(f => ({ ...f, service: e.target.value }))}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm">
                  {['sohamyoga', 'postgres', 'ollama', 'external-api'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-white/60 text-xs mb-1 block">Duration (ms)</label>
                <input type="number" value={injectForm.duration_ms} onChange={e => setInjectForm(f => ({ ...f, duration_ms: e.target.value }))}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm" placeholder="250" />
              </div>
              <div>
                <label className="text-white/60 text-xs mb-1 block">Status</label>
                <select value={injectForm.status} onChange={e => setInjectForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm">
                  {['ok', 'error', 'timeout'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-white/60 text-xs mb-1 block">Tags (JSON)</label>
                <textarea value={injectForm.tags} onChange={e => setInjectForm(f => ({ ...f, tags: e.target.value }))}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm font-mono" rows={3} placeholder='{"http.method": "GET"}' />
              </div>
              <button onClick={injectTrace} className="w-full py-2 rounded-xl bg-blue-500/40 hover:bg-blue-500/60 text-white font-medium">Inject Span</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
