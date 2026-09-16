'use client';

import { useEffect, useState, useCallback } from 'react';

interface ClassificationResult {
  id: number;
  model_name: string;
  input_text: string;
  predicted_class: string;
  confidence: number;
  classes: Record<string, number>;
  entity_type: string | null;
  entity_id: number | null;
  processing_time_ms: number;
  model_version: string | null;
  created_at: string;
}

const glass = 'bg-slate-800/70 border border-white/20 rounded-2xl p-6 shadow-xl';
const tabBase = 'px-4 py-2 rounded-lg text-sm font-medium transition-colors';
const tabActive = 'bg-white/20 text-white';
const tabInactive = 'text-white/60 hover:bg-white/10';

type Tab = 'run' | 'history' | 'config' | 'analytics';

const EXAMPLE_CLASSES = [
  { label: 'Sentiment', value: 'positive,negative,neutral' },
  { label: 'Support Priority', value: 'urgent,high,medium,low' },
  { label: 'Content Category', value: 'yoga,wellness,nutrition,mindfulness,fitness' },
];

export default function ClassificationPage() {
  const [tab, setTab] = useState<Tab>('run');
  const [results, setResults] = useState<ClassificationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [form, setForm] = useState({ text: '', entity_type: 'content', entity_id: '', classes: 'positive,negative,neutral' });
  const [lastResult, setLastResult] = useState<ClassificationResult | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const loadResults = useCallback(async () => {
    const res = await fetch('/api/admin/classification');
    const data = await res.json() as { results: ClassificationResult[] };
    setResults(data.results || []);
  }, []);

  useEffect(() => { loadResults(); }, [loadResults]);

  const runClassifier = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const classes = form.classes.split(',').map((c) => c.trim()).filter(Boolean);
      const res = await fetch('/api/admin/classification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: form.text,
          entity_type: form.entity_type,
          entity_id: form.entity_id ? parseInt(form.entity_id) : undefined,
          classes,
        }),
      });
      if (res.ok) {
        const data = await res.json() as { result: ClassificationResult };
        setLastResult(data.result);
        showToast(`Classified as: ${data.result.predicted_class}`);
        loadResults();
      } else {
        showToast('Classification failed');
      }
    } finally {
      setLoading(false);
    }
  };

  // Analytics
  const classCounts = results.reduce<Record<string, number>>((acc, r) => {
    acc[r.predicted_class] = (acc[r.predicted_class] || 0) + 1;
    return acc;
  }, {});
  const avgConfidence = results.length
    ? (results.reduce((sum, r) => sum + Number(r.confidence), 0) / results.length * 100).toFixed(1)
    : '0.0';
  const last7Days = results.filter((r) => new Date(r.created_at) > new Date(Date.now() - 7 * 86400000));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-pink-900 to-slate-900 p-6">
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-xl bg-white/20 px-4 py-2 text-white  shadow-xl">{toast}</div>
      )}
      <h1 className="mb-6 text-3xl font-bold text-white">Classification 🏷️</h1>

      <div className="mb-6 flex gap-2 flex-wrap">
        {(['run','history','config','analytics'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`${tabBase} ${tab === t ? tabActive : tabInactive}`}>
            {t === 'run' ? 'Run Classifier' : t === 'history' ? 'Results History' : t === 'config' ? 'Model Config' : 'Analytics'}
          </button>
        ))}
      </div>

      {tab === 'run' && (
        <div className="space-y-6">
          <div className={glass}>
            <h2 className="mb-4 text-xl font-semibold text-white">Run Classifier</h2>
            <form onSubmit={runClassifier} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-white/70">Text to Classify *</label>
                <textarea required rows={4} value={form.text} onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
                  placeholder="Enter text to classify…"
                  className="w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-white/70">Entity Type</label>
                  <select value={form.entity_type} onChange={(e) => setForm((f) => ({ ...f, entity_type: e.target.value }))}
                    className="w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-white focus:outline-none">
                    {['lead','support_ticket','content','email','review'].map((t) => <option key={t} value={t} className="bg-slate-800">{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm text-white/70">Entity ID (optional)</label>
                  <input type="number" value={form.entity_id} onChange={(e) => setForm((f) => ({ ...f, entity_id: e.target.value }))}
                    className="w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-white placeholder-white/40 focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm text-white/70">Classes (comma-separated)</label>
                <input value={form.classes} onChange={(e) => setForm((f) => ({ ...f, classes: e.target.value }))}
                  placeholder="e.g. positive,negative,neutral"
                  className="w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-white placeholder-white/40 focus:outline-none" />
                <div className="mt-2 flex flex-wrap gap-2">
                  {EXAMPLE_CLASSES.map(({ label, value }) => (
                    <button key={label} type="button" onClick={() => setForm((f) => ({ ...f, classes: value }))}
                      className="text-xs rounded-lg bg-white/10 border border-white/20 px-2 py-1 text-white/60 hover:text-white">
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <button type="submit" disabled={loading}
                className="rounded-xl bg-pink-600 px-6 py-2 text-white font-semibold hover:bg-pink-500 disabled:opacity-50">
                {loading ? 'Classifying…' : 'Classify'}
              </button>
            </form>
          </div>

          {lastResult && (
            <div className={glass}>
              <h3 className="mb-3 text-lg font-semibold text-white">Result</h3>
              <div className="flex items-center gap-4 mb-4">
                <span className="text-2xl font-bold text-pink-300">{lastResult.predicted_class}</span>
                <span className="text-white/60">{(Number(lastResult.confidence) * 100).toFixed(1)}% confidence</span>
                <span className="text-white/40 text-sm">{lastResult.processing_time_ms}ms</span>
              </div>
              <div className="space-y-2">
                {Object.entries(lastResult.classes || {}).map(([cls, prob]) => (
                  <div key={cls} className="flex items-center gap-3">
                    <span className="text-sm text-white/70 w-24 truncate">{cls}</span>
                    <div className="flex-1 h-2 rounded-full bg-white/10">
                      <div className="h-2 rounded-full bg-pink-400" style={{ width: `${Number(prob) * 100}%` }} />
                    </div>
                    <span className="text-xs text-white/50">{(Number(prob) * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className={glass}>
          <h2 className="mb-4 text-xl font-semibold text-white">Results History ({results.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-white/80">
              <thead><tr className="border-b border-white/20 text-white/60">
                <th className="pb-2 text-left">Input Preview</th>
                <th className="pb-2 text-left">Predicted Class</th>
                <th className="pb-2 text-left">Confidence</th>
                <th className="pb-2 text-left">Entity Type</th>
                <th className="pb-2 text-left">Model</th>
                <th className="pb-2 text-left">Time (ms)</th>
                <th className="pb-2 text-left">Date</th>
              </tr></thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.id} className="border-b border-white/10">
                    <td className="py-2 max-w-xs truncate">{r.input_text.substring(0, 50)}{r.input_text.length > 50 ? '…' : ''}</td>
                    <td className="py-2"><span className="rounded-full bg-pink-500/30 text-pink-200 px-2 py-0.5 text-xs">{r.predicted_class}</span></td>
                    <td className="py-2">{(Number(r.confidence) * 100).toFixed(1)}%</td>
                    <td className="py-2">{r.entity_type || '—'}</td>
                    <td className="py-2 text-xs font-mono">{r.model_name}</td>
                    <td className="py-2">{r.processing_time_ms}</td>
                    <td className="py-2 text-xs">{new Date(r.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!results.length && <p className="py-8 text-center text-white/40">No classifications yet</p>}
          </div>
        </div>
      )}

      {tab === 'config' && (
        <div className={glass}>
          <h2 className="mb-4 text-xl font-semibold text-white">Model Configuration</h2>
          <div className="space-y-4">
            <div className="rounded-xl bg-pink-500/20 border border-pink-400/30 p-4">
              <p className="font-semibold text-white mb-1">Current Model</p>
              <p className="font-mono text-pink-200">llama3.2 (via Ollama)</p>
              <p className="text-sm text-white/60 mt-2">The classifier sends a prompt to the local Ollama endpoint and parses the response to match one of the provided class names.</p>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <p className="font-semibold text-white mb-3">Example Class Lists</p>
              <div className="space-y-3">
                {[
                  { name: 'Sentiment Analysis', classes: ['positive', 'negative', 'neutral'] },
                  { name: 'Support Priority', classes: ['urgent', 'high', 'medium', 'low'] },
                  { name: 'Content Category', classes: ['yoga', 'wellness', 'nutrition', 'mindfulness', 'fitness'] },
                ].map(({ name, classes }) => (
                  <div key={name}>
                    <p className="text-sm text-white/70 mb-1">{name}</p>
                    <div className="flex flex-wrap gap-1">
                      {classes.map((c) => (
                        <span key={c} className="rounded-full bg-white/10 border border-white/20 px-2 py-0.5 text-xs text-white/80">{c}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className={glass}>
              <p className="text-xs text-white/60 mb-1 uppercase tracking-wide">Total Classifications</p>
              <p className="text-3xl font-bold text-white">{results.length}</p>
            </div>
            <div className={glass}>
              <p className="text-xs text-white/60 mb-1 uppercase tracking-wide">Avg Confidence</p>
              <p className="text-3xl font-bold text-white">{avgConfidence}%</p>
            </div>
            <div className={glass}>
              <p className="text-xs text-white/60 mb-1 uppercase tracking-wide">Last 7 Days</p>
              <p className="text-3xl font-bold text-white">{last7Days.length}</p>
            </div>
          </div>
          <div className={glass}>
            <h3 className="mb-4 text-lg font-semibold text-white">Class Distribution</h3>
            <div className="space-y-2">
              {Object.entries(classCounts).sort((a, b) => b[1] - a[1]).map(([cls, count]) => {
                const pct = results.length ? Math.round((count / results.length) * 100) : 0;
                return (
                  <div key={cls} className="flex items-center gap-3">
                    <span className="text-sm text-white/70 w-28 truncate">{cls}</span>
                    <div className="flex-1 h-4 rounded-full bg-white/10">
                      <div className="h-4 rounded-full bg-pink-400/70" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-white/50 w-12 text-right">{count} ({pct}%)</span>
                  </div>
                );
              })}
              {!Object.keys(classCounts).length && <p className="text-white/40 text-sm">No data yet</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
