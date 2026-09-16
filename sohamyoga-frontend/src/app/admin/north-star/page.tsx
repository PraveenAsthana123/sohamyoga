'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────

interface NorthStar {
  id: number;
  name: string;
  description: string | null;
  metric_formula: string | null;
  current_value: number | null;
  target_value: number | null;
  unit: string;
  is_primary: boolean;
  status: string;
  last_updated_at: string;
}

interface OKR {
  id: number;
  cycle: string;
  level: string;
  team: string | null;
  objective: string;
  status: string;
  progress_pct: number;
  created_at: string;
}

interface KeyResult {
  id: number;
  okr_id: number;
  kr_number: number;
  description: string;
  metric_type: string;
  start_value: number;
  current_value: number;
  target_value: number;
  unit: string;
  confidence_pct: number;
  status: string;
  updated_at: string;
}

interface ApiData {
  northStars: NorthStar[];
  okrs: OKR[];
  keyResults: KeyResult[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const GLASS = 'backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl p-6 shadow-xl';
const TAB_ACTIVE = 'bg-white/20 text-white rounded-lg px-4 py-2 text-sm font-medium';
const TAB_INACTIVE = 'text-white/60 hover:bg-white/10 rounded-lg px-4 py-2 text-sm font-medium transition-colors';

const TABS = ['North Star','OKR Overview','Key Results Detail','Add OKR + KRs','Alignment View'];

const CONFIDENCE_COLOR = (pct: number): string => {
  if (pct >= 70) return 'text-green-400 bg-green-500/20 border-green-500/30';
  if (pct >= 40) return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
  return 'text-red-400 bg-red-500/20 border-red-500/30';
};

const CONFIDENCE_ICON = (pct: number): string => pct >= 70 ? '🟢' : pct >= 40 ? '🟡' : '🔴';

const STATUS_COLORS: Record<string, string> = {
  active:    'bg-green-500/20 text-green-200 border-green-500/30',
  completed: 'bg-purple-500/20 text-purple-200 border-purple-500/30',
  cancelled: 'bg-red-500/20 text-red-200 border-red-500/30',
  on_track:  'bg-green-500/20 text-green-200 border-green-500/30',
  at_risk:   'bg-yellow-500/20 text-yellow-200 border-yellow-500/30',
  off_track: 'bg-red-500/20 text-red-200 border-red-500/30',
};

function krProgress(kr: KeyResult): number {
  const range = kr.target_value - kr.start_value;
  if (range <= 0) return 0;
  return Math.min(100, Math.max(0, ((kr.current_value - kr.start_value) / range) * 100));
}

const LEVELS = ['company','team','individual'];
const OKR_STATUSES = ['active','completed','cancelled'];

// ─── Component ─────────────────────────────────────────────────────────────

export default function NorthStarPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [data, setData] = useState<ApiData>({ northStars: [], okrs: [], keyResults: [] });
  const [loading, setLoading] = useState(true);
  const [expandedOkr, setExpandedOkr] = useState<number | null>(null);

  // Update NS value inline
  const [nsUpdateVal, setNsUpdateVal] = useState('');
  const [nsUpdating, setNsUpdating] = useState(false);

  // KR update modal
  const [updatingKr, setUpdatingKr] = useState<KeyResult | null>(null);
  const [krNewVal, setKrNewVal] = useState('');
  const [krConfidence, setKrConfidence] = useState('');

  // Add OKR form — step 1
  const [step, setStep] = useState(1);
  const [okrForm, setOkrForm] = useState({ objective: '', cycle: 'Q4-2026', level: 'company', team: '', status: 'active' });
  const [krForms, setKrForms] = useState([
    { description: '', start_value: '0', target_value: '', unit: 'count', metric_type: 'number' },
  ]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/north-star');
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const primary = data.northStars.find(n => n.is_primary) ?? data.northStars[0] ?? null;
  const secondaryNS = data.northStars.filter(n => !n.is_primary);

  const nsPct = primary && primary.target_value && primary.target_value > 0 && primary.current_value !== null
    ? Math.min(100, (primary.current_value / primary.target_value) * 100)
    : 0;

  async function updateNS() {
    if (!primary || !nsUpdateVal) return;
    setNsUpdating(true);
    await fetch('/api/admin/north-star', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'north_star', id: primary.id, current_value: Number(nsUpdateVal) }),
    });
    setNsUpdateVal('');
    setNsUpdating(false);
    await load();
  }

  async function updateKR() {
    if (!updatingKr) return;
    await fetch('/api/admin/north-star', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'key_result',
        id: updatingKr.id,
        current_value: Number(krNewVal),
        confidence_pct: krConfidence ? Number(krConfidence) : undefined,
      }),
    });
    setUpdatingKr(null);
    setKrNewVal('');
    setKrConfidence('');
    await load();
  }

  async function submitOKR(e: React.FormEvent) {
    e.preventDefault();
    await fetch('/api/admin/north-star', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'okr',
        ...okrForm,
        key_results: krForms.map(k => ({
          description: k.description,
          start_value: Number(k.start_value),
          target_value: Number(k.target_value),
          unit: k.unit,
          metric_type: k.metric_type,
        })),
      }),
    });
    setOkrForm({ objective: '', cycle: 'Q4-2026', level: 'company', team: '', status: 'active' });
    setKrForms([{ description: '', start_value: '0', target_value: '', unit: 'count', metric_type: 'number' }]);
    setStep(1);
    await load();
    setActiveTab(1);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-violet-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className={GLASS}>
          <h1 className="text-3xl font-bold text-white">⭐ North Star & OKR Tracker</h1>
          <p className="text-white/60 mt-1">Track your north star metric and align objectives & key results.</p>
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

        {/* Tab 0: North Star */}
        {!loading && activeTab === 0 && (
          <div className="space-y-6">
            {primary && (
              <div className={GLASS + ' space-y-6'}>
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-yellow-400 text-2xl">⭐</span>
                      <span className="bg-yellow-500/20 text-yellow-300 text-xs px-2 py-0.5 rounded-full border border-yellow-500/30">PRIMARY NORTH STAR</span>
                    </div>
                    <h2 className="text-2xl font-bold text-white">{primary.name}</h2>
                    <p className="text-white/60 mt-1">{primary.description}</p>
                    {primary.metric_formula && (
                      <p className="text-white/40 text-sm mt-2 font-mono bg-white/5 px-3 py-1.5 rounded-lg inline-block">
                        {primary.metric_formula}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-5xl font-black text-white">{primary.current_value?.toLocaleString() ?? '—'}</p>
                    <p className="text-white/50">/ {primary.target_value?.toLocaleString()} {primary.unit}</p>
                    <p className="text-white/30 text-xs mt-1">{nsPct.toFixed(1)}% of target</p>
                  </div>
                </div>

                {/* Massive progress bar */}
                <div className="space-y-2">
                  <div className="h-6 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 rounded-full transition-all duration-1000"
                      style={{ width: `${nsPct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-white/40">
                    <span>0</span>
                    <span>{primary.target_value?.toLocaleString()} {primary.unit}</span>
                  </div>
                </div>

                {/* Inline update form */}
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    placeholder="New current value"
                    className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm w-40"
                    value={nsUpdateVal}
                    onChange={e => setNsUpdateVal(e.target.value)}
                  />
                  <button
                    onClick={updateNS}
                    disabled={nsUpdating || !nsUpdateVal}
                    className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {nsUpdating ? 'Updating…' : 'Update Value'}
                  </button>
                </div>
              </div>
            )}

            {/* Secondary NS metrics */}
            {secondaryNS.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {secondaryNS.map(ns => {
                  const pct = ns.target_value && ns.target_value > 0 && ns.current_value !== null
                    ? Math.min(100, (ns.current_value / ns.target_value) * 100) : 0;
                  return (
                    <div key={ns.id} className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
                      <p className="text-white font-medium text-sm">{ns.name}</p>
                      <div className="flex justify-between">
                        <span className="text-2xl font-bold text-white">{ns.current_value?.toLocaleString() ?? '—'}</span>
                        <span className="text-white/40 text-sm">/ {ns.target_value?.toLocaleString()}</span>
                      </div>
                      <div className="h-2 bg-white/10 rounded-full">
                        <div className="h-full bg-blue-400 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 1: OKR Overview */}
        {!loading && activeTab === 1 && (
          <div className="space-y-4">
            {data.okrs.map(okr => {
              const krs = data.keyResults.filter(kr => kr.okr_id === okr.id);
              const isExpanded = expandedOkr === okr.id;
              return (
                <div key={okr.id} className={GLASS + ' space-y-4'}>
                  <div className="flex items-start justify-between gap-4 cursor-pointer" onClick={() => setExpandedOkr(isExpanded ? null : okr.id)}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className="bg-blue-500/20 text-blue-200 text-xs px-2 py-0.5 rounded-full border border-blue-500/30">{okr.cycle}</span>
                        <span className="bg-purple-500/20 text-purple-200 text-xs px-2 py-0.5 rounded-full border border-purple-500/30">{okr.level}</span>
                        {okr.team && <span className="bg-white/10 text-white/60 text-xs px-2 py-0.5 rounded-full">{okr.team}</span>}
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[okr.status] ?? ''}`}>{okr.status}</span>
                      </div>
                      <h3 className="text-white font-semibold text-lg">{okr.objective}</h3>
                    </div>

                    {/* Circular-ish progress */}
                    <div className="flex-shrink-0 text-center">
                      <div className="relative w-16 h-16">
                        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                          <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
                          <circle
                            cx="32" cy="32" r="28" fill="none"
                            stroke={okr.progress_pct >= 70 ? '#34d399' : okr.progress_pct >= 40 ? '#fbbf24' : '#f87171'}
                            strokeWidth="6"
                            strokeDasharray={`${(okr.progress_pct / 100) * 175.9} 175.9`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-sm">{okr.progress_pct}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Key Results (expanded) */}
                  {isExpanded && krs.length > 0 && (
                    <div className="space-y-3 pt-2 border-t border-white/10">
                      {krs.map(kr => {
                        const pct = krProgress(kr);
                        return (
                          <div key={kr.id} className="bg-white/5 rounded-xl p-4 space-y-2">
                            <div className="flex justify-between items-start">
                              <p className="text-white/80 text-sm flex-1">KR{kr.kr_number}: {kr.description}</p>
                              <span className={`text-xs px-2 py-0.5 rounded-full border ml-2 ${CONFIDENCE_COLOR(kr.confidence_pct)}`}>
                                {CONFIDENCE_ICON(kr.confidence_pct)} {kr.confidence_pct}%
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-white/50">
                              <span>{kr.start_value} → <span className="text-white font-medium">{kr.current_value}</span> → {kr.target_value} {kr.unit}</span>
                            </div>
                            <div className="h-2 bg-white/10 rounded-full">
                              <div
                                className={`h-full rounded-full transition-all ${pct >= 70 ? 'bg-green-400' : pct >= 40 ? 'bg-yellow-400' : 'bg-red-400'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-white/40">{pct.toFixed(0)}% progress</span>
                              <button
                                onClick={() => { setUpdatingKr(kr); setKrNewVal(String(kr.current_value)); setKrConfidence(String(kr.confidence_pct)); }}
                                className="text-xs bg-white/10 hover:bg-white/20 text-white/70 px-2 py-0.5 rounded transition-colors"
                              >
                                Update
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {!isExpanded && (
                    <p className="text-white/30 text-xs">{krs.length} key results · click to expand</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 2: Key Results Detail */}
        {!loading && activeTab === 2 && (
          <div className={GLASS}>
            <h2 className="text-xl font-semibold text-white mb-4">All Key Results</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-white/50">
                    <th className="text-left py-2">Objective</th>
                    <th className="text-left py-2 pl-4">KR Description</th>
                    <th className="text-right py-2">Start</th>
                    <th className="text-right py-2">Current</th>
                    <th className="text-right py-2">Target</th>
                    <th className="text-right py-2">Progress</th>
                    <th className="text-right py-2">Confidence</th>
                    <th className="text-left py-2 pl-4">Status</th>
                    <th className="text-left py-2 pl-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.keyResults.map(kr => {
                    const okr = data.okrs.find(o => o.id === kr.okr_id);
                    const pct = krProgress(kr);
                    return (
                      <tr key={kr.id} className="border-b border-white/5 text-white/80 hover:bg-white/5">
                        <td className="py-2 text-xs text-white/50 max-w-xs">
                          <div className="truncate max-w-[200px]">{okr?.objective ?? '—'}</div>
                          <div className="text-white/30">{okr?.cycle}</div>
                        </td>
                        <td className="py-2 pl-4 text-xs max-w-xs">
                          <div>KR{kr.kr_number}: {kr.description}</div>
                        </td>
                        <td className="py-2 text-right font-mono text-white/50">{kr.start_value}</td>
                        <td className="py-2 text-right font-mono font-bold text-white">{kr.current_value}</td>
                        <td className="py-2 text-right font-mono text-white/50">{kr.target_value} {kr.unit}</td>
                        <td className="py-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${pct >= 70 ? 'bg-green-400' : pct >= 40 ? 'bg-yellow-400' : 'bg-red-400'}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs">{pct.toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className="py-2 text-right">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${CONFIDENCE_COLOR(kr.confidence_pct)}`}>
                            {CONFIDENCE_ICON(kr.confidence_pct)} {kr.confidence_pct}%
                          </span>
                        </td>
                        <td className="py-2 pl-4">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[kr.status] ?? ''}`}>{kr.status}</span>
                        </td>
                        <td className="py-2 pl-4">
                          <button
                            onClick={() => { setUpdatingKr(kr); setKrNewVal(String(kr.current_value)); setKrConfidence(String(kr.confidence_pct)); }}
                            className="text-xs bg-white/10 hover:bg-white/20 text-white/70 px-2 py-0.5 rounded transition-colors"
                          >
                            Update
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Add OKR + KRs */}
        {activeTab === 3 && (
          <div className={GLASS}>
            <div className="flex items-center gap-4 mb-6">
              <h2 className="text-xl font-semibold text-white">Add OKR</h2>
              <div className="flex gap-2">
                {[1,2].map(s => (
                  <div key={s} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step === s ? 'bg-blue-600 text-white' : 'bg-white/10 text-white/40'}`}>{s}</div>
                ))}
              </div>
            </div>

            {step === 1 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-white/70 text-sm block mb-1">Objective *</label>
                    <input required className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm" value={okrForm.objective} onChange={e => setOkrForm(p => ({ ...p, objective: e.target.value }))} placeholder="e.g. Grow digital marketing client base" />
                  </div>
                  <div>
                    <label className="text-white/70 text-sm block mb-1">Cycle</label>
                    <input className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm" value={okrForm.cycle} onChange={e => setOkrForm(p => ({ ...p, cycle: e.target.value }))} placeholder="Q4-2026" />
                  </div>
                  <div>
                    <label className="text-white/70 text-sm block mb-1">Level</label>
                    <select className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm" value={okrForm.level} onChange={e => setOkrForm(p => ({ ...p, level: e.target.value }))}>
                      {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-white/70 text-sm block mb-1">Team</label>
                    <input className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm" value={okrForm.team} onChange={e => setOkrForm(p => ({ ...p, team: e.target.value }))} placeholder="e.g. Marketing" />
                  </div>
                  <div>
                    <label className="text-white/70 text-sm block mb-1">Status</label>
                    <select className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm" value={okrForm.status} onChange={e => setOkrForm(p => ({ ...p, status: e.target.value }))}>
                      {OKR_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <button
                  onClick={() => okrForm.objective && setStep(2)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  Next: Add Key Results →
                </button>
              </div>
            )}

            {step === 2 && (
              <form onSubmit={submitOKR} className="space-y-4">
                <div className="bg-white/5 rounded-xl p-4 mb-2">
                  <p className="text-white/60 text-xs">Objective</p>
                  <p className="text-white font-medium">{okrForm.objective} · {okrForm.cycle} · {okrForm.level}</p>
                </div>
                {krForms.map((kr, i) => (
                  <div key={i} className="bg-white/5 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <p className="text-white/60 text-sm font-medium">KR {i+1}</p>
                      {krForms.length > 1 && (
                        <button type="button" onClick={() => setKrForms(prev => prev.filter((_, j) => j !== i))} className="text-red-400 text-xs hover:text-red-300">Remove</button>
                      )}
                    </div>
                    <input required className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm" placeholder="Key result description" value={kr.description} onChange={e => setKrForms(prev => prev.map((k, j) => j === i ? { ...k, description: e.target.value } : k))} />
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-white/50 text-xs block mb-1">Start Value</label>
                        <input type="number" className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm" value={kr.start_value} onChange={e => setKrForms(prev => prev.map((k, j) => j === i ? { ...k, start_value: e.target.value } : k))} />
                      </div>
                      <div>
                        <label className="text-white/50 text-xs block mb-1">Target Value *</label>
                        <input required type="number" className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm" value={kr.target_value} onChange={e => setKrForms(prev => prev.map((k, j) => j === i ? { ...k, target_value: e.target.value } : k))} />
                      </div>
                      <div>
                        <label className="text-white/50 text-xs block mb-1">Unit</label>
                        <input className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm" value={kr.unit} onChange={e => setKrForms(prev => prev.map((k, j) => j === i ? { ...k, unit: e.target.value } : k))} />
                      </div>
                    </div>
                  </div>
                ))}
                {krForms.length < 5 && (
                  <button type="button" onClick={() => setKrForms(prev => [...prev, { description: '', start_value: '0', target_value: '', unit: 'count', metric_type: 'number' }])} className="text-white/50 hover:text-white/80 text-sm transition-colors">+ Add Key Result</button>
                )}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setStep(1)} className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm transition-colors">← Back</button>
                  <button type="submit" className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition-colors">Create OKR</button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Tab 4: Alignment View */}
        {!loading && activeTab === 4 && (
          <div className={GLASS}>
            <h2 className="text-xl font-semibold text-white mb-6">OKR → North Star Alignment Tree</h2>
            <div className="space-y-8">
              {/* North Star root node */}
              {primary && (
                <div className="flex flex-col items-center">
                  <div className="bg-yellow-500/20 border-2 border-yellow-500/50 rounded-2xl px-8 py-4 text-center max-w-md">
                    <p className="text-yellow-400 text-xs uppercase tracking-wide mb-1">⭐ Company North Star</p>
                    <p className="text-white font-bold">{primary.name}</p>
                    <p className="text-yellow-300 text-lg font-black mt-1">{primary.current_value?.toLocaleString()} / {primary.target_value?.toLocaleString()}</p>
                  </div>

                  {/* Vertical connector */}
                  <div className="w-0.5 h-8 bg-white/20" />

                  {/* OKR branches */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
                    {data.okrs.map(okr => {
                      const krs = data.keyResults.filter(kr => kr.okr_id === okr.id);
                      return (
                        <div key={okr.id} className="flex flex-col items-center">
                          {/* OKR node */}
                          <div className="bg-blue-500/20 border border-blue-500/40 rounded-xl p-4 w-full">
                            <p className="text-blue-300 text-xs uppercase tracking-wide mb-1">Company OKR · {okr.cycle}</p>
                            <p className="text-white text-sm font-medium">{okr.objective}</p>
                            <div className="mt-2 flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-white/10 rounded-full">
                                <div className="h-full bg-blue-400 rounded-full" style={{ width: `${okr.progress_pct}%` }} />
                              </div>
                              <span className="text-blue-300 text-xs">{okr.progress_pct}%</span>
                            </div>
                          </div>

                          {/* KR sub-nodes */}
                          {krs.length > 0 && (
                            <div className="w-full pl-4 border-l border-white/10 ml-4 mt-2 space-y-2">
                              {krs.map(kr => {
                                const pct = krProgress(kr);
                                return (
                                  <div key={kr.id} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                                    <p className="text-white/70 text-xs">KR{kr.kr_number}: {kr.description}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <div className="flex-1 h-1 bg-white/10 rounded-full">
                                        <div className={`h-full rounded-full ${pct >= 70 ? 'bg-green-400' : pct >= 40 ? 'bg-yellow-400' : 'bg-red-400'}`} style={{ width: `${pct}%` }} />
                                      </div>
                                      <span className={`text-xs ${CONFIDENCE_COLOR(kr.confidence_pct).split(' ')[0]}`}>{CONFIDENCE_ICON(kr.confidence_pct)}</span>
                                    </div>
                                    <p className="text-white/40 text-xs mt-1">{kr.current_value} / {kr.target_value} {kr.unit}</p>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* KR Update Modal */}
        {updatingKr && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={GLASS + ' w-full max-w-md'}>
              <h3 className="text-white font-semibold mb-1">Update Key Result</h3>
              <p className="text-white/60 text-sm mb-4">KR{updatingKr.kr_number}: {updatingKr.description}</p>
              <div className="space-y-3">
                <div>
                  <label className="text-white/70 text-sm block mb-1">Current Value</label>
                  <input type="number" className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm" value={krNewVal} onChange={e => setKrNewVal(e.target.value)} />
                </div>
                <div>
                  <label className="text-white/70 text-sm block mb-1">Confidence % (0-100)</label>
                  <input type="number" min="0" max="100" className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm" value={krConfidence} onChange={e => setKrConfidence(e.target.value)} />
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={updateKR} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition-colors">Save</button>
                  <button onClick={() => setUpdatingKr(null)} className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm transition-colors">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
